import { Router } from 'express';
import * as tagService from '../services/tagService.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET /api/tags — list all tags
router.get('/tags', async (_req, res, next) => {
  try {
    const tags = await tagService.getTags();
    success(res, tags);
  } catch (err) { next(err); }
});

// GET /api/pages/:id/tags — get tags for a page
router.get('/pages/:id/tags', async (req, res, next) => {
  try {
    const tags = await tagService.getTagsByPage(req.params.id as string);
    success(res, tags);
  } catch (err) { next(err); }
});

// POST /api/pages/:id/tags — add tag to page
router.post('/pages/:id/tags', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) {
      return error(res, 'Il nome del tag è obbligatorio', 400);
    }
    const tag = await tagService.addTagToPage(req.params.id as string, name, color);
    success(res, tag, 201);
  } catch (err) { next(err); }
});

// DELETE /api/pages/:id/tags/:tagId — remove tag from page
router.delete('/pages/:id/tags/:tagId', async (req, res, next) => {
  try {
    await tagService.removeTagFromPage(req.params.id as string, req.params.tagId as string);
    success(res, { removed: true });
  } catch (err) { next(err); }
});

// GET /api/tags/:id/pages — get pages by tag
router.get('/tags/:id/pages', async (req, res, next) => {
  try {
    const pages = await tagService.getPagesByTag(req.params.id as string);
    success(res, pages);
  } catch (err) { next(err); }
});

export default router;
