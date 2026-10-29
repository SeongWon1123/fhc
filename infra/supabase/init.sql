-- FitConnect schema bootstrap.
-- Runs on Supabase Postgres and on the local docker-compose postgres service.
-- Supabase SQL Editor: run this entire file, not only the GRANT statements.
-- Tables, RLS policies and explicit API grants are all included.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
    IF to_regclass('auth.users') IS NULL THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth'
          AND p.proname = 'uid'
          AND pg_get_function_identity_arguments(p.oid) = ''
    ) THEN
        CREATE FUNCTION auth.uid()
        RETURNS UUID
        LANGUAGE sql
        STABLE
        AS $function$
            SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
        $function$;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
    ELSE
        RAISE NOTICE 'pgvector extension is not available; rag_documents.embedding will use double precision[] fallback.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    fitness_goal TEXT,
    preferred_sports TEXT[],
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT profiles_role_check CHECK (role IN ('user', 'coach', 'gym_owner', 'admin')),
    CONSTRAINT profiles_fitness_goal_check CHECK (
        fitness_goal IS NULL
        OR fitness_goal IN ('weight_loss', 'muscle_gain', 'maintenance', 'endurance')
    )
);

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fitness_goal TEXT,
    ADD COLUMN IF NOT EXISTS preferred_sports TEXT[],
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'coach', 'gym_owner', 'admin'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_fitness_goal_check;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_fitness_goal_check CHECK (
        fitness_goal IS NULL
        OR fitness_goal IN ('weight_loss', 'muscle_gain', 'maintenance', 'endurance')
    );

CREATE TABLE IF NOT EXISTS gyms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    member_count INTEGER DEFAULT 0,
    subscription_plan TEXT DEFAULT 'pilot',
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT gyms_subscription_plan_check CHECK (subscription_plan IN ('pilot', 'basic', 'pro'))
);

CREATE TABLE IF NOT EXISTS coach_details (
    id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    specialty TEXT[],
    biography TEXT,
    qualifications TEXT[],
    base_price INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    rating NUMERIC(3, 2) DEFAULT 0,
    experience_years INTEGER DEFAULT 0,
    location TEXT,
    is_online_available BOOLEAN DEFAULT TRUE,
    is_offline_available BOOLEAN DEFAULT TRUE,
    video_url TEXT,
    review_count INTEGER DEFAULT 0,
    booking_count INTEGER DEFAULT 0,
    gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
    CONSTRAINT coach_details_rating_check CHECK (rating BETWEEN 0 AND 5),
    CONSTRAINT coach_details_base_price_check CHECK (base_price IS NULL OR base_price >= 0)
);

-- Membership and coach assignment are server-managed tenant boundaries.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL;

ALTER TABLE coach_details
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS specialty TEXT[],
    ADD COLUMN IF NOT EXISTS biography TEXT,
    ADD COLUMN IF NOT EXISTS qualifications TEXT[],
    ADD COLUMN IF NOT EXISTS base_price INTEGER,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS is_online_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_offline_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL;

-- Bookable hourly start times per weekday in Korea time (Asia/Seoul).
-- The default keeps the original fixed booking timetable for existing coaches.
ALTER TABLE coach_details
    ADD COLUMN IF NOT EXISTS weekly_availability JSONB NOT NULL DEFAULT '{
        "mon": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "tue": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "wed": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "thu": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "fri": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "sat": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"],
        "sun": ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00"]
    }'::jsonb;

ALTER TABLE coach_details DROP CONSTRAINT IF EXISTS coach_details_weekly_availability_check;
ALTER TABLE coach_details
    ADD CONSTRAINT coach_details_weekly_availability_check
    CHECK (jsonb_typeof(weekly_availability) = 'object');

ALTER TABLE coach_details DROP CONSTRAINT IF EXISTS coach_details_rating_check;
ALTER TABLE coach_details
    ADD CONSTRAINT coach_details_rating_check CHECK (rating BETWEEN 0 AND 5);

ALTER TABLE coach_details DROP CONSTRAINT IF EXISTS coach_details_base_price_check;
ALTER TABLE coach_details
    ADD CONSTRAINT coach_details_base_price_check CHECK (base_price IS NULL OR base_price >= 0);

