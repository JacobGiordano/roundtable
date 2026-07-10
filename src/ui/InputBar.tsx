import { useRef, useState, useCallback, useId, useEffect } from 'react';
import type { Attachment, ModelConfig, BuiltInModelId } from '@/types';
// #147: shared icon system — GhostIcon, StopIcon, SendIcon, SmallCloseIcon, PhotoIcon.
// #321: PhotoIcon replaces PaperclipIcon — image-specific icon per Luma spec update 2026-07-02.
import { GhostIcon, StopIcon, SendIcon, SmallCloseIcon, PhotoIcon } from './icons';
// #294: resolveAccentCssColor routes custom providers through var(--accent-custom-{id})
// so the directed-reply chip shows the correct user-chosen color and picks up
// AccentColorPicker live-session overrides, instead of producing an invalid CSS var
// from a raw hex string (e.g. var(--#4285F4)).
import { resolveAccentCssColor } from './utils/modelColor';
// #285: useAttachments manages pending image attachments (add, remove, clear, limit check).
import { useAttachments } from './hooks/useAttachments';
// #285: VisionWarningModal — pre-send warning when some active models lack vision support.
import { VisionWarningModal } from './components/VisionWarningModal';
// #332: ProxyOnboardingModal — first-run setup guide shown when no proxy is configured in PROD.
import { ProxyOnboardingModal } from './components/ProxyOnboardingModal';
// Cross-agent exception: getProviderRoster is a Gate pure-read utility imported here to
// check per-provider vision capability at send time for the pre-send warning modal (#285).
// Does not cross the model or storage boundaries. Same permitted-exception pattern as
// getSidebarOpen/setSidebarOpen in AppLayout.tsx and getUserPreferences in usePreferencesSync.ts.
// Cross-agent exception: BUILTIN_MODEL_IDS and getProxyConfig are Gate pure-read utilities
// imported here to check (a) whether any active model is a built-in provider and (b) whether
// a proxy URL is configured, at send time for the proxy onboarding gate (#332).
import { getProviderRoster, BUILTIN_MODEL_IDS, getProxyConfig, saveProxyConfig } from '@/auth';

interface InputBarProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  /** When true, the send button and Enter-to-submit are disabled. Atlas sets this. */
  isStreaming?: boolean;
  /**
   * Called when the user clicks the stop button. Only active while isStreaming is true.
   * Wired to the AbortController in App.tsx — aborts all active provider streams.
   * Issue #159.
   */
  onStopMessage?: () => void;
  /** When true, shows the ghost mode SVG indicator and disables attachment (#285). */
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
   * Active ModelConfig list — used at send time to check per-provider vision capability
   * for the pre-send warning modal. Absence skips the vision check entirely. Issue #285.
   */
  activeModels?: ModelConfig[];
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
  /**
   * When set to a non-empty string, InputBar populates the textarea with this
   * text, focuses it, and calls onPrefillConsumed to reset. Used by
   * ConversationEmptyState suggestion chips to pre-fill the input. Issue #341.
   */
  prefillText?: string;
  /** Called after InputBar has consumed prefillText — resets it in AppLayout. */
  onPrefillConsumed?: () => void;
}

/**
 * Returns inline styles for the directed-reply pill using the model's CSS custom property.
 * color-mix() applies opacity to the background and border without affecting text color,
 * replacing the previous Tailwind opacity-modifier approach (which required one explicit
 * switch case per model because JIT cannot resolve dynamic class strings at build time).
 * Adding a new model to MODEL_REGISTRY now automatically works here — no code change needed.
 *
 * #294: modelId is required alongside color so resolveAccentCssColor can route custom
 * providers through var(--accent-custom-{id}). Without this, a raw hex stored in
 * ModelConfig.color (e.g. "#4285F4") would produce var(--#4285F4) — an invalid CSS
 * custom property name — causing the pill to render with no color at all.
 *
 * Text color is intentionally NOT set here — the chip uses text-text-secondary (Tailwind
 * class on the element) so it passes WCAG 1.4.3 across all 7 themes. Ada audit #294
 * found 23/56 accent-on-accent-tint combinations fail when the same accent is used for
 * both text and background tint. Accent identity is communicated via background tint and
 * the stronger 40% border.
 */
