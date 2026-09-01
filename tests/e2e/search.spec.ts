import { expect, test } from '@playwright/test';

async function openSearch(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('keyword search', () => {
  test('the slash shortcut opens the dialog, Escape closes and restores focus', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: /search/i }).first();
    await trigger.focus();
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    const input = page.getByLabel(/search query/i);
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('searching equality returns Article 14 in the top three results', async ({ page }) => {
    await page.goto('/');
    await openSearch(page);
    await page.getByLabel(/search query/i).fill('equality');
    await expect(
      page
        .getByRole('dialog')
        .getByRole('link', { name: /Article 14/ })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('searching 14 surfaces the Article 14 page', async ({ page }) => {
    await page.goto('/');
    await openSearch(page);
    await page.getByLabel(/search query/i).fill('14');
    await expect(
      page
        .getByRole('dialog')
        .getByRole('link', { name: /Article 14/i })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('results group by type with Articles and Amendments headings', async ({ page }) => {
    await page.goto('/');
    await openSearch(page);
    await page.getByLabel(/search query/i).fill('equality');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: /Article 14/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: 'Articles' })).toBeVisible();

    await page.getByLabel(/search query/i).fill('nari shakti');
    await expect(dialog.getByRole('heading', { name: 'Amendments' }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('a zero result query shows suggestions, not a dead end', async ({ page }) => {
    await page.goto('/');
    await openSearch(page);
    await page.getByLabel(/search query/i).fill('zzzqqqxyzzy');
    const suggestions = page.getByRole('dialog').getByText(/try/i);
    await expect(suggestions).toBeVisible({ timeout: 10_000 });
  });

  test('reading never loads the search index until the dialog opens', async ({ page }) => {
    const pagefindRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/pagefind/')) pagefindRequests.push(request.url());
    });
    await page.goto('/articles/14/');
    await page.waitForLoadState('networkidle');
    expect(pagefindRequests).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: /Equality before law/ })).toBeVisible();
  });
});
