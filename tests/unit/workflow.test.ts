import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

type Step = { uses?: unknown; run?: unknown };

const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as Record<string, unknown>;
// YAML 1.1 parsers coerce the `on` key to boolean true; the 1.2 `yaml` package keeps it a string.
const triggers = (workflow['on'] ?? workflow['true']) as Record<string, unknown> | undefined;
const jobs = (workflow['jobs'] ?? {}) as Record<string, { steps?: Step[] }>;
const steps = Object.values(jobs)[0]?.steps ?? [];
const runs = steps.map((s) => (typeof s.run === 'string' ? s.run : '')).filter((r) => r !== '');

describe('CI workflow', () => {
  test('triggers on push and pull request', () => {
    expect(triggers?.['push']).toBeDefined();
    expect(triggers?.['pull_request']).toBeDefined();
  });

  test('checks out the repo and sets up node', () => {
    expect(steps.some((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/checkout'))).toBe(true);
    expect(steps.some((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node'))).toBe(true);
  });

  test('installs, lints, tests, and builds', () => {
    expect(runs.some((r) => r.includes('npm ci'))).toBe(true);
    expect(runs.some((r) => r.includes('npm run lint'))).toBe(true);
    expect(runs.some((r) => r.includes('npm test'))).toBe(true);
    expect(runs.some((r) => r.includes('npm run build'))).toBe(true);
  });
});
