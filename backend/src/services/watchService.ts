import { prisma } from '../lib/prisma.js';

export async function watchPage(pageId: string, userId: string) {
  await prisma.pageWatch.upsert({
    where: { pageId_userId: { pageId, userId } },
    create: { pageId, userId },
    update: {},
  });
  return { watching: true };
}

export async function unwatchPage(pageId: string, userId: string) {
  await prisma.pageWatch.deleteMany({ where: { pageId, userId } });
  return { watching: false };
}

export async function toggleWatch(pageId: string, userId: string) {
  const existing = await prisma.pageWatch.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });
  if (existing) return unwatchPage(pageId, userId);
  return watchPage(pageId, userId);
}

export async function isWatching(pageId: string, userId: string) {
  const existing = await prisma.pageWatch.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });
  return { watching: !!existing };
}

export async function getWatchedPages(userId: string) {
  const watches = await prisma.pageWatch.findMany({
    where: { userId },
    include: {
      page: {
        select: {
          id: true,
          title: true,
          slug: true,
          updatedAt: true,
          space: { select: { slug: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return watches.map(w => w.page);
}

export async function getPageWatchers(pageId: string) {
  const watches = await prisma.pageWatch.findMany({
    where: { pageId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return watches.map(w => w.user);
}
