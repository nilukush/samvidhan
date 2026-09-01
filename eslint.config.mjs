import js from '@eslint/js';
import * as astroParser from 'astro-eslint-parser';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

/**
 * ESLint 10 with eslint-plugin-astro 3.1.0 (which peer requires eslint >=10).
 * The parser is passed as the astro-eslint-parser module namespace, mirroring
 * how the plugin's own flat preset wires it (it has no default export).
 * Rules are taken from the plugin's recommended preset; config wiring is ours.
 */
const astroRecommendedRules =
  astro.configs['flat/recommended'].find((c) => c.name === 'astro/recommended')?.rules ?? {};

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/vendor/**',
    ],
  },
  {
    // The search dialog controller is a plain browser script outside any bundler.
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        Worker: 'readonly',
        self: 'readonly',
        importScripts: 'readonly',
        onmessage: 'writable',
        postMessage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.astro'],
    plugins: { astro },
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.astro'],
      },
    },
    rules: astroRecommendedRules,
  },
];
