import { prisma } from '../lib/prisma.js';

export async function getSpacePermissions(spaceId: string) {
  return prisma.spacePermission.findMany({
    where: { spaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { user: { email: 'asc' } },
  });
}

export async function setPermission(spaceId: string, userId: string, role: string) {
  return prisma.spacePermission.upsert({
    where: { spaceId_userId: { spaceId, userId } },
    create: { spaceId, userId, role: role as any },
    update: { role: role as any },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function removePermission(spaceId: string, userId: string) {
  return prisma.spacePermission.delete({
    where: { spaceId_userId: { spaceId, userId } },
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, avatar: true },
    orderBy: { email: 'asc' },
  });
}
