import { ArticleSchema } from '../../src/lib/schemas/index.ts';
import type { ParsedConstitution } from './parse.ts';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  counts: {
    articles: number;
    parts: number;
    schedules: number;
    amendedArticles: number;
    omittedArticles: number;
    repealedArticles: number;
    inForceArticles: number;
  };
}

/**
 * Structural validation over the parsed constitution. Errors mean the
 * extraction is not fit for publishing; warnings deserve human eyes in
 * the spot check but do not block.
 */
export function validateConstitution(parsed: ParsedConstitution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  if (parsed.preamble.trim() === '') errors.push('preamble is empty');
  if (parsed.parts.length < 20) errors.push(`only ${parsed.parts.length} parts found, expected at least 20`);
  if (parsed.schedules.length < 10) errors.push(`only ${parsed.schedules.length} schedules found, expected 10 to 12`);

  const partNumbers = new Set(parsed.parts.map((p) => p.number));

  for (const part of parsed.parts) {
    if (part.name.trim() === '') warnings.push(`part ${part.number} has an empty name`);
  }

  for (const article of parsed.articles) {
    if (seen.has(article.number)) errors.push(`duplicate article number ${article.number}`);
    seen.add(article.number);

    const schemaResult = ArticleSchema.safeParse(article);
    if (!schemaResult.success) {
      errors.push(`article ${article.number} fails schema: ${JSON.stringify(schemaResult.error.issues[0])}`);
      continue;
    }

    if (!partNumbers.has(article.part))
      errors.push(`article ${article.number} references unknown part "${article.part}"`);
    if (article.clauses.length === 0) errors.push(`article ${article.number} has no clauses`);
    if (article.title === '') errors.push(`article ${article.number} has an empty title`);
  }

  for (const schedule of parsed.schedules) {
    if (schedule.title.trim() === '') warnings.push(`schedule ${schedule.number} has an empty title`);
    if (schedule.text.trim() === '') warnings.push(`schedule ${schedule.number} has no body text`);
  }

  const articleNumbers = parsed.articles.map((a) => a.number);
  for (const expected of ['1', '14', '19', '21', '32', '51A', '368', '395']) {
    if (!articleNumbers.includes(expected)) errors.push(`landmark article ${expected} is missing`);
  }

  return {
    errors,
    warnings,
    counts: {
      articles: parsed.articles.length,
      parts: parsed.parts.length,
      schedules: parsed.schedules.length,
      amendedArticles: parsed.articles.filter((a) => a.status === 'amended').length,
      omittedArticles: parsed.articles.filter((a) => a.status === 'omitted').length,
      repealedArticles: parsed.articles.filter((a) => a.status === 'repealed').length,
      inForceArticles: parsed.articles.filter((a) => a.status === 'in-force').length,
    },
  };
}
