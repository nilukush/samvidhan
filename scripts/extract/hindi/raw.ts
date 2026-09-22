import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { assertSafeFetchUrl } from '../../../src/lib/net.ts';

/**
 * Hindi raw extraction (docs/HINDI-IMPLEMENTATION-PLAN.md H2). For every odd
 * page of the Rajbhasha diglot volume (the Hindi side), produce a cached
 * per-page record with the OCR text (tesseract, orthography source) and the
 * Poppler text-layer dump (skeleton source). Everything lands under
 * data/raw-hindi/ which is gitignored; the fused and parsed outputs derived
 * from it are what gets committed.
 *
 * Usage: npm run hindi:raw -- [--from N] [--to N]
 * OCR needs tesseract; on this Mac it is an Intel binary, so run from an
 * x86_64 node or a Rosetta terminal when a future edition needs re-OCR.
 * Cache-aware: pages with an existing record are skipped, so the run resumes
 * after interruption. The source PDF is split once into per-page files under
 * data/raw-hindi/separated so child processes take page data only after an
 * option terminator. Nothing is written under /tmp (tesseract/Leptonica
 * cannot read images from there on this machine).
 */

const PDF_PATH = 'data/source/constitution-of-india-hindi.pdf';
const CACHE_DIR = 'data/raw-hindi/pages';
const IMG_DIR = 'data/raw-hindi/img';
const TESSDATA_DIR = 'data/raw-hindi/tessdata';
const SEP_DIR = 'data/raw-hindi/separated';
const TESSDATA_BASE = 'https://github.com/tesseract-ocr/tessdata_best/raw/main';

async function ensureTessdata(): Promise<void> {
  mkdirSync(TESSDATA_DIR, { recursive: true });
  for (const model of ['hin.traineddata', 'osd.traineddata']) {
    const target = `${TESSDATA_DIR}/${model}`;
    if (!existsSync(target)) {
      const url = `${TESSDATA_BASE}/${model}`;
      assertSafeFetchUrl(url);
      process.stdout.write(`fetching ${model}... `);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`fetching ${model} failed: HTTP ${response.status}`);
      }
      writeFileSync(target, Buffer.from(await response.arrayBuffer()));
      process.stdout.write('done\n');
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

/**
 * Page numbers reach child process arguments only through this gate. pageArg
 * already rejects anything but a positive integer; digits() re-asserts that
 * the rendered value is digit only, so a child argument built from it can
 * never be read as an option or a flag.
 */
function digits(value: number): string {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new Error(`expected a digit only page number, got ${text}`);
  }
  return text;
}

/**
 * Page numbers reach file paths only through this gate. pageArg already
 * rejects anything but a positive integer; digits() re-asserts that the
 * rendered value is digit only, so the separated page lookup is always a
 * plain generated file name.
 */
function ensureSeparatedPages(): void {
  mkdirSync(SEP_DIR, { recursive: true });
  const marker = `${SEP_DIR}/source.txt`;
  const stats = statSync(PDF_PATH);
  const fingerprint = `${PDF_PATH} ${stats.size} ${stats.mtimeMs}`;
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === fingerprint) return;
  rmSync(SEP_DIR, { recursive: true, force: true });
  mkdirSync(SEP_DIR, { recursive: true });
  execFileSync('pdfseparate', ['--', PDF_PATH, `${SEP_DIR}/p%d.pdf`]);
  writeFileSync(marker, fingerprint);
}

function extractPage(page: number): void {
  const target = `${CACHE_DIR}/p${pad(page)}.json`;
  if (existsSync(target)) return;

  // The separated page is fed to poppler on stdin and rendered under a fixed
  // literal name, so no child process argument depends on the page number.
  const pageBytes = readFileSync(`${SEP_DIR}/p${digits(page)}.pdf`);
  execFileSync('pdftoppm', ['-r', '300', '-gray', '-png', '--', '-', 'page'], {
    cwd: IMG_DIR,
    input: pageBytes,
  });
  const img = `${IMG_DIR}/page-1.png`;
  let ocr: string;
  try {
    ocr = execFileSync('tesseract', ['stdin', '-', '-l', 'hin', '--psm', '1'], {
      encoding: 'utf8',
      env: { ...process.env, TESSDATA_PREFIX: TESSDATA_DIR },
      input: readFileSync(img),
    });
  } catch (error: unknown) {
    const code = String((error as NodeJS.ErrnoException).code ?? '');
    if (code.includes('-86')) {
      throw new Error(
        'tesseract here is an Intel binary and this node process is arm64; macOS 25.6 does not translate spawned children. Run the script from an x86_64 node or a Rosetta terminal.',
        { cause: error },
      );
    }
    throw error;
  }
  const layer = execFileSync('pdftotext', ['-layout', '--', '-', '-'], {
    encoding: 'utf8',
    input: pageBytes,
  });
  rmSync(img);
  writeFileSync(target, JSON.stringify({ page, ocr, layer }));
}

function pageArg(args: string[], name: string, fallback: number): number {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  const raw = index === -1 ? undefined : args[index + 1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} expects a positive integer`);
  }
  return value;
}

async function main(): Promise<void> {
  if (!existsSync(PDF_PATH)) {
    throw new Error(`missing ${PDF_PATH}; vendor the Rajbhasha PDF first (see data/source/README.md)`);
  }
  const args = process.argv.slice(2);
  const from = pageArg(args, 'from', 1);
  const total = pageCount();
  const to = Math.min(pageArg(args, 'to', total), total);
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(IMG_DIR, { recursive: true });
  ensureSeparatedPages();
  await ensureTessdata();

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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
