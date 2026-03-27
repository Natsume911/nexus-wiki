import { Router } from 'express';
import * as templateService from '../services/templateService.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET /api/templates
router.get('/', async (req, res, next) => {
  try {
    const spaceId = req.query.spaceId as string | undefined;
    const templates = await templateService.getTemplates(spaceId);
    success(res, templates);
  } catch (err) { next(err); }
});

// GET /api/templates/:id
router.get('/:id', async (req, res, next) => {
  try {
    const template = await templateService.getTemplate(req.params.id as string);
    if (!template) return error(res, 'Template non trovato', 404);
    success(res, template);
  } catch (err) { next(err); }
});

// POST /api/templates
router.post('/', async (req, res, next) => {
  try {
    const { title, description, icon, content, category, spaceId } = req.body;
    if (!title?.trim()) {
      return error(res, 'Il titolo è obbligatorio', 400);
    }
    const template = await templateService.createTemplate(
      { title: title.trim(), description, icon, content, category, spaceId },
      req.user.id,
    );
    success(res, template, 201);
  } catch (err) { next(err); }
});

// PUT /api/templates/:id (EDITOR+ only)
router.put('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'VIEWER') return error(res, 'Accesso riservato agli editor', 403);
    const { title, description, icon, content, category } = req.body;
    const template = await templateService.updateTemplate(req.params.id as string, {
      title,
      description,
      icon,
      content,
      category,
    });
    success(res, template);
  } catch (err) { next(err); }
});

// DELETE /api/templates/:id (EDITOR+ only)
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'VIEWER') return error(res, 'Accesso riservato agli editor', 403);
    await templateService.deleteTemplate(req.params.id as string);
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// POST /api/templates/seed — seed built-in templates (ADMIN only)
router.post('/seed', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return error(res, 'Accesso riservato agli amministratori', 403);
    }
    const result = await templateService.seedBuiltInTemplates(req.user.id);
    success(res, result, result.seeded ? 201 : 200);
  } catch (err) { next(err); }
});

export default router;
