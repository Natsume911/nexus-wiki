import { prisma } from '../lib/prisma.js';
import { createSlug } from '../utils/slug.js';
import { cached, cacheInvalidate, CacheKeys } from './cacheService.js';

export async function getSpaces() {
  return cached(CacheKeys.spaceList, 120, async () => {
    return prisma.space.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { pages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

export async function getSpaceBySlug(slug: string) {
  return cached(CacheKeys.space(slug), 120, async () => {
    return prisma.space.findUnique({
      where: { slug },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { pages: true } },
      },
    });
  });
}

export async function createSpace(data: { name: string; description?: string; icon?: string }, userId: string) {
  let slug = createSlug(data.name);

  // Ensure unique slug
  const existing = await prisma.space.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const space = await prisma.space.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      icon: data.icon,
      createdById: userId,
      permissions: {
        create: { userId, role: 'ADMIN' },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { pages: true } },
    },
  });

  cacheInvalidate(CacheKeys.spaceList).catch(() => {});

  return space;
}

export async function updateSpace(id: string, data: { name?: string; description?: string; icon?: string }) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;

  const space = await prisma.space.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { pages: true } },
    },
  });

  cacheInvalidate(CacheKeys.spaceList, CacheKeys.spacePattern).catch(() => {});

  return space;
}

export async function deleteSpace(id: string) {
  const space = await prisma.space.delete({ where: { id } });

  cacheInvalidate(CacheKeys.spaceList, CacheKeys.spacePattern).catch(() => {});

  return space;
}
