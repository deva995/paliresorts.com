import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '.audit-runtime/playwright-results',
  use: { baseURL: 'http://127.0.0.1:4317', browserName: 'chromium', headless: true, trace: 'off' },
  webServer: {
    command: 'node --import tsx scripts/browser-test-server.ts',
    url: 'http://127.0.0.1:4317/login',
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
