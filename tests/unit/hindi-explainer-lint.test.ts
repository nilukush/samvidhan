import { describe, expect, test } from 'vitest';
import { lintHindiExplainer } from '../../src/lib/hindi/explainer-lint';

const CLEAN =
  'यह अनुच्छेद बताता है कि इस भाग के लिए राज्य किसे माना जाएगा। इसमें भारत सरकार और संसद, राज्यों की सरकारें और विधान-मंडल, और सरकार के नियंत्रण वाली या भारत के अंदर की स्थानीय या अन्य संस्थाएं आती हैं। इस भाग के अधिकार इन सब को बांधते हैं। यही अधिकार आम कानून से ऊपर खड़े होते हैं।';

describe('lintHindiExplainer', () => {
  test('a clean plain-Hindi explainer passes', () => {
    expect(lintHindiExplainer(CLEAN)).toEqual([]);
  });

  test('length band is 30 to 110 words', () => {
    const short = CLEAN.split(/\s+/).slice(0, 20).join(' ');
    const issues = lintHindiExplainer(short);
    expect(issues[0]?.rule).toBe('length');
    const long = (CLEAN + ' ').repeat(6);
    expect(lintHindiExplainer(long)[0]?.rule).toBe('length');
  });

  test('banned Hindi filler phrases fail', () => {
    for (const phrase of ['यह ध्यान देने योग्य है', 'संक्षेप में', 'दूसरे शब्दों में', 'कुल मिलाकर', 'आइए देखते हैं']) {
      const issues = lintHindiExplainer(`${CLEAN} ${phrase} संविधान आगे बढ़ता है।`);
      expect(
        issues.some((issue) => issue.rule === 'banned-phrase'),
        phrase,
      ).toBe(true);
    }
  });

  test('em and en dashes fail, the hyphen in compound words passes', () => {
    expect(lintHindiExplainer(CLEAN.replace('सरकारें', 'सरकारें—और')).some((i) => i.rule === 'dash')).toBe(true);
    expect(lintHindiExplainer(CLEAN.replace('सरकारें', 'सरकारें–और')).some((i) => i.rule === 'dash')).toBe(true);
    expect(lintHindiExplainer(CLEAN)).toEqual([]);
  });

  test('plainness proxy: at most 7 sentences and at most 22 words per sentence on average', () => {
    const runOn =
      'यह अनुच्छेद बताता है कि राज्य किसे माना जाएगा और इसमें भारत सरकार और संसद और राज्यों की सरकारें और विधान-मंडल और स्थानीय संस्थाएं आती हैं और ये सब अधिकारों से बंधती हैं और आगे भी बंधती रहेंगी हमेशा के लिए ।'.replace(
        /\s+/g,
        ' ',
      );
    expect(lintHindiExplainer(runOn).some((i) => i.rule === 'plainness')).toBe(true);
  });

  test('non-Devanagari input fails the language check', () => {
    const issues = lintHindiExplainer('This article defines the State for this Part and binds every body listed here.');
    expect(issues.some((i) => i.rule === 'language')).toBe(true);
  });

  test('Devanagari well-formedness issues surface as lint issues', () => {
    const issues = lintHindiExplainer(CLEAN.replace('संस्थाएं', 'स�स्थाएं'));
    expect(issues.some((i) => i.rule === 'devanagari')).toBe(true);
  });
});
