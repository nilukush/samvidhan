import { ordinalWordToNumber } from './ordinals.ts';

export type ClauseKind = 'clause' | 'explanation' | 'illustration' | 'proviso';

export interface ParsedClause {
  number?: string;
  text: string;
  kind: ClauseKind;
}

export type ParsedStatus = 'in-force' | 'amended' | 'omitted' | 'repealed';

export interface ParsedArticle {
  number: string;
  part: string;
  title: string;
  section?: string;
  clauses: ParsedClause[];
  status: ParsedStatus;
  amendedBy: string[];
}

export interface ParsedPart {
  number: string;
  name: string;
}

export interface ParsedSchedule {
  number: number;
  title: string;
  text: string;
}

export interface ScheduleOverride {
  anchorPrefix: string;
  number: number;
  title: string;
}

export interface ParsedConstitution {
  preamble: string;
  parts: ParsedPart[];
  articles: ParsedArticle[];
  schedules: ParsedSchedule[];
}

/**
 * The printed heading "SECOND SCHEDULE" is absent from the PDF's text layer
 * (it renders as artwork); its bracketed article list survives. This anchor
 * starts schedule two at that surviving subtitle line.
 */
export const SCHEDULE_OVERRIDES: ScheduleOverride[] = [
  { anchorPrefix: '[Articles 59(3)', number: 2, title: 'Provisions as to the President and the Governors of States' },
];

const SCHEDULE_WORDS = [
  'FIRST',
  'SECOND',
  'THIRD',
  'FOURTH',
  'FIFTH',
  'SIXTH',
  'SEVENTH',
  'EIGHTH',
  'NINTH',
  'TENTH',
  'ELEVENTH',
  'TWELFTH',
];

