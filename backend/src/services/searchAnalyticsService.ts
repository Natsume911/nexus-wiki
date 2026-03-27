import { prisma } from '../lib/prisma.js';

export async function logSearch(params: {
  query: string;
  mode: string;
  resultsCount: number;
  timingMs: number;
  expandedQuery: string | null;
  userId?: string;
  spaceId?: string;
}): Promise<string> {
  const entry = await prisma.searchQuery.create({
    data: {
      query: params.query,
      mode: params.mode,
      resultsCount: params.resultsCount,
      timingMs: params.timingMs,
      expandedQuery: params.expandedQuery,
      userId: params.userId,
      spaceId: params.spaceId,
    },
  });
  return entry.id;
}

export async function logClick(searchId: string, pageId: string): Promise<void> {
  await prisma.searchQuery.update({
    where: { id: searchId },
    data: {
      clickedPageId: pageId,
      clickedAt: new Date(),
    },
  });
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  noResultQueries: { query: string; count: number }[];
  topQueries: { query: string; count: number }[];
  avgTiming: number;
  clickRate: number;
  searchesByMode: { mode: string; count: number }[];
  searchesOverTime: { date: string; count: number }[];
}

export async function getAnalytics(days = 30): Promise<SearchAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    totalSearches,
    uniqueQueries,
    noResultQueries,
    topQueries,
    avgTiming,
    withClicks,
    searchesByMode,
    searchesOverTime,
  ] = await Promise.all([
    // Total searches
    prisma.searchQuery.count({ where: { createdAt: { gte: since } } }),

    // Unique queries
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(DISTINCT lower(query))::bigint as count FROM search_queries WHERE created_at >= $1`,
      since,
    ),

    // No-result queries (most common)
    prisma.$queryRawUnsafe<{ query: string; count: bigint }[]>(
      `SELECT lower(query) as query, COUNT(*)::bigint as count
       FROM search_queries
       WHERE results_count = 0 AND created_at >= $1
       GROUP BY lower(query)
       ORDER BY count DESC LIMIT 20`,
      since,
    ),

    // Top queries
    prisma.$queryRawUnsafe<{ query: string; count: bigint }[]>(
      `SELECT lower(query) as query, COUNT(*)::bigint as count
       FROM search_queries
       WHERE created_at >= $1
       GROUP BY lower(query)
       ORDER BY count DESC LIMIT 20`,
      since,
    ),

    // Average timing
    prisma.$queryRawUnsafe<[{ avg: number }]>(
      `SELECT COALESCE(AVG(timing_ms), 0)::float as avg FROM search_queries WHERE created_at >= $1`,
      since,
    ),

    // Click count
    prisma.searchQuery.count({
      where: { createdAt: { gte: since }, clickedPageId: { not: null } },
    }),

    // By mode
    prisma.$queryRawUnsafe<{ mode: string; count: bigint }[]>(
      `SELECT mode, COUNT(*)::bigint as count FROM search_queries WHERE created_at >= $1 GROUP BY mode ORDER BY count DESC`,
      since,
    ),

    // Over time (last N days)
    prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') as date, COUNT(*)::bigint as count
       FROM search_queries
       WHERE created_at >= $1
       GROUP BY date ORDER BY date`,
      since,
    ),
  ]);

  return {
    totalSearches,
    uniqueQueries: Number(uniqueQueries[0]?.count ?? 0),
    noResultQueries: noResultQueries.map((r) => ({ query: r.query, count: Number(r.count) })),
    topQueries: topQueries.map((r) => ({ query: r.query, count: Number(r.count) })),
    avgTiming: Math.round(avgTiming[0]?.avg ?? 0),
    clickRate: totalSearches > 0 ? Math.round((withClicks / totalSearches) * 100) : 0,
    searchesByMode: searchesByMode.map((r) => ({ mode: r.mode, count: Number(r.count) })),
    searchesOverTime: searchesOverTime.map((r) => ({ date: r.date, count: Number(r.count) })),
  };
}
