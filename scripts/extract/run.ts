import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseConstitution } from './parse.ts';
import { validateConstitution } from './validate.ts';
import { crosscheckArticles } from './crosscheck.ts';

const PDF_PATH = 'data/source/constitution-of-india.pdf';
const RAW_PATH = 'data/processed/raw.txt';
const OUTPUT_PATH = 'data/processed/constitution.json';
const REPORT_PATH = 'data/processed/report.json';
const CROSSCHECK_PATH = 'data/crosscheck/yash-handa-2019.json';

function ensureRawText(): string {
  if (!existsSync(RAW_PATH)) {
    if (!existsSync(PDF_PATH)) {
      throw new Error(`missing ${PDF_PATH}; vendor the official PDF first (see data/source/README.md)`);
    }
    execSync(`pdftotext ${PDF_PATH} ${RAW_PATH}`, { stdio: 'inherit' });
  }
  return readFileSync(RAW_PATH, 'utf8');
}

const raw = ensureRawText();
const parsed = parseConstitution(raw);
const validation = validateConstitution(parsed);

const crosscheck = existsSync(CROSSCHECK_PATH)
  ? crosscheckArticles(parsed, JSON.parse(readFileSync(CROSSCHECK_PATH, 'utf8')))
  : null;

writeFileSync(OUTPUT_PATH, `${JSON.stringify(parsed, null, 2)}\n`);
writeFileSync(
  REPORT_PATH,
  `${JSON.stringify(
    {
      generatedFrom: PDF_PATH,
      validatedAt: new Date().toISOString().slice(0, 10),
      counts: validation.counts,
      errors: validation.errors,
      warnings: validation.warnings,
      crosscheck,
    },
    null,
    2,
  )}\n`,
);

console.log(`articles: ${validation.counts.articles}`);
console.log(`parts: ${validation.counts.parts}`);
console.log(`schedules: ${validation.counts.schedules}`);
console.log(
  `status: in force ${validation.counts.inForceArticles}, amended ${validation.counts.amendedArticles}, omitted ${validation.counts.omittedArticles}, repealed ${validation.counts.repealedArticles}`,
);
console.log(`errors: ${validation.errors.length}`);
for (const error of validation.errors.slice(0, 20)) console.log(`  ERROR ${error}`);
console.log(`warnings: ${validation.warnings.length}`);
for (const warning of validation.warnings.slice(0, 20)) console.log(`  WARN ${warning}`);
if (crosscheck) {
  console.log(
    `crosscheck: ${crosscheck.common} common, ${crosscheck.flagged.length} flagged, ${crosscheck.missingInCrosscheck.length} newer than 2019 dataset, ${crosscheck.missingInPdf.length} missing in pdf`,
  );
} else {
  console.log('crosscheck: dataset not vendored, skipped');
}

if (validation.errors.length > 0) {
  process.exitCode = 1;
}
