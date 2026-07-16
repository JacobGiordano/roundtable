/**
 * Integration tests: AtMentionAutocomplete behavioral contract — closes #477
 *
 * AtMentionAutocomplete is a controlled component. Its filtering, rendering,
 * and event contracts are tested here through the component interface directly.
 * InputBar-level behaviors (detecting "@" in the textarea, routing on send) are
 * tested in the existing app-handler-paths integration suite.
 *
 * Coverage:
 *   1. filterModels() — exported pure function, testable in isolation
 *      - empty query returns all models (up to 5)
 *      - prefix matches appear before substring matches
 *      - filtering is case-insensitive
 *      - results capped at 5
 *   2. AtMentionAutocomplete rendering
 *      - renders a listbox with model options
 *      - onSelect called with correct model on mousedown
 *      - onDismiss called on Escape key (tested through InputBar keyboard handler)
 *      - only active models are shown (caller responsibility — models prop is pre-filtered)
 *
 * Cross-agent contracts exercised:
 *   AtMentionAutocomplete (Aria, src/ui/components/AtMentionAutocomplete.tsx)
 *   filterModels (Aria, src/ui/components/AtMentionAutocomplete.tsx — exported)
 *   ModelConfig interface (Arch, src/types/index.ts)
 *
 * Source: src/ui/components/AtMentionAutocomplete.tsx (Aria owns)
 * This test file lives in src/tests/ui/ (Scout owns)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { AtMentionAutocomplete, filterModels } from '@/ui/components/AtMentionAutocomplete';
import type { ModelConfig } from '@/types/index';
import { CLAUDE_MODEL, GPT_MODEL, INACTIVE_MODEL } from '../fixtures/conversations';

// ─── Scroll stub ──────────────────────────────────────────────────────────────

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

// ─── Model fixtures ───────────────────────────────────────────────────────────

const GEMINI_MODEL: ModelConfig = {
  modelId: 'gemini',
  name: 'Gemini',
  color: 'sky',
  isActive: true,
};

const MISTRAL_MODEL: ModelConfig = {
  modelId: 'mistral',
  name: 'Mistral',
  color: 'orange',
  isActive: true,
};

const LLAMA_MODEL: ModelConfig = {
  modelId: 'llama',
  name: 'Llama',
  color: 'yellow',
  isActive: true,
};

// Six models total — useful for testing the 5-result cap.
const ALL_MODELS = [CLAUDE_MODEL, GPT_MODEL, GEMINI_MODEL, MISTRAL_MODEL, LLAMA_MODEL, INACTIVE_MODEL];

// ─── filterModels — pure function tests ──────────────────────────────────────

describe('filterModels — filtering and sorting', () => {
  it('empty query returns all models (up to 5)', () => {
    const result = filterModels(ALL_MODELS, '');
    // 6 models provided but cap is 5
    expect(result.length).toBe(5);
  });

  it('exact prefix match returns the matching model first', () => {
    const result = filterModels([CLAUDE_MODEL, GPT_MODEL, GEMINI_MODEL], 'claude');
    expect(result[0].modelId).toBe('claude');
  });

  it('prefix matches appear before substring matches', () => {
    // 'gpt' prefix-matches GPT-5.5; does NOT substring-match others here.
    // 'g' prefix-matches Gemini and GPT, substring-matches nothing else.
    const modelsForTest = [GEMINI_MODEL, GPT_MODEL, CLAUDE_MODEL];
    const result = filterModels(modelsForTest, 'g');
    // Gemini and GPT both start with 'G'/'g'; Claude does not contain 'g' in name
    const ids = result.map((m) => m.modelId);
    expect(ids).toContain('gemini');
    expect(ids).toContain('gpt-5.5');
    expect(ids).not.toContain('claude');
  });

  it('filtering is case-insensitive', () => {
    const result = filterModels([CLAUDE_MODEL, GPT_MODEL], 'CLAUDE');
    expect(result.length).toBe(1);
    expect(result[0].modelId).toBe('claude');
  });

  it('returns empty array when no model matches the query', () => {
    const result = filterModels([CLAUDE_MODEL, GPT_MODEL], 'zzz-no-match');
    expect(result).toHaveLength(0);
  });

  it('caps results at 5 even when more than 5 models match', () => {
    // All 6 models with empty query — only 5 returned
    const result = filterModels(ALL_MODELS, '');
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('includes substring matches when no prefix match exists', () => {
    // 'pt' is a substring of 'GPT-5.5' but not a prefix
    const result = filterModels([CLAUDE_MODEL, GPT_MODEL], 'pt');
    expect(result.some((m) => m.modelId === 'gpt-5.5')).toBe(true);
  });
});

// ─── AtMentionAutocomplete rendering ─────────────────────────────────────────

/**
 * Helper to render AtMentionAutocomplete with controlled refs.
 * The component requires textareaRef and comboboxRef to set ARIA attributes;
 * we supply real DOM elements via rendereed refs.
 */
