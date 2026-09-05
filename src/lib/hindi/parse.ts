/**
 * Hindi edition grammar (docs/HINDI-IMPLEMENTATION-PLAN.md H4). Pure parsing
 * primitives over the fused page text: article headings with Devanagari
 * letter suffixes, line classification (body, footnote, furniture), and the
 * document-order suffix map that converts Hindi numbers like 21क to the
 * English edition's 21A. Tested in tests/unit/hindi-parse.test.ts.
 */

export type LineKind = 'body' | 'footnote' | 'furniture';

/** Amendment citation signals of the Hindi edition's footnotes. */
const CITATION_SIGNALS = [
  'अधिनियम',
  'प्रतिस्थापित',
  'अंतःस्थापित',
  'लोप',
  'द्वारा',
  'के स्थान पर',
  'संशोधन',
  'w.e.f',
  'अध्यादेश',
];

/**
 * Signals that ONLY footnotes carry. Body headings legitimately contain
 * words like द्वारा (article 34) and संशोधन (article 368's own title), so
 * heading rejection uses this narrow list only.
 */
const FOOTNOTE_ONLY_SIGNALS = [
  'अधिनियम',
  'प्रतिस्थापित',
  'अंतःस्थापित',
  'के स्थान पर',
  'स्थान पर',
  'अधिसूचना',
  'राजपत्र',
  'लोप किया',
];

/** Heading shape: digits, optional Devanagari letter suffix, full stop. */
const HEADING_RE = /^(\d{1,3})?([क-ह]+)?\.\s+(.+)$/;

export interface ArticleHeading {
  numberHi: string;
  latin: string;
  rest: string;
  /** Words that preceded the number on the line (wrapped text or side-column
   * bleed); the caller appends them to the previous article's text. */
  prefix: string;
}

/**
 * A body article heading: "2. परिभाषा-..." with Devanagari letter suffixes
 * converted positionally to the English edition's Latin ones. Marker digits
 * fused onto the number by the PDF (the 4268A shape from the English
 * pipeline) resolve by trying the trailing digit tails.
 */
