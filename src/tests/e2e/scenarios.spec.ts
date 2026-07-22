/**
 * Roundtable scenario tests — issue #530 acceptance criteria.
 *
 * PREREQUISITE: The dev server must be running before executing these tests.
 *   npm run dev          (in one terminal)
 *   npm run test:e2e     (in another terminal)
 *
 * Five scenarios:
 *   1. Copy button dropdown renders outside bubble (no overflow:hidden clipping)
 *   2. Markdown table alternating row shading applies
 *   3. Model selector first-load state (seeded roster / empty roster)
 *   4. Error bubbles appear on failed model requests (via page.route() interception)
 *   5. Empty state recovery affordance renders and activates model selector
 *
 * Implementation notes:
 *   - Conversations are seeded via addInitScript (before page load) using the
 *     StoredConversation envelope format: { schemaVersion: 1, data: Conversation }.
 *   - Storage key layout (from LocalStorageProvider.ts):
 *       roundtable:index         → JSON string[] of conversation IDs
 *       roundtable:conv:{id}     → JSON StoredConversation envelope
 *       roundtable:provider-roster → JSON array of RosterEntry objects
 *   - All tests require no real API keys and make no live provider requests.
 *     Scenario 4 uses page.route() to intercept and short-circuit the request.
 */

import { test, expect } from '@playwright/test';

// ─── Storage key constants ────────────────────────────────────────────────────

const ROSTER_KEY = 'roundtable:provider-roster';
const INDEX_KEY  = 'roundtable:index';

function convKey(id: string) {
  return `roundtable:conv:${id}`;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Page = import('@playwright/test').Page;

/**
 * Seed a minimal roster (Claude built-in) before page load.
 * Re-uses the same pattern as smoke.spec.ts seedMinimalRoster.
 */
async function seedMinimalRoster(page: Page) {
  await page.addInitScript(({ rosterKey }) => {
    const roster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];
    localStorage.setItem(rosterKey, JSON.stringify(roster));
  }, { rosterKey: ROSTER_KEY });
}

/**
 * Seed a single completed assistant conversation message into localStorage
 * before page load. The content is the caller-supplied markdown string.
 *
 * Writes the StoredConversation envelope (schemaVersion: 1, data: Conversation)
 * so the read path (LocalStorageProvider.parseStoredConversation) accepts it.
 *
 * The index key is also written so listConversations() finds the conversation.
 */
async function seedConversationWithMessage(
  page: Page,
  opts: {
    conversationId: string;
    userContent: string;
    assistantContent: string;
  }
) {
  await page.addInitScript(
    ({ indexKey, convKeyName, conversationId, userContent, assistantContent }) => {
      const now = Date.now();

      const conversation = {
        id: conversationId,
        title: 'Test conversation',
        messages: [
          {
            id: `${conversationId}-u1`,
            role: 'user' as const,
            content: userContent,
            timestamp: now - 2000,
          },
          {
            id: `${conversationId}-a1`,
            role: 'assistant' as const,
            content: assistantContent,
            modelId: 'claude',
            timestamp: now - 1000,
          },
        ],
        createdAt: now - 3000,
        updatedAt: now - 1000,
      };

      // StoredConversation envelope (schemaVersion 1 = CURRENT_SCHEMA_VERSION)
      const envelope = { schemaVersion: 1, data: conversation };

      localStorage.setItem(indexKey, JSON.stringify([conversationId]));
      localStorage.setItem(convKeyName, JSON.stringify(envelope));
    },
    {
      indexKey: INDEX_KEY,
      convKeyName: convKey(opts.conversationId),
      conversationId: opts.conversationId,
      userContent: opts.userContent,
      assistantContent: opts.assistantContent,
    }
  );
}

// ─── Scenario 1: Copy button dropdown renders outside bubble ──────────────────

