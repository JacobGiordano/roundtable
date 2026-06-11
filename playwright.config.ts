/**
 * Playwright configuration for Roundtable smoke tests.
 *
 * NOTE: The dev server must already be running before executing e2e tests.
 * Start it with: npm run dev
 * Then in a separate terminal: npm run test:e2e
 *
 * webServer auto-start is intentionally NOT configured — the dev server is
 * expected to be long-running during development. CI should start it separately.
 *
 * Browser installation note (dev container):
 * playwright.download.prss.microsoft.com is not on the container firewall
 * allowlist. To install Chromium outside the dev container:
 *   npx playwright install --with-deps chromium
 * Or add the domain to init-firewall.sh and restart the container (requires user auth).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5173',
    // Capture trace on first retry only — keeps CI artifacts lean.
    trace: 'on-first-retry',
    // No API keys needed for these smoke tests.
    // Never set storageState here — that would risk leaking local API keys.
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
