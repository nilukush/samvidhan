/**
 * Chunks articles for embedding: 120 to 180 word windows that always break at
 * clause boundaries, falling back to sentence boundaries inside an oversized
 * clause. Titles and explainers are folded into the chunk text because most
 * real questions match them, not the legal prose.
 */

export interface ChunkInput {
  number: string;
  title: string;
  clauses: Array<{ text: string }>;
  explainer?: string;
}

export interface Chunk {
  articleNumber: string;
  text: string;
}

const MIN_WORDS = 120;
const MAX_WORDS = 180;

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function splitBySentence(text: string, maxWords: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current !== '' && wordCount(current) + wordCount(sentence) > maxWords) {
      pieces.push(current.trim());
      current = '';
    }
    current += ` ${sentence}`;
  }
  if (current.trim() !== '') pieces.push(current.trim());
  return pieces;
}

export function chunkArticle(article: ChunkInput): Chunk[] {
  const prefix = [article.title, article.explainer].filter(Boolean).join(' ');
  const units: string[] = [];
  if (prefix !== '') units.push(prefix);
  for (const clause of article.clauses) {
    const count = wordCount(clause.text);
    if (count > MAX_WORDS) {
      units.push(...splitBySentence(clause.text, MAX_WORDS));
    } else {
      units.push(clause.text.trim());
    }
  }

  const chunks: Chunk[] = [];
  let buffer = '';
  for (const unit of units) {
    if (buffer !== '' && wordCount(buffer) + wordCount(unit) > MAX_WORDS) {
      if (wordCount(buffer) >= MIN_WORDS / 2) {
        chunks.push({ articleNumber: article.number, text: buffer.trim() });
        buffer = '';
      } else {
        // A tiny buffer (say a short title) absorbs sentence pieces of the
        // unit up to the cap and keeps the remainder for the next chunk.
        const pieces = splitBySentence(unit, MAX_WORDS - wordCount(buffer));
        for (const piece of pieces.slice(0, -1)) buffer += ` ${piece}`;
        chunks.push({ articleNumber: article.number, text: buffer.trim() });
        buffer = pieces[pieces.length - 1] ?? '';
        continue;
      }
    }
    buffer += ` ${unit}`;
    if (wordCount(buffer) >= MIN_WORDS) {
      chunks.push({ articleNumber: article.number, text: buffer.trim() });
      buffer = '';
    }
  }
  if (buffer.trim() !== '') {
    chunks.push({ articleNumber: article.number, text: buffer.trim() });
  }
  return chunks;
}
