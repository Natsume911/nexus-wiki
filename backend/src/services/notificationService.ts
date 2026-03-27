import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';

interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  body?: string;
  pageId?: string;
  spaceSlug?: string;
  pageSlug?: string;
}

export async function createNotification(data: CreateNotificationData) {
  const notif = await prisma.notification.create({ data });

  // Push via Socket.io to the user's personal room
  const io = getIO();
  if (io) {
    io.to(`user:${data.userId}`).emit('notification', notif);
  }

  return notif;
}

export async function createNotificationForMany(userIds: string[], data: Omit<CreateNotificationData, 'userId'>) {
  const notifications = await Promise.all(
    userIds.map(userId => createNotification({ ...data, userId }))
  );
  return notifications;
}

export async function getNotifications(userId: string, limit = 50, onlyUnread = false) {
  return prisma.notification.findMany({
    where: { userId, ...(onlyUnread ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

// --- Notification triggers ---

export async function notifyMentionedUsers(
  mentionedUserIds: string[],
  pageId: string,
  pageSlug: string,
  spaceSlug: string,
  pageTitle: string,
  mentionedByName: string
) {
  const data = {
    type: 'mention',
    title: `${mentionedByName} ti ha menzionato`,
    body: `In "${pageTitle}"`,
    pageId,
    spaceSlug,
    pageSlug,
  };
  return createNotificationForMany(mentionedUserIds, data);
}

export async function notifyPageWatchers(
  pageId: string,
  spaceSlug: string,
  pageSlug: string,
  pageTitle: string,
  updatedByUserId: string,
  updatedByName: string
) {
  // Get all watchers except the person who made the change
  const watchers = await prisma.pageWatch.findMany({
    where: { pageId, userId: { not: updatedByUserId } },
    select: { userId: true },
  });

  if (watchers.length === 0) return;

  const userIds = watchers.map(w => w.userId);
  return createNotificationForMany(userIds, {
    type: 'page-watched-update',
    title: `${updatedByName} ha aggiornato "${pageTitle}"`,
    body: 'Una pagina che segui è stata modificata',
    pageId,
    spaceSlug,
    pageSlug,
  });
}

export async function notifyCommentOnPage(
  pageId: string,
  spaceSlug: string,
  pageSlug: string,
  pageTitle: string,
  pageAuthorId: string,
  commenterName: string,
  commenterId: string
) {
  // Notify page author (if different from commenter)
  if (pageAuthorId === commenterId) return;

  return createNotification({
    userId: pageAuthorId,
    type: 'comment-added',
    title: `${commenterName} ha commentato "${pageTitle}"`,
    body: 'Nuovo commento sulla tua pagina',
    pageId,
    spaceSlug,
    pageSlug,
  });
}
