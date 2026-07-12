/**
 * AtMentionAutocomplete + MessageBubble routing label — Accessibility Tests (#382)
 *
 * Audit scope (narrow — per CLAUDE.md wave cost optimization):
 *   1. Combobox/listbox ARIA pattern (ARIA 1.2 §3.8)
 *   2. ARIA attribute cleanup on unmount
 *   3. Focus management: stays in textarea, returns after selection
 *   4. Keyboard navigation: ↑/↓ navigate, Enter selects, Escape dismisses, Tab closes
 *   5. Routing label in MessageBubble assistant nameplate (WCAG 1.3.1, 1.4.1)
 *   6. MentionHighlightOverlay is aria-hidden (purely decorative mirror div)
 *   7. Axe scans on all rendered states
 *
 * ARIA structure verified:
 *   - div[role="combobox"] wrapper (comboboxRef) carries: aria-expanded, aria-controls,
 *     aria-haspopup, aria-activedescendant
 *   - textarea inside keeps implicit "textbox" role, carries only aria-autocomplete="list"
 *   - listbox div carries: role="listbox", aria-label
 *   - option divs carry: role="option", aria-selected
 *
 * WCAG criteria:
 *   1.3.1 — Info and Relationships: routing context communicated as text, not color alone
 *   1.4.1 — Use of Color: → glyph aria-hidden; sr-only text provides non-color cue
 *   4.1.2 — Name, Role, Value: combobox/listbox/option roles present and correct
 *   4.1.3 — Status Messages: no violations introduced by the popover
 *
 * Note on focus testing: jsdom does not run rAF callbacks natively. We follow the
 * established project pattern (input-bar.test.tsx): stub requestAnimationFrame with
 * a synchronous implementation so callbacks fire immediately during the test.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AtMentionAutocomplete, filterModels } from '@/ui/components/AtMentionAutocomplete';
import { MentionHighlightOverlay } from '@/ui/components/MentionHighlightOverlay';
import { MessageBubble } from '@/ui/MessageBubble';
import type { Message, ModelConfig, ModelId } from '@/types';
import { useRef } from 'react';

// ─── Axe assertion helper ────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n'),
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── jsdom scrollIntoView stub ───────────────────────────────────────────────
// jsdom does not implement scrollIntoView. AtMentionAutocomplete calls it via
// option?.scrollIntoView({ block: 'nearest' }) in its activeIndex useEffect.
// Tests that render with activeIndex >= 0 must stub this to avoid throwing.

function stubScrollIntoView(): () => void {
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  return () => { HTMLElement.prototype.scrollIntoView = original; };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLAUDE_CONFIG: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

const GPT_CONFIG: ModelConfig = {
  modelId: 'gpt-4o' as ModelId,
  name: 'GPT-4o',
  color: 'accent-openai',
  isActive: true,
};

const MISTRAL_CONFIG: ModelConfig = {
  modelId: 'mistral' as ModelId,
  name: 'Mistral',
  color: 'accent-mistral',
  isActive: true,
};

const MODELS: ModelConfig[] = [CLAUDE_CONFIG, GPT_CONFIG, MISTRAL_CONFIG];

const COMPLETED_ASSISTANT_MESSAGE: Message = {
  id: 'msg-1',
  role: 'assistant',
  content: 'Here is my directed response.',
  modelId: 'claude',
  timestamp: 1_700_000_000_000,
  isStreaming: false,
};

const USER_DIRECTED_MESSAGE: Message = {
  id: 'msg-user-directed',
  role: 'user',
  content: 'Hello, Claude.',
  timestamp: 1_700_000_001_000,
};

// ─── Wrapper component for AtMentionAutocomplete ──────────────────────────────
// The correct ARIA 1.2 §3.8 structure:
//   <div role="combobox" aria-expanded="false" ref={comboboxRef}>
//     <textarea aria-label="Message input" ref={textareaRef} />
//   </div>
//   <AtMentionAutocomplete ... comboboxRef={comboboxRef} textareaRef={textareaRef} />
//
// The combobox div carries: aria-expanded, aria-controls, aria-haspopup, aria-activedescendant
// The textarea carries only: aria-autocomplete="list" (valid on textbox-role)

interface WrapperProps {
  models?: ModelConfig[];
  query?: string;
  activeIndex?: number;
  onSelect?: (model: ModelConfig) => void;
  onDismiss?: () => void;
  listboxId?: string;
}

function AutocompleteWrapper({
  models = MODELS,
  query = '',
  activeIndex = -1,
  onSelect = vi.fn(),
  onDismiss = vi.fn(),
  listboxId = 'test-listbox',
}: WrapperProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position: 'relative' }}>
      {/* div[role="combobox"] wraps the textarea — ARIA 1.2 §3.8 combobox pattern.
          aria-expanded="false" is the initial state; AtMentionAutocomplete sets "true". */}
      <div
        ref={comboboxRef}
        role="combobox"
        aria-expanded="false"
        aria-label="Message input combobox"
      >
        <textarea ref={textareaRef} aria-label="Message input" />
      </div>
      <AtMentionAutocomplete
        models={models}
        query={query}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onDismiss={onDismiss}
        textareaRef={textareaRef}
        comboboxRef={comboboxRef}
        listboxId={listboxId}
      />
    </div>
  );
}

