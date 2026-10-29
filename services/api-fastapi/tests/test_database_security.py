"""Run against an explicitly selected local PostgreSQL cluster, never production."""

import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing, contextmanager
from pathlib import Path
from threading import Barrier
from urllib.parse import urlparse
from uuid import uuid4

import psycopg2
import pytest
from psycopg2 import errors, sql
from psycopg2.extensions import make_dsn


MEMBER = "10000000-0000-0000-0000-000000000001"
OTHER = "10000000-0000-0000-0000-000000000002"
COACH = "20000000-0000-0000-0000-000000000001"
GYM = "30000000-0000-0000-0000-000000000001"


@pytest.fixture(scope="module", params=[True, False], ids=["legacy-auto-grants", "explicit-grants"])
def security_database(request: pytest.FixtureRequest):
    base = os.environ.get("FITCONNECT_TEST_DATABASE_URL")
    if not base:
        pytest.skip("Set FITCONNECT_TEST_DATABASE_URL to an isolated local PostgreSQL cluster")
    if urlparse(base).hostname not in {"127.0.0.1", "localhost"}:
        pytest.fail("Database security tests accept a local PostgreSQL cluster only")
    name = "fitconnect_security_" + uuid4().hex
    schema = (Path(__file__).resolve().parents[3] / "infra/supabase/init.sql").read_text()
    with closing(psycopg2.connect(base)) as control:
        control.autocommit = True
        with control.cursor() as cursor:
            cursor.execute("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
                        CREATE ROLE anon NOLOGIN;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
                        CREATE ROLE authenticated NOLOGIN;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
                        CREATE ROLE service_role NOLOGIN BYPASSRLS;
                    END IF;
                END $$;
            """)
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        dsn = make_dsn(base, dbname=name)
        try:
            with closing(psycopg2.connect(dsn)) as conn:
                conn.autocommit = True
                with conn.cursor() as cursor:
                    # Cover both legacy projects and new projects with auto-grants off.
                    if request.param:
                        cursor.execute("ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role")
                    cursor.execute(schema)
                    cursor.execute("GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role")
                    cursor.execute(
                        "INSERT INTO auth.users(id) VALUES (%s),(%s),(%s)",
                        (MEMBER, OTHER, COACH),
                    )
                    cursor.execute(
                        "INSERT INTO profiles(id,email,role) VALUES (%s,'a@example.test','user'),(%s,'b@example.test','user'),(%s,'coach@example.test','coach')",
                        (MEMBER, OTHER, COACH),
                    )
                    cursor.execute("INSERT INTO gyms(id,name) VALUES (%s,'Gym')", (GYM,))
                    cursor.execute(
                        "INSERT INTO coach_details(id,gym_id,base_price) VALUES (%s,%s,60000)",
                        (COACH, GYM),
                    )
            yield dsn, schema, request.param
        finally:
            with control.cursor() as cursor:
                cursor.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


@contextmanager
def as_role(database, role, user=MEMBER):
    with closing(psycopg2.connect(database[0])) as conn:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute(sql.SQL("SET ROLE {}").format(sql.Identifier(role)))
            cursor.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (user,))
            yield cursor


def test_bootstrap_is_repeatable(security_database):
    with as_role(security_database, "postgres") as cursor:
        cursor.execute(security_database[1])


@pytest.mark.parametrize("role", ["anon", "authenticated"])
@pytest.mark.parametrize("statement", [
    "INSERT INTO rag_documents(title,content) VALUES ('forged','forged')",
    "UPDATE rag_documents SET content='forged'",
    "INSERT INTO payments(amount,platform_fee,coach_payout) VALUES (1,0,1)",
    "UPDATE payments SET status='released'",
])
def test_clients_cannot_write_payment_or_rag(security_database, role, statement):
    with as_role(security_database, role) as cursor:
        with pytest.raises(errors.InsufficientPrivilege):
            cursor.execute(statement)


def test_service_role_can_write_rag(security_database):
    with as_role(security_database, "service_role") as cursor:
        cursor.execute("INSERT INTO rag_documents(title,content) VALUES ('trusted','nutrition') RETURNING id")
        assert cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO payments(user_id,amount,platform_fee,coach_payout) VALUES (%s,60000,6000,54000) RETURNING id",
            (MEMBER,),
        )
        assert cursor.fetchone()[0]


def test_profiles_are_private_and_assignments_cannot_be_forged(security_database):
    with as_role(security_database, "anon", user="") as cursor:
        if security_database[2]:
            cursor.execute("SELECT id,email,phone FROM profiles")
            assert cursor.fetchall() == []
        else:
            with pytest.raises(errors.InsufficientPrivilege):
                cursor.execute("SELECT id,email,phone FROM profiles")
    with as_role(security_database, "authenticated") as cursor:
        cursor.execute("SELECT id,email FROM profiles")
        assert cursor.fetchall() == [(MEMBER, "a@example.test")]
        cursor.execute("UPDATE profiles SET full_name='Updated member' WHERE id=%s RETURNING full_name", (MEMBER,))
        assert cursor.fetchone()[0] == "Updated member"
        with pytest.raises(errors.InsufficientPrivilege):
            cursor.execute("UPDATE profiles SET role='admin' WHERE id=%s", (MEMBER,))
        with pytest.raises(errors.InsufficientPrivilege):
            cursor.execute("UPDATE profiles SET gym_id=%s WHERE id=%s", (GYM, MEMBER))


def test_client_cannot_bypass_booking_api(security_database):
    with as_role(security_database, "authenticated") as cursor:
        with pytest.raises(errors.InsufficientPrivilege):
            cursor.execute("UPDATE bookings SET status='completed'")
        with pytest.raises(errors.InsufficientPrivilege):
            cursor.execute(
                "INSERT INTO bookings(user_id,coach_id,scheduled_at,price) VALUES (%s,%s,'2026-12-01 10:00Z',1)",
                (MEMBER, COACH),
            )


def test_overlap_constraint_covers_duration_offsets_and_cancelled_slots(security_database):
    insert = """INSERT INTO bookings(user_id,coach_id,scheduled_at,price)
                VALUES (%s,%s,%s,60000) RETURNING id"""
    with as_role(security_database, "service_role") as cursor:
        cursor.execute(insert, (MEMBER, COACH, "2026-12-01 10:00+00"))
        original = cursor.fetchone()[0]
        for start in ["2026-12-01 10:30+00", "2026-12-01 09:30+00", "2026-12-01 19:00+09"]:
            with pytest.raises(errors.ExclusionViolation):
                cursor.execute(insert, (OTHER, COACH, start))
        cursor.execute(insert, (OTHER, COACH, "2026-12-01 11:00+00"))
        assert cursor.fetchone()[0]
        cursor.execute("UPDATE bookings SET status='cancelled' WHERE id=%s", (original,))
        cursor.execute(insert, (MEMBER, COACH, "2026-12-01 10:00+00"))
        assert cursor.fetchone()[0]


def test_concurrent_transactions_cannot_double_book(security_database):
    barrier = Barrier(2)

    def reserve(user):
        with closing(psycopg2.connect(security_database[0])) as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SET ROLE service_role")
                    barrier.wait(timeout=5)
                    cursor.execute(
                        "INSERT INTO bookings(user_id,coach_id,scheduled_at,price) VALUES (%s,%s,'2026-12-02 10:00Z',60000)",
                        (user, COACH),
                    )
                conn.commit()
                return "created"
            except errors.ExclusionViolation:
                conn.rollback()
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(reserve, [MEMBER, OTHER]))
    assert sorted(outcomes) == ["conflict", "created"]
