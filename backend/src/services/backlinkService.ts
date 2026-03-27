import { prisma } from '../lib/prisma.js';

function extractPageLinkIds(content: any): string[] {
  const ids: string[] = [];

  function walk(node: any) {
    if (!node) return;
    if (node.type === 'pageLink' && node.attrs?.pageId) {
      ids.push(node.attrs.pageId);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  }

  walk(content);
  return [...new Set(ids)];
}

export async function updateBacklinks(pageId: string, content: any) {
  const targetIds = extractPageLinkIds(content);

  // Delete existing outgoing links for this page
  await prisma.pageLink.deleteMany({
    where: { sourcePageId: pageId },
  });

  // Create new links (skip self-links)
  if (targetIds.length > 0) {
    const validTargetIds = targetIds.filter(id => id !== pageId);
    await prisma.pageLink.createMany({
      data: validTargetIds.map(targetId => ({
        sourcePageId: pageId,
        targetPageId: targetId,
      })),
      skipDuplicates: true,
    });
  }
}

export async function getBacklinks(pageId: string) {
  const links = await prisma.pageLink.findMany({
    where: { targetPageId: pageId },
    include: {
      sourcePage: {
        select: {
          id: true,
          title: true,
          slug: true,
          space: { select: { slug: true, name: true } },
        },
      },
    },
  });

  return links.map(l => ({
    id: l.sourcePage.id,
    title: l.sourcePage.title,
    slug: l.sourcePage.slug,
    spaceSlug: l.sourcePage.space.slug,
    spaceName: l.sourcePage.space.name,
  }));
}
