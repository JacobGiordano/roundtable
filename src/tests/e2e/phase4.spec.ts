/**
 * Phase 4 E2E tests — credential editor and roster reactivity.
 *
 * PREREQUISITE: The dev server must be running before executing these tests.
 *   npm run dev          (in one terminal)
 *   npm run test:e2e     (in another terminal)
 *
 * These tests make no real API requests. All assertions are against UI
 * structure, localStorage state, and DOM visibility.
 *
 * Features covered (shipped in #102 and #103):
 *   - Per-provider credential management (Set key / Edit / Remove key flows)
 *   - Live roster sync: model selector pills update after settings panel close
 *   - No horizontal overflow at 1280×800 with multiple providers configured
 *
 * Implementation notes:
 *   - Credential storage prefix: 'roundtable:key:' (see /src/auth/credentials.ts)
 *   - Roster storage key: 'roundtable:provider-roster' (see /src/auth/providerRoster.ts)
 *   - ProviderRow's badgeState is initialized once on mount — tests that need
 *     a pre-existing key must set it via addInitScript (before page load) or
 *     set it before the panel opens so the row mounts with the correct state.
 */

import { test, expect } from '@playwright/test';

// ─── Storage key constants (mirror /src/auth) ─────────────────────────────────

const ROSTER_KEY = 'roundtable:provider-roster';
const CRED_PREFIX = 'roundtable:key:';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Page = import('@playwright/test').Page;

/**
 * Open the ProviderSettingsPanel by clicking the gear icon in the sidebar.
 * Waits for the "My Providers" heading to be visible inside the panel.
 *
 * Selector note: Aria's #110 added a second gear button inside ModelSelectorPanel
 * with aria-label="Open provider settings". When that panel is mid-close-animation
 * (isClosing=true → aria-hidden=false), both buttons may be in the accessibility tree
 * simultaneously. Use { exact: true } to match only the sidebar header gear
 * (aria-label="Provider settings") and exclude the in-panel shortcut
 * (aria-label="Open provider settings").
 */
async function openProviderPanel(page: Page) {
  const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
  await gearBtn.click();
  // The panel slides in with a CSS transition; wait for its heading.
  await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();
}

/**
 * Close the ProviderSettingsPanel by clicking its close button.
 * Waits for the panel heading to be hidden before returning.
 */
async function closeProviderPanel(page: Page) {
  await page.getByRole('button', { name: 'Close provider settings' }).click();
  // Wait for the slide-out transition to complete.
  await expect(page.getByRole('heading', { name: 'My Providers' })).not.toBeVisible({ timeout: 2000 });
}

/**
 * Clear all roster and credential keys from localStorage and reload the page.
 * Call this at the start of a test to ensure a clean slate.
 */
async function clearStorageAndReload(page: Page) {
  await page.evaluate(({ rosterKey, credPrefix }) => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === rosterKey || key.startsWith(credPrefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }, { rosterKey: ROSTER_KEY, credPrefix: CRED_PREFIX });

  await page.reload();
  await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
}

/**
 * Ensure at least one built-in provider (Claude) is in the roster.
 * If the roster is empty, clicks the Claude chip to add it.
 * Assumes the ProviderSettingsPanel is already open.
 */
async function ensureClaudeInRoster(page: Page) {
  const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
  const isPresent = await claudeRow.isVisible().catch(() => false);
  if (isPresent) return;

  const addClaudeBtn = page.getByRole('button', { name: 'Add Claude to your providers' });
  await addClaudeBtn.click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Claude' }).first()).toBeVisible();
}

// ─── Credential editor tests ──────────────────────────────────────────────────

