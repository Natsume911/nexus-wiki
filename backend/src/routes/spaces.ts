import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireSpaceAccess } from '../middleware/permissions.js';
import { createSpaceSchema, updateSpaceSchema } from '../validators/space.js';
import * as spaceService from '../services/spaceService.js';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/spaces
router.get('/', async (_req, res, next) => {
  try {
    const spaces = await spaceService.getSpaces();
    success(res, spaces);
  } catch (err) { next(err); }
});

// POST /api/spaces (ADMIN only)
router.post('/', validate(createSpaceSchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return error(res, 'Solo gli amministratori possono creare spazi', 403);
    const space = await spaceService.createSpace(req.body, req.user.id);
    logAudit(req, { action: 'CREATE', resourceType: 'SPACE', resourceId: space.id, resourceTitle: space.name }).catch(() => {});
    success(res, space, 201);
  } catch (err) { next(err); }
});

// GET /api/spaces/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.slug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    success(res, space);
  } catch (err) { next(err); }
});

// PUT /api/spaces/:id
router.put('/:id', requireSpaceAccess('ADMIN'), validate(updateSpaceSchema), async (req, res, next) => {
  try {
    const space = await spaceService.updateSpace(req.params.id as string, req.body);
    logAudit(req, { action: 'UPDATE', resourceType: 'SPACE', resourceId: req.params.id as string }).catch(() => {});
    success(res, space);
  } catch (err) { next(err); }
});

// DELETE /api/spaces/:id
router.delete('/:id', requireSpaceAccess('ADMIN'), async (req, res, next) => {
  try {
    await spaceService.deleteSpace(req.params.id as string);
    logAudit(req, { action: 'DELETE', resourceType: 'SPACE', resourceId: req.params.id as string }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// PUT /api/spaces/:id/restricted — toggle restricted mode
router.put('/:id/restricted', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return error(res, 'Solo admin', 403);
    const { isRestricted } = req.body;
    const space = await prisma.space.update({
      where: { id: req.params.id as string },
      data: { isRestricted: !!isRestricted },
    });
    logAudit(req, { action: 'UPDATE', resourceType: 'SPACE', resourceId: space.id, resourceTitle: space.name, metadata: { isRestricted: space.isRestricted } }).catch(() => {});
    success(res, space);
  } catch (err) { next(err); }
});

export default router;
