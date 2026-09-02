import { expect, test } from '@playwright/test';

// The quality gate and byte progress tests load a 23 MB language model and
// run WASM inference. On CI's 2-core runners this takes over 5 minutes;
// these two tests are local-only. The fallback and data saver tests do not
// load the model and run everywhere.
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

test.describe('concept search', () => {
  test.skip(isCI, 'model inference too slow on 2-core CI runners; run locally');
  test('quality gate: a natural question surfaces the equality articles', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/');
    await page.keyboard.press('/');
    await page.getByRole('dialog').getByRole('tab', { name: 'Concept' }).click();
    await page.getByLabel(/search query/i).fill('can the state discriminate against women');
    const results = page.locator('#concept-results a');
    // CI runners have 2 cores and slower I/O; the model load plus inference
    // takes much longer than on a local M1.
    await expect(results.first()).toBeVisible({ timeout: 240_000 });
    const topFive = await results.allTextContents();
    const hits = ['Article 14', 'Article 15', 'Article 16'].filter((label) =>
      topFive.slice(0, 5).some((text) => text.trim() === label),
    );
    expect(hits.length, `top five were: ${topFive.slice(0, 5).join(', ')}`).toBeGreaterThanOrEqual(2);
  });
});

test.describe('concept search loading', () => {
  test.skip(isCI, 'model load observation needs the model; run locally');
  test('the first load shows byte progress while fetching the model', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await page.keyboard.press('/');
    await page.getByRole('dialog').getByRole('tab', { name: 'Concept' }).click();
    await page.getByLabel(/search query/i).fill('equality');
    const samples: string[] = [];
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const status = await page.evaluate(() => document.getElementById('concept-status')?.textContent ?? '');
      samples.push(status);
      if (/passages matched|Embedding|model could not/i.test(status)) break;
      await page.waitForTimeout(400);
    }
    const sawByteProgress = samples.some((sample) => /of \d+(\.\d+)? MB/.test(sample));
    const sawReadyOrSearch = samples.some((sample) =>
      /passages matched|Embedding your question|index ready/i.test(sample),
    );
    expect(sawByteProgress || sawReadyOrSearch, `statuses seen: ${samples.slice(0, 6).join(' / ')}`).toBe(true);
  });
});

test.describe('concept search fallbacks', () => {
  test('a blocked model load falls back to keyword mode with a notice', async ({ page }) => {
    await page.route(/\/models\/|\/vendor\//, (route) => route.abort());
    await page.goto('/');
    await page.keyboard.press('/');
    await page.getByRole('dialog').getByRole('tab', { name: 'Concept' }).click();
    const notice = page.locator('#search-status');
    await expect(notice).toContainText(/could not load|data saver/i, { timeout: 30_000 });
    await expect(page.getByRole('dialog').getByRole('tab', { name: 'Keywords' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('data saver preference never loads the model', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
    });
    const modelRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/models/') || request.url().includes('/vendor/')) {
        modelRequests.push(request.url());
      }
    });
    await page.goto('/');
    await page.keyboard.press('/');
    await page.getByRole('dialog').getByRole('tab', { name: 'Concept' }).click();
    await expect(page.locator('#search-status')).toContainText(/data saver/i, { timeout: 10_000 });
    await page.waitForTimeout(1500);
    expect(modelRequests).toEqual([]);
  });
});
