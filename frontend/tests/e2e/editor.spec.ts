import { test, expect } from './helpers/fixtures';

test.describe('Editor', () => {
  test('should load editor on page view', async ({ page, testSpace, testPage }) => {
    await page.goto(`/${testSpace.slug}/${testPage.slug}`);
    // Wait for editor to load
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    await expect(page.locator('.ProseMirror')).toBeVisible();
  });

  test('should type text in editor', async ({ page, testSpace, testPage }) => {
    await page.goto(`/${testSpace.slug}/${testPage.slug}`);
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('Hello Nexus', { delay: 50 });
    await expect(editor).toContainText('Hello Nexus');
  });
});
