/**
 * Devanagari well-formedness linter. Data-quality gate for the Hindi edition
 * (docs/HINDI-IMPLEMENTATION-PLAN.md H1): catches the artifacts the corrupted
 * text layer and OCR actually produce, with the rule names the extraction
 * report aggregates on. Pure functions only, tested in
 * tests/unit/devanagari.test.ts.
 *
 * Documented limitation: a silently DROPPED i-matra (संविधान extracted as
 * संवधान) produces a valid-looking word no linter can see. That class is
 * handled by the two-source fusion cross-check, not here.
 */

/** Dependent vowel signs: must attach to a preceding consonant. */
const VOWEL_SIGNS = new Set([
  '\u093E',
  '\u093F',
  '\u0940',
  '\u0941',
  '\u0942',
  '\u0943',
  '\u0944',
  '\u0945',
  '\u0946',
  '\u0947',
  '\u0948',
  '\u0949',
  '\u094A',
  '\u094B',
  '\u094C',
]);
/** Letters (consonants, independent vowels, digits) in the block. */
function isDevanagariLetter(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x0900 && code <= 0x097f) || (code >= 0x1cd0 && code <= 0x1cff);
}

export interface DevanagariIssue {
  /** Character offset of the offending glyph in the input string. */
  index: number;
  /** Rule identifier: replacement, private-use, zwnj, pipe-danda, sign-after-sign, sign-at-start. */
  rule: string;
  /** Short context window around the offense. */
  excerpt: string;
}

function issue(text: string, index: number, rule: string): DevanagariIssue {
  return { index, rule, excerpt: text.slice(Math.max(0, index - 4), index + 5) };
}

function isWordStart(text: string, i: number): boolean {
  let j = i - 1;
  while (j >= 0) {
    const char = text[j];
    if (/\s/.test(char)) return true;
    if (isDevanagariLetter(char) || /[.,;:()[\]"'\u0964\u0965\d]/.test(char)) return false;
    j -= 1;
  }
  return true;
}

export function lintDevanagari(text: string): DevanagariIssue[] {
  const issues: DevanagariIssue[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const code = char.codePointAt(0) ?? 0;
    if (char === '\uFFFD') {
      issues.push(issue(text, i, 'replacement'));
    } else if (code >= 0xe000 && code <= 0xf8ff) {
      issues.push(issue(text, i, 'private-use'));
    } else if (char === '\u200C') {
      issues.push(issue(text, i, 'zwnj'));
    } else if (char === '|') {
      const before = text.slice(Math.max(0, i - 3), i);
      const after = text.slice(i + 1, i + 4);
      if (/[\u0900-\u097F]\s*$/.test(before) || /^\s*[\u0900-\u097F]/.test(after)) {
        issues.push(issue(text, i, 'pipe-danda'));
      }
    } else if (VOWEL_SIGNS.has(char)) {
      const prev = text[i - 1] ?? '';
      if (isWordStart(text, i)) {
        issues.push(issue(text, i, 'sign-at-start'));
      } else if (VOWEL_SIGNS.has(prev) || prev === '\u093C' || prev === '\u094D') {
        issues.push(issue(text, i, 'sign-after-sign'));
      }
    } else if (char === '\u093C' && VOWEL_SIGNS.has(text[i - 1] ?? '')) {
      issues.push(issue(text, i, 'sign-after-sign'));
    }
  }
  return issues;
}
