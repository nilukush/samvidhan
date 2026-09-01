/**
 * Display helpers shared by pages. Pure functions only, tested in
 * tests/unit/display.test.ts.
 */

/**
 * Removes the editorial apparatus of the official edition for reading:
 * footnote marker digits fused to brackets, insertion brackets, and orphan
 * closing brackets. The legal text between them is never altered.
 */
export function cleanLegalText(text: string): string {
  return text
    .replace(/\d{1,2}\s*\[/g, ' [')
    .replace(/\[\s*/g, ' ')
    .replace(/\s*\]/g, ' ')
    .replace(/\s+([.,;:)])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ClauseBearer {
  clauses: Array<{ text: string }>;
}

/** First four digit year in the body, used for "Omitted 1978" style badges. */
export function statusYear(article: ClauseBearer): string | null {
  const body = article.clauses.map((clause) => clause.text).join(' ');
  const match = /\b(19\d\d|20\d\d)\b/.exec(body);
  return match === null ? null : (match[1] as string);
}

const ROMAN_PAIRS: Array<[number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Part label for display: 3 becomes III, 4A becomes IVA. */
export function toRomanPart(part: string): string {
  const match = /^(\d{1,2})([A-B]?)$/.exec(part);
  if (match === null) return part;
  let remainder = Number(match[1]);
  let roman = '';
  for (const [value, glyph] of ROMAN_PAIRS) {
    while (remainder >= value) {
      roman += glyph;
      remainder -= value;
    }
  }
  return roman + (match[2] ?? '');
}

/** Sort key so 2 < 2A < 10 < 14 < 14A in document order. */
export function articleSortKey(number: string): number {
  return Number.parseInt(number, 10);
}

export interface ArticleNumberBearer {
  data: { number: string };
}

/** Comparator over collection entries in document order. */
export function compareByDocumentOrder(a: ArticleNumberBearer, b: ArticleNumberBearer): number {
  return articleSortKey(a.data.number) - articleSortKey(b.data.number) || a.data.number.localeCompare(b.data.number);
}
