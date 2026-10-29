from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import coaches
from app.services.review_display import mask_review_author

COACH = "00000000-0000-0000-0000-0000000000f3"


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("최성원", "최*원"),
        ("남궁민수", "남**수"),
        ("김철", "김*"),
        ("김", "김*"),
        ("", "회원"),
        (None, "회원"),
        ("   ", "회원"),
        ("  최성원  ", "최*원"),
    ],
)
def test_review_author_is_masked(name, expected):
    assert mask_review_author(name) == expected


@pytest.mark.parametrize("empty_reviews", [False, True])
def test_coach_detail_returns_only_public_reviews_newest_first(strict_app, monkeypatch, empty_reviews):
    reviews = [
        {
            "id": f"review-{day}",
            "rating": 5,
            "content": "좋았습니다" if day % 2 else None,
            "created_at": f"2026-10-{day:02d}T09:00:00+00:00",
            "profiles": {"full_name": "최성원", "email": "private@example.com"},
            "email": "private@example.com",
        }
        for day in range(1, 23)
    ]
    reviews[-1]["profiles"] = None
    profile = {"id": COACH, "role": "coach", "reviews": None if empty_reviews else reviews}
    selections = []

    class Query:
        def select(self, fields):
            selections.append(fields)
            return self

        def eq(self, *_):
            return self

        def single(self):
            return self

        def execute(self):
            return SimpleNamespace(data=dict(profile))

    monkeypatch.setattr(coaches, "get_optional_supabase", lambda: SimpleNamespace(table=lambda _: Query()))
    with TestClient(strict_app.app) as client:
        response = client.get(f"/api/v1/coaches/{COACH}")
    assert response.status_code == 200
    assert selections == [
        "id, full_name, avatar_url, role, coach_details(*), "
        "reviews!reviews_coach_id_fkey(id, rating, content, created_at, "
        "profiles!reviews_user_id_fkey(full_name))"
    ]
    public_reviews = response.json()["reviews"]
    if empty_reviews:
        assert public_reviews == []
    else:
        assert len(public_reviews) == 20
        assert [row["id"] for row in public_reviews] == [f"review-{day}" for day in range(22, 2, -1)]
        assert public_reviews[0]["author"] == "회원"
        assert public_reviews[1]["author"] == "최*원"
        for review in public_reviews:
            assert set(review) == {"id", "rating", "content", "created_at", "author"}
            assert "profiles" not in review
            assert "email" not in review
