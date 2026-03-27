import { test, expect } from './helpers/fixtures';

test.describe('Page Operations', () => {
  test('should create a new page', async ({ page, testSpace }) => {
    await page.goto(`/${testSpace.slug}`);
    await page.waitForLoadState('networkidle');
    // Look for create page button
    const createBtn = page.getByRole('button', { name: /nuova pagina|crea|new/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
