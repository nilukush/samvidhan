# Implementation Plan: Samvidhan, the Constitution of India Website

Date: 31 August 2026
Depends on: docs/ANALYSIS.md (approved), docs/DESIGN-SYSTEM.md
Method: strict TDD, one step per iteration, maximum 3 failed attempts per step before stopping for human guidance.

Testing stack (all free, decided upfront): Vitest for unit and data pipeline tests, Playwright for end to end smoke tests, axe core via `@axe-core/playwright` for accessibility, and Lighthouse CI for performance budgets. No paid tooling anywhere.

Global regression rule: after every step, run `npm test` (all Vitest suites), `npm run build`, and the Playwright smoke suite. Any previously green test that turns red halts the step and triggers the divergence protocol in section Divergence Handling.

---

## Step 1: Repository and Astro scaffold with CI

├─ Objective: a git repository with an Astro project (Astro 7 at execution time; research had cited 6), pinned dependencies, format and lint baseline, and a GitHub Actions workflow that runs the full test suite on every push.
├─ Prerequisites: none.
├─ Test First:
│  ├─ Test type: unit plus CI integration
│  ├─ Test cases: (a) `astro build` produces a dist directory with an index.html; (b) a placeholder Vitest test asserting the site config exports the expected site URL and title tokens; (c) GitHub Actions workflow file parses (actionlint) and runs on push.
│  └─ Expected: all fail because no project exists.
├─ Implementation:
│  ├─ Scope: `git init`, `npm create astro@latest` (minimal, no framework UI template), add Vitest, Playwright, ESLint, Prettier, GitHub Actions workflow. Commit the .gitignore that excludes CLAUDE.md, AGENTS.md, MEMORY.md, .env files, node_modules, dist.
│  └─ Constraints: no UI component libraries, no CSS frameworks. Plain Astro components and CSS custom properties per the design system.
├─ Acceptance Criteria:
│  ├─ Tests pass: scaffold tests green in CI on the first push.
│  ├─ No regressions: not applicable (first step).
│  └─ Code quality: Prettier and ESLint run clean in CI.
├─ Verification: green check on the GitHub Actions run for the scaffold commit.
└─ Stop/Go: proceed to Step 2.

---

## Step 2: Content schema and validation layer

├─ Objective: define the canonical data shapes (parts, articles, clauses, schedules, amendments, bills) as Zod schemas with fixtures, before any real data exists.
├─ Prerequisites: Step 1.
├─ Test First:
│  ├─ Test type: unit
│  ├─ Test cases: (a) a valid article fixture (number, part, title, clauses array, status enum, amendedBy list) parses; (b) an article with an invalid status enum is rejected; (c) a clause without text is rejected; (d) amendment fixture with year before 1950 or after the current year is rejected; (e) bill fixture without a lastVerified date is rejected.
│  └─ Expected: fail, schemas do not exist.
├─ Implementation:
│  ├─ Scope: `src/content/config.ts` Astro content collections plus a shared Zod schema module under `src/lib/schemas/` used by both the collections and the data pipeline. Fixtures under `tests/fixtures/`.
│  └─ Constraints: statuses limited to the design system enums (in force, amended, omitted, repealed, pending, rejected, lapsed). Article numbers normalized as strings ("14", "14A", "51A") because letter suffixes exist. Amendments carry the full legislative milestone set as separate optional date fields (introducedIn, passedLokSabha, passedRajyaSabha, assent, inForce) plus an operativeNote, because introduction, passage, enactment, and commencement are distinct dates: the 106th was introduced 19 September 2023, passed by Lok Sabha 20 September (454 to 2) and Rajya Sabha 21 September (214 to 0), enacted by assent and gazette 28 September 2023, and brought into force 16 April 2026, while its reservation remains inoperative pending census and delimitation under Article 334A.
├─ Acceptance Criteria:
│  ├─ Tests pass: all schema tests green.
│  ├─ No regressions: scaffold tests still green.
│  └─ Code quality: schemas imported from one place only, no duplication between collections and pipeline.
├─ Verification: `npm test` green; schema module reviewed against the ANALYSIS data model section.
└─ Stop/Go: proceed to Step 3. HIGH RISK note: the schema is the contract for the entire data pipeline, so a human review checkpoint is recommended here before extraction work begins.

