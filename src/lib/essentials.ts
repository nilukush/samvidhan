import rawEssentials from '../data/essentials/essentials.json';
import { EssentialsFileSchema, type EssentialRef, type EssentialsFile } from './schemas/index.ts';

/**
 * Curated starting points for a general reader (docs/ANALYSIS-ESSENTIALS-AND-SITEMAP.md).
 * The file is maintained by hand like the bill snapshot: summaries are style
 * linted, references must resolve against the real dataset, and the whole
 * list carries a lastVerified date swept by the monthly ritual.
 */
export function parseEssentials(data: unknown): EssentialsFile {
  const parsed = EssentialsFileSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`essentials file is invalid at ${issue?.path.join('.')}: ${issue?.message}`);
  }
  return parsed.data;
}

export function getEssentials(): EssentialsFile {
  return parseEssentials(rawEssentials);
}

export interface EssentialLink {
  href: string;
  label: string;
}

export function refLink(ref: EssentialRef): EssentialLink {
  switch (ref.type) {
    case 'article':
      return { href: `/articles/${ref.value.toLowerCase()}/`, label: `Article ${ref.value}` };
    case 'part':
      return { href: `/parts/${ref.value.toLowerCase()}/`, label: `Part ${toRomanPart(ref.value)}` };
    case 'amendment':
      return { href: `/amendments/${ref.value}/`, label: `${ordinal(Number(ref.value))} Amendment` };
    case 'page': {
      if (!ref.label) {
        throw new Error(`page ref "${ref.value}" needs a label; a path alone has no link text`);
      }
      return { href: ref.value, label: ref.label };
    }
  }
}

/** 42 -> "42nd", 73 -> "73rd", 101 -> "101st", 111 -> "111th". */
function ordinal(number: number): string {
  const rem100 = number % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${number}th`;
  switch (number % 10) {
    case 1:
      return `${number}st`;
    case 2:
      return `${number}nd`;
    case 3:
      return `${number}rd`;
    default:
      return `${number}th`;
  }
}

/** "3" -> "III", "4A" -> "IVA": digits become roman numerals, suffix letters pass through. */
function toRomanPart(label: string): string {
  const match = /^(\d{1,2})([A-B]?)$/.exec(label);
  if (!match) return label;
  const values: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = Number(match[1]);
  let roman = '';
  for (const [value, numeral] of values) {
    while (rest >= value) {
      roman += numeral;
      rest -= value;
    }
  }
  return roman + (match[2] ?? '');
}
