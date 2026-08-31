import type { ParsedArticle, ParsedConstitution } from './parse.ts';

export interface CrosscheckResult {
  /** Articles present in both the PDF extraction and the 2019 dataset. */
  common: number;
  /** Common articles whose word overlap falls below the threshold. */
  flagged: Array<{ number: string; similarity: number }>;
  /** In the 2019 dataset but not found in the PDF extraction. */
  missingInPdf: string[];
  /** In the PDF extraction but absent from the 2019 dataset (expected: newer articles). */
  missingInCrosscheck: string[];
}

interface CrosscheckArticle {
  ArtNo?: unknown;
  ArtDesc?: unknown;
}

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Soft cross check against the MIT licensed 2019 dataset
 * (github.com/Yash-Handa/The_Constitution_Of_India). The dataset predates the
 * 105th and 106th Amendments, so divergence on late articles is expected and
 * only reported, never fatal.
 */
export function crosscheckArticles(parsed: ParsedConstitution, crosscheckJson: unknown): CrosscheckResult {
  const reference = flattenArticles(crosscheckJson);
  const referenceNumbers = new Set(reference.keys());

  const flagged: CrosscheckResult['flagged'] = [];
  const missingInCrosscheck: string[] = [];
  let common = 0;

  for (const article of parsed.articles) {
    const referenceText = reference.get(article.number);
    if (referenceText === undefined) {
      missingInCrosscheck.push(article.number);
      continue;
    }
    common++;
    const similarity = wordSimilarity(articleText(article), referenceText);
    if (similarity < SIMILARITY_THRESHOLD) {
      flagged.push({ number: article.number, similarity: Number(similarity.toFixed(3)) });
    }
  }

  const pdfNumbers = new Set(parsed.articles.map((a) => a.number));
  const missingInPdf = [...referenceNumbers].filter((n) => !pdfNumbers.has(n));

  return { common, flagged, missingInPdf, missingInCrosscheck };
}

function flattenArticles(node: unknown, into?: Map<string, string>): Map<string, string> {
  const map = into ?? new Map<string, string>();
  if (Array.isArray(node)) {
    for (const item of node) flattenArticles(item, map);
    return map;
  }
  if (node !== null && typeof node === 'object') {
    const candidate = node as CrosscheckArticle;
    const artNo = typeof candidate.ArtNo === 'string' ? candidate.ArtNo.trim() : null;
    const artDesc = typeof candidate.ArtDesc === 'string' ? candidate.ArtDesc : null;
    if (artNo && artDesc && /^\d{1,3}[A-Z]?$/.test(artNo)) {
      map.set(artNo, artDesc);
    }
    for (const value of Object.values(candidate)) {
      if (value !== null && typeof value === 'object') flattenArticles(value, map);
    }
  }
  return map;
}

function articleText(article: ParsedArticle): string {
  return [article.title, ...article.clauses.map((c) => c.text)].join(' ');
}

/** Jaccard similarity over normalized word sets. */
function wordSimilarity(a: string, b: string): number {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const word of wordsA) if (wordsB.has(word)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\d{1,2}\[/g, ' ')
      .replace(/[\][()“”".,;:—⎯–-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}
