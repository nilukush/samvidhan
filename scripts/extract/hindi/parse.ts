import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

/**
 * Hindi body parser driver (docs/HINDI-IMPLEMENTATION-PLAN.md H4/H5). Fuses
 * the cached odd pages from 63 on, walks the body lines (furniture and
 * citation footnotes classified out), splits article headings from clause
 * text, and writes intermediate articles to data/raw-hindi/articles.json.
 *
 * The English edition's article set is the whitelist: both official editions
 * carry the same 504 articles, so a heading outside it, or out of document
 * order, goes to the review list instead of silently entering the corpus.
 * Safe to run on partial caches (the report scopes to what is cached).
 */

import { fusePage } from '../../../src/lib/hindi/fuse.ts';
import { classifyLine, parseArticleHeading, suffixToLatin } from '../../../src/lib/hindi/parse.ts';

const CACHE_DIR = 'data/raw-hindi/pages';
const OUTPUT = 'data/raw-hindi/articles.json';

interface ParsedArticle {
  number: string;
  numberHi: string;
  title: string;
  text: string;
  page: number;
}

/** OCR reads the danda as a pipe next to Devanagari; restore it. */
function normalizeDanda(line: string): string {
  return line.replace(/([\u0900-\u097F])\s*\|/g, '$1 \u0964').replace(/\|\s*([\u0900-\u097F])/g, '\u0964 $1');
}

/** Title runs to the first clause boundary; the rest opens the clause text. */
function splitTitle(rest: string): { title: string; clauseHead: string } {
  const boundary = /^([\s\S]*?)(?:,--|--|\s-\s|\s-\u0964)([\s\S]*)$/u.exec(rest);
  if (boundary === null) {
    return { title: rest.replace(/[-–]$/, '').trim(), clauseHead: '' };
  }
  return { title: (boundary[1] ?? '').trim(), clauseHead: (boundary[2] ?? '').trim() };
}

/** Document-order key: 2 < 2A < 2B < 3 < 243ZA < 243ZB. */
function orderKey(latin: string): number {
  const match = /^(\d+)([A-Z]*)$/.exec(latin);
  if (match === null) return Number.NaN;
  const suffixValue = [...(match[2] ?? '')].reduce((acc, char) => acc * 27 + (char.charCodeAt(0) - 64), 0);
  return Number(match[1]) * 1000 + suffixValue;
}

/** Digits plus a Devanagari suffix become the Latin form. */
function latinize(numberHi: string): string {
  const digits = numberHi.replace(/[क-ह]+$/u, '');
  const suffix = numberHi.slice(digits.length);
  return suffix === '' ? digits : digits + suffixToLatin(suffix);
}

async function main(): Promise<void> {
  const english = new Set(
    (
      JSON.parse(readFileSync('data/processed/constitution.json', 'utf8')) as { articles: Array<{ number: string }> }
    ).articles.map((article) => article.number),
  );

  const bodyPages = readdirSync(CACHE_DIR)
    .map((file) => Number(file.slice(1, 4)))
    .filter((page) => page >= 63)
    .sort((a, b) => a - b);

  const articles: ParsedArticle[] = [];
  const review: Array<{ page: number; latin: string; line: string }> = [];
  let current: ParsedArticle | null = null;
  let cursor = 0;

  const acceptHeading = (latin: string, numberHi: string, rest: string, page: number, prefix: string) => {
    if (current !== null) {
      current.text += (current.text.length > 0 ? ' ' : '') + prefix.trim();
      articles.push(current);
    }
    const { title, clauseHead } = splitTitle(rest);
    current = { number: latin, numberHi, title, text: clauseHead, page };
    cursor = orderKey(latin);
  };

  for (const page of bodyPages) {
    const { ocr, layer } = JSON.parse(readFileSync(`${CACHE_DIR}/p${String(page).padStart(3, '0')}.json`, 'utf8')) as {
      ocr: string;
      layer: string;
    };
    const fused = fusePage(ocr, layer);
    for (const rawLine of fused.text.split('\n')) {
      const line = normalizeDanda(rawLine).trim();
      if (line.length === 0) continue;
      if (classifyLine(line) !== 'body') continue;

      const heading = parseArticleHeading(line);
      if (heading === null) {
        if (current !== null) current.text += (current.text.length > 0 ? ' ' : '') + line;
        continue;
      }
      // Marker digits fused onto the number (the English pipeline's 4268A
      // shape): try the digit tails against the whitelist before flagging.
      const digits = heading.numberHi.replace(/[क-ह]+$/u, '');
      const suffix = heading.numberHi.slice(digits.length);
      const candidates = [heading.numberHi, digits.slice(-3) + suffix, digits.slice(-2) + suffix]
        .map((numberHi) => (numberHi === heading.numberHi ? heading.latin : latinize(numberHi)))
        .filter((latin) => english.has(latin) && orderKey(latin) > cursor);
      const latin = candidates[0] ?? heading.latin;
      const inWhitelist = english.has(latin);
      const inOrder = orderKey(latin) > cursor;
      if (inWhitelist && inOrder) {
        acceptHeading(latin, heading.numberHi, heading.rest, page, heading.prefix);
      } else if (inWhitelist || inOrder) {
        review.push({ page, latin, line });
      }
      // Numbers behind the cursor and outside the whitelist (footnote shapes
      // that slipped past classification) are dropped silently: they are
      // apparatus, not content.
    }
  }
  if (current !== null) articles.push(current);

  // Collapse duplicate headings for the same number: keep the most text.
  const byNumber = new Map<string, ParsedArticle>();
  for (const article of articles) {
    const existing = byNumber.get(article.number);
    if (existing === undefined || article.text.length > existing.text.length) {
      byNumber.set(article.number, article);
    }
  }
  const unique = [...byNumber.values()];

  writeFileSync(OUTPUT, JSON.stringify(unique, null, 1));

  const hindi = new Set(unique.map((article) => article.number));
  const missing = [...english].filter((number) => !hindi.has(number));
  process.stdout.write(
    `pages parsed: ${bodyPages.length} (${bodyPages[0]}..${bodyPages.at(-1)}), unique articles: ${unique.length}\n`,
  );
  process.stdout.write(`missing vs english (${missing.length}): ${missing.join(' ')}\n`);
  process.stdout.write(`review flags (${review.length}): ${JSON.stringify(review.slice(0, 12))}\n`);
  process.stdout.write(`wrote ${OUTPUT}\n`);
}

void main();
