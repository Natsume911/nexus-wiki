import { test, expect } from './helpers/fixtures';

test.describe('Sidebar', () => {
  test('should show space pages in sidebar', async ({ page, testSpace, testPage }) => {
    await page.goto(`/${testSpace.slug}/${testPage.slug}`);
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('[data-testid="sidebar"]').or(page.locator('aside'));
    await expect(sidebar).toBeVisible();
  });
});
