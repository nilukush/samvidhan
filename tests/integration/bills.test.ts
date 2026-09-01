import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { getBills } from '../../src/lib/bills';

const bills = getBills();

describe('upcoming changes page', () => {
  test('the page exists with every bill and its status pill', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const html = readFileSync('dist/changes/upcoming/index.html', 'utf8');
    for (const bill of bills) {
      expect(html).toContain(bill.title);
      expect(html).toContain(`pill-${bill.status}`);
    }
  });

  test('every row shows a last verified date and the banner shows the latest one', () => {
    const html = readFileSync('dist/changes/upcoming/index.html', 'utf8');
    for (const bill of bills) {
      expect(html).toContain(bill.lastVerified);
    }
    const latest = bills
      .map((b) => b.lastVerified)
      .sort()
      .at(-1) as string;
    const [year, month, day] = latest.split('-');
    expect(html).toContain(`${day} ${monthName(Number(month))} ${year}`);
  });

  test('sources are linked, never scraped at runtime', () => {
    const html = readFileSync('dist/changes/upcoming/index.html', 'utf8');
    expect(html).toContain('https://prsindia.org/billtrack/the-constitution-131st-amendment-bill-2026');
    expect(html).toContain('https://sansad.in');
    expect(html).not.toMatch(/<script[^>]*\ssrc=(?!"\/search\.js")/);
    expect(html).not.toContain('XMLHttpRequest');
  });
});

function monthName(month: number): string {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][month - 1] as string;
}
