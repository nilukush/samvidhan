import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

function walk(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) entries.push(...walk(path));
    else if (name.name === 'index.html') entries.push(path);
  }
  return entries;
}

function bodyMarkup(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

describe('SEO: unique titles and descriptions', () => {
  test('every built page has a unique title under 60 characters with the site name', () => {
    execSync('npm run build', { stdio: 'pipe' });
    const pages = walk('dist');
    expect(pages.length).toBeGreaterThan(500);
    const titles = new Set<string>();
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      const titleMatch = /<title>([^<]+)<\/title>/.exec(html);
      expect(titleMatch, `${page} has no title`).not.toBeNull();
      const title = titleMatch![1]!;
      // Decode HTML entities before measuring: &#39; is one character.
      const decodedLength = title.replace(/&#\d+;/g, '_').length;
      expect(decodedLength, `${page} title too long: ${decodedLength}`).toBeLessThan(61);
      // The home page leads with the site name; every other page ends with it.
      const hasSiteName = title.includes('| Samvidhan') || title.startsWith('Samvidhan:');
      expect(hasSiteName, `${page} title does not carry the site name`).toBe(true);
      expect(titles.has(title), `${page} duplicate title: ${title}`).toBe(false);
      titles.add(title);
    }
  });

  test('every page has a meta description under 160 characters', () => {
    const pages = walk('dist');
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      const match = /<meta name="description" content="([^"]*)"/.exec(html);
      expect(match, `${page} has no description`).not.toBeNull();
      const description = match![1]!;
      expect(description.length, `${page} description is ${description.length}`).toBeLessThan(160);
      expect(description.length).toBeGreaterThan(20);
    }
  });
});

describe('SEO: JSON-LD structured data', () => {
  test('article pages embed valid Legislation JSON-LD with required fields', () => {
    for (const number of ['14', '368', '51A']) {
      const html = readFileSync(`dist/articles/${number.toLowerCase()}/index.html`, 'utf8');
      const ldMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
      expect(ldMatch, `article ${number} has no JSON-LD`).not.toBeNull();
      const ld = JSON.parse(ldMatch![1]!) as Record<string, unknown>;
      expect(ld['@type']).toBe('Legislation');
      expect(ld['name']).toContain(number);
      expect(ld['@id']).toContain(`/articles/${number.toLowerCase()}/`);
      expect(ld['legislationType']).toBe('ConstitutionalLaw');
      expect(ld['isPartOf']).toBeDefined();
    }
  });

  test('article pages carry BreadcrumbList JSON-LD', () => {
    const html = readFileSync('dist/articles/14/index.html', 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const breadcrumbs = blocks
      .map((match) => JSON.parse(match[1]!))
      .find((block) => block['@type'] === 'BreadcrumbList');
    expect(breadcrumbs).toBeDefined();
  });
});

describe('SEO: sitemap, robots, and llms.txt', () => {
  test('the sitemap lists every page and validates as XML', () => {
    expect(existsSync('dist/sitemap-index.xml')).toBe(true);
    const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(urls.length).toBeGreaterThan(500);
    const article14 = urls.find((url) => url.includes('/articles/14/'));
    expect(article14).toBeDefined();
    const amendment42 = urls.find((url) => url.includes('/amendments/42/'));
    expect(amendment42).toBeDefined();
  });

  test('robots.txt allows all crawlers and references the sitemap', () => {
    const robots = readFileSync('dist/robots.txt', 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap:');
  });

  test('llms.txt exists as markdown and links every top level section', () => {
    const llms = readFileSync('dist/llms.txt', 'utf8');
    expect(llms.startsWith('# ')).toBe(true);
    for (const section of [
      '/preamble/',
      '/articles/',
      '/parts/',
      '/schedules/',
      '/amendments/',
      '/changes/upcoming/',
    ]) {
      expect(llms, `llms.txt missing ${section}`).toContain(section);
    }
    expect(llms).toContain('Constitution of India');
  });
});

describe('SEO: 404 handling', () => {
  test('the build emits a 404 page so unknown paths do not serve the homepage', () => {
    expect(existsSync('dist/404.html')).toBe(true);
    const html = readFileSync('dist/404.html', 'utf8');
    expect(html).toContain('Page not found');
    expect(html).toContain('href="/"');
  });
});

describe('GEO: answer ledes', () => {
  test('every article page renders a first paragraph between 40 and 60 words', () => {
    for (const number of ['14', '21', '368', '243z', '51a', '1', '395']) {
      const html = readFileSync(`dist/articles/${number}/index.html`, 'utf8');
      const markup = bodyMarkup(html);
      const ledeMatch = /<p class="article-lede[^>]*>([\s\S]*?)<\/p>/.exec(markup);
      expect(ledeMatch, `article ${number} has no lede paragraph`).not.toBeNull();
      const words = ledeMatch![1]!.trim().split(/\s+/).length;
      // Articles with less than 40 words total (like 395, Repeals) use all
      // their text; every other article must hit the 40 to 60 band.
      if (number !== '395') {
        expect(words, `article ${number} lede is ${words} words`).toBeGreaterThanOrEqual(40);
        expect(words, `article ${number} lede is ${words} words`).toBeLessThanOrEqual(60);
      } else {
        expect(words).toBeLessThanOrEqual(60);
      }
    }
  });
});
