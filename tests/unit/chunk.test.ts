import { describe, expect, test } from 'vitest';
import { chunkArticle } from '../../src/lib/chunk';

const words = (count: number, seed = 1): string => Array.from({ length: count }, (_, i) => `w${seed}${i}`).join(' ');

describe('article chunker', () => {
  test('closes chunks at clause boundaries between 120 and 180 words', () => {
    const clauses = Array.from({ length: 10 }, (_, i) => ({ text: words(30, i + 1) }));
    const chunks = chunkArticle({ number: '1', title: 'Test', clauses });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const [index, chunk] of chunks.entries()) {
      const count = chunk.text.split(/\s+/).length;
      // The final chunk of an article may be the short remainder.
      if (index < chunks.length - 1) {
        expect(count, `chunk ${index} has ${count} words`).toBeGreaterThanOrEqual(120);
      }
      expect(count).toBeLessThanOrEqual(180);
    }
    // Chunk boundaries align with clause starts: the first word of chunk 2 is
    // the first word of some clause.
    const firstWords = new Set(clauses.map((clause) => clause.text.split(/\s+/)[0]));
    for (const chunk of chunks.slice(1)) {
      expect(firstWords.has(chunk.text.split(/\s+/)[0] as string)).toBe(true);
    }
  });

  test('splits a single oversized clause by sentence within the word cap', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} ${words(12, i + 1)}.`);
    const clauses = [{ text: sentences.join(' ') }];
    const chunks = chunkArticle({ number: '2', title: '', clauses });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      const count = chunk.text.split(/\s+/).length;
      expect(count).toBeLessThanOrEqual(180);
    }
    // Sentence alignment: every chunk starts with a sentence start.
    const sentenceStarts = new Set(sentences.map((sentence) => sentence.split(/\s+/)[0]));
    for (const chunk of chunks) {
      expect(sentenceStarts.has(chunk.text.split(/\s+/)[0] as string)).toBe(true);
    }
  });

  test('a short article stays one chunk and carries its article number', () => {
    const chunks = chunkArticle({ number: '14', title: 'Equality', clauses: [{ text: words(30, 9) }] });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.articleNumber).toBe('14');
    expect(chunks[0]?.text).toContain('w91');
  });

  test('explanations and titles join the chunk text when present', () => {
    const chunks = chunkArticle({
      number: '21',
      title: 'Protection of life and personal liberty',
      clauses: [{ text: words(30, 4) }],
      explainer: 'This article protects life and liberty in plain words.',
    });
    expect(chunks[0]?.text).toContain('Protection of life and personal liberty');
    expect(chunks[0]?.text).toContain('plain words');
  });
});