function getPillAccentStyle(color: string, modelId?: string): React.CSSProperties {
  const cssVar = resolveAccentCssColor(color, modelId);
  return {
    backgroundColor: `color-mix(in srgb, ${cssVar} 15%, transparent)`,
    borderColor: `color-mix(in srgb, ${cssVar} 40%, transparent)`,
  };
}

/**
 * Returns inline styles for an attachment thumbnail chip (#285).
 * Uses --accent-user (user message identity accent) at 15% bg / 40% border —
 * matching the chip pattern from HANDOFF: "border 40% + bg tint 15%; never accent as text color."
 */
function getAttachmentChipStyle(): React.CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, var(--accent-user) 15%, transparent)`,
    borderColor: `color-mix(in srgb, var(--accent-user) 40%, transparent)`,
  };
}

export function InputBar({
  onSend,
  isStreaming = false,
  onStopMessage,
  isGhostMode = false,
  directedReplyTarget,
  onClearDirectedReply,
  activeModelCount,
  activeModels,
  textareaId,
  editingMessage,
  onCancelEdit,
  prefillText,
  onPrefillConsumed,
}: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Track whether streaming has ever been active so the focus-return branch
  // (isStreaming → false) does not fire on initial render. We only want to
  // return focus when the stop→send swap actually occurs, not at mount time.
  const hasStreamedRef = useRef(false);

  // ── Attachment management (#285) ──────────────────────────────────────────
  const {
    attachments,
    error: attachError,
    addFiles,
    removeAttachment,
    clearAll,
    clearError,
  } = useAttachments();

  // Drag-over visual state. Counter-based to handle child element boundary crossings
  // without flickering: each dragenter increments, each dragleave decrements.
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // ── Attachment addition announcement (#368) ───────────────────────────────
  // The attachment chip list's aria-live="polite" is inside a conditionally-rendered
  // container — when the first file is dropped, both the live region and the new
  // content enter the DOM simultaneously, so AT won't reliably announce it.
  // This pre-mounted sr-only live region fires whenever attachments.length increases,
  // ensuring screen readers announce every addition regardless of first-mount timing.
  const prevAttachLengthRef = useRef(0);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState('');

  // Vision warning modal: holds the pending send payload when a confirmation is required.
  // Cleared when the user confirms ("Send anyway") or cancels.
  const [pendingVisionSend, setPendingVisionSend] = useState<{
    content: string;
    nonVisionModelNames: string[];
  } | null>(null);

  // Proxy onboarding modal: holds the pending message content when the modal is shown.
  // Cleared when the user saves a proxy URL and continues, or dismisses.
  // Only shown in PROD when a built-in provider is active and no proxy is configured.
  // content snapshot taken at the time of send; attachments are read live from state.
  const [pendingProxySend, setPendingProxySend] = useState<{
    content: string;
  } | null>(null);

  // Ref to the focused element before any modal opened — shared by VisionWarningModal
  // and ProxyOnboardingModal for focus restoration on close (WCAG 2.4.3).
  const focusReturnRef = useRef<HTMLElement | null>(null);

  // Manage focus across the send↔stop button swap (WCAG 2.4.3 — issue #244).
  useEffect(() => {
    if (isStreaming && onStopMessage) {
      hasStreamedRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => stopButtonRef.current?.focus());
      });
    } else if (!isStreaming && hasStreamedRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => textareaRef.current?.focus());
      });
    }
  }, [isStreaming, onStopMessage]);

  // Edit mode setup: pre-fill textarea, clear attachments, move focus.
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.originalContent);
      clearAll(); // Edits don't carry attachments (#285).
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => textareaRef.current?.focus());
      });
    }
  }, [editingMessage, clearAll]);

  // #341: Suggestion chip prefill — when AppLayout sets prefillText (via
  // ConversationEmptyState chip click), populate the textarea, resize it,
  // focus it, and immediately reset prefillText via onPrefillConsumed so a
  // second chip click with the same text re-triggers this effect.
  // onPrefillConsumed is wrapped in useCallback (stable reference) in AppLayout
  // so including it in deps here is safe — it never causes spurious re-runs.
  useEffect(() => {
    if (!prefillText) return;
    setValue(prefillText);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
    // Double rAF — same pattern as streaming stop/resume and edit-mode focus
    // in this file — ensures focus lands after React has fully flushed the
    // state update and the DOM reconciliation. Ada advisory #341.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    });
    onPrefillConsumed?.();
  }, [prefillText, onPrefillConsumed]);

  // Announce attachment additions to screen readers (#368).
  // Watches attachments.length — when it increases (file added via drop, paste, or picker),
  // populate the pre-mounted sr-only live region so AT announces the count.
  // The announcement clears after 3 s to avoid stale text in the live region.
  useEffect(() => {
    const prev = prevAttachLengthRef.current;
    const curr = attachments.length;
    prevAttachLengthRef.current = curr;

    if (curr > prev) {
      const added = curr - prev;
      setAttachmentAnnouncement(
        `${added} image${added > 1 ? 's' : ''} added. ${curr} of 5 attached.`,
      );
      const timer = setTimeout(() => setAttachmentAnnouncement(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [attachments]);

  // Ghost mode tooltip — 600ms hover delay per tooltip.md §1 (#210).
  const [isGhostTooltipVisible, setIsGhostTooltipVisible] = useState(false);
  const ghostHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostTooltipId = useId();

  // Attach button tooltip (ghost-mode-disabled state) — same 600ms hover delay.
  const [isAttachTooltipVisible, setIsAttachTooltipVisible] = useState(false);
  const attachHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachTooltipId = useId();

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

  const handleAttachMouseEnter = useCallback(() => {
    if (!isGhostMode) return;
    attachHoverTimerRef.current = setTimeout(() => {
      setIsAttachTooltipVisible(true);
    }, 600);
  }, [isGhostMode]);

  const handleAttachMouseLeave = useCallback(() => {
    if (attachHoverTimerRef.current !== null) {
      clearTimeout(attachHoverTimerRef.current);
      attachHoverTimerRef.current = null;
    }
    setIsAttachTooltipVisible(false);
  }, []);

  // canSend: true when there is text OR attachments (or both), not streaming,
  // and at least one model is active (when the model count gate is wired).
  const hasContent = value.trim().length > 0 || attachments.length > 0;
  const canSend =
    hasContent && !isStreaming && (activeModelCount === undefined || activeModelCount > 0);

  // ── Drag-and-drop (#285) ──────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  // Must preventDefault on dragover to allow drop events.
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      if (isGhostMode) return; // Ghost conversations must not persist files.
      if (e.dataTransfer.files.length > 0) {
        void addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, isGhostMode],
  );

  // ── Clipboard paste (#285) ────────────────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (isGhostMode) return;
      const imageItems = Array.from(e.clipboardData.items).filter(
        (item) =>
          item.kind === 'file' &&
          ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(item.type),
      );
      if (imageItems.length === 0) return;
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) {
        void addFiles(files);
        // Don't preventDefault: text content in the same paste still goes through.
      }
    },
    [addFiles, isGhostMode],
  );

  // ── File picker (#285) ────────────────────────────────────────────────────

  const handleAttachClick = useCallback(() => {
    if (isGhostMode) return; // aria-disabled: click no-ops in ghost mode.
    fileInputRef.current?.click();
  }, [isGhostMode]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void addFiles(e.target.files);
      }
      // Reset input value so re-selecting the same file works after removal.
      e.target.value = '';
      // #319: Return focus to the attach button after the native file dialog closes.
      // Chrome/Firefox restore focus automatically; Safari does not.
      requestAnimationFrame(() => attachButtonRef.current?.focus());
    },
    [addFiles],
  );

  // ── Vision check (#285) ───────────────────────────────────────────────────

  /**
   * Returns display names of active models that lack vision capability.
   * Reads the provider roster from Gate synchronously at send time — safe because
   * the roster cannot change while the user is composing (no background updates).
   */
  const getNonVisionModelNames = useCallback((): string[] => {
    if (!activeModels || activeModels.length === 0) return [];
    const roster = getProviderRoster();
    return activeModels
      .filter((m) => {
        const config = roster.find((r) =>
          r.kind === 'builtin' ? r.modelId === m.modelId : r.id === m.modelId,
        );
        // Conservative default: absent capabilities.vision = false.
        return !(config?.capabilities?.vision ?? false);
      })
      .map((m) => m.name);
  }, [activeModels]);

  // ── Proxy onboarding check (#332) ────────────────────────────────────────
  // Returns true when the proxy onboarding modal should be shown:
  //   - Only in PROD (import.meta.env.PROD); Vite dev proxy handles dev.
  //   - No proxy is configured yet (getProxyConfig() returns null).
  //   - At least one active model is a built-in provider (custom providers
  //     route directly to their own endpoint and do not need the proxy).
  const shouldShowProxyOnboarding = useCallback((): boolean => {
    if (!import.meta.env.PROD) return false;
    if (getProxyConfig() !== null) return false;
    return !!activeModels?.some((m) => BUILTIN_MODEL_IDS.has(m.modelId as BuiltInModelId));
  }, [activeModels]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const content = value.trim();

    // If attachments are pending, check for non-vision models.
    if (attachments.length > 0) {
      const nonVisionNames = getNonVisionModelNames();
      if (nonVisionNames.length > 0) {
        // Show the warning modal; capture current focus element for restoration.
        focusReturnRef.current = document.activeElement as HTMLElement;
        setPendingVisionSend({ content, nonVisionModelNames: nonVisionNames });
        return;
      }
    }

    // Proxy onboarding check (#332): PROD + built-in provider active + no proxy.
    if (shouldShowProxyOnboarding()) {
      focusReturnRef.current = document.activeElement as HTMLElement;
      setPendingProxySend({ content });
      return;
    }

    // All guards passed — send immediately.
    onSend(content, attachments);
    clearAll();
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [canSend, value, attachments, onSend, clearAll, getNonVisionModelNames, shouldShowProxyOnboarding]);

  const handleVisionModalSend = useCallback(() => {
    if (!pendingVisionSend) return;

    // Proxy onboarding check: if the user confirmed the vision warning but still
    // has no proxy in PROD, redirect to the proxy onboarding modal.
    if (shouldShowProxyOnboarding()) {
      focusReturnRef.current = document.activeElement as HTMLElement;
      setPendingProxySend({ content: pendingVisionSend.content });
      setPendingVisionSend(null);
      return;
    }

    onSend(pendingVisionSend.content, attachments);
    clearAll();
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setPendingVisionSend(null);
    // Focus restores via VisionWarningModal's cleanup useEffect (returnFocusRef).
  }, [pendingVisionSend, attachments, onSend, clearAll, shouldShowProxyOnboarding]);

  const handleVisionModalCancel = useCallback(() => {
    setPendingVisionSend(null);
    // Focus restores via VisionWarningModal's cleanup useEffect (returnFocusRef).
  }, []);

  // ── Proxy onboarding modal handlers (#332) ────────────────────────────────

  /**
   * Called by ProxyOnboardingModal when the user saves a proxy URL and continues.
   * Saves the proxy config via Gate, then re-submits the original pending message.
   * The modal's 100ms save-feedback beat already elapsed before this fires.
   */
  const handleProxyModalContinue = useCallback(
    (proxyUrl: string) => {
      if (!pendingProxySend) return;
      // Save proxy config via Gate — Atlas will read this at call time.
      saveProxyConfig({ url: proxyUrl });
      // Re-submit the original message. Attachments are still in state (not cleared yet).
      onSend(pendingProxySend.content, attachments);
      clearAll();
      setValue('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setPendingProxySend(null);
      // Focus restores via ProxyOnboardingModal's cleanup useEffect (returnFocusRef).
    },
    [pendingProxySend, attachments, onSend, clearAll],
  );

  /**
   * Called by ProxyOnboardingModal when the user dismisses ("I'll set this up later").
   * The original message remains in the InputBar textarea — nothing is cleared.
   */
  const handleProxyModalDismiss = useCallback(() => {
    setPendingProxySend(null);
    // Focus restores via ProxyOnboardingModal's cleanup useEffect (returnFocusRef).
  }, []);

  // ── Chip keyboard (#285) ──────────────────────────────────────────────────

  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, attachmentId: string, chipIndex: number) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      removeAttachment(attachmentId);
      // After removal, focus: previous chip's remove button (if any) or the attach button.
      requestAnimationFrame(() => {
        if (chipIndex > 0) {
          const chips = document.querySelectorAll<HTMLElement>('[data-chip-remove]');
          chips[chipIndex - 1]?.focus();
        } else {
          attachButtonRef.current?.focus();
        }
      });
    },
    [removeAttachment],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && editingMessage) {
        e.preventDefault();
        setValue('');
        onCancelEdit?.();
      } else if (e.key === 'Escape' && directedReplyTarget && !editingMessage) {
        e.preventDefault();
        e.stopPropagation();
        onClearDirectedReply?.();
      }
    },
    [handleSend, editingMessage, onCancelEdit, directedReplyTarget, onClearDirectedReply],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const placeholderText = editingMessage
    ? 'Edit your message…'
    : directedReplyTarget
      ? `Ask ${directedReplyTarget.name}...`
      : activeModelCount === 0
        ? 'Add a model to start chatting'
        : 'Ask all models...';

  // Whether any "top section" (pill / edit banner / chips) is shown above the main input row.
  // Determines border/rounding class on the main container.
  const hasTopSection =
    !!directedReplyTarget || !!editingMessage || attachments.length > 0 || !!attachError;

  return (
    <div
      className="w-full relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-over visual overlay (#285) — signals droppable zone to the user.
          pointer-events-none so it doesn't intercept the drop event on the container. */}
      {isDragOver && (
        <div
          className={[
            'absolute inset-0 z-10 rounded-t-lg',
            'border-2 border-dashed border-border-strong',
            'flex items-center justify-center pointer-events-none',
          ].join(' ')}
          style={{ backgroundColor: `color-mix(in srgb, var(--accent-user) 8%, transparent)` }}
          aria-hidden="true"
        >
          <span className="text-[13px] font-medium text-text-secondary select-none">
            Drop images here
          </span>
        </div>
      )}

      {/* Hidden file input — triggered programmatically by the paper-clip button.
          sr-only + aria-hidden + tabIndex={-1}: never in the tab order or AT tree. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileInputChange}
      />

      {/* Vision warning modal (#285) — rendered inside InputBar so returnFocusRef
          can point directly to the attach button or textarea ref. */}
      {pendingVisionSend && (
        <VisionWarningModal
          nonVisionModelNames={pendingVisionSend.nonVisionModelNames}
          onSendAnyway={handleVisionModalSend}
          onCancel={handleVisionModalCancel}
          returnFocusRef={focusReturnRef as React.RefObject<HTMLElement | null>}
        />
      )}

      {/* Proxy onboarding modal (#332) — first-run setup when no proxy is configured in PROD.
          Saves via Gate (saveProxyConfig) then re-submits the original message. */}
      {pendingProxySend && (
        <ProxyOnboardingModal
          onSaveAndContinue={handleProxyModalContinue}
          onDismiss={handleProxyModalDismiss}
          returnFocusRef={focusReturnRef as React.RefObject<HTMLElement | null>}
        />
      )}

      {/* Edit mode banner (#162) */}
      {editingMessage && (
        <div
          className={[
            'px-3 pt-2',
            'bg-input border-t border-x border-border rounded-t-lg',
            'flex items-center justify-between',
          ].join(' ')}
        >
          <span className="text-[12px] font-medium text-text-secondary" aria-live="polite">
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

      {/* Directed-reply pill */}
      {directedReplyTarget && (
        <div
          className={[
            'px-3 pt-2',
            'bg-input',
            editingMessage
              ? 'border-x border-border'
              : 'border-t border-x border-border rounded-t-lg',
            'flex items-center',
          ].join(' ')}
        >
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium text-text-secondary"
            style={getPillAccentStyle(directedReplyTarget.color, directedReplyTarget.modelId)}
          >
            <span aria-hidden="true">→</span>
            <span>{directedReplyTarget.name}</span>
            {onClearDirectedReply && (
              <button
                type="button"
                onClick={onClearDirectedReply}
                aria-label={`Clear directed reply to ${directedReplyTarget.name}`}
                className={[
                  'flex items-center justify-center',
                  'w-6 h-6 rounded-full',
                  'hover:bg-black/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  'transition-colors duration-fast',
                ].join(' ')}
              >
                <SmallCloseIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Attachment chips row (#285) — horizontal scrollable list of pending thumbnails.
          Rendered above the main input row, below any edit-banner or directed-reply pill.
          Only shown when there are pending attachments or an active error. */}
      {(attachments.length > 0 || attachError) && (
        <div
          className={[
            'px-3 pt-2',
            'bg-input',
            // If another section (pill or edit banner) is already above us, skip border-t
            // (it's already provided). Otherwise this is the topmost section.
            (directedReplyTarget || editingMessage)
              ? 'border-x border-border'
              : 'border-t border-x border-border rounded-t-lg',
          ].join(' ')}
        >
          {attachError && (
            <p
              className="text-[12px] mb-1.5"
              role="alert"
              style={{ color: 'var(--semantic-error)' }}
            >
              {attachError}
              <button
                type="button"
                onClick={clearError}
                className={[
                  'ml-2 underline hover:no-underline',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
                ].join(' ')}
                aria-label="Dismiss attachment error"
              >
                Dismiss
              </button>
            </p>
          )}

          {attachments.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              role="list"
              aria-label="Pending attachments"
              aria-live="polite"
              aria-relevant="additions removals"
            >
              {attachments.map((att, index) => (
                <div
                  key={att.id}
                  role="listitem"
                  className={[
                    'flex-shrink-0 inline-flex items-center gap-1.5',
                    'h-10 pl-1.5 pr-2 rounded-md border',
                    'text-[12px] font-medium text-text-secondary',
                    'max-w-[160px]',
                  ].join(' ')}
                  style={getAttachmentChipStyle()}
                >
                  {/* Thumbnail — prepend data-URL prefix (Attachment.base64 is raw). */}
                  <img
                    src={`data:${att.mimeType};base64,${att.base64}`}
                    alt=""
                    aria-hidden="true"
                    className="w-7 h-7 rounded object-cover flex-shrink-0"
                  />
                  <span className="truncate flex-1 min-w-0">
                    {att.filename ?? att.mimeType.replace('image/', '')}
                  </span>
                  <button
                    type="button"
                    data-chip-remove="true"
                    onClick={() => {
                      removeAttachment(att.id);
                      // Restore focus after removal (WCAG 2.4.3): Enter/Space activates
                      // onClick, deleting this button from the DOM. Without explicit focus
                      // management, focus falls to document.body. Match handleChipKeyDown:
                      // move to the previous chip's remove button, or the attach button.
                      requestAnimationFrame(() => {
                        if (index > 0) {
                          const chips = document.querySelectorAll<HTMLElement>('[data-chip-remove]');
                          chips[index - 1]?.focus();
                        } else {
                          attachButtonRef.current?.focus();
                        }
                      });
                    }}
                    onKeyDown={(e) => handleChipKeyDown(e, att.id, index)}
                    aria-label={`Remove ${att.filename ?? att.mimeType}`}
                    className={[
                      'flex-shrink-0 flex items-center justify-center',
                      'w-5 h-5 rounded-full',
                      'hover:bg-black/15',
                      'transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    ].join(' ')}
                  >
                    <SmallCloseIcon size={7} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main input container */}
      <div
        className={[
          'w-full bg-input',
          'border-t border-border',
          hasTopSection
            ? 'border-x border-b border-border rounded-b-none rounded-t-none'
            : 'rounded-t-lg rounded-b-none',
          'shadow-md',
          'px-3 py-3',
          isFocused ? 'border-border-strong' : '',
          'transition-[border-color] duration-fast',
        ].join(' ')}
      >
        {/* Input row: ghost icon | live regions | attach button | textarea | stop/send */}
        <div className="flex items-end gap-2">
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
              <div
                id={ghostTooltipId}
                role="tooltip"
                className={[
                  'absolute bottom-full left-0 mb-2',
                  'bg-sidebar border border-border rounded-sm',
                  'px-3 py-2 text-[11px] leading-[1.4] text-text-primary whitespace-nowrap',
                  'pointer-events-none transition-opacity duration-fast z-20',
                  isGhostTooltipVisible ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
              >
                Ghost mode — this conversation won't be saved
                <span
                  className="absolute top-full left-3 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {/* Always-present live regions (WCAG 4.1.3) */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {isGhostMode ? "Ghost mode on — messages won't be saved" : 'Ghost mode off'}
          </span>
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {isStreaming ? 'Generating response — press Stop to cancel' : ''}
          </span>
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {directedReplyTarget
              ? `Directed reply mode: sending to ${directedReplyTarget.name}`
              : ''}
          </span>
          {/* Attachment addition announcer (#368) — pre-mounted so screen readers
              reliably announce drops and pastes even when the chip list is first entering
              the DOM. Populated by the attachments useEffect above. */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {attachmentAnnouncement}
          </span>

          {/* Attach button (#285) — opens the file picker.
              Hidden during edit mode (edits don't carry new attachments).
              aria-disabled (not disabled) in ghost mode so the tooltip is keyboard-reachable
              and screen readers announce the disabled state. Click no-ops when aria-disabled. */}
          {!editingMessage && (
            <div
              className="relative flex-shrink-0 self-end"
              onMouseEnter={handleAttachMouseEnter}
              onMouseLeave={handleAttachMouseLeave}
            >
              <button
                ref={attachButtonRef}
                type="button"
                onClick={handleAttachClick}
                aria-label="Attach images"
                aria-disabled={isGhostMode ? 'true' : undefined}
                aria-describedby={isGhostMode ? attachTooltipId : undefined}
                onFocus={() => { if (isGhostMode) setIsAttachTooltipVisible(true); }}
                onBlur={() => setIsAttachTooltipVisible(false)}
                className={[
                  'flex items-center justify-center',
                  'w-9 h-9 min-w-[44px] min-h-[44px] rounded-md',
                  isGhostMode
                    ? 'text-text-muted opacity-50 cursor-not-allowed'
                    : 'text-text-muted hover:text-text-secondary hover:bg-hover cursor-pointer',
                  'transition-[color,background-color,opacity] duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                <PhotoIcon size={16} />
              </button>

              {/* Tooltip for the ghost-mode-disabled attach button — 600ms hover delay,
                  immediate on focus. Explains why attachment is unavailable. */}
              {isGhostMode && (
                <div
                  id={attachTooltipId}
                  role="tooltip"
                  className={[
                    'absolute bottom-full left-0 mb-2 w-max max-w-[200px]',
                    'bg-sidebar border border-border rounded-sm shadow-md',
                    'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
                    'pointer-events-none transition-opacity duration-fast z-20',
                    isAttachTooltipVisible ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                >
                  Attachments aren't saved in ghost mode
                  <span
                    className="absolute top-full left-3 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            id={textareaId}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholderText}
            rows={1}
            className={[
              'flex-1 resize-none bg-transparent border-none outline-none',
              'text-[15px] font-normal leading-[1.5] text-text-primary',
              'placeholder:text-text-muted',
              // py-[3px] overrides the browser-default textarea padding (~2px top in Chrome,
              // 0–2px in Firefox/Safari) with an explicit value so text center lands at the
              // same optical baseline as the 44px button icons in every browser.
              // Math (items-end row = 44px, textarea = 36px bottom-aligned):
              //   textarea top = 44 - 36 = 8px from row top
              //   text center  = 8 + 3 (pad-top) + 11.25 (lineHeight/2) = 22.25px
              //   button icon  = 44 / 2 = 22px  → delta ≈ 0.25px (imperceptible). #321
              'min-h-[36px] max-h-[200px] py-[3px]',
              'self-end',
              'focus-visible:outline-none',
              isStreaming ? 'cursor-text' : '',
            ].join(' ')}
            style={{ overflowY: 'auto' }}
            aria-label="Message input"
            aria-multiline="true"
          />

          {/* Stop button (streaming) / Send button */}
          {isStreaming && onStopMessage ? (
            <button
              ref={stopButtonRef}
              type="button"
              onClick={onStopMessage}
              aria-label="Stop generating"
              className={[
                'flex-shrink-0 w-9 h-9 min-w-[44px] min-h-[44px] rounded-md',
                'flex items-center justify-center',
                'bg-hover hover:brightness-110 active:brightness-90 active:scale-[0.96]',
                'text-text-secondary hover:text-text-primary',
                'transition-[background-color,filter,transform] duration-fast cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              ].join(' ')}
            >
              <StopIcon />
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
