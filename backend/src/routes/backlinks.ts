import { Router } from 'express';
import { getBacklinks } from '../services/backlinkService.js';
import { success } from '../utils/response.js';

const router = Router();

// GET /api/pages/:id/backlinks
router.get('/pages/:id/backlinks', async (req, res, next) => {
  try {
    const links = await getBacklinks(req.params.id);
    res.json({ data: links });
  } catch (err) { next(err); }
});

export default router;
