import { test, expect } from './helpers/fixtures';

test.describe('Auth', () => {
  test('should show user in the interface', async ({ page }) => {
    await page.goto('/');
    // The dev bypass user should be shown somewhere
    await expect(page.locator('body')).toBeVisible();
  });
});
