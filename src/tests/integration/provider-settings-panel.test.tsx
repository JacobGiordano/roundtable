/**
 * Integration: ProviderSettingsPanel — credential editor and form validation
 *
 * Issue #104: Test coverage for two untested Phase 4 areas:
 *   1. ProviderRow credential editor state machine (badge state, open/save/clear/cancel)
 *   2. validateForm via the AddCustomForm UI (required-field and URL-format errors)
 *
 * Cross-agent contract exercised:
 *   ProviderSettingsPanel (Aria) → @/auth credential helpers (Gate)
 *   ProviderConfig types (Arch) → rendered badge and edit affordances
 *
 * Mock strategy:
 *   - @/auth: vi.mock() — all Gate persistence functions are mocked so no real
 *     localStorage is touched. hasCredential is the key mock: it controls badge
 *     state at render time and after save/clear.
 *   - window.requestAnimationFrame: replaced with a synchronous stub so focus
 *     side-effects complete without RAF scheduling in jsdom.
 *
 * Timer strategy: no fake timers. The remove-animation setTimeout (200ms) is not
 * exercised here — those paths are inside the remove-confirm flow, not the key
 * editor. If a future test needs it, use fireEvent + vi.advanceTimersByTime().
 *
 * Note on userEvent: NOT used here. userEvent v14 uses setTimeout internally
 * and deadlocks against vi.useFakeTimers(). All DOM interactions use fireEvent
 * (synchronous), which is sufficient for these state-machine tests.
 *
 * Note on matchers: this project does NOT install @testing-library/jest-dom,
 * so we use Vitest-native assertions only. Pattern:
 *   "element exists"     → screen.getBy...() (throws if absent — presence IS the assertion)
 *   "element absent"     → expect(screen.queryBy...()).toBeNull()
 *   "button disabled"    → expect((btn as HTMLButtonElement).disabled).toBe(true)
 *   "button text"        → expect(btn.textContent).toContain('...')
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Module mocks (hoisted before any import that would consume @/auth) ────────

vi.mock('@/auth', () => ({
  getProviderRoster: vi.fn(),
  addBuiltInProvider: vi.fn(),
  addCustomProvider: vi.fn(),
  removeProvider: vi.fn(),
  hasCredential: vi.fn(),
  saveCredentials: vi.fn(),
  clearCredentials: vi.fn(),
  // #151: BUILTIN_MODEL_IDS now consumed by ProviderSettingsPanel — include in mock
  // so the component can call [...BUILTIN_MODEL_IDS].filter() without error.
  BUILTIN_MODEL_IDS: new Set(['claude', 'gpt-5.5', 'gemini', 'grok', 'deepseek', 'mistral']),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { ProviderSettingsPanel } from '@/ui/ProviderSettingsPanel';
import {
  getProviderRoster,
  addCustomProvider,
  hasCredential,
  saveCredentials,
  clearCredentials,
} from '@/auth';
import type { BuiltInProviderConfig, CustomProviderConfig } from '@/types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal built-in ProviderConfig for a provider whose key IS set. */
const claudeProvider: BuiltInProviderConfig = {
  kind: 'builtin',
  modelId: 'claude',
  credentialKey: 'anthropic',
  isVisible: true,
};

/** Minimal built-in ProviderConfig for a provider whose key is NOT set. */
const gptProvider: BuiltInProviderConfig = {
  kind: 'builtin',
  modelId: 'gpt-5.5',
  credentialKey: 'openai',
  isVisible: true,
};

/** Custom provider with a credentialKey (requires an API key). */
const customWithKey: CustomProviderConfig = {
  kind: 'custom',
  id: 'custom:openrouter-1',
  displayName: 'OpenRouter',
  endpointUrl: 'https://openrouter.ai/api/v1',
  modelString: 'mistralai/mixtral-8x7b-instruct',
  credentialKey: 'custom:custom:openrouter-1',
};

