import { expect, test } from '@playwright/test';

test.describe('base layout', () => {
  test('header renders wordmark, primary nav, and search trigger on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Samvidhan' })).toBeVisible();
    for (const label of ['Preamble', 'Articles', 'Parts', 'Schedules', 'Amendments', 'Changes']) {
      await expect(page.getByRole('navigation').getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('banner').getByRole('link', { name: /search/i })).toBeVisible();
  });

  test('header collapses to a labeled menu control below 48rem', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeHidden();
    // Chromium exposes a closed details summary as a group, not a button, so
    // target the native summary control directly.
    const menuControl = page.getByRole('banner').locator('summary');
    await expect(menuControl).toBeVisible();
    await menuControl.click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Articles' })).toBeVisible();
  });

  test('skip link is the first focusable element and jumps to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main');
    await expect(focused).toContainText(/skip to main content/i);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('footer carries the three link groups and attribution', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const label of ['Explore', 'About', 'The Record']) {
      await expect(footer.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(footer).toContainText(/public domain/i);
  });

  test('cumulative layout shift stays under 0.1 on a cold load', async ({ page }) => {
    const shifts: number[] = [];
    await page.addInitScript(() => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) shifts.push(shift.value);
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      (window as unknown as Record<string, unknown>)['__shifts'] = shifts;
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const total = (await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts)) ?? [];
    const cls = total.reduce((sum, value) => sum + value, 0);
    expect(cls).toBeLessThan(0.1);
  });

  test('fonts are self hosted: no requests leave the site and families load', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (host !== '127.0.0.1' && host !== 'localhost') external.push(request.url());
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
    const publicSans = await page.evaluate(() => document.fonts.check('16px "Public Sans"'));
    expect(publicSans).toBe(true);
  });
});
