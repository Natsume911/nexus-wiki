import { get } from './client';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceTitle: string | null;
  spaceId: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  spaceId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function getAuditLogs(params: AuditQueryParams = {}): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return get<AuditLogResponse>(`/admin/audit${qs ? `?${qs}` : ''}`);
}

export function exportAuditCSV(params: Omit<AuditQueryParams, 'page' | 'limit'> = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  window.open(`/wiki/api/admin/audit/export${qs ? `?${qs}` : ''}`, '_blank');
}