/** Custom provider with NO credentialKey — keyless endpoint (Ollama, LM Studio). */
const keylessProvider: CustomProviderConfig = {
  kind: 'custom',
  id: 'custom:local-llama',
  displayName: 'Local Llama',
  endpointUrl: 'http://localhost:11434/v1',
  modelString: 'llama3',
  credentialKey: undefined,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders ProviderSettingsPanel with isOpen=true and safe prop defaults. */
function renderPanel() {
  const triggerRef = { current: document.createElement('button') };
  const onClose = vi.fn();
  render(
    <ProviderSettingsPanel
      isOpen={true}
      onClose={onClose}
      triggerRef={triggerRef}
    />,
  );
  return { onClose };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

let originalRaf: typeof window.requestAnimationFrame;

beforeEach(() => {
  // Synchronous RAF stub — prevents focus effects from deferring past the test.
  originalRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };

  // Reset all mocks to a clean baseline before each test.
  vi.mocked(getProviderRoster).mockReturnValue([]);
  vi.mocked(hasCredential).mockReturnValue(false);
  vi.mocked(saveCredentials).mockReset();
  vi.mocked(clearCredentials).mockReset();
  vi.mocked(addCustomProvider).mockReturnValue({
    kind: 'custom',
    id: 'custom:new-provider',
    displayName: 'New Provider',
    endpointUrl: 'https://example.com/v1',
    modelString: 'gpt-4',
    credentialKey: 'custom:custom:new-provider',
  });
});

afterEach(() => {
  window.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks();
});

// ─── Badge state tests ────────────────────────────────────────────────────────

describe('ProviderRow — badge state', () => {
  it('shows "Key set" badge when hasCredential returns true for a built-in provider', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    // getByText throws if not found — finding it is the assertion.
    screen.getByText('Key set');
  });

  it('shows "No key" badge when hasCredential returns false for a built-in provider', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    screen.getByText('No key');
  });

  it('shows "No key required" badge for a keyless custom provider', () => {
    vi.mocked(getProviderRoster).mockReturnValue([keylessProvider]);

    renderPanel();

    screen.getByText('No key required');
  });

  it('shows NO edit button for a keyless custom provider', () => {
    vi.mocked(getProviderRoster).mockReturnValue([keylessProvider]);

    renderPanel();

    // The edit button aria-label contains "Set API key for" or "Edit API key for".
    expect(screen.queryByLabelText(/Set API key for/i)).toBeNull();
    expect(screen.queryByLabelText(/Edit API key for/i)).toBeNull();
  });
});

// ─── Edit button label tests ──────────────────────────────────────────────────

describe('ProviderRow — edit button label', () => {
  it('button text is "Edit" when badge state is "Key set"', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    const editBtn = screen.getByLabelText('Edit API key for Claude');
    expect(editBtn.textContent).toContain('Edit');
  });

  it('button text is "Set key" when badge state is "No key"', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    const editBtn = screen.getByLabelText('Set API key for GPT-5.5');
    expect(editBtn.textContent).toContain('Set key');
  });
});

// ─── Open → Cancel flow tests ─────────────────────────────────────────────────

describe('ProviderRow — open → cancel flow', () => {
  it('clicking "Set key" reveals the inline editor with a password input', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    const editBtn = screen.getByLabelText('Set API key for GPT-5.5');
    fireEvent.click(editBtn);

    // Input with aria-label "New API key" appears in the editor.
    screen.getByLabelText('New API key');
  });

  it('clicking Cancel closes the editor without calling saveCredentials or clearCredentials', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    // Open the editor.
    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    // Click Cancel.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Editor should be gone.
    expect(screen.queryByLabelText('New API key')).toBeNull();
    expect(saveCredentials).not.toHaveBeenCalled();
    expect(clearCredentials).not.toHaveBeenCalled();
  });
});

// ─── Save flow tests ──────────────────────────────────────────────────────────

