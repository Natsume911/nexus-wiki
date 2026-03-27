import { prisma } from '../lib/prisma.js';

export async function getInlineComments(pageId: string) {
  return prisma.inlineComment.findMany({
    where: { pageId },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createInlineComment(data: {
  pageId: string;
  authorId: string;
  content: string;
  quote: string;
  fromPos: number;
  toPos: number;
}) {
  return prisma.inlineComment.create({
    data: {
      pageId: data.pageId,
      authorId: data.authorId,
      content: data.content,
      quote: data.quote,
      fromPos: data.fromPos,
      toPos: data.toPos,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function resolveInlineComment(id: string) {
  const comment = await prisma.inlineComment.findUnique({ where: { id } });
  if (!comment) return null;

  return prisma.inlineComment.update({
    where: { id },
    data: { resolved: !comment.resolved },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function deleteInlineComment(id: string) {
  return prisma.inlineComment.delete({ where: { id } });
}
