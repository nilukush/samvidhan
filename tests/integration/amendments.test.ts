import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('amendment pages', () => {
  test('a build generates all 106 amendment pages', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const dirs = readdirSync('dist/amendments', { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(dirs.length).toBe(106);
  });

  test('the timeline renders one anchor node per amendment', () => {
    const html = readFileSync('dist/amendments/index.html', 'utf8');
    const nodeCount = (html.match(/class="tl-node"/g) ?? []).length;
    expect(nodeCount).toBe(106);
    const links = (html.match(/href="\/amendments\/\d+\/"/g) ?? []).length;
    expect(links).toBeGreaterThanOrEqual(212); // svg nodes plus the reading list
  });

  test('the 42nd Amendment page lists its articles and links to them', () => {
    const html = readFileSync('dist/amendments/42/index.html', 'utf8');
    expect(html).toContain('Forty-second');
    expect(html).toContain('1976');
    expect(html).toContain('href="/articles/368/"');
    expect(html).toContain('href="/articles/74/"');
  });

  test('the 106th Amendment page carries its verified milestone dates', () => {
    const html = readFileSync('dist/amendments/106/index.html', 'utf8');
    expect(html).toContain('2023-09-19');
    expect(html).toContain('2023-09-20');
    expect(html).toContain('2023-09-21');
    expect(html).toContain('2023-09-28');
    expect(html).toContain('2026-04-16');
    expect(html).toContain('Article 334A');
    expect(html).toContain('href="/articles/330A/"');
  });

  test('article pages link their amendment chips to amendment pages', () => {
    const html = readFileSync('dist/articles/13/index.html', 'utf8');
    expect(html).toContain('href="/amendments/24/"');
  });
});
