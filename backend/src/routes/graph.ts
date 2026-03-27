import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET /api/spaces/:spaceSlug/graph — full space graph with tags and hierarchy
router.get('/spaces/:spaceSlug/graph', async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({
      where: { slug: req.params.spaceSlug as string },
    });
    if (!space) return error(res, 'Spazio non trovato', 404);

    // Get all pages in this space (non-deleted) with tags
    const pages = await prisma.page.findMany({
      where: { spaceId: space.id, deletedAt: null, archivedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
        tags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    const pageIds = pages.map(p => p.id);

    // Get all PageLinks where both source and target are in this space
    const links = await prisma.pageLink.findMany({
      where: {
        sourcePageId: { in: pageIds },
        targetPageId: { in: pageIds },
      },
      select: { sourcePageId: true, targetPageId: true },
    });

    const nodes = pages.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      parentId: p.parentId,
      tags: p.tags.map(t => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
    }));

    // Separate edge types: 'link' for [[PageLink]], 'child' for parent-child hierarchy
    const edges: { source: string; target: string; type: 'link' | 'child' }[] = [];

    // PageLink edges
    for (const l of links) {
      edges.push({ source: l.sourcePageId, target: l.targetPageId, type: 'link' });
    }

    // Parent-child edges (parent → child)
    for (const p of pages) {
      if (p.parentId && pageIds.includes(p.parentId)) {
        edges.push({ source: p.parentId, target: p.id, type: 'child' });
      }
    }

    success(res, { nodes, edges, spaceSlug: space.slug });
  } catch (err) { next(err); }
});

// GET /api/pages/:pageId/local-graph — 1-hop neighborhood for a single page
router.get('/pages/:pageId/local-graph', async (req, res, next) => {
  try {
    const pageId = req.params.pageId as string;
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, title: true, slug: true, parentId: true, spaceId: true },
    });
    if (!page) return error(res, 'Page not found', 404);

    // Outgoing links (this page links to)
    const outgoing = await prisma.pageLink.findMany({
      where: { sourcePageId: pageId },
      include: {
        targetPage: {
          select: { id: true, title: true, slug: true, parentId: true, deletedAt: true },
        },
      },
    });

    // Incoming links (pages that link to this page)
    const incoming = await prisma.pageLink.findMany({
      where: { targetPageId: pageId },
      include: {
        sourcePage: {
          select: { id: true, title: true, slug: true, parentId: true, deletedAt: true },
        },
      },
    });

    // Children
    const children = await prisma.page.findMany({
      where: { parentId: pageId, deletedAt: null, archivedAt: null },
      select: { id: true, title: true, slug: true, parentId: true },
    });

    // Parent
    let parent = null;
    if (page.parentId) {
      parent = await prisma.page.findUnique({
        where: { id: page.parentId },
        select: { id: true, title: true, slug: true, parentId: true },
      });
    }

    // Build node set (deduplicated)
    const nodeMap = new Map<string, { id: string; title: string; slug: string; parentId: string | null }>();
    nodeMap.set(page.id, { id: page.id, title: page.title, slug: page.slug, parentId: page.parentId });

    for (const o of outgoing) {
      if (!o.targetPage.deletedAt) {
        nodeMap.set(o.targetPage.id, {
          id: o.targetPage.id, title: o.targetPage.title,
          slug: o.targetPage.slug, parentId: o.targetPage.parentId,
        });
      }
    }
    for (const i of incoming) {
      if (!i.sourcePage.deletedAt) {
        nodeMap.set(i.sourcePage.id, {
          id: i.sourcePage.id, title: i.sourcePage.title,
          slug: i.sourcePage.slug, parentId: i.sourcePage.parentId,
        });
      }
    }
    for (const c of children) {
      nodeMap.set(c.id, c);
    }
    if (parent) {
      nodeMap.set(parent.id, parent);
    }

    const nodes = Array.from(nodeMap.values());
    const nodeIds = new Set(nodes.map(n => n.id));

    const edges: { source: string; target: string; type: 'link' | 'child' }[] = [];

    // Link edges
    for (const o of outgoing) {
      if (nodeIds.has(o.targetPage.id)) {
        edges.push({ source: pageId, target: o.targetPage.id, type: 'link' });
      }
    }
    for (const i of incoming) {
      if (nodeIds.has(i.sourcePage.id)) {
        edges.push({ source: i.sourcePage.id, target: pageId, type: 'link' });
      }
    }

    // Hierarchy edges
    for (const c of children) {
      edges.push({ source: pageId, target: c.id, type: 'child' });
    }
    if (parent && nodeIds.has(parent.id)) {
      edges.push({ source: parent.id, target: pageId, type: 'child' });
    }

    success(res, { nodes, edges, centerId: pageId });
  } catch (err) { next(err); }
});

export default router;