const AMENDMENT_ACT_RE = /Constitution\s*\(([^)]+?)\s+Amendment\)\s+Act/gi;
const ROMAN_RE = /^(X{0,3}(IX|IV|V?I{0,3}))([A-B]?)$/;
const PAGE_NUMBER_RE = /^\d{1,3}$/;
const ARTICLE_HEADING_RE = /^(\d{1,3}[A-Z]?)\.\s+(.+)$/;
const CLAUSE_START_RE = /^\((\d{1,2}[A-Z]?)\)\s*(.*)$/;
const EXPLANATION_RE = /^Explanation\s*(?:([IVX]+))?\.\s*(.*)$/i;
const ILLUSTRATION_RE = /^Illustration\b[.:]?\s*(.*)$/i;
const MARKER_RE = /^(\d{1,2})\[/;
const FOOTNOTE_SIGNAL_RE =
  /\b(ibid\.|w\.e\.f|vide|notification|ins\.|subs\.|omit|renumber|added|repealed|proviso|explanation|sub-clause|word|words|act,|s\.\s|sch\.)|\b(19|20)\d\d/i;

/** Strips a leading footnote marker such as "2[33. ..." for structural tests. */
function splitMarker(line: string): { clean: string; marker: number | null } {
  // This edition sometimes sets the title separator as ".-" instead of an em dash.
  let normalized = line.replace(/(\.)\s*-\s*/g, '$1\u2014 ');
  // An artwork bracket may precede the number: "[2A. ..."
  normalized = normalized.replace(/^\[(?=\d)/, '');
  const match = /^(\d{1,2})\[\s*/.exec(normalized);
  if (match !== null) {
    return { clean: normalized.slice(match[0].length), marker: Number(match[1]) };
  }
  return { clean: normalized, marker: null };
}

function isFootnoteLine(line: string): boolean {
  if (FOOTNOTE_START_RE.test(line)) return true;
  if (!/^\d{1,2}\.\s+/.test(line)) return false;
  return FOOTNOTE_SIGNAL_RE.test(line);
}

const FOOTNOTE_START_RE =
  /^\d{1,2}\.\s+(Ins\.|Subs\.|Add|Omit|Substitut|Amend|Re-?numbered|Renumber|Repealed|The words|The entry|The bracket|Note|Ed\.|Also see|Published|Certain|Art\.?|Cl\.|Cls\.|Clause|Sub-cl|See|Section|Sch\.?|Para|Entry|Original|Part\s|In exercise|W\.e\.f)/i;
/** Matched against whitespace-collapsed text so "P ART VI" style artifacts still hit. */
const PART_HEADING_RE = /^PART([IVXLC]+[A-Z]?)$/;
const CHAPTER_HEADING_RE = /^CHAPTER([IVX]+)\./;

/**
 * Part VIII's "PART VIII" heading is absent from the text layer; its name
 * line survives with a marker prefix. Anchored here, same pattern as the
 * schedule overrides. Part VII was omitted by the 7th Amendment and its
 * heading does not appear at all; it is synthesized after parsing.
 */
const PART_NAME_ANCHORS: Record<string, { number: string; name: string }> = {
  THEUNIONTERRITORIES: { number: '8', name: 'THE UNION TERRITORIES' },
  FUNDAMENTALDUTIES: { number: '4A', name: 'FUNDAMENTAL DUTIES' },
  TRIBUNALS: { number: '14A', name: 'TRIBUNALS' },
};

const SYNTHETIC_PARTS: ParsedPart[] = [{ number: '7', name: '[Omitted.]' }];

function squish(line: string): string {
  return line.replace(/\s+/g, '');
}

function romanToPartNumber(roman: string): string | null {
  const match = ROMAN_RE.exec(roman.toUpperCase());
  if (!match) return null;
  const digits = match[1] as string;
  const suffix = match[3] ?? '';
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    const current = values[digits[i] as string] ?? 0;
    const next = i + 1 < digits.length ? (values[digits[i + 1] as string] ?? 0) : 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? `${total}${suffix}` : null;
}

function amendmentId(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}-amendment`;
}

function extractAmendments(text: string): number[] {
  const found: number[] = [];
  AMENDMENT_ACT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMENDMENT_ACT_RE.exec(text)) !== null) {
    const n = ordinalWordToNumber(match[1] as string);
    if (n !== null && n >= 1 && n <= 200) found.push(n);
  }
  return found;
}

/** Strips artwork brackets and collapses doubled terminal periods to one. */
function cleanTitle(raw: string): string {
  let title = raw.replace(/\s+/g, ' ').trim();
  title = title.replace(/\.+$/, '');
  const bracketed = /^\[(.+)\]$/.exec(title);
  if (bracketed) title = (bracketed[1] as string).replace(/\.+$/, '');
  title = title.trim();
  return title === '' ? title : `${title}.`;
}

interface ParserState {
  preambleLines: string[];
  parts: ParsedPart[];
  articles: ParsedArticle[];
  schedules: ParsedSchedule[];
  phase: 'pre' | 'preamble' | 'articles' | 'schedules' | 'appendices';
  currentPartNumber: string;
  currentPartName: string[];
  partNameOpen: boolean;
  currentSection: string;
  article: ParsedArticle | null;
  titlePending: string[];
  titleOpen: boolean;
  lastArticleNumeric: number;
  clause: ParsedClause | null;
  schedule: ParsedSchedule | null;
  pendingMarkers: Map<number, ParsedArticle | null>;
  footnoteBuffer: string[];
}

function partSortKey(number: string): number {
  const match = /^(\d{1,2})([A-Z]?)$/.exec(number);
  if (!match) return 999;
  return Number(match[1]);
}

function scheduleWordToNumber(word: string): number {
  return SCHEDULE_WORDS.indexOf(word.toUpperCase()) + 1;
}

/** The next line that carries meaning for structure detection. */
function nextMeaningfulLine(lines: string[], from: number): string | null {
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i].replace(/\f/g, '').trim();
    const squeezed = squish(line);
    if (squeezed === '' || PAGE_NUMBER_RE.test(squeezed)) continue;
    return line;
  }
  return null;
}

function looksLikeSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length > 2 &&
    trimmed.length < 60 &&
    !/[.,;:]$/.test(trimmed) &&
    !trimmed.startsWith('(') &&
    /^[A-Z]/.test(trimmed) &&
    /[a-z]/.test(trimmed)
  );
}

export function parseConstitution(
  raw: string,
  opts?: { scheduleOverrides?: ScheduleOverride[]; startPhase?: 'pre' | 'articles' },
): ParsedConstitution {
  const overrides = (opts?.scheduleOverrides ?? SCHEDULE_OVERRIDES).map((o) => ({
    ...o,
    squishedPrefix: squish(o.anchorPrefix),
  }));
  const state: ParserState = {
    preambleLines: [],
    parts: [],
    articles: [],
    schedules: [],
    // startPhase lets tests parse body excerpts without the preamble prologue;
    // the production run always starts at 'pre' to skip the table of contents.
    phase: opts?.startPhase ?? 'pre',
    currentPartNumber: '',
    currentPartName: [],
    partNameOpen: false,
    currentSection: '',
    article: null,
    titlePending: [],
    titleOpen: false,
    lastArticleNumeric: 0,
    clause: null,
    schedule: null,
    pendingMarkers: new Map(),
    footnoteBuffer: [],
  };

  const lines = raw.split('\n');

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] as string;
    const line = rawLine.replace(/\f/g, '').trimEnd();
    const squeezed = squish(line);

    if (state.footnoteBuffer.length > 0) {
      if (squeezed === '' || isStructuralLine(line)) {
        flushFootnote(state);
      } else {
        state.footnoteBuffer.push(line.trim());
        continue;
      }
    }

    if (squeezed === '' || PAGE_NUMBER_RE.test(squeezed)) continue;

    if (state.phase === 'pre') {
      if (line.startsWith('WE, THE PEOPLE OF INDIA')) {
        state.phase = 'preamble';
        appendPreambleLine(state, line);
      }
      continue;
    }

    if (state.phase === 'preamble') {
      if (isFootnoteLine(line)) {
        state.footnoteBuffer.push(line.trim());
        continue;
      }
      appendPreambleLine(state, line);
      if (/THISCONSTITUTION\.$/.test(squeezed)) {
        state.phase = 'articles';
      }
      continue;
    }

    if (state.phase === 'articles' || state.phase === 'schedules') {
      if (/^APPENDIXI/.test(squeezed.replace(/[^A-Z]/g, ''))) {
        closeArticle(state);
        closeSchedule(state);
        state.phase = 'appendices';
        continue;
      }
      if (handleScheduleStart(state, squeezed, overrides)) continue;
    }

    if (state.phase === 'articles') {
      if (handleStructuralHeading(state, line)) continue;

      // A short title case line directly above an article heading is a section
      // heading such as "Right to Equality"; it closes the previous article.
      if (looksLikeSectionHeading(line)) {
        const next = nextMeaningfulLine(lines, index);
        if (next !== null && ARTICLE_HEADING_RE.test(next)) {
          closeArticle(state);
          state.currentSection = line.trim();
          continue;
        }
      }

      if (handleArticleLine(state, line)) continue;
      handleSectionOrPartName(state, line);
      continue;
    }

    if (state.phase === 'schedules') {
      if (isFootnoteLine(line)) {
        state.footnoteBuffer.push(line.trim());
        continue;
      }
      const marker = MARKER_RE.exec(line);
      let content = line;
      if (marker) {
        state.pendingMarkers.set(Number(marker[1]), null);
        content = line.slice(marker[0].length - 1);
      }
      if (state.schedule) state.schedule.text += (state.schedule.text ? '\n' : '') + content.trim();
      continue;
    }
  }

  flushFootnote(state);
  closeArticle(state);
  closeSchedule(state);
  flushPartName(state);

  const parts = [...state.parts];
  // Synthetic parts only apply to full document runs, where a missing part
  // heading is a text layer gap rather than a truncated excerpt.
  if (state.parts.length >= 15)
    for (const synthetic of SYNTHETIC_PARTS) {
      if (!parts.some((p) => p.number === synthetic.number)) parts.push({ ...synthetic });
    }
  parts.sort((a, b) => partSortKey(a.number) - partSortKey(b.number) || a.number.localeCompare(b.number));

  return {
    preamble: state.preambleLines.join(' ').replace(/\s+/g, ' ').trim(),
    parts,
    articles: state.articles,
    schedules: state.schedules,
  };
}

/** Lines that footnotes must never swallow: headings of parts, chapters, schedules, articles, appendices. */
function isStructuralLine(line: string): boolean {
  const s = structuralText(line);
  if (PART_HEADING_RE.test(s)) return true;
  if (CHAPTER_HEADING_RE.test(s)) return true;
  if (s.startsWith('APPENDIX')) return true;
  if (SCHEDULE_WORDS.some((w) => s.startsWith(w + 'SCHEDULE'))) return true;
  // Article headings win over footnote classification when they carry a
  // title dash; wrapped titles without a dash only win when they are not
  // footnote-flavoured. Markers may prefix the whole heading.
  const { clean } = splitMarker(line.trim());
  const dashIndex = indexOfDash(clean);
  const dashHasBody = dashIndex !== -1 && clean.slice(dashIndex + 1).trim().length > 0;
  if (ARTICLE_HEADING_RE.test(clean) && (dashHasBody || !isFootnoteLine(clean))) return true;
  return false;
}

function appendPreambleLine(state: ParserState, line: string): void {
  let content = line.trim();
  const marker = MARKER_RE.exec(content);
  if (marker) content = content.slice(marker[0].length - 1);
  if (content) state.preambleLines.push(content);
}

function handleScheduleStart(
  state: ParserState,
  squeezed: string,
  overrides: Array<ScheduleOverride & { squishedPrefix: string }>,
): boolean {
  const body = squeezed.replace(/^\d{1,2}\[?/, '');
  const word = SCHEDULE_WORDS.find((w) => body === w + 'SCHEDULE' || body.startsWith(w + 'SCHEDULE'));
  if (word) {
    const number = scheduleWordToNumber(word);
    if (number > 0) {
      closeArticle(state);
      closeSchedule(state);
      state.phase = 'schedules';
      state.schedule = { number, title: '', text: '' };
      return true;
    }
  }
  for (const override of overrides) {
    if (squeezed.startsWith(override.squishedPrefix)) {
      closeArticle(state);
      closeSchedule(state);
      state.phase = 'schedules';
      state.schedule = { number: override.number, title: override.title, text: '' };
      return true;
    }
  }
  return false;
}

/** Whitespace collapsed, marker and artwork bracket stripped, upper cased. */
function structuralText(line: string): string {
  return squish(line)
    .toUpperCase()
    .replace(/^\d{1,2}\[?/, '')
    .replace(/\]+$/, '');
}

/** PART and CHAPTER headings and anchored part names; false when none. */
function handleStructuralHeading(state: ParserState, line: string): boolean {
  const s = structuralText(line);
  const partMatch = PART_HEADING_RE.exec(s);
  if (partMatch) {
    closeArticle(state);
    const number = romanToPartNumber(partMatch[1] as string);
    if (number) {
      flushPartName(state);
      state.currentPartNumber = number;
      state.currentPartName = [];
      state.partNameOpen = true;
    }
    return true;
  }
  if (CHAPTER_HEADING_RE.test(s)) {
    flushPartName(state);
    state.currentSection = line.trim();
    return true;
  }
  const anchor = PART_NAME_ANCHORS[s];
  if (anchor) {
    closeArticle(state);
    flushPartName(state);
    state.currentPartNumber = anchor.number;
    state.currentPartName = [anchor.name];
    state.partNameOpen = false;
    registerPart(state);
    return true;
  }
  return false;
}

function handleArticleLine(state: ParserState, rawLine: string): boolean {
  const { clean: line, marker: headingMarker } = splitMarker(rawLine.trim());
  if (headingMarker !== null && state.article !== null) {
    state.pendingMarkers.set(headingMarker, state.article);
  }

  const headingCandidate = ARTICLE_HEADING_RE.test(line);
  const dashIndex = indexOfDash(line);
  const dashHasBody = dashIndex !== -1 && line.slice(dashIndex + 1).trim().length > 0;
  const winsAsHeading = headingCandidate && (dashHasBody || !isFootnoteLine(line));
  if (!winsAsHeading && isFootnoteLine(line)) {
    state.footnoteBuffer.push(rawLine.trim());
    return true;
  }

  const heading = ARTICLE_HEADING_RE.exec(line);
  if (heading) {
    closeArticle(state);
    let number = heading[1] as string;
    const rest = heading[2] as string;

    // A bare marker digit can fuse onto the article number ("132A." for
    // marker 1 on article 32A). Document order disambiguates: a heading far
    // beyond the running sequence is a fusion, not a jump.
    let fusionMarker: number | null = null;
    const numeric = Number.parseInt(number, 10);
    if (state.lastArticleNumeric > 0 && Number.isNaN(numeric) === false && numeric > state.lastArticleNumeric + 40) {
      const alt = number.slice(1);
      const altNumeric = Number.parseInt(alt, 10);
      if (
        /^\d{1,3}[A-Z]?$/.test(alt) &&
        Number.isNaN(altNumeric) === false &&
        altNumeric <= state.lastArticleNumeric + 40
      ) {
        fusionMarker = Number.parseInt(number[0] as string, 10);
        number = alt;
      }
    }
    state.lastArticleNumeric = Number.parseInt(number, 10) || state.lastArticleNumeric;
    state.article = {
      number,
      part: state.currentPartNumber,
      title: '',
      section: state.currentSection || undefined,
      clauses: [],
      status: 'in-force',
      amendedBy: [],
    };
    const effectiveMarker = headingMarker ?? fusionMarker;
    if (effectiveMarker !== null) state.pendingMarkers.set(effectiveMarker, state.article);
    state.titlePending = [];
    state.clause = null;
    const dashIndex = indexOfDash(rest);
    state.titleOpen = dashIndex === -1;
    state.titlePending.push(state.titleOpen ? rest : rest.slice(0, dashIndex));
    if (!state.titleOpen) {
      appendArticleBody(state, stripLeadingDashes(rest.slice(dashIndex + 1).trim()));
    }
    return true;
  }

  if (state.article === null) return false;

  if (state.titleOpen) {
    const dashIndex = indexOfDash(line);
    if (dashIndex === -1) {
      state.titlePending.push(line.trim());
      return true;
    }
    state.titleOpen = false;
    state.titlePending.push(line.slice(0, dashIndex).trim());
    appendArticleBody(state, stripLeadingDashes(line.slice(dashIndex + 1).trim()));
    return true;
  }

  appendArticleBody(state, line);
  return true;
}

/** All horizontal dash glyphs the document uses between title and body. */
const DASH_RE = /[\u2011\u2012\u2013\u2014\u2015\u23AF]/;

function indexOfDash(text: string): number {
  const match = DASH_RE.exec(text);
  return match === null ? -1 : match.index;
}

function stripLeadingDashes(text: string): string {
  return text.replace(/^[\u2011\u2012\u2013\u2014\u2015\u23AF]+\s*/, '');
}

function appendArticleBody(state: ParserState, rawLine: string): void {
  let line = rawLine.trim();
  if (line === '') return;

  const marker = MARKER_RE.exec(line);
  if (marker) {
    state.pendingMarkers.set(Number(marker[1]), state.article);
    line = line.slice(marker[0].length - 1);
    if (line === '') return;
  }

  // A marker immediately followed by a clause, as in "1[(4) Nothing...", keeps
  // its opening bracket only as artwork; drop it so the clause is recognised.
  line = line.replace(/^\[\s*(?=\(\d{1,2}[A-Z]?\))/, '');

  const explanation = EXPLANATION_RE.exec(line);
  if (explanation) {
    pushClause(state, {
      number: undefined,
      kind: 'explanation',
      text: normalizeSpace((explanation[2] ?? '').replace(/^[\u2014\u23AF]\s*/, '')),
    });
    return;
  }

  const illustration = ILLUSTRATION_RE.exec(line);
  if (illustration) {
    pushClause(state, { number: undefined, kind: 'illustration', text: normalizeSpace(illustration[1] ?? '') });
    return;
  }

  const clause = CLAUSE_START_RE.exec(line);
  if (clause) {
    pushClause(state, { number: clause[1], kind: 'clause', text: normalizeSpace(clause[2] ?? '') });
    return;
  }

  if (state.clause) {
    state.clause.text = normalizeSpace(`${state.clause.text} ${line}`);
  } else {
    pushClause(state, { number: undefined, kind: 'clause', text: normalizeSpace(line) });
  }
}

function pushClause(state: ParserState, clause: ParsedClause): void {
  if (state.article === null) return;
  state.clause = clause;
  state.article.clauses.push(clause);
}

/** Section headings above articles and the all caps part name lines. */
function handleSectionOrPartName(state: ParserState, line: string): void {
  if (state.partNameOpen) {
    const cleaned = line
      .trim()
      .replace(/[\d*[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const isNameLine = cleaned.length > 1 && /^[A-Z][A-Z\s&,'\u2019().-]*$/.test(cleaned);
    if (isNameLine) {
      state.currentPartName.push(cleaned);
      return;
    }
    flushPartName(state);
  }

  if (looksLikeSectionHeading(line)) {
    state.currentSection = line.trim();
  }
}

function flushPartName(state: ParserState): void {
  if (!state.partNameOpen) return;
  state.partNameOpen = false;
  const name = state.currentPartName.join(' ').replace(/\s+/g, ' ').trim();
  if (name) registerPart(state);
}

function registerPart(state: ParserState): void {
  const name = state.currentPartName.join(' ').replace(/\s+/g, ' ').trim();
  if (state.currentPartNumber === '' || !name) return;
  if (!state.parts.some((p) => p.number === state.currentPartNumber)) {
    state.parts.push({ number: state.currentPartNumber, name });
  }
}

function closeArticle(state: ParserState): void {
  const article = state.article;
  if (article === null) return;
  state.article = null;
  state.clause = null;
  state.titleOpen = false;

  const rawTitle = state.titlePending.join(' ').trim();
  if (rawTitle) {
    article.title = cleanTitle(rawTitle);
  }
  state.titlePending = [];

  // Clause markers whose text continues on later lines can leave trailing
  // empty entries when the source ends mid clause.
  article.clauses = article.clauses.filter((c) => c.text.length > 0);

  const bodyText = article.clauses.map((c) => c.text).join(' ');
  for (const n of extractAmendments(bodyText)) {
    const id = amendmentId(n);
    if (!article.amendedBy.includes(id)) article.amendedBy.push(id);
  }

  const firstClause = article.clauses[0]?.text ?? '';
  if (/^\[?\s*Omitted/i.test(firstClause)) {
    article.status = 'omitted';
  } else if (/^\[?\s*Repealed/i.test(firstClause)) {
    article.status = 'repealed';
  } else if (article.amendedBy.length > 0) {
    article.status = 'amended';
  } else {
    article.status = 'in-force';
  }

  state.articles.push(article);
}

function closeSchedule(state: ParserState): void {
  const schedule = state.schedule;
  if (schedule === null) return;
  state.schedule = null;
  if (!schedule.title) {
    schedule.title = firstTitleLine(schedule.text) ?? `Schedule ${schedule.number}`;
  }
  state.schedules.push(schedule);
}

function firstTitleLine(text: string): string | null {
  for (const line of text.split('\n').slice(0, 4)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[Articles')) continue;
    if (trimmed.length > 2 && /[a-zA-Z]/.test(trimmed)) return trimmed;
  }
  return null;
}

function flushFootnote(state: ParserState): void {
  const buffer = state.footnoteBuffer;
  state.footnoteBuffer = [];
  if (buffer.length === 0) return;
  const text = buffer.join(' ');
  const numberMatch = /^(\d{1,2})\./.exec(buffer[0] ?? '');
  const markerNumber = numberMatch ? Number(numberMatch[1]) : null;
  const target = (markerNumber !== null ? state.pendingMarkers.get(markerNumber) : undefined) ?? state.article;
  if (markerNumber !== null) state.pendingMarkers.delete(markerNumber);
  for (const n of extractAmendments(text)) {
    const id = amendmentId(n);
    if (target && !target.amendedBy.includes(id)) target.amendedBy.push(id);
  }
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
