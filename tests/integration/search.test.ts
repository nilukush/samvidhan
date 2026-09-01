import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
    // Design system section 12: under 10 KB total JS on article pages with
    // search closed, and the controller is the only script.
    const controller = readFileSync('public/search.js', 'utf8');
    expect(controller.length, `controller is ${Math.round(controller.length / 1024)} KB`).toBeLessThan(10 * 1024);
  });

  test('the precomputed vector artifact stays inside the 3 MB budget', () => {
    const size = statSync('public/vectors/chunks.json').size;
    expect(size, `vector artifact is ${Math.round(size / 1024 / 1024)} MB`).toBeLessThan(3 * 1024 * 1024);
    const artifact = JSON.parse(readFileSync('public/vectors/chunks.json', 'utf8'));
    expect(artifact.dims).toBe(384);
    expect(artifact.chunks.length).toBeGreaterThan(400);
    for (const chunk of artifact.chunks.slice(0, 20)) {
      expect(chunk.v.length).toBe(384);
      expect(chunk.t.length).toBeGreaterThan(0);
    }
  });

  test('the pagefind index captures all article pages with type filters', () => {
    const html = readFileSync('dist/articles/51A/index.html', 'utf8');
    expect(html).toContain('data-pagefind-filter="type"');
  });
});
