import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { requireSpaceAccess } from '../middleware/permissions.js';
import * as attachmentService from '../services/attachmentService.js';
import * as spaceService from '../services/spaceService.js';
import { syncAttachmentChunks, deleteAttachmentChunks } from '../services/attachmentSearchService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// POST /api/spaces/:spaceSlug/attachments — upload file
router.post('/spaces/:spaceSlug/attachments', requireSpaceAccess('EDITOR'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Nessun file caricato', 400);

    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);

    const attachment = await attachmentService.createAttachment({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      tempPath: req.file.path,
      spaceSlug: space.slug,
      spaceId: space.id,
      pageId: req.body.pageId,
      uploadedById: req.user.id,
    });

    logAudit(req, { action: 'CREATE', resourceType: 'ATTACHMENT', resourceId: attachment.id, resourceTitle: attachment.originalName, spaceId: space.id }).catch(() => {});
    // Fire-and-forget: extract text and index for search
    syncAttachmentChunks(attachment.id).catch((e) => console.error('[attachments] indexing failed:', e));
    success(res, {
      id: attachment.id,
      url: `/wiki/uploads/${attachment.path}`,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }, 201);
  } catch (err) { next(err); }
});

// GET /api/spaces/:spaceSlug/attachments — list attachments
router.get('/spaces/:spaceSlug/attachments', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const pageId = req.query.pageId as string | undefined;
    const attachments = await attachmentService.getAttachmentsBySpace(space.id, pageId);
    success(res, attachments);
  } catch (err) { next(err); }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', requireSpaceAccess('EDITOR'), async (req, res, next) => {
  try {
    const attId = req.params.id as string;
    const deleted = await attachmentService.deleteAttachment(attId);
    if (!deleted) return error(res, 'Allegato non trovato', 404);
    deleteAttachmentChunks(attId).catch(() => {});
    logAudit(req, { action: 'DELETE', resourceType: 'ATTACHMENT', resourceId: attId }).catch(() => {});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
