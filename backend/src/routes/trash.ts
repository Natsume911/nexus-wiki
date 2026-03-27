import { Router } from 'express';
import * as trashService from '../services/trashService.js';
import * as spaceService from '../services/spaceService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/spaces/:spaceSlug/trash — list trashed pages
router.get('/spaces/:spaceSlug/trash', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const trashed = await trashService.getTrash(space.id);
    success(res, trashed);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/trash — soft delete page
router.post('/pages/:id/trash', async (req, res, next) => {
  try {
    const page = await trashService.softDeletePage(req.params.id as string);
    logAudit(req, { action: 'DELETE', resourceType: 'PAGE', resourceId: req.params.id as string, resourceTitle: page.title }).catch(() => {});
    success(res, page);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/restore — restore from trash
router.post('/pages/:id/restore', async (req, res, next) => {
  try {
    const page = await trashService.restoreFromTrash(req.params.id as string);
    logAudit(req, { action: 'RESTORE', resourceType: 'PAGE', resourceId: req.params.id as string, resourceTitle: page.title }).catch(() => {});
    success(res, page);
  } catch (err) { next(err); }
});

// DELETE /api/pages/:id/permanent — permanently delete (ADMIN only)
router.delete('/pages/:id/permanent', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return error(res, 'Accesso riservato agli amministratori', 403);
    await trashService.permanentlyDelete(req.params.id as string);
    logAudit(req, { action: 'DELETE', resourceType: 'PAGE', resourceId: req.params.id as string, metadata: { permanent: true } }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