---

## Step 3: PDF extraction pipeline

├─ Objective: a repeatable pipeline that converts the official Constitution PDF (manually downloaded and vendored under `data/source/`) into normalized JSON files matching the Step 2 schemas, with a validation report.
├─ Prerequisites: Step 2 approved. Official PDF downloaded by the human from legislative.gov.in and committed.
├─ Test First:
│  ├─ Test type: unit plus integration
│  ├─ Test cases: (a) extraction of a two page sample PDF produces expected article blocks; (b) article boundary detection correctly splits "14. Equality before the law" from "15. Prohibition of discrimination"; (c) clause numbering (1, 2, 2A, explanation, illustration) parses into the clause structure; (d) amendment marginal notes map to amendedBy entries; (e) total article count in the extracted JSON is between 440 and 480 (sanity band); (f) every article references an existing part; (g) reconciliation report flags any article whose text differs by more than 20 percent from the MIT Yash Handa 2019 JSON (structural cross check, staleness expected on late amendments, threshold tuned after inspection).
│  └─ Expected: fail, no pipeline exists.
├─ Implementation:
│  ├─ Scope: Node script under `scripts/extract/` using pdf parsing (start with `pdfjs-dist` text extraction, fall back to `pdftotext` if layout demands it), a normalizer that walks the raw text into schema shaped JSON, and a report generator. Output to `data/processed/`. Not part of the site build, run manually.
│  └─ Constraints: the script never writes directly to content collections, it writes to `data/processed/` which a separate sync step imports. Every transformation must be deterministic (same PDF in, same JSON out) so it is testable. No network calls, the PDF is vendored.
├─ Acceptance Criteria:
│  ├─ Tests pass: extraction tests green on the sample, sanity counts within bands.
│  ├─ No regressions: schemas untouched.
│  └─ Code quality: extraction, normalization, and reporting are separate modules.
├─ Verification: human spot checks 10 sampled articles (the preamble, Articles 1, 14, 19, 21, 32, 51A, 368, one schedule, one omitted article) against the official PDF. This manual gate is mandatory before Step 4.
└─ Stop/Go: STOP for human review. This is the highest risk step in the plan (weeks not days per the ANALYSIS risk register). Up to 3 iterations on accuracy issues, then escalate.

---

## Step 4: Sync processed data into content collections

├─ Objective: a tested sync script that copies validated `data/processed/` JSON into Astro content collections and fails loudly on any schema violation.
├─ Prerequisites: Step 3 accepted.
├─ Test First:
│  ├─ Test type: integration
│  ├─ Test cases: (a) syncing a fixture dataset creates the expected collection entries; (b) syncing data with one invalid entry aborts and names the offending file and field; (c) re syncing is idempotent (no duplicate entries); (d) the build fails if an article references a missing part.
│  └─ Expected: fail, no sync script.
├─ Implementation:
│  ├─ Scope: `scripts/sync-collections.mjs`, npm script `data:sync`, wired so `astro build` depends on it.
│  └─ Constraints: no silent skips. Every anomaly is a hard error with a file path and reason.
├─ Acceptance Criteria:
│  ├─ Tests pass: sync tests green.
│  ├─ No regressions: full build green on real data.
│  └─ Code quality: sync script under 200 lines, single responsibility.
├─ Verification: `npm run data:sync && npm run build` succeeds with real extracted data.
└─ Stop/Go: proceed to Step 5.

---

## Step 5: Design tokens and base layout

