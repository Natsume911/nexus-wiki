import { Router } from 'express';
import * as commentService from '../services/commentService.js';
import { success, error } from '../utils/response.js';
import { emitCommentAdded } from '../lib/socket.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/pages/:pageId/comments
router.get('/pages/:pageId/comments', async (req, res, next) => {
  try {
    const comments = await commentService.getComments(req.params.pageId as string);
    success(res, comments);
  } catch (err) { next(err); }
});

// POST /api/pages/:pageId/comments
router.post('/pages/:pageId/comments', async (req, res, next) => {
  try {
    const { content, parentId } = req.body;
    if (!content?.trim()) return error(res, 'Il contenuto è obbligatorio', 400);
    const pageId = req.params.pageId as string;
    const comment = await commentService.createComment(pageId, req.user.id, content.trim(), parentId || null);
    // Emit real-time notification
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { title: true, spaceId: true } });
    if (page) {
      emitCommentAdded(pageId, page.spaceId, {
        commentId: comment.id,
        pageTitle: page.title,
        author: { id: req.user.id, name: req.user.name, email: req.user.email },
      });
    }
    success(res, comment, 201);
  } catch (err) { next(err); }
});

// PUT /api/comments/:id
router.put('/comments/:id', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return error(res, 'Il contenuto è obbligatorio', 400);
    const comment = await commentService.updateComment(req.params.id as string, req.user.id, content.trim());
    if (!comment) return error(res, 'Commento non trovato o non autorizzato', 404);
    success(res, comment);
  } catch (err) { next(err); }
});

// DELETE /api/comments/:id
router.delete('/comments/:id', async (req, res, next) => {
  try {
    const comment = await commentService.deleteComment(req.params.id as string, req.user.id);
    if (!comment) return error(res, 'Commento non trovato o non autorizzato', 404);
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
