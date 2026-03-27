import { get } from './client';

export interface ActivityItem {
  id: string;
  type: string;
  spaceId: string;
  pageId: string | null;
  metadata: { title?: string; pageTitle?: string };
  user: { id: string; name: string | null; email: string };
  createdAt: string;
}

export function getSpaceActivity(spaceSlug: string) {
  return get<ActivityItem[]>(`/spaces/${spaceSlug}/activity`);
}
