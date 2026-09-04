import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SCHEDULE_OVERRIDES, parseConstitution } from '../../scripts/extract/parse';
import { validateConstitution } from '../../scripts/extract/validate';
import { crosscheckArticles } from '../../scripts/extract/crosscheck';
import { ArticleSchema } from '../../src/lib/schemas';

const raw = readFileSync('data/processed/raw.txt', 'utf8');
const parsed = parseConstitution(raw, { scheduleOverrides: SCHEDULE_OVERRIDES });

describe('full document extraction', () => {
  test('article count falls in the sanity band', () => {
    expect(parsed.articles.length).toBeGreaterThanOrEqual(440);
    expect(parsed.articles.length).toBeLessThanOrEqual(500);
  });

  test('every article listed in the table of contents exists in the parse', () => {
    // The table of contents is the edition's own list of articles. Nine
    // articles (174, 228A, 238, 239A, 268A, 359A, 370, 371D, 371F) were lost
    // to PDF text layer quirks before this gate existed; it exists so no
    // edition or parser change can silently drop an article again.
    const lines = raw.split('\n');
    const preambleStart = lines.findIndex((l) => l.startsWith('WE, THE PEOPLE'));
    const tocNumbers = new Set<string>();
    for (const line of lines.slice(0, preambleStart)) {
      const match = /^\[?(\d{1,3}[A-Z]?)\.$/.exec(line.trim());
      if (match) tocNumbers.add(match[1] as string);
    }
    expect(tocNumbers.size).toBeGreaterThan(400);
    const parsedNumbers = new Set(parsed.articles.map((a) => a.number));
    expect(
      [...tocNumbers].filter((n) => !parsedNumbers.has(n)),
      'articles in TOC but missing from parse',
    ).toEqual([]);
  });

  test('the nine recovered articles carry their titles', () => {
    const expected: Array<[string, string]> = [
      ['174', 'Sessions of the State Legislature'],
      ['228A', 'disposal of questions'],
      ['239A', 'Creation of local Legislatures'],
      ['268A', 'Service tax'],
      ['359A', 'State of Punjab'],
      ['370', 'State of Jammu'],
      ['371D', 'State of Andhra'],
      ['371F', 'State of Sikkim'],
    ];
    for (const [number, fragment] of expected) {
      expect(parsed.articles.find((a) => a.number === number)?.title, `article ${number}`).toContain(fragment);
    }
    expect(parsed.articles.find((a) => a.number === '238')?.status).toBe('omitted');
  });

  test('part count falls in the sanity band', () => {
    expect(parsed.parts.length).toBeGreaterThanOrEqual(24);
    expect(parsed.parts.length).toBeLessThanOrEqual(26);
  });

  test('schedule count falls in the sanity band', () => {
    expect(parsed.schedules.length).toBeGreaterThanOrEqual(10);
    expect(parsed.schedules.length).toBeLessThanOrEqual(12);
  });

  test('every article validates against the schema', () => {
    for (const article of parsed.articles) {
      expect(ArticleSchema.safeParse(article).success, `article ${article.number} failed schema`).toBe(true);
    }
  });

  test('every article references an existing part', () => {
    const partNumbers = new Set(parsed.parts.map((p) => p.number));
    for (const article of parsed.articles) {
      expect(partNumbers.has(article.part), `article ${article.number} references unknown part ${article.part}`).toBe(
        true,
      );
    }
  });

  test('landmark articles are present with correct titles', () => {
    expect(parsed.articles.find((a) => a.number === '14')?.title).toContain('Equality before law');
    expect(parsed.articles.find((a) => a.number === '51A')?.title).toContain('Fundamental duties');
    expect(parsed.articles.find((a) => a.number === '368')?.title).toContain('Power of Parliament');
  });

  test('preamble is captured whole', () => {
    expect(parsed.preamble).toContain('SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC');
    expect(parsed.preamble).toContain('twenty-sixth day of');
    expect(parsed.preamble).toContain('THIS CONSTITUTION');
  });

  test('omitted articles are detected', () => {
    const omitted = parsed.articles.filter((a) => a.status === 'omitted');
    expect(omitted.length).toBeGreaterThan(5);
    expect(omitted.map((a) => a.number)).toContain('31');
  });

  test('validator reports no errors', () => {
    const result = validateConstitution(parsed);
    expect(result.errors).toEqual([]);
  });
});

describe('cross check against the MIT licensed 2019 dataset', () => {
  test('flags only a minority of common articles as divergent', () => {
    const path = 'data/crosscheck/yash-handa-2019.json';
    if (!existsSync(path)) return; // crosscheck is optional; skip when not vendored
    const result = crosscheckArticles(parsed, JSON.parse(readFileSync(path, 'utf8')));
    // The vendored dataset ships Part III text only (~43 entries), so common is
    // bounded by its coverage, not by our article count. Divergence on 2A, 31,
    // and 31D is expected: the 2019 text predates their omissions.
    expect(result.common).toBeGreaterThanOrEqual(20);
    expect(result.missingInPdf).toEqual(['0']); // '0' is the dataset's preamble placeholder
    expect(result.flagged.length / Math.max(result.common, 1)).toBeLessThan(0.35);
  });
});
