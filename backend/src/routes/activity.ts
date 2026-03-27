import { Router } from 'express';
import * as activityService from '../services/activityService.js';
import * as spaceService from '../services/spaceService.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET /api/spaces/:spaceSlug/activity
router.get('/spaces/:spaceSlug/activity', async (req, res, next) => {
  try {
    const space = await spaceService.getSpaceBySlug(req.params.spaceSlug as string);
    if (!space) return error(res, 'Spazio non trovato', 404);
    const activities = await activityService.getSpaceActivities(space.id);
    success(res, activities);
  } catch (err) { next(err); }
});

export default router;