CREATE TABLE IF NOT EXISTS workout_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workout_type TEXT,
    duration INTEGER,
    calories_burned INTEGER,
    data JSONB,
    sport_category TEXT,
    rep_count INTEGER,
    form_score NUMERIC(4, 1),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT workout_logs_duration_check CHECK (duration IS NULL OR duration >= 0),
    CONSTRAINT workout_logs_calories_check CHECK (calories_burned IS NULL OR calories_burned >= 0),
    CONSTRAINT workout_logs_form_score_check CHECK (form_score IS NULL OR form_score BETWEEN 0 AND 100)
);

ALTER TABLE workout_logs
    ADD COLUMN IF NOT EXISTS sport_category TEXT,
    ADD COLUMN IF NOT EXISTS rep_count INTEGER,
    ADD COLUMN IF NOT EXISTS form_score NUMERIC(4, 1);

ALTER TABLE workout_logs
    ALTER COLUMN form_score TYPE NUMERIC(4, 1);

CREATE TABLE IF NOT EXISTS diet_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    food_name TEXT,
    calories INTEGER,
    macronutrients JSONB,
    image_url TEXT,
    meal_type TEXT,
    ai_analysis TEXT,
    coach_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT diet_logs_calories_check CHECK (calories IS NULL OR calories >= 0),
    CONSTRAINT diet_logs_meal_type_check CHECK (
        meal_type IS NULL
        OR meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')
    )
);

ALTER TABLE diet_logs
    ADD COLUMN IF NOT EXISTS meal_type TEXT,
    ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
    ADD COLUMN IF NOT EXISTS coach_feedback TEXT;

ALTER TABLE diet_logs DROP CONSTRAINT IF EXISTS diet_logs_meal_type_check;
ALTER TABLE diet_logs
    ADD CONSTRAINT diet_logs_meal_type_check CHECK (
        meal_type IS NULL
        OR meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')
    );

CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    session_type TEXT DEFAULT 'online',
    status TEXT DEFAULT 'pending',
    price INTEGER NOT NULL,
    amount INTEGER GENERATED ALWAYS AS (price) STORED,
    meeting_url TEXT,
    location TEXT,
    notes TEXT,
    coach_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bookings_duration_minutes_check CHECK (duration_minutes > 0),
    CONSTRAINT bookings_session_type_check CHECK (session_type IN ('online', 'offline')),
    CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT bookings_price_check CHECK (price >= 0)
);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
    ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS meeting_url TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS coach_notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL;

UPDATE bookings AS booking
SET gym_id = coach.gym_id
FROM coach_details AS coach
WHERE booking.coach_id = coach.id AND booking.gym_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_no_active_overlap' AND conrelid = 'bookings'::regclass
    ) THEN
        -- Fails rather than silently deleting/rescheduling existing overlaps.
        ALTER TABLE bookings ADD CONSTRAINT bookings_no_active_overlap
        EXCLUDE USING gist (
            coach_id WITH =,
            tsrange(
                scheduled_at AT TIME ZONE 'UTC',
                (scheduled_at AT TIME ZONE 'UTC') + duration_minutes * INTERVAL '1 minute',
                '[)'
            ) WITH &&
        ) WHERE (status IN ('pending', 'confirmed'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'amount'
    ) THEN
        ALTER TABLE bookings ADD COLUMN amount INTEGER GENERATED ALWAYS AS (price) STORED;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    platform_fee INTEGER NOT NULL,
    coach_payout INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    toss_payment_key TEXT,
    toss_order_id TEXT UNIQUE,
    paid_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT payments_status_check CHECK (status IN ('pending', 'escrowed', 'released', 'refunded')),
    CONSTRAINT payments_amount_check CHECK (amount >= 0),
    CONSTRAINT payments_platform_fee_check CHECK (platform_fee >= 0),
    CONSTRAINT payments_coach_payout_check CHECK (coach_payout >= 0)
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    role TEXT,
    content TEXT NOT NULL,
    context_type TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant')),
    CONSTRAINT chat_messages_context_type_check CHECK (context_type IN ('diet', 'workout', 'clothing', 'general'))
);

