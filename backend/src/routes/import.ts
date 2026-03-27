import { Router } from 'express';
import multer from 'multer';
import * as pageService from '../services/pageService.js';
import * as spaceService from '../services/spaceService.js';
import { markdownToTiptap, extractTitle } from '../services/importService.js';
import { success, error } from '../utils/response.js';
import { emitPageCreated } from '../lib/socket.js';
import { logAudit } from '../services/auditService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// POST /api/spaces/:spaceSlug/import/markdown — import .md file as page
router.post('/spaces/:spaceSlug/import/markdown', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Nessun file caricato', 400);

    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);

    const md = req.file.buffer.toString('utf-8');
    const title = req.body.title || extractTitle(md);
    const content = markdownToTiptap(md);

    const page = await pageService.createPage({
      title,
      spaceId: space.id,
      authorId: req.user.id,
      parentId: req.body.parentId || undefined,
      content,
    });

    emitPageCreated(space.id, {
      pageId: page.id,
      title: page.title,
      createdBy: { id: req.user.id, name: req.user.name, email: req.user.email },
    });

    logAudit(req, { action: 'IMPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, spaceId: space.id, metadata: { format: 'markdown' } }).catch(() => {});
    success(res, page, 201);
  } catch (err) { next(err); }
});

// POST /api/spaces/:spaceSlug/import/markdown-text — import markdown text (not file)
router.post('/spaces/:spaceSlug/import/markdown-text', async (req, res, next) => {
  try {
    const { markdown, title: customTitle, parentId } = req.body;
    if (!markdown) return error(res, 'Markdown obbligatorio', 400);

    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);

    const title = customTitle || extractTitle(markdown);
    const content = markdownToTiptap(markdown);

    const page = await pageService.createPage({
      title,
      spaceId: space.id,
      authorId: req.user.id,
      parentId: parentId || undefined,
      content,
    });

    logAudit(req, { action: 'IMPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, spaceId: space.id, metadata: { format: 'markdown-text' } }).catch(() => {});
    success(res, page, 201);
  } catch (err) { next(err); }
});

export default router;
