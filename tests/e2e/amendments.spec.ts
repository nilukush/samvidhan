import { expect, test } from '@playwright/test';

test.describe('amendments timeline', () => {
  test('keyboard tab reaches every timeline node in document order', async ({ page }) => {
    await page.goto('/amendments/');

    // Tab past skip link, header, and nav until the first timeline node.
    let focused = '';
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.getAttribute('href') ?? '');
      if (/^\/amendments\/\d+\/$/.test(focused)) break;
    }
    expect(focused, 'never reached a timeline node by keyboard').toBe('/amendments/1/');

    for (let n = 1; n <= 106; n++) {
      const href = await page.evaluate(() => document.activeElement?.getAttribute('href') ?? '');
      expect(href, `expected focus on amendment ${n}`).toBe(`/amendments/${n}/`);
      if (n < 106) await page.keyboard.press('Tab');
    }
  });

  test('the 42nd Amendment page links through to its articles', async ({ page }) => {
    await page.goto('/amendments/42/');
    await expect(page.getByRole('heading', { level: 1, name: /Forty-second Amendment/ })).toBeVisible();
    await page.getByRole('link', { name: 'Article 368' }).click();
    await expect(page).toHaveURL(/\/articles\/368\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Power of Parliament/ })).toBeVisible();
  });

  test('timeline renders without animation under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/amendments/');
    await expect(page.locator('svg[role="img"]')).toBeVisible();
    expect(await page.locator('animate, animateTransform').count()).toBe(0);
  });
});
