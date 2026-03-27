import { get, post, put, del } from './client';
import type { Space } from '@/types';

export function getSpaces() {
  return get<Space[]>('/spaces');
}

export function getSpace(slug: string) {
  return get<Space>(`/spaces/${slug}`);
}

export function createSpace(data: { name: string; description?: string; icon?: string }) {
  return post<Space>('/spaces', data);
}

export function updateSpace(id: string, data: { name?: string; description?: string; icon?: string }) {
  return put<Space>(`/spaces/${id}`, data);
}

export function deleteSpace(id: string) {
  return del<{ deleted: boolean }>(`/spaces/${id}`);
}
