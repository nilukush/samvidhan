import { describe, expect, test } from 'vitest';
import { ordinalWordToNumber } from '../../scripts/extract/ordinals';

describe('ordinal word parsing', () => {
  test.each([
    ['First', 1],
    ['Seventh', 7],
    ['Twenty-fourth', 24],
    ['Forty-second', 42],
    ['Ninety-third', 93],
    ['One hundred and sixth', 106],
  ])('parses %s as %i', (word, expected) => {
    expect(ordinalWordToNumber(word)).toBe(expected);
  });

  test('returns null for unknown words', () => {
    expect(ordinalWordToNumber('Banana')).toBeNull();
    expect(ordinalWordToNumber('')).toBeNull();
  });
});
