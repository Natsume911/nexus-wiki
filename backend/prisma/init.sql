-- ═══════════════════════════════════════════════════════════
-- Nexus Wiki — Post-migration initialization SQL
-- Run AFTER prisma migrate deploy
-- ═══════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Text extraction function (recursive TipTap JSON → text) ──
CREATE OR REPLACE FUNCTION extract_text_from_json(doc jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result text := '';
  node jsonb;
  child jsonb;
BEGIN
  IF doc IS NULL THEN RETURN ''; END IF;
  IF doc ? 'text' THEN
    result := result || ' ' || (doc->>'text');
  END IF;
  IF doc ? 'content' THEN
    FOR child IN SELECT jsonb_array_elements(doc->'content') LOOP
      result := result || ' ' || extract_text_from_json(child);
    END LOOP;
  END IF;
  RETURN trim(result);
END;
$$;

-- ── Pages search vector trigger ──
CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.title, '') || ' ' || coalesce(extract_text_from_json(NEW.content::jsonb), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pages_search_vector_trigger ON pages;
CREATE TRIGGER pages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content ON pages
  FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update();

-- ── Page chunks search vector trigger ──
CREATE OR REPLACE FUNCTION page_chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian', coalesce(NEW.heading, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS page_chunks_search_vector_trigger ON page_chunks;
CREATE TRIGGER page_chunks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF heading, content ON page_chunks
  FOR EACH ROW EXECUTE FUNCTION page_chunks_search_vector_update();

-- ── Attachment chunks search vector trigger ──
CREATE OR REPLACE FUNCTION attachment_chunks_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attachment_chunks_tsv_update ON attachment_chunks;
CREATE TRIGGER attachment_chunks_tsv_update
  BEFORE INSERT OR UPDATE ON attachment_chunks
  FOR EACH ROW EXECUTE FUNCTION attachment_chunks_search_trigger();

-- ── Hybrid search function (RRF fusion) ──
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector,
  query_text text,
  match_limit integer DEFAULT 20,
  rrf_k integer DEFAULT 60,
  filter_space_id text DEFAULT NULL
)
RETURNS TABLE(
  chunk_id text, page_id text, heading text, content text,
  chunk_index integer, rrf_score double precision,
  ft_rank double precision, vec_distance double precision
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH ft AS (
    SELECT pc.id AS cid, pc.page_id AS pid, pc.heading AS h, pc.content AS c, pc.chunk_index AS ci,
      ts_rank(pc.search_vector, to_tsquery('italian', query_text))::double precision AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(pc.search_vector, to_tsquery('italian', query_text)) DESC) AS rn
    FROM page_chunks pc JOIN pages p ON p.id = pc.page_id
    WHERE pc.search_vector @@ to_tsquery('italian', query_text)
      AND p.deleted_at IS NULL AND p.archived_at IS NULL
      AND (filter_space_id IS NULL OR p.space_id = filter_space_id)
    LIMIT match_limit * 2
  ),
  vec AS (
    SELECT pc.id AS cid, pc.page_id AS pid, pc.heading AS h, pc.content AS c, pc.chunk_index AS ci,
      (pc.embedding <=> query_embedding)::double precision AS distance,
      ROW_NUMBER() OVER (ORDER BY pc.embedding <=> query_embedding) AS rn
    FROM page_chunks pc JOIN pages p ON p.id = pc.page_id
    WHERE pc.embedding IS NOT NULL AND p.deleted_at IS NULL AND p.archived_at IS NULL
      AND (filter_space_id IS NULL OR p.space_id = filter_space_id)
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(ft.cid, vec.cid) AS chunk_id,
      COALESCE(ft.pid, vec.pid) AS page_id,
      COALESCE(ft.h, vec.h) AS heading,
      COALESCE(ft.c, vec.c) AS content,
      COALESCE(ft.ci, vec.ci) AS chunk_index,
      (COALESCE(1.0 / (rrf_k + ft.rn), 0.0) + COALESCE(1.0 / (rrf_k + vec.rn), 0.0))::double precision AS rrf_score,
      COALESCE(ft.rank, 0.0)::double precision AS ft_rank,
      COALESCE(vec.distance, 1.0)::double precision AS vec_distance
    FROM ft FULL OUTER JOIN vec ON ft.cid = vec.cid
  )
  SELECT combined.chunk_id, combined.page_id, combined.heading, combined.content,
         combined.chunk_index, combined.rrf_score, combined.ft_rank, combined.vec_distance
  FROM combined ORDER BY combined.rrf_score DESC LIMIT match_limit;
END;
$$;

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_pages_search_vector ON pages USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_pages_deleted_at ON pages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_pages_archived_at ON pages(archived_at);
CREATE INDEX IF NOT EXISTS idx_page_chunks_embedding ON page_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);
CREATE INDEX IF NOT EXISTS idx_page_chunks_search_vector ON page_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_att_chunks_embedding ON attachment_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);
CREATE INDEX IF NOT EXISTS idx_att_chunks_search_vector ON attachment_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
