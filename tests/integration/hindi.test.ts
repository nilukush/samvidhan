import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const hindiPreamble = JSON.parse(readFileSync('src/data/hindi/preamble.json', 'utf8')) as {
  title: string;
  text: string;
  lastVerified: string;
};

/** Head and style stripped, so assertions see page markup, not CSS selectors. */
function bodyMarkup(path: string): string {
  const html = readFileSync(path, 'utf8');
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

/** Every css file shipped in dist, concatenated. */
function allCss(): string {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) files.push(readFileSync(full, 'utf8'));
    }
  };
  walk('dist');
  return files.join('\n');
}

describe('hindi preamble data', () => {
  test('carries the verified text with editorial markers and no replacement characters', () => {
    expect(hindiPreamble.title).toBe('उद्देशिका');
    expect(hindiPreamble.text).toContain('हम, भारत के लोग');
    expect(hindiPreamble.text).toContain('1[संपूर्ण प्रभुत्व-संपन्न');
    expect(hindiPreamble.text).toContain('2[राष्ट्र की एकता');
    expect(hindiPreamble.text).toContain('प्राप्त कराने के लिए');
    expect(hindiPreamble.text).toContain('एतद्द्वारा इस संविधान को अंगीकृत, अधिनियमित और आत्मार्पित करते हैं');
    // The PDF text layer is corrupted; the published text must never carry
    // the replacement character the extraction produces.
    expect(hindiPreamble.text).not.toContain('\uFFFD');
    expect(hindiPreamble.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('hindi preamble page', () => {
  test('the preamble page carries the Hindi text in a lang="hi" section, cleaned of markers', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const markup = bodyMarkup('dist/preamble/index.html');

    expect(markup).toContain('उद्देशिका');
    expect(markup).toMatch(/lang="hi"/);
    expect(markup).toContain('हम, भारत के लोग');
    expect(markup).toContain('संविधान सभा');
    // Editorial insertion markers are stripped for reading, as in English.
    expect(markup).not.toMatch(/\d{1,2}\[/);

    // Provenance is visible: the edition date and the verification date.
    expect(markup).toContain('1 May 2026');
    expect(markup).toContain('5 September 2026');
  });

  test('a Devanagari font ships in the built css', () => {
    expect(allCss()).toContain('Noto Sans Devanagari');
  });
});
