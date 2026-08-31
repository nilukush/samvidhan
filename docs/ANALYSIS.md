# High Level Analysis: Constitution of India Website

Date: 31 August 2026
Status: Complete, pending human approval
Method: online research plus a three agent consensus review (Analyzer, Debugger, Verifier) with independent verification of all load bearing claims.

## 1. Business Problem

The Constitution of India is authoritative but hard to consume. The official text lives in dense PDFs on legislative.gov.in, amendment history is scattered across Wikipedia tables, and pending amendment bills require manually tracking Parliament. Citizens, students, and journalists need one beautiful, searchable site that shows what the Constitution says now, how it changed, and what may change next. The site must run at zero monetary cost.

Success criteria:

- A visitor with no legal background can find and understand any article in under a minute.
- Search works in plain English, both exact (article numbers, phrases) and conceptual (semantic).
- Every past amendment is browsable as a timeline with per amendment detail.
- Pending Constitution amendment bills are listed with status and a visible last verified date.
- The site ranks well on search engines and is citable by AI assistants (SEO and GEO).
- Monthly hosting and update cost: zero.

Note on scope: the request objective line mentions "expat salaries" while every other section (workspace name, sources, questions, task) specifies the Constitution of India. This analysis proceeds on the Constitution of India. Flag raised for the record.

## 2. Codebase Investigation

The workspace is empty. No git repository, no files, no prior commits. This is a greenfield build with no existing patterns, dependencies, or integration points to preserve. All conventions are set here.

Prior art survey (Verifier):

| Site | Strengths | Gaps we can fill |
| --- | --- | --- |
| constitutionofindia.net (CLPR Trust) | Most polished civic resource: 395 articles, Assembly Debates, member biographies, archive search | No consolidated current text per article, no version or diff views, dated reading UI |
| legislative.gov.in | Authoritative: updated PDFs (English, Hindi, diglot), all 106 amendment acts | PDF first, no browsing, no search, no linking between articles and amendments |
| indiacode.nic.in | Consolidated acts with amendments applied, section level search, even RSS feeds | Dated UI, clunky article navigation, scan quality PDFs |

No existing site combines current consolidated text, plain language explainers, amendment history, pending bill tracking, and semantic search. The niche is open.

## 3. Data Layer

| Need | Source | License status | Freshness risk |
| --- | --- | --- | --- |
| Constitution text | Official Legislative Department PDF (updated to the 106th Amendment, English edition current as of 2024) at legislative.gov.in/constitution-of-india, mirrored on indiacode.nic.in | Statutes are public domain in India (EBC v. D.B. Modak, 2008; Copyright Act s.52(1)(q)) | Medium. Amendments are rare (1 to 2 per year). Manual quarterly check |
| Structure cross check | Yash-Handa/The_Constitution_Of_India (MIT) | MIT, but data is from 2019 | Reference only, never published as is |
| Amendment history facts | Wikipedia: List of amendments of the Constitution of India | CC BY-SA 4.0. Extract facts, write original summaries, attribute. Never copy prose | Low. 106 amendments as of March 2026, stable |
| Pending bills | sansad.in bill portals (official), prsindia.org/billtrack (analysis) | Facts are not copyrightable. Paraphrase PRS analysis and attribute, never copy | High. No RSS or API. Manual monthly snapshot |

Rejected as data sources: captn3m0/constitution (no LICENSE file, last push 2020) and civictech-India/constitution-of-india (no LICENSE file, last push 2021). Both predate the 105th and 106th Amendments and carry default all rights reserved status. TheDebugger agent flagged this as the top licensing risk. The Analyzer agent's milder position (use MIT Yash Handa JSON for structure) is accepted in reduced form: structural cross check only.

Current status as verified 31 August 2026, with the 106th Amendment's full legislative milestone set (source: Wikipedia, One Hundred and Sixth Amendment of the Constitution of India):

- 19 September 2023: bill introduced in Lok Sabha during the special session
- 20 September 2023: Lok Sabha passed it, 454 to 2
- 21 September 2023: Rajya Sabha passed it unanimously, 214 to 0
- 28 September 2023: presidential assent and gazette publication (enactment)
- 16 April 2026: Ministry of Law and Justice gazette notification brought the Act into force
- The 33 percent reservation itself remains inoperative pending the first census after commencement plus a delimitation exercise (new Article 334A)

The 106th remains the latest enacted amendment. The Constitution (131st Amendment) Bill, 2026, an attempt to expedite implementation, was defeated in Lok Sabha on 17 April 2026 (298 to 230, short of the special majority). Distinct dates for introduction, passage, assent, and commencement are exactly the kind of precision the amendment data model and pages must capture (see the schema constraint added to Step 2 of the implementation plan).

## 4. Technical Approach Evaluation

All options scored 1 to 10 on the five criteria that matter for this project (higher is better). Scores synthesized from the three agents.