describe('ProviderRow — save flow', () => {
  it('Save button is disabled when input is empty', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('typing a value then clicking Save calls saveCredentials with the correct key and value', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    // After save, hasCredential should return true so the badge updates.
    vi.mocked(hasCredential).mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveCredentials).toHaveBeenCalledWith('openai', 'sk-test-key-123');
  });

  it('editor closes after clicking Save', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    vi.mocked(hasCredential).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByLabelText('New API key')).toBeNull();
  });

  it('badge updates to "Key set" after Save', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    // hasCredential must return true BEFORE save fires so getBadgeState
    // re-derives the badge correctly when React re-renders.
    vi.mocked(hasCredential).mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    screen.getByText('Key set');
  });

  it('Save button is enabled after typing and disabled when input is cleared', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    const saveBtn = screen.getByRole('button', { name: 'Save' });

    // Empty — disabled.
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    // Type something — enabled.
    fireEvent.change(input, { target: { value: 'sk-something' } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);

    // Clear it again — disabled.
    fireEvent.change(input, { target: { value: '' } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ─── Clear flow tests ─────────────────────────────────────────────────────────

describe('ProviderRow — clear flow', () => {
  it('"Remove key" button is present when a key is already set', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    // Open the editor.
    fireEvent.click(screen.getByLabelText('Edit API key for Claude'));

    // getByRole throws if not found — finding it is the assertion.
    screen.getByRole('button', { name: 'Remove key' });
  });

  it('"Remove key" button is absent when no key is stored', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    // Open the editor.
    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    expect(screen.queryByRole('button', { name: 'Remove key' })).toBeNull();
  });

  it('clicking "Remove key" calls clearCredentials with the correct credentialKey', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Edit API key for Claude'));

    // Next hasCredential call must return false so badge updates to "No key".
    vi.mocked(hasCredential).mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

    expect(clearCredentials).toHaveBeenCalledWith('anthropic');
  });

  it('editor closes after clicking "Remove key"', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Edit API key for Claude'));

    vi.mocked(hasCredential).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

    expect(screen.queryByLabelText('New API key')).toBeNull();
  });

  it('badge updates to "No key" after "Remove key" is clicked', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Edit API key for Claude'));

    vi.mocked(hasCredential).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

    screen.getByText('No key');
  });
});

// ─── "Remove key" button visibility (direct badgeState discrimination) ────────

describe('ProviderRow — "Remove key" visibility matches badgeState', () => {
  it('badgeState "key-set" → "Remove key" IS shown inside the editor', () => {
    vi.mocked(getProviderRoster).mockReturnValue([claudeProvider]);
    vi.mocked(hasCredential).mockReturnValue(true);

    renderPanel();
    fireEvent.click(screen.getByLabelText('Edit API key for Claude'));

    // getByRole throws if absent — finding it confirms it is rendered.
    screen.getByRole('button', { name: 'Remove key' });
  });

  it('badgeState "no-key" → "Remove key" is NOT shown inside the editor', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();
    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    expect(screen.queryByRole('button', { name: 'Remove key' })).toBeNull();
  });
});

// ─── Keyboard interaction tests ───────────────────────────────────────────────

describe('ProviderRow — keyboard interactions', () => {
  it('Enter key with non-empty input calls saveCredentials', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'sk-enter-test' } });

    vi.mocked(hasCredential).mockReturnValue(true);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(saveCredentials).toHaveBeenCalledWith('openai', 'sk-enter-test');
  });

  it('Enter key with empty input does NOT call saveCredentials', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    // Input is empty — press Enter anyway.
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(saveCredentials).not.toHaveBeenCalled();
  });

  it('Escape key cancels the editor without saving', () => {
    vi.mocked(getProviderRoster).mockReturnValue([gptProvider]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for GPT-5.5'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'partial-key' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByLabelText('New API key')).toBeNull();
    expect(saveCredentials).not.toHaveBeenCalled();
  });
});

