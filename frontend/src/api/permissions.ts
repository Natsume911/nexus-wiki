import { get, put, del } from './client';
import type { Role } from '@/types';

export interface SpacePermission {
  id: string;
  spaceId: string;
  userId: string;
  role: Role;
  user: { id: string; name: string | null; email: string; avatar: string | null };
}

export interface UserSummary {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

export function getSpacePermissions(spaceId: string) {
  return get<SpacePermission[]>(`/spaces/${spaceId}/permissions`);
}

export function setPermission(spaceId: string, userId: string, role: Role) {
  return put<SpacePermission>(`/spaces/${spaceId}/permissions`, { userId, role });
}

export function removePermission(spaceId: string, userId: string) {
  return del<{ deleted: boolean }>(`/spaces/${spaceId}/permissions/${userId}`);
}

export function getAllUsers() {
  return get<UserSummary[]>('/users/all');
}
