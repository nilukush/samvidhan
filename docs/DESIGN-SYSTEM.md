# Design System: Samvidhan

Working title: Samvidhan (Hindi for Constitution). Subtitle line: "The Constitution of India, made readable."
Version: 1.0, 31 August 2026
Research basis: USWDS design principles (designsystem.digital.gov/design-principles), GOV.UK design principles (design-system.service.gov.uk), WCAG 2.2 AA, Core Web Vitals budgets for low end Android devices, and Indian national visual heritage (the Tiranga color specification, the Ashoka Chakra, the calligraphic original manuscript by Prem Behari Narain Raizada with art directed by Nandalal Bose).

## 1. Design Principles

Adapted from USWDS and GOV.UK to this project:

1. Start with the reader's need. A student looking for Article 14 or a citizen comparing amendment history is the job. Nothing ships that does not serve a lookup, a read, or an understanding.
2. Make it feel like a document of state, not a startup landing page. Dignity over decoration. The Constitution's own visual heritage (deep navy, ivory paper, chakra geometry) is the brand.
3. Static first, fast everywhere. Every article readable as plain HTML before any JavaScript runs. Target Lighthouse 95 plus on mobile on a simulated slow 4G device.
4. Accessible by default. WCAG 2.2 AA minimum: 4.5:1 text contrast (3:1 for large text), visible focus, keyboard paths for every interaction, reduced motion honored.
5. Do less, better. One type system, one accent palette, a handful of components. New pages reuse the system or the system gets amended, not bypassed.

## 2. Brand Identity

- Name: Samvidhan (working title, decided per session instructions).
- Wordmark: "Samvidhan" set in Fraunces SemiBold, small chakra glyph replacing the dot of the last "a" is optional and must pass contrast at small sizes.
- Motif: a simplified 24 spoke Ashoka Chakra line SVG, navy on light surfaces, ivory on navy surfaces. Used at three scales: 16 px inline, 48 px header, and as a large watermark at 8 percent opacity on the hero.
- Heritage cue: a hairline tricolor rule (saffron, ivory gap, green) used once per page, directly under the header. Never repeated elsewhere. One gesture, not a theme.

## 3. Color Tokens

