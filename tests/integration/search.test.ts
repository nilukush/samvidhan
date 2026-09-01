import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('pagefind integration', () => {
  test('the build indexes the site and ships the pagefind bundle', () => {
    execSync('npm run build', { stdio: 'pipe' });
    expect(existsSync('dist/pagefind/pagefind.js')).toBe(true);
    const index = readFileSync('dist/pagefind/pagefind-entry.json', 'utf8');
    expect(index).toBeTruthy();
  });

  test('article pages carry the dialog markup and stay inside the script budget closed', () => {
    const html = readFileSync('dist/articles/14/index.html', 'utf8');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('id="search-input"');

    // One shared, cacheable controller script; nothing else loads until open.
    const srcScripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)];
    expect(srcScripts.length).toBe(1);
    expect(srcScripts[0]?.[1]).toBe('/search.js');
    const controller = readFileSync('public/search.js', 'utf8');
    expect(controller.length, `controller is ${Math.round(controller.length / 1024)} KB`).toBeLessThan(7 * 1024);
  });

  test('the pagefind index captures all article pages with type filters', () => {
    const html = readFileSync('dist/articles/51A/index.html', 'utf8');
    expect(html).toContain('data-pagefind-filter="type"');
  });
});
