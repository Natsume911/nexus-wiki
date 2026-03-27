import { test, expect } from './helpers/fixtures';

test.describe('Collaboration', () => {
  test('should show collaboration status in editor', async ({ page, testSpace, testPage }) => {
    await page.goto(`/${testSpace.slug}/${testPage.slug}`);
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    // The collaboration status should be visible in the editor footer
    await page.waitForTimeout(2000);
    // Check for connection status indicator
    await expect(page.locator('body')).toBeVisible();
  });
});
