import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  const baseUrl = process.env.DATABASE_URL || 'postgresql://nexus:nexus_secret_change_me@localhost:5433/nexus';
  const testUrl = baseUrl.replace(/\/nexus(\?|$)/, '/nexus_test$1');
  process.env.DATABASE_URL = testUrl;

  // Create test database via direct connection to postgres DB
  const adminUrl = baseUrl.replace(/\/nexus(\?|$)/, '/postgres$1');
  const adminPrisma = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await adminPrisma.$executeRawUnsafe('CREATE DATABASE nexus_test');
  } catch {
    // Already exists, that's fine
  } finally {
    await adminPrisma.$disconnect();
  }

  // Push schema to test DB (handles schema changes without migration history)
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: testUrl },
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  } catch (err: any) {
    console.error('Global setup - prisma db push error:', err?.stderr?.toString() || err);
  }

  // Install extensions
  const testPrisma = new PrismaClient({ datasourceUrl: testUrl });
  try {
    await testPrisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await testPrisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  } catch {
    // Extensions might already exist
  } finally {
    await testPrisma.$disconnect();
  }
}
