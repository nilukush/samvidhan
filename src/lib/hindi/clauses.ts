/**
 * Hindi clause splitting (the post-merge refinement pass). The fused article
 * text is one flowing block; clause enumerations - (1), (2), (1क), (क) - and
 * explanation headings recover the legal structure. A marker splits only at
 * a boundary (start of text, or after a danda, semicolon, colon, comma,
 * closing bracket, or dash), so mid-sentence references like
 * "खंड (1) के अधीन" never split. Pure function, tested in
 * tests/unit/hindi-clauses.test.ts.
 */

export interface HindiClause {
  text: string;
  number: string | null;
  kind: 'clause' | 'explanation' | 'illustration';
}

/** Clause markers: (N), (Nक), (क), optionally inside an insertion bracket. */
const NUMBERED = /\[?\((\d{1,2}[क-ह]?|[क-ह])\)\s*/gu;
const EXPLANATION = /(?:^|\s)(स्पष्टीकरण)[-\s]/u;
const ILLUSTRATION = /(?:^|\s)(उदाहरण|दृष्टांत)[-\s]/u;

/** The boundary rule: what may immediately precede a splitting marker. */
function atBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  let j = index - 1;
  if (text[j] === '[') j -= 1; // insertion bracket before the marker
  while (j >= 0 && /\s/.test(text[j] ?? '')) j -= 1;
  const prev = text[j] ?? '';
  if (prev === '') return true;
  if ('।;:,–—]-)'.includes(prev)) return true;
  // The enumeration conjunction: "...राज्यक्षेत्र; और (ग) ऐसे अन्य..."
  if (prev === 'र' && text.slice(j - 1, j + 1) === 'और') return true;
  return false;
}

export function splitHindiClauses(text: string): HindiClause[] {
  // Empty-paren noise from OCR ("() (1) प्रत्येक...", "(|) (1) राज्यपाल...").
  const cleaned = text
    .replace(/\(\s*[|।]?\s*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return [];

  interface Cut {
    at: number;
    markerLength: number;
    number: string | null;
    kind: HindiClause['kind'];
  }
  const cuts: Cut[] = [];
  for (const match of cleaned.matchAll(NUMBERED)) {
    const at = match.index ?? 0;
    if (!atBoundary(cleaned, at)) continue;
    cuts.push({ at, markerLength: (match[0] ?? '').length, number: match[1] ?? null, kind: 'clause' });
  }
  for (const [pattern, kind] of [
    [EXPLANATION, 'explanation'],
    [ILLUSTRATION, 'illustration'],
  ] as const) {
    const match = pattern.exec(cleaned);
    if (match === null) continue;
    const at = match.index ?? 0;
    if (!atBoundary(cleaned, at)) continue;
    cuts.push({ at, markerLength: 1, number: null, kind });
  }
  cuts.sort((a, b) => a.at - b.at);

  const clauses: HindiClause[] = [];
  const head = cleaned
    .slice(0, cuts.length ? (cuts[0] as Cut).at : cleaned.length)
    .replace(/[\s;]+$/u, '')
    .trim();
  if (head.length > 0) clauses.push({ text: head, number: null, kind: 'clause' });

  for (let i = 0; i < cuts.length; i += 1) {
    const cut = cuts[i] as Cut;
    const end = i + 1 < cuts.length ? (cuts[i + 1] as Cut).at : cleaned.length;
    const markerStart = cut.kind === 'clause' ? cut.at : cut.at + cut.markerLength;
    const bodyStart = cut.kind === 'clause' ? cut.at + cut.markerLength : markerStart;
    const body = cleaned
      .slice(bodyStart, end)
      .replace(/^[-–—\s]+/u, '')
      .replace(/[\s;]+$/u, '')
      .trim();
    if (body.length === 0) continue;
    clauses.push({ text: body, number: cut.number, kind: cut.kind });
  }
  return clauses;
}