├─ Objective: implement the design system foundations: CSS custom properties, type scale, base layout, header, footer, tricolor rule, chakra SVG.
├─ Prerequisites: Step 1 (design system doc is the spec).
├─ Test First:
│  ├─ Test type: unit plus e2e
│  ├─ Test cases: (a) contrast test helper asserts the token pairs from DESIGN-SYSTEM.md section 3 meet their stated ratios (parse the CSS file, compute ratios in the test); (b) e2e: header renders wordmark, nav, and search trigger on every breakpoint; (c) e2e: skip link is the first focusable element; (d) e2e: fonts load with swap and no layout shift over 0.1 CLS on a cold load.
│  └─ Expected: fail, no layout exists.
├─ Implementation:
│  ├─ Scope: `src/styles/tokens.css`, `BaseLayout.astro`, `Header.astro`, `Footer.astro`, chakra SVG component, self hosted subset fonts under `public/fonts/`.
│  └─ Constraints: zero JavaScript in the base layout. Fonts subset with `pyftsubset` or `glyphhanger` at build, not committed raw.
├─ Acceptance Criteria:
│  ├─ Tests pass: contrast, header, skip link, CLS tests green.
│  ├─ No regressions: none possible yet beyond Step 1 tests.
│  └─ Code quality: tokens defined exactly once, no hex literals outside tokens.css.
├─ Verification: Lighthouse on the placeholder home page meets the performance and accessibility budgets from DESIGN-SYSTEM.md section 12.
└─ Stop/Go: proceed to Step 6.

---

## Step 6: Core pages (home, preamble, parts, articles, schedules)

├─ Objective: all primary reading surfaces as static pages: home hero with the Preamble, dedicated Preamble page, parts index and detail, article pages with clauses and badges, schedules.
├─ Prerequisites: Steps 4 and 5.
├─ Test First:
│  ├─ Test type: integration plus e2e
│  ├─ Test cases: (a) a build generates one HTML file per article in the collection (count assertion); (b) every article page contains the full article text in the static HTML (no client-side rendering), asserted by fetching the built file and searching for a known clause string; (c) e2e: navigate home to parts to a part to an article in three clicks; (d) e2e: prev and next article links work at part boundaries; (e) omitted articles show the red omitted badge and the year; (f) breadcrumbs render on article pages.
│  └─ Expected: fail, no pages exist.
├─ Implementation:
│  ├─ Scope: `src/pages/index.astro`, `preamble.astro`, `parts/[part].astro`, `articles/[article].astro`, `schedules/[schedule].astro` plus indexes, and the Article, Badge, Breadcrumb components.
│  └─ Constraints: every page is fully static. The 8 plus 4 column article layout with sticky part nav per the design system. Status badges use the semantic token set only.
├─ Acceptance Criteria:
│  ├─ Tests pass: generation count, static content, and navigation tests green.
│  ├─ No regressions: Steps 1 to 5 suites green.
│  └─ Code quality: one article component used by every article page, no page level special casing.
├─ Verification: manual read through of 10 articles on a phone sized viewport.
└─ Stop/Go: proceed to Step 7.

---

## Step 7: Amendments timeline and detail pages

├─ Objective: the interactive timeline (SVG, static markup) and one page per amendment with articles touched, dates, and status.
├─ Prerequisites: Steps 4 and 6.
├─ Test First:
│  ├─ Test type: integration plus e2e
│  ├ Test cases: (a) amendment fixture of all 106 entries renders 106 nodes in the static HTML; (b) each node is an anchor link to its amendment page (not a JS-only widget); (c) e2e: keyboard tab through the timeline visits every node in order; (d) the 42nd Amendment page lists its touched articles and links back to each; (e) timeline renders correctly with `prefers-reduced-motion` (no animation classes applied).
│  └─ Expected: fail, no timeline.
├─ Implementation:
│  ├─ Scope: `src/data/amendments/*.json` (facts hand derived from the Wikipedia list, original one line summaries, attribution on the sources page), `Timeline.astro`, `amendments/[amendment].astro`.
│  └─ Constraints: SVG generated at build time by a pure function (unit testable), one node per amendment, theme color coding by the four themes in the design system. Facts carry a verified date field.
├─ Acceptance Criteria:
│  ├─ Tests pass: node count, link, keyboard, and reduced motion tests green.
│  ├─ No regressions: full suite green.
│  └─ Code quality: timeline geometry function is pure and separately tested.
├─ Verification: visual review against the design system timeline spec on mobile and desktop.
└─ Stop/Go: proceed to Step 8.

---

## Step 8: Upcoming changes page with snapshot process

