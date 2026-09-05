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

/** Document-order key as a pair: numeric part, then suffix compared
 * lexicographically so 239A < 239AA < 239AB < 239B < 240. */
type OrderKey = [number, string];

function orderKey(latin: string): OrderKey {
  const match = /^(\d+)([A-Z]*)$/.exec(latin);
  if (match === null) return [Number.NaN, ''];
  return [Number(match[1]), match[2] ?? ''];
}

function afterCursor(latin: string, cursor: OrderKey): boolean {
  const key = orderKey(latin);
  return key[0] > cursor[0] || (key[0] === cursor[0] && key[1] > cursor[1]);
}

/** Digits plus a Devanagari suffix become the Latin form. */
function latinize(numberHi: string): string {
  const digits = numberHi.replace(/[क-ह]+$/u, '');
  const suffix = numberHi.slice(digits.length);
  return suffix === '' ? digits : digits + suffixToLatin(suffix);
}

/** Marker-fused digit tails: 1268क can be the printed 268A. */
function digitsTailCandidates(numberHi: string): string[] {
  const digits = numberHi.replace(/[क-ह]+$/u, '');
  const suffix = numberHi.slice(digits.length);
  return [digits.slice(-3) + suffix, digits.slice(-2) + suffix].filter((c) => c !== numberHi);
}

/**
 * OCR confusion candidates for rare suffix glyphs, verified against the
 * rendered volume: झ misread for ज (page 335, 243यझ read for printed 243यज =
 * 243ZH) and ञ misread for ज (page 337, printed 243यञ = 243ZJ). The Hindi
 * edition skips यझ exactly as the English skips 243ZI. Whitelist and order
 * gate every candidate, so a confusion can only restore a real article
 * number, never invent one.
 */
const SUFFIX_CONFUSIONS: Record<string, string[]> = {
  झ: ['ज'],
  ज: ['ञ'],
  ञ: ['ज'],
};

function confusionVariants(numberHi: string): string[] {
  const digits = numberHi.replace(/[क-ह]+$/u, '');
  const suffix = numberHi.slice(digits.length);
  if (suffix === '') return [];
  const variants: string[] = [numberHi];
  for (const [index, char] of [...suffix].entries()) {
    for (const replacement of SUFFIX_CONFUSIONS[char] ?? []) {
      variants.push(digits + [...suffix].map((c, i) => (i === index ? replacement : c)).join(''));
    }
  }
  return variants;
}

/**
 * Title anchors for headings whose number both extraction streams lost
 * (verified against the rendered pages; the English pipeline's documented
 * override pattern). Each fires only on its page, only while the article is
 * still missing, and only when document order permits.
 */
const HEADING_ANCHORS: Array<{ number: string; page: number; anchor: RegExp; title: string }> = [
  {
    number: '132',
    page: 183,
    anchor: /उच्च न्यायालयों से अपीलों में उच्चतम न्यायालय की अपीली/,
    title: 'उच्च न्यायालयों से अपीलों में उच्चतम न्यायालय की अपीली अधिकारिता',
  },
  {
    number: '139',
    page: 189,
    anchor: /न्यायालय को अ[\u0900-\u097F]{1,7} द 32 के खंड/,
    title: 'प्रवर्तन के लिए संसद् द्वारा उच्चतम न्यायालय को शक्तियां प्रदान किया जाना',
  },
  {
    number: '247',
    page: 353,
    anchor: /अतिरिक्त न्यायालयों की स्थापना का विधि द्वारा उपबंध/,
    title: 'राष्ट्रीय महत्व के विषयों के लिए विधियां बनाने की संसद् की शक्ति',
  },
  {
    number: '257',
    page: 359,
    anchor: /दशाओं में राज्यों पर संघ का नियंत्रण/,
    title: 'कुछ दशाओं में राज्यों पर संघ का नियंत्रण',
  },
  {
    number: '336',
    page: 449,
    anchor: /सेवाओं में आंग्ल-भारतीय समुदाय/,
    title: 'कुछ सेवाओं में आंग्ल-भारतीय समुदाय के लिए विशेष उपबंध',
  },
  {
    number: '361B',
    page: 501,
    anchor: /दल का किसी सदन का कोई सदस्य, जो दसवीं अनुसूची/,
    title: 'दल-परिवर्तन के आधार पर मंत्रित्व के लिए अनयोग्यता',
  },
];

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
  const captured = new Set<string>();
  let current: ParsedArticle | null = null;
  let cursor: OrderKey = [0, ''];

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

      // Title anchors fire at their own line, after any earlier headings on
      // the page have been accepted, so predecessors keep their order.
      for (const anchor of HEADING_ANCHORS) {
        if (anchor.page !== page || captured.has(anchor.number)) continue;
        if (anchor.anchor.test(line) && afterCursor(anchor.number, cursor)) {
          acceptHeading(anchor.number, anchor.number, anchor.title + '--', page, '');
          captured.add(anchor.number);
        }
      }

      if (classifyLine(line) !== 'body') continue;

      const heading = parseArticleHeading(line);
      if (heading === null) {
        if (current !== null) current.text += (current.text.length > 0 ? ' ' : '') + line;
        continue;
      }
      // Candidate numbers, in trust order: the parsed form, marker-fused
      // digit tails (the English pipeline's 4268A shape), and rare-glyph
      // suffix confusions (ञ read as ज, ज as झ). Whitelist and document
      // order gate every candidate.
      const candidates = [
        heading.numberHi,
        ...digitsTailCandidates(heading.numberHi),
        ...confusionVariants(heading.numberHi),
      ]
        .map((numberHi) => (numberHi === heading.numberHi ? heading.latin : latinize(numberHi)))
        .filter((latin) => english.has(latin) && afterCursor(latin, cursor));
      const latin = candidates[0] ?? heading.latin;
      const inWhitelist = english.has(latin);
      const inOrder = afterCursor(latin, cursor);
      if (inWhitelist && inOrder) {
        acceptHeading(latin, heading.numberHi, heading.rest, page, heading.prefix);
        captured.add(latin);
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
