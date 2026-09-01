/**
 * Ordinal word to number conversion for amendment act citations such as
 * "the Constitution (Forty-second Amendment) Act, 1976".
 */

const UNITS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
};

const TENS: Record<string, number> = {
  twentieth: 20,
  thirtieth: 30,
  fortieth: 40,
  fiftieth: 50,
  sixtieth: 60,
  seventieth: 70,
  eightieth: 80,
  ninetieth: 90,
};

const TENS_PREFIX: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const CARDINALS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Ordinals used in compounds; cardinals cover the multiplier position of "one hundred and sixth". */
const WORD_VALUES: Record<string, number> = { ...CARDINALS, ...UNITS, ...TENS };

const ORDINAL_UNITS: string[] = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
];

const CARDINAL_UNITS: string[] = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS_WORDS: string[] = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Words for the ordinal form used in official act titles, 1 to 999. */
export function numberToOrdinalWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`numberToOrdinalWords expects 1 to 999, received ${n}`);
  }

  let words = '';
  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    words += `${CARDINAL_UNITS[hundreds - 1]} hundred`;
    n %= 100;
    if (n === 0) return capitalize(`${words}th`);
    words += ' and ';
  }

  if (n < 20) {
    words += ORDINAL_UNITS[n - 1];
    return capitalize(words);
  }

  const tens = Math.floor(n / 10);
  const units = n % 10;
  if (units === 0) {
    words += TENS_WORDS[tens - 2].slice(0, -1) + 'ieth';
  } else {
    words += `${TENS_WORDS[tens - 2]}-${ORDINAL_UNITS[units - 1]}`;
  }
  return capitalize(words);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function ordinalWordToNumber(word: string): number | null {
  const cleaned = word
    .trim()
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, ' ')
    .replace(/\bhundredth\b/g, 'hundred')
    .replace(/\s+/g, ' ');
  if (cleaned === '') return null;

  let total = 0;
  let sawNumber = false;

  for (const token of cleaned.split(' ')) {
    if (token === 'and' || token === 'the') continue;
    if (token === 'hundred') {
      total = (total === 0 ? 1 : total) * 100;
      sawNumber = true;
      continue;
    }
    const value = WORD_VALUES[token];
    if (value !== undefined) {
      total += value;
      sawNumber = true;
      continue;
    }
    const prefix = Object.keys(TENS_PREFIX).find((p) => token.startsWith(p));
    if (prefix) {
      total += TENS_PREFIX[prefix] ?? 0;
      const rest = token.slice(prefix.length);
      if (rest !== '' && WORD_VALUES[rest] === undefined) return null;
      if (rest !== '') total += WORD_VALUES[rest] ?? 0;
      sawNumber = true;
      continue;
    }
    return null;
  }

  return sawNumber ? total : null;
}
