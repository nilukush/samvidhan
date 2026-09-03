import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { getEssentials, refLink } from '../../src/lib/essentials';
import { lintShortSummary } from '../../src/lib/explainer-lint';

const constitution = JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as {
  articles: Array<{ number: string }>;
  parts: Array<{ number: string }>;
};
const amendments = JSON.parse(readFileSync('src/data/amendments/amendments.json', 'utf8')) as Array<{ number: number }>;

describe('essentials data', () => {
  const { lastVerified, entries } = getEssentials();

  test('the file validates with 8 to 12 entries and a verification date', () => {
    expect(entries.length).toBeGreaterThanOrEqual(8);
    expect(entries.length).toBeLessThanOrEqual(12);
    expect(lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('every summary passes the short copy style lint', () => {
    for (const entry of entries) {
      expect(lintShortSummary(entry.summary), entry.id).toEqual([]);
    }
  });

  test('every reference resolves against the real dataset', () => {
    const articleNumbers = new Set(constitution.articles.map((article) => article.number));
    const partNumbers = new Set(constitution.parts.map((part) => part.number));
    const amendmentNumbers = new Set(amendments.map((amendment) => amendment.number));
    for (const entry of entries) {
      expect(entry.refs.length, entry.id).toBeGreaterThanOrEqual(1);
      for (const ref of entry.refs) {
        if (ref.type === 'article') {
          expect(articleNumbers.has(ref.value), `${entry.id}: article ${ref.value} not in dataset`).toBe(true);
        }
        if (ref.type === 'part') {
          expect(partNumbers.has(ref.value), `${entry.id}: part ${ref.value} not in dataset`).toBe(true);
        }
        if (ref.type === 'amendment') {
          expect(amendmentNumbers.has(Number(ref.value)), `${entry.id}: amendment ${ref.value} not in dataset`).toBe(
            true,
          );
        }
        if (ref.type === 'page') {
          expect(ref.value.startsWith('/'), `${entry.id}: page ref must be a root relative path`).toBe(true);
        }
      }
    }
  });

  test('the 106th Amendment entry carries the Article 334A inoperative caveat', () => {
    const entry = entries.find((candidate) => candidate.id === 'amendment-106');
    expect(entry).toBeDefined();
    expect(entry!.summary).toContain('inoperative');
    expect(entry!.summary).toContain('334A');
    expect(entry!.summary).toContain('16 April 2026');
    expect(entry!.refs.some((ref) => ref.type === 'amendment' && ref.value === '106')).toBe(true);
  });

  test('ref links resolve to real site paths with clean labels', () => {
    expect(refLink({ type: 'part', value: '3' })).toEqual({ href: '/parts/3/', label: 'Part III' });
    expect(refLink({ type: 'article', value: '51A' })).toEqual({ href: '/articles/51a/', label: 'Article 51A' });
    expect(refLink({ type: 'amendment', value: '101' })).toEqual({
      href: '/amendments/101/',
      label: '101st Amendment',
    });
    expect(refLink({ type: 'page', value: '/preamble/', label: 'The Preamble' })).toEqual({
      href: '/preamble/',
      label: 'The Preamble',
    });
    expect(() => refLink({ type: 'page', value: '/nowhere/' })).toThrow();
  });
});
