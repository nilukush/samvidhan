/**
 * Machine style gate for plain words explainers. Every explainer in
 * data/processed/explainers/explainers.json must pass lintExplainer with
 * zero issues before it ships (tests/unit/explainer.test.ts).
 *
 * Rules reflect docs/DESIGN-SYSTEM.md section 9 and the project constraint
 * banning AI writing tells: length 40 to 140 words, no banned phrases, no
 * em or en dashes, Flesch-Kincaid grade inside 7 to 11 (aim 8 to 10).
 */

export interface LintIssue {
  rule: 'length' | 'banned-phrase' | 'dash' | 'reading-level';
  message: string;
}

const BANNED_PHRASES = [
  'delve',
  'moreover',
  'furthermore',
  'it is important to note',
  'in conclusion',
  "in today's",
  'fast-paced',
  'plays a crucial role',
  'it is worth noting',
  'a testament to',
];

export function lintExplainer(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const trimmed = text.trim();
  const words = trimmed === '' ? [] : trimmed.split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 40 || wordCount > 140) {
    issues.push({ rule: 'length', message: `explainer is ${wordCount} words, must be 40 to 140` });
  }

  const lower = trimmed.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({ rule: 'banned-phrase', message: `contains banned phrase "${phrase}"` });
    }
  }

  if (/[\u2013\u2014]/.test(trimmed)) {
    issues.push({ rule: 'dash', message: 'contains an em or en dash character' });
  }

  if (wordCount >= 20) {
    const grade = fleschKincaidGrade(trimmed);
    if (grade > 11 || grade < 5) {
      issues.push({
        rule: 'reading-level',
        message: `Flesch-Kincaid grade ${grade.toFixed(1)} is outside the 5 to 11 band`,
      });
    }
  }

  return issues;
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length <= 3) return 1;
  const groups = clean
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(groups ? groups.length : 1, 1);
}

function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const wordsPerSentence = words.length / sentences;
  const syllablesPerWord = syllables / Math.max(words.length, 1);
  return 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
}
