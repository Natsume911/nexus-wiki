import { Router } from 'express';
import { toggleWatch, isWatching, getWatchedPages } from '../services/watchService.js';

const router = Router();

router.post('/pages/:id/watch', async (req, res, next) => {
  try {
    const result = await toggleWatch(req.params.id, (req as any).user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/pages/:id/watching', async (req, res, next) => {
  try {
    const result = await isWatching(req.params.id, (req as any).user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/watched', async (req, res, next) => {
  try {
    const pages = await getWatchedPages((req as any).user.id);
    res.json({ data: pages });
  } catch (err) { next(err); }
});

export default router;
