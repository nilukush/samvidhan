import { lintDevanagari } from '../devanagari';

/**
 * Linter-directed repair of the PDF's displaced i-matra (H6). The text layer
 * emits Devanagari in visual order, so a ि that belongs after a consonant
 * surfaces one position early: before the consonant (word-initial) or after
 * a preceding vowel sign. The displacement is deterministic in both
 * directions, so at each flagged position the ि moves one consonant to its
 * right; a repair that would still leave a violation is reverted and the
 * word stays on the review list instead of being guessed at.
 *
 * Also normalizes the mechanical OCR residue: pipe read for danda next to
 * Devanagari, and stray ZWNJ.
 */

const CONSONANT = /[\u0915-\u0939]/;

export function repairDevanagari(text: string): string {
  let out = text.replace(/\u200C/g, '');
  out = out.replace(/([\u0900-\u097F])\s*\|/g, '$1 \u0964').replace(/\|\s*([\u0900-\u097F])/g, '\u0964 $1');

  let issues = lintDevanagari(out);
  let guard = 0;
  while (issues.length > 0 && guard < 200) {
    guard += 1;
    let repaired = false;
    for (const candidateIssue of issues) {
      if (candidateIssue.rule !== 'sign-after-sign' && candidateIssue.rule !== 'sign-at-start') continue;
      const next = out[candidateIssue.index + 1] ?? '';
      if (!CONSONANT.test(next)) continue;
      const chars = [...out];
      const matra = chars[candidateIssue.index] as string;
      chars.splice(candidateIssue.index, 2, next, matra);
      const candidate = chars.join('');
      if (lintDevanagari(candidate).length < issues.length) {
        out = candidate;
        repaired = true;
        break;
      }
    }
    if (!repaired) break;
    issues = lintDevanagari(out);
  }
  return out;
}
