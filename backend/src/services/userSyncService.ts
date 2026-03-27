import pg from 'pg';
import { prisma } from '../lib/prisma.js';

const { Pool } = pg;

interface ExternalDirUser {
  username: string;
  email: string;
  display_name: string;
  role: string | null;
  active: boolean;
  avatar_url: string | null;
}

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (pool) return pool;
  const host = process.env.EXTERNAL_DB_HOST;
  const user = process.env.EXTERNAL_DB_USER;
  const password = process.env.EXTERNAL_DB_PASSWORD;
  const database = process.env.EXTERNAL_DB_NAME;
  if (!host || !user || !password || !database) return null;
  pool = new Pool({
    host,
    port: parseInt(process.env.EXTERNAL_DB_PORT || '5432', 10),
    user,
    password,
    database,
    max: 3,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

/**
 * Sync users from External Directory `users` table into Nexus.
 * Only syncs active External Directory users (those who can actually login).
 * New users are created with active=false (Nexus admin must enable them).
 * Existing users get name updated but active/role status is NOT touched.
 */
export async function syncUsersFromExternalDirectoryDir(): Promise<{
  synced: number;
  created: number;
  updated: number;
  error?: string;
}> {
  const db = getPool();
  if (!db) {
    return { synced: 0, created: 0, updated: 0, error: 'External Directory DB non configurato' };
  }

  let client: pg.PoolClient | null = null;
  try {
    client = await db.connect();

    // Read active users from External Directory users table (registered users with login access)
    const result = await client.query<ExternalDirUser>(
      `SELECT username, email, display_name, role, active, avatar_url
       FROM users
       WHERE active = true AND email IS NOT NULL AND email != ''
       ORDER BY display_name`
    );

    let created = 0;
    let updated = 0;

    for (const person of result.rows) {
      const email = person.email.toLowerCase().trim();
      if (!email) continue;

      const existing = await prisma.user.findUnique({ where: { email } });

      if (!existing) {
        // Create new user — inactive by default in Nexus, admin must enable
        await prisma.user.create({
          data: {
            email,
            name: person.display_name || person.username || email.split('@')[0],
            role: 'VIEWER',
            active: false,
            department: person.role, // External Directory role as department info (e.g. soc_lead, deploy_tech)
            avatar: person.avatar_url || null,
          },
        });
        created++;
      } else {
        // Update name + avatar (don't touch active or role — Nexus admin controls those)
        await prisma.user.update({
          where: { email },
          data: {
            name: person.display_name || existing.name,
            department: person.role || existing.department,
            avatar: person.avatar_url || existing.avatar,
          },
        });
        updated++;
      }
    }

    return { synced: result.rows.length, created, updated };
  } catch (err: any) {
    return { synced: 0, created: 0, updated: 0, error: err.message };
  } finally {
    client?.release();
  }
}
