import { Router } from 'express';
import * as inlineCommentService from '../services/inlineCommentService.js';
import { success, error } from '../utils/response.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/pages/:id/inline-comments
router.get('/pages/:id/inline-comments', async (req, res, next) => {
  try {
    const comments = await inlineCommentService.getInlineComments(req.params.id as string);
    success(res, comments);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/inline-comments
router.post('/pages/:id/inline-comments', async (req, res, next) => {
  try {
    const { content, quote, fromPos, toPos } = req.body;
    if (!content?.trim()) {
      return error(res, 'Il contenuto è obbligatorio', 400);
    }
    if (!quote) {
      return error(res, 'Il testo selezionato è obbligatorio', 400);
    }
    if (fromPos === undefined || toPos === undefined) {
      return error(res, 'Le posizioni del testo sono obbligatorie', 400);
    }
    const comment = await inlineCommentService.createInlineComment({
      pageId: req.params.id as string,
      authorId: req.user.id,
      content: content.trim(),
      quote,
      fromPos: Number(fromPos),
      toPos: Number(toPos),
    });
    success(res, comment, 201);
  } catch (err) { next(err); }
});

// PUT /api/inline-comments/:id/resolve
router.put('/inline-comments/:id/resolve', async (req, res, next) => {
  try {
    const comment = await inlineCommentService.resolveInlineComment(req.params.id as string);
    if (!comment) return error(res, 'Commento inline non trovato', 404);
    success(res, comment);
  } catch (err) { next(err); }
});

// DELETE /api/inline-comments/:id (owner or ADMIN only)
router.delete('/inline-comments/:id', async (req, res, next) => {
  try {
    const comment = await prisma.inlineComment.findUnique({ where: { id: req.params.id as string }, select: { authorId: true } });
    if (!comment) return error(res, 'Commento inline non trovato', 404);
    if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return error(res, 'Non autorizzato a eliminare questo commento', 403);
    }
    await inlineCommentService.deleteInlineComment(req.params.id as string);
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