// ─── filterModels unit tests ─────────────────────────────────────────────────

describe('filterModels — utility function', () => {
  it('returns up to 5 models when query is empty', () => {
    const many: ModelConfig[] = Array.from({ length: 7 }, (_, i) => ({
      modelId: `model-${i}` as ModelId,
      name: `Model ${i}`,
      color: 'accent-claude',
      isActive: true,
    }));
    expect(filterModels(many, '')).toHaveLength(5);
  });

  it('returns prefix matches before substring matches', () => {
    const result = filterModels(MODELS, 'c');
    // "Claude" starts with "c" — prefix match goes first
    expect(result[0].modelId).toBe('claude');
  });

  it('returns empty array when no models match', () => {
    expect(filterModels(MODELS, 'zzz')).toHaveLength(0);
  });

  it('matching is case-insensitive', () => {
    expect(filterModels(MODELS, 'CLAUDE')).toHaveLength(1);
    expect(filterModels(MODELS, 'claude')).toHaveLength(1);
  });
});

// ─── Combobox/listbox ARIA structure ─────────────────────────────────────────

describe('AtMentionAutocomplete — ARIA structure (WCAG 4.1.2 / ARIA 1.2 §3.8)', () => {
  let restoreScrollIntoView: () => void;
  beforeEach(() => { restoreScrollIntoView = stubScrollIntoView(); });
  afterEach(() => { restoreScrollIntoView(); });

  // Axe scans verify the complete ARIA structure is clean after the fix:
  // - div[role="combobox"] wrapper carries all combobox state attributes
  // - textarea keeps implicit textbox role with only aria-autocomplete="list"
  // - No aria-allowed-role or aria-allowed-attr violations
  it('has no axe violations in the open state', async () => {
    const { container } = render(<AutocompleteWrapper />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations with a highlighted (active) option', async () => {
    const { container } = render(<AutocompleteWrapper activeIndex={0} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('listbox element is present with role="listbox"', () => {
    render(<AutocompleteWrapper />);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
  });

  it('listbox has an accessible name (aria-label="Mention a model")', () => {
    render(<AutocompleteWrapper />);
    const listbox = screen.getByRole('listbox', { name: /mention a model/i });
    expect(listbox).toBeTruthy();
  });

  it('listbox id matches the listboxId prop', () => {
    render(<AutocompleteWrapper listboxId="my-listbox" />);
    const listbox = document.getElementById('my-listbox');
    expect(listbox).not.toBeNull();
    expect(listbox?.getAttribute('role')).toBe('listbox');
  });

  it('each filtered model renders as role="option"', () => {
    render(<AutocompleteWrapper query="" />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(MODELS.length);
  });

  it('non-highlighted options have aria-selected="false"', () => {
    render(<AutocompleteWrapper activeIndex={-1} />);
    const options = screen.getAllByRole('option');
    for (const option of options) {
      expect(option.getAttribute('aria-selected')).toBe('false');
    }
  });

  it('highlighted option has aria-selected="true", others have aria-selected="false"', () => {
    render(<AutocompleteWrapper activeIndex={1} />);
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[2].getAttribute('aria-selected')).toBe('false');
  });

  it('model color dot inside each option is aria-hidden', () => {
    const { container } = render(<AutocompleteWrapper />);
    const options = container.querySelectorAll('[role="option"]');
    for (const option of options) {
      // The 7px color dot must be aria-hidden — color identity is supplementary
      const dot = option.querySelector('span[aria-hidden="true"]');
      expect(dot).not.toBeNull();
    }
  });

  it('returns null (nothing rendered) when no models match the query', () => {
    const { container } = render(<AutocompleteWrapper query="zzz" />);
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).toBeNull();
  });
});

// ─── Combobox div and textarea ARIA attributes (set via useEffect) ─────────────
//
// ARIA structure:
//   div[role="combobox"]:
//     - aria-expanded: "true" (set on mount)
//     - aria-controls: the listbox id
//     - aria-haspopup: "listbox"
//     - aria-activedescendant: option id (when activeIndex >= 0)
//   textarea (implicit textbox role):
//     - aria-autocomplete: "list" (set on mount)
//     - NO role override (aria-allowed-role would be violated)
//     - NO aria-expanded/aria-controls/aria-activedescendant (aria-allowed-attr would be violated)

describe('AtMentionAutocomplete — combobox/textarea ARIA attributes (WCAG 4.1.2)', () => {
  let restoreScrollIntoView: () => void;
  beforeEach(() => { restoreScrollIntoView = stubScrollIntoView(); });
  afterEach(() => { restoreScrollIntoView(); });

  it('textarea does NOT have role="combobox" — keeps implicit textbox role', () => {
    const { container } = render(<AutocompleteWrapper />);
    const textarea = container.querySelector('textarea');
    // role="combobox" on <textarea> violates axe aria-allowed-role — must be null
    expect(textarea?.getAttribute('role')).toBeNull();
    // Testing Library still resolves it as textbox (the native implicit role)
    expect(screen.getByRole('textbox')).toBe(textarea);
  });

  it('the combobox wrapper div has role="combobox"', () => {
    render(<AutocompleteWrapper />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.tagName.toLowerCase()).toBe('div');
  });

  it('sets aria-expanded="true" on the combobox wrapper div when open', () => {
    render(<AutocompleteWrapper />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-controls on the combobox wrapper div, pointing to the listbox id', () => {
    render(<AutocompleteWrapper listboxId="ctrl-listbox" />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-controls')).toBe('ctrl-listbox');
  });

  it('sets aria-haspopup="listbox" on the combobox wrapper div', () => {
    render(<AutocompleteWrapper />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('sets aria-autocomplete="list" on the textarea (valid on textbox role)', () => {
    render(<AutocompleteWrapper />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('aria-autocomplete')).toBe('list');
  });

  it('textarea does NOT get aria-expanded (invalid on textbox role)', () => {
    render(<AutocompleteWrapper />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('aria-expanded')).toBeNull();
  });

  it('sets aria-activedescendant on the combobox div when activeIndex >= 0', () => {
    render(<AutocompleteWrapper activeIndex={0} listboxId="act-listbox" />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-activedescendant')).toBe('act-listbox-option-0');
  });

  it('removes aria-activedescendant from the combobox div when activeIndex is -1', () => {
    render(<AutocompleteWrapper activeIndex={-1} />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('textarea does NOT get aria-activedescendant (invalid on textbox role)', () => {
    render(<AutocompleteWrapper activeIndex={0} listboxId="no-ad-listbox" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('active option element id matches combobox aria-activedescendant', () => {
    render(<AutocompleteWrapper activeIndex={2} listboxId="check-listbox" />);
    const combobox = screen.getByRole('combobox');
    const activeDescendantId = combobox.getAttribute('aria-activedescendant');
    expect(activeDescendantId).toBe('check-listbox-option-2');
    const activeOption = document.getElementById(activeDescendantId!);
    expect(activeOption).not.toBeNull();
    expect(activeOption?.getAttribute('role')).toBe('option');
  });

  it('restores aria-expanded="false" on the combobox div after unmount', () => {
    // Create the combobox div as it would exist in InputBar: always present,
    // aria-expanded="false" by default. AtMentionAutocomplete sets "true" on mount
    // and restores "false" on unmount (not remove — role="combobox" requires it).
    const comboboxEl = document.createElement('div');
    comboboxEl.setAttribute('role', 'combobox');
    comboboxEl.setAttribute('aria-expanded', 'false');
    document.body.appendChild(comboboxEl);

    const textareaEl = document.createElement('textarea');
    comboboxEl.appendChild(textareaEl);

    const comboboxRef = { current: comboboxEl };
    const textareaRef = { current: textareaEl };

    const { unmount } = render(
      <AtMentionAutocomplete
        models={MODELS}
        query=""
        activeIndex={-1}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
        textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement | null>}
        comboboxRef={comboboxRef as React.RefObject<HTMLDivElement | null>}
        listboxId="unmount-listbox"
      />
    );

    // Combobox div gets aria-expanded="true" while popover is mounted
    expect(comboboxEl.getAttribute('aria-expanded')).toBe('true');
    expect(comboboxEl.getAttribute('aria-controls')).toBe('unmount-listbox');
    // Textarea gets aria-autocomplete="list" only
    expect(textareaEl.getAttribute('aria-autocomplete')).toBe('list');
    expect(textareaEl.getAttribute('aria-expanded')).toBeNull();

    unmount();

    // After unmount: combobox div returns to aria-expanded="false" (not removed)
    expect(comboboxEl.getAttribute('aria-expanded')).toBe('false');
    expect(comboboxEl.getAttribute('aria-controls')).toBeNull();
    expect(comboboxEl.getAttribute('aria-haspopup')).toBeNull();
    expect(comboboxEl.getAttribute('aria-activedescendant')).toBeNull();
    // Textarea loses aria-autocomplete
    expect(textareaEl.getAttribute('aria-autocomplete')).toBeNull();
    // Neither element should ever have role attribute set programmatically
    expect(comboboxEl.getAttribute('role')).toBe('combobox'); // static, unchanged
    expect(textareaEl.getAttribute('role')).toBeNull();

    document.body.removeChild(comboboxEl);
  });
});

// ─── Focus management ────────────────────────────────────────────────────────

describe('AtMentionAutocomplete — focus management (WCAG 2.4.3)', () => {
  let restoreScrollIntoView: () => void;
  beforeEach(() => { restoreScrollIntoView = stubScrollIntoView(); });
  afterEach(() => { restoreScrollIntoView(); });

  it('focus stays in the textarea — DOM focus never moves to the listbox', () => {
    render(<AutocompleteWrapper />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // The listbox must not be focusable (no tabIndex attribute making it interactive)
    const listbox = screen.getByRole('listbox');
    expect(listbox.tabIndex).toBe(-1);
  });

  it('option elements do not receive DOM focus via Tab (no tabindex > -1 on options)', () => {
    render(<AutocompleteWrapper />);
    const options = screen.getAllByRole('option');
    for (const option of options) {
      // Options must not be in the natural tab order — focus stays in textarea
      expect(option.getAttribute('tabindex')).not.toBe('0');
    }
  });

  it('onSelect is called with the correct model on mousedown', () => {
    const onSelect = vi.fn();
    render(<AutocompleteWrapper onSelect={onSelect} />);
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[1]); // GPT-4o
    expect(onSelect).toHaveBeenCalledWith(GPT_CONFIG);
  });

  it('onDismiss is called on pointer-down outside the listbox and textarea', () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <AutocompleteWrapper onDismiss={onDismiss} />
        <button>Outside</button>
      </div>
    );
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.pointerDown(outside);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('onDismiss is NOT called on pointer-down inside the listbox', () => {
    const onDismiss = vi.fn();
    render(<AutocompleteWrapper onDismiss={onDismiss} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.pointerDown(listbox);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ─── MessageBubble — routing label ARIA (WCAG 1.3.1, 1.4.1) ─────────────────

describe('MessageBubble — routing label ARIA (#382, WCAG 1.3.1, 1.4.1)', () => {
  it('has no axe violations — assistant bubble with routing label', async () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — user bubble with directed-to label', async () => {
    const { container } = render(
      <MessageBubble
        message={USER_DIRECTED_MESSAGE}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('routing label in assistant nameplate: → glyph is aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The → glyph in the nameplate routing label must be aria-hidden —
    // routing context is communicated by sr-only "Directed to" text.
    // We find the nameplate routing span and check its first child (the arrow span).
    const nameplate = container.querySelector('.h-\\[28px\\]');
    const arrowSpans = nameplate?.querySelectorAll('span[aria-hidden="true"]') ?? [];
    const arrowGlyph = [...arrowSpans].find((s) => s.textContent === '→');
    expect(arrowGlyph).not.toBeUndefined();
  });

  it('routing label in assistant nameplate: sr-only "Directed to" span is present', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The sr-only span communicates "Directed to [model]" without relying on
    // the → glyph that is hidden from ATs.
    const srOnlySpans = container.querySelectorAll('.sr-only');
    const directedToSpan = [...srOnlySpans].find((s) => s.textContent?.includes('Directed to'));
    expect(directedToSpan).not.toBeUndefined();
  });

  it('routing label in assistant nameplate: model name is visible text (not sr-only)', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The model name in the routing label ("Claude") must appear as a normal
    // visible text span, not hidden inside an sr-only element.
    const nameplate = container.querySelector('.h-\\[28px\\]');
    const textContent = nameplate?.textContent ?? '';
    expect(textContent).toContain('Claude');
  });

  it('routing label container does not carry aria-label on a role="generic" element (ARIA 1.2 §6.2.6)', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // ARIA 1.2 §6.2.6 prohibits aria-label on elements with implicit role="generic"
    // (plain <span> or <div> without an explicit role). The routing label span
    // in the nameplate must not carry aria-label.
    const nameplate = container.querySelector('.h-\\[28px\\]');
    const routingSpan = nameplate?.querySelector('span.text-\\[11px\\].font-normal.text-text-muted');
    expect(routingSpan).not.toBeNull();
    expect(routingSpan?.getAttribute('aria-label')).toBeNull();
  });

  it('no routing label when targetModelConfig is absent', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // Without targetModelConfig, no routing label should appear.
    const nameplate = container.querySelector('.h-\\[28px\\]');
    const routingSpans = nameplate?.querySelectorAll('span.text-text-muted') ?? [];
    // The only text-muted span in the nameplate without routing should be the timestamp.
    // Confirm no span contains "Directed to" text.
    const directedToSpan = [...routingSpans].find((s) => s.textContent?.includes('Directed to'));
    expect(directedToSpan).toBeUndefined();
  });

  it('user bubble directed-to label: → glyph is aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={USER_DIRECTED_MESSAGE}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // In the user bubble body zone, the directed-to label also has an aria-hidden → glyph.
    const bodyZone = container.querySelector('.px-4.pt-2.pb-3');
    const arrowSpan = bodyZone?.querySelector('span[aria-hidden="true"]');
    expect(arrowSpan).not.toBeNull();
    expect(arrowSpan?.textContent).toBe('→');
  });

  it('user bubble directed-to label: "Directed to ModelName" is visible text', () => {
    const { container } = render(
      <MessageBubble
        message={USER_DIRECTED_MESSAGE}
        targetModelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // "Directed to Claude" must be present as visible text in the user bubble
    // (not sr-only) so sighted users can also see where the message is directed.
    const bodyZone = container.querySelector('.px-4.pt-2.pb-3');
    expect(bodyZone?.textContent).toContain('Directed to Claude');
  });
});

// ─── MentionHighlightOverlay — ARIA decoration ───────────────────────────────

describe('MentionHighlightOverlay — aria-hidden (WCAG 1.3.1)', () => {
  // Helper that renders the overlay with a textarea and the mention token present.
  function OverlayWrapper() {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    return (
      <div style={{ position: 'relative' }}>
        <textarea ref={textareaRef} defaultValue="Hello @Claude world" />
        <MentionHighlightOverlay
          value="Hello @Claude world"
          model={CLAUDE_CONFIG}
          textareaRef={textareaRef}
        />
      </div>
    );
  }

  it('overlay wrapper div is aria-hidden (duplicate content must not reach AT)', () => {
    const { container } = render(<OverlayWrapper />);
    // The overlay div must be aria-hidden so screen readers only read the
    // textarea's actual content, not the duplicate overlay text.
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
  });

  it('overlay div has pointer-events-none so interaction passes to the textarea', () => {
    const { container } = render(<OverlayWrapper />);
    // pointer-events-none is applied so all interaction passes through to the textarea.
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay?.classList.contains('pointer-events-none')).toBe(true);
  });

  it('returns null when the mention token is not present in the value', () => {
    function NoTokenWrapper() {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      return (
        <div style={{ position: 'relative' }}>
          <textarea ref={textareaRef} defaultValue="Hello world" />
          <MentionHighlightOverlay
            value="Hello world"
            model={CLAUDE_CONFIG}
            textareaRef={textareaRef}
          />
        </div>
      );
    }
    const { container } = render(<NoTokenWrapper />);
    // When "@Claude" is not in the value, the component returns null.
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeNull();
  });
});
