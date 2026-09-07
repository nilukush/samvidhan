import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/** Head and style stripped, so assertions see page markup, not CSS selectors. */
function bodyMarkup(path: string): string {
  const html = readFileSync(path, 'utf8');
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

function raw(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('hindi edition pages', () => {
  test('a build generates one page per Hindi article, matching the source data', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const hindi = JSON.parse(readFileSync('data/processed/constitution-hindi.json', 'utf8')) as {
      articles: Array<{ number: string }>;
    };
    for (const article of hindi.articles.slice(0, 40).concat(hindi.articles.slice(-40))) {
      const file = `dist/hi/articles/${article.number.toLowerCase()}/index.html`;
      expect(raw(file), article.number).toContain('अनुच्छेद');
    }
  });

  test('Hindi pages carry lang="hi" and hreflang pairs; English counterparts reciprocate', () => {
    const article = raw('dist/hi/articles/14/index.html');
    expect(article).toMatch(/<html lang="hi"/);
    expect(article).toContain('hreflang="en"');
    expect(article).toContain('hreflang="x-default"');

    const english = raw('dist/articles/14/index.html');
    expect(english).toContain('hreflang="hi"');
    expect(english).toMatch(/\/hi\/articles\/14\//);
  });

  test('the Hindi article page carries the legal text and the English cross link', () => {
    const markup = bodyMarkup('dist/hi/articles/14/index.html');
    expect(markup).toContain('अनुच्छेद 14');
    expect(markup).toContain('Article 14 in English');
    expect(markup).not.toMatch(/\d{1,2}\[/);
  });

  test('the Hindi preamble page carries the approved Preamble', () => {
    const markup = bodyMarkup('dist/hi/preamble/index.html');
    expect(markup).toContain('हम, भारत के लोग');
    expect(markup).not.toMatch(/\d{1,2}\[/);
  });

  test('Hindi index pages exist with their directories', () => {
    expect(raw('dist/hi/index.html')).toContain('संविधान हिन्दी में');
    expect(raw('dist/hi/articles/index.html')).toContain('सभी अनुच्छेद');
    expect(raw('dist/hi/parts/index.html')).toContain('सभी भाग');
    expect(raw('dist/hi/parts/3/index.html')).toContain('मूल अधिकार');
  });

  test('the shared CSS ships the Devanagari font, applied only on Hindi pages', () => {
    const article = raw('dist/hi/articles/14/index.html');
    const cssPath = /href="([^"]+\.css)"/.exec(article)?.[1];
    expect(cssPath).toBeDefined();
    const css = raw(`dist${cssPath}`);
    expect(css).toContain('Noto Sans Devanagari');
    // No unicode-range in these subset files; the guarantee is structural:
    // the family is referenced only by the html[lang='hi'] body rule, so
    // English pages never fetch the woff2.
    expect(css).toMatch(/html\[lang=.?hi.?\]\s*body\{font-family:var\(--font-devanagari\)\}/);
  });

  test('the header shows the language switch on both editions', () => {
    const english = raw('dist/articles/14/index.html');
    expect(english).toMatch(/<a[^>]*lang="hi"[^>]*href="\/hi\/"[^>]*>हिन्दी/);
    const hindi = raw('dist/hi/articles/14/index.html');
    expect(hindi).toMatch(/<a[^>]*lang="en"[^>]*href="\/"[^>]*>English/);
  });

  test('English article, preamble, and part pages carry visible Hindi cross-links', () => {
    const article = bodyMarkup('dist/articles/14/index.html');
    expect(article).toContain('अनुच्छेद 14 हिन्दी में');
    expect(article).toContain('/hi/articles/14/');
    const preamble = bodyMarkup('dist/preamble/index.html');
    expect(preamble).toContain('उद्देशिका हिन्दी में');
    const part = bodyMarkup('dist/parts/3/index.html');
    expect(part).toContain('यह भाग हिन्दी में');
  });
});
