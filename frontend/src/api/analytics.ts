import { get, post } from './client';

interface ViewStats {
  total: number;
  unique: number;
}

interface RecentlyViewedPage {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { id: string; slug: string; name: string };
}

interface PopularPage {
  id: string;
  title: string;
  slug: string;
  space: { id: string; slug: string; name: string };
  viewCount: number;
}

export function recordPageView(pageId: string) {
  return post<{ recorded: boolean }>(`/pages/${pageId}/view`);
}

export function getPageViews(pageId: string) {
  return get<ViewStats>(`/pages/${pageId}/views`);
}

export function getRecentlyViewed() {
  return get<RecentlyViewedPage[]>('/recently-viewed');
}

export function getPopularPages(spaceId?: string) {
  const params = spaceId ? `?spaceId=${spaceId}` : '';
  return get<PopularPage[]>(`/popular-pages${params}`);
}
