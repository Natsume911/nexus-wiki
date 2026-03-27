import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';

const router = Router();

const ALLOWED_EMOJI = ['🐧', '👍', '❤️', '🎉', '👀', '🚀', '💡'];

// GET /api/pages/:id/reactions
router.get('/pages/:id/reactions', async (req, res, next) => {
  try {
    const pageId = req.params.id as string;
    const userId = req.user.id;

    const reactions = await prisma.pageReaction.groupBy({
      by: ['emoji'],
      where: { pageId },
      _count: { emoji: true },
    });

    const userReactions = await prisma.pageReaction.findMany({
      where: { pageId, userId },
      select: { emoji: true },
    });
    const userEmojiSet = new Set(userReactions.map(r => r.emoji));

    const result = reactions.map(r => ({
      emoji: r.emoji,
      count: r._count.emoji,
      reacted: userEmojiSet.has(r.emoji),
    }));

    success(res, result);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/reactions — toggle reaction
router.post('/pages/:id/reactions', async (req, res, next) => {
  try {
    const pageId = req.params.id as string;
    const userId = req.user.id;
    const { emoji } = req.body;

    if (!emoji || !ALLOWED_EMOJI.includes(emoji)) {
      return error(res, 'Emoji non valida', 400);
    }

    // Check if already exists → delete (toggle off)
    const existing = await prisma.pageReaction.findUnique({
      where: { pageId_userId_emoji: { pageId, userId, emoji } },
    });

    if (existing) {
      await prisma.pageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.pageReaction.create({ data: { pageId, userId, emoji } });
    }

    // Return updated counts
    const reactions = await prisma.pageReaction.groupBy({
      by: ['emoji'],
      where: { pageId },
      _count: { emoji: true },
    });

    const userReactions = await prisma.pageReaction.findMany({
      where: { pageId, userId },
      select: { emoji: true },
    });
    const userEmojiSet = new Set(userReactions.map(r => r.emoji));

    const result = reactions.map(r => ({
      emoji: r.emoji,
      count: r._count.emoji,
      reacted: userEmojiSet.has(r.emoji),
    }));

    success(res, result);
  } catch (err) { next(err); }
});

export default router;