CREATE TABLE IF NOT EXISTS clothing_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    sport_category TEXT NOT NULL,
    items JSONB NOT NULL,
    clicked_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ,
    commission_rate NUMERIC(4, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT clothing_commission_rate_check CHECK (commission_rate IS NULL OR commission_rate BETWEEN 0 AND 1)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'vector'
    ) THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS rag_documents (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT,
                source TEXT,
                embedding vector(768),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT rag_documents_category_check CHECK (
                    category IS NULL
                    OR category IN ('nutrition', 'exercise', 'supplement', 'clothing')
                )
            )
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS rag_documents (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT,
                source TEXT,
                embedding DOUBLE PRECISION[],
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT rag_documents_category_check CHECK (
                    category IS NULL
                    OR category IN ('nutrition', 'exercise', 'supplement', 'clothing')
                )
            )
        $sql$;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_unique_source
    ON rag_documents (title, category, source);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coach ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user ON diet_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_diet_logs_created_at ON diet_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_clothing_recommendations_user ON clothing_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rag_documents'
          AND column_name = 'embedding'
          AND udt_name = 'vector'
    ) THEN
        IF EXISTS (SELECT 1 FROM pg_am WHERE amname = 'hnsw') THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL';
        ELSE
            RAISE NOTICE 'pgvector HNSW index access method is not available; skipping ANN index.';
        END IF;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated ON bookings;
CREATE TRIGGER trg_bookings_updated
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION lock_booking_coach_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Serialize inserts before either transaction enters the GiST index.
    -- The exclusion constraint remains the authority for all writes/updates.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.coach_id::text, 0));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_slot_lock ON bookings;
CREATE TRIGGER trg_booking_slot_lock
BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION lock_booking_coach_slot();

CREATE OR REPLACE FUNCTION protect_profile_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.role IS DISTINCT FROM 'user' OR NEW.gym_id IS NOT NULL THEN
                RAISE EXCEPTION 'Profile role and gym assignment are server-managed' USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.gym_id IS DISTINCT FROM OLD.gym_id THEN
            RAISE EXCEPTION 'Profile role and gym assignment are server-managed' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_assignment ON profiles;
CREATE TRIGGER trg_profile_assignment
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_assignment();

-- booking_count is the number of completed sessions; repair any drift on every run.
UPDATE coach_details cd
SET booking_count = counted.total
FROM (
    SELECT details.id, COUNT(b.id) FILTER (WHERE b.status = 'completed') AS total
    FROM coach_details details
    LEFT JOIN bookings b ON b.coach_id = details.id
    GROUP BY details.id
) counted
WHERE cd.id = counted.id AND cd.booking_count IS DISTINCT FROM counted.total;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can edit own profile" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "coach_details_read_all" ON coach_details;
CREATE POLICY "coach_details_read_all" ON coach_details FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "coach_details_insert_own" ON coach_details;
DROP POLICY IF EXISTS "coach_details_update_own" ON coach_details;

