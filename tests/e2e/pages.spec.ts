import { expect, test } from '@playwright/test';

test.describe('core reading journey', () => {
  test('reaches an article from the home page in three clicks', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('main')
      .getByRole('link', { name: /^Parts\b/ })
      .click();
    await expect(page).toHaveURL(/\/parts\/$/);
    await page.getByRole('link', { name: /Fundamental Rights/i }).click();
    await expect(page).toHaveURL(/\/parts\/3\/$/);
    await page.getByRole('link', { name: /^14\. Equality before law\./ }).click();
    await expect(page).toHaveURL(/\/articles\/14\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Equality before law/ })).toBeVisible();
  });

  test('prev and next cross part boundaries in document order', async ({ page }) => {
    await page.goto('/articles/35/');
    await page.getByRole('link', { name: /Next article/ }).click();
    await expect(page).toHaveURL(/\/articles\/36\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Article 36/ })).toBeVisible();

    await page.goto('/articles/1/');
    await expect(page.getByRole('link', { name: /Previous article/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Next article/ })).toBeVisible();
  });

  test('omitted articles show the red badge with the year of omission', async ({ page }) => {
    await page.goto('/articles/31/');
    const badge = page.getByText('Omitted 1978');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCSS('background-color', 'rgb(253, 236, 234)');
  });

  test('breadcrumbs render the full path on article pages', async ({ page }) => {
    await page.goto('/articles/14/');
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Parts' })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Part III: FUNDAMENTAL RIGHTS' })).toHaveAttribute(
      'href',
      '/parts/3/',
    );
  });

  test('article pages do not overflow horizontally on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const article of ['1', '14', '19', '243ZH', '368', '395']) {
      await page.goto(`/articles/${article}/`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `article ${article} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('preamble and schedule pages render their content', async ({ page }) => {
    await page.goto('/preamble/');
    await expect(page.getByRole('heading', { level: 1, name: 'Preamble' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC');

    await page.goto('/schedules/1/');
    await expect(page.getByRole('heading', { level: 1, name: /First Schedule/i })).toBeVisible();
  });
});
