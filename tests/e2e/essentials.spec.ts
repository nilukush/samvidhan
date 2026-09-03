import { expect, test } from '@playwright/test';

test.describe('essentials', () => {
  test('the header and footer link to the essentials page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Essentials', exact: true }).first().click();
    // The preview server serves the slashless form; production redirects to the
    // trailing slash. Both are the same page, so accept either.
    await expect(page).toHaveURL(/\/essentials\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Essentials' })).toBeVisible();
  });

  test('lists the starting points with links into the full text', async ({ page }) => {
    await page.goto('/essentials/');
    await expect(page.getByRole('heading', { level: 1, name: 'Essentials' })).toBeVisible();
    const cards = page.locator('.essential-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(8);
    await expect(page.locator('.essential-card').first().getByRole('link')).toHaveAttribute('href', '/preamble/');
  });

  test('the 106th Amendment entry states the reservation is inoperative', async ({ page }) => {
    await page.goto('/essentials/');
    const main = await page.locator('main').innerText();
    expect(main).toContain('inoperative');
    expect(main).toContain('334A');
    expect(main).toContain('16 April 2026');
  });

  test('every ref link on the page resolves to a real page', async ({ page }) => {
    await page.goto('/essentials/');
    const hrefs = await page
      .locator('.ref-links a')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      const response = await page.request.get(href!);
      expect(response.status(), `${href} should resolve`).toBe(200);
    }
  });
});
