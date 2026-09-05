import { describe, expect, test } from 'vitest';
import {
  extractPdfUrls,
  parseLeadAmendmentCount,
  sha256,
  normalizePageText,
  analyse,
  type CheckInput,
  type DetectorState,
} from '../../scripts/ritual/check';

const page = (urls: string[]): string =>
  `<html><body>${urls.map((u) => `<a href="${u}">${u}</a>`).join('')}${
    urls.length ? '' : '<p>no documents today</p>'
  }</body></html>`;

const knownUrls = ['https://www.legislative.gov.in/static/uploads/2025/07/aaa.pdf'];

const baseInput = (over: Partial<CheckInput> = {}): CheckInput => ({
  legislativePageHtml: page(knownUrls),
  knownPdfUrls: knownUrls,
  wikipediaLead: 'As of September 2026, there have been 106 amendments to the Constitution of India since 1950.',
  expectedAmendmentCount: 106,
  bills: [
    {
      title: 'Constitution (130th Amendment) Bill, 2025',
      sourceUrl: 'https://prsindia.org/billtrack/130',
      pageBody: 'status: pending before JPC',
    },
  ],
  billPageHashes: {
    'https://prsindia.org/billtrack/130': sha256('status: pending before JPC'),
  },
  ...over,
});

describe('pdf edition check', () => {
  test('extracts pdf links from the legislative page', () => {
    const html = page(['https://x.gov.in/a.pdf', 'https://x.gov.in/b.pdf', 'https://x.gov.in/page.html']);
    expect(extractPdfUrls(html)).toEqual(['https://x.gov.in/a.pdf', 'https://x.gov.in/b.pdf']);
  });

  test('flags a pdf that is neither known nor seen before', () => {
    const html = page([...knownUrls, 'https://www.legislative.gov.in/static/uploads/2026/09/new-edition.pdf']);
    const report = analyse(baseInput({ legislativePageHtml: html }));
    expect(report.flags.map((f) => f.kind)).toContain('new-pdf-edition');
  });

  test('does not flag the known pdfs alone', () => {
    expect(analyse(baseInput()).flags).toEqual([]);
  });

  test('an unreachable legislative page flags loudly instead of reading as clean', () => {
    const report = analyse(baseInput({ legislativePageHtml: null }));
    expect(report.flags.map((f) => f.kind)).toContain('legislative-page-unreachable');
  });
});

describe('page normalization', () => {
  test('two fetches that differ only in script noise normalize to the same hash', () => {
    const body = '<div>Status: pending before the committee.</div>';
    const a = `<html><head><style>.x{color:red}</style><script>token="abc123"</script></head><body>${body}</body></html>`;
    const b = `<html><head><style>.x{color:blue}</style><script>token="zzz999"</script></head><body>${body}</body></html>`;
    expect(sha256(normalizePageText(a))).toBe(sha256(normalizePageText(b)));
    expect(normalizePageText(a)).toContain('Status: pending before the committee.');
  });
});

describe('amendment count check', () => {
  test('reads the count from the lead sentence', () => {
    expect(parseLeadAmendmentCount('... there have been 106 amendments to the Constitution ...')).toBe(106);
    expect(parseLeadAmendmentCount('no number here')).toBeNull();
  });

  test('flags a higher count than the site carries', () => {
    const lead = 'As of 2026, there have been 107 amendments to the Constitution of India.';
    const report = analyse(baseInput({ wikipediaLead: lead }));
    expect(report.flags.map((f) => f.kind)).toContain('amendment-count-moved');
  });

  test('flags an unreadable lead for manual review', () => {
    const report = analyse(baseInput({ wikipediaLead: 'The Constitution of India has been amended many times.' }));
    expect(report.flags.map((f) => f.kind)).toContain('amendment-count-unknown');
  });
});

describe('bill page check', () => {
  test('flags a changed page hash', () => {
    const report = analyse(
      baseInput({ bills: [{ ...baseInput().bills[0]!, pageBody: 'status: passed by Lok Sabha' }] }),
    );
    expect(report.flags.map((f) => f.kind)).toContain('bill-page-changed');
  });

  test('flags a bill page that could not be fetched', () => {
    const report = analyse(baseInput({ bills: [{ ...baseInput().bills[0]!, pageBody: null }] }));
    expect(report.flags.map((f) => f.kind)).toContain('bill-page-unreachable');
  });
});

describe('baseline and report', () => {
  test('a clean check reports nothing and updates state', () => {
    const report = analyse(baseInput());
    expect(report.flags).toEqual([]);
    expect(report.nextState.billPageHashes).toEqual(baseInput().billPageHashes);
    expect(report.nextState.wikipediaLeadAmendmentCount).toBe(106);
  });

  test('the markdown report names every flag', () => {
    const report = analyse(
      baseInput({
        legislativePageHtml: page([...knownUrls, 'https://www.legislative.gov.in/static/uploads/2026/09/new.pdf']),
        wikipediaLead: 'there have been 107 amendments',
      }),
    );
    const md = report.markdown;
    expect(md).toContain('new-pdf-edition');
    expect(md).toContain('amendment-count-moved');
    expect(md).toContain('https://www.legislative.gov.in/static/uploads/2026/09/new.pdf');
  });

  test('first run with no stored state records a baseline without flags', () => {
    const input = baseInput({ billPageHashes: {} });
    const report = analyse(input, { state: null as unknown as DetectorState });
    expect(report.flags).toEqual([]);
    expect(report.baselineRecorded).toBe(true);
  });
});
