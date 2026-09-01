import { readFileSync, writeFileSync } from 'node:fs';
import { numberToOrdinalWords } from './ordinals.ts';
import { amendmentId } from './parse.ts';
import { AmendmentSchema } from '../../src/lib/schemas/index.ts';

const RAW_PATH = 'data/processed/raw.txt';
const WIKI_PATH = 'data/reference/wikipedia-amendments.wiki';
const CONSTITUTION_PATH = 'data/processed/constitution.json';
const OUTPUT_PATH = 'src/data/amendments/amendments.json';
const TOTAL = 106;

/**
 * Hand written summaries for landmark amendments, checked against the
 * sources in docs/ANALYSIS.md. All other summaries are generated strictly
 * from our own tracked data, never invented.
 */
const LANDMARK_SUMMARIES: Record<number, { summary: string; theme?: 'rights' | 'federal' | 'emergency' | 'social' }> = {
  1: {
    summary:
      'Enabled special provisions for socially and educationally backward classes and shielded land reform laws from challenge under fundamental rights.',
    theme: 'social',
  },
  7: {
    summary:
      'Reorganised states and abolished the four fold classification of states, creating the union territory framework.',
    theme: 'federal',
  },
  24: {
    summary:
      'Declared that Parliament may amend any provision of the Constitution, including fundamental rights, through Article 368.',
    theme: 'rights',
  },
  25: {
    summary:
      'Curtailed the fundamental right to property and widened protection for directive principles over property rights.',
    theme: 'rights',
  },
  26: {
    summary: 'Abolished the privy purses and privileges of the former rulers of princely states.',
    theme: 'social',
  },
  42: {
    summary:
      'The mini Constitution: inserted Socialist, Secular, and Integrity into the Preamble, curtailed judicial review, extended the Lok Sabha term, and added fundamental duties.',
    theme: 'emergency',
  },
  44: {
    summary:
      'Undid much of the 42nd Amendment: property became an ordinary legal right, Article 31 was omitted, and judicial review was restored.',
    theme: 'emergency',
  },
  52: { summary: 'Defined disqualification of legislators on the ground of defection through the Tenth Schedule.' },
  61: { summary: 'Lowered the voting age for Lok Sabha and assembly elections from 21 to 18.', theme: 'social' },
  73: {
    summary:
      'Constitutionalised Panchayati Raj with three tier panchayats, reservations for women and Scheduled Castes and Tribes, and the Eleventh Schedule.',
    theme: 'social',
  },
  74: { summary: 'Constitutionalised urban local governments and added the Twelfth Schedule.', theme: 'social' },
  86: {
    summary: 'Made free and compulsory education for children aged six to fourteen a fundamental right.',
    theme: 'social',
  },
  97: { summary: 'Gave constitutional status to co operative societies.', theme: 'social' },
  99: {
    summary:
      'Created the National Judicial Appointments Commission for judicial appointments; the Commission was struck down by the Supreme Court in 2015.',
    theme: 'federal',
  },
  100: { summary: 'Gave effect to the land boundary agreement between India and Bangladesh.', theme: 'federal' },
  101: {
    summary: 'Introduced the Goods and Services Tax with a GST Council shared between the Union and the states.',
    theme: 'federal',
  },
  102: { summary: 'Gave constitutional status to the National Commission for Backward Classes.', theme: 'social' },
  103: {
    summary:
      'Enabled up to ten per cent reservation for economically weaker sections in education and public employment.',
    theme: 'social',
  },
  104: {
    summary:
      'Extended reservation for Scheduled Castes and Tribes and ended the nomination of Anglo Indians to legislatures.',
    theme: 'social',
  },
  105: { summary: "Restored states' power to identify Other Backward Classes for reservation.", theme: 'social' },
  106: {
    summary:
      'The Nari Shakti Vandan Adhiniyam: reserves one third of seats for women in the Lok Sabha, state assemblies, and the Delhi assembly.',
    theme: 'social',
  },
};

/** Milestone dates verified against the sources recorded in AGENTS.md. */
const MILESTONES: Record<number, Record<string, string>> = {
  106: {
    introducedIn: '2023-09-19',
    passedLokSabha: '2023-09-20',
    passedRajyaSabha: '2023-09-21',
    assent: '2023-09-28',
    inForce: '2026-04-16',
  },
};

const OPERATIVE_NOTES: Record<number, string> = {
  106: 'The reservation becomes operative after the first census taken after commencement and a delimitation exercise under Article 334A.',
};

/**
 * Years the official consolidated text cannot supply because no footnote
 * citing the Act survives. Filled from the vendored Wikipedia list's
 * "Enforced since" column, with one hand verified override: the Second
 * Amendment Act carries the short title year 1952 though it was enforced
 * on 1 May 1953.
 */
