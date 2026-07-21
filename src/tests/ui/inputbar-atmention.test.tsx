/**
 * Integration tests: InputBar @mention autocomplete behavioral contract — closes #478
 *
 * The AtMentionAutocomplete component is already tested in isolation in
 * at-mention-autocomplete.test.tsx (#477). This file covers the InputBar-level
 * behaviors that require the textarea → autocomplete → send pipeline:
 *
 *   1. Typing "@" opens the autocomplete popover
 *   2. Typing additional characters after "@" filters the list
 *   3. Pressing Escape closes the autocomplete
 *   4. Clicking a model option inserts "@ModelName " in the textarea
 *   5. Pressing Enter with a highlighted model selects it (keyboard nav)
 *   6. Sending with an @mention model passes targetModelId to onSend
 *      and strips the "@ModelName" token from the content
 *   7. Clearing the @mention token from the textarea clears mentionedModel
 *      (second-mention / overwrite path)
 *
 * Mocking strategy:
 *   - @/auth mocked at module boundary — InputBar calls getProviderRoster()
 *     to check vision capabilities and getProxyConfig() for the proxy gate.
 *     Both return safe defaults (empty roster, null proxy config) so neither
 *     modal fires during these tests.
 *   - MentionHighlightOverlay is UI-only (renders a mirror div); we let it
 *     render but do not assert on its internals.
 *   - scrollIntoView is stubbed — jsdom does not implement it.
 *   - No network, no storage, no auth key checks.
 *
 * Cross-agent contracts exercised:
 *   InputBar (Aria, src/ui/InputBar.tsx) — @ detection, keyboard nav, send routing
 *   AtMentionAutocomplete (Aria, src/ui/components/AtMentionAutocomplete.tsx) — popover rendering
 *   ModelConfig interface (Arch, src/types/index.ts) — model shape
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InputBar } from '@/ui/InputBar';
import type { ModelConfig } from '@/types/index';
import { CLAUDE_MODEL, GPT_MODEL } from '../fixtures/conversations';

// ─── Auth module mock ─────────────────────────────────────────────────────────
// InputBar calls getProviderRoster() (vision check) and getProxyConfig()
// (proxy onboarding gate). Return minimal stubs so neither modal fires.

vi.mock('@/auth', () => ({
  getProviderRoster: vi.fn(() => []),
  getProxyConfig: vi.fn(() => null),
  saveProxyConfig: vi.fn(),
  BUILTIN_MODEL_IDS: new Set(['claude', 'gpt-5.5', 'gemini', 'deepseek']),
  getModelVersions: () => [],
  getModelVersion: () => undefined,
  setModelVersion: () => {},
}));

// ─── scrollIntoView stub ──────────────────────────────────────────────────────

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Active model fixtures ────────────────────────────────────────────────────

/** Only active models are shown in the @mention popover. */
const ACTIVE_MODELS: ModelConfig[] = [
  { ...CLAUDE_MODEL, isActive: true },
  { ...GPT_MODEL, isActive: true },
];

// ─── Render helper ────────────────────────────────────────────────────────────

interface RenderInputBarOptions {
  onSend?: (content: string, attachments: unknown[], targetModelId?: string) => void;
  activeModels?: ModelConfig[];
  activeModelCount?: number;
}

function renderInputBar({
  onSend = vi.fn(),
  activeModels = ACTIVE_MODELS,
  activeModelCount = ACTIVE_MODELS.length,
}: RenderInputBarOptions = {}) {
  render(
    <InputBar
      onSend={onSend}
      activeModels={activeModels}
      activeModelCount={activeModelCount}
    />,
  );

  const textarea = screen.getByRole('textbox', { name: /message input/i });
  return { textarea, onSend };
}

// ─── Helper: type into the textarea ──────────────────────────────────────────

/**
 * Fire a change event on the textarea with the given value, simulating the
 * cursor at the end of the string. InputBar uses e.target.selectionStart
 * in handleChange — jsdom sets selectionStart after value assignment.
 */
function typeIntoTextarea(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value, selectionStart: value.length } });
}

// ─── Test: typing "@" opens the popover ─────────────────────────────────────

describe('InputBar @mention — typing "@" opens the autocomplete', () => {
  it('renders a listbox when the user types "@" into the textarea', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    const listbox = screen.queryByRole('listbox', { name: /mention a model/i });
    expect(listbox).not.toBeNull();
  });

  it('popover is absent before any "@" is typed', () => {
    const { textarea } = renderInputBar();

    // Initial render — no popover.
    expect(screen.queryByRole('listbox')).toBeNull();

    // Type something without "@" — still no popover.
    act(() => {
      typeIntoTextarea(textarea, 'hello');
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows all active models when "@" is typed with no additional characters', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(ACTIVE_MODELS.length);
  });
});

// ─── Test: typing further characters filters the list ────────────────────────

describe('InputBar @mention — further characters after "@" filter the list', () => {
  it('typing "@cl" narrows the list to models matching "cl"', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@cl');
    });

    // 'Claude' starts with 'cl'; 'GPT-5.5' does not.
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(screen.getByText('Claude')).not.toBeNull();
    expect(screen.queryByText('GPT-5.5')).toBeNull();
  });

  it('typing "@gpt" narrows the list to GPT-5.5', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@gpt');
    });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(screen.getByText('GPT-5.5')).not.toBeNull();
    expect(screen.queryByText('Claude')).toBeNull();
  });

  it('typing "@zzz" (no match) closes the popover entirely', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@zzz');
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─── Test: Escape closes the autocomplete ────────────────────────────────────

describe('InputBar @mention — Escape dismisses the autocomplete', () => {
  it('pressing Escape while the popover is open closes it', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    // Popover is open.
    expect(screen.queryByRole('listbox')).not.toBeNull();

    act(() => {
      fireEvent.keyDown(textarea, { key: 'Escape' });
    });

    // Popover is dismissed.
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape does not clear textarea content', () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@cl');
    });

    act(() => {
      fireEvent.keyDown(textarea, { key: 'Escape' });
    });

    // The textarea still contains "@cl" — only the popover closed.
    expect((textarea as HTMLTextAreaElement).value).toBe('@cl');
  });
});

