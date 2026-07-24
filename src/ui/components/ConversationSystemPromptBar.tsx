/**
 * ConversationSystemPromptBar — collapsible per-conversation system prompt editor.
 *
 * Issue #408: users need to set a shared system prompt for the entire conversation.
 * This prompt is sent to all active models on every message via SendMessageOptions.systemPrompt.
 * Per-model system prompts (ModelConfig.systemPrompt) take precedence over this shared value
 * when both are set — that precedence rule is enforced by Atlas in sendMessage.ts.
 *
 * Persistence note: the Conversation type has no systemPrompt field (Arch owns types/index.ts).
 * This value is stored in App state (Map<conversationId, string>) and is lost on page reload.
 * Full persistence requires Arch to add `conversationSystemPrompt?: string` to Conversation —
 * see types gap note in session summary.
 *
 * Placement: rendered just above the model selector, below the message thread, in AppLayout.
 */

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { ChevronIcon } from './ChevronIcon';
import { SmallCloseIcon } from '@/ui/icons';

const PLACEHOLDER = 'Set a shared system prompt for all models in this conversation…';

interface ConversationSystemPromptBarProps {
  /** Current value of the conversation-level system prompt. */
  value: string;
  /** Called when the prompt changes. Parent stores the new value. */
  onChange: (value: string) => void;
  /** Whether a conversation is currently active. When false the bar is hidden. */
  hasActiveConversation: boolean;
}

/**
 * Collapsible bar that lets users set a shared system prompt for all models
 * in the current conversation. Sits just above the model selector trigger in AppLayout.
 */
export function ConversationSystemPromptBar({
  value,
  onChange,
  hasActiveConversation,
}: ConversationSystemPromptBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();
  const panelId = useId();

  const hasPrompt = value.trim().length > 0;

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Focus the textarea when the bar expands.
  useEffect(() => {
    if (isExpanded) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isExpanded]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-resize
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [onChange]);

  // Keyboard: Escape collapses the bar.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setIsExpanded(false);
    }
  }, []);

  // Don't render anything if there's no active conversation.
  if (!hasActiveConversation) return null;

  return (
    <div
      className="flex-shrink-0 px-4 pb-0"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-2">
        {/* Toggle button — always visible when a conversation is active */}
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={handleToggle}
          className={[
            'inline-flex items-center gap-[6px]',
            'h-7 px-[10px]',
            'text-[12px] font-medium',
            hasPrompt ? 'text-text-secondary' : 'text-text-muted',
            'bg-transparent border border-border-subtle rounded-full',
            'hover:border-border transition-[border-color,color] duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
            'cursor-pointer select-none',
          ].join(' ')}
        >
          {/* Inline document SVG — no shared icon covers this shape */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0"
          >
            <path
              d="M2 1.5A1.5 1.5 0 0 1 3.5 0h5L10 2.5V10.5A1.5 1.5 0 0 1 8.5 12h-5A1.5 1.5 0 0 1 2 10.5v-9Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path d="M8.5 0v2H10" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M4 5h4M4 7.5h2.5" stroke="currentColor" strokeWidth="0.85" strokeLinecap="round" />
          </svg>

          System prompt
          {hasPrompt && (
            <span
              className={[
                'text-[10px] font-semibold uppercase tracking-wider',
                'px-[5px] py-[1px] rounded-full',
                'bg-hover text-text-secondary border border-border-subtle',
              ].join(' ')}
              aria-label="System prompt is set"
            >
              Set
            </span>
          )}
          <ChevronIcon isOpen={isExpanded} />
        </button>

        {/* Expandable body — always rendered so aria-controls resolves to a real DOM node */}
        <div
          id={panelId}
          hidden={!isExpanded}
          className="mt-2"
        >
          <div className="relative isolate">
            <label htmlFor={textareaId} className="sr-only">
              Conversation system prompt — applies to all active models
            </label>
            <textarea
              ref={textareaRef}
              id={textareaId}
              value={value}
              onChange={handleChange}
              placeholder={PLACEHOLDER}
              rows={3}
              aria-label="Conversation system prompt — applies to all active models"
              className={[
                'w-full resize-none rounded-md',
                'bg-input border border-border',
                'text-[13px] leading-[1.5] text-text-primary',
                'placeholder:text-text-muted',
                'px-3 py-2',
                'min-h-[72px] max-h-[160px]',
                'transition-[border-color] duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                hasPrompt ? 'pr-10' : '',
              ].join(' ')}
              style={{ overflowY: 'auto' }}
            />

            {/* Clear button — only when prompt is non-empty */}
            {hasPrompt && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear conversation system prompt"
                title="Clear system prompt"
                className={[
                  'absolute top-1.5 right-1.5 z-10',
                  'w-6 h-6 flex items-center justify-center',
                  'rounded text-text-muted',
                  'hover:text-text-primary hover:bg-hover',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                ].join(' ')}
              >
                <SmallCloseIcon size={10} />
              </button>
            )}
          </div>

          {/* Helper text */}
          <p className="mt-1 text-[11px] text-text-muted">
            Sent to all active models before every reply. Per-model prompts take precedence when set.
          </p>
        </div>
      </div>
    </div>
  );
}
