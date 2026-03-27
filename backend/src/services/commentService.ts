import { prisma } from '../lib/prisma.js';

const authorSelect = { id: true, name: true, email: true, avatar: true };

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

export async function getComments(pageId: string) {
  // Fetch top-level comments with their replies (one level of nesting)
  return prisma.comment.findMany({
    where: { pageId, parentId: null },
    include: {
      author: { select: authorSelect },
      replies: {
        include: {
          author: { select: authorSelect },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createComment(pageId: string, authorId: string, content: string, parentId: string | null = null) {
  return prisma.comment.create({
    data: { pageId, authorId, content: stripHtml(content), parentId },
    include: {
      author: { select: authorSelect },
      replies: {
        include: { author: { select: authorSelect } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function updateComment(id: string, authorId: string, content: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.authorId !== authorId) return null;

  return prisma.comment.update({
    where: { id },
    data: { content },
    include: {
      author: { select: authorSelect },
    },
  });
}

export async function deleteComment(id: string, authorId: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.authorId !== authorId) return null;

  return prisma.comment.delete({ where: { id } });
}
