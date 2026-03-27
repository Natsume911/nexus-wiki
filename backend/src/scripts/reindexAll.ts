/**
 * Reindex all pages for semantic search.
 * Usage: docker exec nexus-backend npx tsx src/scripts/reindexAll.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../lib/prisma.js';
import { syncPageChunks } from '../services/chunkingService.js';

async function main() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  console.log(`[reindex] Avvio reindexing semantico...`);
  console.log(`[reindex] OpenAI API key: ${hasOpenAI ? 'configurata' : 'NON configurata (solo chunking, no embeddings)'}`);

  const pages = await prisma.page.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`[reindex] ${pages.length} pagine da indicizzare\n`);

  let completed = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      await syncPageChunks(page.id);
      completed++;
      const pct = Math.round((completed / pages.length) * 100);
      process.stdout.write(`\r  [${completed}/${pages.length}] ${pct}% — ${page.title.slice(0, 50)}`);
    } catch (err) {
      errors++;
      console.error(`\n  ERRORE pagina "${page.title}" (${page.id}):`, err);
    }
  }

  console.log(`\n\n[reindex] Completato!`);
  console.log(`  Indicizzate: ${completed}`);
  console.log(`  Errori: ${errors}`);

  // Stats
  const [totalChunks, withEmbeddings] = await Promise.all([
    prisma.pageChunk.count(),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      'SELECT COUNT(*)::bigint as count FROM page_chunks WHERE embedding IS NOT NULL',
    ),
  ]);

  console.log(`  Chunk totali: ${totalChunks}`);
  console.log(`  Con embedding: ${Number(withEmbeddings[0]?.count ?? 0)}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[reindex] Errore fatale:', err);
  process.exit(1);
});
