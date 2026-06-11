import { useRef, useState, useCallback } from 'react';
import type { ModelConfig } from '@/types';

interface InputBarProps {
  onSend: (content: string) => void;
  /** When true, the send button and Enter-to-submit are disabled. Atlas sets this. */
  isStreaming?: boolean;
  /** When true, shows the ghost mode SVG indicator. Gate wires this up in a later issue. */
  isGhostMode?: boolean;
  /**
   * When set, the InputBar is in directed-reply mode. A pill showing "→ [Model]"
   * is displayed above the input row, using the model's accent color.
   * Clearing it via onClearDirectedReply returns to broadcast mode.
   */
  directedReplyTarget?: ModelConfig;
  /** Called when the user clicks × on the directed-reply pill to return to broadcast mode. */
  onClearDirectedReply?: () => void;
}

/** Ghost icon: SVG outline, 16×16. Used when ghost mode is active. */
function GhostIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ghost body outline */}
      <path
        d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6v5.5l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1.5 1V6c0-2.485-2.015-4.5-4.5-4.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <circle cx="6.5" cy="6.5" r="0.75" fill="currentColor" />
      <circle cx="9.5" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

/** Send arrow icon: right-pointing arrow, 16×16. */
function SendIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 8h12M9 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={disabled ? 'text-text-muted' : 'text-text-inverse'}
      />
    </svg>
  );
}

/**
 * Returns inline styles for the directed-reply pill using the model's CSS custom property.
 * color-mix() applies opacity to the background and border without affecting text color,
 * replacing the previous Tailwind opacity-modifier approach (which required one explicit
 * switch case per model because JIT cannot resolve dynamic class strings at build time).
 * Adding a new model to MODEL_REGISTRY now automatically works here — no code change needed.
 */
function getPillAccentStyle(color: string): React.CSSProperties {
  const cssVar = `var(--${color})`;
  return {
    backgroundColor: `color-mix(in srgb, ${cssVar} 15%, transparent)`,
    color: cssVar,
    borderColor: `color-mix(in srgb, ${cssVar} 30%, transparent)`,
  };
}

export function InputBar({
  onSend,
  isStreaming = false,
  isGhostMode = false,
  directedReplyTarget,
  onClearDirectedReply,
}: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const isEmpty = value.trim().length === 0;
  const canSend = !isEmpty && !isStreaming;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // Return focus to textarea
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [canSend, onSend, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);

    // Auto-resize: reset then set to scrollHeight, capped at 200px
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const placeholderText = directedReplyTarget
    ? `Ask ${directedReplyTarget.name}...`
    : 'Ask all models...';

  return (
    <div
      className="w-full"
      // Safe-area inset for iOS home indicator — prevents content from being
      // obscured by the gesture bar on modern iPhones. env() with a 0px fallback
      // for browsers that don't support the safe-area-inset environment variables.
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Directed-reply pill — rendered above the input row when a target model is set.
          Uses the model's accent color to make directed mode visually distinct.
          The pill sits flush against the input row (no gap) to read as a single unit. */}
      {directedReplyTarget && (
        <div
          className={[
            'px-3 pt-2',
            'bg-input border-t border-x border-border rounded-t-lg',
            'flex items-center',
          ].join(' ')}
        >
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium"
            style={getPillAccentStyle(directedReplyTarget.color)}
            aria-live="polite"
            aria-label={`Directed reply mode: sending to ${directedReplyTarget.name}`}
          >
            <span aria-hidden="true">→</span>
            <span>{directedReplyTarget.name}</span>
            {onClearDirectedReply && (
              <button
                type="button"
                onClick={onClearDirectedReply}
                aria-label={`Clear directed reply to ${directedReplyTarget.name}`}
                className={[
                  'ml-0.5 flex items-center justify-center',
                  'w-4 h-4 rounded-full',
                  'hover:bg-black/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  'transition-colors duration-fast',
                ].join(' ')}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={[
          'w-full bg-input',
          'border-t border-border',
          directedReplyTarget ? 'border-x border-b border-border rounded-b-none rounded-t-none' : 'rounded-t-lg rounded-b-none',
          'shadow-md',
          'px-3 py-3',
          'flex items-end gap-2',
          isFocused ? 'border-border-strong' : '',
          'transition-[border-color] duration-fast',
        ].join(' ')}
      >
        {/* Ghost mode indicator — left side, shown only when active */}
        {isGhostMode && (
          <div
            className="flex-shrink-0 text-text-muted self-center relative group"
            title="Ghost mode — this conversation won't be saved"
          >
            <GhostIcon />
            {/* Tooltip */}
            <div
              className={[
                'absolute bottom-full left-0 mb-2',
                'bg-sidebar border border-border rounded-sm',
                'px-3 py-2 text-[10px] text-text-primary whitespace-nowrap',
                'pointer-events-none opacity-0 group-hover:opacity-100',
                'transition-opacity duration-fast',
              ].join(' ')}
              role="tooltip"
            >
              Ghost mode — this conversation won't be saved
            </div>
          </div>
        )}

        {/* Visually-hidden live region — announces ghost mode state changes to screen readers.
            Always present in the DOM so the browser registers it as a live region before any
            update fires. Text changes on every isGhostMode toggle, causing a polite announcement.
            The initial render text is not announced; only subsequent changes are. */}
        <span
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {isGhostMode ? 'Ghost mode on — messages won\'t be saved' : 'Ghost mode off'}
        </span>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholderText}
          rows={1}
          className={[
            'flex-1 resize-none bg-transparent border-none outline-none',
            'text-[15px] font-normal leading-[1.5] text-text-primary',
            'placeholder:text-text-muted',
            'min-h-[36px] max-h-[200px]',
            'self-end',
            // Disable new-message submit while streaming, but still allow typing
            isStreaming ? 'cursor-text' : '',
          ].join(' ')}
          style={{ overflowY: 'auto' }}
          aria-label="Message input"
          aria-multiline="true"
        />

        {/* Send button — visible area is 36×36px but tap target is expanded to 44×44px
            via min-w/min-h to meet WCAG 2.5.5 (AAA) and iOS HIG touch target guidelines.
            The visual button uses w-9 h-9 (36px); the extra area is transparent padding. */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={[
            'flex-shrink-0 w-9 h-9 min-w-[44px] min-h-[44px] rounded-md',
            'flex items-center justify-center',
            'transition-[background-color,filter,transform] duration-fast',
            canSend
              ? 'bg-accent-claude hover:brightness-110 active:brightness-90 active:scale-[0.96] cursor-pointer'
              : 'bg-hover cursor-not-allowed opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <SendIcon disabled={!canSend} />
        </button>
      </div>
    </div>
  );
}
