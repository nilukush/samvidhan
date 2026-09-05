import { lintDevanagari } from '../devanagari';

/**
 * Word-stream fusion of the two Hindi extraction sources
 * (docs/HINDI-IMPLEMENTATION-PLAN.md H3). OCR supplies Devanagari
 * orthography; the Poppler text layer supplies digits, bracket markers, and
 * Latin. Alignment anchors on skeleton equality (Devanagari letters only) so
 * words that differ only in digits or markers fuse positionally; similar but
 * letter-disagreeing neighbours pair up and are flagged. Every pair resolves
 * by deterministic rule. Pure functions only, tested in
 * tests/unit/hindi-fuse.test.ts.
 */

/** Raw code units kept by skeleton(): consonants, vowel signs, digits. */
const SKELETON_RANGES: Array<[number, number]> = [
  [0x0905, 0x0939],
  [0x093c, 0x094d],
  [0x0950, 0x0963],
  [0x0966, 0x096f],
];

function isSkeletonChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return SKELETON_RANGES.some(([low, high]) => code >= low && code <= high);
}

/** Devanagari letters only: digits, markers, punctuation, whitespace stripped. */
export function skeleton(word: string): string {
  return Array.from(word).filter(isSkeletonChar).join('');
}

export interface WordPair {
  ocr: string;
  layer: string | null;
}

export interface FuseFlag {
  word: string;
  ocr: string | null;
  layer: string | null;
}

export interface FuseResult {
  text: string;
  flags: FuseFlag[];
}

const LETTER_OR_DIGIT = /[^\s|.,;:()[\]'"\u2013\u2014]/;

/**
 * Whitespace tokens, with punctuation-only tokens (the pipe misread for
 * danda, dashes, bare commas) attached to the preceding word so word splits
 * like OCR "हैं |" versus layer "हैं।" align as one pair.
 */
export function tokenize(text: string): string[] {
  const raw = text.split(/\s+/).filter((word) => word.length > 0);
  const tokens: string[] = [];
  for (const word of raw) {
    if (tokens.length > 0 && !LETTER_OR_DIGIT.test(word)) {
      tokens[tokens.length - 1] += word;
    } else {
      tokens.push(word);
    }
  }
  return tokens;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Similar enough to be the same word misspelled on one side. */
function similar(a: string, b: string): boolean {
  if (a === '' && b === '') return true;
  const distance = levenshtein(a, b);
  return distance <= Math.max(2, Math.floor(Math.min(a.length, b.length) / 3));
}

type Op = { ocr: string | null; layer: string | null };

/**
 * Skeleton-anchored LCS alignment. Words equal in Devanagari letters anchor
 * the streams; the leftovers in each gap between anchors pair up positionally
 * when they look alike (the letter-level disagreements); the rest stay
 * single-sided.
 */
export function alignWords(ocr: string[], layer: string[]): Op[] {
  const ocrSk = ocr.map(skeleton);
  const layerSk = layer.map(skeleton);
  const rows = ocr.length;
  const cols = layer.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      lcs[i][j] = ocrSk[i] === layerSk[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const matches: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (ocrSk[i] === layerSk[j]) {
      matches.push([i, j]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const pairs: Op[] = [];
  const flushGap = (ocrFrom: number, ocrTo: number, layerFrom: number, layerTo: number) => {
    const ocrGap = ocr.slice(ocrFrom, ocrTo);
    const layerGap = layer.slice(layerFrom, layerTo);
    const width = Math.min(ocrGap.length, layerGap.length);
    let k = 0;
    for (; k < width; k += 1) {
      if (similar(skeleton(ocrGap[k]), skeleton(layerGap[k]))) {
        pairs.push({ ocr: ocrGap[k], layer: layerGap[k] });
      } else {
        pairs.push({ ocr: ocrGap[k], layer: null });
        pairs.push({ ocr: null, layer: layerGap[k] });
      }
    }
    for (let r = k; r < ocrGap.length; r += 1) pairs.push({ ocr: ocrGap[r], layer: null });
    for (let r = k; r < layerGap.length; r += 1) pairs.push({ ocr: null, layer: layerGap[r] });
  };

  let prevI = 0;
  let prevJ = 0;
  for (const [mi, mj] of matches) {
    flushGap(prevI, mi, prevJ, mj);
    pairs.push({ ocr: ocr[mi], layer: layer[mj] });
    prevI = mi + 1;
    prevJ = mj + 1;
  }
  flushGap(prevI, rows, prevJ, cols);
  return pairs;
}

function violations(word: string): number {
  return lintDevanagari(word).length;
}

/**
 * Fuse one aligned pair. Identical words pass. Otherwise prefer the side
 * with no linter violations: a clean layer word with equal skeleton wins
 * (its digits and markers are authoritative), a clean OCR word wins whenever
 * the other side is dirty (the layer's replacement characters must never
 * enter the fused text), and when both are clean but letters disagree the
 * OCR word wins as the orthography source, flagged for review. Layer-only
 * words that carry replacement or private-use garbage are dropped, flagged.
 */
function fusePair(pair: Op): { word: string | null; flag: FuseFlag | null } {
  const { ocr, layer } = pair;
  if (ocr !== null && layer === null) {
    return { word: ocr, flag: { word: ocr, ocr, layer: null } };
  }
  if (ocr === null && layer !== null) {
    if (violations(layer) > 0) {
      return { word: null, flag: { word: layer, ocr: null, layer } };
    }
    return { word: layer, flag: { word: layer, ocr: null, layer } };
  }
  if (ocr === null || layer === null) {
    return { word: null, flag: null };
  }
  if (ocr === layer) {
    return { word: ocr, flag: null };
  }
  const ocrClean = violations(ocr) === 0;
  const layerClean = violations(layer) === 0;
  if (skeleton(ocr) === skeleton(layer)) {
    if (layerClean) {
      return { word: layer, flag: null };
    }
    if (ocrClean) {
      return { word: ocr, flag: { word: ocr, ocr, layer } };
    }
    return { word: layer, flag: { word: layer, ocr, layer } };
  }
  const word = ocrClean || !layerClean ? ocr : layer;
  return { word, flag: { word, ocr, layer } };
}

export function fusePage(ocrText: string, layerText: string): FuseResult {
  const pairs = alignWords(tokenize(ocrText), tokenize(layerText));
  const words: string[] = [];
  const flags: FuseFlag[] = [];
  for (const pair of pairs) {
    const { word, flag } = fusePair(pair);
    if (word !== null) words.push(word);
    if (flag !== null) flags.push(flag);
  }
  return { text: words.join(' '), flags };
}
