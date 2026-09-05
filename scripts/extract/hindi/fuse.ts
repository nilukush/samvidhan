import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Fusion driver (docs/HINDI-IMPLEMENTATION-PLAN.md H3). Reads
 * data/raw-hindi/pages.jsonl ({page, ocr, layer} per odd page), fuses each
 * page, writes data/raw-hindi/fused.jsonl ({page, text, flags}), and prints
 * the aggregate quality report: flag rate and linter violations on the fused
 * text versus each raw source.
 */

const INPUT = 'data/raw-hindi/pages.jsonl';
const OUTPUT = 'data/raw-hindi/fused.jsonl';

async function main(): Promise<void> {
  const { fusePage } = await import('../../../src/lib/hindi/fuse.ts');
  const { lintDevanagari } = await import('../../../src/lib/devanagari.ts');

  const records = readFileSync(INPUT, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { page: number; ocr: string; layer: string });

  const out: string[] = [];
  let flagCount = 0;
  let unresolved = 0;
  let oneSided = 0;
  let wordCount = 0;
  const fusedByRule = new Map<string, number>();
  const ocrByRule = new Map<string, number>();
  const layerByRule = new Map<string, number>();
  const bump = (map: Map<string, number>, rule: string) => map.set(rule, (map.get(rule) ?? 0) + 1);

  for (const record of records) {
    const fused = fusePage(record.ocr, record.layer);
    for (const issue of lintDevanagari(fused.text)) bump(fusedByRule, issue.rule);
    for (const issue of lintDevanagari(record.ocr)) bump(ocrByRule, issue.rule);
    for (const issue of lintDevanagari(record.layer)) bump(layerByRule, issue.rule);
    wordCount += fused.text.split(' ').filter((word) => word.length > 0).length;
    flagCount += fused.flags.length;
    for (const flag of fused.flags) {
      if (flag.ocr === null || flag.layer === null) oneSided += 1;
      else if (lintDevanagari(flag.word).length > 0) unresolved += 1;
    }
    out.push(JSON.stringify({ page: record.page, text: fused.text, flags: fused.flags }));
  }
  writeFileSync(OUTPUT, out.join('\n') + '\n');

  const fmt = (map: Map<string, number>): string =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rule, n]) => `${rule}:${n}`)
      .join(' ') || 'none';
  process.stdout.write(
    `pages: ${records.length}, fused words: ${wordCount}, flags: ${flagCount} (${((100 * flagCount) / Math.max(wordCount, 1)).toFixed(2)}%) [one-sided: ${oneSided}, unresolved: ${unresolved}]\n`,
  );
  process.stdout.write(`linter on fused:  ${fmt(fusedByRule)}\n`);
  process.stdout.write(`linter on ocr:    ${fmt(ocrByRule)}\n`);
  process.stdout.write(`linter on layer:  ${fmt(layerByRule)}\n`);
  process.stdout.write(`wrote ${OUTPUT}\n`);
}

void main();
