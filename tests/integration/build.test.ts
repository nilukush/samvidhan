import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('astro build', () => {
  test('produces dist/index.html from a clean state', () => {
    rmSync('dist', { recursive: true, force: true });
    execSync('npm run build', { stdio: 'pipe' });
    expect(existsSync('dist/index.html')).toBe(true);
  });
});
