/**
 * Playwright configuration for Ada's accessibility keyboard audit tests.
 *
 * This config supplements the main playwright.config.ts (which covers
 * src/tests/e2e/). Ada's browser-based a11y tests live in src/tests/a11y/keyboard/
 * and use the .spec.ts extension so they are picked up here but not by the
 * main config (which only watches src/tests/e2e/).
 *
 * Run with: npx playwright test --config playwright.a11y.config.ts
 *
 * Dev server must be running: npm run dev
 *
 * Browser: Chromium only. Firefox is not available in this container
 * (playwright.download.prss.microsoft.com is firewalled — see playwright.config.ts).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/a11y/keyboard',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
