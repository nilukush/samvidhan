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

describe('hindi title repairs', () => {
  test('the five page-verified repaired titles are in place', () => {
    const byNumber = new Map(hindi.articles.map((article) => [article.number, article]));
    expect(byNumber.get('1')?.title).toBe('संघ का नाम और राज्यक्षेत्र');
    expect(byNumber.get('112')?.title).toBe('वार्षिक वित्तीय विवरण');
    expect(byNumber.get('202')?.title).toBe('वार्षिक वित्तीय विवरण');
    expect(byNumber.get('277')?.title).toBe('व्यावृत्ति');
    expect(byNumber.get('393')?.title).toBe('संक्षिप्त नाम');
  });

  test('article 1 opens with its printed sentence and carries numbered clauses', () => {
    const one = hindi.articles.find((article) => article.number === '1');
    expect(one?.clauses[0]?.text).toContain('भारत, अर्थात्');
    expect(one?.clauses.some((clause) => clause.number === '2')).toBe(true);
  });

  test('clause structure is recovered corpus-wide', () => {
    const withNumbers = hindi.articles.filter((article) =>
      article.clauses.some((clause) => clause.number !== undefined),
    );
    expect(withNumbers.length).toBeGreaterThan(250);
  });
});

describe('hindi explainers (Phase 3)', () => {
  test('FULL COVERAGE: all 504 explainers, every one passes the Hindi style gate and belongs to a real article', async () => {
    const { lintHindiExplainer } = await import('../../src/lib/hindi/explainer-lint');
    const fs = await import('node:fs');
    const explainers = JSON.parse(fs.readFileSync('data/processed/explainers-hi/explainers-hi.json', 'utf8')) as Record<
      string,
      string
    >;
    const numbers = new Set(hindi.articles.map((article) => article.number));
    expect(Object.keys(explainers).length).toBe(504);
    for (const article of hindi.articles) {
      expect(explainers[article.number], `article ${article.number} has no Hindi explainer`).toBeDefined();
    }
    for (const [number, text] of Object.entries(explainers)) {
      expect(numbers.has(number), `unknown article ${number}`).toBe(true);
      expect(lintHindiExplainer(text), number).toEqual([]);
    }
  });
});
