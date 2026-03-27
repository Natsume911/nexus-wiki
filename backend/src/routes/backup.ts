import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as backupService from '../services/backupService.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const restoreUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

// Middleware: only ADMIN users can access backup routes
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'ADMIN') {
    return error(res, 'Accesso riservato agli amministratori', 403);
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/backup/db — stream pg_dump file as download
router.get('/db', async (req, res, next) => {
  let dumpFile: string | null = null;
  try {
    dumpFile = await backupService.createDatabaseDump();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nexus-backup-${timestamp}.sql`;

    logAudit(req, { action: 'BACKUP', resourceType: 'SYSTEM', metadata: { type: 'database' } }).catch(() => {});
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = await import('fs').then(fs => fs.createReadStream(dumpFile!));
    stream.on('end', () => {
      backupService.cleanupDumpFile(dumpFile!);
    });
    stream.on('error', (err) => {
      backupService.cleanupDumpFile(dumpFile!);
      next(err);
    });
    stream.pipe(res);
  } catch (err) {
    if (dumpFile) backupService.cleanupDumpFile(dumpFile);
    next(err);
  }
});

// GET /api/admin/backup/json — export all data as JSON
router.get('/json', async (req, res, next) => {
  try {
    const data = await backupService.exportAllDataAsJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nexus-export-${timestamp}.json`;

    logAudit(req, { action: 'BACKUP', resourceType: 'SYSTEM', metadata: { type: 'json' } }).catch(() => {});
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/admin/backup/restore/db — restore from SQL dump
router.post('/restore/db', restoreUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'File SQL richiesto', 400);
    await backupService.restoreFromDump(req.file.path);
    backupService.cleanupDumpFile(req.file.path);
    logAudit(req, { action: 'RESTORE', resourceType: 'SYSTEM', metadata: { type: 'database' } }).catch(() => {});
    return success(res, { message: 'Database ripristinato con successo' });
  } catch (err: any) {
    if (req.file) backupService.cleanupDumpFile(req.file.path);
    next(err);
  }
});

// POST /api/admin/backup/restore/json — restore from JSON export
router.post('/restore/json', restoreUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'File JSON richiesto', 400);
    const content = fs.readFileSync(req.file.path, 'utf-8');
    backupService.cleanupDumpFile(req.file.path);
    const data = JSON.parse(content);
    const result = await backupService.restoreFromJson(data);
    logAudit(req, { action: 'RESTORE', resourceType: 'SYSTEM', metadata: { type: 'json', ...result } }).catch(() => {});
    return success(res, { message: 'Dati ripristinati con successo', ...result });
  } catch (err: any) {
    if (req.file) backupService.cleanupDumpFile(req.file.path);
    next(err);
  }
});

export default router;