├─ Objective: the /changes/upcoming page backed by a hand maintained JSON snapshot of pending Constitution amendment bills, plus a documented monthly update ritual.
├─ Prerequisites: Step 6.
├─ Test First:
│  ├─ Test type: integration plus e2e
│  ├─ Test cases: (a) bills with each status (pending, passed one house, rejected, lapsed) render the correct pill and color; (b) every bill row shows a lastVerified date; (c) a snapshot with any bill missing lastVerified fails the build; (d) e2e: table is linearizable (screen reader order equals visual order); (e) the "verified" banner text includes the most recent snapshot date.
│  └─ Expected: fail, no page.
├─ Implementation:
│  ├─ Scope: `src/data/bills/snapshot.json` (current known state seeded: the 131st Amendment Bill 2026 defeated in Lok Sabha 17 April 2026, plus any others verified at build time), `changes/upcoming.astro`, table component, and the update ritual documented in CONTRIBUTING.md.
│  └─ Constraints: paraphrased summaries only, PRS and sansad.in linked as sources, no copied analysis text. No runtime scraping, ever.
├─ Acceptance Criteria:
│  ├─ Tests pass: status pill, date presence, build failure, and order tests green.
│  ├─ No regressions: full suite green.
│  └─ Code quality: snapshot file shape validated by the Step 2 schemas.
├─ Verification: human reviews the seeded bill data against the cited sources.
└─ Stop/Go: proceed to Step 9.

---

## Step 9: Keyword search with Pagefind

├─ Objective: production keyword search over all built pages, in the full screen dialog per the design system.
├─ Prerequisites: Step 6.
├─ Test First:
│  ├─ Test type: e2e
│  ├─ Test cases: (a) searching "equality" returns Article 14 in the top three results; (b) searching "14" surfaces the Article 14 page; (c) results group by type (Articles, Amendments, Pages); (d) the `/` keyboard shortcut opens and Escape closes the dialog with focus restored to the trigger; (e) a zero result query shows suggestions, not a dead end; (f) search works with JavaScript enabled only after full page render but article reading never depends on it.
│  └─ Expected: fail, no search.
├─ Implementation:
│  ├─ Scope: Pagefind as a post build step (`pagefind --site dist`), a thin dialog UI, result grouping by Pagefind filters, term highlighting.
│  └─ Constraints: Pagefind UI loads lazily on first open. The dialog implements the focus trap and ARIA pattern from the design system accessibility checklist.
├─ Acceptance Criteria:
│  ├─ Tests pass: all six e2e cases green.
│  ├─ No regressions: full suite plus budget check (article pages with no search open stay under 10 KB JS).
│  └─ Code quality: dialog is one component with no framework dependency.
├─ Verification: manual search session covering five real questions a student would ask.
└─ Stop/Go: proceed to Step 10.

---

## Step 10: Plain words explainers

├─ Objective: a "What it means" box on every article page, AI drafted, stored as data, human reviewed before publish.
├─ Prerequisites: Step 6.
├─ Test First:
│  ├─ Test type: unit plus e2e
│  ├─ Test cases: (a) every article with `explained: true` renders the box, those without render nothing and a build warning lists them; (b) explainer length is 40 to 140 words (unit test on the data); (c) explainers pass the house style linter: no banned phrases (delve, moreover, furthermore, it is important to note, in conclusion), no em dash characters (unit test, enforces the project constraint mechanically); (d) e2e: box renders after the article text with the correct heading.
│  └─ Expected: fail, no explainers exist.
├─ Implementation:
│  ├─ Scope: `data/processed/explainers/` merged during sync, drafting workflow (AI assisted, per batch) documented in CONTRIBUTING.md, box component.
│  └─ Constraints: explainers are labeled as summaries, never as legal text. Reading level checked with a readability formula in the unit test (target grade 8 to 10).
├─ Acceptance Criteria:
│  ├─ Tests pass: presence, length, style, and render tests green.
│  ├─ No regressions: full suite green.
│  └─ Code quality: style linter shared with site copy linting.
├─ Verification: human reads 20 sampled explainers against their articles for accuracy.
└─ Stop/Go: proceed to Step 11. Content accuracy is a human gate.

---