DROP POLICY IF EXISTS "workout_logs_own" ON workout_logs;
CREATE POLICY "workout_logs_own" ON workout_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "diet_logs_own" ON diet_logs;
CREATE POLICY "diet_logs_own" ON diet_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gyms_read_all" ON gyms;
CREATE POLICY "gyms_read_all" ON gyms FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "gyms_owner_insert" ON gyms;
CREATE POLICY "gyms_owner_insert" ON gyms FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "gyms_owner_update" ON gyms;
CREATE POLICY "gyms_owner_update" ON gyms FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "bookings_user_select" ON bookings;
CREATE POLICY "bookings_user_select" ON bookings FOR SELECT USING (auth.uid() = user_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "bookings_user_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_user_update" ON bookings;

DROP POLICY IF EXISTS "payments_user_select" ON payments;
CREATE POLICY "payments_user_select" ON payments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_service_insert" ON payments;
DROP POLICY IF EXISTS "payments_service_update" ON payments;
-- Server service-role clients bypass RLS. No client write policy is required.

DROP POLICY IF EXISTS "reviews_read_all" ON reviews;
CREATE POLICY "reviews_read_all" ON reviews FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "reviews_user_insert" ON reviews;
CREATE POLICY "reviews_user_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_user_update" ON reviews;
CREATE POLICY "reviews_user_update" ON reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_own" ON chat_messages;
CREATE POLICY "chat_messages_own" ON chat_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clothing_own" ON clothing_recommendations;
CREATE POLICY "clothing_own" ON clothing_recommendations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_read_all" ON rag_documents;
CREATE POLICY "rag_read_all" ON rag_documents FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "rag_service_insert" ON rag_documents;
DROP POLICY IF EXISTS "rag_service_update" ON rag_documents;

DO $$
DECLARE
    client_role TEXT;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format(
                'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON payments, rag_documents, bookings, coach_details FROM %I',
                client_role
            );
            EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON profiles FROM %I', client_role);
        END IF;
    END LOOP;
END $$;

DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New Supabase projects may disable automatic table grants.
-- Keep this after table creation; RLS alone does not grant table access.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA public TO service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
            profiles, gyms, coach_details, workout_logs, diet_logs, bookings,
            payments, reviews, chat_messages, clothing_recommendations,
            rag_documents, notifications
        TO service_role;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;
        GRANT SELECT ON TABLE bookings, diet_logs, workout_logs TO authenticated;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rag_documents'
          AND column_name = 'embedding'
          AND udt_name = 'vector'
    ) THEN
        EXECUTE $sql$
            CREATE OR REPLACE FUNCTION match_rag_documents(
                query_embedding vector(768),
                match_threshold FLOAT DEFAULT 0.5,
                match_count INT DEFAULT 5,
                filter_category TEXT DEFAULT NULL
            )
            RETURNS TABLE (
                id UUID,
                title TEXT,
                content TEXT,
                category TEXT,
                source TEXT,
                similarity FLOAT
            )
            LANGUAGE plpgsql
            STABLE
            AS $function$
            BEGIN
                RETURN QUERY
                SELECT matched.id,
                       matched.title,
                       matched.content,
                       matched.category,
                       matched.source,
                       matched.similarity
                FROM (
                    SELECT d.id,
                           d.title,
                           d.content,
                           d.category,
                           d.source,
                           (1 - (d.embedding <=> query_embedding))::FLOAT AS similarity
                    FROM rag_documents d
                    WHERE d.embedding IS NOT NULL
                      AND (filter_category IS NULL OR d.category = filter_category)
                ) matched
                WHERE matched.similarity > match_threshold
                ORDER BY matched.similarity DESC
                LIMIT match_count;
            END;
            $function$
        $sql$;
    ELSE
        CREATE OR REPLACE FUNCTION rag_array_cosine_similarity(
            a DOUBLE PRECISION[],
            b DOUBLE PRECISION[]
        )
        RETURNS DOUBLE PRECISION
        LANGUAGE sql
        IMMUTABLE
        STRICT
        AS $function$
            WITH pairs AS (
                SELECT av.value AS av, bv.value AS bv
                FROM unnest(a) WITH ORDINALITY AS av(value, ord)
                JOIN unnest(b) WITH ORDINALITY AS bv(value, ord) USING (ord)
            ),
            sums AS (
                SELECT SUM(av * bv) AS dot_product,
                       SQRT(SUM(av * av)) AS a_norm,
                       SQRT(SUM(bv * bv)) AS b_norm
                FROM pairs
            )
            SELECT CASE
                WHEN a_norm IS NULL OR b_norm IS NULL OR a_norm = 0 OR b_norm = 0 THEN 0
                ELSE dot_product / (a_norm * b_norm)
            END
            FROM sums
        $function$;

        CREATE OR REPLACE FUNCTION match_rag_documents(
            query_embedding DOUBLE PRECISION[],
            match_threshold FLOAT DEFAULT 0.5,
            match_count INT DEFAULT 5,
            filter_category TEXT DEFAULT NULL
        )
        RETURNS TABLE (
            id UUID,
            title TEXT,
            content TEXT,
            category TEXT,
            source TEXT,
            similarity FLOAT
        )
        LANGUAGE plpgsql
        STABLE
        AS $function$
        BEGIN
            RETURN QUERY
            SELECT matched.id,
                   matched.title,
                   matched.content,
                   matched.category,
                   matched.source,
                   matched.similarity
            FROM (
                SELECT d.id,
                       d.title,
                       d.content,
                       d.category,
                       d.source,
                       rag_array_cosine_similarity(d.embedding, query_embedding)::FLOAT AS similarity
                FROM rag_documents d
                WHERE d.embedding IS NOT NULL
                  AND array_length(d.embedding, 1) = array_length(query_embedding, 1)
                  AND (filter_category IS NULL OR d.category = filter_category)
            ) matched
            WHERE matched.similarity > match_threshold
            ORDER BY matched.similarity DESC
            LIMIT match_count;
        END;
        $function$;
    END IF;
END $$;