| Option | Cost safety | SEO | Search quality | Buildability | Maintainability | Average |
| --- | --- | --- | --- | --- | --- | --- |
| A. Astro static + client side hybrid search (Orama) | 10 | 9 | 7 | 8 | 9 | 8.6 |
| B. Astro static + Cloudflare Workers AI + Vectorize | 7 | 9 | 8 | 6 | 6 | 7.2 |
| C. Next.js on Vercel with serverless RAG | 6 | 7 | 8 | 7 | 5 | 6.6 |
| D. Hugo + Pagefind (keyword only) | 10 | 9 | 4 | 9 | 9 | 8.2 but fails a required capability |

Option A details. Astro (MIT, actively maintained, version 7 at build time, team now funded by Cloudflare since January 2026 while the framework stays open and platform agnostic) generates pure static HTML, which is the strongest possible position for SEO, GEO, Core Web Vitals, and zero cost hosting. Search runs entirely in the browser: Pagefind (MIT) for keyword search over built HTML, and Orama (Apache 2.0) for hybrid keyword plus vector search. The vector strategy is the one the Debugger forced, overriding the Analyzer's initial runtime idea: precompute all chunk embeddings at build time, ship quantized vectors (int8 base64 about 2.6 MB, or 1 bit about 240 KB at roughly 95 percent quality retention), and embed only the user's query string in a Web Worker using transformers.js (Apache 2.0). This avoids a 23 MB model download dominating mobile first load.

Option B is held as a Phase 3 upgrade path only if in browser semantic quality disappoints. Verified free limits if ever used: Workers AI 10,000 neurons per day, Vectorize 5 million stored and 30 million queried vector dimensions per month. A 5,000 chunk corpus at 384 dimensions is 1.92 million stored dimensions, which fits, but any traffic spike against a Workers endpoint creates a billing surface. The consensus is to keep the request path purely static.

Option C is rejected: Vercel Hobby is non commercial, serverless RAG adds a second deploy surface, and Next.js ships 50x more JavaScript for no SEO benefit on a content site.

Option D is rejected because semantic search is a stated requirement, though Pagefind from this option is adopted into Option A as the keyword layer.

## 5. Recommended Approach

Option A, phased. Every phase ships at zero cost and is independently useful:

- Phase 1 (foundation): Astro static site, official PDF extracted to structured JSON, all article, part, schedule, and amendment pages as static HTML, Pagefind keyword search, amendment timeline, SEO basics.
- Phase 2 (intelligence): build time precomputed embeddings plus Orama hybrid search with semantic as an opt in tab, plain language explainers, pending bills tracker.
- Phase 3 (optional, conditional): move embedding generation server side to Workers AI + Vectorize only if measured retrieval quality in Phase 2 falls short.

## 6. Information Architecture

- / : hero with the Preamble, tricolor and Ashoka Chakra motifs, entry cards
- /preamble : dedicated high traffic page
- /parts and /parts/[part] : 25 parts
- /articles and /articles/[article-14] : about 470 pages, the long tail SEO core. Each shows current text, amendment badges, and a plain words box
- /schedules and /schedules/[schedule] : 12 schedules
- /amendments and /amendments/[106th-amendment] : interactive timeline plus detail pages
- /changes/upcoming : pending Constitution amendment bills with status and last verified date
- /search, /about, /sources : utility pages with full attribution
- /sitemap.xml, /robots.txt, /llms.txt : crawler surfaces

## 7. Feasibility Verdicts on the User's Questions

| # | Question | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | Beautiful, user friendly, graphical site from these sources | Yes | Static Astro with a heritage derived design system (see docs/DESIGN-SYSTEM.md). No cost impact |
| 2 | Extremely easy for ordinary people to understand | Yes, with editorial work | Plain words explainer boxes per article, written by AI, reviewed by human. This is content effort, not technical risk |
| 3 | Searchable | Yes | Pagefind keyword search over built HTML, zero runtime cost |
| 4 | RAG based semantic search | Yes, with quality caveat | Orama hybrid search with build time precomputed embeddings, query embedded in browser. Expect good not great retrieval from small local models. Phase 3 server upgrade path exists |
| 5 | Track upcoming and future changes | Partial | No free API or feed exists. Manual monthly snapshot from sansad.in and PRS, with visible last verified dates. Fully honest and free, not real time |
| 6 | Show historical changes | Yes | 106 discrete amendment events, low churn, rendered as an SVG timeline plus per amendment pages |
| 7 | SEO and GEO friendly | Yes | All article text in static HTML, per article metadata, JSON LD (schema.org Legislation), sitemap, robots, llms.txt, 40 to 60 word answer blocks near headings |

## 8. Risks and Mitigations

