-- Enable pgvector and unaccent extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateTable: page_chunks for semantic search
CREATE TABLE "page_chunks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "embedding" vector(1536),
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_chunks_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one chunk per index per page
CREATE UNIQUE INDEX "page_chunks_page_id_chunk_index_key" ON "page_chunks"("page_id", "chunk_index");

-- HNSW index for vector similarity search (cosine distance)
CREATE INDEX "page_chunks_embedding_idx" ON "page_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- GIN index for full-text search on chunks
CREATE INDEX "page_chunks_search_vector_idx" ON "page_chunks" USING gin ("search_vector");

-- Index for page lookup
CREATE INDEX "page_chunks_page_id_idx" ON "page_chunks"("page_id");

-- Foreign key
ALTER TABLE "page_chunks" ADD CONSTRAINT "page_chunks_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger: auto-update search_vector on chunk insert/update
CREATE OR REPLACE FUNCTION page_chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('italian', unaccent(coalesce(NEW.heading, ''))), 'A') ||
    setweight(to_tsvector('italian', unaccent(coalesce(NEW.content, ''))), 'B');
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER page_chunks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF heading, content ON page_chunks
  FOR EACH ROW
  EXECUTE FUNCTION page_chunks_search_vector_update();

-- Function: hybrid_search combining full-text + vector via RRF
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text text,
  match_limit int DEFAULT 20,
  rrf_k int DEFAULT 60,
  filter_space_id text DEFAULT NULL
) RETURNS TABLE (
  chunk_id text,
  page_id text,
  heading text,
  content text,
  chunk_index int,
  rrf_score float,
  ft_rank float,
  vec_distance float
) AS $$
BEGIN
  RETURN QUERY
  WITH ft AS (
    SELECT
      pc.id AS chunk_id,
      pc.page_id,
      pc.heading,
      pc.content,
      pc.chunk_index,
      ts_rank(pc.search_vector, to_tsquery('italian', query_text)) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(pc.search_vector, to_tsquery('italian', query_text)) DESC) AS rn
    FROM page_chunks pc
    JOIN pages p ON p.id = pc.page_id
    WHERE pc.search_vector @@ to_tsquery('italian', query_text)
      AND p.deleted_at IS NULL
      AND (filter_space_id IS NULL OR p.space_id = filter_space_id)
    LIMIT match_limit * 2
  ),
  vec AS (
    SELECT
      pc.id AS chunk_id,
      pc.page_id,
      pc.heading,
      pc.content,
      pc.chunk_index,
      (pc.embedding <=> query_embedding) AS distance,
      ROW_NUMBER() OVER (ORDER BY pc.embedding <=> query_embedding) AS rn
    FROM page_chunks pc
    JOIN pages p ON p.id = pc.page_id
    WHERE pc.embedding IS NOT NULL
      AND p.deleted_at IS NULL
      AND (filter_space_id IS NULL OR p.space_id = filter_space_id)
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(ft.chunk_id, vec.chunk_id) AS chunk_id,
      COALESCE(ft.page_id, vec.page_id) AS page_id,
      COALESCE(ft.heading, vec.heading) AS heading,
      COALESCE(ft.content, vec.content) AS content,
      COALESCE(ft.chunk_index, vec.chunk_index) AS chunk_index,
      COALESCE(1.0 / (rrf_k + ft.rn), 0.0) + COALESCE(1.0 / (rrf_k + vec.rn), 0.0) AS rrf_score,
      COALESCE(ft.rank, 0.0) AS ft_rank,
      COALESCE(vec.distance, 1.0) AS vec_distance
    FROM ft
    FULL OUTER JOIN vec ON ft.chunk_id = vec.chunk_id
  )
  SELECT
    combined.chunk_id,
    combined.page_id,
    combined.heading,
    combined.content,
    combined.chunk_index,
    combined.rrf_score,
    combined.ft_rank,
    combined.vec_distance
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
