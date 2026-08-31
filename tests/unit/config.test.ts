import { describe, expect, test } from 'vitest';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '../../src/config';

describe('site config tokens', () => {
  test('exports the site name and tagline', () => {
    expect(SITE_NAME).toBe('Samvidhan');
    expect(SITE_TAGLINE).toBe('The Constitution of India, made readable.');
  });

  test('exports a valid production https URL', () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(() => new URL(SITE_URL)).not.toThrow();
  });
});
