import rawAmendments from '../data/amendments/amendments.json';
import { AmendmentSchema, type Amendment } from './schemas/index.ts';

/** Loads and validates the amendments data once per build. */
export function getAmendments(): Amendment[] {
  const parsed = rawAmendments.map((entry) => AmendmentSchema.parse(entry));
  return parsed.sort((a, b) => a.number - b.number);
}
