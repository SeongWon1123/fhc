-- Deterministic MVP seed data.
-- On a real Supabase project, create matching Auth users first or this script
-- will safely skip profile-dependent rows. The local init.sql auth stub is seeded.

DO $$
BEGIN
    IF to_regclass('auth.users') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'auth'
             AND table_name = 'users'
             AND column_name = 'encrypted_password'
       ) THEN
        INSERT INTO auth.users (id, email) VALUES
            ('00000000-0000-0000-0000-000000000001', 'coach.strength@example.com'),
            ('00000000-0000-0000-0000-000000000002', 'coach.pilates@example.com'),
            ('00000000-0000-0000-0000-000000000003', 'coach.running@example.com'),
            ('00000000-0000-0000-0000-000000000101', 'member.jisoo@example.com'),
            ('00000000-0000-0000-0000-000000000102', 'member.daniel@example.com'),
            ('00000000-0000-0000-0000-000000000201', 'owner.gangnam@example.com')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    phone,
    onboarding_completed,
    fitness_goal,
    preferred_sports
)
SELECT *
FROM (
    VALUES
        ('00000000-0000-0000-0000-000000000001'::UUID, 'coach.strength@example.com', 'Minji Kim', 'coach', '+82-10-1000-0001', TRUE, NULL, ARRAY['strength', 'crossfit']),
        ('00000000-0000-0000-0000-000000000002'::UUID, 'coach.pilates@example.com', 'Jae Lee', 'coach', '+82-10-1000-0002', TRUE, NULL, ARRAY['pilates', 'rehab']),
        ('00000000-0000-0000-0000-000000000003'::UUID, 'coach.running@example.com', 'Sung Park', 'coach', '+82-10-1000-0003', TRUE, NULL, ARRAY['running', 'mobility']),
        ('00000000-0000-0000-0000-000000000101'::UUID, 'member.jisoo@example.com', 'Jisoo Han', 'user', '+82-10-2000-0101', TRUE, 'weight_loss', ARRAY['pilates', 'walking']),
        ('00000000-0000-0000-0000-000000000102'::UUID, 'member.daniel@example.com', 'Daniel Choi', 'user', '+82-10-2000-0102', TRUE, 'muscle_gain', ARRAY['strength', 'running']),
        ('00000000-0000-0000-0000-000000000201'::UUID, 'owner.gangnam@example.com', 'Hana Jung', 'gym_owner', '+82-2-555-0201', TRUE, NULL, ARRAY['strength', 'pilates'])
) AS v(id, email, full_name, role, phone, onboarding_completed, fitness_goal, preferred_sports)
WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = v.id)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    onboarding_completed = EXCLUDED.onboarding_completed,
    fitness_goal = EXCLUDED.fitness_goal,
    preferred_sports = EXCLUDED.preferred_sports,
    updated_at = NOW();

INSERT INTO gyms (
    id,
    owner_id,
    name,
    address,
    phone,
    member_count,
    subscription_plan,
    subscription_start,
    subscription_end,
    is_active
)
SELECT *
FROM (
    VALUES (
        '10000000-0000-0000-0000-000000000001'::UUID,
        '00000000-0000-0000-0000-000000000201'::UUID,
        'Gangnam Fit Lab',
        '12 Teheran-ro 20-gil, Gangnam-gu, Seoul',
        '+82-2-555-0201',
        148,
        'pilot',
        NOW() - INTERVAL '20 days',
        NOW() + INTERVAL '70 days',
        TRUE
    )
) AS v(id, owner_id, name, address, phone, member_count, subscription_plan, subscription_start, subscription_end, is_active)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.owner_id)
ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    member_count = EXCLUDED.member_count,
    subscription_plan = EXCLUDED.subscription_plan,
    subscription_start = EXCLUDED.subscription_start,
    subscription_end = EXCLUDED.subscription_end,
    is_active = EXCLUDED.is_active;

