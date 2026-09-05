import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Hindi raw extraction (docs/HINDI-IMPLEMENTATION-PLAN.md H2). For every odd
 * page of the Rajbhasha diglot volume (the Hindi side), produce a cached
 * per-page record with the OCR text (tesseract, orthography source) and the
 * Poppler text-layer dump (skeleton source). Everything lands under
 * data/raw-hindi/ which is gitignored; the fused and parsed outputs derived
 * from it are what gets committed.
 *
 * Usage: npx tsx scripts/extract/hindi/raw.ts [--from N] [--to N]
 * Cache-aware: pages with an existing record are skipped, so the run resumes
 * after interruption. Nothing is written under /tmp (tesseract/Leptonica
 * cannot read images from there on this machine).
 */

const PDF_PATH = 'data/source/constitution-of-india-hindi.pdf';
const CACHE_DIR = 'data/raw-hindi/pages';
const IMG_DIR = 'data/raw-hindi/img';
const TESSDATA_DIR = 'data/raw-hindi/tessdata';
const TESSDATA_BASE = 'https://github.com/tesseract-ocr/tessdata_best/raw/main';

function ensureTessdata(): void {
  mkdirSync(TESSDATA_DIR, { recursive: true });
  for (const model of ['hin.traineddata', 'osd.traineddata']) {
    const target = `${TESSDATA_DIR}/${model}`;
    if (!existsSync(target)) {
      process.stdout.write(`fetching ${model}... `);
      execFileSync('curl', ['-sL', '-o', target, `${TESSDATA_BASE}/${model}`], { stdio: 'inherit' });
    }
  }
}

function pageCount(): number {
  const info = execFileSync('pdfinfo', [PDF_PATH], { encoding: 'utf8' });
  const match = /^Pages:\s+(\d+)$/m.exec(info);
  if (match === null) throw new Error('pdfinfo did not report a page count');
  return Number(match[1]);
}

function pad(page: number): string {
  return String(page).padStart(3, '0');
}

function extractPage(page: number): void {
  const target = `${CACHE_DIR}/p${pad(page)}.json`;
  if (existsSync(target)) return;

  const imgPrefix = `${IMG_DIR}/p${pad(page)}`;
  execFileSync('pdftoppm', ['-f', String(page), '-l', String(page), '-r', '300', '-gray', '-png', PDF_PATH, imgPrefix]);
  const img = `${imgPrefix}-${pad(page)}.png`;
  const ocr = execFileSync('tesseract', [img, '-', '-l', 'hin', '--psm', '1'], {
    encoding: 'utf8',
    env: { ...process.env, TESSDATA_PREFIX: TESSDATA_DIR },
  });
  const layer = execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', PDF_PATH, '-'], {
    encoding: 'utf8',
  });
  execFileSync('rm', [img]);
  writeFileSync(target, JSON.stringify({ page, ocr, layer }));
}

function main(): void {
  if (!existsSync(PDF_PATH)) {
    throw new Error(`missing ${PDF_PATH}; vendor the Rajbhasha PDF first (see data/source/README.md)`);
  }
  const args = process.argv.slice(2);
  const from = Number(args[args.indexOf('--from') + 1] || 1);
  const total = pageCount();
  const to = Math.min(Number(args[args.indexOf('--to') + 1] || total), total);
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(IMG_DIR, { recursive: true });
  ensureTessdata();

  const oddPages: number[] = [];
  for (let page = from; page <= to; page += 1) {
    if (page % 2 === 1) oddPages.push(page);
  }
  const pending = oddPages.filter((page) => !existsSync(`${CACHE_DIR}/p${pad(page)}.json`));
  process.stdout.write(`hindi raw extraction: ${oddPages.length} odd pages in range, ${pending.length} to extract\n`);

  let done = 0;
  for (const page of oddPages) {
    extractPage(page);
    done += 1;
    if (done % 25 === 0) process.stdout.write(`  ${done}/${oddPages.length} processed\n`);
  }

  const records = oddPages
    .map((page) => readFileSync(`${CACHE_DIR}/p${pad(page)}.json`, 'utf8'))
    .map((raw) => JSON.parse(raw) as unknown);
  writeFileSync('data/raw-hindi/pages.jsonl', records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  process.stdout.write(`wrote data/raw-hindi/pages.jsonl (${records.length} pages)\n`);
}

main();
