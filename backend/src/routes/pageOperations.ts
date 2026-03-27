import { Router } from 'express';
import * as pageOperationService from '../services/pageOperationService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// POST /api/pages/:id/duplicate
router.post('/pages/:id/duplicate', async (req, res, next) => {
  try {
    const page = await pageOperationService.duplicatePage(req.params.id as string, req.user.id);
    logAudit(req, { action: 'CREATE', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, metadata: { type: 'duplicate', sourceId: req.params.id } }).catch(() => {});
    success(res, page, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'Pagina non trovata') {
      return error(res, 'Pagina non trovata', 404);
    }
    next(err);
  }
});

// POST /api/pages/:id/move
router.post('/pages/:id/move', async (req, res, next) => {
  try {
    const { spaceId, parentId } = req.body;
    if (!spaceId) {
      return error(res, 'Lo spaceId di destinazione è obbligatorio', 400);
    }
    const page = await pageOperationService.movePage(req.params.id as string, spaceId, parentId);
    logAudit(req, { action: 'MOVE', resourceType: 'PAGE', resourceId: req.params.id as string, spaceId, metadata: { parentId } }).catch(() => {});
    success(res, page);
  } catch (err) {
    if (err instanceof Error && err.message === 'Pagina non trovata') {
      return error(res, 'Pagina non trovata', 404);
    }
    next(err);
  }
});

// POST /api/pages/:id/copy
router.post('/pages/:id/copy', async (req, res, next) => {
  try {
    const { spaceId } = req.body;
    if (!spaceId) {
      return error(res, 'Lo spaceId di destinazione è obbligatorio', 400);
    }
    const page = await pageOperationService.copyPageToSpace(req.params.id as string, spaceId, req.user.id);
    logAudit(req, { action: 'CREATE', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, spaceId, metadata: { type: 'copy', sourceId: req.params.id } }).catch(() => {});
    success(res, page, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'Pagina non trovata') {
      return error(res, 'Pagina non trovata', 404);
    }
    next(err);
  }
});

export default router;
