import { cleanLegalText } from './display';

export interface LedeInput {
  number: string;
  title: string;
  clauses: Array<{ text: string }>;
  explainer?: string;
}

/**
 * Generates the 40 to 60 word answer lede for an article page. For articles
 * with an explainer, the explainer is the lede. For the rest, the lede is
 * derived from the title and the first clause of the official text. Never
 * invents facts: every sentence comes from the article's own text.
 */
export function buildLede(article: LedeInput, allClauses?: Array<{ text: string }>): string {
  if (article.explainer) {
    return trimToBand(article.explainer);
  }

  const title = article.title.replace(/\.$/, '');
  const body = cleanLegalText((allClauses ?? article.clauses).map((c) => c.text).join(' '));
  return trimToBand(`${title}. ${body}`);
}

function trimToBand(text: string): string {
  const words = text.trim().split(/\s+/);

  if (words.length >= 40 && words.length <= 60) {
    return words.join(' ');
  }

  if (words.length > 60) {
    // Cut at the last sentence boundary inside the band when possible.
    let candidate = words.slice(0, 60).join(' ');
    const lastSentence = candidate.lastIndexOf('. ');
    if (lastSentence > 200) {
      candidate = candidate.slice(0, lastSentence + 1);
    } else {
      candidate = candidate + '.';
    }
    const candidateWords = candidate.split(/\s+/);
    if (candidateWords.length >= 40) {
      return candidate;
    }
    // Fallback: hard cut at 55 words.
    return words.slice(0, 55).join(' ') + '.';
  }

  // Under 40 words: use everything available.
  return words.join(' ');
}
