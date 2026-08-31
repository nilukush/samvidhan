import { z } from 'zod';

/**
 * Canonical data shapes for the whole project: the PDF extraction pipeline,
 * the Astro content collections, and the site pages all validate through
 * these schemas. Nothing downstream may invent its own field names.
 *
 * Conventions:
 * - Article numbers are strings ("14", "51A") because letter suffixes exist.
 * - All dates are ISO calendar dates (YYYY-MM-DD) kept as strings so they
 *   survive JSON round trips through the pipeline unchanged.
 * - Statutes are public domain; these shapes describe them, they do not
 *   carry licence obligations.
 */

export const ArticleStatusEnum = z.enum(['in-force', 'amended', 'omitted', 'repealed']);

export const BillStatusEnum = z.enum(['pending', 'passed-one-house', 'rejected', 'lapsed']);

export const ClauseKindEnum = z.enum(['clause', 'explanation', 'illustration', 'proviso']);

export const HouseEnum = z.enum(['lok-sabha', 'rajya-sabha', 'both']);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, YYYY-MM-DD');

export const ClauseSchema = z.object({
  number: z.string().optional(),
  text: z.string().min(1),
  kind: ClauseKindEnum.default('clause'),
});

export const ArticleSchema = z.object({
  /** Bare number or number with capital letter suffix, for example "14", "51A". */
  number: z.string().regex(/^\d{1,3}[A-Z]?$/, 'article number must look like 14 or 51A'),
  /** Part number as a string key referencing the owning part, for example "3" or "4A" for Part IVA. */
  part: z.string().regex(/^\d{1,2}[A-Z]?$/, 'part reference must look like 3 or 4A'),
  title: z.string().min(1),
  clauses: z.array(ClauseSchema).min(1),
  status: ArticleStatusEnum,
  /** Amendment ids of every amendment that touched this article, for example "42nd-amendment". */
  amendedBy: z.array(z.string()).default([]),
});

export const PartSchema = z.object({
  number: z.number().int().min(1).max(25),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const ScheduleSchema = z.object({
  number: z.number().int().min(1).max(12),
  title: z.string().min(1),
});

export const AmendmentSchema = z.object({
  number: z.number().int().min(1),
  /** Year of enactment. The Constitution came into force in 1950. */
  year: z.number().int().min(1950).max(new Date().getFullYear()),
  title: z.string().min(1),
  summary: z.string().optional(),
  articlesAffected: z.array(z.string()).default([]),
  /**
   * Legislative milestones are kept separate because they are distinct facts:
   * introduction, passage by each house, assent, and commencement. See
   * docs/ANALYSIS.md for the 106th Amendment worked example.
   */
  introducedIn: isoDate.optional(),
  passedLokSabha: isoDate.optional(),
  passedRajyaSabha: isoDate.optional(),
  assent: isoDate.optional(),
  inForce: isoDate.optional(),
  /** For example, the 106th's reservation pending census and delimitation. */
  operativeNote: z.string().optional(),
});

export const BillSchema = z.object({
  title: z.string().min(1),
  house: HouseEnum,
  status: BillStatusEnum,
  summary: z.string().optional(),
  introducedOn: isoDate.optional(),
  /** Every bill row must show when its facts were last checked against sources. */
  lastVerified: isoDate,
  sourceUrl: z.url(),
});

export type Article = z.infer<typeof ArticleSchema>;
export type Clause = z.infer<typeof ClauseSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Amendment = z.infer<typeof AmendmentSchema>;
export type Bill = z.infer<typeof BillSchema>;
export type ArticleStatus = z.infer<typeof ArticleStatusEnum>;
export type BillStatus = z.infer<typeof BillStatusEnum>;
