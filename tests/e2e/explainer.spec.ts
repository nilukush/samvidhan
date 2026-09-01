import { expect, test } from '@playwright/test';

test.describe('plain words explainers', () => {
  test('the box renders after the article text with the correct heading and label', async ({ page }) => {
    await page.goto('/articles/14/');
    const box = page.getByRole('region', { name: 'What it means' });
    await expect(box).toBeVisible();
    await expect(box.getByRole('heading', { level: 2, name: 'What it means' })).toBeVisible();
    await expect(box).toContainText('Plain words summary');
    await expect(box).toContainText('Not legal advice');

    const clausesBottom = await page.locator('ol.clauses').boundingBox();
    const boxTop = await box.boundingBox();
    expect(clausesBottom?.y).toBeDefined();
    expect(boxTop?.y).toBeDefined();
    expect(boxTop!.y).toBeGreaterThan(clausesBottom!.y + (clausesBottom!.height ?? 0) - 1);
  });

  test('articles outside the current batch render no box', async ({ page }) => {
    await page.goto('/articles/1/');
    await expect(page.getByRole('region', { name: 'What it means' })).toHaveCount(0);
  });

  test('omitted articles keep their explainer alongside the omission note', async ({ page }) => {
    await page.goto('/articles/31/');
    await expect(page.getByRole('region', { name: 'What it means' })).toBeVisible();
    await expect(page.getByText(/no longer forms part of the Constitution/)).toBeVisible();
  });
});
