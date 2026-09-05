import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The rollout is complete: every article of the Constitution carries an
// explainer. The data files are the source of truth; if a future edition
// adds articles without explainers, the fallback article is the first
// uncovered one, and the no-box test applies again.
const explainers = JSON.parse(readFileSync('data/processed/explainers/explainers.json', 'utf8')) as Record<
  string,
  string
>;
const constitution = JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as {
  articles: Array<{ number: string }>;
};
const uncovered = constitution.articles.filter((article) => !(article.number in explainers));

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
    expect(boxTop!.y).toBeGreaterThan((clausesBottom?.y ?? 0) + (clausesBottom?.height ?? 0) - 1);
  });

  test('the rollout covers every article, or the uncovered one renders no box', async ({ page }) => {
    if (uncovered.length === 0) {
      // Complete rollout: every article page must render the box.
      const sample = ['395', '393', '394', '370'];
      for (const number of sample) {
        await page.goto(`/articles/${number}/`);
        await expect(page.getByRole('region', { name: 'What it means' })).toBeVisible();
      }
      return;
    }
    const bareArticle = uncovered[0]!.number;
    await page.goto(`/articles/${bareArticle.toLowerCase()}/`);
    await expect(page.getByRole('region', { name: 'What it means' })).toHaveCount(0);
  });

  test('omitted articles keep their explainer alongside the omission note', async ({ page }) => {
    await page.goto('/articles/31/');
    await expect(page.getByRole('region', { name: 'What it means' })).toBeVisible();
    await expect(page.getByText(/no longer forms part of the Constitution/)).toBeVisible();
  });
});
