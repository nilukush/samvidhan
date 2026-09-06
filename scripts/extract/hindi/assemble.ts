import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

/**
 * Hindi edition assembly (docs/HINDI-IMPLEMENTATION-PLAN.md H6). Reads the
 * parser's intermediate articles plus the fused body pages, merges article
 * status and part assignment from the English edition (both editions carry
 * identical structure), extracts the भाग part headings, synthesizes article
 * 238 exactly as the English pipeline does (the edition prints no entry),
 * and writes data/processed/constitution-hindi.json, the committed data
 * source for the /hi/ pages.
 *
 * Scope note (divergence recorded in the plan): the twelve schedules stay
 * English-only in v1; their tabular matter degrades worst under OCR and
 * needs its own verification pass.
 */

import { fusePage } from '../../../src/lib/hindi/fuse.ts';
import { classifyLine, parseArticleHeading, suffixToLatin } from '../../../src/lib/hindi/parse.ts';
import { repairDevanagari } from '../../../src/lib/hindi/repair.ts';
import { splitHindiClauses } from '../../../src/lib/hindi/clauses.ts';
import { lintDevanagari } from '../../../src/lib/devanagari.ts';

const INTERMEDIATE = 'data/raw-hindi/articles.json';
const CACHE_DIR = 'data/raw-hindi/pages';
const ENGLISH_PATH = 'data/processed/constitution.json';
const PREAMBLE_PATH = 'src/data/hindi/preamble.json';
const OUTPUT = 'data/processed/constitution-hindi.json';

/**
 * Part names verified line by line against the fused pages where the TOC and
 * body name lines both carry noise: 6 (p201 राज्य under OCR dinkus), 7 (the
 * omitted part, printed like the English "[Omitted.]"), 8 (p285 संघ
 * राज्यक्षेत्र split across lines), 14A (अधिकरण, body page), 15 (p433
 * निर्वाचन fused with article 324's heading), 16 (p439 with OCR noise).
 */
const PART_NAME_OVERRIDES: Record<string, string> = {
  '6': 'राज्य',
  '7': '[लोप किया गया]',
  '8': 'संघ राज्यक्षेत्र',
  '14A': 'अधिकरण',
  '15': 'निर्वाचन',
  '16': 'कुछ वर्गों के संबंध में विशेष उपबंध',
};

interface IntermediateArticle {
  number: string;
  numberHi: string;
  title: string;
  text: string;
  page: number;
}

/**
 * Titles lost to column interleave, verified against the rendered pages
 * (psm-6 reads): 112 and 202 wrap "वार्षिक वित्तीय विवरण" across lines
 * (p163 line 39, p245 line 7); 277 prints "व्यावृत्ति" (p379 line 17, the
 * official Hindi for Savings); 393 prints "संक्षिप्त नाम" (p565 line 4).
 */
const TITLE_OVERRIDES: Record<string, string> = {
  '1': 'संघ का नाम और राज्यक्षेत्र',
  '112': 'वार्षिक वित्तीय विवरण',
  '202': 'वार्षिक वित्तीय विवरण',
  '277': 'व्यावृत्ति',
  '393': 'संक्षिप्त नाम',
};

/** Article 1's printed opening (p65 psm-6 read), restored before the
 * clause text that had absorbed its mangled form. */
const ARTICLE_1_OPENING = 'भारत, अर्थात्‌ इंडिया, राज्यों का संघ होगा ।';

/** Mechanical cleanups plus the linter-directed displaced i-matra repair. */
function cleanText(text: string): string {
  return repairDevanagari(text).replace(/\s+/g, ' ').trim();
}

function latinPartId(numberHi: string): string {
  const match = /^(\d{1,2})([क-ह]{1,2})?$/.exec(numberHi);
  if (match === null) return numberHi;
  return match[1] + (match[2] ? suffixToLatin(match[2]) : '');
}

/** Extract भाग headings and their names: the contents pages first (cleanest),
 * the body pages as fallback (newer parts print inside insertion brackets,
 * [भाग 9क, whole parts inserted by amendment). Results outside the English
 * edition's part set are dropped: schedule-internal labels like "भाग 2क" of
 * the First Schedule must not become site parts. */
function extractParts(
  englishParts: Set<string>,
): Array<{ number: string; numberHi: string; name: string; page: number }> {
  const pages = readdirSync(CACHE_DIR)
    .map((file) => Number(file.slice(1, 4)))
    .sort((a, b) => a - b);
  const parts: Array<{ number: string; numberHi: string; name: string; page: number }> = [];
  const seen = new Set<string>();
  const scanPage = (page: number) => {
    const { ocr, layer } = JSON.parse(readFileSync(`${CACHE_DIR}/p${String(page).padStart(3, '0')}.json`, 'utf8')) as {
      ocr: string;
      layer: string;
    };
    const lines = fusePage(ocr, layer)
      .text.split('\n')
      .map((line) => line.trim());
    for (let i = 0; i < lines.length; i += 1) {
      const match = /^\[?भाग\s+(\d{1,2})([क-ह]{1,2})?\]?$/.exec(lines[i] ?? '');
      if (match === null) continue;
      const numberHi = match[1] + (match[2] ?? '');
      const number = latinPartId(numberHi);
      if (seen.has(number) || !englishParts.has(number)) continue;
      let name = '';
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j += 1) {
        const candidate = (lines[j] ?? '').replace(/\.+$/u, '').trim();
        if (candidate.length === 0) continue;
        if (/^भाग\s/.test(candidate) || parseArticleHeading(candidate) !== null || classifyLine(candidate) !== 'body') {
          continue;
        }
        name = candidate;
        break;
      }
      if (name.length < 3) continue;
      seen.add(number);
      parts.push({ number, numberHi, name, page });
    }
  };
  // Contents pages first: the part names print cleanly there.
  for (const page of pages.filter((page) => page >= 3 && page < 63)) scanPage(page);
  for (const page of pages.filter((page) => page >= 63 && page < 575)) scanPage(page);
  return parts;
}

