import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { syncCollections } from '../../scripts/sync-collections.ts';
import { ArticleSchema, PartSchema, ScheduleSchema } from '../../src/lib/schemas/index.ts';

const source = 'data/processed/constitution.json';
const workDir = mkdtempSync(join(tmpdir(), 'samvidhan-sync-real-'));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('syncing the real extracted constitution', () => {
  test.skipIf(!existsSync(source))('writes every article, part, and schedule, all schema valid', () => {
    const result = syncCollections(source, workDir);
    expect(result.articles).toBeGreaterThanOrEqual(440);
    expect(result.articles).toBeLessThanOrEqual(500);
    expect(result.parts).toBeGreaterThanOrEqual(24);
    expect(result.schedules).toBeGreaterThanOrEqual(10);

    for (const file of readdirSync(join(workDir, 'articles'))) {
      const entry = JSON.parse(readFileSync(join(workDir, 'articles', file), 'utf8'));
      expect(ArticleSchema.safeParse(entry).success, `${file} failed schema`).toBe(true);
    }
    for (const file of readdirSync(join(workDir, 'parts'))) {
      const entry = JSON.parse(readFileSync(join(workDir, 'parts', file), 'utf8'));
      expect(PartSchema.safeParse(entry).success, `${file} failed schema`).toBe(true);
    }
    for (const file of readdirSync(join(workDir, 'schedules'))) {
      const entry = JSON.parse(readFileSync(join(workDir, 'schedules', file), 'utf8'));
      expect(ScheduleSchema.safeParse(entry).success, `${file} failed schema`).toBe(true);
    }
  });
});
