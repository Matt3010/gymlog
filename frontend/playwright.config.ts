import { defineConfig, devices } from '@playwright/test';

// The app in a real browser, against a real API and Postgres: the screens'
// own tests use a fake server and jsdom, which has no layout. Skipped without
// E2E_DATABASE_URL (e.g. postgres://postgres:test@127.0.0.1:55432), like the
// backend's database tests. e2e/global-setup.ts starts and stops everything.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // One flow through one database: in order, one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
});
