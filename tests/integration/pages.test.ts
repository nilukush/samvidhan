import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const constitution = JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as {
  articles: Array<{ number: string }>;
  schedules: Array<{ number: number }>;
  parts: Array<{ number: string }>;
};

/** Head and style stripped, so assertions see page markup, not CSS selectors. */
function bodyMarkup(path: string): string {
  const html = readFileSync(path, 'utf8');
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

describe('generated pages', () => {
  test('a build generates one page per article, matching the source data', () => {
    rmSync('dist', { recursive: true, force: true });
    execSync('npm run build', { stdio: 'pipe' });
    const articleDirs = readdirSync('dist/articles', { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(articleDirs.length).toBe(constitution.articles.length);
  });

  test('article pages contain the full legal text in static HTML, cleaned of markers', () => {
    const markup = bodyMarkup('dist/articles/14/index.html');
    expect(markup).toContain('equality before the law or the equal protection of the laws');
    expect(markup).not.toMatch(/\d{1,2}\[/);
    expect(markup).not.toContain('<script');
  });

  test('part, schedule, and preamble pages exist with content', () => {
    expect(existsSync('dist/parts/index.html')).toBe(true);
    const part3 = readFileSync('dist/parts/3/index.html', 'utf8');
    expect(part3).toContain('FUNDAMENTAL RIGHTS');
    expect(part3).toContain('Equality before law');

    for (const schedule of constitution.schedules) {
      expect(existsSync(`dist/schedules/${schedule.number}/index.html`), `schedule ${schedule.number}`).toBe(true);
    }

    const preamble = bodyMarkup('dist/preamble/index.html');
    expect(preamble).toContain('SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC');
    expect(preamble).not.toMatch(/\d{1,2}\[/);
  });

  test('page weight stays inside the 60 KB html budget', () => {
    const heavyPages = [
      'dist/articles/index.html',
      'dist/articles/19/index.html',
      'dist/articles/368/index.html',
      'dist/schedules/9/index.html',
    ];
    for (const page of heavyPages) {
      const size = statSync(page).size;
      expect(size, `${page} is ${Math.round(size / 1024)} KB`).toBeLessThan(60 * 1024);
    }
  });
});
