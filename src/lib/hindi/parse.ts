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

/** Heading shape: digits, optional Devanagari letter suffix, full stop. */
const HEADING_RE = /^(\d{1,3})?([क-ह]+)?\.\s+(.+)$/;

export interface ArticleHeading {
  numberHi: string;
  latin: string;
  rest: string;
}

/**
 * A body article heading: "2. परिभाषा-..." with Devanagari letter suffixes
 * converted positionally to the English edition's Latin ones. Marker digits
 * fused onto the number by the PDF (the 4268A shape from the English
 * pipeline) resolve by trying the trailing digit tails.
 */
export function parseArticleHeading(line: string, suffixMap: Record<string, string> = {}): ArticleHeading | null {
  const trimmed = line.trim();
  if (/^\(/.test(trimmed)) return null;
  const match = /^(\d{1,4})?([क-ह]{1,2})?[.।]\s+(.+)$/.exec(trimmed);
  if (match === null) return null;
  const digits = match[1] ?? '';
  const suffix = match[2] ?? '';
  const rest = match[3] ?? '';
  if (digits === '') return null;
  if (rest.length < 3) return null;
  if (Math.min(...[digits, digits.slice(-3), digits.slice(-2)].map((d) => Number(d))) > 395) return null;
  // Reject footnote-shaped lines: short numbering plus a citation signal.
  if (CITATION_SIGNALS.some((signal) => rest.includes(signal)) && trimmed.length < 120 && /^\d{1,2}$/.test(digits)) {
    return null;
  }

  // Marker-digit fusion: try the full digits, then the 3- and 2-digit tails.
  for (const candidate of [digits, digits.slice(-3), digits.slice(-2)]) {
    const numberHi = candidate + suffix;
    if (suffixMap[numberHi] !== undefined) {
      return { numberHi, latin: suffixMap[numberHi], rest };
    }
  }
  const latin = suffix === '' ? digits : digits + suffixToLatin(suffix);
  return { numberHi: digits + suffix, latin, rest };
}

/** Classify a fused line for the parser. */
export function classifyLine(line: string): LineKind {
  const trimmed = line.trim();
  if (trimmed === 'भारत का संविधान' || trimmed === 'THE CONSTITUTION OF INDIA') return 'furniture';
  if (/^\d{1,3}$/.test(trimmed)) return 'furniture';
  if (/^\(भाग\s/.test(trimmed) && /\)$/.test(trimmed)) return 'furniture';
  if (/^\d{1,2}[.।]\s/.test(trimmed) && CITATION_SIGNALS.some((signal) => trimmed.includes(signal))) {
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
