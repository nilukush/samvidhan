import { describe, expect, test } from 'vitest';
import { alignWords, fusePage, skeleton, tokenize } from '../../src/lib/hindi/fuse';

/** Real word behavior drawn from the spike pages. */

describe('skeleton', () => {
  test('strips everything except Devanagari letters', () => {
    expect(skeleton('1[संपूर्ण')).toBe(skeleton('[संपूर्ण'));
    expect(skeleton('97।')).toBe('');
    expect(skeleton('1971')).toBe('');
    expect(skeleton('अधिनियम,')).toBe('अधिनियम');
  });
});

describe('alignWords', () => {
  test('identical streams align one to one', () => {
    const pairs = alignWords(tokenize('क ख ग'), tokenize('क ख ग'));
    expect(pairs.map((pair) => [pair.ocr?.word, pair.layer?.word])).toEqual([
      ['क', 'क'],
      ['ख', 'ख'],
      ['ग', 'ग'],
    ]);
  });

  test('an inserted OCR word stays unaligned on one side', () => {
    const pairs = alignWords(tokenize('अ ब स'), tokenize('अ स'));
    expect(pairs.map((pair) => [pair.ocr?.word ?? null, pair.layer?.word ?? null])).toEqual([
      ['अ', 'अ'],
      ['ब', null],
      ['स', 'स'],
    ]);
  });
});

describe('fusePage', () => {
  test('marker digits come from the layer when letters agree (1[ recovered from [)', () => {
    const fused = fusePage('एक [संपूर्ण प्रभुत्व', 'एक 1[संपूर्ण प्रभुत्व');
    expect(fused.text).toBe('एक 1[संपूर्ण प्रभुत्व');
    expect(fused.flags).toEqual([]);
  });

  test('digits inside Devanagari runs come from the layer (97। vs 1971)', () => {
    const fused = fusePage('अधिनियम, 97। की', 'अधिनियम, 1971 की');
    expect(fused.text).toBe('अधिनियम, 1971 की');
    expect(fused.flags).toEqual([]);
  });

  test('letters come from OCR when the layer is corrupted, and the pair is flagged', () => {
    const fused = fusePage('सामाजिक न्याय', 'सामािजक न्याय');
    expect(fused.text).toBe('सामाजिक न्याय');
    expect(fused.flags).toHaveLength(1);
    expect(fused.flags[0]).toMatchObject({ word: 'सामाजिक', ocr: 'सामाजिक', layer: 'सामािजक' });
  });

  test('the word with fewer linter violations wins when skeletons differ', () => {
    const fused = fusePage('हैं | और', 'हैं। और');
    expect(fused.text).toBe('हैं। और');
  });

  test('unaligned OCR words pass through flagged', () => {
    const fused = fusePage('अ ब स', 'अ स');
    expect(fused.text).toBe('अ ब स');
    expect(fused.flags.some((flag) => flag.word === 'ब')).toBe(true);
  });

  test('layer-only words are kept and flagged, never silently dropped', () => {
    const fused = fusePage('अ स', 'अ ब स');
    expect(fused.text).toBe('अ ब स');
    expect(fused.flags.some((flag) => flag.word === 'ब' && flag.layer === 'ब' && flag.ocr === null)).toBe(true);
  });

  test('a layer word carrying replacement characters never enters the fused text', () => {
    const fused = fusePage('नागरिकों को', 'नाग\uFFFDरक\uFFFD को');
    expect(fused.text).toBe('नागरिकों को');
    expect(fused.flags).toHaveLength(1);
  });

  test('a layer-only word made of replacement garbage is dropped, not emitted', () => {
    const fused = fusePage('अ स', 'अ नाग\uFFFDरक\uFFFD स');
    expect(fused.text).toBe('अ स');
    expect(fused.flags.some((flag) => flag.word.includes('\uFFFD'))).toBe(true);
  });

  test('the layer line structure is preserved for the parser', () => {
    const fused = fusePage('भाग 3\nमूल अधिकार\n14. कानून के समक्ष समता', 'भाग 3\nमूल अ�िकार\n14. कानून के समक्ष समता');
    expect(fused.text.split('\n')).toEqual(['भाग 3', 'मूल अधिकार', '14. कानून के समक्ष समता']);
  });
});
