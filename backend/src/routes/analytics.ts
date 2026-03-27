import { Router } from 'express';
import * as analyticsService from '../services/analyticsService.js';

const router = Router();

// POST /api/pages/:id/view — record a page view
router.post('/pages/:id/view', async (req, res, next) => {
  try {
    await analyticsService.recordPageView(req.params.id, (req as any).user.id);
    res.json({ data: { recorded: true } });
  } catch (err) { next(err); }
});

// GET /api/pages/:id/views — get page view stats
router.get('/pages/:id/views', async (req, res, next) => {
  try {
    const [total, unique] = await Promise.all([
      analyticsService.getPageViewCount(req.params.id),
      analyticsService.getPageUniqueViewers(req.params.id),
    ]);
    res.json({ data: { total, unique } });
  } catch (err) { next(err); }
});

// GET /api/pages/:id/viewers — who viewed this page
router.get('/pages/:id/viewers', async (req, res, next) => {
  try {
    const viewers = await analyticsService.getPageViewers(req.params.id);
    res.json({ data: viewers });
  } catch (err) { next(err); }
});

// GET /api/recently-viewed — user's recently viewed pages
router.get('/recently-viewed', async (req, res, next) => {
  try {
    const pages = await analyticsService.getRecentlyViewedByUser((req as any).user.id);
    res.json({ data: pages });
  } catch (err) { next(err); }
});

// GET /api/popular-pages?spaceId=&days=
router.get('/popular-pages', async (req, res, next) => {
  try {
    const spaceId = req.query.spaceId as string | undefined;
    const days = parseInt(req.query.days as string) || 30;
    const pages = await analyticsService.getPopularPages(spaceId, days);
    res.json({ data: pages });
  } catch (err) { next(err); }
});

export default router;