test.describe('credential editor — built-in provider (Claude)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
    await clearStorageAndReload(page);
    await openProviderPanel(page);
    await ensureClaudeInRoster(page);
  });

  test('no key → provider row shows "Set key" (not "Edit")', async ({ page }) => {
    // No credential seeded — the Claude row should show "Set key".
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await expect(claudeRow.getByRole('button', { name: /Set API key for Claude/i })).toBeVisible();
    await expect(claudeRow.getByRole('button', { name: /Edit API key for Claude/i })).not.toBeVisible();
  });

  test('clicking "Set key" expands the inline credential editor', async ({ page }) => {
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();

    // The inline editor should be visible with a password input and Save / Cancel.
    await expect(claudeRow.getByLabel('New API key')).toBeVisible();
    await expect(claudeRow.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(claudeRow.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Save button is disabled when the key input is empty', async ({ page }) => {
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();

    // Input is empty — Save should be disabled.
    const saveBtn = claudeRow.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeDisabled();
  });

  test('save flow: type key → Save → badge shows "Key set" → editor closes', async ({ page }) => {
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();

    // Fill in a fake key and save.
    await claudeRow.getByLabel('New API key').fill('sk-ant-test-key-12345');
    await claudeRow.getByRole('button', { name: 'Save' }).click();

    // Editor should be gone and badge should now read "Key set".
    await expect(claudeRow.getByLabel('New API key')).not.toBeVisible();
    await expect(claudeRow.getByText('Key set')).toBeVisible();

    // The credential is in localStorage under roundtable:key:anthropic.
    const stored = await page.evaluate(() => localStorage.getItem('roundtable:key:anthropic'));
    expect(stored).toBe('sk-ant-test-key-12345');
  });

  test('after saving a key, reopening the panel shows "Edit" button and "Key set" badge', async ({ page }) => {
    // First save a key through the UI (so the component state is set correctly).
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();
    await claudeRow.getByLabel('New API key').fill('sk-ant-existing-key');
    await claudeRow.getByRole('button', { name: 'Save' }).click();
    await expect(claudeRow.getByText('Key set')).toBeVisible();

    // Close and reopen the panel — ProviderRow remounts and reads badge from storage.
    await closeProviderPanel(page);
    await openProviderPanel(page);

    const freshClaudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await expect(freshClaudeRow.getByRole('button', { name: /Edit API key for Claude/i })).toBeVisible();
    await expect(freshClaudeRow.getByRole('button', { name: /Set API key for Claude/i })).not.toBeVisible();
    await expect(freshClaudeRow.getByText('Key set')).toBeVisible();
  });

  test('remove key flow: Edit → "Remove key" button visible → click → badge shows "No key"', async ({ page }) => {
    // Save a key first through the UI.
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();
    await claudeRow.getByLabel('New API key').fill('sk-ant-to-remove');
    await claudeRow.getByRole('button', { name: 'Save' }).click();
    await expect(claudeRow.getByText('Key set')).toBeVisible();

    // Open the edit flow.
    await claudeRow.getByRole('button', { name: /Edit API key for Claude/i }).click();

    // "Remove key" button should appear because a key is currently stored.
    const removeBtn = claudeRow.getByRole('button', { name: 'Remove key' });
    await expect(removeBtn).toBeVisible();

    // Click it — badge should switch to "No key" and editor closes.
    await removeBtn.click();
    await expect(claudeRow.getByLabel('New API key')).not.toBeVisible();
    await expect(claudeRow.getByText('No key')).toBeVisible();

    // Confirm the key is gone from localStorage.
    const stored = await page.evaluate(() => localStorage.getItem('roundtable:key:anthropic'));
    expect(stored).toBeNull();
  });

  test('Escape key cancels the credential editor without saving', async ({ page }) => {
    const claudeRow = page.getByRole('listitem').filter({ hasText: 'Claude' }).first();
    await claudeRow.getByRole('button', { name: /Set API key for Claude/i }).click();
    await claudeRow.getByLabel('New API key').fill('sk-ant-should-not-save');

    // Press Escape — editor should close.
    await page.keyboard.press('Escape');

    // Editor gone, key not stored.
    await expect(claudeRow.getByLabel('New API key')).not.toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('roundtable:key:anthropic'));
    expect(stored).toBeNull();
  });

  test('keyless provider shows no "Set key" or "Edit" affordance', async ({ page }) => {
    // Inject a keyless custom provider directly into roster storage.
    // credentialKey is absent — keyless endpoint like Ollama/LM Studio.
    await page.evaluate((rosterKey) => {
      const existing: unknown[] = JSON.parse(localStorage.getItem(rosterKey) ?? '[]');
      existing.push({
        kind: 'custom',
        id: 'test-ollama',
        displayName: 'Ollama Local',
        endpointUrl: 'http://localhost:11434/v1',
        modelString: 'llama3.2:latest',
        isVisible: true,
        // credentialKey intentionally omitted — keyless endpoint.
      });
      localStorage.setItem(rosterKey, JSON.stringify(existing));
    }, ROSTER_KEY);

    // Close and reopen so the panel re-reads the roster from storage.
    await closeProviderPanel(page);
    await openProviderPanel(page);

    const ollamaRow = page.getByRole('listitem').filter({ hasText: 'Ollama Local' }).first();
    await expect(ollamaRow).toBeVisible();

    // No credential affordances — "No key required" badge present, no Set key / Edit.
    await expect(ollamaRow.getByText('No key required')).toBeVisible();
    await expect(ollamaRow.getByRole('button', { name: /Set API key/i })).not.toBeVisible();
    await expect(ollamaRow.getByRole('button', { name: /Edit API key/i })).not.toBeVisible();
  });
});

