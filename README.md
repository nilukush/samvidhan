# Samvidhan: the Constitution of India, made readable

A zero cost, static website that presents the Constitution of India as beautiful, readable, searchable pages: the current text of every article, plain language summaries, a timeline of all 106 amendments, and a tracker of pending Constitution amendment bills.

## Status

Planning complete. Analysis, design system, and implementation plan are in the docs directory. No code yet.

- [docs/ANALYSIS.md](docs/ANALYSIS.md): feasibility analysis, data sources, architecture decision, risk register
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): the Samvidhan design system, grounded in USWDS, GOV.UK, and Indian national visual heritage
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md): 14 step TDD implementation plan

## What this project is

- Current consolidated text of the Constitution, re derived from the official Legislative Department PDF (public domain under Indian law, EBC v. D.B. Modak 2008)
- Plain words explainers for every article, clearly labeled as summaries
- An amendment timeline, 1950 to today, with per amendment detail pages
- A pending bill tracker with visible last verified dates, because no free official feed exists
- Keyword search (Pagefind) and opt in semantic search (Orama hybrid with build time precomputed embeddings), both running entirely in the browser at zero server cost
- Static HTML on Cloudflare Pages free tier, engineered to stay portable to any static host

## Planned stack

| Layer | Choice | License | Why |
| --- | --- | --- | --- |
| Site | Astro 7 | MIT | Content first, ships near zero JavaScript, best in class SEO |
| Keyword search | Pagefind | MIT | Post build indexing of static HTML, chunked lazy loading |
| Semantic search | Orama + transformers.js | Apache 2.0 | Hybrid full text and vector search in the browser, no API keys |
| Tests | Vitest, Playwright, axe, Lighthouse CI | MIT | Free, CI friendly |
| Hosting | Cloudflare Pages free tier | free | Unlimited static bandwidth, 500 builds a month |

## Data sources and licensing

- Constitution text: official Legislative Department PDF, legislative.gov.in/constitution-of-india. Statutes are public domain in India.
- Amendment facts: derived from Wikipedia's List of amendments of the Constitution of India (CC BY-SA 4.0), paraphrased and attributed.
- Bill tracking: sansad.in (official) and prsindia.org/billtrack, paraphrased with attribution, snapshotted manually on a monthly ritual.
- Community GitHub datasets (captn3m0, civictech-India) were evaluated and rejected: stale (2019 to 2021) and two of three carry no license. The MIT licensed Yash Handa JSON is used as a structural cross check only.

## Cost

Zero. Static hosting only, no server compute, no API keys, no paid services. The only optional cash cost is a custom domain (about 10 dollars a year). The free pages.dev subdomain works fine.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the update ritual (keeping text, amendments, and bills honestly dated) and local development instructions.

## License

Code: MIT (see LICENSE). Original editorial content (explainers, summaries): CC BY 4.0. The Constitution text itself is public domain under Indian law.
