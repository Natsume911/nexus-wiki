import { beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Override DATABASE_URL for test DB BEFORE anything imports prisma
const baseUrl = process.env.DATABASE_URL || 'postgresql://nexus:nexus_secret_change_me@localhost:5433/nexus';
process.env.DATABASE_URL = baseUrl.replace(/\/nexus(\?|$)/, '/nexus_test$1');
process.env.NODE_ENV = 'test';
process.env.DEV_USER_EMAIL = 'test@nexus.dev';
process.env.REDIS_URL = ''; // Disable Redis in tests

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

beforeEach(async () => {
  // Truncate all tables sequentially to avoid deadlocks
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`
  );
  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
