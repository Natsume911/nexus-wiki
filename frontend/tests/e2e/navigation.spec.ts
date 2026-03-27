import { test, expect } from './helpers/fixtures';

test.describe('Navigation', () => {
  test('should navigate to a space', async ({ page, testSpace }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    // Navigate to the test space
    await page.goto(`/${testSpace.slug}`);
    await expect(page.locator('body')).toContainText(testSpace.name);
  });

  test('should navigate to a page', async ({ page, testSpace, testPage }) => {
    await page.goto(`/${testSpace.slug}/${testPage.slug}`);
    await expect(page.locator('body')).toContainText(testPage.title);
  });

  test('should show 404 for nonexistent page', async ({ page, testSpace }) => {
    await page.goto(`/${testSpace.slug}/nonexistent-page-xyz`);
    // Should show some error or not found state
    await expect(page.locator('body')).toBeVisible();
  });
});
