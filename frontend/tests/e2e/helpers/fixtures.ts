import { test as base } from '@playwright/test';
import { createTestSpace, createTestPage, deleteTestSpace } from './api';

interface TestFixtures {
  testSpace: { id: string; slug: string; name: string };
  testPage: { id: string; slug: string; title: string };
}

export const test = base.extend<TestFixtures>({
  testSpace: async ({}, use) => {
    const space = await createTestSpace(`E2E Space ${Date.now()}`);
    await use(space);
    await deleteTestSpace(space.id);
  },
  testPage: async ({ testSpace }, use) => {
    const page = await createTestPage(testSpace.slug, `E2E Page ${Date.now()}`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
