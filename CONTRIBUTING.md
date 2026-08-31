# Contributing to Samvidhan

## Local development

Planned commands once the scaffold exists (Step 1 of the implementation plan):

```bash
npm install        # install dependencies
npm run dev        # local dev server
npm test           # unit and integration tests (Vitest)
npm run build      # full build including data sync and Pagefind indexing
npm run e2e        # Playwright smoke and accessibility suite
```

Use a non standard local port (for example 4321 is Astro's default; if it is taken, pass `--port 4513`). Do not commit `.env` files; this project needs no secrets because everything is static and keyless.

## Testing discipline

This project follows strict TDD: write the failing test first, then the minimal code, then refactor. See docs/IMPLEMENTATION-PLAN.md. CI runs the full suite on every push, and no step is considered done while any previously green test is red.

## The monthly update ritual

The site has no runtime dependency on any government server. Honesty about data age is a core feature, so these dates must be maintained by hand:

1. Constitution text: check legislative.gov.in/constitution-of-india for a new edition PDF (amendments are rare, 1 to 2 a year). If there is a new one, download it into `data/source/`, rerun the extraction pipeline, spot check 10 articles against the PDF, and update the "text verified" date in the site data and footer.
2. Amendment list: verify against Wikipedia's List of amendments of the Constitution of India that no new amendment has been enacted. Add amendment data and timeline entries if one has.
3. Pending bills: review Constitution amendment bills on sansad.in and prsindia.org/billtrack. Update `src/data/bills/snapshot.json` with status changes, paraphrased in your own words, and set a fresh lastVerified date on every changed row.
4. Push. Cloudflare Pages rebuilds and deploys automatically. Confirm the deployed verified dates changed.

Notes: never scrape at runtime, never copy PRS analysis text verbatim (facts only, paraphrased, linked), never publish constitution text from community GitHub datasets (unlicensed and stale; the official PDF is the only canonical source).

## House style for all site copy

- No em dashes. No filler phrases: delve, moreover, furthermore, it is important to note, in conclusion, in today's world. No rule of three padding. No vague attributions like "experts say".
- Plain, concrete sentences. Every status claim carries a date.
- Indian English spellings in site copy. Quoted legal text is never altered.
- A mechanical linter (Step 10 of the plan) enforces the banned list in CI, so style violations fail the build rather than relying on memory.

## Commit conventions

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `data:`. Data snapshot updates use `data:` with the verified date in the message body.