test.describe('scenario 1 — copy button dropdown is not clipped by bubble overflow:hidden', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('copy dropdown renders outside bubble overflow boundary and is fully visible', async ({ page }) => {
    // Seed a roster and a completed conversation message so the copy button appears.
    await seedMinimalRoster(page);
    await seedConversationWithMessage(page, {
      conversationId: 'test-copy-overflow',
      userContent: 'Hello',
      assistantContent: 'This is a test response for the copy button test.',
    });

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // Wait for the message thread to render the seeded assistant bubble.
    await page.waitForSelector('.bubble-entering', { timeout: 5000 });

    // Hover over the assistant bubble to reveal the copy button.
    const assistantBubble = page.locator('.bubble-entering').filter({ hasText: 'This is a test response' });
    await assistantBubble.hover();

    // The chevron button ("More copy options") opens the dropdown portal.
    const chevronButton = assistantBubble.getByRole('button', { name: 'More copy options' });
    await expect(chevronButton).toBeVisible({ timeout: 3000 });
    await chevronButton.click();

    // The dropdown is rendered via createPortal into document.body — it has
    // aria-label="Copy options". We must find it outside the bubble's DOM subtree.
    const dropdown = page.locator('[aria-label="Copy options"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Verify the dropdown is within the visible viewport bounds.
    // A clipped dropdown would have rect dimensions of 0 or be off-screen.
    const dropdownRect = await dropdown.boundingBox();
    expect(
      dropdownRect,
      'Scenario 1 — Copy dropdown bounding box should not be null (element must be painted)'
    ).not.toBeNull();

    if (dropdownRect) {
      expect(
        dropdownRect.width,
        'Scenario 1 — Copy dropdown must have positive width (not clipped to 0)'
      ).toBeGreaterThan(0);

      expect(
        dropdownRect.height,
        'Scenario 1 — Copy dropdown must have positive height (not clipped to 0)'
      ).toBeGreaterThan(0);

      // The dropdown must be fully within the viewport (not clipped off-screen).
      expect(
        dropdownRect.x,
        'Scenario 1 — Copy dropdown left edge must be within viewport'
      ).toBeGreaterThanOrEqual(0);

      expect(
        dropdownRect.y,
        'Scenario 1 — Copy dropdown top edge must be within viewport'
      ).toBeGreaterThanOrEqual(0);

      expect(
        dropdownRect.x + dropdownRect.width,
        'Scenario 1 — Copy dropdown right edge must be within viewport width'
      ).toBeLessThanOrEqual(1280);
    }

    // Both dropdown items must be visible and accessible.
    await expect(dropdown.getByText('Copy as markdown')).toBeVisible();
    await expect(dropdown.getByText('Copy as plain text')).toBeVisible();
  });
});

// ─── Scenario 2: Markdown table alternating row shading ───────────────────────

test.describe('scenario 2 — markdown table alternating row shading applies', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Markdown table content (GFM format). remark-gfm renders this as a proper
  // HTML table via the MarkdownContent component in completed assistant bubbles.
  const TABLE_MARKDOWN = `
| Name   | Role      | Level  |
|--------|-----------|--------|
| Alice  | Engineer  | Senior |
| Bob    | Designer  | Mid    |
| Carol  | PM        | Lead   |
| Dave   | QA        | Junior |
`.trim();

  test('even and odd tbody rows have different background colors', async ({ page }) => {
    await seedMinimalRoster(page);
    await seedConversationWithMessage(page, {
      conversationId: 'test-table-shading',
      userContent: 'Show me a table',
      assistantContent: TABLE_MARKDOWN,
    });

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // Wait for the message thread to render — the table element is the signal.
    await page.waitForSelector('.markdown-table', { timeout: 8000 });

    // The table has 4 data rows (Alice, Bob, Carol, Dave) in tbody.
    // Even rows (2nd, 4th — "Bob", "Dave") receive background-color from the CSS rule:
    //   .markdown-table tbody tr:nth-child(even) { background-color: var(--border-subtle); }
    // Odd rows (1st, 3rd — "Alice", "Carol") receive no background-color (inherits transparent).

    const allRows = page.locator('.markdown-table tbody tr');
    await expect(allRows).toHaveCount(4, { timeout: 5000 });

    // Compute background colors for odd rows (1st, 3rd = index 0, 2)
    // and even rows (2nd, 4th = index 1, 3).
    const oddRowBg = await page.evaluate(() => {
      const rows = document.querySelectorAll('.markdown-table tbody tr');
      if (rows.length === 0) return null;
      return window.getComputedStyle(rows[0]).backgroundColor;
    });

    const evenRowBg = await page.evaluate(() => {
      const rows = document.querySelectorAll('.markdown-table tbody tr');
      if (rows.length < 2) return null;
      return window.getComputedStyle(rows[1]).backgroundColor;
    });

    expect(
      oddRowBg,
      'Scenario 2 — odd row background color must be readable (not null)'
    ).not.toBeNull();

    expect(
      evenRowBg,
      'Scenario 2 — even row background color must be readable (not null)'
    ).not.toBeNull();

    expect(
      oddRowBg,
      'Scenario 2 — odd and even tbody rows must have different background colors (alternating shading)'
    ).not.toBe(evenRowBg);

    // Verify all 4 rows rendered with expected text (table parsed correctly).
    await expect(allRows.nth(0)).toContainText('Alice');
    await expect(allRows.nth(1)).toContainText('Bob');
    await expect(allRows.nth(2)).toContainText('Carol');
    await expect(allRows.nth(3)).toContainText('Dave');
  });
});