INSERT INTO coach_details (
    id,
    name,
    specialty,
    biography,
    experience_years,
    qualifications,
    base_price,
    location,
    is_online_available,
    is_offline_available,
    is_verified,
    rating,
    review_count,
    booking_count,
    gym_id
)
SELECT *
FROM (
    VALUES
        (
            '00000000-0000-0000-0000-000000000001'::UUID,
            'Minji Kim',
            ARRAY['strength', 'crossfit', 'body recomposition'],
            'Strength coach focused on beginner-friendly barbell training and measurable body-composition goals.',
            10,
            ARRAY['NSCA-CPT', 'Korea Sports Instructor Level 2'],
            60000,
            'Gangnam, Seoul',
            TRUE,
            TRUE,
            TRUE,
            4.9,
            127,
            42,
            '10000000-0000-0000-0000-000000000001'::UUID
        ),
        (
            '00000000-0000-0000-0000-000000000002'::UUID,
            'Jae Lee',
            ARRAY['pilates', 'rehab', 'posture'],
            'Pilates and corrective exercise coach for office workers recovering posture and core stability.',
            7,
            ARRAY['PMA-CPT', 'Corrective Exercise Specialist'],
            55000,
            'Seongsu, Seoul',
            TRUE,
            TRUE,
            TRUE,
            4.8,
            89,
            31,
            NULL
        ),
        (
            '00000000-0000-0000-0000-000000000003'::UUID,
            'Sung Park',
            ARRAY['running', 'mobility', 'endurance'],
            'Running coach helping first-time 10K runners and sub-4 marathoners improve pacing and injury prevention.',
            5,
            ARRAY['World Athletics Level 1', 'Sports Massage Certificate'],
            45000,
            'Gwanggyo, Suwon',
            TRUE,
            FALSE,
            TRUE,
            4.7,
            54,
            19,
            NULL
        )
) AS v(id, name, specialty, biography, experience_years, qualifications, base_price, location, is_online_available, is_offline_available, is_verified, rating, review_count, booking_count, gym_id)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.id AND p.role = 'coach')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    specialty = EXCLUDED.specialty,
    biography = EXCLUDED.biography,
    experience_years = EXCLUDED.experience_years,
    qualifications = EXCLUDED.qualifications,
    base_price = EXCLUDED.base_price,
    location = EXCLUDED.location,
    is_online_available = EXCLUDED.is_online_available,
    is_offline_available = EXCLUDED.is_offline_available,
    is_verified = EXCLUDED.is_verified,
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    booking_count = EXCLUDED.booking_count,
    gym_id = EXCLUDED.gym_id;

INSERT INTO bookings (
    id,
    user_id,
    coach_id,
    scheduled_at,
    duration_minutes,
    session_type,
    status,
    price,
    meeting_url,
    location,
    notes,
    coach_notes,
    created_at
)
SELECT *
FROM (
    VALUES
        (
            '20000000-0000-0000-0000-000000000001'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            '00000000-0000-0000-0000-000000000002'::UUID,
            NOW() + INTERVAL '2 days',
            50,
            'online',
            'confirmed',
            55000,
            'https://meet.example.com/fitconnect-pilates-1',
            NULL,
            'First posture assessment and core routine.',
            'Ask about desk setup and lower back pain.',
            NOW() - INTERVAL '3 days'
        ),
        (
            '20000000-0000-0000-0000-000000000002'::UUID,
            '00000000-0000-0000-0000-000000000102'::UUID,
            '00000000-0000-0000-0000-000000000001'::UUID,
            NOW() - INTERVAL '5 days',
            60,
            'offline',
            'completed',
            60000,
            NULL,
            'Gangnam Fit Lab',
            'Learn squat and deadlift basics.',
            'Daniel handled 60 kg squat triples with stable depth.',
            NOW() - INTERVAL '12 days'
        ),
        (
            '20000000-0000-0000-0000-000000000003'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            '00000000-0000-0000-0000-000000000003'::UUID,
            NOW() + INTERVAL '9 days',
            45,
            'online',
            'pending',
            45000,
            'https://meet.example.com/fitconnect-run-1',
            NULL,
            'Prepare for a beginner 5K plan.',
            NULL,
            NOW() - INTERVAL '1 day'
        )
) AS v(id, user_id, coach_id, scheduled_at, duration_minutes, session_type, status, price, meeting_url, location, notes, coach_notes, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.coach_id AND p.role = 'coach')
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    coach_id = EXCLUDED.coach_id,
    scheduled_at = EXCLUDED.scheduled_at,
    duration_minutes = EXCLUDED.duration_minutes,
    session_type = EXCLUDED.session_type,
    status = EXCLUDED.status,
    price = EXCLUDED.price,
    meeting_url = EXCLUDED.meeting_url,
    location = EXCLUDED.location,
    notes = EXCLUDED.notes,
    coach_notes = EXCLUDED.coach_notes,
    created_at = EXCLUDED.created_at,
    updated_at = NOW();

