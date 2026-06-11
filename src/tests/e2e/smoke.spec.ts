/**
 * Roundtable smoke tests — browser-level sanity checks.
 *
 * PREREQUISITE: The dev server must be running before executing these tests.
 *   npm run dev          (in one terminal)
 *   npm run test:e2e     (in another terminal)
 *
 * These tests require no API keys and make no requests to model providers.
 * All assertions are against static structure and interaction affordances only.
 *
 * Covered:
 *   - Page loads without JS errors
 *   - App header renders (logo mark present with role="img" + aria-label)
 *   - Model selector panel opens and closes
 *   - Settings panel opens and closes
 *   - New conversation button is present and clickable
 *   - No broken layout at 1280×800 viewport (desktop)
 *   - No broken layout at 375×812 viewport (mobile)
 */

import { test, expect } from '@playwright/test';

// ─── Desktop smoke tests (1280×800) ──────────────────────────────────────────

test.describe('desktop layout (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    // Collect JS errors so the "no JS errors" test can inspect them.
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    // Attach to the test so assertions can access it.
    (page as unknown as Record<string, unknown>).__jsErrors = jsErrors;

    await page.goto('/');
    // Wait for React to hydrate — the logo mark is the earliest reliable signal.
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
  });

  test('page loads without JS errors', async ({ page }) => {
    // Listen for future errors after initial load too.
    const errors: string[] = (page as unknown as Record<string, unknown>).__jsErrors as string[];
    // Allow a beat for any deferred errors to surface.
    await page.waitForTimeout(500);
    expect(errors, `JavaScript errors on page load: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('app header renders — logo mark is present', async ({ page }) => {
    // The RoundtableLogo component renders a div with role="img" aria-label="Roundtable".
    // This is the authoritative brand mark per identity.md.
    const logo = page.getByRole('img', { name: 'Roundtable' });
    await expect(logo).toBeVisible();
  });

  test('model selector panel opens and closes', async ({ page }) => {
    // The trigger chip is a button with aria-expanded and aria-controls="model-selector-panel".
    // It shows the count of active models (e.g. "2 models"). We locate by aria-controls.
    const trigger = page.locator('button[aria-controls="model-selector-panel"]');
    await expect(trigger).toBeVisible();

    // Panel starts closed — aria-hidden="true" on the panel wrapper.
    const panel = page.locator('#model-selector-panel');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Click trigger to open.
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Panel should now be visible (aria-hidden removed or set false).
    await expect(panel).not.toHaveAttribute('aria-hidden', 'true');

    // Click trigger again to close.
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('settings panel opens and closes', async ({ page }) => {
    // The settings toggle button has aria-controls="sidebar-settings-panel"
    // and renders "Settings" as its visible label text.
    const settingsToggle = page.locator('button[aria-controls="sidebar-settings-panel"]');
    await expect(settingsToggle).toBeVisible();
    await expect(settingsToggle).toContainText('Settings');

    // Settings panel starts closed.
    await expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');
    const settingsPanel = page.locator('#sidebar-settings-panel');
    await expect(settingsPanel).not.toBeVisible();

    // Click to open.
    await settingsToggle.click();
    await expect(settingsToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(settingsPanel).toBeVisible();

    // Click again to close.
    await settingsToggle.click();
    await expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(settingsPanel).not.toBeVisible();
  });

  test('new conversation button is present and clickable', async ({ page }) => {
    // On desktop the sidebar header has a "New conversation" button (aria-label).
    // The mobile top bar also has one but is hidden at 1280px — this finds the
    // desktop one which has `hidden md:flex` classes rendering it visible.
    const newConvBtn = page.getByRole('button', { name: 'New conversation' }).first();
    await expect(newConvBtn).toBeVisible();

    // Click it — should not throw or navigate away. The app starts a new conversation.
    await newConvBtn.click();
    // Verify the page is still the app (logo still present after click).
    await expect(page.getByRole('img', { name: 'Roundtable' })).toBeVisible();
  });
});

// ─── Mobile smoke tests (375×812) ────────────────────────────────────────────

test.describe('mobile layout (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // On mobile the app renders a top bar with the logo and a hamburger.
    // The sidebar logo is off-screen (drawer closed), so we wait for either logo.
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
  });

  test('page renders without layout overflow — no horizontal scroll', async ({ page }) => {
    // document.documentElement.scrollWidth should equal viewport width (375) when
    // there is no horizontal overflow. A larger scrollWidth means something is
    // bleeding off screen.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = 375;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('mobile header renders with logo and hamburger', async ({ page }) => {
    // The mobile top bar (flex md:hidden) contains the RoundtableLogo and a
    // hamburger button (aria-label="Open navigation").
    const logo = page.getByRole('img', { name: 'Roundtable' }).first();
    await expect(logo).toBeVisible();

    const hamburger = page.getByRole('button', { name: 'Open navigation' });
    await expect(hamburger).toBeVisible();
  });

  test('sidebar opens and closes via hamburger', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: 'Open navigation' });

    // Open via hamburger.
    await hamburger.click();
    // After opening, aria-expanded on hamburger should reflect open state.
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    // "Close navigation" button should appear inside the drawer.
    const closeBtn = page.getByRole('button', { name: 'Close navigation' });
    await expect(closeBtn).toBeVisible();

    // Close via the X button inside the drawer.
    await closeBtn.click();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  });

  test('new conversation button is present on mobile header', async ({ page }) => {
    // The mobile top bar has a "New conversation" button (aria-label, no text).
    // It is distinct from the desktop sidebar button (which is md:flex hidden on mobile).
    const newConvBtns = page.getByRole('button', { name: 'New conversation' });
    // There may be two (mobile top bar + sidebar header — but sidebar is off-screen).
    // At least one should be visible in the mobile viewport.
    await expect(newConvBtns.first()).toBeVisible();
  });

  test('model selector trigger is present and functional at mobile size', async ({ page }) => {
    // The model selector trigger should still be accessible below the message thread.
    const trigger = page.locator('button[aria-controls="model-selector-panel"]');
    await expect(trigger).toBeVisible();

    // Open it — should not cause layout overflow.
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Still no horizontal overflow with panel open.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
