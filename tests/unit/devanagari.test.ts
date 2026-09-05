import { describe, expect, test } from 'vitest';
import { lintDevanagari } from '../../src/lib/devanagari';

/** The approved Hindi Preamble, clean by construction. */
const CLEAN =
  'हम, भारत के लोग, भारत को एक संपूर्ण प्रभुत्व-संपन्न समाजवादी पंथनिरपेक्ष लोकतंत्रात्मक गणराज्य बनाने के लिए, तथा उसके समस्त नागरिकों को: सामाजिक, आर्थिक और राजनीतिक न्याय।';

describe('lintDevanagari', () => {
  test('the approved Preamble text passes clean', () => {
    expect(lintDevanagari(CLEAN)).toEqual([]);
  });

  test('valid but tricky words pass: final i-matra, nukta, halant-final, Devanagari digit', () => {
    expect(lintDevanagari('कि जबकि दृढ़संकल्प संसद् प्रतिष्ठा ई० क्षेत्र')).toEqual([]);
  });

  test('a dropped i-matra is silent (documented limitation): संवधान looks valid', () => {
    // This is exactly why the fusion cross-check exists; the linter cannot see it.
    expect(lintDevanagari('संवधान')).toEqual([]);
  });

  test('displaced i-matra (सामािजक from the spike) is caught as sign-after-sign', () => {
    const issues = lintDevanagari('सामािजक');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.rule).toBe('sign-after-sign');
    expect(issues[0]?.excerpt).toContain('ाि');
  });

  test('a vowel sign at word start is caught', () => {
    const issues = lintDevanagari('िक शब्द');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.rule).toBe('sign-at-start');
  });

  test('replacement characters are caught with position', () => {
    const issues = lintDevanagari('नाग\uFFFDरक\uFFFD');
    expect(issues.map((i) => i.rule)).toEqual(['replacement', 'replacement']);
    expect(issues[0]?.index).toBe(3);
  });

  test('private use glyphs are caught', () => {
    const issues = lintDevanagari('\uF02A370.');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.rule).toBe('private-use');
  });

  test('a pipe adjacent to Devanagari (danda misread) is caught, Latin pipes are not', () => {
    expect(lintDevanagari('करते हैं |')[0]?.rule).toBe('pipe-danda');
    expect(lintDevanagari('हैं| और')[0]?.rule).toBe('pipe-danda');
    expect(lintDevanagari('a | b')).toEqual([]);
  });

  test('stray ZWNJ is flagged', () => {
    expect(lintDevanagari('संसद्\u200C की')[0]?.rule).toBe('zwnj');
  });
});
