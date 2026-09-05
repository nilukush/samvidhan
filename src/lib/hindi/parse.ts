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
 * A body article heading: "2. परिभाषा-..." with the Devanagari suffix map
 * converting letter suffixes to the English edition's Latin ones. Marker
 * digits fused onto the number by the PDF (the 4268A shape from the English
 * pipeline) are handled by preferring the suffix map and falling back to the
 * trailing digits plus suffix.
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
  // Reject footnote-shaped lines: short numbering plus a citation signal.
  if (CITATION_SIGNALS.some((signal) => rest.includes(signal)) && trimmed.length < 120 && /^\d{1,2}$/.test(digits)) {
    return null;
  }

  let numberHi = digits + suffix;
  if (suffixMap[numberHi] !== undefined) {
    return { numberHi, latin: suffixMap[numberHi], rest };
  }
  // Marker-digit fusion: the true number is the last 1-3 digits; a suffix map
  // entry proves which tail is real (the 1268क -> 268A shape).
  for (const cut of [1, 2]) {
    const tail = digits.slice(cut === 1 ? -3 : -2) + suffix;
    if (suffixMap[tail] !== undefined) {
      numberHi = tail;
      return { numberHi, latin: suffixMap[tail], rest };
    }
  }
  return { numberHi, latin: numberHi, rest };
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
