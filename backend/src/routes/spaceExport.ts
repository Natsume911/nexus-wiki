import { Router } from 'express';
import { exportSpaceBySlug } from '../services/spaceExportService.js';

const router = Router();

// GET /api/spaces/:slug/export
router.get('/spaces/:slug/export', async (req, res, next) => {
  try {
    const { archive, spaceName } = await exportSpaceBySlug(req.params.slug);

    const sanitized = spaceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}_export.zip"`);

    archive.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
