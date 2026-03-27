import { get, post } from './client';

export interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export function getReactions(pageId: string) {
  return get<Reaction[]>(`/pages/${pageId}/reactions`);
}

export function toggleReaction(pageId: string, emoji: string) {
  return post<Reaction[]>(`/pages/${pageId}/reactions`, { emoji });
}
