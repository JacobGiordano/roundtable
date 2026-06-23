/**
 * Live browser keyboard focus-trap audit — Issue #180
 *
 * Purpose: jsdom does not simulate real browser Tab traversal. These Playwright
 * tests drive Chromium with real keyboard events to verify that each focus-trapped
 * component actually confines Tab within its boundary and correctly exits on Escape.
 *
 * jsdom limitation context: The existing Vitest keyboard tests in
 *   src/tests/a11y/keyboard/ dispatch synthetic KeyboardEvents and manually call
 *   .focus() to simulate Tab. That catches structural bugs (wrong selector, missing
 *   listener) but cannot catch cases where the browser's native focus algorithm
 *   escapes the trap before the JavaScript handler fires, or where tabIndex
 *   attributes do not correctly influence native focus order.
 *
 * Components audited:
 *   1. AccentColorPicker — dialog popover above a Model Identity Pill
 *   2. ProviderSettingsPanel — slide-in drawer with inert + focus trap
 *   3. ThreadActionMenu — menu + sub-states (group-input, rename, confirm-delete)
 *   4. ModelSelectorPanel — supplemental browser verification of jsdom-tested trap
 *
 * WCAG criteria verified:
 *   2.1.1 Keyboard (A) — all functionality operable via keyboard alone
 *   2.1.2 No Keyboard Trap (A) — Escape must exit any focus-trapped component
 *   2.4.3 Focus Order (AA) — focus goes to logical place on open and on close
 *
 * Browser: Chromium (via Playwright). Firefox not available in this container
 *   (playwright.download.prss.microsoft.com is not on the container firewall
 *   allowlist — see playwright.config.ts comment).
 *
 * Dev server prerequisite: npm run dev must be running at http://localhost:5173
 *
 * Run: npx playwright test --config playwright.a11y.config.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Storage key constants (mirror /src/auth) ─────────────────────────────────

const ROSTER_KEY = 'roundtable:provider-roster';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seed a minimal single-provider roster so the real trigger chip renders. */
async function seedMinimalRoster(page: Page) {
  await page.addInitScript(({ rosterKey }) => {
    const roster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];
    localStorage.setItem(rosterKey, JSON.stringify(roster));
  }, { rosterKey: ROSTER_KEY });
}

/** Navigate to the app and wait for it to be fully loaded. */
async function loadApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10_000 });
}

/** Open the ModelSelectorPanel by clicking its trigger chip. */
async function openModelSelectorPanel(page: Page) {
  const trigger = page.locator('button[aria-controls="model-selector-panel"]');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(100); // Allow panel animation
}

/**
 * Activate Claude in the MSP so that ModelPill renders.
 * Claude starts inactive — activate via the "Add model" dropdown.
 * Precondition: MSP must already be open.
 */
async function activateClaudeInMSP(page: Page) {
  const addModelBtn = page.getByRole('button', { name: 'Add model to conversation' });
  await addModelBtn.click();
  await page.waitForTimeout(100);
  const claudeItem = page.getByRole('menuitem', { name: /claude/i }).first();
  await expect(claudeItem).toBeVisible({ timeout: 2000 });
  await claudeItem.click();
  await page.waitForTimeout(200);
}

/** Open the AccentColorPicker for Claude. */
async function openAccentColorPicker(page: Page) {
  await openModelSelectorPanel(page);
  await activateClaudeInMSP(page);
  // The palette button aria-label is "Customize accent color for {model.name}"
  const paletteBtn = page.getByRole('button', { name: /customize accent color for claude/i });
  await expect(paletteBtn).toBeVisible({ timeout: 2000 });
  await paletteBtn.click();
  await expect(page.getByRole('dialog', { name: /accent color picker/i })).toBeVisible();
}

/**
 * Count focusable elements within a container (excluding aria-hidden and inert subtrees).
 * Mirrors the selector used in the component focus trap implementations.
 */
async function getFocusableCount(page: Page, containerSelector: string): Promise<number> {
  return page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return 0;
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('[aria-hidden="true"]') && !el.closest('[inert]')).length;
  }, containerSelector);
}

// ─── AccentColorPicker focus-trap tests ──────────────────────────────────────

