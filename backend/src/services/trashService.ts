import { prisma } from '../lib/prisma.js';
import { cacheInvalidate, CacheKeys } from './cacheService.js';

export async function softDeletePage(pageId: string) {
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { deletedAt: new Date() },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return page;
}

export async function getTrash(spaceId: string) {
  return prisma.page.findMany({
    where: {
      spaceId,
      deletedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      deletedAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { deletedAt: 'desc' },
  });
}

export async function restoreFromTrash(pageId: string) {
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { deletedAt: null },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return page;
}

export async function permanentlyDelete(pageId: string) {
  const page = await prisma.page.delete({ where: { id: pageId } });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return page;
}

export async function emptyTrash(spaceId: string) {
  const result = await prisma.page.deleteMany({
    where: {
      spaceId,
      deletedAt: { not: null },
    },
  });
  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});
  return { deleted: result.count };
}
