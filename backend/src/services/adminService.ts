import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      active: true,
      department: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          spaces: true,
          pages: true,
          comments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateUserRole(userId: string, role: Role) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteUser(userId: string) {
  return prisma.user.delete({ where: { id: userId } });
}

function getDirectorySize(dirPath: string): number {
  let totalSize = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // Ignore permission errors
  }
  return totalSize;
}

export async function getStats() {
  const [users, spaces, pages, attachments, comments, storageBytes] = await Promise.all([
    prisma.user.count(),
    prisma.space.count(),
    prisma.page.count(),
    prisma.attachment.count(),
    prisma.comment.count(),
    Promise.resolve(getDirectorySize(UPLOAD_DIR)),
  ]);

  return {
    users,
    spaces,
    pages,
    attachments,
    comments,
    storageUsed: storageBytes,
    storageUsedFormatted: formatBytes(storageBytes),
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function getAllSpaces() {
  return prisma.space.findMany({
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      _count: {
        select: {
          pages: true,
          permissions: true,
          attachments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
