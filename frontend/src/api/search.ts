import { get, post } from './client';
import type { SearchResponse } from '@/types';

export interface SearchFilters {
  spaceId?: string;
  authorId?: string;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
  mode?: 'semantic' | 'fulltext';
}

export function search(query: string, filters: SearchFilters = {}) {
  const params = new URLSearchParams({ q: query });
  if (filters.spaceId) params.set('spaceId', filters.spaceId);
  if (filters.authorId) params.set('authorId', filters.authorId);
  if (filters.tagId) params.set('tagId', filters.tagId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.mode) params.set('mode', filters.mode);
  return get<SearchResponse>(`/search?${params}`);
}

export function logSearchClick(searchId: string, pageId: string) {
  return post<{ logged: boolean }>('/search/click', { searchId, pageId });
}

export function searchSuggestions(query: string) {
  return get<string[]>(`/search/suggestions?q=${encodeURIComponent(query)}`);
}

export function searchPages(query: string) {
  return get<{ id: string; title: string; slug: string; space: { id: string; name: string; slug: string } }[]>(
    `/search/pages?q=${encodeURIComponent(query)}`,
  );
}
