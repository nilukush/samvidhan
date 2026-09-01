/**
 * Pure builder for the amendments timeline SVG. Deterministic geometry so it
 * can be unit tested: one node per amendment, x by year, vertical stacking
 * inside a year so dense clusters never shrink targets.
 */

export interface TimelineAmendment {
  number: number;
  year: number;
  title: string;
  articlesAffected: string[];
  theme: 'rights' | 'federal' | 'emergency' | 'social' | 'general';
}

export interface TimelineNode {
  amendment: TimelineAmendment;
  x: number;
  y: number;
  href: string;
}

export interface TimelineGeometry {
  nodes: TimelineNode[];
  width: number;
  height: number;
  /** Year tick marks along the band. */
  ticks: Array<{ year: number; x: number; label: string }>;
}

export const TIMELINE_THEMES: Record<TimelineAmendment['theme'], string> = {
  rights: 'var(--color-green)',
  federal: 'var(--color-navy)',
  emergency: 'var(--color-red)',
  social: 'var(--color-saffron)',
  general: 'var(--color-ink)',
};

export function buildTimeline(
  amendments: TimelineAmendment[],
  options: { width: number; height: number },
): TimelineGeometry {
  const { width, height } = options;
  const sorted = [...amendments].sort((a, b) => a.year - b.year || a.number - b.number);
  if (sorted.length === 0) {
    return { nodes: [], width, height, ticks: [] };
  }

  const firstYear = sorted[0]!.year;
  const lastYear = sorted[sorted.length - 1]!.year;
  const yearSpan = Math.max(lastYear - firstYear, 1);
  const leftPad = 24;
  const rightPad = 24;
  const usable = width - leftPad - rightPad;

  const nodes: TimelineNode[] = [];
  const stackHeights = new Map<number, number>();
  const rowHeight = 14;
  const baseline = height - 28;
  const maxRows = Math.floor((baseline - 8) / rowHeight);

  for (const amendment of sorted) {
    const x = leftPad + ((amendment.year - firstYear) / yearSpan) * usable;
    const stackIndex = stackHeights.get(amendment.year) ?? 0;
    stackHeights.set(amendment.year, stackIndex + 1);
    const y = baseline - (stackIndex % Math.max(maxRows, 1)) * rowHeight;
    nodes.push({
      amendment,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      href: `/amendments/${amendment.number}/`,
    });
  }

  const ticks: TimelineGeometry['ticks'] = [];
  const tickEvery = yearSpan <= 20 ? 1 : yearSpan <= 45 ? 5 : 10;
  for (let year = Math.ceil(firstYear / tickEvery) * tickEvery; year <= lastYear; year += tickEvery) {
    ticks.push({
      year,
      x: Number((leftPad + ((year - firstYear) / yearSpan) * usable).toFixed(1)),
      label: String(year),
    });
  }

  return { nodes, width, height, ticks };
}
