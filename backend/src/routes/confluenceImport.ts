import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';
import { parseConfluenceZip, htmlToTiptap, type ParsedPage } from '../services/confluenceImportService.js';
import slugifyPkg from 'slugify';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

const slugify = ((slugifyPkg as any).default ?? slugifyPkg) as unknown as (str: string, opts?: Record<string, unknown>) => string;

const router = Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// POST /api/spaces/:spaceSlug/import/confluence
router.post('/spaces/:spaceSlug/import/confluence', importUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceSlug = req.params.spaceSlug as string;
    if (!req.file) return error(res, 'File ZIP richiesto', 400);

    // Verify space exists
    const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) return error(res, 'Spazio non trovato', 404);

    // Parse Confluence ZIP
    const { pages: parsedPages, attachments } = parseConfluenceZip(req.file.buffer);

    let imported = 0;
    const errors: string[] = [];
    const uploadDir = process.env.UPLOAD_DIR || '/uploads';

    // Map title -> created page ID for hierarchy
    const titleToId = new Map<string, string>();

    // Upload attachments first
    const attachmentMap = new Map<string, string>(); // filename -> URL path
    for (const att of attachments) {
      try {
        const safeFilename = `${Date.now()}-${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const spaceDir = path.join(uploadDir, spaceSlug);
        if (!fs.existsSync(spaceDir)) fs.mkdirSync(spaceDir, { recursive: true });
        const filePath = path.join(spaceDir, safeFilename);
        fs.writeFileSync(filePath, att.buffer);

        await prisma.attachment.create({
          data: {
            filename: safeFilename,
            originalName: att.filename,
            mimeType: getMimeType(att.filename),
            size: att.buffer.length,
            path: `${spaceSlug}/${safeFilename}`,
            spaceId: space.id,
            uploadedById: req.user.id,
          },
        });
        attachmentMap.set(att.filename, `/wiki/uploads/${spaceSlug}/${safeFilename}`);
      } catch (err: any) {
        errors.push(`Allegato ${att.filename}: ${err.message}`);
      }
    }

    // Sort pages: parents before children
    const sorted = sortByHierarchy(parsedPages);

    // Create pages
    for (const parsed of sorted) {
      try {
        let pageSlug = slugify(parsed.title, { lower: true, strict: true }) || 'pagina';

        // Ensure unique slug
        const existing = await prisma.page.findFirst({ where: { spaceId: space.id, slug: pageSlug, deletedAt: null } });
        if (existing) pageSlug = `${pageSlug}-${Date.now().toString(36)}`;

        // Convert HTML to TipTap JSON
        let tiptapContent = htmlToTiptap(parsed.html);

        // Remap image sources in the TipTap content
        tiptapContent = remapImages(tiptapContent, attachmentMap);

        // Resolve parent
        const parentId = parsed.parentTitle ? (titleToId.get(parsed.parentTitle) || null) : null;

        const page = await prisma.page.create({
          data: {
            title: parsed.title,
            slug: pageSlug,
            content: tiptapContent as any,
            spaceId: space.id,
            parentId,
            authorId: req.user.id,
            order: parsed.order,
          },
        });

        titleToId.set(parsed.title, page.id);
        imported++;
      } catch (err: any) {
        errors.push(`Pagina "${parsed.title}": ${err.message}`);
      }
    }

    logAudit(req, {
      action: 'IMPORT',
      resourceType: 'SPACE',
      resourceId: space.id,
      resourceTitle: space.name,
      metadata: { source: 'confluence', imported, failed: errors.length },
    }).catch(() => {});

    return success(res, { imported, failed: errors.length, errors: errors.slice(0, 50) });
  } catch (err) {
    next(err);
  }
});

function sortByHierarchy(pages: ParsedPage[]): ParsedPage[] {
  const result: ParsedPage[] = [];
  const added = new Set<string>();

  // Add root pages first
  for (const p of pages) {
    if (!p.parentTitle) {
      result.push(p);
      added.add(p.title);
    }
  }

  // Then add children iteratively
  let maxIterations = pages.length;
  while (added.size < pages.length && maxIterations-- > 0) {
    for (const p of pages) {
      if (added.has(p.title)) continue;
      if (!p.parentTitle || added.has(p.parentTitle)) {
        result.push(p);
        added.add(p.title);
      }
    }
  }

  // Add any remaining orphans
  for (const p of pages) {
    if (!added.has(p.title)) {
      result.push(p);
    }
  }

  return result;
}

function remapImages(doc: Record<string, unknown>, attachmentMap: Map<string, string>): Record<string, unknown> {
  const content = doc.content as Record<string, unknown>[] | undefined;
  if (!content) return doc;

  return {
    ...doc,
    content: content.map((node) => {
      if (node.type === 'image') {
        const attrs = node.attrs as Record<string, string> | undefined;
        if (attrs?.src) {
          const filename = path.basename(attrs.src);
          const mapped = attachmentMap.get(filename);
          if (mapped) {
            return { ...node, attrs: { ...attrs, src: mapped } };
          }
        }
      }
      if (node.content) {
        return remapImages(node as Record<string, unknown>, attachmentMap);
      }
      return node;
    }),
  };
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip', '.mp4': 'video/mp4',
  };
  return map[ext] || 'application/octet-stream';
}

export default router;
