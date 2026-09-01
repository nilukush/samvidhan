import rawBills from '../data/bills/snapshot.json';
import { BillSchema, type Bill } from './schemas/index.ts';

/**
 * Validates bill snapshot entries. The snapshot is maintained by hand
 * (see CONTRIBUTING.md, the monthly update ritual); any entry that is
 * missing its last verified date or carries an unknown status fails the
 * build here, loudly, naming the bill and the field.
 */
export function parseBills(data: unknown): Bill[] {
  if (!Array.isArray(data)) {
    throw new Error('bill snapshot must be an array of bill entries');
  }
  return data.map((entry) => {
    const parsed = BillSchema.safeParse(entry);
    if (!parsed.success) {
      const title = (entry as { title?: string })?.title ?? 'untitled bill';
      const issue = parsed.error.issues[0];
      throw new Error(`bill snapshot entry "${title}" is invalid at ${issue?.path.join('.')}: ${issue?.message}`);
    }
    return parsed.data;
  });
}

export function getBills(): Bill[] {
  return parseBills(rawBills);
}

/** The most recent verification date across the snapshot, for the banner. */
export function latestVerifiedDate(bills: Array<{ lastVerified: string }>): string {
  return bills
    .map((bill) => bill.lastVerified)
    .sort()
    .at(-1) as string;
}
