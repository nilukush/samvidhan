import { describe, expect, test } from 'vitest';
import { articleSortKey, cleanLegalText, statusYear, toRomanPart } from '../../src/lib/display';

describe('cleanLegalText', () => {
  test('removes digit markers and their brackets, keeping the text', () => {
    expect(cleanLegalText('India into a 1[SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC] and')).toBe(
      'India into a SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC and',
    );
  });

  test('removes unmarked insertion brackets around sub clauses', () => {
    expect(cleanLegalText('States; [(b) the Union territories specified in the First Schedule; and] (c)')).toBe(
      'States; (b) the Union territories specified in the First Schedule; and (c)',
    );
  });

  test('handles orphan closing brackets and tightens punctuation spacing', () => {
    expect(cleanLegalText('Omitted.]')).toBe('Omitted.');
    expect(cleanLegalText('under article 32.]')).toBe('under article 32.');
  });

  test('collapses whitespace runs left behind by removals', () => {
    expect(cleanLegalText('the 2[unity and  integrity] of the Nation')).toBe('the unity and integrity of the Nation');
  });
});

describe('statusYear', () => {
  test('finds the amending year in the body of an omitted article', () => {
    const year = statusYear({
      clauses: [{ text: 'Omitted by the Constitution (Forty-fourth Amendment) Act, 1978, s. 6 (w.e.f. 20-6-1979).' }],
    });
    expect(year).toBe('1978');
  });

  test('returns null when no year appears', () => {
    expect(statusYear({ clauses: [{ text: 'The State shall not deny to any person equality.' }] })).toBeNull();
  });
});

describe('toRomanPart', () => {
  test.each([
    ['1', 'I'],
    ['3', 'III'],
    ['4', 'IV'],
    ['4A', 'IVA'],
    ['9', 'IX'],
    ['9A', 'IXA'],
    ['9B', 'IXB'],
    ['14A', 'XIVA'],
    ['22', 'XXII'],
  ])('maps %s to %s', (input, expected) => {
    expect(toRomanPart(input)).toBe(expected);
  });
});

describe('articleSortKey', () => {
  test('sorts numerically with letter suffixes after their base number', () => {
    const numbers = ['10', '2A', '2', '14A', '14', '1', '51A'];
    expect([...numbers].sort((a, b) => articleSortKey(a) - articleSortKey(b) || a.localeCompare(b))).toEqual([
      '1',
      '2',
      '2A',
      '10',
      '14',
      '14A',
      '51A',
    ]);
  });
});
