import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireSpaceAccess } from '../middleware/permissions.js';
import { createPageSchema, updatePageSchema, updatePageContentSchema, reorderPagesSchema } from '../validators/page.js';
import * as pageService from '../services/pageService.js';
import * as spaceService from '../services/spaceService.js';
import { success, error } from '../utils/response.js';
import { emitPageCreated, emitPageUpdated, emitPageDeleted } from '../lib/socket.js';
import { prisma } from '../lib/prisma.js';
import { updateBacklinks } from '../services/backlinkService.js';
import { syncPageChunks } from '../services/chunkingService.js';
import { logAudit } from '../services/auditService.js';
import { cacheInvalidate, CacheKeys } from '../services/cacheService.js';

const router = Router();

// GET /api/spaces/:spaceSlug/pages — page tree
router.get('/spaces/:spaceSlug/pages', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const tree = await pageService.getPageTree(space.id);
    success(res, tree);
  } catch (err) { next(err); }
});

// POST /api/spaces/:spaceSlug/pages — create page
router.post('/spaces/:spaceSlug/pages', requireSpaceAccess('EDITOR'), validate(createPageSchema), async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const page = await pageService.createPage({
      title: req.body.title,
      spaceId: space.id,
      authorId: req.user.id,
      parentId: req.body.parentId,
      content: req.body.content,
    });
    emitPageCreated(space.id, {
      pageId: page.id,
      title: page.title,
      createdBy: { id: req.user.id, name: req.user.name, email: req.user.email },
    });
    syncPageChunks(page.id).catch((err) => console.error('[chunks] sync error on create:', err));
    logAudit(req, { action: 'CREATE', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, spaceId: space.id }).catch(() => {});
    success(res, page, 201);
  } catch (err) { next(err); }
});

// GET /api/spaces/:spaceSlug/pages/:pageSlug/full — unified page (page + breadcrumbs + fav + watch)
router.get('/spaces/:spaceSlug/pages/:pageSlug/full', async (req, res, next) => {
  try {
    const result = await pageService.getPageFull(
      req.params.spaceSlug as string,
      req.params.pageSlug as string,
      req.user.id,
    );
    if (!result) return error(res, 'Pagina non trovata', 404);
    success(res, result);
  } catch (err) { next(err); }
});

// GET /api/spaces/:spaceSlug/pages/:pageSlug — get page by slug
router.get('/spaces/:spaceSlug/pages/:pageSlug', async (req, res, next) => {
  try {
    const page = await pageService.getPageBySlug(req.params.spaceSlug as string, req.params.pageSlug as string);
    if (!page) return error(res, 'Pagina non trovata', 404);
    success(res, page);
  } catch (err) { next(err); }
});

// PUT /api/pages/reorder — MUST be before /pages/:id to avoid matching "reorder" as :id
router.put('/pages/reorder', validate(reorderPagesSchema), async (req, res, next) => {
  try {
    await pageService.reorderPages(req.body.pages);
    success(res, { reordered: true });
  } catch (err) { next(err); }
});

// PUT /api/pages/:id — update page
router.put('/pages/:id', requireSpaceAccess('EDITOR'), validate(updatePageSchema), async (req, res, next) => {
  try {
    const page = await pageService.updatePage(req.params.id as string, req.body);
    if (req.body.title) {
      logAudit(req, { action: 'UPDATE', resourceType: 'PAGE', resourceId: req.params.id as string, changes: { title: { old: null, new: req.body.title } } }).catch(() => {});
    }
    success(res, page);
  } catch (err) { next(err); }
});

// PUT /api/pages/:id/content — auto-save content
router.put('/pages/:id/content', requireSpaceAccess('EDITOR'), validate(updatePageContentSchema), async (req, res, next) => {
  try {
    const result = await pageService.updatePageContent(req.params.id as string, req.body.content, req.user.id);
    updateBacklinks(req.params.id as string, req.body.content).catch(() => {});
    syncPageChunks(req.params.id as string).catch((err) => console.error('[chunks] sync error on save:', err));
    logAudit(req, { action: 'UPDATE', resourceType: 'PAGE', resourceId: req.params.id as string, metadata: { type: 'content' } }).catch(() => {});
    success(res, { id: result.id, updatedAt: result.updatedAt });
  } catch (err) { next(err); }
});

// GET /api/pages/:id/versions — list page versions
router.get('/pages/:id/versions', async (req, res, next) => {
  try {
    const versions = await pageService.getPageVersions(req.params.id as string);
    success(res, versions);
  } catch (err) { next(err); }
});

// GET /api/pages/:id/versions/:versionId — get specific version
router.get('/pages/:id/versions/:versionId', async (req, res, next) => {
  try {
    const version = await pageService.getPageVersion(req.params.versionId as string);
    if (!version) return error(res, 'Versione non trovata', 404);
    success(res, version);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/versions/:versionId/restore — restore version
router.post('/pages/:id/versions/:versionId/restore', async (req, res, next) => {
  try {
    const page = await pageService.restorePageVersion(
      req.params.id as string,
      req.params.versionId as string,
      req.user.id,
    );
    if (!page) return error(res, 'Versione non trovata', 404);
    success(res, page);
  } catch (err) { next(err); }
});

// DELETE /api/pages/:id — soft delete (move to trash)
router.delete('/pages/:id', requireSpaceAccess('EDITOR'), async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id as string);
    // Soft delete - set deletedAt instead of hard delete
    await prisma.page.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    // Invalidate caches so deleted page is no longer served
    if (page?.space) {
      cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
    }
    if (page) {
      emitPageDeleted(page.space?.id || '', {
        pageId: page.id,
        title: page.title,
        deletedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
      });
    }
    logAudit(req, { action: 'DELETE', resourceType: 'PAGE', resourceId: req.params.id as string, resourceTitle: page?.title, spaceId: page?.space?.id }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// GET /api/pages/:id/breadcrumbs
router.get('/pages/:id/breadcrumbs', async (req, res, next) => {
  try {
    const crumbs = await pageService.getBreadcrumbs(req.params.id as string);
    success(res, crumbs);
  } catch (err) { next(err); }
});

export default router;
