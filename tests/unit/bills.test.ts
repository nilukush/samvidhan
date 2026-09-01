import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { latestVerifiedDate, parseBills } from '../../src/lib/bills';

describe('bill snapshot validation', () => {
  test('parses a valid snapshot', () => {
    const bills = parseBills([
      {
        title: 'Constitution (One Hundred and Thirty-first Amendment) Bill, 2026',
        house: 'lok-sabha',
        status: 'rejected',
        summary: 'Delimitation package tied to the women’s reservation law.',
        introducedOn: '2026-04-16',
        lastVerified: '2026-08-31',
        sourceUrl: 'https://prsindia.org/billtrack/the-constitution-131st-amendment-bill-2026',
      },
    ]);
    expect(bills).toHaveLength(1);
    expect(bills[0]?.status).toBe('rejected');
  });

  test('a bill missing lastVerified fails, naming the bill and the field', () => {
    const broken = [
      {
        title: 'Constitution (One Hundred and Thirtieth Amendment) Bill, 2025',
        house: 'lok-sabha',
        status: 'pending',
        sourceUrl: 'https://prsindia.org/billtrack/the-constitution-one-hundred-and-thirtieth-amendment-bill-2025',
      },
    ];
    expect(() => parseBills(broken)).toThrowError(/One Hundred and Thirtieth.*lastVerified/s);
  });

  test('an unknown status fails validation', () => {
    const broken = [
      {
        title: 'Test Bill',
        house: 'lok-sabha',
        status: 'suspended',
        lastVerified: '2026-08-31',
        sourceUrl: 'https://example.com',
      },
    ];
    expect(() => parseBills(broken)).toThrowError(/status/);
  });

  test('latestVerifiedDate returns the most recent verification date', () => {
    expect(
      latestVerifiedDate([
        { lastVerified: '2026-08-31' },
        { lastVerified: '2026-07-15' },
        { lastVerified: '2026-08-01' },
      ] as Array<{ lastVerified: string }>),
    ).toBe('2026-08-31');
  });

  test('the committed snapshot parses and every bill carries a last verified date', () => {
    const snapshot = JSON.parse(readFileSync('src/data/bills/snapshot.json', 'utf8'));
    const bills = parseBills(snapshot);
    expect(bills.length).toBeGreaterThanOrEqual(2);
    for (const bill of bills) {
      expect(bill.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