test.describe('AccentColorPicker — real browser focus trap (WCAG 2.1.2, #180)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedMinimalRoster(page);
    await loadApp(page);
  });

  test('dialog contains at least one focusable element on open', async ({ page }) => {
    await openAccentColorPicker(page);
    const count = await getFocusableCount(page, '[role="dialog"][aria-label*="Accent color picker"]');
    expect(count, 'AccentColorPicker dialog should have at least one focusable element').toBeGreaterThan(0);
  });

  test('focus lands inside the dialog on open (WCAG 2.4.3 — initial focus)', async ({ page }) => {
    await openAccentColorPicker(page);
    // AccentColorPicker calls useLayoutEffect → focus() on mount
    const isInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label*="Accent color picker"]');
      const active = document.activeElement;
      return dialog ? dialog.contains(active) : false;
    });
    expect(isInsideDialog, 'focus should land inside AccentColorPicker dialog on open').toBe(true);
  });

  test('Tab key cycles through all elements without escaping the dialog — fixed in #262', async ({ page }) => {
    // Fix (#262): AccentColorPicker now uses a document capture-phase keydown listener
    // that calls stopPropagation() on all Tab presses while focus is inside the dialog.
    // This prevents ModelSelectorPanel's bubble-phase document listener from intercepting
    // Tab and redirecting focus to MSP's first element.
    await openAccentColorPicker(page);

    const dialogSelector = '[role="dialog"][aria-label*="Accent color picker"]';
    const focusableCount = await getFocusableCount(page, dialogSelector);
    expect(focusableCount, 'AccentColorPicker dialog should have focusable elements').toBeGreaterThan(0);

    // Tab through all elements plus one extra wrap-around
    for (let i = 0; i < focusableCount + 1; i++) {
      await page.keyboard.press('Tab');
      const isInsideDialog = await page.evaluate((sel) => {
        const dialog = document.querySelector(sel);
        const active = document.activeElement;
        return dialog ? dialog.contains(active) : false;
      }, dialogSelector);
      expect(isInsideDialog, `Tab press ${i + 1} moved focus outside AccentColorPicker dialog`).toBe(true);
    }
  });

  test('Shift+Tab from first focusable element wraps to last (no escape) — fixed in #262', async ({ page }) => {
    // Fix (#262): same capture-phase listener fix. Shift+Tab from the first element
    // now wraps to last within the dialog rather than escaping to MSP.
    await openAccentColorPicker(page);

    const dialogSelector = '[role="dialog"][aria-label*="Accent color picker"]';

    // Focus the first focusable element in the dialog
    await page.evaluate((sel) => {
      const dialog = document.querySelector(sel);
      if (!dialog) return;
      const first = dialog.querySelector<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])',
      );
      first?.focus();
    }, dialogSelector);

    await page.keyboard.press('Shift+Tab');

    const isInsideDialog = await page.evaluate((sel) => {
      const dialog = document.querySelector(sel);
      const active = document.activeElement;
      return dialog ? dialog.contains(active) : false;
    }, dialogSelector);
    expect(isInsideDialog, 'Shift+Tab from first element should wrap to last, not escape dialog').toBe(true);
  });

  test('Escape key closes the dialog (WCAG 2.1.2)', async ({ page }) => {
    await openAccentColorPicker(page);
    await expect(page.getByRole('dialog', { name: /accent color picker/i })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog', { name: /accent color picker/i })).not.toBeVisible({ timeout: 1000 });
  });

  test('focus after Escape does not land on document.body (WCAG 2.4.3)', async ({ page }) => {
    await openAccentColorPicker(page);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150); // Allow rAF after close

    const focusTarget = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName ?? 'none',
        ariaLabel: (active as HTMLElement)?.getAttribute('aria-label') ?? '',
        isBody: active === document.body || active === document.documentElement,
      };
    });

    // AccentColorPicker's onClose is provided by ModelSelectorPanel; it restores
    // focus to the palette button that triggered the picker.
    expect(
      focusTarget.isBody,
      `focus landed on ${focusTarget.tag}[${focusTarget.ariaLabel}] (body/html) after AccentColorPicker Escape — WCAG 2.4.3 requires focus return to trigger`
    ).toBe(false);
  });
});

// ─── ProviderSettingsPanel focus-trap tests ───────────────────────────────────
//
// The PSP drawer uses role="dialog" aria-labelledby="psp-heading" (not aria-label).
// Selector: [role="dialog"][aria-labelledby="psp-heading"]

