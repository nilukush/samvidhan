import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyse, normalizePageText, type BillInput, type CheckInput, type DetectorState } from './check.ts';

/**
 * Fetcher and CLI for the monthly update-ritual detector.
 *
 * Reads the project's own expectations (vendored source README, amendments
 * data, bills snapshot), fetches the public sources, and runs the pure
 * analyse() over the result. Writes data/ritual/detector-state.json and
 * data/ritual/last-report.md. Exit codes: 0 nothing detected, 1 changes
 * detected (the workflow then opens an issue), 2 the run itself failed.
 *
 * The detector never writes a verified date. See CONTRIBUTING.md.
 */

const LEGISLATIVE_PAGE = 'https://www.legislative.gov.in/constitution-of-india';
const WIKIPEDIA_API =
  'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&format=json&redirects=1' +
  '&titles=' +
  encodeURIComponent('List of amendments of the Constitution of India');
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 SamvidhanRitualDetector/1.0';

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': BROWSER_UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** The vendored PDF urls the project already knows, from data/source/README.md. */
function knownPdfUrls(): string[] {
  const readme = readFileSync('data/source/README.md', 'utf8');
  return [...readme.matchAll(/https:\/\/www\.legislative\.gov\.in\/[^\s)]+?\.pdf/g)].map((m) => m[0]!);
}

function expectedAmendmentCount(): number {
  const amendments = JSON.parse(readFileSync('src/data/amendments/amendments.json', 'utf8')) as Array<{
    number: number;
  }>;
  return Math.max(...amendments.map((a) => a.number));
}

function billInputs(): BillInput[] {
  const bills = JSON.parse(readFileSync('src/data/bills/snapshot.json', 'utf8')) as Array<{
    title: string;
    sourceUrl: string;
  }>;
  return bills.map((bill) => ({ title: bill.title, sourceUrl: bill.sourceUrl, pageBody: null }));
}

function wikipediaLead(html: string | null): string | null {
  if (html === null) return null;
  try {
    const parsed = JSON.parse(html) as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = parsed.query?.pages ?? {};
    const first = Object.values(pages)[0];
    return first?.extract ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  mkdirSync('data/ritual', { recursive: true });
  const previousState: DetectorState | null = existsSync('data/ritual/detector-state.json')
    ? (JSON.parse(readFileSync('data/ritual/detector-state.json', 'utf8')) as DetectorState)
    : null;

  const bills = billInputs();
  const [legislativePageHtml, wikipediaJson, ...billBodies] = await Promise.all([
    fetchText(LEGISLATIVE_PAGE),
    fetchText(WIKIPEDIA_API),
    ...bills.map((bill) => fetchText(bill.sourceUrl)),
  ]);
  bills.forEach((bill, index) => {
    const raw = billBodies[index] ?? null;
    // Normalize before hashing: raw HTML carries session noise that changes
    // between fetches; the visible text does not (tests cover the property).
    bill.pageBody = raw === null ? null : normalizePageText(raw);
  });

  const input: CheckInput = {
    legislativePageHtml,
    knownPdfUrls: knownPdfUrls(),
    wikipediaLead: wikipediaLead(wikipediaJson),
    expectedAmendmentCount: expectedAmendmentCount(),
    bills,
    billPageHashes: previousState?.billPageHashes ?? {},
  };
  const report = analyse(input, { state: previousState ?? undefined });

  let markdown = report.markdown;
  // The legislative portal is a client-rendered app: a static fetch sees the
  // Next.js shell, not the PDF links. Say so in every report rather than
  // implying the edition was checked. Ritual step 1 stays with people.
  if (
    input.legislativePageHtml !== null &&
    input.legislativePageHtml.includes('__NEXT_DATA__') &&
    report.nextState.legislativePdfUrls.length === 0
  ) {
    markdown += [
      '## Limitation: the legislative portal is client-rendered',
      '',
      'The detector fetched the portal page but its PDF links are rendered in the browser, so no edition check was possible. Step 1 of the ritual (opening legislative.gov.in and looking for a new edition) remains a manual look.',
      '',
    ].join('\n');
  }

  writeFileSync('data/ritual/detector-state.json', JSON.stringify(report.nextState, null, 2) + '\n');
  writeFileSync('data/ritual/last-report.md', markdown);
  process.stdout.write(markdown);
  return report.flags.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error('ritual check run failed:', error);
    process.exit(2);
  });
