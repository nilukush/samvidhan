import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { syncCollections } from '../../scripts/sync-collections.ts';

const fixturePath = 'tests/fixtures/sync/minimal.json';
const workDir = mkdtempSync(join(tmpdir(), 'samvidhan-sync-'));
const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const writeFixture = (name: string, data: unknown): string => {
  const path = join(workDir, `${name}.json`);
  writeFileSync(path, JSON.stringify(data));
  return path;
};

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('collection sync', () => {
  test('creates the expected collection entries from a valid dataset', () => {
    const outDir = join(workDir, 'ok');
    const result = syncCollections(fixturePath, outDir);
    expect(result).toEqual({ articles: 3, parts: 2, schedules: 1 });
    expect(readdirSync(join(outDir, 'articles')).sort()).toEqual(['14.json', '15.json', '51A.json']);
    const article14 = load(join(outDir, 'articles', '14.json')) as Record<string, unknown>;
    expect(article14['number']).toBe('14');
    expect(article14['section']).toBe('Right to Equality');
  });

  test('aborts and names the entry and field when one entry is invalid', () => {
    const data = load(fixturePath) as { articles: Array<Record<string, unknown>> };
    data.articles[0]!.status = 'deleted';
    const path = writeFixture('invalid', data);
    expect(() => syncCollections(path, join(workDir, 'invalid-out'))).toThrowError(/articles\/14.*status/s);
  });

  test('aborts when an article references a missing part', () => {
    const data = load(fixturePath) as { articles: Array<Record<string, unknown>> };
    data.articles[2]!.part = '99';
    const path = writeFixture('missing-part', data);
    expect(() => syncCollections(path, join(workDir, 'missing-part-out'))).toThrowError(/51A.*part 99/s);
  });

  test('is idempotent: resyncing writes identical files with no duplicates', () => {
    const outDir = join(workDir, 'idempotent');
    syncCollections(fixturePath, outDir);
    const before = readdirSync(join(outDir, 'articles'))
      .sort()
      .map((f) => [f, readFileSync(join(outDir, 'articles', f), 'utf8')]);
    syncCollections(fixturePath, outDir);
    const after = readdirSync(join(outDir, 'articles'))
      .sort()
      .map((f) => [f, readFileSync(join(outDir, 'articles', f), 'utf8')]);
    expect(after).toEqual(before);
  });
});