1. PDF extraction is the real engineering cost. The official PDF is a 400 plus page typeset document with footnotes and marginal amendment notes. Mitigation: dedicated extraction pipeline step with per article validation tests against a sampled checklist. Budget weeks, not days.
2. Data licensing. Mitigation: canonical text re derived from the public domain official PDF, never from unlicensed community repos. Wikipedia facts paraphrased and attributed under CC BY-SA 4.0 norms.
3. legislative.gov.in blocks automated fetches (403 to bots). Mitigation: manual PDF download vendored into the repo at each update, no runtime dependency on government servers.
4. Bills staleness could mislead users. Mitigation: prominent last verified dates on every bill row, links out to sansad.in for live status, a monthly refresh ritual documented in CONTRIBUTING.md.
5. Mobile performance with vector search. Mitigation: keyword first default, semantic model and vectors lazy loaded on explicit user action, Web Worker isolation, automatic fallback to keyword on failure or data saver signals.
6. Free tier drift (Cloudflare limits change). Mitigation: the site is a plain static bundle deployable to Cloudflare Pages, GitHub Pages, or Netlify without code changes.
7. Scheduled GitHub Actions auto disable after 60 days of repo inactivity. Mitigation: keepalive workflow, or the monthly manual update ritual which itself counts as activity.

## 9. Agent Consensus Record

The three agents ran independently against the same brief. Agreements: stack (Astro static on Cloudflare Pages), canonical source (official PDF, statutes are public domain), latest amendment (106th), bills tracking reality (no feed, manual snapshots), software licenses (all clear: Astro MIT, Orama Apache 2.0, transformers.js Apache 2.0, Pagefind MIT).

Divergences and resolutions:

- Runtime browser embeddings (Analyzer) versus build time precomputed embeddings (Debugger). Resolution: build time precomputed. Evidence: 23 MB quantized model download, 256 token MiniLM sequence limit against 1,000 word articles, low end Android memory pressure. Verifier independently confirmed the Orama "2 kb" claim covers only the engine, not models. Unanimous after evidence.
- Use community JSON datasets (Analyzer, partially) versus drop them (Debugger). Resolution: official PDF canonical for all published text, MIT licensed Yash Handa JSON allowed as a structural cross check only. Consensus.
- Server side Vectorize (Analyzer Phase 3 option) versus keep static only (Debugger). Resolution: static only in Phases 1 and 2, Vectorize remains a conditional Phase 3 with explicit dimension budget math. Consensus.

The recommended approach scored 8.6 of 10 averaged across agents and criteria, above the 7.5 threshold set for adoption in this session's protocol.

## 10. Open Questions for the User

These are the only decisions that genuinely need a human answer. Everything else (UI, UX, architecture, tech stack, product name) was decided per instructions.

1. Domain: a free pages.dev subdomain is fine, or does a custom domain matter? A domain is the only unavoidable cash cost, about 10 dollars a year.
2. Plain words explainers: AI drafted per article, human reviewed before publish? Recommended yes.
3. Bills scope: only Constitution amendment bills (a handful, tractable) or all pending bills (3,500 plus, not recommended)?
4. Hindi or diglot support: not in Phases 1 and 2 under this plan. Confirm English first.
5. Update cadence you can personally sustain for the bills page: monthly is recommended.

## Sources

- Legislative Department Constitution of India page and PDFs: https://legislative.gov.in/constitution-of-india/
- Wikipedia, Constitution of India: https://en.wikipedia.org/wiki/Constitution_of_India
- Wikipedia, List of amendments: https://en.wikipedia.org/wiki/List_of_amendments_of_the_Constitution_of_India
- Wikipedia, Preamble: https://en.wikipedia.org/wiki/Preamble_to_the_Constitution_of_India
- Wikipedia, Flag of India (official color approximations): https://en.wikipedia.org/wiki/Flag_of_India
- LiveLaw, 131st Amendment Bill defeat (April 2026): https://www.livelaw.in/top-stories/lok-sabha-rejects-the-constitution-131st-bill-2026-on-delimitation-530736
- Orama: https://github.com/oramasearch/orama and https://docs.askorama.ai/docs/orama-js/plugins/plugin-embeddings
- Pagefind: https://github.com/CloudCannon/pagefind and https://pagefind.app
- Astro 6 announcement and Cloudflare: https://astro.build/blog/astro-6/ and https://blog.cloudflare.com/astro-joins-cloudflare/ (project executes on Astro 7.2.9)
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Vectorize pricing: https://developers.cloudflare.com/vectorize/platform/pricing/
- USWDS design principles: https://designsystem.digital.gov/design-principles/
- GOV.UK design system: https://design-system.service.gov.uk/
- EBC v. D.B. Modak (public domain statutes): https://www.drishtijudiciary.com/landmark-judgement/intellectual-property-rights/eastern-book-company-v-d-b-modak-2008-36-ptc-1-sc
- llms.txt convention: https://llmstxt.org/
- schema.org Legislation: https://schema.org/Legislation
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Google AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- PRS Bill Track: https://prsindia.org/billtrack
- Sansad bill portals: https://sansad.in/ls/legislation/bills
