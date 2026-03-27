import { get, post, put, del } from './client';

export const getInlineComments = (pageId: string) => get(`/pages/${pageId}/inline-comments`);
export const createInlineComment = (pageId: string, data: { content: string; quote: string; fromPos: number; toPos: number }) => post(`/pages/${pageId}/inline-comments`, data);
export const resolveInlineComment = (id: string) => put(`/inline-comments/${id}/resolve`, {});
export const deleteInlineComment = (id: string) => del(`/inline-comments/${id}`);
