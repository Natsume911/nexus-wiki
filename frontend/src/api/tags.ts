import { get, post, del } from './client';

export const getTags = () => get('/tags');
export const getPageTags = (pageId: string) => get(`/pages/${pageId}/tags`);
export const addTagToPage = (pageId: string, name: string, color?: string) => post(`/pages/${pageId}/tags`, { name, color });
export const removeTagFromPage = (pageId: string, tagId: string) => del(`/pages/${pageId}/tags/${tagId}`);
export const getPagesByTag = (tagId: string) => get(`/tags/${tagId}/pages`);
