import { prisma } from '../lib/prisma.js';
import { cacheInvalidate, CacheKeys } from './cacheService.js';

export async function archivePage(pageId: string) {
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { archivedAt: new Date() },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return page;
}

export async function getArchive(spaceId: string) {
  return prisma.page.findMany({
    where: {
      spaceId,
      archivedAt: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      archivedAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { archivedAt: 'desc' },
  });
}

export async function restoreFromArchive(pageId: string) {
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { archivedAt: null },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return page;
}