## Step 11: Semantic search (opt in concept search)

├─ Objective: the hybrid keyword plus vector "Concept search" tab: build time precomputed embeddings shipped as quantized vectors, query embedded in a Web Worker, Orama hybrid retrieval, honest loading states, automatic fallback to keyword.
├─ Prerequisites: Step 9 (fallback target exists).
├─ Test First:
│  ├─ Test type: unit plus e2e
│  ├─ Test cases: (a) chunker splits articles at 120 to 180 word boundaries respecting clause breaks (unit); (b) build script emits a vector file whose size is under the 3 MB budget for the chosen quantization (unit on the artifact); (c) e2e: opening the Concept tab lazily fetches assets and shows byte progress; (d) e2e: query "can the state discriminate against women" returns Articles 14, 15, and or 16 in the top five without containing those exact words (semantic quality gate, threshold: 2 of 3 present); (e) e2e: with the model fetch blocked (simulated offline), search silently falls back to keyword mode and shows a notice; (f) `navigator.connection.saveData` or reduced memory preference never loads the model.
│  └─ Expected: fail, no semantic layer.
├─ Implementation:
│  ├─ Scope: `scripts/embed/` build step (transformers.js in Node, model all MiniLM L6 v2 quantized or smaller, int8 or 1 bit quantized vectors to `public/vectors/`), a Web Worker embedding only the query, Orama hybrid search wiring, fallback logic.
│  └─ Constraints: nothing in this step may affect page load for users who never open Concept search. Model and vectors live behind the opt in tab only. All processing client side, zero API calls, zero keys.
├─ Acceptance Criteria:
│  ├─ Tests pass: chunker, artifact budget, lazy load, quality gate, fallback, and saveData tests green.
│  ├─ No regressions: performance budgets still met on article pages.
│  └─ Code quality: worker code isolated, main thread does no embedding work.
├─ Verification: run the quality gate query set (10 questions from the Step 9 manual session) and record the hit rate. If below 60 percent of queries returning a relevant top three, trigger the Phase 3 decision point from ANALYSIS section 5 (consider Workers AI upgrade) and pause for human input.
└─ Stop/Go: conditional stop on quality gate results.

---

## Step 12: SEO and GEO layer

├─ Objective: titles, descriptions, JSON LD, sitemap, robots, llms.txt, and the 40 to 60 word answer ledes on every article page.
├─ Prerequisites: Steps 6, 7, 8.
├─ Test First:
│  ├─ Test type: integration
│  ├─ Test cases: (a) every built page has a unique title matching the design system pattern and a description under 160 characters; (b) every article page embeds valid JSON LD (parse and validate Legislation schema fields in the test); (c) sitemap lists every page and validates against the sitemap schema; (d) robots.txt allows all crawlers and references the sitemap; (e) llms.txt exists, is valid markdown, and links every top level section; (f) the first paragraph of every article page is 40 to 60 words (lede rule, unit test on data plus render check).
│  └─ Expected: fail, no SEO layer.
├─ Implementation:
│  ├─ Scope: SEO component, per collection frontmatter or computed metadata, `@astrojs/sitemap`, hand maintained llms.txt template, answer ledes authored during Step 10 content work.
│  └─ Constraints: JSON LD generated from the same schemas as everything else, single source of truth. No SEO plugin beyond the sitemap.
├─ Acceptance Criteria:
│  ├─ Tests pass: all six cases green.
│  ├─ No regressions: full suite green.
│  └─ Code quality: metadata logic in one component, tested once.
├─ Verification: Rich Results Test and Schema Markup Validator on five representative pages, plus a manual llms.txt read.
└─ Stop/Go: proceed to Step 13.

---

## Step 13: Accessibility and performance audit

