import { get, post, put, del } from './client';
import type { Page, PageTreeNode, Breadcrumb, PageVersion } from '@/types';

export function getPageTree(spaceSlug: string) {
  return get<PageTreeNode[]>(`/spaces/${spaceSlug}/pages`);
}

export function getPage(spaceSlug: string, pageSlug: string) {
  return get<Page>(`/spaces/${spaceSlug}/pages/${pageSlug}`);
}

export interface PageFullResponse {
  page: Page;
  breadcrumbs: Breadcrumb[];
  favorited: boolean;
  watching: boolean;
  space: { id: string; name: string; slug: string };
}

export function getPageFull(spaceSlug: string, pageSlug: string) {
  return get<PageFullResponse>(`/spaces/${spaceSlug}/pages/${pageSlug}/full`);
}

export function createPage(spaceSlug: string, data: { title: string; parentId?: string }) {
  return post<Page>(`/spaces/${spaceSlug}/pages`, data);
}

export function updatePage(id: string, data: { title?: string; content?: unknown }) {
  return put<Page>(`/pages/${id}`, data);
}

export function updatePageContent(id: string, content: unknown) {
  return put<{ id: string; updatedAt: string }>(`/pages/${id}/content`, { content });
}

export function deletePage(id: string) {
  return del<{ deleted: boolean }>(`/pages/${id}`);
}

export function reorderPages(pages: { id: string; parentId: string | null; order: number }[]) {
  return put<{ reordered: boolean }>('/pages/reorder', { pages });
}

export function getBreadcrumbs(id: string) {
  return get<Breadcrumb[]>(`/pages/${id}/breadcrumbs`);
}

export function getPageVersions(pageId: string) {
  return get<PageVersion[]>(`/pages/${pageId}/versions`);
}

export function getPageVersion(pageId: string, versionId: string) {
  return get<PageVersion>(`/pages/${pageId}/versions/${versionId}`);
}

export function restorePageVersion(pageId: string, versionId: string) {
  return post<Page>(`/pages/${pageId}/versions/${versionId}/restore`, {});
}
