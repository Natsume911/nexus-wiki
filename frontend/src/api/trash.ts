import { get, post, del } from './client';

export const getTrash = (spaceSlug: string) => get(`/spaces/${spaceSlug}/trash`);
export const trashPage = (pageId: string) => post(`/pages/${pageId}/trash`, {});
export const restoreFromTrash = (pageId: string) => post(`/pages/${pageId}/restore`, {});
export const permanentlyDeletePage = (pageId: string) => del(`/pages/${pageId}/permanent`);
