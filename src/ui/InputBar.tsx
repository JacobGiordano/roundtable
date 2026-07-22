import { useRef, useState, useCallback, useId, useEffect } from 'react';
import type { Attachment, ModelConfig, ModelId, BuiltInModelId } from '@/types';
// #382: AtMentionAutocomplete — popover for @model autocomplete in the textarea.
import { AtMentionAutocomplete, filterModels } from './components/AtMentionAutocomplete';
// #382: MentionHighlightOverlay — shows tinted @ModelName highlight over the textarea.
import { MentionHighlightOverlay } from './components/MentionHighlightOverlay';
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
  /**
   * Called when the user submits a message.
   * `targetModelId` is set when the user typed an @mention — InputBar strips
   * the @ModelName token from content before passing it here. Atlas uses this
   * to route only to the mentioned model. Issue #382.
   */
  onSend: (content: string, attachments: Attachment[], targetModelId?: ModelId) => void;
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
   * Called when the user clicks the ghost mode icon in the input bar to toggle
   * ghost mode on/off. When provided, the ghost icon becomes a button mirroring
   * the sidebar ghost-mode toggle (#470). When absent, the icon is display-only
   * (tooltip remains available).
   */
  onToggleGhostMode?: () => void;
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
  onToggleGhostMode,
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

  // ── @mention autocomplete state (#382) ────────────────────────────────────
  // mentionQuery: the text typed after "@" at the current cursor position.
  // null = popover is closed. '' = "@" just typed (show all active models).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // mentionActiveIndex: which item in the filtered list is highlighted. -1 = none.
  const [mentionActiveIndex, setMentionActiveIndex] = useState(-1);
  // mentionedModel: the model the user selected via @mention, cleared on send.
  // When set, send strips "@ModelName" from content and routes to this model.
  const [mentionedModel, setMentionedModel] = useState<ModelConfig | null>(null);
  // mentionStartIndex: where in the value string the "@" trigger begins.
  const mentionStartIndexRef = useRef<number>(-1);
  // Stable listbox id — generated once per InputBar mount.
  const mentionListboxId = useId();
  // comboboxRef: ref to the div[role="combobox"] wrapper around the textarea.
  // AtMentionAutocomplete sets aria-expanded, aria-controls, aria-haspopup, and
  // aria-activedescendant on THIS element — not the textarea — because those
  // attributes are only valid on combobox-role elements per axe-core aria-allowed-attr.
  // Issue #382.
  const comboboxRef = useRef<HTMLDivElement>(null);

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
  // #382: when a model is selected via @mention, check that stripping the mention
  // token leaves non-empty content (or attachments are present). This prevents
  // sending an empty message when the user types only "@ModelName" with nothing else.
  const effectiveContent = mentionedModel
    ? value.trim().replace(`@${mentionedModel.name}`, '').trim()
    : value.trim();
  const hasContent = effectiveContent.length > 0 || attachments.length > 0;
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

  // ── @mention strip helper (#382) ─────────────────────────────────────────
  /**
   * When a model was selected via @mention, strip the "@ModelName" token from
   * the content before sending. The mention is routing metadata, not message
   * content (Luma spec: at-mention.md §Q1). Strips the first occurrence of
   * "@ModelName" (with optional surrounding whitespace) from the trimmed content.
   */
  const stripMentionFromContent = useCallback(
    (content: string, model: ModelConfig | null): { stripped: string; targetId: ModelId | undefined } => {
      if (!model) return { stripped: content, targetId: undefined };
      const mentionToken = `@${model.name}`;
      // Strip the token and any space immediately following it.
      const stripped = content.replace(mentionToken, '').replace(/\s{2,}/g, ' ').trim();
      return { stripped, targetId: model.modelId };
    },
    [],
  );

  // ── @mention core callbacks (#382) ───────────────────────────────────────
  // These are declared before handleSend/handleKeyDown because those callbacks
  // reference them in their dependency arrays and bodies.

  /** Dismiss the @mention popover and reset all related state. */
  const dismissMention = useCallback(() => {
    setMentionQuery(null);
    setMentionActiveIndex(-1);
    mentionStartIndexRef.current = -1;
  }, []);

  /**
   * Gets the active models filtered for @mention use.
   * Excludes models not currently active in the conversation.
   */
  const getMentionCandidates = useCallback((): ModelConfig[] => {
    return (activeModels ?? []).filter((m) => m.isActive);
  }, [activeModels]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const rawContent = value.trim();

    // #382: strip @mention token and resolve targetModelId before any guard check.
    const { stripped: content, targetId: mentionTargetId } = stripMentionFromContent(rawContent, mentionedModel);

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
    onSend(content, attachments, mentionTargetId);
    setMentionedModel(null);
    dismissMention();
    clearAll();
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [canSend, value, mentionedModel, attachments, onSend, clearAll, getNonVisionModelNames, shouldShowProxyOnboarding, stripMentionFromContent, dismissMention]);

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

    // #382: pass mentionTargetId if a mention was active at vision-send time.
    const { targetId: mentionTargetId } = stripMentionFromContent(pendingVisionSend.content, mentionedModel);
    onSend(pendingVisionSend.content, attachments, mentionTargetId);
    setMentionedModel(null);
    dismissMention();
    clearAll();
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setPendingVisionSend(null);
    // Focus restores via VisionWarningModal's cleanup useEffect (returnFocusRef).
  }, [pendingVisionSend, mentionedModel, attachments, onSend, clearAll, shouldShowProxyOnboarding, stripMentionFromContent, dismissMention]);

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
      // #382: pass mentionTargetId if a mention was active at proxy-send time.
      const { targetId: mentionTargetId } = stripMentionFromContent(pendingProxySend.content, mentionedModel);
      // Re-submit the original message. Attachments are still in state (not cleared yet).
      onSend(pendingProxySend.content, attachments, mentionTargetId);
      setMentionedModel(null);
      dismissMention();
      clearAll();
      setValue('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setPendingProxySend(null);
      // Focus restores via ProxyOnboardingModal's cleanup useEffect (returnFocusRef).
    },
    [pendingProxySend, mentionedModel, attachments, onSend, clearAll, stripMentionFromContent, dismissMention],
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

  /**
   * Called when the user selects a model from the @mention autocomplete.
   * Replaces the "@<query>" token in the textarea with "@ModelName " and
   * records the selected model so the send handler can strip it and route.
   */
  const handleMentionSelect = useCallback((model: ModelConfig) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStartIndexRef.current < 0) return;

    const before = value.slice(0, mentionStartIndexRef.current);
    const after = value.slice(textarea.selectionStart);
    // Trailing space after "@ModelName" so the cursor lands ready for typing.
    const mention = `@${model.name} `;
    const newValue = `${before}${mention}${after}`;

    setValue(newValue);
    setMentionedModel(model);
    dismissMention();

    // Resize textarea and restore cursor to after the inserted mention (including trailing space).
    const newCursorPos = before.length + mention.length;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      el.setSelectionRange(newCursorPos, newCursorPos);
      el.focus();
    });
  }, [value, dismissMention]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ── @mention popover keyboard handling (#382) ─────────────────────────
      // When the popover is open, ↑ ↓ navigate the list, Enter selects,
      // Escape dismisses. These intercept before the normal Enter-to-send logic.
      if (mentionQuery !== null) {
        const candidates = getMentionCandidates();
        const filtered = filterModels(candidates, mentionQuery);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionActiveIndex((prev) => {
            const next = prev + 1;
            return next >= filtered.length ? 0 : next;
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionActiveIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? filtered.length - 1 : next;
          });
          return;
        }
        if (e.key === 'Enter' && mentionActiveIndex >= 0 && mentionActiveIndex < filtered.length) {
          e.preventDefault();
          handleMentionSelect(filtered[mentionActiveIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          dismissMention();
          return;
        }
        // Tab closes the popover without selecting.
        if (e.key === 'Tab') {
          dismissMention();
          // Don't return — allow default Tab behavior.
        }
      }

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
    [mentionQuery, mentionActiveIndex, getMentionCandidates, handleMentionSelect, dismissMention, handleSend, editingMessage, onCancelEdit, directedReplyTarget, onClearDirectedReply],
  );

  // ── @mention helpers (#382) ───────────────────────────────────────────────

  /**
   * Returns true when the cursor position `pos` in `text` is inside a backtick-
   * delimited inline code span or a fenced code block. Used to suppress @mention
   * trigger inside code blocks per spec.
   */
  function isInsideCodeBlock(text: string, pos: number): boolean {
    // Check fenced code blocks (``` ... ```)
    const fenceRegex = /```[\s\S]*?```/g;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(text)) !== null) {
      if (pos > match.index && pos < match.index + match[0].length) return true;
    }
    // Check inline code spans (` ... `)
    const inlineRegex = /`[^`]+`/g;
    while ((match = inlineRegex.exec(text)) !== null) {
      if (pos > match.index && pos < match.index + match[0].length) return true;
    }
    return false;
  }

  /**
   * Detect whether there is an active @mention trigger at the current cursor position.
   * Returns { query, startIndex } when active, null otherwise.
   *
   * Rules:
   *   - There must be an "@" character before the cursor with no space between it
   *     and the cursor (i.e. the user is actively typing the mention).
   *   - The "@" must not be inside a backtick-delimited code block.
   *   - The query is the text between "@" and the cursor.
   */
  function detectMentionAtCursor(
    text: string,
    cursorPos: number,
  ): { query: string; startIndex: number } | null {
    if (isInsideCodeBlock(text, cursorPos)) return null;

    // Scan backwards from cursor to find the nearest "@"
    let i = cursorPos - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '@') {
        // Found "@" — the query is everything between "@" and cursor.
        const query = text.slice(i + 1, cursorPos);
        // Reject if the query contains a space (user moved past the mention token).
        if (query.includes(' ')) return null;
        return { query, startIndex: i };
      }
      // Stop scanning if we hit whitespace before reaching "@".
      if (ch === ' ' || ch === '\n' || ch === '\t') return null;
      i--;
    }
    return null;
  }

  /**
   * Handles textarea value changes for @mention detection.
   * Separated from the main handleChange so the logic is easy to follow.
   */
  const handleMentionOnChange = useCallback((text: string, cursorPos: number) => {
    const detected = detectMentionAtCursor(text, cursorPos);
    if (detected) {
      mentionStartIndexRef.current = detected.startIndex;
      setMentionQuery(detected.query);
      setMentionActiveIndex(0);

      // If the mentionedModel no longer matches the current @token, clear it.
      // This handles the case where the user edits after placing a mention.
      setMentionedModel((prev) => {
        if (!prev) return prev;
        if (`@${prev.name}` !== text.slice(detected.startIndex, cursorPos)) return null;
        return prev;
      });
    } else {
      // Check if the user deleted or edited the mention token they had selected.
      if (mentionedModel !== null) {
        // If the mention text is no longer present, clear the selection.
        const mentionText = `@${mentionedModel.name}`;
        if (!text.includes(mentionText)) {
          setMentionedModel(null);
        }
      }
      dismissMention();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionedModel, dismissMention]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    setValue(newValue);
    handleMentionOnChange(newValue, cursorPos);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [handleMentionOnChange]);

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

  // ── @mention popover rendering data (#382) ────────────────────────────────
  const mentionCandidates = getMentionCandidates();
  const showMentionPopover = mentionQuery !== null && !isStreaming;

  return (
    <div
      className="w-full relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* @mention autocomplete popover (#382) — positions above the input bar.
          Renders inside the InputBar's relative container so bottom-full positions
          it correctly above the entire InputBar (including any top sections).
          Only shown when a "@" trigger is active and not streaming. */}
      {showMentionPopover && (
        <AtMentionAutocomplete
          models={mentionCandidates}
          query={mentionQuery!}
          activeIndex={mentionActiveIndex}
          onSelect={handleMentionSelect}
          onDismiss={dismissMention}
          textareaRef={textareaRef}
          comboboxRef={comboboxRef}
          listboxId={mentionListboxId}
        />
      )}

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
                'inline-flex items-center',
                'text-[12px] font-medium text-text-secondary',
                'hover:text-text-primary',
                'min-h-[24px] px-2 py-1 rounded',
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
                      'w-6 h-6 rounded-full',
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
          'w-full bg-input input-bar',
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
          {isGhostMode && (() => {
            // #470: When onToggleGhostMode is provided, render as a button so clicking
            // the icon toggles ghost mode (mirrors the sidebar toggle affordance).
            // When absent, render as a div with tooltip (indicator-only, original behavior).
            const sharedProps = {
              className: 'flex-shrink-0 text-text-muted self-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
              'aria-label': onToggleGhostMode
                ? 'Ghost mode on — click to turn off'
                : 'Ghost mode — this conversation won\'t be saved',
              'aria-describedby': ghostTooltipId,
              'aria-pressed': onToggleGhostMode ? (true as boolean) : undefined,
              onMouseEnter: handleGhostMouseEnter,
              onMouseLeave: handleGhostMouseLeave,
              onFocus: () => setIsGhostTooltipVisible(true),
              onBlur: () => setIsGhostTooltipVisible(false),
              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') setIsGhostTooltipVisible(false); },
            };
            const children = (
              <>
                {/* #465: ghost-pulse class applies a slow opacity animation (0.4–0.9 over 3s)
                    to communicate the ephemeral, non-persisted nature of ghost mode.
                    Under prefers-reduced-motion the animation is suppressed and opacity
                    is held at 0.65 — still visually distinct from full opacity.
                    The GhostIcon SVG is already aria-hidden; the span is presentational. */}
                <span className="ghost-pulse block">
                  <GhostIcon />
                </span>
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
                  {onToggleGhostMode
                    ? 'Ghost mode on — click to turn off'
                    : 'Ghost mode — this conversation won\'t be saved'}
                  <span
                    className="absolute top-full left-3 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
                    aria-hidden="true"
                  />
                </div>
              </>
            );
            return onToggleGhostMode ? (
              <button type="button" onClick={onToggleGhostMode} {...sharedProps}>
                {children}
              </button>
            ) : (
              <div tabIndex={0} {...sharedProps}>
                {children}
              </div>
            );
          })()}

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

          {/* Textarea — wrapped in a combobox container for two reasons:
              1. The relative positioning allows the mention highlight overlay to be
                 absolutely positioned over the textarea. (#382)
              2. The div carries role="combobox" and ARIA combobox state attributes
                 (set by AtMentionAutocomplete via comboboxRef). Placing role="combobox"
                 on the <textarea> itself would violate axe-core's aria-allowed-role rule.
                 aria-activedescendant on a textbox-role element would also violate
                 aria-allowed-attr. The div wrapper is the ARIA 1.2 §3.8 compliant approach.
                 (#382) */}
          <div
            ref={comboboxRef}
            role="combobox"
            aria-expanded="false"
            aria-label="Message input combobox"
            className="relative flex-1 self-end min-h-[36px]"
          >
          {/* Mention highlight overlay (#382) — shown when a model has been
              selected via @mention. Absolutely positions a mirror div over the
              textarea that shows a tinted highlight behind the @ModelName token.
              pointer-events:none so all interaction passes through to the textarea. */}
          {mentionedModel && (
            <MentionHighlightOverlay
              value={value}
              model={mentionedModel}
              textareaRef={textareaRef}
            />
          )}
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
              'w-full resize-none bg-transparent border-none outline-none',
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
              'focus-visible:outline-none',
              isStreaming ? 'cursor-text' : '',
            ].join(' ')}
            style={{ overflowY: 'auto' }}
            aria-label="Message input"
            aria-multiline="true"
          />
          </div>{/* end textarea wrapper */}

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