// ─── Custom provider credential key tests ────────────────────────────────────

describe('ProviderRow — custom provider with credentialKey', () => {
  it('shows "No key" badge when custom provider has a credentialKey but no credential stored', () => {
    vi.mocked(getProviderRoster).mockReturnValue([customWithKey]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    screen.getByText('No key');
  });

  it('calls saveCredentials with the custom provider credentialKey', () => {
    vi.mocked(getProviderRoster).mockReturnValue([customWithKey]);
    vi.mocked(hasCredential).mockReturnValue(false);

    renderPanel();

    fireEvent.click(screen.getByLabelText('Set API key for OpenRouter'));

    const input = screen.getByLabelText('New API key');
    fireEvent.change(input, { target: { value: 'or-key-abc' } });

    vi.mocked(hasCredential).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveCredentials).toHaveBeenCalledWith(
      'custom:custom:openrouter-1',
      'or-key-abc',
    );
  });
});

// ─── validateForm via AddCustomForm UI ───────────────────────────────────────

describe('AddCustomForm — validateForm via UI', () => {
  /**
   * These tests submit the "Add provider" form without filling required fields
   * and assert the resulting error messages. They test the validateForm function
   * indirectly through the rendered UI — the only correct approach since
   * validateForm is not exported.
   *
   * Error messages render as <p role="alert"> elements in the DOM.
   */

  it('submitting with all fields empty shows all three required-field errors', () => {
    vi.mocked(getProviderRoster).mockReturnValue([]);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    const alerts = screen.getAllByRole('alert');
    const alertTexts = alerts.map((a) => a.textContent ?? '');

    expect(alertTexts).toContain('Display name is required.');
    expect(alertTexts).toContain('Endpoint URL is required.');
    expect(alertTexts).toContain('Model string is required.');
  });

  it('filling displayName only shows endpointUrl and modelString errors (no displayName error)', () => {
    vi.mocked(getProviderRoster).mockReturnValue([]);

    renderPanel();

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'My Server' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    const alerts = screen.getAllByRole('alert');
    const alertTexts = alerts.map((a) => a.textContent ?? '');

    expect(alertTexts).not.toContain('Display name is required.');
    expect(alertTexts).toContain('Endpoint URL is required.');
    expect(alertTexts).toContain('Model string is required.');
  });

  it('submitting with a non-http URL shows the URL format error', () => {
    vi.mocked(getProviderRoster).mockReturnValue([]);

    renderPanel();

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'My Server' },
    });
    fireEvent.change(screen.getByLabelText('Endpoint URL'), {
      target: { value: 'ftp://not-valid.com/v1' },
    });
    fireEvent.change(screen.getByLabelText('Model string'), {
      target: { value: 'llama3' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    // The URL format error message.
    screen.getByText('Enter a valid URL (e.g. https://my-server.example.com/v1)');
  });

  it('filling all required fields with a valid https URL shows no errors and calls addCustomProvider', () => {
    vi.mocked(getProviderRoster).mockReturnValue([]);

    renderPanel();

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'My Llama Server' },
    });
    fireEvent.change(screen.getByLabelText('Endpoint URL'), {
      target: { value: 'https://my-server.example.com/v1' },
    });
    fireEvent.change(screen.getByLabelText('Model string'), {
      target: { value: 'llama3.2:latest' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    // No error alerts should be present.
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(addCustomProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'My Llama Server',
        endpointUrl: 'https://my-server.example.com/v1',
        modelString: 'llama3.2:latest',
      }),
    );
  });

  it('filling all required fields with a valid http URL (non-https) also passes validation', () => {
    vi.mocked(getProviderRoster).mockReturnValue([]);

    renderPanel();

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Local Ollama' },
    });
    fireEvent.change(screen.getByLabelText('Endpoint URL'), {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.change(screen.getByLabelText('Model string'), {
      target: { value: 'llama3' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(addCustomProvider).toHaveBeenCalled();
  });
});
