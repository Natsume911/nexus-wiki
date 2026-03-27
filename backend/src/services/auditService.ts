import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuditAction, AuditResourceType } from '@prisma/client';

// ── Log Audit ──────────────────────────────────────────────────────

interface AuditParams {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  resourceTitle?: string | null;
  spaceId?: string | null;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(req: Request, params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        userEmail: req.user?.email ?? 'system',
        ipAddress: req.auditContext?.ipAddress ?? null,
        userAgent: req.auditContext?.userAgent ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        resourceTitle: params.resourceTitle ?? null,
        spaceId: params.spaceId ?? null,
        changes: params.changes ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (err) {
    // NEVER crash the request — audit is fire-and-forget
    console.error('[audit] log error:', err);
  }
}

// ── Compute Changes ────────────────────────────────────────────────

export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[],
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

// ── Query Audit Logs ───────────────────────────────────────────────

interface AuditQueryParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  spaceId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function queryAuditLogs(params: AuditQueryParams) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.resourceType) where.resourceType = params.resourceType;
  if (params.spaceId) where.spaceId = params.spaceId;

  if (params.dateFrom || params.dateTo) {
    where.timestamp = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }

  if (params.search) {
    where.OR = [
      { userEmail: { contains: params.search, mode: 'insensitive' } },
      { resourceTitle: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Export CSV ──────────────────────────────────────────────────────

export async function exportAuditLogsCSV(params: Omit<AuditQueryParams, 'page' | 'limit'>): Promise<string> {
  const where: Record<string, unknown> = {};

  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.resourceType) where.resourceType = params.resourceType;
  if (params.spaceId) where.spaceId = params.spaceId;

  if (params.dateFrom || params.dateTo) {
    where.timestamp = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where: where as any,
    orderBy: { timestamp: 'desc' },
    take: 10000,
  });

  const header = 'Timestamp,Utente,Azione,Tipo Risorsa,ID Risorsa,Titolo Risorsa,Spazio,IP,Modifiche';
  const rows = logs.map((l) => {
    const changeSummary = l.changes ? JSON.stringify(l.changes).replace(/"/g, '""') : '';
    return [
      l.timestamp.toISOString(),
      l.userEmail,
      l.action,
      l.resourceType,
      l.resourceId ?? '',
      (l.resourceTitle ?? '').replace(/"/g, '""'),
      l.spaceId ?? '',
      l.ipAddress ?? '',
      `"${changeSummary}"`,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

// ── Prune Old Logs ─────────────────────────────────────────────────

export async function pruneOldAuditLogs(retainDays = 365): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retainDays);

  const result = await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`[audit] pruned ${result.count} logs older than ${retainDays} days`);
  }
  return result.count;
}
