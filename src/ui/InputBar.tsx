import { useRef, useState, useCallback, useId, useEffect } from 'react';
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
  /**
   * Number of currently active models. When 0, the send button is disabled and
   * the placeholder changes to "Add a model to start chatting".
   * Spec: provider-settings.md §3.3. Omitting (undefined) disables this gate.
   */
  activeModelCount?: number;
  /**
   * When provided, applied as the `id` attribute on the textarea element.
   * Used by AppLayout to place `id="skip-target"` on the primary interactive
   * element so the skip-to-main-content link lands on a focusable element
   * rather than the non-interactive <main> container. See WCAG 2.4.1.
   */
  textareaId?: string;
  /**
   * When set, InputBar is in edit mode — pre-filled with this content.
   * A Cancel button is shown. Pressing Escape or clicking Cancel calls onCancelEdit.
   */
  editingMessage?: { messageIndex: number; originalContent: string };
  /** Called when user clicks Cancel in edit mode or presses Escape. */
  onCancelEdit?: () => void;
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
  activeModelCount,
  textareaId,
  editingMessage,
  onCancelEdit,
}: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Edit mode: when editingMessage is set, pre-fill the textarea with the original
  // content and move focus to it. Clears when editingMessage becomes null.
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.originalContent);
      // Reset height to auto first, then let the auto-resize compute the new height.
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
      // Move focus to the textarea so the user can start editing immediately.
      // Double-rAF ensures the DOM has settled after any React re-renders.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => textareaRef.current?.focus());
      });
    }
  }, [editingMessage]);

  // Ghost mode tooltip — 600ms hover delay per tooltip.md §1 (#210).
  // Hover shows after intentionality delay; focus shows immediately.
  const [isGhostTooltipVisible, setIsGhostTooltipVisible] = useState(false);
  const ghostHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostTooltipId = useId();

  const handleGhostMouseEnter = useCallback(() => {
    ghostHoverTimerRef.current = setTimeout(() => {
      setIsGhostTooltipVisible(true);
    }, 600);
  }, []);

  const handleGhostMouseLeave = useCallback(() => {
    if (ghostHoverTimerRef.current !== null) {
      clearTimeout(ghostHoverTimerRef.current);
      ghostHoverTimerRef.current = null;
    }
    setIsGhostTooltipVisible(false);
  }, []);

  const isEmpty = value.trim().length === 0;
  // §3.3: gate on zero active models in addition to the streaming/empty checks.
  // activeModelCount undefined means the gate is not wired — don't block send.
  const canSend = !isEmpty && !isStreaming && (activeModelCount === undefined || activeModelCount > 0);

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
      // Escape in edit mode cancels the edit and clears the textarea.
      if (e.key === 'Escape' && editingMessage) {
        e.preventDefault();
        setValue('');
        onCancelEdit?.();
      }
    },
    [handleSend, editingMessage, onCancelEdit],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);

    // Auto-resize: reset then set to scrollHeight, capped at 200px
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // §3.3: when zero models are active, tell the user they need to add one first.
  // In edit mode, override the placeholder so the user knows what they're doing.
  const placeholderText = editingMessage
    ? 'Edit your message…'
    : directedReplyTarget
      ? `Ask ${directedReplyTarget.name}...`
      : activeModelCount === 0
        ? 'Add a model to start chatting'
        : 'Ask all models...';

  return (
    <div
      className="w-full"
      // Safe-area inset for iOS home indicator — prevents content from being
      // obscured by the gesture bar on modern iPhones. env() with a 0px fallback
      // for browsers that don't support the safe-area-inset environment variables.
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Edit mode banner — rendered above the input row when editing a message (#162).
          Sits flush against the input row (same pattern as the directed-reply pill).
          The Cancel button lets the user abandon the edit and restore normal mode. */}
      {editingMessage && (
        <div
          className={[
            'px-3 pt-2',
            'bg-input border-t border-x border-border rounded-t-lg',
            'flex items-center justify-between',
          ].join(' ')}
        >
          <span
            className="text-[12px] font-medium text-text-secondary"
            aria-live="polite"
          >
            Editing message
          </span>
          {onCancelEdit && (
            <button
              type="button"
              onClick={() => {
                setValue('');
                onCancelEdit();
              }}
              aria-label="Cancel edit"
              className={[
                'text-[12px] font-medium text-text-secondary',
                'hover:text-text-primary',
                'px-2 py-0.5 rounded',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
          )}
        </div>
      )}

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
          (directedReplyTarget || editingMessage) ? 'border-x border-b border-border rounded-b-none rounded-t-none' : 'rounded-t-lg rounded-b-none',
          'shadow-md',
          'px-3 py-3',
          'flex items-end gap-2',
          isFocused ? 'border-border-strong' : '',
          'transition-[border-color] duration-fast',
        ].join(' ')}
      >
        {/* Ghost mode indicator — left side, shown only when active.
            tabIndex={0} makes this keyboard-reachable so screen reader users can
            access the tooltip via focus. onFocus shows immediately (0ms per
            tooltip.md §1); onBlur hides immediately. The title attribute is
            omitted to prevent double-announcement alongside aria-describedby
            (NVDA/Firefox double-reads both). */}
        {isGhostMode && (
          <div
            className="flex-shrink-0 text-text-muted self-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded"
            tabIndex={0}
            aria-label="Ghost mode — this conversation won't be saved"
            aria-describedby={ghostTooltipId}
            onMouseEnter={handleGhostMouseEnter}
            onMouseLeave={handleGhostMouseLeave}
            onFocus={() => setIsGhostTooltipVisible(true)}
            onBlur={() => setIsGhostTooltipVisible(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsGhostTooltipVisible(false); }}
          >
            <GhostIcon />
            {/* Tooltip — shown after 600ms hover delay per tooltip.md §1 (#210).
                Always in DOM so aria-describedby reference is never broken.
                Opacity controlled by JS state rather than CSS group-hover to
                enable the intentionality delay. */}
            <div
              id={ghostTooltipId}
              role="tooltip"
              className={[
                'absolute bottom-full left-0 mb-2',
                'bg-sidebar border border-border rounded-sm',
                'px-3 py-2 text-[11px] leading-[1.4] text-text-primary whitespace-nowrap',
                'pointer-events-none',
                'transition-opacity duration-fast',
                'z-20',
                isGhostTooltipVisible ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              Ghost mode — this conversation won't be saved
              {/* Caret */}
              <span
                className="absolute top-full left-3 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
                aria-hidden="true"
              />
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
          id={textareaId}
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
            // focus-visible: prevents the ring from showing on mouse clicks while
            // still rendering it for keyboard navigation. (#234)
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
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
