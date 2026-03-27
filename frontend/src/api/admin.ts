import { get, put, post, del, upload } from './client';

export const getAdminUsers = () => get('/admin/users');
export const updateUserRole = (userId: string, role: string) => put(`/admin/users/${userId}/role`, { role });
export const updateUserActive = (userId: string, active: boolean) => put(`/admin/users/${userId}/active`, { active });
export const deleteUser = (userId: string) => del(`/admin/users/${userId}`);
export const syncUsersFromExternal = () => post('/admin/users/sync', {});
export const getAdminStats = () => get('/admin/stats');
export const getAdminSpaces = () => get('/admin/spaces');
export const downloadDbBackup = () => window.open('/wiki/api/admin/backup/db', '_blank');
export const downloadJsonBackup = () => window.open('/wiki/api/admin/backup/json', '_blank');
export const restoreDbBackup = (file: File) => upload('/admin/backup/restore/db', file);
export const restoreJsonBackup = (file: File) => upload('/admin/backup/restore/json', file);

export interface LlmUsageStats {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  byService: { service: string; calls: number; tokens: number; cost: number }[];
  byModel: { model: string; calls: number; tokens: number; cost: number }[];
  byDay: { date: string; calls: number; tokens: number; cost: number }[];
  topUsers: { userId: string; calls: number; cost: number }[];
}

export const getLlmUsage = (days = 30) => get<LlmUsageStats>(`/admin/llm-usage?days=${days}`);
