import { get } from './client';

export interface Backlink {
  id: string;
  title: string;
  slug: string;
  spaceSlug: string;
  spaceName: string;
}

export async function getBacklinks(pageId: string): Promise<Backlink[]> {
  return get(`/pages/${pageId}/backlinks`);
}
