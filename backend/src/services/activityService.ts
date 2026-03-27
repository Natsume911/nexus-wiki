import { prisma } from '../lib/prisma.js';

export async function createActivity(data: {
  type: string;
  spaceId: string;
  pageId?: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      type: data.type,
      spaceId: data.spaceId,
      pageId: data.pageId,
      userId: data.userId,
      metadata: (data.metadata || {}) as object,
    },
  });
}

export async function getSpaceActivities(spaceId: string, limit = 30) {
  return prisma.activity.findMany({
    where: { spaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
