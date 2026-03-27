import { prisma } from '../lib/prisma.js';

export async function recordPageView(pageId: string, userId: string) {
  // Throttle: don't record if user viewed this page in the last 5 minutes
  const recent = await prisma.pageView.findFirst({
    where: {
      pageId,
      userId,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });

  if (recent) return null;

  return prisma.pageView.create({
    data: { pageId, userId },
  });
}

export async function getPageViewCount(pageId: string): Promise<number> {
  return prisma.pageView.count({ where: { pageId } });
}

export async function getPageUniqueViewers(pageId: string): Promise<number> {
  const result = await prisma.pageView.groupBy({
    by: ['userId'],
    where: { pageId },
  });
  return result.length;
}

export async function getRecentlyViewedByUser(userId: string, limit = 20) {
  // Get distinct pages recently viewed by user, ordered by most recent view
  const views = await prisma.$queryRaw<{ page_id: string; last_viewed: Date }[]>`
    SELECT DISTINCT ON (pv.page_id) pv.page_id, pv.created_at as last_viewed
    FROM page_views pv
    JOIN pages p ON p.id = pv.page_id
    WHERE pv.user_id = ${userId} AND p.deleted_at IS NULL
    ORDER BY pv.page_id, pv.created_at DESC
  `;

  // Sort by last_viewed desc and limit
  views.sort((a, b) => new Date(b.last_viewed).getTime() - new Date(a.last_viewed).getTime());
  const topViews = views.slice(0, limit);

  if (topViews.length === 0) return [];

  const pageIds = topViews.map(v => v.page_id);

  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds }, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      updatedAt: true,
      space: { select: { id: true, slug: true, name: true } },
    },
  });

  // Reorder to match the view order
  const pageMap = new Map(pages.map(p => [p.id, p]));
  return pageIds.map(id => pageMap.get(id)).filter(Boolean);
}

export async function getPageViewers(pageId: string, limit = 50) {
  const viewers = await prisma.$queryRaw<{ user_id: string; name: string | null; email: string; avatar: string | null; view_count: bigint; last_viewed: Date }[]>`
    SELECT pv.user_id, u.name, u.email, u.avatar,
           COUNT(*)::bigint as view_count,
           MAX(pv.created_at) as last_viewed
    FROM page_views pv
    JOIN users u ON u.id = pv.user_id
    WHERE pv.page_id = ${pageId}
    GROUP BY pv.user_id, u.name, u.email, u.avatar
    ORDER BY last_viewed DESC
    LIMIT ${limit}
  `;
  return viewers.map(v => ({
    userId: v.user_id,
    name: v.name,
    email: v.email,
    avatar: v.avatar,
    viewCount: Number(v.view_count),
    lastViewed: v.last_viewed,
  }));
}

export async function getPopularPages(spaceId?: string, days = 30, limit = 10) {
  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: any = { createdAt: { gte: dateThreshold } };
  if (spaceId) {
    where.page = { spaceId, deletedAt: null };
  } else {
    where.page = { deletedAt: null };
  }

  const grouped = await prisma.pageView.groupBy({
    by: ['pageId'],
    where,
    _count: { pageId: true },
    orderBy: { _count: { pageId: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const pageIds = grouped.map(g => g.pageId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds }, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      space: { select: { id: true, slug: true, name: true } },
    },
  });

  const pageMap = new Map(pages.map(p => [p.id, p]));
  return grouped.map(g => ({
    ...pageMap.get(g.pageId),
    viewCount: g._count.pageId,
  })).filter(item => item.title); // filter out any that don't exist
}
