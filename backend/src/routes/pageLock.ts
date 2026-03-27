import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET /api/pages/:id/lock — check who holds the lock
router.get('/pages/:id/lock', async (req, res, next) => {
  try {
    const pageId = req.params.id as string;

    // Clean expired locks
    await prisma.$executeRawUnsafe(
      `DELETE FROM page_locks WHERE expires_at < NOW()`
    );

    const lock = await prisma.$queryRawUnsafe<{ user_id: string; user_name: string; user_email: string; locked_at: Date }[]>(
      `SELECT user_id, user_name, user_email, locked_at FROM page_locks WHERE page_id = $1`, pageId
    );

    if (lock.length > 0) {
      const l = lock[0];
      success(res, {
        locked: true,
        userId: l.user_id,
        userName: l.user_name,
        userEmail: l.user_email,
        lockedAt: l.locked_at,
        isMe: l.user_id === req.user.id,
      });
    } else {
      success(res, { locked: false });
    }
  } catch (err) { next(err); }
});

// POST /api/pages/:id/lock — acquire or renew lock
router.post('/pages/:id/lock', async (req, res, next) => {
  try {
    const pageId = req.params.id as string;

    // Clean expired locks
    await prisma.$executeRawUnsafe(
      `DELETE FROM page_locks WHERE expires_at < NOW()`
    );

    // Check if someone else holds the lock
    const existing = await prisma.$queryRawUnsafe<{ user_id: string; user_name: string }[]>(
      `SELECT user_id, user_name FROM page_locks WHERE page_id = $1`, pageId
    );

    if (existing.length > 0 && existing[0].user_id !== req.user.id) {
      return error(res, `Pagina in modifica da ${existing[0].user_name || 'un altro utente'}`, 409);
    }

    // Upsert lock
    await prisma.$executeRawUnsafe(
      `INSERT INTO page_locks (page_id, user_id, user_name, user_email, locked_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '5 minutes')
       ON CONFLICT (page_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         user_name = EXCLUDED.user_name,
         user_email = EXCLUDED.user_email,
         locked_at = NOW(),
         expires_at = NOW() + INTERVAL '5 minutes'`,
      pageId, req.user.id, req.user.name || req.user.email, req.user.email
    );

    success(res, { locked: true });
  } catch (err) { next(err); }
});

// DELETE /api/pages/:id/lock — release lock
router.delete('/pages/:id/lock', async (req, res, next) => {
  try {
    const pageId = req.params.id as string;
    await prisma.$executeRawUnsafe(
      `DELETE FROM page_locks WHERE page_id = $1 AND user_id = $2`,
      pageId, req.user.id
    );
    success(res, { locked: false });
  } catch (err) { next(err); }
});

export default router;