async function main(): Promise<void> {
  const english = JSON.parse(readFileSync(ENGLISH_PATH, 'utf8')) as {
    articles: Array<{ number: string; part: string; status: string; amendedBy: string[] }>;
    parts: Array<{ number: string; name: string }>;
  };
  const englishByNumber = new Map(english.articles.map((article) => [article.number, article]));
  const englishParts = new Set(english.parts.map((part) => part.number));
  const intermediate = JSON.parse(readFileSync(INTERMEDIATE, 'utf8')) as IntermediateArticle[];
  const preamble = JSON.parse(readFileSync(PREAMBLE_PATH, 'utf8')) as { text: string; lastVerified: string };

  const parts = extractParts(englishParts).map((part) => ({
    ...part,
    name: PART_NAME_OVERRIDES[part.number] ?? part.name,
  }));
  const partDiff = [...englishParts].filter((number) => !parts.some((part) => part.number === number));
  if (partDiff.length > 0) {
    process.stdout.write(`part extraction gaps (english without hindi): ${partDiff.join(' ')}\n`);
  }

  const articles = intermediate.map((article) => {
    let text = cleanText(article.text);
    // Article 1's opening sentence was mangled across the title boundary;
    // the page-verified clause text restores it.
    if (article.number === '1') {
      text = cleanText(ARTICLE_1_OPENING + ' ' + text.replace(/^अर्थात्\s*इंडिया, राज्यों\s*\d*\s*/, '').trim());
    }
    return {
      number: article.number,
      numberHi: article.numberHi,
      part: englishByNumber.get(article.number)?.part ?? '',
      status: englishByNumber.get(article.number)?.status ?? 'in force',
      amendedBy: englishByNumber.get(article.number)?.amendedBy ?? [],
      title: TITLE_OVERRIDES[article.number] ?? cleanText(article.title),
      clauses: splitHindiClauses(text).map((clause) => ({
        text: clause.text,
        kind: clause.kind,
        ...(clause.number === null ? {} : { number: clause.number }),
      })),
      page: article.page,
    };
  });

  // Article 238 is printed by neither edition; mirror the English pipeline's
  // honest synthetic entry, in Hindi, citing exactly what the edition prints.
  const missing = english.articles.filter(
    (article) => !articles.some((candidate) => candidate.number === article.number),
  );
  for (const article of missing) {
    articles.push({
      number: article.number,
      numberHi: article.number,
      part: article.part,
      status: article.status,
      amendedBy: article.amendedBy,
      title: '[लोप किया गया]',
      clauses: [
        {
          text: '[लोप किया गया।] इस संस्करण में इस अनुच्छेद के लिए कोई प्रविष्टि मुद्रित नहीं है। विषय-सूची इसे लोप किया गया अनुच्छेद बताती है, भाग 7 के अंतर्गत, जिसे संविधान लोप किया गया भाग मानता है। यह प्रविष्टि अंग्रेज़ी संस्करण की भाँति सूचना के लिए है।',
          kind: 'clause' as const,
        },
      ],
      page: 0,
    });
  }
  articles.sort((a, b) => {
    const na = Number(a.number.replace(/[A-Z]+$/, ''));
    const nb = Number(b.number.replace(/[A-Z]+$/, ''));
    return na - nb || a.number.localeCompare(b.number);
  });

  const lintIssues = articles.flatMap((article) =>
    lintDevanagari(article.clauses.map((clause) => clause.text).join(' ')).map((issue) => ({
      article: article.number,
      rule: issue.rule,
      excerpt: issue.excerpt,
    })),
  );

  const output = {
    edition: 'Constitution of India, Rajbhasha (Hindi) edition, as on 1 May 2026',
    lastVerified: preamble.lastVerified,
    preamble: preamble.text,
    articles,
    parts: parts.map((part) => ({ number: part.number, numberHi: part.numberHi, name: part.name })),
  };
  writeFileSync(OUTPUT, JSON.stringify(output, null, 1));

  // Validate the assembled file against the Hindi schema before anything
  // downstream consumes it.
  const { HindiFileSchema } = await import('../../../src/lib/schemas/index.ts');
  const validation = HindiFileSchema.safeParse(JSON.parse(readFileSync(OUTPUT, 'utf8')));
  if (!validation.success) {
    for (const issue of validation.error.issues.slice(0, 5)) {
      process.stdout.write(`schema: ${issue.path.join('.')}: ${issue.message}\n`);
    }
    throw new Error('assembled hindi file failed schema validation');
  }

  const englishNumbers = new Set(english.articles.map((article) => article.number));
  const hindiNumbers = new Set(articles.map((article) => article.number));
  const parity = [...englishNumbers].filter((number) => !hindiNumbers.has(number));
  process.stdout.write(
    `articles: ${articles.length} (english ${english.articles.length}, parity gaps: ${parity.join(' ') || 'none'}), parts: ${parts.length}/${english.parts.length}\n`,
  );
  const byRule = new Map<string, number>();
  for (const issue of lintIssues) byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1);
  process.stdout.write(
    `linter residue on assembled text: ${[...byRule.entries()].map(([rule, n]) => `${rule}:${n}`).join(' ') || 'none'}\n`,
  );
  process.stdout.write(`sample residue (first 8): ${JSON.stringify(lintIssues.slice(0, 8))}\n`);
  process.stdout.write(`wrote ${OUTPUT}\n`);
}

void main();
