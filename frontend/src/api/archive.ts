import { get, post } from './client';

export const getArchive = (spaceSlug: string) => get(`/spaces/${spaceSlug}/archive`);
export const archivePage = (pageId: string) => post(`/pages/${pageId}/archive`, {});
export const restoreFromArchive = (pageId: string) => post(`/pages/${pageId}/unarchive`, {});
