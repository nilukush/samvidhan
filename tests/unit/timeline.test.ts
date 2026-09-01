import { describe, expect, test } from 'vitest';
import { numberToOrdinalWords } from '../../scripts/extract/ordinals';
import { ordinalWordToNumber } from '../../scripts/extract/ordinals';
import { buildTimeline } from '../../src/lib/timeline';
import type { TimelineAmendment } from '../../src/lib/timeline';

describe('numberToOrdinalWords', () => {
  test.each([
    [1, 'First'],
    [7, 'Seventh'],
    [21, 'Twenty-first'],
    [24, 'Twenty-fourth'],
    [44, 'Forty-fourth'],
    [73, 'Seventy-third'],
    [100, 'One hundredth'],
    [101, 'One hundred and first'],
    [106, 'One hundred and sixth'],
  ])('renders %i as %s', (n, expected) => {
    expect(numberToOrdinalWords(n)).toBe(expected);
  });

  test('round trips with ordinalWordToNumber for every amendment number', () => {
    for (let n = 1; n <= 106; n++) {
      expect(ordinalWordToNumber(numberToOrdinalWords(n))).toBe(n);
    }
  });
});

const fixtureAmendments: TimelineAmendment[] = Array.from({ length: 106 }, (_, i) => ({
  number: i + 1,
  year: 1951 + i,
  title: `Amendment ${i + 1}`,
  articlesAffected: [],
  theme: i % 2 === 0 ? 'rights' : 'federal',
})).map((entry, i) => (i === 41 ? { ...entry, year: 1976 } : entry));

describe('buildTimeline', () => {
  const timeline = buildTimeline(fixtureAmendments, { width: 1200, height: 160 });

  test('renders one node per amendment, in document order', () => {
    expect(timeline.nodes).toHaveLength(106);
    expect(timeline.nodes[0]?.amendment.number).toBe(1);
    expect(timeline.nodes[105]?.amendment.number).toBe(106);
  });

  test('every node links to its amendment page', () => {
    for (const node of timeline.nodes) {
      expect(node.href).toBe(`/amendments/${node.amendment.number}/`);
    }
  });

  test('x positions are non decreasing in year and same year nodes stack vertically', () => {
    for (let i = 1; i < timeline.nodes.length; i++) {
      const prev = timeline.nodes[i - 1] as (typeof timeline.nodes)[number];
      const current = timeline.nodes[i] as (typeof timeline.nodes)[number];
      if (current.amendment.year === prev.amendment.year) {
        expect(current.x).toBe(prev.x);
        // Stacking goes upward on screen, so later stack rows have smaller y.
        expect(current.y).toBeLessThan(prev.y);
      } else {
        expect(current.x).toBeGreaterThan(prev.x);
      }
    }
  });

  test('nodes stay inside the viewBox', () => {
    for (const node of timeline.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1200);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(160);
    }
  });
});