test.describe('ProviderSettingsPanel — real browser focus trap (WCAG 2.1.2, #180)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // PSP drawer selector — matches the fixed-position drawer (not any other dialog).
  const PSP_SELECTOR = '[role="dialog"][aria-labelledby="psp-heading"]';

  test.beforeEach(async ({ page }) => {
    await seedMinimalRoster(page);
    await loadApp(page);
  });

  test('focus lands on close button when panel opens (WCAG 2.4.3)', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();

    // Panel focuses the close button on open via requestAnimationFrame
    await page.waitForTimeout(150);

    const activeLabel = await page.evaluate(() => {
      return (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? '';
    });
    expect(activeLabel).toBe('Close provider settings');
  });

  test('Tab key stays within the drawer after full cycle + wrap', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();
    await page.waitForTimeout(150);

    const focusableCount = await getFocusableCount(page, PSP_SELECTOR);
    expect(focusableCount, 'PSP drawer should have focusable elements').toBeGreaterThan(0);

    // Tab through all elements plus two extra to verify wrap
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Tab');
      const isInsideDrawer = await page.evaluate((sel) => {
        const drawer = document.querySelector(sel);
        const active = document.activeElement;
        return drawer ? drawer.contains(active) : false;
      }, PSP_SELECTOR);
      expect(isInsideDrawer, `Tab press ${i + 1} moved focus outside ProviderSettingsPanel drawer`).toBe(true);
    }
  });

  test('Shift+Tab from first focusable wraps to last — no escape to main content', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();
    await page.waitForTimeout(150);

    // Move to the first focusable element
    await page.evaluate((sel) => {
      const drawer = document.querySelector(sel);
      if (!drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])',
        ),
      ).filter((el) => !el.closest('[aria-hidden="true"]'));
      focusables[0]?.focus();
    }, PSP_SELECTOR);

    await page.keyboard.press('Shift+Tab');

    const isInsideDrawer = await page.evaluate((sel) => {
      const drawer = document.querySelector(sel);
      const active = document.activeElement;
      return drawer ? drawer.contains(active) : false;
    }, PSP_SELECTOR);
    expect(isInsideDrawer, 'Shift+Tab from first element should wrap to last, not escape PSP drawer').toBe(true);
  });

  test('Escape key closes the panel (WCAG 2.1.2)', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('heading', { name: 'My Providers' })).not.toBeVisible({ timeout: 2000 });
  });

  test('focus returns to gear trigger after Escape (WCAG 2.4.3)', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'My Providers' })).not.toBeVisible({ timeout: 2000 });

    await page.waitForTimeout(150);
    const isFocusedOnGear = await gearBtn.evaluate((el) => el === document.activeElement);
    expect(isFocusedOnGear, 'focus should return to gear trigger after ProviderSettingsPanel Escape').toBe(true);
  });

  test('focus returns to gear trigger after clicking the Close button (WCAG 2.4.3)', async ({ page }) => {
    const gearBtn = page.getByRole('button', { name: 'Provider settings', exact: true });
    await gearBtn.click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).toBeVisible();

    await page.getByRole('button', { name: 'Close provider settings' }).click();
    await expect(page.getByRole('heading', { name: 'My Providers' })).not.toBeVisible({ timeout: 2000 });

    await page.waitForTimeout(150);
    const isFocusedOnGear = await gearBtn.evaluate((el) => el === document.activeElement);
    expect(isFocusedOnGear, 'focus should return to gear trigger after ProviderSettingsPanel Close button').toBe(true);
  });
});

// ─── ThreadActionMenu focus-trap tests ───────────────────────────────────────
//
// Thread rows are <li> elements inside the sidebar's <aside>.
// Hover over a <li> to reveal the "Conversation actions" button (three-dot menu).

