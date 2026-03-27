import { Router } from 'express';
import * as adminService from '../services/adminService.js';
import { syncUsersFromExternalDirectoryDir } from '../services/userSyncService.js';
import { getUsageStats } from '../services/llmUsageService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';
import { cacheInvalidate } from '../services/cacheService.js';
import { prisma } from '../lib/prisma.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// Middleware: only ADMIN users can access these routes
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'ADMIN') {
    return error(res, 'Accesso riservato agli amministratori', 403);
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', async (_req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    success(res, users);
  } catch (err) { next(err); }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || !['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
      return error(res, 'Ruolo non valido. Valori ammessi: ADMIN, EDITOR, VIEWER', 400);
    }
    const user = await adminService.updateUserRole(req.params.id as string, role);
    logAudit(req, { action: 'ROLE_CHANGE', resourceType: 'USER', resourceId: req.params.id as string, metadata: { newRole: role } }).catch(() => {});
    success(res, user);
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return error(res, 'Non puoi eliminare il tuo stesso account', 400);
    }
    await adminService.deleteUser(req.params.id as string);
    logAudit(req, { action: 'DELETE', resourceType: 'USER', resourceId: req.params.id as string }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// GET /api/admin/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await adminService.getStats();
    success(res, stats);
  } catch (err) { next(err); }
});

// GET /api/admin/spaces
router.get('/spaces', async (_req, res, next) => {
  try {
    const spaces = await adminService.getAllSpaces();
    success(res, spaces);
  } catch (err) { next(err); }
});

// PUT /api/admin/users/:id/active — toggle user active status
router.put('/users/:id/active', async (req, res, next) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return error(res, 'Campo active deve essere boolean', 400);
    }
    // Prevent admin from deactivating themselves
    if (req.params.id === req.user.id && !active) {
      return error(res, 'Non puoi disattivare il tuo stesso account', 400);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { active },
    });
    logAudit(req, {
      action: active ? 'PERMISSION_GRANT' : 'PERMISSION_REVOKE',
      resourceType: 'USER',
      resourceId: req.params.id as string,
      metadata: { active },
    }).catch(() => {});
    success(res, user);
  } catch (err) { next(err); }
});

// POST /api/admin/users/sync — sync users from External Directory
router.post('/users/sync', async (req, res, next) => {
  try {
    const result = await syncUsersFromExternalDirectoryDir();
    if (result.error) {
      return error(res, result.error, 500);
    }
    // Invalidate all user caches so avatars/names refresh immediately
    cacheInvalidate('user:*').catch(() => {});
    logAudit(req, {
      action: 'IMPORT',
      resourceType: 'USER',
      resourceId: 'external-sync',
      metadata: { synced: result.synced, created: result.created, updated: result.updated },
    }).catch(() => {});
    success(res, result);
  } catch (err) { next(err); }
});

// GET /api/admin/llm-usage — LLM cost & usage stats
router.get('/llm-usage', requireAdmin, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await getUsageStats(days);
    success(res, stats);
  } catch (err) { next(err); }
});

export default router;
