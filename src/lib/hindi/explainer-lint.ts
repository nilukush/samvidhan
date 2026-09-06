import { lintDevanagari } from '../devanagari';

/**
 * Machine style gate for the Hindi plain-words explainers (Phase 3). The
 * kickoff decision, recorded in docs/HINDI-IMPLEMENTATION-PLAN.md: the
 * English Flesch-Kincaid grade does NOT apply to Hindi. FK is validated on
 * English syllable structure; counting Devanagari syllables from matras is
 * unreliable (halant conjuncts collapse, inherent vowels are implicit), and
 * no standard Hindi FK exists. The documented lighter gate replaces it:
 * a length band, a sentence-structure plainness proxy, the Hindi banned
 * filler list (the same AI-writing-tell ban as English), no em or en dashes,
 * a language check, and the Devanagari well-formedness linter.
 *
 * Tested in tests/unit/hindi-explainer-lint.test.ts.
 */

export interface HindiLintIssue {
  rule: 'length' | 'banned-phrase' | 'dash' | 'plainness' | 'language' | 'devanagari';
  message: string;
}

const BANNED_PHRASES = [
  'यह ध्यान देने योग्य है',
  'यह ध्यान रखने योग्य है',
  'यह नोट करने योग्य है',
  'कुल मिलाकर',
  'संक्षेप में',
  'दूसरे शब्दों में',
  'महत्वपूर्ण बात यह है',
  'आइए',
  'आइये',
  'वास्तव में',
  'निष्कर्षतः',
  'सरल शब्दों में',
];

export function lintHindiExplainer(text: string): HindiLintIssue[] {
  const issues: HindiLintIssue[] = [];
  const trimmed = text.trim();
  const words = trimmed === '' ? [] : trimmed.split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 30 || wordCount > 110) {
    issues.push({ rule: 'length', message: `explainer is ${wordCount} words, must be 30 to 110` });
  }

  const lower = trimmed.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({ rule: 'banned-phrase', message: `banned filler phrase: ${phrase}` });
    }
  }

  if (trimmed.includes('—') || trimmed.includes('–') || trimmed.includes('--')) {
    issues.push({ rule: 'dash', message: 'em or en dashes are banned; use a comma or a semicolon' });
  }

  const sentences = trimmed
    .split(/[।!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length > 7) {
    issues.push({ rule: 'plainness', message: `${sentences.length} sentences; keep to 7 or fewer` });
  }
  const average = sentences.length === 0 ? 0 : wordCount / sentences.length;
  if (average > 22) {
    issues.push({ rule: 'plainness', message: `average sentence is ${average.toFixed(1)} words; keep to 22 or fewer` });
  }

  const devanagariChars = (trimmed.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagariChars / Math.max(trimmed.length, 1) < 0.5) {
    issues.push({ rule: 'language', message: 'explainer must be written in Hindi (Devanagari)' });
  }

  const scriptIssues = lintDevanagari(trimmed);
  if (scriptIssues.length > 0) {
    issues.push({
      rule: 'devanagari',
      message: `${scriptIssues.length} well-formedness issues (first: ${scriptIssues[0]?.rule})`,
    });
  }

  return issues;
}
