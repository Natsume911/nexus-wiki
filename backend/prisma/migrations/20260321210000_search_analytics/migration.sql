-- Search analytics: track queries, clicks, and no-result queries
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'fulltext',
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "timing_ms" INTEGER NOT NULL DEFAULT 0,
    "expanded_query" TEXT,
    "user_id" TEXT,
    "space_id" TEXT,
    "clicked_page_id" TEXT,
    "clicked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- Indexes for analytics queries
CREATE INDEX "search_queries_query_idx" ON "search_queries"("query");
CREATE INDEX "search_queries_created_at_idx" ON "search_queries"("created_at");
CREATE INDEX "search_queries_user_id_idx" ON "search_queries"("user_id");
CREATE INDEX "search_queries_no_results_idx" ON "search_queries"("results_count") WHERE "results_count" = 0;

-- FK (nullable — user might be deleted)
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
