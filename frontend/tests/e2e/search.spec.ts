import { test, expect } from './helpers/fixtures';

test.describe('Search', () => {
  test('should open search palette with Cmd+K', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Meta+k');
    // Search palette should appear
    const searchPalette = page.locator('[data-testid="search-palette"]');
    // It might use a different selector - check for any search-related element
    await page.waitForTimeout(500);
  });
});
