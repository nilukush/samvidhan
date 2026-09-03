import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('essentials page', () => {
  test('renders every curated entry with resolved links and the 106th caveat', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const html = readFileSync('dist/essentials/index.html', 'utf8');
    for (const needle of [
      'Essentials',
      'Fundamental Rights',
      'Directive Principles',
      'Fundamental duties',
      'How the Constitution changes',
      '42nd Amendment',
      '101st Amendment',
      'Part III',
      '334A',
      'inoperative',
      'href="/parts/3/"',
      'href="/amendments/106/"',
      'href="/preamble/"',
      'starting points',
      'verified',
    ]) {
      expect(html, `essentials page missing: ${needle}`).toContain(needle);
    }
  });
});