├─ Objective: prove the budgets: axe clean on all templates, Lighthouse 95 plus mobile on the reading path, full keyboard pass.
├─ Prerequisites: Steps 5 to 12.
├─ Test First:
│  ├─ Test type: e2e (axe plus Lighthouse CI)
│  ├─ Test cases: (a) axe reports zero critical or serious violations on home, preamble, part, article, amendment, timeline, bills, and search pages; (b) Lighthouse CI mobile assertions (performance 95, accessibility 100, best practices 100, SEO 100) on five pages; (c) keyboard only walk of the full site reaches every interactive element; (d) one screen reader spot check documented.
│  └─ Expected: fail wherever violations exist, which is expected on first run.
├─ Implementation:
│  ├─ Scope: wire `@axe-core/playwright` into the Playwright suite, add Lighthouse CI config with the budget assertions, fix what the audits find.
│  └─ Constraints: fixes happen in components and tokens, never per page overrides.
├─ Acceptance Criteria:
│  ├─ Tests pass: axe and Lighthouse suites green.
│  ├─ No regressions: everything green in one CI run.
│  └─ Code quality: audit config committed so it reruns on every push.
├─ Verification: CI green on the audit commit.
└─ Stop/Go: proceed to Step 14.

---

## Step 14: Deploy to Cloudflare Pages and update ritual

├─ Objective: production deployment on the Cloudflare Pages free tier with CI on every push, plus the documented monthly update ritual that keeps the site honest.
├─ Prerequisites: Step 13.
├─ Test First:
│  ├─ Test type: e2e against the deployed URL
│  ├─ Test cases: (a) deployed home page returns 200 and matches the built HTML hash for the body content; (b) deployed sitemap, robots.txt, and llms.txt are reachable; (c) a smoke query through the deployed keyword search returns Article 14 for "equality"; (d) an update ritual dry run: bumping the snapshot data and pushing produces a deployed change within the Pages build window.
│  └─ Expected: fail, nothing is deployed.
├─ Implementation:
│  ├─ Scope: connect the GitHub repo to Cloudflare Pages (build command `npm run build`, output `dist`), deploy, then document the monthly ritual in CONTRIBUTING.md (check legislative.gov.in for a new amendment, check sansad.in and PRS for bill movement, update snapshots, bump verified dates, push).
│  └─ Constraints: no Cloudflare Workers, no bindings, no compute. Static assets only, so the billing surface stays at zero. The bundle remains portable to GitHub Pages unchanged.
├─ Acceptance Criteria:
│  ├─ Tests pass: deployed smoke tests green.
│  ├─ No regressions: full CI green including audits.
│  └─ Code quality: deployment is push based, no manual console steps beyond the initial connect.
├─ Verification: the ritual dry run demonstrates one real data update end to end.
└─ Stop/Go: project complete. Phase 3 (server side embeddings) opens only if the Step 11 quality gate flagged it.

---

## Divergence Handling

Stop and reassess when: any previously green test fails after a later step, extraction accuracy stalls after 3 iterations, the semantic quality gate misses its threshold, or a free tier limit changes materially. In each case: finish the current step only if it is safe to leave the tree green, write the divergence reason into this document's change log, and ask the human whether to re plan from the current position or address the blocker first. Do not silently absorb scope changes.

## Regression Protection Summary

- Full suite (`npm test`, `npm run build`, Playwright smoke) runs after every step and on every push via CI.
- The Step 3 sanity bands (article counts, structure checks) act as data regression tests for future PDF updates.
- The Step 5 contrast test and Step 13 audits act as design system regression tests: a token change that breaks AA contrast fails the build.
- Performance budgets are executable assertions (Lighthouse CI), not aspirations.

## Change Log

- 2026-09-01, Step 9 executed. Notes: (a) The dialog controller is a plain browser script at public/search.js (7 KB, cacheable, defer loaded on every page) rather than inline markup; inlining it pushed the articles index past the 60 KB page budget, and the integration test now asserts exactly one shared external script under 7 KB. Pagefind and its index load only when the dialog opens, verified by an e2e that fails if any /pagefind/ request fires during reading. (b) Pagefind AND-matches every word, so natural questions like "how is the constitution amended" returned nothing; the controller now retries once with stopwords stripped, which surfaces Article 368 at result two for that query. (c) The searchType filter prop initially missed three single-line BaseLayout tags (caught by the grouping e2e). (d) Search result titles exposed stray footnote markers inside article titles (Article 368 read "1[Power of Parliament..."); the parser's cleanTitle now strips all editorial brackets and marker digits from titles, seven titles repaired, data regenerated, count stable at 471. (e) Grouping e2e uses "nari shakti" rather than "women reservation", whose top twelve hits are legitimately all reservation articles. Verification: all six plan e2e cases green, five real student queries return the right pages (21A, 19, 368, 330A family, language articles), Lighthouse on an article page stays 100 performance and 100 accessibility with TBT 0 ms.

