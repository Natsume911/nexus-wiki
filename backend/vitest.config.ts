import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/helpers/setup.ts'],
    globalSetup: ['src/tests/helpers/globalSetup.ts'],
    testTimeout: 15000,
    pool: 'forks',
    // Single fork to avoid deadlocks on TRUNCATE
    maxConcurrency: 1,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/middleware/**', 'src/utils/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
