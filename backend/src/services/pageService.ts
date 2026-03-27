import { prisma } from '../lib/prisma.js';
import { createSlug } from '../utils/slug.js';
import { cached, cacheInvalidate, CacheKeys } from './cacheService.js';

/** Strip HTML tags from text to prevent stored XSS */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

export async function getPageTree(spaceId: string) {
  return cached(CacheKeys.pageTree(spaceId), 60, async () => {
    const pages = await prisma.page.findMany({
      where: { spaceId, deletedAt: null, archivedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { order: 'asc' },
    });

    return buildTree(pages);
  });
}

interface TreePage {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  children?: TreePage[];
}

function buildTree(pages: TreePage[]): TreePage[] {
  const map = new Map<string, TreePage>();
  const roots: TreePage[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getPageBySlug(spaceSlug: string, pageSlug: string) {
  return cached(CacheKeys.page(spaceSlug, pageSlug), 30, async () => {
    const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) return null;

    const page = await prisma.page.findUnique({
      where: { spaceId_slug: { spaceId: space.id, slug: pageSlug } },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
        children: {
          select: { id: true, title: true, slug: true, order: true },
          where: { deletedAt: null, archivedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });

    // Filter out soft-deleted pages (archived pages are still accessible via direct link)
    if (page?.deletedAt) return null;

    return page;
  });
}

export async function getPageById(id: string) {
  return prisma.page.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
      children: {
        select: { id: true, title: true, slug: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function createPage(data: {
  title: string;
  spaceId: string;
  authorId: string;
  parentId?: string;
  content?: unknown;
}) {
  const safeTitle = stripHtml(data.title);
  let slug = createSlug(safeTitle);

  // Ensure unique slug within space
  const existing = await prisma.page.findUnique({
    where: { spaceId_slug: { spaceId: data.spaceId, slug } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Get max order for sibling pages
  const maxOrder = await prisma.page.aggregate({
    where: { spaceId: data.spaceId, parentId: data.parentId ?? null },
    _max: { order: true },
  });

  const page = await prisma.page.create({
    data: {
      title: safeTitle,
      slug,
      content: (data.content ?? { type: 'doc', content: [] }) as object,
      spaceId: data.spaceId,
      parentId: data.parentId,
      authorId: data.authorId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  cacheInvalidate(CacheKeys.pageTree(data.spaceId)).catch(() => {});

  return page;
}

export async function updatePage(id: string, data: { title?: string; content?: unknown }) {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = stripHtml(data.title);
  if (data.content !== undefined) updateData.content = data.content as object;

  const page = await prisma.page.update({
    where: { id },
    data: updateData,
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });

  cacheInvalidate(CacheKeys.pageTree(page.space.id), CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});

  return page;
}

export async function updatePageContent(id: string, content: unknown, userId?: string) {
  // Create a version snapshot if enough time has passed (5 min minimum between versions)
  if (userId) {
    const lastVersion = await prisma.pageVersion.findFirst({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!lastVersion || lastVersion.createdAt < fiveMinAgo) {
      // Snapshot current content BEFORE overwriting
      const current = await prisma.page.findUnique({
        where: { id },
        select: { title: true, content: true },
      });
      if (current && current.content) {
        await prisma.pageVersion.create({
          data: {
            pageId: id,
            title: current.title,
            content: current.content as object,
            editedById: userId,
          },
        });
      }
    }
  }

  const updated = await prisma.page.update({
    where: { id },
    data: { content: content as object },
  });

  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.searchPattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});

  return updated;
}

export async function getPageVersions(pageId: string) {
  return prisma.pageVersion.findMany({
    where: { pageId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      editedBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getPageVersion(versionId: string) {
  return prisma.pageVersion.findUnique({
    where: { id: versionId },
    include: {
      editedBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function restorePageVersion(pageId: string, versionId: string, userId: string) {
  const version = await prisma.pageVersion.findUnique({ where: { id: versionId } });
  if (!version || version.pageId !== pageId) return null;

  // Snapshot current content before restoring
  const current = await prisma.page.findUnique({
    where: { id: pageId },
    select: { title: true, content: true },
  });
  if (current && current.content) {
    await prisma.pageVersion.create({
      data: {
        pageId,
        title: current.title,
        content: current.content as object,
        editedById: userId,
      },
    });
  }

  // Restore from the selected version
  return prisma.page.update({
    where: { id: pageId },
    data: {
      title: version.title,
      content: version.content as object,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      space: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function deletePage(id: string) {
  const page = await prisma.page.delete({ where: { id } });

  cacheInvalidate(CacheKeys.pageTreePattern, CacheKeys.pagePattern, CacheKeys.breadcrumbsPattern).catch(() => {});

  return page;
}

export async function reorderPages(pages: { id: string; parentId: string | null; order: number }[]) {
  // Use updateMany to avoid "record not found" crash for deleted/missing pages
  const ops = pages.map(p =>
    prisma.page.updateMany({
      where: { id: p.id, deletedAt: null },
      data: { parentId: p.parentId, order: p.order },
    })
  );
  await prisma.$transaction(ops);

  cacheInvalidate(CacheKeys.pageTreePattern).catch(() => {});

  return { reordered: pages.length };
}

export async function getBreadcrumbs(pageId: string): Promise<{ id: string; title: string; slug: string }[]> {
  return cached(CacheKeys.breadcrumbs(pageId), 120, async () => {
    const rows = await prisma.$queryRaw<{ id: string; title: string; slug: string }[]>`
      WITH RECURSIVE crumbs AS (
        SELECT id, title, slug, parent_id, 0 AS depth
        FROM pages WHERE id = ${pageId}
        UNION ALL
        SELECT p.id, p.title, p.slug, p.parent_id, c.depth + 1
        FROM pages p JOIN crumbs c ON p.id = c.parent_id
      )
      SELECT id, title, slug FROM crumbs ORDER BY depth DESC
    `;
    return rows;
  });
}

// ── Unified endpoint: page + breadcrumbs + favorite + watch + space ──

export async function getPageFull(spaceSlug: string, pageSlug: string, userId: string) {
  // Page data is cacheable, but favorite/watch are per-user — fetch in parallel
  const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
  if (!space) return null;

  const page = await getPageBySlug(spaceSlug, pageSlug);
  if (!page) return null;

  // Parallel: breadcrumbs (cached) + favorite + watch
  const [breadcrumbs, favorite, watch] = await Promise.all([
    getBreadcrumbs(page.id),
    prisma.pageFavorite.findUnique({
      where: { pageId_userId: { pageId: page.id, userId } },
    }),
    prisma.pageWatch.findUnique({
      where: { pageId_userId: { pageId: page.id, userId } },
    }),
  ]);

  return {
    page,
    breadcrumbs,
    favorited: !!favorite,
    watching: !!watch,
    space: { id: space.id, name: space.name, slug: space.slug },
  };
}
