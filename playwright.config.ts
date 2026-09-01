import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4319',
  },
  webServer: {
    command: 'npm run preview -- --port 4319 --host 127.0.0.1',
    port: 4319,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
