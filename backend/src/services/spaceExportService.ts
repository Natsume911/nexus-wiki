import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { tiptapToMarkdown } from './exportService.js';

interface PageExportData {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string | null; email: string };
}

export async function exportSpaceAsZip(spaceId: string): Promise<{ archive: archiver.Archiver; spaceName: string }> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    include: {
      pages: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          parentId: true,
          order: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { name: true, email: true } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!space) throw new Error('Space non trovato');

  const archive = archiver('zip', { zlib: { level: 9 } });

  // Build page path map for nested structure
  const pageMap = new Map<string, PageExportData>(
    space.pages.map((p) => [p.id, p as PageExportData])
  );

  function getPagePath(page: PageExportData): string {
    const parts: string[] = [page.slug];
    let current = page;
    while (current.parentId && pageMap.has(current.parentId)) {
      current = pageMap.get(current.parentId)!;
      parts.unshift(current.slug);
    }
    return parts.join('/');
  }

  // Add each page as markdown
  for (const page of space.pages) {
    const path = getPagePath(page as PageExportData);
    const authorName = (page.author.name || page.author.email).replace(/"/g, '\\"');
    const frontMatter = [
      '---',
      `title: "${page.title.replace(/"/g, '\\"')}"`,
      `author: "${authorName}"`,
      `created: ${page.createdAt.toISOString()}`,
      `updated: ${page.updatedAt.toISOString()}`,
      '---',
      '',
    ].join('\n');

    const markdown = tiptapToMarkdown(page.content as any);
    archive.append(frontMatter + '# ' + page.title + '\n\n' + markdown, {
      name: `${path}.md`,
    });
  }

  // Add space metadata
  const metadata = JSON.stringify({
    name: space.name,
    slug: space.slug,
    description: space.description,
    pageCount: space.pages.length,
    exportedAt: new Date().toISOString(),
  }, null, 2);
  archive.append(metadata, { name: '_space.json' });

  archive.finalize();

  return { archive, spaceName: space.name };
}

export async function exportSpaceBySlug(spaceSlug: string) {
  const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
  if (!space) throw new Error('Space non trovato');
  return exportSpaceAsZip(space.id);
}
