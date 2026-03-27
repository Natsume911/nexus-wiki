import { getRedis } from '../lib/redis.js';

// ── Cache-aside pattern ────────────────────────────────────────────

export async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const val = await cacheGet<T>(key);
  if (val !== null) return val;
  const result = await fetcher();
  await cacheSet(key, result, ttl);
  return result;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch { /* graceful degradation */ }
}

export async function cacheInvalidate(...patterns: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Use SCAN to avoid blocking with KEYS
        let cursor = '0';
        do {
          const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = next;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== '0');
      } else {
        await redis.del(pattern);
      }
    }
  } catch { /* graceful degradation */ }
}

// ── Cache key patterns ─────────────────────────────────────────────

export const CacheKeys = {
  pageTree: (spaceId: string) => `page-tree:${spaceId}`,
  pageTreePattern: 'page-tree:*',
  page: (spaceSlug: string, pageSlug: string) => `page:${spaceSlug}:${pageSlug}`,
  pagePattern: 'page:*',
  breadcrumbs: (pageId: string) => `breadcrumbs:${pageId}`,
  breadcrumbsPattern: 'breadcrumbs:*',
  spaceList: 'space-list',
  space: (slug: string) => `space:${slug}`,
  spacePattern: 'space:*',
  user: (email: string) => `user:${email}`,
  search: (hash: string) => `search:${hash}`,
  searchPattern: 'search:*',
};
