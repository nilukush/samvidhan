import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SCHEDULE_OVERRIDES, parseConstitution } from '../../scripts/extract/parse';

const read = (name: string): string => readFileSync(`tests/fixtures/extract/${name}.txt`, 'utf8');

describe('article boundary detection', () => {
  const parsed = parseConstitution(read('article-boundary'), { startPhase: 'articles' });

  test('detects the part heading and its articles in order', () => {
    expect(parsed.parts).toEqual([{ number: '3', name: 'FUNDAMENTAL RIGHTS' }]);
    expect(parsed.articles.map((a) => a.number)).toEqual(['11', '12', '13', '14', '15']);
  });

  test('splits article 14 from article 15 by heading number', () => {
    const a14 = parsed.articles.find((a) => a.number === '14');
    const a15 = parsed.articles.find((a) => a.number === '15');
    expect(a14?.title).toBe('Equality before law.');
    expect(a14?.clauses).toHaveLength(1);
    expect(a15?.clauses[0]?.text).toContain('The State shall not discriminate');
  });

  test('parses all numbered clauses of article 13 including the marker guarded clause 4', () => {
    const a13 = parsed.articles.find((a) => a.number === '13');
    expect(a13?.clauses.map((c) => c.number)).toEqual(['1', '2', '3', '4']);
    expect(a13?.clauses[3]?.text).toContain('Nothing in this article shall apply to any amendment of this');
  });

  test('maps the amendment footnote to the article that carried its marker', () => {
    const a13 = parsed.articles.find((a) => a.number === '13');
    expect(a13?.amendedBy).toContain('24th-amendment');
  });

  test('captures section headings as article metadata', () => {
    expect(parsed.articles.find((a) => a.number === '14')?.section).toBe('Right to Equality');
    expect(parsed.articles.find((a) => a.number === '12')?.section).toBe('General');
  });
});

describe('bare number headings', () => {
  const parsed = parseConstitution(read('bare-number-heading'), { startPhase: 'articles' });

  test('recovers an article whose number stands alone after a fused marker', () => {
    expect(parsed.articles.map((a) => a.number)).toEqual(['173', '174', '175']);
    const a174 = parsed.articles.find((a) => a.number === '174');
    expect(a174?.title).toBe('Sessions of the State Legislature, prorogation and dissolution.');
    expect(a174?.clauses).toHaveLength(2);
    expect(a174?.clauses[0]?.number).toBe('1');
    expect(a174?.clauses[0]?.text).toContain('six months shall not intervene');
    expect(a174?.clauses[1]?.text).toContain('dissolve the Legislative Assembly');
  });

  test('the preceding article keeps its own text and the following article still parses', () => {
    const a173 = parsed.articles.find((a) => a.number === '173');
    expect(a173?.clauses[0]?.text).toContain('possesses such other qualifications');
    expect(a173?.clauses.every((clause) => !clause.text.includes('Governor shall from time to time summon'))).toBe(
      true,
    );
    const a175 = parsed.articles.find((a) => a.number === '175');
    expect(a175?.clauses[0]?.text).toContain('may address the Legislative Assembly');
  });
});

describe('clause variants', () => {
  test('parses letter suffixed clause 2A and marker prefixed clause lines', () => {
    const parsed = parseConstitution(read('clause-2a-prelude'), { startPhase: 'articles' });
    const a124 = parsed.articles.find((a) => a.number === '124');
    expect(a124?.clauses.map((c) => c.number)).toEqual(['1', '2', '2A', '3']);
    expect(a124?.clauses[2]?.text).toContain('The age of a Judge of the Supreme Court');
    expect(a124?.clauses[1]?.text).toContain('National Judicial Appointments Commission');
  });

  test('parses Explanation I and II as explanation kind clauses', () => {
    const parsed = parseConstitution(read('explanation-clauses'), { startPhase: 'articles' });
    const a25 = parsed.articles.find((a) => a.number === '25');
    expect(a25?.clauses.map((c) => c.number)).toEqual(['1', '2', undefined, undefined]);
    const explanations = a25?.clauses.filter((c) => c.kind === 'explanation');
    expect(explanations).toHaveLength(2);
    expect(explanations?.[0]?.text).toContain('The wearing and carrying of kirpans');
    const a26 = parsed.articles.find((a) => a.number === '26');
    expect(a26?.title).toBe('Freedom to manage religious affairs.');
  });
});

describe('omitted article', () => {
  test('marks article 31 omitted with its amending amendment', () => {
    const parsed = parseConstitution(read('omitted-article'), { startPhase: 'articles' });
    const a31 = parsed.articles.find((a) => a.number === '31');
    expect(a31?.title).toBe('Compulsory acquisition of property.');
    expect(a31?.status).toBe('omitted');
    expect(a31?.amendedBy).toContain('44th-amendment');
    expect(a31?.clauses[0]?.text).toContain('Omitted by the Constitution');
  });
});

describe('fused marker digit', () => {
  test('recovers article 32A whose marker digit fuses with its number after article 32', () => {
    const parsed = parseConstitution(read('fused-marker'), { startPhase: 'articles' });
    expect(parsed.articles.map((a) => a.number)).toEqual(['32', '32A', '33']);
    const a32a = parsed.articles.find((a) => a.number === '32A');
    expect(a32a?.title).toBe(
      'Constitutional validity of State laws not to be considered in proceedings under article 32.',
    );
    expect(a32a?.status).toBe('omitted');
    expect(a32a?.amendedBy).toContain('43rd-amendment');
  });
});

describe('schedule override anchor', () => {
  test('starts schedule two at the subtitle line whose heading is missing from the text layer', () => {
    const parsed = parseConstitution(read('schedule-override'), {
      scheduleOverrides: SCHEDULE_OVERRIDES,
      startPhase: 'articles',
    });
    expect(parsed.schedules).toHaveLength(1);
    expect(parsed.schedules[0]?.number).toBe(2);
    expect(parsed.schedules[0]?.title).toContain('Provisions as to the President');
    expect(parsed.schedules[0]?.text).toContain('PART A');
  });
});
