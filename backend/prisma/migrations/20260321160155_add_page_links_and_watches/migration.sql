-- CreateTable
CREATE TABLE "page_links" (
    "id" TEXT NOT NULL,
    "source_page_id" TEXT NOT NULL,
    "target_page_id" TEXT NOT NULL,

    CONSTRAINT "page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_watches" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_links_source_page_id_target_page_id_key" ON "page_links"("source_page_id", "target_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_watches_page_id_user_id_key" ON "page_watches"("page_id", "user_id");

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_watches" ADD CONSTRAINT "page_watches_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_watches" ADD CONSTRAINT "page_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