// ─── Test: clicking a model inserts "@ModelName " ─────────────────────────────

describe('InputBar @mention — selecting a model inserts the mention token', () => {
  it('clicking "Claude" in the popover inserts "@Claude " into the textarea', async () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    const claudeOption = screen.getByText('Claude').closest('[role="option"]')!;

    // Use mousedown (not click) — AtMentionAutocomplete uses onMouseDown with
    // preventDefault() to keep focus in the textarea.
    act(() => {
      fireEvent.mouseDown(claudeOption);
    });

    // Wait one rAF tick — handleMentionSelect schedules a requestAnimationFrame
    // for cursor positioning, but the value update is synchronous.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect((textarea as HTMLTextAreaElement).value).toContain('@Claude');
    // Popover is dismissed after selection.
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicking "GPT-5.5" in the popover inserts "@GPT-5.5 "', async () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    const gptOption = screen.getByText('GPT-5.5').closest('[role="option"]')!;

    act(() => {
      fireEvent.mouseDown(gptOption);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect((textarea as HTMLTextAreaElement).value).toContain('@GPT-5.5');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─── Test: Enter key selects the highlighted option ──────────────────────────

describe('InputBar @mention — Enter key selects the highlighted model', () => {
  it('pressing ArrowDown then Enter inserts the first model', async () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    // AtMentionAutocomplete opens with activeIndex=0 (first item auto-highlighted
    // per handleMentionOnChange: setMentionActiveIndex(0)).
    // Press Enter to select.
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // First active model is Claude.
    expect((textarea as HTMLTextAreaElement).value).toContain('@Claude');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ArrowDown moves highlight to second item; Enter selects it', async () => {
    const { textarea } = renderInputBar();

    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    // Move highlight from index 0 to index 1.
    act(() => {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    });

    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Second active model is GPT-5.5.
    expect((textarea as HTMLTextAreaElement).value).toContain('@GPT-5.5');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─── Test: send with @mention strips token and routes to model ────────────────

describe('InputBar @mention — send passes targetModelId and strips the token', () => {
  it('onSend receives the selected model id as targetModelId', async () => {
    const onSend = vi.fn();
    const { textarea } = renderInputBar({ onSend });

    // Type "@Claude " then some content so canSend is true.
    act(() => {
      typeIntoTextarea(textarea, '@');
    });

    const claudeOption = screen.getByText('Claude').closest('[role="option"]')!;
    act(() => {
      fireEvent.mouseDown(claudeOption);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Now the textarea contains "@Claude ". Add real content after it.
    const currentValue = (textarea as HTMLTextAreaElement).value;
    act(() => {
      typeIntoTextarea(textarea, currentValue + 'hello');
    });

    // Send via Enter.
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    expect(onSend).toHaveBeenCalledOnce();
    const [content, , targetModelId] = onSend.mock.calls[0] as [string, unknown[], string];

    // The mention token is stripped from the content.
    expect(content).not.toContain('@Claude');
    // The model id is passed as targetModelId.
    expect(targetModelId).toBe('claude');
  });

  it('onSend receives undefined targetModelId when no @mention was used', () => {
    const onSend = vi.fn();
    const { textarea } = renderInputBar({ onSend });

    act(() => {
      typeIntoTextarea(textarea, 'hello world');
    });

    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    expect(onSend).toHaveBeenCalledOnce();
    const [, , targetModelId] = onSend.mock.calls[0] as [string, unknown[], string | undefined];
    expect(targetModelId).toBeUndefined();
  });
});

// ─── Test: deleting the mention token clears the selected model ───────────────

describe('InputBar @mention — editing away the mention token clears the selection', () => {
  it('deleting "@Claude" from the textarea removes the directed target on next send', async () => {
    const onSend = vi.fn();
    const { textarea } = renderInputBar({ onSend });

    // Select Claude via @mention.
    act(() => {
      typeIntoTextarea(textarea, '@');
    });
    const claudeOption = screen.getByText('Claude').closest('[role="option"]')!;
    act(() => {
      fireEvent.mouseDown(claudeOption);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Now delete the "@Claude" token by replacing the textarea value with plain content.
    act(() => {
      typeIntoTextarea(textarea, 'just a plain message');
    });

    // Send — no mention model selected now.
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    expect(onSend).toHaveBeenCalledOnce();
    const [content, , targetModelId] = onSend.mock.calls[0] as [string, unknown[], string | undefined];
    expect(content).toBe('just a plain message');
    expect(targetModelId).toBeUndefined();
  });
});
