import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

let counter = 0;

export async function createUser(overrides: Partial<{ email: string; name: string; role: 'ADMIN' | 'EDITOR' | 'VIEWER' }> = {}) {
  counter++;
  return prisma.user.create({
    data: {
      email: overrides.email || `user${counter}-${Date.now()}@test.dev`,
      name: overrides.name || `Test User ${counter}`,
      role: overrides.role || 'EDITOR',
    },
  });
}

export async function createSpace(userId: string, overrides: Partial<{ name: string; slug: string; description: string }> = {}) {
  counter++;
  const slug = overrides.slug || `test-space-${counter}-${Date.now()}`;
  return prisma.space.create({
    data: {
      name: overrides.name || `Test Space ${counter}`,
      slug,
      description: overrides.description,
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
}

export async function createPage(spaceId: string, authorId: string, overrides: Partial<{ title: string; slug: string; content: object; parentId: string; order: number }> = {}) {
  counter++;
  const slug = overrides.slug || `test-page-${counter}-${Date.now()}`;
  return prisma.page.create({
    data: {
      title: overrides.title || `Test Page ${counter}`,
      slug,
      content: overrides.content || { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] }] },
      spaceId,
      authorId,
      parentId: overrides.parentId,
      order: overrides.order ?? 0,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function createComment(pageId: string, authorId: string, content = 'Test comment') {
  return prisma.comment.create({
    data: { pageId, authorId, content },
  });
}

export async function createTag(name?: string, color?: string) {
  counter++;
  return prisma.tag.create({
    data: { name: name || `tag-${counter}-${Date.now()}`, color: color || '#6366f1' },
  });
}

export { prisma };