// ─── Scenario 3: Model selector first-load state ─────────────────────────────

test.describe('scenario 3 — model selector first-load state', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('seeded roster → model selector chip shows active model count', async ({ page }) => {
    // Seed a roster with one visible provider so the real trigger chip renders.
    await seedMinimalRoster(page);

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // The model selector trigger is a button with aria-controls="model-selector-panel".
    // With models in the roster, this chip shows the model count ("1 model", etc.)
    // rather than the empty-roster "Add providers" fallback.
    const trigger = page.locator('button[aria-controls="model-selector-panel"]');
    await expect(
      trigger,
      'Scenario 3a — with a seeded roster, the model selector chip must be visible'
    ).toBeVisible();

    // The chip is clickable and toggles aria-expanded.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(
      trigger,
      'Scenario 3a — chip must open the panel when clicked (aria-expanded → true)'
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('empty roster → add-providers affordance is present', async ({ page }) => {
    // No roster seeded — localStorage starts empty (no addInitScript call for roster).
    // The OnboardingEmptyState renders when isRosterEmpty is true.
    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // When the roster is empty, AppLayout shows OnboardingEmptyState which contains
    // an "Add your first provider" button. The model selector trigger chip still
    // renders (with aria-controls="model-selector-panel") as the empty-roster
    // fallback, per Aria's #106 fix.
    const addFirstProvider = page.getByRole('button', { name: 'Add your first provider' });
    await expect(
      addFirstProvider,
      'Scenario 3b — with no roster, the empty-roster CTA "Add your first provider" must be visible'
    ).toBeVisible();

    // The region label confirms we are in the OnboardingEmptyState.
    const onboardingRegion = page.getByRole('region', { name: 'Welcome to Roundtable' });
    await expect(
      onboardingRegion,
      'Scenario 3b — OnboardingEmptyState region must be present when roster is empty'
    ).toBeVisible();
  });
});

// ─── Scenario 4: Error bubbles on failed model requests ──────────────────────

test.describe('scenario 4 — error bubbles appear on failed model requests', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('intercepted 500 from provider API → error bubble appears in thread', async ({ page }) => {
    // Seed a roster with Claude so the model is active in the conversation.
    // Also seed a credential so the send flow doesn't bail out before fetching.
    await page.addInitScript(({ rosterKey, credKey }) => {
      const roster = [
        { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      ];
      localStorage.setItem(rosterKey, JSON.stringify(roster));
      // Seed a fake API key so the send flow proceeds to the network layer.
      localStorage.setItem(credKey, 'sk-ant-e2e-test-key');
    }, { rosterKey: ROSTER_KEY, credKey: 'roundtable:key:anthropic' });

    // Intercept all requests to the Anthropic API and return a 500 error.
    // The Claude model provider fetches https://api.anthropic.com/v1/messages.
    // We intercept the pattern to catch both direct and proxied paths.
    await page.route('**/v1/messages', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { type: 'server_error', message: 'Internal server error' } }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // Type a message and send it.
    const messageInput = page.getByRole('textbox', { name: 'Message input' });
    await messageInput.fill('Hello, this message should error');
    await page.getByRole('button', { name: 'Send message' }).click();

    // An error bubble must appear. The error path renders a div[role="alert"]
    // inside the assistant bubble body zone (MessageBubble.tsx line ~1318).
    // We wait up to 10 seconds for the network round-trip + streaming error.
    await expect(
      page.locator('[role="alert"]'),
      'Scenario 4 — a role="alert" error element must appear in the thread after a 500 response'
    ).toBeVisible({ timeout: 10000 });

    // The error detail text appears inside the alert.
    const alert = page.locator('[role="alert"]').first();
    await expect(
      alert,
      'Scenario 4 — the error alert must contain "Error:" prefix text from MessageBubble error rendering'
    ).toContainText('Error:');
  });
});

// ─── Scenario 5: Empty state recovery affordance ──────────────────────────────

test.describe('scenario 5 — empty state recovery affordance renders and activates model selector', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no messages + no active models → "Add a model to get started" button present and opens model selector', async ({ page }) => {
    // Seed a provider that is in the roster but marked isVisible: false so it
    // does not auto-activate in the conversation. This produces ConversationEmptyState
    // State A ("No models active") instead of the OnboardingEmptyState.
    await page.addInitScript(({ rosterKey }) => {
      // A provider with isVisible: false — in the roster but not active in conversations.
      const roster = [
        { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: false },
      ];
      localStorage.setItem(rosterKey, JSON.stringify(roster));
    }, { rosterKey: ROSTER_KEY });

    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // With a non-empty roster and no active models in the conversation, we expect
    // ConversationEmptyState State A: a region labeled "New conversation" containing
    // "No models active" and an "Add a model to get started" button.
    const newConvRegion = page.getByRole('region', { name: 'New conversation' });
    await expect(
      newConvRegion,
      'Scenario 5 — ConversationEmptyState region ("New conversation") must be visible when roster is non-empty but no models are active'
    ).toBeVisible({ timeout: 5000 });

    const addModelButton = newConvRegion.getByRole('button', { name: 'Add a model to get started' });
    await expect(
      addModelButton,
      'Scenario 5 — "Add a model to get started" recovery affordance button must be visible in State A empty state'
    ).toBeVisible();

    // Clicking the button should open the model selector panel.
    await addModelButton.click();

    // The model selector panel opens (aria-expanded on the trigger becomes true,
    // or the panel itself becomes visible).
    const modelSelectorPanel = page.locator('#model-selector-panel');
    await expect(
      modelSelectorPanel,
      'Scenario 5 — clicking "Add a model to get started" must open the model selector panel'
    ).toBeVisible({ timeout: 3000 });
  });

  test('no messages + no models at all → OnboardingEmptyState shows "Add your first provider"', async ({ page }) => {
    // Completely empty localStorage — OnboardingEmptyState renders for the no-roster case.
    // (ConversationEmptyState only renders when the roster is non-empty.)
    await page.goto('/');
    await page.waitForSelector('[role="img"][aria-label="Roundtable"]', { timeout: 10000 });

    // OnboardingEmptyState renders when isRosterEmpty is true.
    const welcomeRegion = page.getByRole('region', { name: 'Welcome to Roundtable' });
    await expect(
      welcomeRegion,
      'Scenario 5b — with completely empty storage, the welcome onboarding screen must appear'
    ).toBeVisible();

    // The primary CTA button opens the provider settings panel.
    const ctaButton = welcomeRegion.getByRole('button', { name: 'Add your first provider' });
    await expect(ctaButton).toBeVisible();

    // Click it — the ProviderSettingsPanel should open.
    await ctaButton.click();
    await expect(
      page.getByRole('heading', { name: 'My Providers' }),
      'Scenario 5b — clicking "Add your first provider" must open the provider settings panel'
    ).toBeVisible({ timeout: 3000 });
  });
});
