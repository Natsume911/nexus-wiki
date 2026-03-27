import { get, post } from './client';

interface WatchedPage {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { slug: string; name: string };
}

export async function toggleWatch(pageId: string): Promise<{ watching: boolean }> {
  return post(`/pages/${pageId}/watch`);
}

export async function isWatching(pageId: string): Promise<{ watching: boolean }> {
  return get(`/pages/${pageId}/watching`);
}

export async function getWatchedPages(): Promise<WatchedPage[]> {
  return get('/watched');
}
