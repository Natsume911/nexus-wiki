import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as auditService from '../services/auditService.js';
import { success, error } from '../utils/response.js';
import type { AuditAction, AuditResourceType } from '@prisma/client';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/audit — query audit logs with filters
router.get('/', async (req, res, next) => {
  try {
    const result = await auditService.queryAuditLogs({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      userId: req.query.userId as string | undefined,
      action: req.query.action as AuditAction | undefined,
      resourceType: req.query.resourceType as AuditResourceType | undefined,
      spaceId: req.query.spaceId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      search: req.query.search as string | undefined,
    });
    success(res, result);
  } catch (err) { next(err); }
});

// GET /api/admin/audit/export — download CSV
router.get('/export', async (req, res, next) => {
  try {
    const csv = await auditService.exportAuditLogsCSV({
      userId: req.query.userId as string | undefined,
      action: req.query.action as AuditAction | undefined,
      resourceType: req.query.resourceType as AuditResourceType | undefined,
      spaceId: req.query.spaceId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${timestamp}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
