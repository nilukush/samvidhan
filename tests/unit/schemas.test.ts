import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { AmendmentSchema, ArticleSchema, BillSchema, PartSchema, ScheduleSchema } from '../../src/lib/schemas';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8')) as Record<string, unknown>;

describe('article schema', () => {
  test('accepts a valid article fixture', () => {
    const article = ArticleSchema.parse(fixture('valid-article'));
    expect(article.number).toBe('15');
    expect(article.clauses).toHaveLength(2);
    expect(article.amendedBy).toEqual(['1st-amendment', '93rd-amendment']);
  });

  test('rejects an unknown status', () => {
    const invalid = { ...fixture('valid-article'), status: 'deleted' };
    expect(() => ArticleSchema.parse(invalid)).toThrow();
  });

  test('rejects a clause without text', () => {
    const invalid = { ...fixture('valid-article'), clauses: [{ number: '1' }] };
    expect(() => ArticleSchema.parse(invalid)).toThrow();
  });

  test('accepts a part reference with a letter suffix such as Part IVA', () => {
    const article = { ...fixture('valid-article'), part: '4A' };
    expect(() => ArticleSchema.parse(article)).not.toThrow();
  });

  test('accepts an explainer summary', () => {
    const article = ArticleSchema.parse({ ...fixture('valid-article'), explainer: 'Plain words summary.' });
    expect(article.explainer).toBe('Plain words summary.');
  });

  test('accepts a section heading as article metadata', () => {
    const article = { ...fixture('valid-article'), section: 'Right to Equality' };
    const parsed = ArticleSchema.parse(article);
    expect(parsed.section).toBe('Right to Equality');
  });
});

describe('amendment schema', () => {
  test('accepts a theme classification with a general default', () => {
    const themed = AmendmentSchema.parse({ ...fixture('valid-amendment'), theme: 'rights' });
    expect(themed.theme).toBe('rights');
    const unthemed = AmendmentSchema.parse(fixture('valid-amendment'));
    expect(unthemed.theme).toBe('general');
  });
});

describe('schedule schema', () => {
  test('accepts schedule body text and defaults it to empty', () => {
    const withText = ScheduleSchema.parse({ ...fixture('valid-schedule'), text: 'Languages listed.' });
    expect(withText.text).toBe('Languages listed.');
    const withoutText = ScheduleSchema.parse(fixture('valid-schedule'));
    expect(withoutText.text).toBe('');
  });
});

describe('part and schedule schemas', () => {
  test('accepts a valid part fixture', () => {
    const part = PartSchema.parse(fixture('valid-part'));
    expect(part.number).toBe('3');
  });

  test('accepts a valid schedule fixture', () => {
    const schedule = ScheduleSchema.parse(fixture('valid-schedule'));
    expect(schedule.number).toBe(1);
  });
});

describe('amendment schema', () => {
  test('accepts a valid amendment with milestone dates', () => {
    const amendment = AmendmentSchema.parse(fixture('valid-amendment'));
    expect(amendment.inForce).toBe('2026-04-16');
  });

  test('rejects a year before 1950', () => {
    const invalid = { ...fixture('valid-amendment'), year: 1949 };
    expect(() => AmendmentSchema.parse(invalid)).toThrow();
  });

  test('rejects a year after the current year', () => {
    const invalid = { ...fixture('valid-amendment'), year: new Date().getFullYear() + 1 };
    expect(() => AmendmentSchema.parse(invalid)).toThrow();
  });
});

describe('bill schema', () => {
  test('rejects a bill without a last verified date', () => {
    const { lastVerified, ...invalid } = fixture('valid-bill');
    expect(lastVerified).toBeDefined();
    expect(() => BillSchema.parse(invalid)).toThrow();
  });
});
