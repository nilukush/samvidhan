import { describe, expect, test } from 'vitest';
import {
  buildSuffixMap,
  classifyLine,
  extractTocNumbers,
  parseArticleHeading,
  suffixToLatin,
  type LineKind,
} from '../../src/lib/hindi/parse';

describe('parseArticleHeading', () => {
  test('a plain body heading yields number and title', () => {
    expect(parseArticleHeading('2. परिभाषा-इस भाग में, जब तक कि संदर्भ से अन्यथा अपेक्षित न हो,')).toEqual({
      numberHi: '2',
      latin: '2',
      rest: 'परिभाषा-इस भाग में, जब तक कि संदर्भ से अन्यथा अपेक्षित न हो,',
      prefix: '',
    });
  });

  test('a Devanagari letter suffix maps through the suffix map', () => {
    expect(parseArticleHeading('21क. प्राण और दैहिक स्वतंत्रता का अधिकार-', { '21क': '21A' })).toEqual({
      numberHi: '21क',
      latin: '21A',
      rest: 'प्राण और दैहिक स्वतंत्रता का अधिकार-',
      prefix: '',
    });
  });

  test('clause enumerations and years are not article headings', () => {
    expect(parseArticleHeading('(1) इस संविधान में किसी बात के होते हुए भी,')).toBeNull();
    expect(parseArticleHeading('1971 की धारा 3 द्वारा प्रतिस्थापित ।')).toBeNull();
  });

  test('a marker digit fused before the number does not disguise the heading (4268A shape)', () => {
    expect(parseArticleHeading('268क. विधियों द्वारा करों का विनियमन-', { '268क': '268A' })?.latin).toBe('268A');
    expect(parseArticleHeading('1268क. सहायता अनुदान-', { '1268क': '268A' })?.latin).toBe('268A');
  });
});

describe('classifyLine', () => {
  test('running headers, bare page numbers, and part running heads are furniture', () => {
    expect(classifyLine('भारत का संविधान')).toBe<LineKind>('furniture');
    expect(classifyLine('126')).toBe<LineKind>('furniture');
    expect(classifyLine('(भाग 3—मूल अधिकार)')).toBe<LineKind>('furniture');
  });

  test('footnote lines with amendment citations are apparatus', () => {
    expect(classifyLine('1. संविधान (बयालीसवाँ संशोधन) अधिनियम, 1976 की धारा 2 द्वारा प्रतिस्थापित ।')).toBe<LineKind>(
      'footnote',
    );
  });

  test('body text passes through', () => {
    expect(classifyLine('राज्य किसी नागरिक के साथ धर्म के आधार पर भेद नहीं करेगा ।')).toBe<LineKind>('body');
  });
});

describe('buildSuffixMap', () => {
  test('document-order zip of the Hindi and English article sets yields the suffix map', () => {
    const hindi = ['1', '2', '2क', '3', '3ख', '4'];
    const english = ['1', '2', '2A', '3', '3B', '4'];
    expect(buildSuffixMap(hindi, english)).toEqual({ '2क': '2A', '3ख': '3B' });
  });

  test('numeric parts must agree position by position or the zip refuses', () => {
    const hindi = ['1', '2', '2क', '5'];
    const english = ['1', '2', '2A', '3'];
    expect(() => buildSuffixMap(hindi, english)).toThrow(/numeric parts/);
  });
});

describe('extractTocNumbers', () => {
  test('real TOC shapes yield the article numbers in order, page numbers do not match', () => {
    const lines = [
      'भाग 1',
      'संघ और उसका राज्यक्षेत्र',
      '1. संघ का नाम और राज्यक्षेत्र 2',
      '2. नए राज्यों का प्रवेश या स्थापना...................................................... 2',
      'सिक्किम [2क. का संघ के साथ सहयुक्त किया जाना– - लोप किया गया।].. 2',
      '3. नए राज्यों का निर्माण और वर्तमान राज्यों के क्षेत्रों, सीमाओं या नामों',
      'में परिवर्तन 2',
    ];
    expect(extractTocNumbers(lines)).toEqual(['1', '2', '2क', '3']);
  });

  test('noise is filtered: zero-led tokens, out-of-range years, non-monotonic garbage', () => {
    const lines = [
      '0.. भारत का संविधान',
      '115. अनुपूरक, अतिरिक्त या अधिक अनुदान... 53',
      '.....................८८८--८८८८८८८',
      '1976 की धारा 2 द्वारा',
      '116. लेखानुदान, प्रत्ययानुदान और अपवादानुदान... 54',
      '99. यह क्रम टूट गया',
    ];
    expect(extractTocNumbers(lines)).toEqual(['115', '116']);
  });
});

describe('suffixToLatin', () => {
  test('single consonants map by position, doubles compose', () => {
    expect(suffixToLatin('क')).toBe('A');
    expect(suffixToLatin('ग')).toBe('C');
    expect(suffixToLatin('य')).toBe('Z');
    expect(suffixToLatin('कक')).toBe('AA');
    expect(suffixToLatin('कख')).toBe('AB');
    expect(suffixToLatin('यक')).toBe('ZA');
    expect(suffixToLatin('यख')).toBe('ZB');
  });

  test('consonants beyond the Latin alphabet refuse loudly', () => {
    expect(() => suffixToLatin('र')).toThrow(/no Latin letter/);
  });
});

describe('parseArticleHeading body titles that contain citation-like words', () => {
  test('article 34 carries द्वारा in its own text and is still a heading', () => {
    expect(
      parseArticleHeading('34. जब किसी में सेना विधि प्रवृत्त है तब इस भाग द्वारा अधिकारों पर पूर्वगामी उपबंध')?.latin,
    ).toBe('34');
  });

  test('article 368 carries संशोधन in its title and is still a heading', () => {
    expect(parseArticleHeading('368. संविधान का संशोधन करने की संसद् की शक्ति और उसके लिए प्रक्रिया,--')?.latin).toBe(
      '368',
    );
  });

  test('footnotes keep their citation shape and stay rejected', () => {
    expect(
      parseArticleHeading('2. आंध्र प्रदेश पुनर्गठन 2014 की धारा 96 द्वारा के स्थान पर प्रतिस्थापित ।'),
    ).toBeNull();
  });

  test('an insertion bracket before the number does not hide the heading', () => {
    expect(parseArticleHeading('[270. उद्गम कर और उनका संघ तथा राज्यों के बीच वितरण')?.latin).toBe('270');
    expect(parseArticleHeading('।] 273. जूट पर और जूट उत्पादों पर शुल्क के स्थान पर अनुदान')?.latin).toBe('273');
  });
});

describe('parseArticleHeading versus real Part III defect shapes', () => {
  test('article 31 heading with a fused amendment-note tail is a heading', () => {
    expect(
      parseArticleHeading('[संपत्ति 31. का अनिवार्य अर्जन ।]-संविधान (चवालीसवां संशोधन) अधिनियम, 1978')?.latin,
    ).toBe('31');
  });

  test('article 31B names अधिनियम in its own title and is a heading', () => {
    expect(parseArticleHeading('[31ख. कुछ अधिनियम और विनियम का विधिमान्यकरण')?.latin).toBe('31B');
  });

  test('single-digit footnote lines with a leading citation stay rejected', () => {
    expect(
      parseArticleHeading('1. संविधान (बयालीसवां संशोधन) अधिनियम, 1976 की धारा 2 द्वारा प्रतिस्थापित ।'),
    ).toBeNull();
  });
});