export function parseArticleHeading(line: string, suffixMap: Record<string, string> = {}): ArticleHeading | null {
  // Leading apparatus: insertion brackets, dandas, closing brackets.
  const stripped = line.trim().replace(/^[[([।\]\s]+/u, '');
  // Wrapped text or side-column bleed before the number, with an optional
  // insertion bracket: "विदेशी 9. शी राज्य ...", "विधान [170. सभाओं की संरचना",
  // "अन्य रीति नि:शुल्क विधिक व्यवस्था करेगा 40. पंचायतों का संगठन". Long
  // prefixes are allowed only for two-plus digit numbers; single digits stay
  // tight so footnote lines cannot enter through the back door.
  const mid = /^((?:\S+\s+){0,4})\[?((?:\d{1,4}[क-ह]{0,2})[.।]\s+\S.*)$/u.exec(stripped);
  let trimmed = mid === null ? stripped : (mid[2] as string);
  let carriedPrefix = mid === null ? '' : ((mid[1] ?? '').trim() + ' ').trimStart();
  if (mid === null) {
    const wide = /^((?:\S+\s+){0,7})\[?((?:\d{2,4}[क-ह]{0,2})[.।]\s+\S.*)$/u.exec(stripped);
    if (wide !== null) {
      trimmed = wide[2] as string;
      carriedPrefix = ((wide[1] ?? '').trim() + ' ').trimStart();
    }
  }
  if (/^\(/.test(trimmed)) return null;
  const match = /^(\d{1,4})?([क-ह]{1,2})?[.।]\s+(.+)$/.exec(trimmed);
  if (match === null) return null;
  const digits = match[1] ?? '';
  const suffix = match[2] ?? '';
  const rest = match[3] ?? '';
  if (digits === '') return null;
  if (rest.length < 3) return null;
  if (Math.min(...[digits, digits.slice(-3), digits.slice(-2)].map((d) => Number(d))) > 395) return null;
  // Reject footnote-shaped lines: footnote numbers are single digits. Real
  // headings with two-plus digits may cite अधिनियम in the title (31ख:
  // अधिनियम और विनियम का विधिमान्यकरण) or carry a fused amendment-note tail
  // (31: ... ।]-संविधान (चवालीसवां संशोधन) अधिनियम, 1978 ...), so those
  // never reject on signals.
  if (/^\d$/.test(digits) && FOOTNOTE_ONLY_SIGNALS.some((signal) => rest.includes(signal))) {
    return null;
  }

  // Marker-digit fusion: try the full digits, then the 3- and 2-digit tails.
  for (const candidate of [digits, digits.slice(-3), digits.slice(-2)]) {
    const numberHi = candidate + suffix;
    if (suffixMap[numberHi] !== undefined) {
      return { numberHi, latin: suffixMap[numberHi], rest, prefix: carriedPrefix };
    }
  }
  const latin = suffix === '' ? digits : digits + suffixToLatin(suffix);
  return { numberHi: digits + suffix, latin, rest, prefix: carriedPrefix };
}

/** Classify a fused line for the parser. */
export function classifyLine(line: string): LineKind {
  const trimmed = line.trim();
  if (/^भारत का संविधान\s*\d*$/.test(trimmed) || trimmed === 'THE CONSTITUTION OF INDIA') return 'furniture';
  if (/^\d{1,3}$/.test(trimmed)) return 'furniture';
  if (/^\(भाग\s/.test(trimmed) && /\)\s*\d*$/.test(trimmed)) return 'furniture';
  if (/^\d[.।]\s/.test(trimmed) && FOOTNOTE_ONLY_SIGNALS.some((signal) => trimmed.includes(signal))) {
    return 'footnote';
  }
  return 'body';
}

const numericPart = (number: string): string => number.replace(/[क-ह]+|[A-Z]+$/u, '');

/**
 * Zip the Hindi article numbers in document order against the English
 * edition's (same set, Latin suffixes) and return the suffix conversions.
 * Numeric parts must agree at every position; anything else refuses loudly
 * rather than guessing.
 */
export function buildSuffixMap(hindi: string[], english: string[]): Record<string, string> {
  if (hindi.length !== english.length) {
    throw new Error(`article count mismatch: ${hindi.length} hindi vs ${english.length} english`);
  }
  const map: Record<string, string> = {};
  for (let i = 0; i < hindi.length; i += 1) {
    const hi = hindi[i] as string;
    const en = english[i] as string;
    if (numericPart(hi) !== numericPart(en)) {
      throw new Error(`numeric parts disagree at position ${i}: ${hi} vs ${en}`);
    }
    if (hi !== en) map[hi] = en;
  }
  return map;
}

// Referenced by tests through HEADING_RE compatibility checks.
export { HEADING_RE };

const TOC_NUMBER_RE = /\b([1-9]\d{0,2})([क-ह]{1,2})?\./g;

/**
 * Article numbers from the fused contents pages, in document order. Only a
 * dotted number qualifies (trailing page numbers never carry the dot), the
 * value must stay inside the article range, and the sequence must be
 * monotonic, which together filter the OCR noise of the contents pages.
 */
export function extractTocNumbers(lines: string[]): string[] {
  const numbers: string[] = [];
  let lastNumeric = 0;
  for (const line of lines) {
    for (const match of line.matchAll(TOC_NUMBER_RE)) {
      const digits = match[1] as string;
      const suffix = match[2] ?? '';
      const numeric = Number(digits);
      if (numeric > 395 || numeric < lastNumeric) continue;
      if (numeric === lastNumeric && suffix === '') continue;
      numbers.push(digits + suffix);
      lastNumeric = numeric;
    }
  }
  return numbers;
}

/** Devanagari consonants in alphabetical order; position maps to the Latin
 * letter suffix of the English edition (क=A ... य=Z), confirmed empirically
 * by the edition's own contents (2क=2A, 31ग=31C, 243यक=243ZA). */
const CONSONANT_ORDER = 'कखगघङचछजझञटठडढणतथदधनपफबभमय'.split('');

export function suffixToLatin(suffix: string): string {
  const letters = Array.from(suffix).map((char) => {
    const index = CONSONANT_ORDER.indexOf(char);
    if (index === -1) {
      throw new Error(`suffix consonant ${char} has no Latin letter (position ${CONSONANT_ORDER.length + 1} or later)`);
    }
    return String.fromCharCode(65 + index);
  });
  return letters.join('');
}