// ─── Roster reactivity tests ──────────────────────────────────────────────────

test.describe('roster reactivity — model selector updates on panel close', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
    await clearStorageAndReload(page);
  });

  test('adding a custom provider via form → close panel → model appears in selector', async ({ page }) => {
    await openProviderPanel(page);

    // Fill in the Add Custom Endpoint form.
    await page.getByLabel('Display name').fill('My Test Server');
    await page.getByLabel('Endpoint URL').fill('https://my-test-server.example.com/v1');
    await page.getByLabel('Model string').fill('test-model:latest');
    // Leave API key blank (keyless endpoint).
    // Use exact match to avoid the "Add providers to get started" button.
    await page.getByRole('button', { name: 'Add provider', exact: true }).click();

    // The new provider row should appear in the configured list.
    await expect(page.getByRole('listitem').filter({ hasText: 'My Test Server' }).first()).toBeVisible();

    // Close the provider panel — this is the sync point where App re-reads the roster
    // and derives a new ModelConfig for the custom provider (isActive: false, new entry).
    await closeProviderPanel(page);

    // Open the model selector panel.
    const modelSelectorTrigger = page.locator('button[aria-controls="model-selector-panel"]');
    await modelSelectorTrigger.click();
    await expect(page.locator('#model-selector-panel')).toBeVisible();

    // New providers start inactive. They appear in the "Add model to conversation" dropdown
    // (the dashed-border pill that lists inactive models). Click it to open the dropdown.
    const addModelBtn = page.getByRole('button', { name: 'Add model to conversation' });
    await expect(addModelBtn).toBeVisible();
    await addModelBtn.click();

    // The new provider should appear as a menu item in the dropdown.
    // Menu items render the model's display name as text content.
    const menu = page.getByRole('menu', { name: 'Available models' });
    await expect(menu).toBeVisible();
    await expect(menu.getByText('My Test Server')).toBeVisible();
  });

  test('removing a custom provider → close panel → model no longer available in selector', async ({ page }) => {
    // First add TWO providers so removal shows the confirmation dialog (not the
    // "last provider" guard which prevents removal of the only provider).
    await openProviderPanel(page);

    // Add a built-in provider first (Claude chip).
    await page.getByRole('button', { name: 'Add Claude to your providers' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Claude' }).first()).toBeVisible();

    // Then add the custom provider we'll remove.
    await page.getByLabel('Display name').fill('Provider To Remove');
    await page.getByLabel('Endpoint URL').fill('https://remove-me.example.com/v1');
    await page.getByLabel('Model string').fill('remove-model:latest');
    await page.getByRole('button', { name: 'Add provider', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Provider To Remove' }).first()).toBeVisible();
    await closeProviderPanel(page);

    // Verify the provider is available in the model selector's "Add model" dropdown.
    const modelSelectorTrigger = page.locator('button[aria-controls="model-selector-panel"]');
    await modelSelectorTrigger.click();
    await expect(page.locator('#model-selector-panel')).toBeVisible();

    const addModelBtn = page.getByRole('button', { name: 'Add model to conversation' });
    await expect(addModelBtn).toBeVisible();
    await addModelBtn.click();

    const menu = page.getByRole('menu', { name: 'Available models' });
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Provider To Remove')).toBeVisible();

    // Close the dropdown and model selector.
    await page.keyboard.press('Escape');
    await modelSelectorTrigger.click();

    // Re-open provider settings and remove the provider.
    await openProviderPanel(page);
    // Find the trash icon button (aria-label="Remove Provider To Remove") and click it.
    await page.getByRole('button', { name: 'Remove Provider To Remove' }).click();
    // The row transitions to a confirmation state.
    const confirmRow = page.getByRole('listitem').filter({ hasText: 'Provider To Remove — Remove this provider?' });
    await expect(confirmRow).toBeVisible({ timeout: 2000 });
    // Click the red "Remove" confirm button scoped to the confirmation row.
    await confirmRow.getByRole('button', { name: 'Remove' }).click();
    // Wait for the removal animation (200ms) and the roster to update in localStorage.
    await page.waitForTimeout(500);
    // Verify the roster in localStorage no longer contains the removed provider.
    const rosterAfterRemove = await page.evaluate((k) => localStorage.getItem(k), ROSTER_KEY);
    expect(rosterAfterRemove).not.toContain('Provider To Remove');

    // Close the panel — roster sync fires here (onRosterChange callback).
    // Allow a brief moment for React to flush the state update before opening the selector.
    await closeProviderPanel(page);
    await page.waitForTimeout(300);

    // Open model selector — the provider should no longer appear anywhere.
    await modelSelectorTrigger.click();
    await expect(page.locator('#model-selector-panel')).toBeVisible();

    // If the "Add model to conversation" button is present, open it and confirm
    // Provider To Remove is absent from the inactive-models menu.
    const addModelBtnAfter = page.getByRole('button', { name: 'Add model to conversation' });
    if (await addModelBtnAfter.isVisible()) {
      await addModelBtnAfter.click();
      const menuAfter = page.getByRole('menu', { name: 'Available models' });
      if (await menuAfter.isVisible()) {
        await expect(menuAfter.getByText('Provider To Remove')).not.toBeVisible();
      }
    }
    // If the "Add model" button is absent, there are no inactive models —
    // Provider To Remove is gone entirely, which also satisfies the assertion.
  });
});

// ─── Layout overflow test ─────────────────────────────────────────────────────

test.describe('layout — no horizontal overflow with provider panel open', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    // Seed several providers via addInitScript so they are in storage at load.
    await page.addInitScript(({ rosterKey }) => {
      const roster = [
        { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
        { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
        { kind: 'builtin', modelId: 'gemini', credentialKey: 'google', isVisible: true },
        {
          kind: 'custom',
          id: 'custom-overflow-test',
          displayName: 'Overflow Test Provider',
          endpointUrl: 'https://overflow.example.com/v1',
          modelString: 'overflow-model:latest',
          credentialKey: 'custom:custom-overflow-test',
          isVisible: true,
        },
      ];
      localStorage.setItem(rosterKey, JSON.stringify(roster));
    }, { rosterKey: ROSTER_KEY });

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });
  });

  test('provider settings panel does not cause horizontal overflow at 1280×800', async ({ page }) => {
    await openProviderPanel(page);

    // Allow the slide-in animation to complete.
    await page.waitForTimeout(400);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);
  });
});
