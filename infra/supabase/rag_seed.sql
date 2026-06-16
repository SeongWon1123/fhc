-- RAG knowledge-base seed.
-- Embeddings are intentionally left NULL and can be populated by infra/scripts/embed_rag.py.

INSERT INTO rag_documents (title, content, category, source) VALUES
(
    'Protein targets for strength training',
    'For healthy adults doing regular resistance training, a practical daily protein target is 1.6-2.2 g per kg of body weight. Split intake across 3-5 meals and include a protein-rich meal within a few hours after training.',
    'nutrition',
    'ACSM sports nutrition guidance'
),
(
    'Calorie deficit for sustainable fat loss',
    'A moderate deficit of about 300-500 kcal per day is usually easier to sustain than aggressive restriction. Preserve lean mass by keeping protein high, training regularly, and monitoring weekly trends rather than single-day scale changes.',
    'nutrition',
    'Korean dietitian MVP guidance'
),
(
    'Muscle-gain meal structure',
    'A lean bulk usually pairs progressive overload with a small calorie surplus, adequate carbohydrates around training, and protein near 2 g per kg of body weight. Rapid weight gain is a signal to reduce the surplus.',
    'nutrition',
    'ACSM position stand'
),
(
    'Beginner strength session structure',
    'A simple beginner strength session can use a warm-up, 2-3 compound lifts, 1-2 accessory movements, and a short cooldown. Technique quality should decide load increases before total weight lifted.',
    'exercise',
    'FitConnect coach playbook'
),
(
    'Running progression and injury prevention',
    'New runners should increase weekly volume gradually, keep most runs easy, and add mobility or strength work for calves, hips, and trunk. Pain that changes gait should stop the session and be assessed.',
    'exercise',
    'World Athletics coaching principles'
),
(
    'Creatine basics',
    'Creatine monohydrate is commonly used at 3-5 g per day. It works best when taken consistently, and timing is less important than adherence. People with kidney disease should consult a clinician first.',
    'supplement',
    'ISSN creatine review'
),
(
    'Pilates clothing checklist',
    'Pilates clothing should allow hip and shoulder movement without excess fabric. Grip socks help on reformer equipment, and leggings with a stable waistband reduce distraction during mat transitions.',
    'clothing',
    'FitConnect apparel rules'
),
(
    'Strength-training footwear checklist',
    'For squats and deadlifts, stable flat shoes or lifting shoes are safer than soft running shoes. Choose footwear based on the lift pattern, ankle mobility, and whether the athlete needs heel elevation.',
    'clothing',
    'FitConnect apparel rules'
)
ON CONFLICT (title, category, source) DO UPDATE SET
    content = EXCLUDED.content;
