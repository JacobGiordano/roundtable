import { useRef, useState, useCallback } from 'react';

interface InputBarProps {
  onSend: (content: string) => void;
  /** When true, the send button and Enter-to-submit are disabled. Atlas sets this. */
  isStreaming?: boolean;
  /** When true, shows the ghost mode SVG indicator. Gate wires this up in a later issue. */
  isGhostMode?: boolean;
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

export function InputBar({ onSend, isStreaming = false, isGhostMode = false }: InputBarProps) {
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

  return (
    <div
      className={[
        'w-full bg-input',
        'border-t border-border',
        'rounded-t-lg rounded-b-none',
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

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Ask all models..."
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

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className={[
          'flex-shrink-0 w-9 h-9 rounded-md',
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
  );
}
