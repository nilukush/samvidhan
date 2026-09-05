import { createHash } from 'node:crypto';

/**
 * Pure logic for the monthly update-ritual detector. The fetcher lives in
 * run.ts; everything here is deterministic and covered by unit tests.
 *
 * Honesty rule: this module DETECTS and REPORTS only. It never claims a
 * source was "verified" and never produces a lastVerified date. Verification
 * stays with the human or agent that performs the ritual.
 */

export interface BillInput {
  title: string;
  sourceUrl: string;
  pageBody: string | null;
}

export interface CheckInput {
  legislativePageHtml: string | null;
  /** PDF urls already known to the project (parsed from data/source/README.md). */
  knownPdfUrls: string[];
  /** Lead paragraph of the Wikipedia list of amendments, plain text. */
  wikipediaLead: string | null;
  expectedAmendmentCount: number;
  bills: BillInput[];
  /** Hashes recorded by the previous detector run, keyed by source url. */
  billPageHashes: Record<string, string>;
}

export interface DetectorState {
  lastChecked: string;
  legislativePdfUrls: string[];
  wikipediaLeadAmendmentCount: number | null;
  billPageHashes: Record<string, string>;
}

export interface Flag {
  kind:
    | 'new-pdf-edition'
    | 'legislative-page-unreachable'
    | 'amendment-count-moved'
    | 'amendment-count-unknown'
    | 'bill-page-changed'
    | 'bill-page-unreachable';
  detail: string;
}

export interface CheckReport {
  flags: Flag[];
  baselineRecorded: boolean;
  nextState: DetectorState;
  markdown: string;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Reduces a fetched page to its stable visible text. Pages carry volatile
 * noise in scripts and styles (session tokens, cache busters) that changes
 * between fetches without any visible change; hashing the raw HTML would
 * false-positive on every run. Two fetches of an unchanged page normalize
 * to identical text.
 */
export function normalizePageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every href on the page that points at a .pdf document, in order, deduped. */
export function extractPdfUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)) {
    const url = match[1]!.trim();
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/**
 * Reads the "there have been N amendments" phrase from the article lead.
 * Returns null when the phrase cannot be found; the caller flags that for
 * manual review rather than guessing.
 */
export function parseLeadAmendmentCount(lead: string | null): number | null {
  if (lead === null) return null;
  const match = /(\d{1,3})\s+amendments?\b/i.exec(lead);
  return match ? Number.parseInt(match[1] as string, 10) : null;
}

export function analyse(input: CheckInput, opts?: { state?: DetectorState }): CheckReport {
  const previous = opts?.state ?? null;
  const flags: Flag[] = [];

  // Edition check: a PDF on the official page that is neither known to the
  // project (README) nor seen by an earlier detector run is a new edition.
  // An unreachable page must never read as "no PDFs found".
  if (input.legislativePageHtml === null) {
    flags.push({
      kind: 'legislative-page-unreachable',
      detail: 'The legislative.gov.in Constitution page could not be fetched; review manually',
    });
  }
  const pagePdfs = input.legislativePageHtml === null ? [] : extractPdfUrls(input.legislativePageHtml);
  const known = new Set([...input.knownPdfUrls, ...(previous?.legislativePdfUrls ?? [])]);
  const newPdfs = pagePdfs.filter((url) => !known.has(url));
  for (const url of newPdfs) {
    flags.push({ kind: 'new-pdf-edition', detail: url });
  }

  // Amendment count: the lead phrase is the signal. Higher than the site
  // carries means an enactment to process; unreadable means manual review.
  const leadCount = parseLeadAmendmentCount(input.wikipediaLead);
  if (leadCount !== null && leadCount > input.expectedAmendmentCount) {
    flags.push({
      kind: 'amendment-count-moved',
      detail: `Wikipedia lead now says ${leadCount} amendments; the site carries ${input.expectedAmendmentCount}`,
    });
  } else if (leadCount === null) {
    flags.push({
      kind: 'amendment-count-unknown',
      detail: 'Could not read the amendment count from the Wikipedia lead paragraph; review the page manually',
    });
  }

  // Bill pages: hash comparison against the previous detector run. A changed
  // page means movement worth a look; an unreachable page needs a manual pass.
  const billPageHashes: Record<string, string> = {};
  for (const bill of input.bills) {
    if (bill.pageBody === null) {
      flags.push({ kind: 'bill-page-unreachable', detail: `${bill.title} (${bill.sourceUrl}) could not be fetched` });
      const previousHash = input.billPageHashes[bill.sourceUrl];
      if (previousHash) billPageHashes[bill.sourceUrl] = previousHash;
      continue;
    }
    const hash = sha256(bill.pageBody);
    billPageHashes[bill.sourceUrl] = hash;
    const previousHash = input.billPageHashes[bill.sourceUrl];
    if (previousHash !== undefined && previousHash !== hash) {
      flags.push({
        kind: 'bill-page-changed',
        detail: `${bill.title} page changed since the last check (${bill.sourceUrl})`,
      });
    }
  }

  const baselineRecorded = previous === null;
  const nextState: DetectorState = {
    lastChecked: new Date().toISOString(),
    legislativePdfUrls: pagePdfs,
    wikipediaLeadAmendmentCount: leadCount,
    billPageHashes,
  };

  const lines: string[] = [
    '# Monthly update ritual: source check report',
    '',
    `Checked: ${nextState.lastChecked}`,
    '',
    'This report was produced by the automatic detector. It only observes sources; it does not verify anything. If anything is flagged below, the ritual (CONTRIBUTING.md) should be run and the honest dates updated by hand.',
    '',
  ];
  if (baselineRecorded) {
    lines.push('First run: baseline recorded, nothing to compare against yet.', '');
  }
  if (flags.length === 0) {
    lines.push('No changes detected. Sources look the same as the last check.');
  } else {
    lines.push('## Changes detected', '');
    for (const flag of flags) {
      lines.push(`- **${flag.kind}**: ${flag.detail}`);
    }
    lines.push(
      '',
      'Open the sources, confirm each change, then run the update ritual and update the verified dates honestly.',
    );
  }

  return { flags, baselineRecorded, nextState, markdown: lines.join('\n') + '\n' };
}
