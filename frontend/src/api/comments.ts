import { get, post, put, del } from './client';
import type { Comment } from '@/types';

export function getComments(pageId: string) {
  return get<Comment[]>(`/pages/${pageId}/comments`);
}

export function createComment(pageId: string, content: string, parentId?: string) {
  return post<Comment>(`/pages/${pageId}/comments`, { content, parentId });
}

export function updateComment(id: string, content: string) {
  return put<Comment>(`/comments/${id}`, { content });
}

export function deleteComment(id: string) {
  return del<{ deleted: boolean }>(`/comments/${id}`);
}
