import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * Design system regression test: the token pairs named in
 * docs/DESIGN-SYSTEM.md section 3 must keep their WCAG contrast ratios.
 * Changing a color token without rechecking accessibility fails here.
 */

function loadTokens(): Map<string, string> {
  const css = readFileSync('src/styles/tokens.css', 'utf8');
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens.set(match[1] as string, (match[2] as string).toLowerCase());
  }
  return tokens;
}

function channel(hex: string, start: number): number {
  // hex includes the leading '#', so channels start one character in
  return Number.parseInt(hex.slice(start + 1, start + 3), 16) / 255;
}

function luminance(hex: string): number {
  const components = [0, 2, 4].map((start) => {
    const c = channel(hex, start);
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (components[0] as number) + 0.7152 * (components[1] as number) + 0.0722 * (components[2] as number);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

const PAIRS: Array<[string, string, number, string]> = [
  ['--color-ink', '--color-paper', 7, 'body text'],
  ['--color-link', '--color-paper', 4.5, 'links'],
  ['--color-navy', '--color-paper', 4.5, 'headings and primary buttons'],
  ['--color-paper', '--color-navy', 4.5, 'hero and footer text'],
  ['--color-paper', '--color-navy-deep', 4.5, 'footer text'],
  ['--color-saffron', '--color-paper', 3, 'large type and graphics only'],
  ['--color-amber', '--color-amber-soft', 4.5, 'pending badges'],
  ['--color-red', '--color-red-soft', 4.5, 'rejected and omitted badges'],
  ['--color-green', '--color-green-soft', 4.5, 'in force badges'],
  ['--color-focus', '--color-navy', 3, 'focus ring on navy underlay'],
];

describe('design tokens', () => {
  const tokens = loadTokens();

  test('defines every token the design system names', () => {
    const expected = [
      '--color-ink',
      '--color-navy',
      '--color-navy-deep',
      '--color-saffron',
      '--color-saffron-soft',
      '--color-green',
      '--color-green-soft',
      '--color-paper',
      '--color-surface',
      '--color-line',
      '--color-link',
      '--color-amber',
      '--color-amber-soft',
      '--color-red',
      '--color-red-soft',
      '--color-focus',
    ];
    for (const name of expected) {
      expect(tokens.has(name), `missing token ${name}`).toBe(true);
    }
  });

  test.each(PAIRS)('%s on %s meets the ratio for %s', (foreground, background, minimum) => {
    const fg = tokens.get(foreground);
    const bg = tokens.get(background);
    expect(fg, `${foreground} not defined`).toBeDefined();
    expect(bg, `${background} not defined`).toBeDefined();
    const ratio = contrastRatio(fg as string, bg as string);
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});
