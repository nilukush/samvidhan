import { expect, test } from '@playwright/test';

test.describe('upcoming changes table', () => {
  test('cells run left to right in DOM order, so reading order matches sight', async ({ page }) => {
    await page.goto('/changes/upcoming/');
    const orderOk = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('tbody tr')];
      return rows.every((row) => {
        const cells = [...row.querySelectorAll('th, td')];
        const xs = cells.map((cell) => (cell as HTMLElement).getBoundingClientRect().left);
        return xs.every((x, index) => index === 0 || x >= xs[index - 1]!);
      });
    });
    expect(orderOk).toBe(true);
  });

  test('the verified banner states the latest check date and links live sources', async ({ page }) => {
    await page.goto('/changes/upcoming/');
    const banner = page.getByRole('note');
    await expect(banner).toContainText(/31 August 2026/);
    await expect(banner.getByRole('link', { name: /sansad\.in/i })).toHaveAttribute(
      'href',
      'https://sansad.in/ls/legislation/bills',
    );
    await expect(banner.getByRole('link', { name: /PRS India/i })).toHaveAttribute(
      'href',
      'https://prsindia.org/billtrack',
    );
  });

  test('status pills use the semantic token colors', async ({ page }) => {
    await page.goto('/changes/upcoming/');
    const pending = page.locator('.pill-pending').first();
    await expect(pending).toHaveCSS('background-color', 'rgb(255, 243, 214)');
    const rejected = page.locator('.pill-rejected').first();
    await expect(rejected).toHaveCSS('background-color', 'rgb(253, 236, 234)');
  });

  test('each bill row links to its source', async ({ page }) => {
    await page.goto('/changes/upcoming/');
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const sourceLink = rows.nth(i).getByRole('link', { name: /source/i });
      await expect(sourceLink).toHaveAttribute('href', /^https:\/\//);
    }
  });
});
