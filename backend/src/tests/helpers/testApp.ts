import express from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
import spacesRouter from '../../routes/spaces.js';
import pagesRouter from '../../routes/pages.js';
import searchRouter from '../../routes/search.js';
import commentsRouter from '../../routes/comments.js';
import tagsRouter from '../../routes/tags.js';
import trashRouter from '../../routes/trash.js';
import permissionsRouter from '../../routes/permissions.js';
import auditLogRouter from '../../routes/auditLog.js';
import { auditContextMiddleware } from '../../middleware/audit.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

export function createTestApp(userEmail = 'test@nexus.dev') {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Audit context middleware
  app.use(auditContextMiddleware);

  // Mock auth middleware - looks up user by email, no upsert
  app.use(async (req, _res, next) => {
    const email = (req.headers['x-auth-request-email'] as string) || userEmail;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        req.user = user;
      }
    } catch { /* ignore */ }
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // Routes
  app.use('/api/spaces', spacesRouter);
  app.use('/api', pagesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api', commentsRouter);
  app.use('/api', tagsRouter);
  app.use('/api', trashRouter);
  app.use('/api', permissionsRouter);
  app.use('/api/admin/audit', auditLogRouter);

  app.use(errorHandler);
  return app;
}
