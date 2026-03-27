import { prisma } from '../lib/prisma.js';

export async function getTags() {
  return prisma.tag.findMany({
    include: {
      _count: { select: { pages: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getTagsByPage(pageId: string) {
  const pageTags = await prisma.pageTag.findMany({
    where: { pageId },
    include: {
      tag: true,
    },
  });

  return pageTags.map(pt => pt.tag);
}

export async function addTagToPage(pageId: string, tagName: string, color?: string) {
  // Find or create the tag
  const tag = await prisma.tag.upsert({
    where: { name: tagName.trim().toLowerCase() },
    update: color ? { color } : {},
    create: {
      name: tagName.trim().toLowerCase(),
      color: color || '#6366f1',
    },
  });

  // Check if page-tag relation already exists
  const existing = await prisma.pageTag.findUnique({
    where: { pageId_tagId: { pageId, tagId: tag.id } },
  });

  if (existing) {
    return tag;
  }

  await prisma.pageTag.create({
    data: { pageId, tagId: tag.id },
  });

  return tag;
}

export async function removeTagFromPage(pageId: string, tagId: string) {
  return prisma.pageTag.delete({
    where: { pageId_tagId: { pageId, tagId } },
  });
}

export async function getPagesByTag(tagId: string) {
  const pageTags = await prisma.pageTag.findMany({
    where: { tagId },
    include: {
      page: {
        select: {
          id: true,
          title: true,
          slug: true,
          spaceId: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true, email: true, avatar: true } },
          space: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return pageTags.map(pt => pt.page);
}
