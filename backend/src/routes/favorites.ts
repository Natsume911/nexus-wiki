import { Router } from 'express';
import * as favoriteService from '../services/favoriteService.js';
import { success } from '../utils/response.js';

const router = Router();

// GET /api/favorites — list user's favorites
router.get('/favorites', async (req, res, next) => {
  try {
    const favs = await favoriteService.getFavorites(req.user.id);
    success(res, favs);
  } catch (err) { next(err); }
});

// POST /api/pages/:pageId/favorite — toggle favorite
router.post('/pages/:pageId/favorite', async (req, res, next) => {
  try {
    const result = await favoriteService.toggleFavorite(req.user.id, req.params.pageId as string);
    success(res, result);
  } catch (err) { next(err); }
});

// GET /api/pages/:pageId/favorite — check if favorited
router.get('/pages/:pageId/favorite', async (req, res, next) => {
  try {
    const favorited = await favoriteService.isFavorite(req.user.id, req.params.pageId as string);
    success(res, { favorited });
  } catch (err) { next(err); }
});

// GET /api/recent — recent pages
router.get('/recent', async (req, res, next) => {
  try {
    const pages = await favoriteService.getRecentPages(req.user.id);
    success(res, pages);
  } catch (err) { next(err); }
});

export default router;
