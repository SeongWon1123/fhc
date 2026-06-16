-- RAG similarity RPC.
-- Creates the pgvector implementation when rag_documents.embedding is vector(768).
-- Falls back to double precision[] so local postgres can still initialize.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
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
