import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { auditContextMiddleware } from './middleware/audit.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocket } from './lib/socket.js';
import { createHocuspocus } from './lib/hocuspocus.js';
import { disconnectRedis } from './lib/redis.js';
import { pruneOldAuditLogs } from './services/auditService.js';
import spacesRouter from './routes/spaces.js';
import pagesRouter from './routes/pages.js';
import attachmentsRouter from './routes/attachments.js';
import searchRouter from './routes/search.js';
import usersRouter from './routes/users.js';
import commentsRouter from './routes/comments.js';
import exportRouter from './routes/export.js';
import favoritesRouter from './routes/favorites.js';
import permissionsRouter from './routes/permissions.js';
import importRouter from './routes/import.js';
import activityRouter from './routes/activity.js';
import adminRouter from './routes/admin.js';
import backupRouter from './routes/backup.js';
import tagsRouter from './routes/tags.js';
import templatesRouter from './routes/templates.js';
import trashRouter from './routes/trash.js';
import inlineCommentsRouter from './routes/inlineComments.js';
import pageOperationsRouter from './routes/pageOperations.js';
import backlinksRouter from './routes/backlinks.js';
import watchRouter from './routes/watch.js';
import spaceExportRouter from './routes/spaceExport.js';
import analyticsRouter from './routes/analytics.js';
import meetingNotesRouter from './routes/meetingNotes.js';
import graphRouter from './routes/graph.js';
import aiWritingRouter from './routes/aiWriting.js';
import searchAdminRouter from './routes/searchAdmin.js';
import auditLogRouter from './routes/auditLog.js';
import confluenceImportRouter from './routes/confluenceImport.js';
import translateRouter from './routes/translate.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Initialize Socket.io
initSocket(httpServer);

// Initialize Hocuspocus (collaborative editing WebSocket server)
const hocuspocus = createHocuspocus();

// Handle WebSocket upgrades
httpServer.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  if (url.pathname === '/collaboration') {
    hocuspocus.handleConnection(socket, request, {});
  }
  // Socket.io handles /socket.io upgrades on its own
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://wiki.example.com' : '*');
app.use(cors({ origin: corsOrigin }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files — with security headers
app.use('/uploads', express.static(process.env.UPLOAD_DIR || '/uploads', {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

// Trust proxy (behind Nginx/Docker networking) — needed for correct req.ip
app.set('trust proxy', 1);

// Health check (no auth, no rate limit)
app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Rate limiting — keyed by user email (falls back to IP)
// Placed AFTER health check so health checks don't consume the budget
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Troppe richieste, riprova tra poco' },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Troppe richieste di upload, riprova tra poco' },
});
const backupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Troppe richieste di backup, riprova tra poco' },
});
app.use('/api', globalLimiter);

// Audit context middleware (captures IP + User-Agent) — BEFORE auth
app.use(auditContextMiddleware);

// Auth middleware for all /api routes below
app.use('/api', authMiddleware);

// Routes
app.use('/api/spaces', spacesRouter);
app.use('/api', pagesRouter);
app.use('/api/spaces/:spaceSlug/attachments', uploadLimiter);
app.use('/api', attachmentsRouter);
app.use('/api/search', searchRouter);
app.use('/api/users', usersRouter);
app.use('/api', commentsRouter);
app.use('/api', exportRouter);
app.use('/api', favoritesRouter);
app.use('/api', permissionsRouter);
app.use('/api/spaces/:spaceSlug/import', uploadLimiter);
app.use('/api', importRouter);
app.use('/api', activityRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/backup', backupLimiter);
app.use('/api/admin/backup', backupRouter);
app.use('/api/admin/audit', auditLogRouter);
app.use('/api/spaces/:spaceSlug/import/confluence', uploadLimiter);
app.use('/api', confluenceImportRouter);
app.use('/api', tagsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api', trashRouter);
app.use('/api', inlineCommentsRouter);
app.use('/api', pageOperationsRouter);
app.use('/api', backlinksRouter);
app.use('/api', watchRouter);
app.use('/api', spaceExportRouter);
app.use('/api', analyticsRouter);
// AI rate limiter — tighter limit to control OpenAI costs
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Troppe richieste AI, riprova tra poco' },
});
app.use('/api/meeting', aiLimiter);
app.use('/api', meetingNotesRouter);
app.use('/api', graphRouter);
app.use('/api/ai', aiLimiter);
app.use('/api', aiWritingRouter);
app.use('/api/admin/search', searchAdminRouter);
app.use('/api', translateRouter);

// Error handler
app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`Nexus backend running on port ${PORT}`);
});

// Periodic audit log pruning (every 24h)
const PRUNE_INTERVAL = 24 * 60 * 60 * 1000;
setInterval(() => {
  pruneOldAuditLogs(365).catch((err) => console.error('[audit] prune error:', err));
}, PRUNE_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});

export default app;
