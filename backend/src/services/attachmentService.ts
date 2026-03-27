import { prisma } from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

export async function createAttachment(data: {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  tempPath: string;
  spaceSlug: string;
  spaceId: string;
  pageId?: string;
  uploadedById: string;
}) {
  // Move file from temp to space directory
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const relPath = path.join(data.spaceSlug, year, month, data.filename);
  const destDir = path.join(UPLOAD_DIR, data.spaceSlug, year, month);
  const destPath = path.join(UPLOAD_DIR, relPath);

  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(data.tempPath, destPath);

  return prisma.attachment.create({
    data: {
      filename: data.filename,
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
      path: relPath,
      spaceId: data.spaceId,
      pageId: data.pageId,
      uploadedById: data.uploadedById,
    },
  });
}

export async function getAttachment(id: string) {
  return prisma.attachment.findUnique({ where: { id } });
}

export async function getAttachmentsBySpace(spaceId: string, pageId?: string) {
  return prisma.attachment.findMany({
    where: { spaceId, ...(pageId ? { pageId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function deleteAttachment(id: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return null;

  // Delete file from disk
  const filePath = path.join(UPLOAD_DIR, attachment.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return prisma.attachment.delete({ where: { id } });
}
