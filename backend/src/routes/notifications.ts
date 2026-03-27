import { Router } from 'express';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService.js';
import { success } from '../utils/response.js';

const router = Router();

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const unread = req.query.unread === 'true';
    const notifications = await getNotifications(req.user.id, 50, unread);
    success(res, notifications);
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user.id);
    success(res, { count });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res, next) => {
  try {
    await markAsRead(req.params.id, req.user.id);
    success(res, { success: true });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res, next) => {
  try {
    await markAllAsRead(req.user.id);
    success(res, { success: true });
  } catch (err) { next(err); }
});

export default router;