const YEAR_OVERRIDES: Record<number, number> = { 2: 1952 };

function parseWikiYears(wikitext: string): Map<number, number> {
  const months = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const years = new Map<number, number>();
  for (const line of wikitext.split('\n')) {
    const row = /^\|\s*\[\[[\w-]+ Amendment of the Constitution of India\|(\d{1,3})(?:st|nd|rd|th)\]\]/.exec(line);
    if (row === null) continue;
    const stripped = line.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<ref[^>]*\/>/g, '');
    const date = new RegExp('(\\d{1,2})\\s+(' + months + ')\\s+(\\d{4})').exec(stripped);
    if (date !== null) years.set(Number(row[1]), Number(date[3]));
  }
  return years;
}

interface ArticleEntry {
  number: string;
  amendedBy: string[];
}

function findYear(raw: string, words: string): number | null {
  const pattern = new RegExp(`Constitution\\s*\\(${words}\\s+Amendment\\)\\s*Act,?\\s*(\\d{4})`, 'gi');
  const years = new Map<number, number>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const year = Number(match[1]);
    years.set(year, (years.get(year) ?? 0) + 1);
  }
  if (years.size === 0) return null;
  return [...years.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function classifyTheme(
  articles: string[],
  landmarkTheme?: string,
): 'rights' | 'federal' | 'emergency' | 'social' | 'general' {
  if (landmarkTheme) return landmarkTheme as 'rights' | 'federal' | 'emergency' | 'social';
  const numeric = articles.map((a) => Number.parseInt(a, 10)).filter((n) => !Number.isNaN(n));
  if (numeric.some((n) => n >= 352 && n <= 360)) return 'emergency';
  if (numeric.some((n) => n >= 12 && n <= 35)) return 'rights';
  if (numeric.some((n) => (n >= 243 && n <= 243) || (n >= 330 && n <= 342))) return 'social';
  if (numeric.some((n) => (n >= 52 && n <= 151) || (n >= 245 && n <= 312) || (n >= 214 && n <= 231))) return 'federal';
  return 'general';
}

function build(): void {
  const raw = readFileSync(RAW_PATH, 'utf8');
  const wikiYears = parseWikiYears(readFileSync(WIKI_PATH, 'utf8'));
  const constitution = JSON.parse(readFileSync(CONSTITUTION_PATH, 'utf8')) as { articles: ArticleEntry[] };
  const amendments = [];
  const missingYears: number[] = [];
  const zeroCount: number[] = [];

  for (let n = 1; n <= TOTAL; n++) {
    const words = numberToOrdinalWords(n);
    const year = findYear(raw, words) ?? YEAR_OVERRIDES[n] ?? wikiYears.get(n) ?? null;
    if (year === null) missingYears.push(n);

    const id = amendmentId(n);
    const articlesAffected = constitution.articles
      .filter((article) => article.amendedBy.includes(id))
      .map((article) => article.number)
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b));
    if (articlesAffected.length === 0) zeroCount.push(n);

    const landmark = LANDMARK_SUMMARIES[n];
    const summary =
      landmark?.summary ??
      (articlesAffected.length > 0
        ? `Changed the text of ${articlesAffected.length} article${articlesAffected.length === 1 ? '' : 's'} in the consolidated text.`
        : 'No article level changes are tracked in the consolidated text for this amendment; see the amending Act for its full scope.');

    const entry = {
      number: n,
      ...(year !== null ? { year } : {}),
      ...(year !== null
        ? { title: `The Constitution (${words} Amendment) Act, ${year}` }
        : { title: `The Constitution (${words} Amendment) Act` }),
      summary,
      articlesAffected,
      ...(MILESTONES[n] ?? {}),
      ...(OPERATIVE_NOTES[n] ? { operativeNote: OPERATIVE_NOTES[n] } : {}),
      theme: classifyTheme(articlesAffected, landmark?.theme),
    };

    const parsed = AmendmentSchema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(`amendment ${n} failed schema: ${JSON.stringify(parsed.error.issues[0])}`);
    }
    amendments.push(parsed.data);
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(amendments, null, 2)}\n`);
  console.log(`wrote ${amendments.length} amendments to ${OUTPUT_PATH}`);
  console.log(`years resolved: ${TOTAL - missingYears.length}/${TOTAL}`);
  if (missingYears.length > 0) console.log(`missing years: ${missingYears.join(', ')}`);
  console.log(`zero tracked article amendments: ${zeroCount.join(', ') || 'none'}`);
}

build();