INSERT INTO payments (
    id,
    booking_id,
    user_id,
    amount,
    platform_fee,
    coach_payout,
    status,
    toss_order_id,
    paid_at,
    released_at
)
SELECT *
FROM (
    VALUES (
        '30000000-0000-0000-0000-000000000001'::UUID,
        '20000000-0000-0000-0000-000000000002'::UUID,
        '00000000-0000-0000-0000-000000000102'::UUID,
        60000,
        9000,
        51000,
        'released',
        'seed-order-200000000002',
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '4 days'
    )
) AS v(id, booking_id, user_id, amount, platform_fee, coach_payout, status, toss_order_id, paid_at, released_at)
WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.id = v.booking_id)
ON CONFLICT (id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    user_id = EXCLUDED.user_id,
    amount = EXCLUDED.amount,
    platform_fee = EXCLUDED.platform_fee,
    coach_payout = EXCLUDED.coach_payout,
    status = EXCLUDED.status,
    toss_order_id = EXCLUDED.toss_order_id,
    paid_at = EXCLUDED.paid_at,
    released_at = EXCLUDED.released_at;

INSERT INTO reviews (
    id,
    booking_id,
    user_id,
    coach_id,
    rating,
    content,
    created_at
)
SELECT *
FROM (
    VALUES (
        '40000000-0000-0000-0000-000000000001'::UUID,
        '20000000-0000-0000-0000-000000000002'::UUID,
        '00000000-0000-0000-0000-000000000102'::UUID,
        '00000000-0000-0000-0000-000000000001'::UUID,
        5,
        'Clear cues and a practical program I can repeat between sessions.',
        NOW() - INTERVAL '4 days'
    )
) AS v(id, booking_id, user_id, coach_id, rating, content, created_at)
WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.id = v.booking_id)
ON CONFLICT (id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    user_id = EXCLUDED.user_id,
    coach_id = EXCLUDED.coach_id,
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    created_at = EXCLUDED.created_at;

INSERT INTO diet_logs (
    id,
    user_id,
    food_name,
    calories,
    macronutrients,
    meal_type,
    ai_analysis,
    coach_feedback,
    created_at
)
SELECT *
FROM (
    VALUES
        (
            '50000000-0000-0000-0000-000000000001'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            'Chicken bibimbap bowl',
            620,
            '{"protein": 38, "fat": 18, "carb": 72}'::JSONB,
            'lunch',
            'Balanced meal with strong protein coverage; sodium may be high if sauce is heavy.',
            'Keep the sauce on the side and add vegetables for volume.',
            NOW() - INTERVAL '2 days'
        ),
        (
            '50000000-0000-0000-0000-000000000002'::UUID,
            '00000000-0000-0000-0000-000000000102'::UUID,
            'Greek yogurt, banana, and granola',
            430,
            '{"protein": 28, "fat": 9, "carb": 58}'::JSONB,
            'breakfast',
            'Good pre-workout carbohydrate and protein mix for muscle-gain phase.',
            'Add one boiled egg if morning hunger returns quickly.',
            NOW() - INTERVAL '1 day'
        ),
        (
            '50000000-0000-0000-0000-000000000003'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            'Protein shake',
            210,
            '{"protein": 27, "fat": 3, "carb": 16}'::JSONB,
            'snack',
            'Useful after Pilates session; low fiber so pair with fruit if replacing a snack.',
            NULL,
            NOW() - INTERVAL '8 hours'
        )
) AS v(id, user_id, food_name, calories, macronutrients, meal_type, ai_analysis, coach_feedback, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    food_name = EXCLUDED.food_name,
    calories = EXCLUDED.calories,
    macronutrients = EXCLUDED.macronutrients,
    meal_type = EXCLUDED.meal_type,
    ai_analysis = EXCLUDED.ai_analysis,
    coach_feedback = EXCLUDED.coach_feedback,
    created_at = EXCLUDED.created_at;

INSERT INTO workout_logs (
    id,
    user_id,
    workout_type,
    duration,
    calories_burned,
    data,
    sport_category,
    rep_count,
    form_score,
    created_at
)
SELECT *
FROM (
    VALUES
        (
            '60000000-0000-0000-0000-000000000001'::UUID,
            '00000000-0000-0000-0000-000000000102'::UUID,
            'Barbell squat practice',
            3600,
            410,
            '{"sets": 5, "top_weight_kg": 60, "depth_quality": "stable"}'::JSONB,
            'strength',
            25,
            87.5,
            NOW() - INTERVAL '5 days'
        ),
        (
            '60000000-0000-0000-0000-000000000002'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            'Low-impact Pilates flow',
            2700,
            210,
            '{"core_blocks": 4, "pain_reported": false}'::JSONB,
            'pilates',
            NULL,
            91.0,
            NOW() - INTERVAL '2 days'
        )
) AS v(id, user_id, workout_type, duration, calories_burned, data, sport_category, rep_count, form_score, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    workout_type = EXCLUDED.workout_type,
    duration = EXCLUDED.duration,
    calories_burned = EXCLUDED.calories_burned,
    data = EXCLUDED.data,
    sport_category = EXCLUDED.sport_category,
    rep_count = EXCLUDED.rep_count,
    form_score = EXCLUDED.form_score,
    created_at = EXCLUDED.created_at;

INSERT INTO clothing_recommendations (
    id,
    user_id,
    sport_category,
    items,
    clicked_at,
    purchased_at,
    commission_rate,
    created_at
)
SELECT *
FROM (
    VALUES
        (
            '70000000-0000-0000-0000-000000000001'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            'pilates',
            '[
                {"sku": "PLT-LEGGING-001", "name": "High-rise compression leggings", "price": 49000, "reason": "Stable waistband for mat work"},
                {"sku": "PLT-SOCK-002", "name": "Grip socks", "price": 12000, "reason": "Improves traction in reformer class"}
            ]'::JSONB,
            NOW() - INTERVAL '1 day',
            NULL::TIMESTAMPTZ,
            0.12,
            NOW() - INTERVAL '2 days'
        ),
        (
            '70000000-0000-0000-0000-000000000002'::UUID,
            '00000000-0000-0000-0000-000000000102'::UUID,
            'strength',
            '[
                {"sku": "STR-SHOE-010", "name": "Flat lifting shoes", "price": 89000, "reason": "Stable base for squats and deadlifts"},
                {"sku": "STR-BELT-004", "name": "Beginner lifting belt", "price": 39000, "reason": "Optional bracing support after technique is consistent"}
            ]'::JSONB,
            NULL,
            NULL::TIMESTAMPTZ,
            0.10,
            NOW() - INTERVAL '5 days'
        )
) AS v(id, user_id, sport_category, items, clicked_at, purchased_at, commission_rate, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    sport_category = EXCLUDED.sport_category,
    items = EXCLUDED.items,
    clicked_at = EXCLUDED.clicked_at,
    purchased_at = EXCLUDED.purchased_at,
    commission_rate = EXCLUDED.commission_rate,
    created_at = EXCLUDED.created_at;

INSERT INTO chat_messages (
    id,
    user_id,
    session_id,
    role,
    content,
    context_type,
    created_at
)
SELECT *
FROM (
    VALUES
        (
            '80000000-0000-0000-0000-000000000001'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            '90000000-0000-0000-0000-000000000001'::UUID,
            'user',
            'What should I eat before an evening Pilates class?',
            'diet',
            NOW() - INTERVAL '6 hours'
        ),
        (
            '80000000-0000-0000-0000-000000000002'::UUID,
            '00000000-0000-0000-0000-000000000101'::UUID,
            '90000000-0000-0000-0000-000000000001'::UUID,
            'assistant',
            'Choose a light carb plus protein snack 60-90 minutes before class, such as yogurt with fruit.',
            'diet',
            NOW() - INTERVAL '6 hours' + INTERVAL '1 minute'
        )
) AS v(id, user_id, session_id, role, content, context_type, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    body,
    data,
    is_read,
    created_at
)
SELECT *
FROM (
    VALUES (
        'a0000000-0000-0000-0000-000000000001'::UUID,
        '00000000-0000-0000-0000-000000000101'::UUID,
        'booking_confirmed',
        'Session confirmed',
        'Your online Pilates session with Jae Lee is confirmed.',
        '{"booking_id": "20000000-0000-0000-0000-000000000001"}'::JSONB,
        FALSE,
        NOW() - INTERVAL '2 days'
    )
) AS v(id, user_id, type, title, body, data, is_read, created_at)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.user_id)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    data = EXCLUDED.data,
    is_read = EXCLUDED.is_read,
    created_at = EXCLUDED.created_at;
