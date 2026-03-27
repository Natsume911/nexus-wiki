import { prisma } from '../lib/prisma.js';
import { createSlug } from '../utils/slug.js';

export async function duplicatePage(pageId: string, userId: string) {
  const original = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      tags: true,
    },
  });

  if (!original) {
    throw new Error('Pagina non trovata');
  }

  const newTitle = `${original.title} - copia`;
  let slug = createSlug(newTitle);

  // Ensure unique slug within space
  const existing = await prisma.page.findUnique({
    where: { spaceId_slug: { spaceId: original.spaceId, slug } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Get max order for sibling pages
  const maxOrder = await prisma.page.aggregate({
    where: { spaceId: original.spaceId, parentId: original.parentId },
    _max: { order: true },
  });

  const duplicated = await prisma.page.create({
    data: {
      title: newTitle,
      slug,
      content: original.content as object,
      spaceId: original.spaceId,
      parentId: original.parentId,
      authorId: userId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });

  // Duplicate tags
  if (original.tags.length > 0) {
    await prisma.pageTag.createMany({
      data: original.tags.map(t => ({
        pageId: duplicated.id,
        tagId: t.tagId,
      })),
    });
  }

  return duplicated;
}

export async function movePage(pageId: string, targetSpaceId: string, targetParentId?: string | null) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) {
    throw new Error('Pagina non trovata');
  }

  let slug = page.slug;

  // Check if slug is unique in the target space
  const existing = await prisma.page.findUnique({
    where: { spaceId_slug: { spaceId: targetSpaceId, slug } },
  });
  if (existing && existing.id !== pageId) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Get max order in target location
  const maxOrder = await prisma.page.aggregate({
    where: { spaceId: targetSpaceId, parentId: targetParentId ?? null },
    _max: { order: true },
  });

  return prisma.page.update({
    where: { id: pageId },
    data: {
      spaceId: targetSpaceId,
      parentId: targetParentId ?? null,
      slug,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function copyPageToSpace(pageId: string, targetSpaceId: string, userId: string) {
  const original = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      tags: true,
    },
  });

  if (!original) {
    throw new Error('Pagina non trovata');
  }

  let slug = createSlug(original.title);

  // Ensure unique slug in target space
  const existing = await prisma.page.findUnique({
    where: { spaceId_slug: { spaceId: targetSpaceId, slug } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Get max order in target space root
  const maxOrder = await prisma.page.aggregate({
    where: { spaceId: targetSpaceId, parentId: null },
    _max: { order: true },
  });

  const copied = await prisma.page.create({
    data: {
      title: original.title,
      slug,
      content: original.content as object,
      spaceId: targetSpaceId,
      parentId: null,
      authorId: userId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });

  // Copy tags
  if (original.tags.length > 0) {
    await prisma.pageTag.createMany({
      data: original.tags.map(t => ({
        pageId: copied.id,
        tagId: t.tagId,
      })),
    });
  }

  return copied;
}
