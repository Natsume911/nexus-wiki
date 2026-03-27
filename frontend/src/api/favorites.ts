import { get, post } from './client';

interface FavoritePage {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { id: string; name: string; slug: string };
  favoritedAt: string;
}

interface RecentPage {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { id: string; name: string; slug: string };
}

export function getFavorites() {
  return get<FavoritePage[]>('/favorites');
}

export function toggleFavorite(pageId: string) {
  return post<{ favorited: boolean }>(`/pages/${pageId}/favorite`, {});
}

export function checkFavorite(pageId: string) {
  return get<{ favorited: boolean }>(`/pages/${pageId}/favorite`);
}

export function getRecentPages() {
  return get<RecentPage[]>('/recent');
}
