import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { syncPageChunks } from '../services/chunkingService.js';
import { reindexAllAttachments } from '../services/attachmentSearchService.js';
import * as analyticsService from '../services/searchAnalyticsService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// POST /api/admin/search/reindex — reindex all pages
router.post('/reindex', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return error(res, 'Solo admin possono reindexare', 403);
    }

    const pages = await prisma.page.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    let completed = 0;
    const total = pages.length;

    (async () => {
      for (const page of pages) {
        try {
          await syncPageChunks(page.id);
          completed++;
          if (completed % 10 === 0) {
            console.log(`[reindex] ${completed}/${total} pagine indicizzate`);
          }
        } catch (err) {
          console.error(`[reindex] errore pagina ${page.id}:`, err);
        }
      }
      console.log(`[reindex] completato: ${completed}/${total} pagine`);
    })();

    logAudit(req, { action: 'REINDEX', resourceType: 'SYSTEM', metadata: { total } }).catch(() => {});
    success(res, { message: `Reindex avviato per ${total} pagine`, total });
  } catch (err) { next(err); }
});

// POST /api/admin/search/reindex/:pageId — reindex single page
router.post('/reindex/:pageId', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return error(res, 'Solo admin possono reindexare', 403);
    }

    const pageId = req.params.pageId as string;
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) return error(res, 'Pagina non trovata', 404);

    await syncPageChunks(pageId);
    logAudit(req, { action: 'REINDEX', resourceType: 'PAGE', resourceId: pageId }).catch(() => {});
    success(res, { message: 'Pagina reindicizzata', pageId });
  } catch (err) { next(err); }
});

// POST /api/admin/search/reindex-attachments — reindex all attachments
router.post('/reindex-attachments', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return error(res, 'Solo admin possono reindexare', 403);
    }

    (async () => {
      const result = await reindexAllAttachments();
      console.log(`[reindex-attachments] completato: ${result.indexed}/${result.processed} allegati indicizzati`);
    })();

    logAudit(req, { action: 'REINDEX', resourceType: 'SYSTEM', metadata: { type: 'attachments' } }).catch(() => {});
    success(res, { message: 'Reindex allegati avviato' });
  } catch (err) { next(err); }
});

// GET /api/admin/search/stats — chunk statistics
router.get('/stats', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return error(res, 'Solo admin', 403);

    const [totalChunks, totalPages, pagesWithChunks, chunksWithEmbeddings, attChunks, attIndexed] = await Promise.all([
      prisma.pageChunk.count(),
      prisma.page.count({ where: { deletedAt: null } }),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        'SELECT COUNT(DISTINCT page_id)::bigint as count FROM page_chunks',
      ),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        'SELECT COUNT(*)::bigint as count FROM page_chunks WHERE embedding IS NOT NULL',
      ),
      prisma.attachmentChunk.count(),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        'SELECT COUNT(DISTINCT attachment_id)::bigint as count FROM attachment_chunks',
      ),
    ]);

    success(res, {
      totalChunks,
      totalPages,
      indexedPages: Number(pagesWithChunks[0]?.count ?? 0),
      chunksWithEmbeddings: Number(chunksWithEmbeddings[0]?.count ?? 0),
      attachmentChunks: attChunks,
      indexedAttachments: Number(attIndexed[0]?.count ?? 0),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/search/analytics — search analytics dashboard
router.get('/analytics', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return error(res, 'Solo admin', 403);
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await analyticsService.getAnalytics(days);
    success(res, analytics);
  } catch (err) { next(err); }
});

export default router;