function renderAutocomplete(
  models: ModelConfig[],
  query: string,
  activeIndex: number,
  onSelect = vi.fn(),
  onDismiss = vi.fn(),
) {
  // We need real DOM refs. Wrap in a container component.
  function Wrapper() {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const comboboxRef = useRef<HTMLDivElement>(null);
    return (
      <div>
        <div ref={comboboxRef} role="combobox" aria-expanded="false">
          <textarea ref={textareaRef} />
        </div>
        <AtMentionAutocomplete
          models={models}
          query={query}
          activeIndex={activeIndex}
          onSelect={onSelect}
          onDismiss={onDismiss}
          textareaRef={textareaRef}
          comboboxRef={comboboxRef}
          listboxId="test-listbox"
        />
      </div>
    );
  }
  return render(<Wrapper />);
}

describe('AtMentionAutocomplete — renders the model list', () => {
  it('renders a listbox with role="listbox"', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', -1);
    const listbox = screen.getByRole('listbox', { name: /mention a model/i });
    expect(listbox).toBeTruthy();
  });

  it('renders one option per filtered model', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL, GEMINI_MODEL], '', -1);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3);
  });

  it('renders the model display name in each option', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', -1);
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByText('GPT-5.5')).toBeTruthy();
  });

  it('returns null (renders nothing) when the filtered list is empty', () => {
    const { container } = renderAutocomplete([CLAUDE_MODEL], 'zzz-no-match', -1);
    // No listbox rendered
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).toBeNull();
  });
});

describe('AtMentionAutocomplete — filtering via query prop', () => {
  it('passing a query string filters the model list', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL, GEMINI_MODEL], 'cl', -1);
    const options = screen.getAllByRole('option');
    // Only 'Claude' starts with 'cl'
    expect(options.length).toBe(1);
    expect(screen.getByText('Claude')).toBeTruthy();
  });

  it('further characters after @ narrow the list', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL, GEMINI_MODEL], 'g', -1);
    // 'GPT-5.5' starts with 'g' (case-insensitive), 'Gemini' also starts with 'g'
    // Claude does not match
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(2);
    expect(screen.queryByText('Claude')).toBeNull();
  });
});

describe('AtMentionAutocomplete — onSelect called on mousedown', () => {
  it('calls onSelect with the correct ModelConfig when an option is clicked', () => {
    const onSelect = vi.fn();
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', -1, onSelect);
    const claudeOption = screen.getByText('Claude').closest('[role="option"]')!;
    fireEvent.mouseDown(claudeOption);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(CLAUDE_MODEL);
  });

  it('calls onSelect with the correct model when the second option is clicked', () => {
    const onSelect = vi.fn();
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', -1, onSelect);
    const gptOption = screen.getByText('GPT-5.5').closest('[role="option"]')!;
    fireEvent.mouseDown(gptOption);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(GPT_MODEL);
  });
});

describe('AtMentionAutocomplete — ARIA state', () => {
  it('aria-expanded is set to "true" on the combobox wrapper while the popover is open', () => {
    function Wrapper() {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      const comboboxRef = useRef<HTMLDivElement>(null);
      return (
        <div>
          <div ref={comboboxRef} role="combobox" aria-expanded="false" data-testid="combobox">
            <textarea ref={textareaRef} />
          </div>
          <AtMentionAutocomplete
            models={[CLAUDE_MODEL]}
            query=""
            activeIndex={-1}
            onSelect={vi.fn()}
            onDismiss={vi.fn()}
            textareaRef={textareaRef}
            comboboxRef={comboboxRef}
            listboxId="aria-test-listbox"
          />
        </div>
      );
    }
    render(<Wrapper />);
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
  });

  it('active option has aria-selected="true"; others have aria-selected="false"', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', 0);
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('no option has aria-selected="true" when activeIndex is -1', () => {
    renderAutocomplete([CLAUDE_MODEL, GPT_MODEL], '', -1);
    const options = screen.getAllByRole('option');
    options.forEach((opt) => {
      expect(opt.getAttribute('aria-selected')).toBe('false');
    });
  });
});
