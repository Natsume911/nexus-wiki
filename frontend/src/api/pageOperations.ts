import { post } from './client';

export const duplicatePage = (pageId: string) => post(`/pages/${pageId}/duplicate`, {});
export const movePage = (pageId: string, spaceId: string, parentId?: string) => post(`/pages/${pageId}/move`, { spaceId, parentId });
export const copyPageToSpace = (pageId: string, spaceId: string) => post(`/pages/${pageId}/copy`, { spaceId });
