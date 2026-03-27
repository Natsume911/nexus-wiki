import { Router } from 'express';
import * as permissionService from '../services/permissionService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/spaces/:spaceId/permissions
router.get('/spaces/:spaceId/permissions', async (req, res, next) => {
  try {
    const perms = await permissionService.getSpacePermissions(req.params.spaceId as string);
    success(res, perms);
  } catch (err) { next(err); }
});

// PUT /api/spaces/:spaceId/permissions — set/update permission (ADMIN only)
router.put('/spaces/:spaceId/permissions', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      const userPerm = await permissionService.getSpacePermissions(req.params.spaceId as string);
      const own = userPerm.find((p: { userId: string }) => p.userId === req.user.id);
      if (!own || own.role !== 'ADMIN') return error(res, 'Accesso riservato agli amministratori dello spazio', 403);
    }
    const { userId, role } = req.body;
    if (!userId || !role) return error(res, 'userId e role sono obbligatori', 400);
    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) return error(res, 'Ruolo non valido', 400);
    const perm = await permissionService.setPermission(req.params.spaceId as string, userId, role);
    logAudit(req, { action: 'PERMISSION_CHANGE', resourceType: 'PERMISSION', spaceId: req.params.spaceId as string, metadata: { userId, role } }).catch(() => {});
    success(res, perm);
  } catch (err) { next(err); }
});

// DELETE /api/spaces/:spaceId/permissions/:userId (ADMIN only)
router.delete('/spaces/:spaceId/permissions/:userId', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      const userPerm = await permissionService.getSpacePermissions(req.params.spaceId as string);
      const own = userPerm.find((p: { userId: string }) => p.userId === req.user.id);
      if (!own || own.role !== 'ADMIN') return error(res, 'Accesso riservato agli amministratori dello spazio', 403);
    }
    await permissionService.removePermission(req.params.spaceId as string, req.params.userId as string);
    logAudit(req, { action: 'PERMISSION_REVOKE', resourceType: 'PERMISSION', spaceId: req.params.spaceId as string, metadata: { userId: req.params.userId } }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// GET /api/users/all — all users (for permission assignment, ADMIN/EDITOR only)
router.get('/users/all', async (req, res, next) => {
  try {
    if (req.user.role === 'VIEWER') return res.status(403).json({ error: 'Permessi insufficienti' });
    const users = await permissionService.getAllUsers();
    success(res, users);
  } catch (err) { next(err); }
});

export default router;
