/**
 * SystemPromptRow — single row in the system prompts section of ModelSelectorPanel.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
 *
 * Shows the model name, a color dot, an expandable textarea for the system
 * prompt, and a clear button when a prompt is set.
 */

import { useState, useRef, useCallback } from 'react';
import type { ModelConfig, ModelId } from '@/types';
// #150: shared ChevronIcon replaces the local copy.
import { ChevronIcon } from '../ChevronIcon';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

/** Default placeholder text for the system prompt textarea. */
const SYSTEM_PROMPT_PLACEHOLDER =
  'Give this model a persona, set context, or restrict its behavior…';

export interface SystemPromptRowProps {
  model: ModelConfig;
  onUpdate: (modelId: ModelId, value: string) => void;
}

export function SystemPromptRow({ model, onUpdate }: SystemPromptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasPrompt = Boolean(model.systemPrompt && model.systemPrompt.trim().length > 0);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        // Focus textarea once it mounts
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(model.modelId, e.target.value);
      // Auto-resize
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },
    [model.modelId, onUpdate],
  );

  const handleClear = useCallback(() => {
    onUpdate(model.modelId, '');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [model.modelId, onUpdate]);

  const rowId = `system-prompt-${model.modelId}`;

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      {/* Header row — always visible */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={rowId}
        onClick={handleToggle}
        className={[
          'w-full flex items-center gap-2 h-9 px-1',
          'text-left cursor-pointer select-none',
          'hover:bg-hover rounded',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
        ].join(' ')}
      >
        {/* Color dot */}
        <span
          className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={getModelDotStyle(model.modelId)}
          aria-hidden="true"
        />

        {/* Model name */}
        <span className="text-[13px] font-medium text-text-primary flex-1">
          {model.name}
        </span>

        {/* "Set" badge — shown when a prompt exists and row is collapsed */}
        {hasPrompt && !isExpanded && (
          <span
            className={[
              'text-[10px] font-semibold uppercase tracking-wider',
              'px-[6px] py-[2px] rounded-full',
              'bg-hover text-text-secondary border border-border-subtle',
            ].join(' ')}
            aria-label="System prompt is set"
          >
            Set
          </span>
        )}

        {/* Chevron */}
        <ChevronIcon isOpen={isExpanded} />
      </button>

      {/* Expandable body */}
      {isExpanded && (
        <div
          id={rowId}
          className="pb-3 pt-1 px-1"
        >
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={model.systemPrompt ?? ''}
              onChange={handleChange}
              placeholder={SYSTEM_PROMPT_PLACEHOLDER}
              rows={3}
              aria-label={`System prompt for ${model.name}`}
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

            {/* Clear button — only shown when prompt is non-empty */}
            {hasPrompt && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={`Clear system prompt for ${model.name}`}
                title="Clear system prompt"
                className={[
                  'absolute top-2 right-2',
                  'w-5 h-5 flex items-center justify-center',
                  'rounded text-text-muted',
                  'hover:text-text-primary hover:bg-hover',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                ].join(' ')}
              >
                {/* × icon */}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path
                    d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Character hint */}
          <p className="mt-1 text-[11px] text-text-muted">
            Sent as the system message before every reply from {model.name}.
          </p>
        </div>
      )}
    </div>
  );
}
