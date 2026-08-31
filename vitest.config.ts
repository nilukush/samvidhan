import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The integration suite runs a full astro build, which needs headroom.
    testTimeout: 180_000,
  },
});
