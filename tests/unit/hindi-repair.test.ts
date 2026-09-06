import { describe, expect, test } from 'vitest';
import { repairDevanagari } from '../../src/lib/hindi/repair';

describe('repairDevanagari', () => {
  test('a displaced i-matra moves one consonant to its right (सामािजक shape)', () => {
    expect(repairDevanagari('सामािजक')).toBe('सामाजिक');
  });

  test('a word-initial displaced i-matra moves past its consonant', () => {
    expect(repairDevanagari('िछड़े')).toBe('छिड़े');
  });

  test('displaced matras are repaired where flagged; a DROPPED matra is the documented non-target', () => {
    // सामािजक carries a displaced ि (linted, repaired). संवधान lost its ि
    // entirely and looks valid; no linter can see it, so it passes through
    // for the fusion cross-check and the review list, never a guess here.
    expect(repairDevanagari('संवधान और सामािजक')).toBe('संवधान और सामाजिक');
  });

  test('clean text passes through unchanged', () => {
    const clean = 'हम, भारत के लोग, भारत को एक संपूर्ण प्रभुत्व-संपन्न समाजवादी गणराज्य बनाने के लिए';
    expect(repairDevanagari(clean)).toBe(clean);
  });

  test('a repair that would leave a violation is reverted (no guessing)', () => {
    // ि at the very end of the string with no consonant after it: nothing to
    // move past, so the text is returned untouched for the review list.
    expect(repairDevanagari('शब्द ि')).toBe('शब्द ि');
  });

  test('danda misread as a pipe adjacent to Devanagari is restored', () => {
    expect(repairDevanagari('करते हैं | और')).toBe('करते हैं । और');
  });

  test('stray ZWNJ is stripped', () => {
    expect(repairDevanagari('संसद्\u200C की')).toBe('संसद् की');
  });
});
