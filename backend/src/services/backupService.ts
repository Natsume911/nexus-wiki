import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '../lib/prisma.js';

const execFileAsync = promisify(execFile);

interface PgConnectionParams {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(url: string): PgConnectionParams {
  // Format: postgresql://user:password@host:port/database?params
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

export async function createDatabaseDump(): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL non configurata');
  }

  const params = parseDatabaseUrl(databaseUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFile = path.join(os.tmpdir(), `nexus-backup-${timestamp}.sql`);

  const env = {
    ...process.env,
    PGPASSWORD: params.password,
  };

  await execFileAsync('pg_dump', [
    '-h', params.host,
    '-p', params.port,
    '-U', params.user,
    '-d', params.database,
    '--no-owner',
    '--no-acl',
    '-f', dumpFile,
  ], { env });

  return dumpFile;
}

export async function exportAllDataAsJson() {
  const [users, spaces, pages, attachments, comments, tags, templates, activities] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.space.findMany({
      include: {
        permissions: {
          select: { userId: true, role: true },
        },
      },
    }),
    prisma.page.findMany({
      include: {
        versions: {
          select: {
            id: true,
            title: true,
            content: true,
            editedById: true,
            createdAt: true,
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    prisma.attachment.findMany(),
    prisma.comment.findMany(),
    prisma.tag.findMany(),
    prisma.template.findMany(),
    prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
      users,
      spaces,
      pages,
      attachments,
      comments,
      tags,
      templates,
      activities,
    },
  };
}

export async function restoreFromDump(filePath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL non configurata');

  const params = parseDatabaseUrl(databaseUrl);
  const env = { ...process.env, PGPASSWORD: params.password };

  await execFileAsync('psql', [
    '-h', params.host,
    '-p', params.port,
    '-U', params.user,
    '-d', params.database,
    '-f', filePath,
  ], { env });
}

export async function restoreFromJson(data: any): Promise<{ restored: number }> {
  const d = data?.data || data;
  if (!d) throw new Error('Formato JSON non valido');

  let count = 0;

  await prisma.$transaction(async (tx) => {
    // Truncate in reverse FK order
    await tx.$executeRawUnsafe('TRUNCATE "PageVersion", "PageFavorite", "Comment", "InlineComment", "PageTag", "Backlink", "PageWatch", "Attachment", "Page", "SpacePermission", "Space", "Activity", "AuditLog", "Template", "Tag", "User" CASCADE');

    // Restore users
    if (d.users?.length) {
      for (const u of d.users) {
        await tx.user.create({ data: { id: u.id, email: u.email, name: u.name || null, role: u.role || 'EDITOR', createdAt: u.createdAt ? new Date(u.createdAt) : undefined } });
        count++;
      }
    }

    // Restore tags
    if (d.tags?.length) {
      for (const t of d.tags) {
        await tx.tag.create({ data: { id: t.id, name: t.name, color: t.color || null } });
        count++;
      }
    }

    // Restore spaces
    if (d.spaces?.length) {
      for (const s of d.spaces) {
        await tx.space.create({
          data: {
            id: s.id, name: s.name, slug: s.slug, description: s.description || null,
            icon: s.icon || null, createdById: s.createdById,
            createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
          },
        });
        // Restore space permissions
        if (s.permissions?.length) {
          for (const p of s.permissions) {
            await tx.spacePermission.create({ data: { spaceId: s.id, userId: p.userId, role: p.role } });
          }
        }
        count++;
      }
    }

    // Restore pages (sort by parentId to ensure parents exist first)
    if (d.pages?.length) {
      const sorted = [...d.pages].sort((a: any, b: any) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return 0;
      });
      for (const p of sorted) {
        await tx.page.create({
          data: {
            id: p.id, title: p.title, slug: p.slug, content: p.content,
            spaceId: p.spaceId, parentId: p.parentId || null, authorId: p.authorId,
            order: p.order || 0, deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
            createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
          },
        });
        // Restore page versions
        if (p.versions?.length) {
          for (const v of p.versions) {
            await tx.pageVersion.create({
              data: { id: v.id, pageId: p.id, title: v.title, content: v.content, editedById: v.editedById, createdAt: v.createdAt ? new Date(v.createdAt) : undefined },
            });
          }
        }
        // Restore page tags
        if (p.tags?.length) {
          for (const pt of p.tags) {
            const tagId = pt.tag?.id || pt.tagId;
            if (tagId) await tx.pageTag.create({ data: { pageId: p.id, tagId } });
          }
        }
        count++;
      }
    }

    // Restore attachments
    if (d.attachments?.length) {
      for (const a of d.attachments) {
        await tx.attachment.create({
          data: {
            id: a.id, filename: a.filename, originalName: a.originalName, mimeType: a.mimeType,
            size: a.size, path: a.path, pageId: a.pageId || null, spaceId: a.spaceId,
            uploadedById: a.uploadedById, createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
          },
        });
        count++;
      }
    }

    // Restore comments
    if (d.comments?.length) {
      for (const c of d.comments) {
        await tx.comment.create({
          data: {
            id: c.id, pageId: c.pageId, authorId: c.authorId, content: c.content,
            createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
          },
        });
        count++;
      }
    }

    // Restore templates
    if (d.templates?.length) {
      for (const t of d.templates) {
        // createdById is required — skip template if missing
        if (!t.createdById) continue;
        await tx.template.create({
          data: {
            id: t.id, title: t.title || t.name, description: t.description || null, content: t.content || {},
            icon: t.icon || null, category: t.category || 'custom',
            createdById: t.createdById,
            createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
          },
        });
        count++;
      }
    }
  }, { timeout: 120000 });

  return { restored: count };
}

export function cleanupDumpFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
