import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { HindiFileSchema } from '../../src/lib/schemas/index';
import { lintDevanagari } from '../../src/lib/devanagari';

const hindi = HindiFileSchema.parse(JSON.parse(readFileSync('data/processed/constitution-hindi.json', 'utf8')));
const english = JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as {
  articles: Array<{ number: string }>;
  parts: Array<{ number: string }>;
};

describe('hindi edition data', () => {
  test('carries exactly the English edition article set: all 504', () => {
    const hindiSet = new Set(hindi.articles.map((article) => article.number));
    const englishSet = new Set(english.articles.map((article) => article.number));
    expect([...englishSet].filter((number) => !hindiSet.has(number))).toEqual([]);
    expect(hindi.articles.length).toBe(english.articles.length);
  });

  test('carries exactly the English edition part set: all 26', () => {
    const hindiSet = new Set(hindi.parts.map((part) => part.number));
    const englishSet = new Set(english.parts.map((part) => part.number));
    expect([...englishSet].filter((number) => !hindiSet.has(number))).toEqual([]);
    expect(hindi.parts.length).toBe(26);
  });

  test('every article references a known part', () => {
    const partIds = new Set(hindi.parts.map((part) => part.number));
    const orphans = hindi.articles.filter((article) => !partIds.has(article.part));
    expect(orphans.map((article) => article.number)).toEqual([]);
  });

  test('the preamble field equals the human-approved Preamble text', () => {
    const approved = JSON.parse(readFileSync('src/data/hindi/preamble.json', 'utf8')) as { text: string };
    expect(hindi.preamble).toBe(approved.text);
  });

  test('letter-suffixed articles carry their Devanagari number forms', () => {
    const numberHi = new Set(hindi.articles.map((article) => article.numberHi));
    expect(numberHi.has('21क')).toBe(true);
    expect(numberHi.has('243यक')).toBe(true);
    expect(numberHi.has('243यञ')).toBe(true);
  });

  test('linter residue on the assembled corpus stays inside the review bound', () => {
    // The residue is the known-unrepairable word set, listed article by
    // article in docs/HINDI-SPOTCHECK.md. The bound makes any NEW class of
    // corruption fail loudly instead of shipping silently.
    const issues = hindi.articles.flatMap((article) =>
      lintDevanagari(article.clauses.map((clause) => clause.text).join(' ')).map((issue) => ({
        article: article.number,
        rule: issue.rule,
      })),
    );
    if (issues.length > 0) {
      console.warn(`hindi corpus linter residue (${issues.length}): ${JSON.stringify(issues.slice(0, 30))}`);
    }
    expect(issues.length).toBeLessThanOrEqual(30);
  });
});
