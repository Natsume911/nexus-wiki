import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import slugifyPkg from 'slugify';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';
import { parseNotionZip } from '../services/notionImportService.js';
import { htmlToTiptapGeneric } from '../services/htmlImportService.js';
import type { Request, Response, NextFunction } from 'express';

const slugify = ((slugifyPkg as any).default ?? slugifyPkg) as unknown as (str: string, opts?: Record<string, unknown>) => string;
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

// ── POST /api/spaces/:spaceSlug/import/notion ─────────────────────
// Upload Notion export ZIP (Markdown & CSV format)
router.post('/spaces/:spaceSlug/import/notion', importUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceSlug = req.params.spaceSlug as string;
    if (!req.file) return error(res, 'File ZIP richiesto', 400);

    const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) return error(res, 'Spazio non trovato', 404);

    const { pages, attachments } = parseNotionZip(req.file.buffer);
    const uploadDir = process.env.UPLOAD_DIR || '/uploads';
    const errors: string[] = [];
    let imported = 0;

    // Upload attachments
    const attachmentMap = new Map<string, string>();
    for (const att of attachments) {
      try {
        const safeFilename = `${Date.now()}-${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const spaceDir = path.join(uploadDir, spaceSlug);
        if (!fs.existsSync(spaceDir)) fs.mkdirSync(spaceDir, { recursive: true });
        fs.writeFileSync(path.join(spaceDir, safeFilename), att.buffer);
        await prisma.attachment.create({
          data: {
            filename: safeFilename, originalName: att.filename,
            mimeType: getMimeType(att.filename), size: att.buffer.length,
            path: `${spaceSlug}/${safeFilename}`, spaceId: space.id, uploadedById: req.user.id,
          },
        });
        attachmentMap.set(att.filename, `/wiki/uploads/${spaceSlug}/${safeFilename}`);
      } catch (err: any) {
        errors.push(`Allegato ${att.filename}: ${err.message}`);
      }
    }

    // Create pages (parents first by sorting on path depth)
    const sorted = [...pages].sort((a, b) => {
      const da = a.parentPath ? a.parentPath.split('/').length : 0;
      const db = b.parentPath ? b.parentPath.split('/').length : 0;
      return da - db;
    });

    const pathToId = new Map<string, string>();

    for (const page of sorted) {
      try {
        let pageSlug = slugify(page.title, { lower: true, strict: true }) || 'pagina';
        const existing = await prisma.page.findFirst({ where: { spaceId: space.id, slug: pageSlug, deletedAt: null } });
        if (existing) pageSlug = `${pageSlug}-${Date.now().toString(36)}`;

        // Resolve parent from directory path
        const parentId = page.parentPath ? (pathToId.get(page.parentPath) || null) : null;

        // Remap images in content
        const content = remapImages(page.content, attachmentMap);

        const created = await prisma.page.create({
          data: {
            title: page.title, slug: pageSlug, content: content as any,
            spaceId: space.id, parentId, authorId: req.user.id, order: page.order,
          },
        });

        // Map this page's directory path for child resolution
        const dirPath = page.parentPath
          ? `${page.parentPath}/${page.title}`
          : page.title;
        pathToId.set(dirPath, created.id);
        // Also map with Notion hash suffixes stripped
        if (page.parentPath) pathToId.set(page.parentPath, parentId || created.id);

        imported++;
      } catch (err: any) {
        errors.push(`Pagina "${page.title}": ${err.message}`);
      }
    }

    logAudit(req, {
      action: 'IMPORT', resourceType: 'SPACE', resourceId: space.id,
      resourceTitle: space.name, metadata: { source: 'notion', imported, failed: errors.length },
    }).catch(() => {});

    success(res, { imported, failed: errors.length, errors: errors.slice(0, 50) });
  } catch (err) { next(err); }
});

// ── POST /api/spaces/:spaceSlug/import/google-docs ────────────────
// Upload Google Docs HTML export
router.post('/spaces/:spaceSlug/import/google-docs', importUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceSlug = req.params.spaceSlug as string;
    if (!req.file) return error(res, 'File HTML richiesto', 400);

    const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) return error(res, 'Spazio non trovato', 404);

    const html = req.file.buffer.toString('utf-8');
    const title = req.body.title || extractTitleFromHtml(html) || req.file.originalname.replace(/\.html?$/i, '');
    const content = htmlToTiptapGeneric(html);

    let pageSlug = slugify(title, { lower: true, strict: true }) || 'pagina';
    const existing = await prisma.page.findFirst({ where: { spaceId: space.id, slug: pageSlug, deletedAt: null } });
    if (existing) pageSlug = `${pageSlug}-${Date.now().toString(36)}`;

    const page = await prisma.page.create({
      data: {
        title, slug: pageSlug, content: content as any,
        spaceId: space.id, authorId: req.user.id, parentId: req.body.parentId || null,
      },
    });

    logAudit(req, {
      action: 'IMPORT', resourceType: 'PAGE', resourceId: page.id,
      resourceTitle: title, spaceId: space.id, metadata: { source: 'google-docs' },
    }).catch(() => {});

    success(res, { imported: 1, page: { id: page.id, title: page.title, slug: page.slug } });
  } catch (err) { next(err); }
});

// ── POST /api/spaces/:spaceSlug/import/docx ───────────────────────
// Upload Word DOCX file
router.post('/spaces/:spaceSlug/import/docx', importUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceSlug = req.params.spaceSlug as string;
    if (!req.file) return error(res, 'File DOCX richiesto', 400);

    const space = await prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) return error(res, 'Spazio non trovato', 404);

    // Convert DOCX → HTML via mammoth
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    const html = result.value;

    const title = req.body.title || req.file.originalname.replace(/\.docx?$/i, '');
    const content = htmlToTiptapGeneric(html);

    let pageSlug = slugify(title, { lower: true, strict: true }) || 'pagina';
    const existing = await prisma.page.findFirst({ where: { spaceId: space.id, slug: pageSlug, deletedAt: null } });
    if (existing) pageSlug = `${pageSlug}-${Date.now().toString(36)}`;

    const page = await prisma.page.create({
      data: {
        title, slug: pageSlug, content: content as any,
        spaceId: space.id, authorId: req.user.id, parentId: req.body.parentId || null,
      },
    });

    logAudit(req, {
      action: 'IMPORT', resourceType: 'PAGE', resourceId: page.id,
      resourceTitle: title, spaceId: space.id, metadata: { source: 'docx', warnings: result.messages.length },
    }).catch(() => {});

    success(res, { imported: 1, page: { id: page.id, title: page.title, slug: page.slug }, warnings: result.messages.map(m => m.message) });
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title>(.*?)<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]*>/g, '').trim() : null;
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
          const filename = path.basename(decodeURIComponent(attrs.src));
          const mapped = attachmentMap.get(filename);
          if (mapped) return { ...node, attrs: { ...attrs, src: mapped } };
        }
      }
      if (node.content) return remapImages(node as Record<string, unknown>, attachmentMap);
      return node;
    }),
  };
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

export default router;