test.describe('ThreadActionMenu — real browser focus trap (WCAG 2.1.2, #180)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedMinimalRoster(page);
    await loadApp(page);
    // Create a conversation so a thread row exists in the sidebar
    await page.getByRole('button', { name: 'New conversation' }).first().click();
    await page.waitForTimeout(300);
  });

  /** Hover over the first thread row and click the three-dot actions button. */
  async function openActionsMenu(page: Page): Promise<void> {
    // Thread rows are <li> elements in the sidebar <aside>
    const threadRow = page.locator('aside li').first();
    await expect(threadRow).toBeVisible({ timeout: 3000 });
    await threadRow.hover();
    const actionsBtn = page.getByRole('button', { name: 'Conversation actions' }).first();
    await expect(actionsBtn).toBeVisible({ timeout: 2000 });
    await actionsBtn.click();
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 2000 });
  }

  test('menu is present and contains keyboard-navigable menu items', async ({ page }) => {
    await openActionsMenu(page);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const items = page.getByRole('menuitem');
    await expect(items.first()).toBeVisible();
  });

  test('Escape key closes the menu (WCAG 2.1.2)', async ({ page }) => {
    await openActionsMenu(page);
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).not.toBeVisible({ timeout: 1000 });
  });

  test('focus returns to the actions trigger after Escape (WCAG 2.4.3)', async ({ page }) => {
    const threadRow = page.locator('aside li').first();
    await expect(threadRow).toBeVisible({ timeout: 3000 });
    await threadRow.hover();
    const actionsBtn = page.getByRole('button', { name: 'Conversation actions' }).first();
    await expect(actionsBtn).toBeVisible({ timeout: 2000 });
    await actionsBtn.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible({ timeout: 1000 });

    // Allow double-rAF to fire for focus restoration
    await page.waitForTimeout(150);
    const isFocusedOnTrigger = await actionsBtn.evaluate((el) => el === document.activeElement);
    expect(isFocusedOnTrigger, 'focus should return to actions trigger after ThreadActionMenu Escape').toBe(true);
  });

  test('rename sub-state: Tab stays within sub-state panel (WCAG 2.1.2)', async ({ page }) => {
    await openActionsMenu(page);

    await page.getByRole('menuitem', { name: /rename/i }).click();
    await expect(page.locator('[data-substate]')).toBeVisible({ timeout: 2000 });

    // Tab 5 times — must remain within [data-substate]
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const isInsideSubstate = await page.evaluate(() => {
        const panel = document.querySelector('[data-substate]');
        const active = document.activeElement;
        return panel ? panel.contains(active) : false;
      });
      expect(isInsideSubstate, `Tab press ${i + 1} moved focus outside rename sub-state`).toBe(true);
    }
  });

  test('rename sub-state: Escape closes menu and returns focus to trigger (WCAG 2.1.2, 2.4.3)', async ({ page }) => {
    const threadRow = page.locator('aside li').first();
    await expect(threadRow).toBeVisible({ timeout: 3000 });
    await threadRow.hover();
    const actionsBtn = page.getByRole('button', { name: 'Conversation actions' }).first();
    await expect(actionsBtn).toBeVisible({ timeout: 2000 });
    await actionsBtn.click();

    await page.getByRole('menuitem', { name: /rename/i }).click();
    await expect(page.locator('[data-substate]')).toBeVisible();

    await page.keyboard.press('Escape');

    // Full menu must be closed (not just sub-state)
    await expect(page.getByRole('menu')).not.toBeVisible({ timeout: 1000 });

    // Focus returns to trigger via double-rAF
    await page.waitForTimeout(150);
    const isFocusedOnTrigger = await actionsBtn.evaluate((el) => el === document.activeElement);
    expect(isFocusedOnTrigger, 'focus should return to actions trigger after rename sub-state Escape').toBe(true);
  });

  test('group-input sub-state: Tab stays within sub-state panel (WCAG 2.1.2)', async ({ page }) => {
    await openActionsMenu(page);

    await page.getByRole('menuitem', { name: /move to group/i }).click();
    await expect(page.locator('[data-substate]')).toBeVisible({ timeout: 2000 });

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const isInsideSubstate = await page.evaluate(() => {
        const panel = document.querySelector('[data-substate]');
        const active = document.activeElement;
        return panel ? panel.contains(active) : false;
      });
      expect(isInsideSubstate, `Tab press ${i + 1} moved focus outside group-input sub-state`).toBe(true);
    }
  });
});

// ─── ModelSelectorPanel focus-trap browser verification ──────────────────────
//
// The MSP focus trap was previously tested with jsdom synthetic events.
// These tests verify it holds against real Chromium Tab events.

test.describe('ModelSelectorPanel — real browser Tab containment (WCAG 2.1.2, #180)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedMinimalRoster(page);
    await loadApp(page);
  });

  test('Tab stays within panel for full cycle plus wrap', async ({ page }) => {
    await openModelSelectorPanel(page);

    const panelSelector = '#model-selector-panel';
    const focusableCount = await getFocusableCount(page, panelSelector);

    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Tab');
      const isInsidePanel = await page.evaluate((sel) => {
        const panel = document.querySelector(sel);
        const active = document.activeElement;
        return panel ? panel.contains(active) : false;
      }, panelSelector);
      expect(isInsidePanel, `Tab press ${i + 1} moved focus outside ModelSelectorPanel`).toBe(true);
    }
  });

  test('Escape key closes the panel (WCAG 2.1.2)', async ({ page }) => {
    const trigger = page.locator('button[aria-controls="model-selector-panel"]').first();
    await openModelSelectorPanel(page);

    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false', { timeout: 1000 });
  });

  test('focus returns to trigger chip after Escape (WCAG 2.4.3)', async ({ page }) => {
    const trigger = page.locator('button[aria-controls="model-selector-panel"]').first();
    await openModelSelectorPanel(page);

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false', { timeout: 1000 });

    await page.waitForTimeout(150);
    const isFocusedOnTrigger = await trigger.evaluate((el) => el === document.activeElement);
    expect(isFocusedOnTrigger, 'focus should return to MSP trigger chip after Escape').toBe(true);
  });
});