Primary palette, anchored to the official Tiranga specification approximations (saffron #FF671F, green #046A38, navy #06038D per Wikipedia's Flag of India) with an ivory paper ground inspired by the original manuscript. Note: the popular web convention (#FF9933, #138808, #000080) is close but not spec derived. This system uses the spec derived values.

```css
:root {
  /* Brand */
  --color-ink: #1a1a2e;         /* body text, near black with navy cast */
  --color-navy: #06038d;        /* Ashoka Chakra navy, primary brand */
  --color-navy-deep: #040266;   /* hover, footer ground */
  --color-saffron: #f25c0a;     /* accent, large graphics only; darkened from flag #FF671F for WCAG 3:1, see note */
  --color-saffron-soft: #ffe8db;/* tinted backgrounds, badges */
  --color-green: #046a38;       /* success, "in force", amendment added */
  --color-green-soft: #e2f0e8;
  --color-paper: #fdfbf7;       /* page ground, warm ivory */
  --color-surface: #ffffff;     /* cards */
  --color-line: #e5e0d5;        /* hairline borders */

  /* Semantic */
  --color-link: #0b47d1;        /* navy shifted for 4.5:1 on paper */
  --color-amber: #8a5a00;       /* "pending" bill text, AA on amber tint */
  --color-amber-soft: #fff3d6;
  --color-red: #b3261e;         /* "lapsed", "rejected", omitted text */
  --color-red-soft: #fdecea;

  /* Feedback */
  --color-focus: #ffdd00;       /* GOV.UK style focus ring, on navy underlay */
}
```

Contrast rules (verified ratios):

| Pairing | Ratio | Use |
| --- | --- | --- |
| ink #1A1A2E on paper #FDFBF7 | about 15:1 | body text |
| link #0B47D1 on paper | about 7:1 | links |
| navy #06038D on paper | about 14:1 | headings, primary buttons |
| ivory #FDFBF7 on navy | about 14:1 | hero, footer text |
| saffron #F25C0A on paper | 3.2:1 | meaningful graphics and large type only, never small text. The flag approximation #FF671F measures 2.8:1 and is kept out of tokens; divergence logged in the plan change log |
| amber #8A5A00 on amber-soft | about 5.5:1 | pending badges |
| red #B3261E on red-soft | about 6:1 | rejected, omitted |

Saffron is a signal color, not a text color. Green and saffron never appear as text on each other.

## 4. Typography

Three families, all free (OFL licensed on Google Fonts), loaded with `font-display: swap`, one preloaded weight each, Latin subsets only until Hindi ships:

- Display: Fraunces (72 pt optical serif, warm, bookish). Hero, page titles, amendment numerals.
- Text and UI: Public Sans (USWDS's own typeface, civic by pedigree). Body, navigation, forms, tables.
- Devanagari (reserved for Phase 2 Hindi): Noto Sans Devanagari, subset, lazy.

Type scale (1.25 ratio, fluid via clamp):

| Token | Size | Family | Use |
| --- | --- | --- | --- |
| display-xl | clamp(2.6rem, 6vw, 4.25rem) | Fraunces 600 | home hero |
| display-l | clamp(2rem, 4vw, 2.75rem) | Fraunces 600 | page titles |
| heading-l | 1.75rem | Fraunces 600 | section titles, part titles |
| heading-m | 1.375rem | Public Sans 700 | card titles, article headings |
| body-l | 1.125rem | Public Sans 400 | article text (large for long form reading) |
| body | 1rem | Public Sans 400 | UI, descriptions |
| body-s | 0.875rem | Public Sans 400 | metadata, captions |
| mono-ref | 0.9375rem | ui-monospace stack | article numbers in tables and search results |

Measure: 68 characters maximum for article text. Line height 1.65 for body long form, 1.3 for headings.

## 5. Spacing, Radius, Elevation

- Base grid: 4 px. Spacing tokens: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius: 4 px small controls, 12 px cards and imagery. Nothing rounder. Dignity over friendliness.
- Elevation: no drop shadows on the static reading surface. Depth is expressed by 1 px `--color-line` borders (GOV.UK pattern). One exception: the command palette style search dialog may use `0 12px 40px rgba(6,3,141,0.18)`.
- Layout: max width 72rem container, 12 column grid at desktop, single column below 48rem. Article pages use a 8 plus 4 column split: text left, sticky part navigation right.

## 6. Iconography and Graphic Language

- Icons: Lucide (ISC license), 20 px, 1.5 px stroke, `aria-hidden` with text labels alongside. No icon-only controls anywhere.
- Chakra SVG: hand authored single path, `currentColor`, 24 spokes rendered at low stroke weight.
- Charts and timelines: inline SVG authored in components, never a chart library. Amendment timeline is a horizontal century band (1950 to today) with one node per amendment, color coded by theme (rights, federal, emergency, social).
- Imagery: no stock photography. Decorative elements come from typography and geometry only, keeping the bundle tiny and the tone archival.

## 7. Components

**Site header.** Sticky, paper ground, hairline bottom border plus the single tricolor rule. Left: wordmark and chakra. Center: nav (Preamble, Articles, Parts, Schedules, Amendments, Changes). Right: search trigger styled as an input (`/` keyboard shortcut, visible hint). Below 48rem the nav collapses to a labeled menu button.

**Search experience.** Two layers. Default: Pagefind keyword search in a full screen dialog, grouped results (Articles, Parts, Schedules, Amendments, Pages), highlighted terms, zero result state with suggestions. Opt in tab: "Concept search" with a one line explanation ("finds meaning, not just words"). Concept mode lazy loads the vector index and model in a Web Worker, shows an honest loading state with byte progress, and falls back to keyword automatically on any error, data saver preference, or timeout. Every result row: type badge, title, matched snippet, article number in mono.

**Article page.** Structure top to bottom: breadcrumb (Part number, part name), article number as display serif ("Article 14"), title, status badges, current text in body-l with numbered clauses, a "What it means" box (plain words explainer, amber left rule, written at an eighth grade reading level, 60 to 120 words), "Amended by" chips linking to amendment pages, prev and next article links, and citation block with "verified against the official text, [date]".

**Status badges.** Pill, 4 px radius, soft ground with dark text: green "In force", green "Added by 42nd Amendment", amber "Pending bill", red "Omitted 1978", red "Repealed". Numbered badge variants show the amending amendment.

**Amendment timeline.** Vertical on mobile, horizontal band on desktop. Each node: numeral, year, one line summary, theme color dot. Clicking opens the amendment detail page (date, full title, articles touched, summary, status). Dense years (1970s) use a magnifier pattern or year grouping rather than shrinking targets. All nodes are real links (SEO), not JS-only widgets.

**Upcoming changes table.** Bill title, house, introduction date, current status pill, last verified date, link out to sansad.in. Sorted by recent activity. A visible note: "Manual verification, updated monthly. For live status see sansad.in."

**Plain words explainer box.** Saffron-soft ground, navy text, "What it means" heading in heading-m. Content rules in section 9. Every article gets one in Phase 2.

**Footer.** Navy-deep ground, ivory text. Three groups: Explore (site sections), About (mission, sources and licensing, contact), The Record (last verified dates for text, amendments, bills). Includes public domain and CC attribution statements.

## 8. Motion

- Transitions: 150 to 200 ms ease-out on hover and focus states only.
- Page transitions: none. Instant static navigation.
- Timeline reveal: a single opacity and translate step, disabled under `prefers-reduced-motion`.
- No parallax, no autoplaying media, no scroll hijacking.

## 9. Content Principles

Because the writing is the product as much as the pixels:

- Plain, concrete, factual. Eighth grade reading level in explainers. Legal text is quoted exactly and labeled as such.
- Every claim about status carries a date: "verified 31 August 2026".
- Every article page answers its own question in the first 40 to 60 words (GEO research: answer blocks near headings are what generative engines extract).
- Attribution on every borrowed fact: official text (public domain), amendment facts (derived from Wikipedia, CC BY-SA 4.0, attributed), bill analysis (paraphrased from PRS India, linked).
- House style bans AI writing tells per project constraint: no em dashes, no "delve", "moreover", "furthermore", "it is important to note", "in today's fast paced world", no rule of three padding, no vague "some experts say". Sentences carry specific facts or get cut.
- Indian English spellings (labour, colour, centre) for site copy. Quoted legal text is never altered.

## 10. SEO and GEO Patterns

- Every article, part, schedule, and amendment is its own static URL with full text in the HTML source. No client-side-only content anywhere in the reading path.
- Title pattern: "Article 14, Constitution of India: equality before the law | Samvidhan".
- Description: 150 characters, factual, includes the answer's first clause.
- JSON-LD per page: schema.org Legislation for articles (with the caveat, verified, that Google has no dedicated rich result for it, it still signals structure to AI engines), Article for explainers, FAQPage only where a real FAQ exists, Dataset for the downloadable data, BreadcrumbList everywhere.
- Answer block: the first paragraph under each article heading is a 40 to 60 word direct answer, styled as a lede.
- /llms.txt maintained by hand at each release: site map in markdown, one line per section, link to a single markdown digest of all articles per part.
- robots.txt allows all crawlers including AI crawlers (a GEO prerequisite per the research).
- Sitemap split if it exceeds 50k URLs (it will not, roughly 600 URLs expected).

## 11. Accessibility Checklist (applies to every component)

- WCAG 2.2 AA: contrast per section 3 table, target size 24 by 24 px minimum (2.2 change), focus visible with the yellow on navy underlay technique, no drag-only interactions.
- Skip link to main content on every page.
- Landmarks: header, nav, main, footer, and search dialog as role="dialog" with focus trap and Escape to close.
- Timeline and table fully operable by keyboard and readable as linear HTML.
- `lang="en"` root, `lang="hi"` spans on any Devanagari term.
- Tested with axe on every page template plus one manual screen reader pass per release (VoiceOver, macOS and iOS).

## 12. Performance Budgets

| Metric | Budget |
| --- | --- |
| HTML per page | 60 KB or less uncompressed |
| CSS total | 30 KB |
| JS, article pages, no search open | 0 KB framework, under 10 KB total |
| JS, keyword search open | under 45 KB (Pagefind UI, lazy) |
| Vector index (semantic, lazy) | 2.6 MB int8 or 240 KB 1 bit, plus 5 to 23 MB model, opt in only |
| Fonts | 3 files, under 120 KB woff2 total after subsetting |
| Lighthouse mobile | 95 plus performance, 100 accessibility, 100 best practices, 100 SEO |

If a change breaks a budget, the change changes, not the budget.
