import { Router } from 'express';
import * as archiveService from '../services/archiveService.js';
import * as spaceService from '../services/spaceService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/spaces/:spaceSlug/archive — list archived pages
router.get('/spaces/:spaceSlug/archive', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const archived = await archiveService.getArchive(space.id);
    success(res, archived);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/archive — archive page
router.post('/pages/:id/archive', async (req, res, next) => {
  try {
    const page = await archiveService.archivePage(req.params.id as string);
    logAudit(req, { action: 'ARCHIVE', resourceType: 'PAGE', resourceId: req.params.id as string, resourceTitle: page.title }).catch(() => {});
    success(res, page);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/unarchive — restore from archive
router.post('/pages/:id/unarchive', async (req, res, next) => {
  try {
    const page = await archiveService.restoreFromArchive(req.params.id as string);
    logAudit(req, { action: 'ARCHIVE', resourceType: 'PAGE', resourceId: req.params.id as string, resourceTitle: page.title, metadata: { action: 'unarchive' } }).catch(() => {});
    success(res, page);
  } catch (err) { next(err); }
});

export default router;
