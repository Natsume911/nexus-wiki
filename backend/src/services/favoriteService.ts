import { prisma } from '../lib/prisma.js';

export async function getFavorites(userId: string) {
  const favs = await prisma.pageFavorite.findMany({
    where: { userId },
    include: {
      page: {
        select: {
          id: true,
          title: true,
          slug: true,
          updatedAt: true,
          space: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return favs.map((f) => ({ ...f.page, favoritedAt: f.createdAt }));
}

export async function toggleFavorite(userId: string, pageId: string) {
  const existing = await prisma.pageFavorite.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });

  if (existing) {
    await prisma.pageFavorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.pageFavorite.create({ data: { pageId, userId } });
  return { favorited: true };
}

export async function isFavorite(userId: string, pageId: string) {
  const fav = await prisma.pageFavorite.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });
  return !!fav;
}

export async function getRecentPages(userId: string) {
  // Recent = pages the user has edited or viewed (approximated by updatedAt)
  // For now, just return recently updated pages across all spaces
  return prisma.page.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      updatedAt: true,
      space: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
}