- 2026-08-31, Step 8 executed. Data notes: the snapshot is seeded with two bills verified today against PRS India. The 130th Amendment Bill, 2025 (automatic removal of arrested ministers) is pending before a joint parliamentary committee that has deferred its report and proposed modifications including reinstatement. The 131st Amendment Bill, 2026 (delimitation package to operationalise the women's reservation, raising the Lok Sabha maximum to 850) was introduced in Lok Sabha on 16 April 2026 and negatived on 17 April 2026 with 298 votes; the companion bills were withdrawn. Summaries are written for this site from the linked sources, never copied. Validation lives in src/lib/bills.ts: any entry missing lastVerified or carrying an unknown status fails the build naming the bill and the field. The page carries the verification banner with the latest date, sansad.in and PRS links, semantic table markup with linearizable cell order verified by e2e, and status pills on the token palette. The monthly update ritual was already documented in CONTRIBUTING.md and matches this implementation. Human gate: seeded bill data presented for review before Step 9.

- 2026-08-31, Step 7 executed. Data sourcing notes: (a) Amendment years come from the official PDF's own footnote citations wherever a citation survives in the consolidated text (97 of 106). The other nine (2, 8, 12, 37, 47, 48, 66, 76, 78) have no surviving citation because later amendments superseded their footnotes; their years are filled from the vendored Wikipedia list (data/reference/wikipedia-amendments.wiki, CC BY-SA, facts only), whose date column is "Enforced since", with one hand verified override: the Second Amendment Act carries the short title year 1952 though enforced on 1 May 1953. (b) Articles touched are reverse mapped from our own conservative amendedBy attribution; 19 amendments legitimately track zero articles (schedule-only changes, or superseded footnotes), and the pages say so plainly. One adjacency artifact is known: Article 239 picks up a spurious 106th attribution from a marker collision, covered by the conservative-attribution note on every amendment page. (c) Summaries are hand written for 21 landmark amendments and generated strictly from tracked counts for the rest, never invented. (d) Theme classification is rule based (numeric ranges of affected articles) plus landmark overrides. Results: 106 amendment pages, timeline SVG with 106 anchor nodes and 212 total links, keyboard traversal e2e across all nodes, 42nd page linking to its articles, 106th page carrying the verified milestone dates, chips on article pages now linking into amendments. 101 unit/integration plus 15 e2e tests green; Lighthouse 100/100 on the amendments index.

- 2026-08-31, Step 6 executed. Notes: (a) Astro hoists getStaticPaths at build, and it cannot reference frontmatter variables, so the document-order comparator lives in src/lib/display.ts and is imported. (b) The /articles index is a compact number directory: listing all 471 titles weighed 141 KB against the 60 KB budget, so titles live on the part pages (26 pages, all within budget) and article numbers stand alone as link text, matching how articles are cited. (c) Editorial brackets are stripped at display time by cleanLegalText; the data layer keeps them as provenance. (d) Marker-free assertions run against body markup only, because Astro scoped CSS selectors such as h1[data-astro...] contain the literal string that marker checks look for. (e) Verification: 471 article pages, 26 part pages, 12 schedule pages, preamble, and three indexes built statically; three-click journey, part-boundary prev/next, omitted badge with year, breadcrumbs, and phone-viewport overflow checks all pass in e2e; Lighthouse on the heaviest article page and the articles index scores 100 across categories.

- 2026-08-31, Step 5 executed. Substitutions and findings: (a) Fonts are self hosted via @fontsource static latin subsets (Fraunces 600, Public Sans 400 and 700) instead of a pyftsubset build step; same goal met (three woff2 files, swap, zero external requests) and enforced by an e2e test that fails on any off site font request. (b) The design system's saffron claim was wrong by measurement: flag-spec #FF671F is 2.82:1 on paper, below the required 3:1 for meaningful graphics. Token darkened to #F25C0A (3.22:1); docs/DESIGN-SYSTEM.md updated and the contrast regression test now enforces every documented pair. (c) An SVG chakra favicon was added after Lighthouse flagged the 404; best-practices moved 96 to 100. (d) Chromium exposes a closed details summary as a group rather than a button, so the mobile menu test targets the native summary control; the menu itself stays JavaScript free via details/summary. (e) Playwright chromium added to CI with npm run e2e after the build step. Lighthouse on the placeholder home page: performance 100, accessibility 100, best practices 100, seo 100, CLS 0, TBT 0.

- 2026-08-31, Step 4 executed. Substitutions, minor: (a) The sync script is TypeScript (`scripts/sync-collections.ts`) run directly by Node, matching the extraction scripts, rather than `.mjs` as sketched. (b) Schema evolution driven by failing tests: PartSchema.number changed from numeric to a string label ("3", "4A") to match article part references, and ArticleSchema gained `section` plus ScheduleSchema gained `text`, both needed by the site pages. (c) Collection entries are generated into `src/content/` at build time (`npm run build` chains `data:sync`) and gitignored, since they derive from the committed `data/processed/constitution.json`; CI and any fresh clone regenerate them deterministically. Sync aborts loudly naming entry and field on any schema violation, duplicate id, or dangling part reference, and regenerates directories from scratch so stale entries cannot linger.

- 2026-08-31, Step 3 executed. Notes and substitutions: (a) The Yash Handa 2019 cross check dataset turned out to ship Part III text only (about 43 entries, 47 KB), not the full constitution, so the cross check asserts number-set parity where the dataset has coverage and text similarity on the common Part III articles. Divergence on 2A, 31, and 31D is expected staleness: the 2019 text predates their omissions. (b) The PDF text layer loses several headings to artwork: SECOND SCHEDULE, PART VII (legitimately omitted, synthesized), PART VIII, PART IVA, and PART XIVA headings are recovered through documented anchors (SCHEDULE_OVERRIDES, PART_NAME_ANCHORS, SYNTHETIC_PARTS). (c) Footnote classification needed a citation-signal heuristic (ibid, w.e.f, vide, ins., subs., omit, years, and similar) plus the rule that article headings with body text after the title dash always beat footnote classification. (d) Marker digits fuse onto article numbers ("132A." for marker 1 on article 32A); document sequence disambiguates. (e) Schema evolution: article part references now allow a letter suffix (4A, 9A, 9B, 14A), driven by a failing test against real data. (f) Extraction result: 471 articles, 26 parts, 12 schedules, 29 omitted, zero validator errors, 43 tests green. Spot check document at docs/SPOTCHECK.md. Human gate open.

- 2026-08-31, Step 2 executed. Deviation, minor: Astro content collection wiring (`src/content.config.ts`, the Astro 7 filename; the plan cited the older `src/content/config.ts` path) is deferred to Step 4, when real data exists to load. Step 2 delivered the shared Zod schema module (`src/lib/schemas/index.ts`) with nine passing tests against fixtures, including the amendment milestone date fields and the bill lastVerified requirement. Status enums finalized: articles use in force, amended, omitted, repealed; bills use pending, passed one house, rejected, lapsed.

- 2026-08-31, Step 1 executed. Substitutions, none material: (a) workflow validation used a YAML parse plus structural assertions in Vitest instead of actionlint, which is not installed locally; the workflow's first real run happens when a GitHub remote is connected. (b) Astro resolved to 7.2.9 rather than the 6.x cited by research; docs updated, no plan impact. (c) Lint toolchain is ESLint 10 with eslint-plugin-astro 3.1.0, which peer requires eslint 10 or newer. Initial config load failures were caused by importing astro-eslint-parser via a nonexistent default export and by spreading the plugin's legacy preset; fixed with a module namespace import for the parser and explicit flat config wiring. (d) prettier-plugin-astro 0.14.1 misformats templates mixing adjacent text and expressions (`{A}: {B}`), so the page title is computed in frontmatter; template authors must avoid that pattern or format will fight the source.
