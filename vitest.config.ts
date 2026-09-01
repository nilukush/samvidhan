import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The integration suites shell out to `npm run build`; serial file
    // execution keeps concurrent builds from clobbering dist/.
    fileParallelism: false,
    // The integration suite runs a full astro build, which needs headroom.
    testTimeout: 180_000,
  },
});
