import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { lintExplainer } from '../../src/lib/explainer-lint';

describe('explainer style linter', () => {
  test('accepts a plain, well sized explainer', () => {
    const text =
      'This article says that every person is equal before the law. The State cannot give special treatment to one person and worse treatment to another when applying laws or state protection. Courts use this article as the base for testing many government actions, because almost anything a government does applies to people in some way.';
    expect(lintExplainer(text)).toEqual([]);
  });

  test('rejects explainers outside the 40 to 140 word band', () => {
    expect(lintExplainer('Too short to be useful.')).toContainEqual(expect.objectContaining({ rule: 'length' }));
    const long = 'word '.repeat(141).trim();
    expect(lintExplainer(long)).toContainEqual(expect.objectContaining({ rule: 'length' }));
  });

  test('rejects banned AI writing phrases and dashes', () => {
    const withBanned =
      'This article delves into equality before the law, moreover it is important to note that courts rely on it, in conclusion it matters a lot for every person facing any state action across the whole country today.';
    const rules = lintExplainer(withBanned).map((issue) => issue.rule);
    expect(rules).toContain('banned-phrase');
    const withDash =
      'This article protects equality before the law — a rule that binds every court — and it applies to all persons in the territory of India without any exception at all.';
    expect(lintExplainer(withDash).map((issue) => issue.rule)).toContain('dash');
  });

  test('flags reading level above the target band', () => {
    // Long words and long sentences push Flesch-Kincaid grade well past 11.
    const dense =
      'Notwithstanding parliamentary promulgation, this constitutional adjudication demonstrates unequivocally that governmental instrumentalities, notwithstanding jurisdictional particularities, shall effectuate non-discriminatory administration of justice equitably.';
    expect(lintExplainer(dense).map((issue) => issue.rule)).toContain('reading-level');
  });
});

describe('explainer batch data', () => {
  test('every committed explainer passes the linter and matches an article', () => {
    const explainers = JSON.parse(readFileSync('data/processed/explainers/explainers.json', 'utf8')) as Record<
      string,
      string
    >;
    const constitution = JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as {
      articles: Array<{ number: string }>;
    };
    const numbers = new Set(constitution.articles.map((article) => article.number));
    const entries = Object.entries(explainers);
    expect(entries.length).toBeGreaterThanOrEqual(20);
    for (const [number, text] of entries) {
      expect(numbers.has(number), `explainer for unknown article ${number}`).toBe(true);
      const issues = lintExplainer(text);
      expect(issues, `explainer for article ${number}: ${issues.map((i) => i.rule).join(', ')}`).toEqual([]);
    }
  });
});
