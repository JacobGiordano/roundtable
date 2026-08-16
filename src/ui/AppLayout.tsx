import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
// #550: MessageThread (and its markdown/hljs subtree) lazy-loaded so it stays
// out of the initial bundle. It only renders after a conversation is selected —
// a natural lazy-load boundary. React.lazy requires a default export; the
// `.then(m => ({ default: m.MessageThread }))` shim bridges the named export.
// The markdown chunk (react-markdown, rehype-*, highlight.js, dompurify) was
// already split by #551's manualChunks config — lazy loading MessageThread
// ensures the chunk only loads when a conversation is first opened.
const MessageThread = lazy(() =>
  import('./MessageThread').then((m) => ({ default: m.MessageThread })),
);
// Wave 31 (Tempo): ModelSelectorPanel and ProviderSettingsPanel lazy-loaded to
// reduce the initial index chunk. Both panels are interaction-triggered (not on
// initial paint), making them natural lazy boundaries. Named-export shim pattern
// mirrors MessageThread above. ProviderSettingsPanel is the primary savings target
// at 2518 lines; ModelSelectorPanel adds secondary savings at 642 lines.
// Suspense fallback is null — panels only render when user opens them so a
// null fallback produces no visible flash.
const ModelSelectorPanel = lazy(() =>
  import('./ModelSelectorPanel').then((m) => ({ default: m.ModelSelectorPanel })),
);
const ProviderSettingsPanel = lazy(() =>
  import('./ProviderSettingsPanel').then((m) => ({ default: m.ProviderSettingsPanel })),
);
import { InputBar } from './InputBar';
import { InteractionModeSwitcher } from './InteractionModeSwitcher';
import { Sidebar } from './Sidebar';
import { RoundtableLogo } from './RoundtableLogo';
import { OnboardingEmptyState } from './OnboardingEmptyState';
import { useRoundtable } from './RoundtableContext';
// #147: shared icon system — MenuIcon, GearIcon, PlusIcon replace inline SVGs.
// #280: PanelLeftIcon — desktop sidebar expand button (shown when sidebar is collapsed).
import { MenuIcon, GearIcon, PlusIcon, PanelLeftIcon } from './icons';
// #280: getSidebarOpen / setSidebarOpen — Gate persistence for desktop sidebar open state.
// Pure Gate persistence functions — permitted exception per CLAUDE.md.
// #600: getFontScalePreferences — reads stored font scale preferences on mount so the
// CSS custom properties --font-scale-ui and --font-scale-content can be applied to
// :root before first paint. These are preference vars, not design tokens — they do not
// belong in applyTheme() or the theme JSON files.
import { getSidebarOpen, setSidebarOpen, getFontScalePreferences } from '@/auth';
// #178: Outrun entry flash — full-viewport overlay triggered on Outrun theme activation.
import { OutrunFlash } from './OutrunFlash';
// #408: per-conversation system prompt bar — collapsible textarea above the model selector.
import { ConversationSystemPromptBar } from './components/ConversationSystemPromptBar';

// #263: Tooltip always shows Ctrl+N — the handler uses e.ctrlKey (not e.metaKey).
// Cmd+N / ⌘N is a reserved system/browser shortcut on Mac; the handler
// intentionally uses Ctrl+N on all platforms to avoid that conflict.

/**
 * AppLayoutProps: only props that AppLayout owns locally.
 *
 * All App-level state (conversations, models, messages, callbacks) is now
 * consumed via useRoundtable() rather than threaded through props. The only
 * prop remaining is onSend — it is kept as a prop because it is a
 * render-time closure that captures App's streaming accumulator ref and
 * cannot be meaningfully serialised into a context value without losing
 * its closure over the ref. The alternative (putting handleSend in context)
 * would require wrapping it in useCallback with every state dependency, and
 * any new state added to App would require updating the context value type.
 * Keeping it as a direct prop is the simpler, more explicit choice.
 */
interface AppLayoutProps {
  /**
   * Called when the user submits a message. `attachments` is always an array
   * (empty for text-only sends). Issue #285 extended the signature from
   * `(content: string) => void` to include attachments.
   * Issue #382: `targetModelId` is set when the user typed an @mention —
   * InputBar strips the @ModelName token from content before this is called.
   */
  onSend: (content: string, attachments: import('@/types').Attachment[], targetModelId?: import('@/types').ModelId) => void;
  /** Called after the user logs in or out of a backend server — refreshes the active storage provider. */
  onBackendConnectionChange?: () => void;
}

export function AppLayout({ onSend, onBackendConnectionChange }: AppLayoutProps) {
  const {
    conversations,
    activeConversationId,
    isConversationsLoading,
    conversationStoreError,
    onSelectConversation,
    onNewConversation,
    onArchiveConversation,
    onUnarchiveConversation,
    onDeleteConversation,
    onSetConversationGroup,
    onRenameConversation,
    onBulkArchive,
    onBulkDelete,
    isGhostMode,
    onToggleGhostMode,
    messages,
    streamingMessages,
    activeModels,
    allModels,
    onRetry,
    onDirectedReply,
    tokenCountVisibility,
    onExportConversation,
    onEditMessage,
    editingMessage,
    onCancelEdit,
    isStreaming,
    directedReplyTarget,
    onClearDirectedReply,
    stopMessage,
    onToggleModel,
    onAddModel,
    onUpdateSystemPrompt,
    onSelectModelVersion,
    onClearModelVersion,
    sessionUsage,
    activeMode,
    onModeChange,
    isRosterEmpty,
    onRosterChange,
    conversationSystemPrompt,
    onUpdateConversationSystemPrompt,
  } = useRoundtable();

  // #600: Font scale CSS custom property initialization.
  // Reads stored font scale preferences and applies them to :root on mount.
  // --font-scale-ui and --font-scale-content are unitless multipliers consumed
  // by the two scoping containers (UI chrome and message thread). These are
  // preference vars, not design tokens — applyTheme() does not set them.
  // ProviderSettingsPanel updates them live via document.documentElement.style.setProperty()
  // whenever the user changes a stepper value — no callback needed here.
  useEffect(() => {
    const prefs = getFontScalePreferences();
    document.documentElement.style.setProperty('--font-scale-ui', String(prefs.ui));
    document.documentElement.style.setProperty('--font-scale-content', String(prefs.content));
  }, []);

  // #341: Suggestion chip prefill — set when user clicks a chip in ConversationEmptyState.
  // InputBar watches this via useEffect, populates the textarea, focuses it, then calls
  // onPrefillConsumed to reset back to ''. This avoids needing a ref to the InputBar textarea.
  const [prefillText, setPrefillText] = useState('');
  // Stable callback — setPrefillText is a stable useState setter so this never changes reference.
  const handlePrefillConsumed = useCallback(() => setPrefillText(''), []);

  // #557: Auto-focus chat input when a new empty conversation becomes active.
  // Incremented whenever activeConversationId changes to a conversation that has no
  // messages yet — which is the "new conversation" state. The value is passed to
  // InputBar as autoFocusKey; InputBar focuses the textarea on each increment.
  // Value 0 (initial) does not trigger focus in InputBar, so the app-load render
  // does not steal focus. messages.length check avoids re-focusing when switching
  // to an existing conversation that already has content.
  const [inputAutoFocusKey, setInputAutoFocusKey] = useState(0);
  useEffect(() => {
    if (!activeConversationId || messages.length > 0) return;
    setInputAutoFocusKey((prev) => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);
  // ^^ messages intentionally excluded from deps — we only want this to fire when
  // the active conversation changes, not every time a message is added. The
  // messages.length check prevents focus on conversations that already have content
  // at the moment of selection (e.g. switching to a paused conversation).

  // #500: Model selector open request — set when the user clicks the empty-state CTA.
  // ModelSelectorPanel consumes this as requestOpen, opens the panel, then calls
  // onRequestOpenHandled to reset back to false. The flag is intentionally one-shot:
  // false → true → false so ModelSelectorPanel does not re-open on re-renders.
  const [modelSelectorRequestOpen, setModelSelectorRequestOpen] = useState(false);
  const handleOpenModelSelector = useCallback(() => setModelSelectorRequestOpen(true), []);
  const handleModelSelectorRequestHandled = useCallback(() => setModelSelectorRequestOpen(false), []);

  // #280: Desktop sidebar open/close state — persisted via Gate's setSidebarOpen().
  // Initialized from Gate's localStorage-backed getSidebarOpen() (default: true).
  // Mobile sidebar drawer visibility is controlled separately by isMobileMenuOpen.
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => getSidebarOpen());

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      setSidebarOpen(next); // Persist to Gate (localStorage)
      return next;
    });
  }, []);

  // Mobile drawer state — controls the Sidebar slide-in overlay on small screens.
  // On desktop (>= md) the sidebar is always visible and this state is irrelevant.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Settings panel open state — lifted here so both the mobile header gear button
  // and the sidebar header gear button (desktop) share a single source of truth.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const handleToggleSettings = useCallback(() => setIsSettingsOpen((prev) => !prev), []);

  // Provider settings panel open state (#99).
  // ProviderSettingsPanel is rendered at the AppLayout level (fixed positioning,
  // z-index:40 per spec) so it overlays the main content area without touching the sidebar.
  const [isProviderPanelOpen, setIsProviderPanelOpen] = useState(false);
  // Mount-once guard: ProviderSettingsPanel stays out of the DOM until first open,
  // then remains mounted so the close animation plays correctly. The lazy chunk
  // only fetches on first click — not on initial page load.
  const [hasEverOpenedProvider, setHasEverOpenedProvider] = useState(false);
  // Ref to the provider settings trigger button — ProviderSettingsPanel uses this to
  // return focus on close (WCAG 2.4.3). Shared between the desktop sidebar gear
  // (inside Sidebar's hidden md:flex div) and the mobile header gear (md:hidden).
  // Only one renders at a time so the ref always resolves to the visible trigger.
  // Typed as RefObject<HTMLButtonElement> (not |null) so it matches Sidebar's prop type.
  const providerSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  // #260: Ref to the mobile hamburger button — Sidebar's Escape handler uses this
  // to return focus after closing the drawer (WCAG 2.1.2 + 2.4.3).
  const hamburgerTriggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenProviderSettings = useCallback(() => {
    setIsProviderPanelOpen(true);
    setHasEverOpenedProvider(true);
  }, []);
  const handleCloseProviderSettings = useCallback(() => {
    setIsProviderPanelOpen(false);
    // Notify App that the panel closed so it can re-read the roster.
    // This is the roster subscription mechanism: Gate is sync-only, so App
    // learns about roster changes by rechecking on panel close.
    onRosterChange();
  }, [onRosterChange]);

  const handleOpenMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const handleCloseMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  // #166: Cmd+N / Ctrl+N keyboard shortcut — create new conversation.
  // Suppressed when focus is in an editable element (input, textarea, contenteditable)
  // so users can still type "n" freely. preventDefault() blocks browser "open new window".
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'n') return;
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      onNewConversation();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNewConversation]);

  // #166: Tooltip state for the mobile header new-conversation button.
  // 600ms hover delay per tooltip.md §1; immediate on focus; hidden on leave/blur.
  const [isNewConvTooltipVisible, setIsNewConvTooltipVisible] = useState(false);
  const newConvHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNewConvMouseEnter = useCallback(() => {
    newConvHoverTimerRef.current = setTimeout(() => setIsNewConvTooltipVisible(true), 600);
  }, []);

  const handleNewConvMouseLeave = useCallback(() => {
    if (newConvHoverTimerRef.current !== null) {
      clearTimeout(newConvHoverTimerRef.current);
      newConvHoverTimerRef.current = null;
    }
    setIsNewConvTooltipVisible(false);
  }, []);

  const handleNewConvFocus = useCallback(() => {
    if (newConvHoverTimerRef.current !== null) {
      clearTimeout(newConvHoverTimerRef.current);
      newConvHoverTimerRef.current = null;
    }
    setIsNewConvTooltipVisible(true);
  }, []);

  const handleNewConvBlur = useCallback(() => setIsNewConvTooltipVisible(false), []);

  // #263: Fixed shortcut label — always Ctrl+N to match the handler.
  const newConvShortcut = 'Ctrl+N';

  return (
    // #600: UI scale scoping container.
    // font-size: calc(1rem * var(--font-scale-ui)) makes this element the "base" for
    // em-based child text. All chrome text (sidebar, input bar, settings panel, model
    // selector) descends from here. The CSS variable is set on :root by the useEffect
    // above. Tailwind rem-based text-* classes in children are NOT automatically affected
    // by this — they remain rem-relative to <html>. Only elements that use em units or
    // explicit inline style overrides will scale. The four small-text metadata elements
    // in message bubbles use max() floor via inline style (#600 spec §5.4).
    // Note: this wraps ALL content including the message thread — the content scale
    // scoping container in MessageThread.tsx provides a nested override that takes
    // precedence inside the thread scroll area.
    <div className="flex h-dvh w-screen overflow-hidden bg-bg" style={{ fontSize: 'calc(1rem * var(--font-scale-ui, 1))' }}>
      {/* #178: Outrun entry flash — self-contained; listens for data-theme="outrun"
          via MutationObserver. Renders via createPortal into document.body to
          escape any ancestor stacking/transform contexts. No-op on all other themes
          and on initial page load. Skipped entirely for prefers-reduced-motion users. */}
      <OutrunFlash />

      {/* Skip-to-main-content link — WCAG 2.4.1 bypass block requirement.
          Visually hidden at rest (sr-only); becomes visible on keyboard focus
          so keyboard users can jump past the sidebar nav directly to the main
          content area. Must be the very first focusable element in the DOM.
          Targets #skip-target, which is placed on the primary interactive element
          in the active state (textarea) or onboarding state (CTA button), so
          focus lands on a naturally focusable element with a visible ring rather
          than the non-interactive <main> container. */}
      <a
        href="#skip-target"
        className={[
          'sr-only',
          'focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
          'focus:px-4 focus:py-2',
          'focus:bg-bg focus:text-text-primary',
          'focus:rounded focus:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-focus',
        ].join(' ')}
      >
        Skip to main content
      </a>

      {/* Mobile backdrop — covers main content while the sidebar drawer is open.
          Tapping it closes the drawer. Hidden on desktop via md:hidden. */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={handleCloseMobileMenu}
        />
      )}

      {/* Sidebar — static on desktop, fixed drawer on mobile.
          #280: isDesktopOpen controls md:hidden on the <aside>; onToggleDesktop
          persists the state change via Gate. Mobile behavior (isMobileOpen) is
          entirely separate and unaffected by the desktop open state. */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        isLoading={isConversationsLoading}
        storageError={conversationStoreError}
        onArchiveConversation={onArchiveConversation}
        onUnarchiveConversation={onUnarchiveConversation}
        onDeleteConversation={onDeleteConversation}
        onSetConversationGroup={onSetConversationGroup}
        onRenameConversation={onRenameConversation}
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={handleCloseMobileMenu}
        mobileMenuTriggerRef={hamburgerTriggerRef}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={handleToggleSettings}
        onOpenProviderSettings={handleOpenProviderSettings}
        providerSettingsTriggerRef={providerSettingsTriggerRef}
        isGhostMode={isGhostMode}
        onToggleGhostMode={onToggleGhostMode}
        onBackendConnectionChange={onBackendConnectionChange}
        isDesktopOpen={isSidebarOpen}
        onToggleDesktop={handleToggleSidebar}
      />

      {/* Provider settings backdrop — covers main content area when the settings drawer is
          open so clicks outside the drawer close it. Sits below the drawer (z-30 vs z-40)
          and is lightly dimmed to indicate the drawer is modal-like without obscuring content.
          Pointer events are suppressed when closed so it never intercepts clicks. */}
      <div
        aria-hidden="true"
        className={[
          'fixed inset-0 z-30 bg-black/20',
          'transition-opacity duration-200 motion-reduce:transition-none',
          isProviderPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={handleCloseProviderSettings}
      />

      {/* Provider settings panel (#99) — fixed overlay, z-index:40.
          Rendered at AppLayout level so it overlays the main content area (not the sidebar).
          Width is derived from --sidebar-width CSS var (set by Sidebar.tsx) so it
          respects the actual sidebar width rather than assuming a fixed pixel value.
          Suspense fallback is null — the panel is closed on first load so a null
          fallback produces no visible flash (wave 31 lazy boundary). */}
      {hasEverOpenedProvider && (
        <Suspense fallback={null}>
          <ProviderSettingsPanel
            isOpen={isProviderPanelOpen}
            onClose={handleCloseProviderSettings}
            triggerRef={providerSettingsTriggerRef}
          />
        </Suspense>
      )}

      {/* Main area — flex-1.
          id="main-content" is the skip-link target (WCAG 2.4.1).
          tabIndex={-1} allows programmatic focus without inserting a tab stop.
          inert: when the mobile sidebar drawer is open the entire main content
          area is visually covered by the sidebar (z-50) and its backdrop (z-40).
          Without inert, a keyboard user tabbing past the sidebar's last focusable
          element can reach elements in the main area that are entirely obscured —
          a WCAG 2.4.11 (Focus Not Obscured) violation.
          inert removes all descendants from the tab order and AT tree while the
          drawer is open. Pattern: isMobileMenuOpen ? '' : undefined (HANDOFF gotcha). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col overflow-hidden min-w-0 focus:outline-none"
        {...({ inert: isMobileMenuOpen ? '' : undefined } as React.HTMLAttributes<HTMLElement>)}
      >
        <h1 className="sr-only">Roundtable Conversation</h1>

        {/* #280: Desktop sidebar expand bar — shown only on desktop (≥ md) when the
            sidebar is collapsed. Provides a single button to re-open the sidebar.
            On mobile this element is always hidden (the mobile hamburger handles that).
            Conditional render (not CSS hide) so it takes no space when !isSidebarOpen. */}
        {!isSidebarOpen && (
          <div className="hidden md:flex h-10 items-center px-3 border-b border-border bg-bg flex-shrink-0">
            <button
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={false}
              aria-controls="app-sidebar"
              onClick={handleToggleSidebar}
              className={[
                'flex items-center justify-center',
                'w-8 h-8',
                'text-text-muted hover:text-text-secondary',
                'hover:bg-hover rounded-md',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              <PanelLeftIcon size={16} />
            </button>
          </div>
        )}

        {/* Mobile top header bar — visible only on small screens (below md breakpoint).
            Contains: hamburger (opens sidebar) | logo | new-conversation button.
            Hidden on desktop where the sidebar is always visible. */}
        <div className="flex md:hidden h-12 items-center justify-between px-3 border-b border-border bg-sidebar flex-shrink-0">
          {/* Hamburger — opens mobile sidebar drawer */}
          <button
            ref={hamburgerTriggerRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-sidebar"
            onClick={handleOpenMobileMenu}
            className={[
              'flex items-center justify-center',
              'min-w-[44px] min-h-[44px]',
              'text-text-secondary hover:text-text-primary',
              'hover:bg-hover rounded-md',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            {/* Three-line hamburger icon — shared icon (#147) */}
            <MenuIcon />
          </button>

          {/* Logo — symbol only on very small screens, wordmark appears at sm (640px) */}
          <RoundtableLogo />

          {/* Right-side controls: provider settings gear + new conversation */}
          <div className="flex items-center">
            {/* Provider settings gear — opens the ProviderSettingsPanel overlay directly.
                #592: on mobile the gear should open the provider panel (same semantic as
                the desktop sidebar gear), not the settings panel inside the sidebar drawer.
                Settings remain accessible via the hamburger → sidebar.
                No ref here — ProviderSettingsPanel now captures document.activeElement at
                open time (returnFocusTargetRef) and returns focus to that element on close
                (WCAG 2.4.3). Attaching providerSettingsTriggerRef to both this button and
                the desktop sidebar gear caused the ref to always resolve to whichever button
                React committed last (the mobile one), pointing to a display:none element
                at desktop viewport width and silently failing focus return. */}
            <button
              type="button"
              onClick={handleOpenProviderSettings}
              aria-label="Provider settings"
              data-testid="mobile-provider-settings-toggle"
              className={[
                'flex items-center justify-center',
                'min-w-[44px] min-h-[44px]',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-hover rounded-md',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              {/* Gear icon — shared icon (#147) */}
              <GearIcon size={16} />
            </button>

            {/* New conversation button (#166: tooltip + keyboard shortcut hint) */}
            <div
              className="relative"
              onMouseEnter={handleNewConvMouseEnter}
              onMouseLeave={handleNewConvMouseLeave}
            >
              <button
                type="button"
                onClick={onNewConversation}
                aria-label={`New conversation (${newConvShortcut})`}
                aria-describedby="new-conv-tooltip"
                onFocus={handleNewConvFocus}
                onBlur={handleNewConvBlur}
                className={[
                  'flex items-center justify-center',
                  'min-w-[44px] min-h-[44px]',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-hover rounded-md',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                {/* Plus icon — shared icon (#147) */}
                <PlusIcon />
              </button>
              {/* Tooltip — 600ms hover delay, immediate on focus (#166).
                  id="new-conv-tooltip" + aria-describedby on button satisfies
                  WAI-ARIA tooltip pattern (WCAG 4.1.2). */}
              <div
                id="new-conv-tooltip"
                role="tooltip"
                className={[
                  'absolute top-full right-0 mt-2',
                  'w-max',
                  'bg-sidebar border border-border rounded-sm shadow-md',
                  'px-3 py-2 text-[11px] leading-[1.4] text-text-primary whitespace-nowrap',
                  'pointer-events-none',
                  'transition-opacity duration-fast',
                  'z-20',
                  isNewConvTooltipVisible ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
              >
                New conversation
                <span className="ml-1.5 font-mono text-text-muted">{newConvShortcut}</span>
                <span
                  className="absolute bottom-full right-3 -mb-px block border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-border"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Conversation column body — either onboarding (empty roster) or message thread.
            OnboardingEmptyState unmounts automatically when isRosterEmpty becomes false
            (first provider added), revealing the normal MessageThread.
            ctaId="skip-target" places the skip-link anchor on the primary CTA button
            in onboarding state so keyboard users land on a meaningful interactive element. */}
        {isRosterEmpty ? (
          <OnboardingEmptyState onOpenProviderSettings={handleOpenProviderSettings} ctaId="skip-target" />
        ) : (
          // #550: Suspense boundary for the lazy-loaded MessageThread.
          // Fallback: flex-1 placeholder preserves the layout height while the
          // markdown chunk loads (typically < 100ms on a warm cache, imperceptible
          // on first load). aria-hidden so screen readers skip the placeholder —
          // there is nothing meaningful to announce until the thread renders.
          <Suspense fallback={<div className="flex-1" aria-hidden="true" />}>
            <MessageThread
            messages={messages}
            streamingMessages={streamingMessages}
            models={activeModels}
            onRetry={onRetry}
            onOpenSettings={handleOpenProviderSettings}
            onDirectedReply={onDirectedReply}
            tokenCountVisibility={tokenCountVisibility}
            onExport={onExportConversation}
            onEditMessage={onEditMessage}
            onSuggestionSelect={setPrefillText}
            onOpenModelSelector={handleOpenModelSelector}
            conversationTitle={
              /* #469: Derive active conversation title for the thread header rename affordance.
                 Pass empty string (not undefined) when a conversation exists but has no title —
                 undefined suppresses the rename affordance entirely, but we want it available
                 for untitled conversations too. undefined is only passed when no conversation
                 is active (which can't happen in this branch since isRosterEmpty is false). */
              activeConversationId
                ? (conversations.find((c) => c.id === activeConversationId)?.title ?? '')
                : undefined
            }
            onRenameConversation={
              /* #469: Thread-area rename affordance — same callback as the sidebar rename.
                 Only provided when a conversation is active so the rename input only
                 shows during an actual conversation. */
              activeConversationId
                ? (newTitle: string) => onRenameConversation(activeConversationId, newTitle)
                : undefined
            }
          />
          </Suspense>
        )}

        {/* Bottom section: conversation system prompt + model selector + mode switcher + input bar */}

        {/* #408: Per-conversation system prompt bar — collapsible, sits just above the model selector. */}
        <ConversationSystemPromptBar
          value={conversationSystemPrompt}
          onChange={onUpdateConversationSystemPrompt}
          hasActiveConversation={activeConversationId !== null}
        />

        <div className="flex-shrink-0 px-4 pb-0">
          {/* #594: Model selector + mode switcher layout.
              Desktop (md+): single flex row — selector (flex-1) beside switcher (flex-shrink-0).
              Mobile (< md): stacked — model selector is full-width so the slide-up panel
              spans the viewport; mode switcher is right-aligned in its own row below.
              `overflow-x-hidden` on the selector wrapper clips the horizontally-scrollable
              pill row without blocking the panel's vertical expansion. */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between">
            {/* Model selector — full-width on mobile (no mr-3), flex-1 + mr-3 on desktop */}
            <div className="min-w-0 overflow-x-hidden md:flex-1 md:mr-3">
              {/* Suspense fallback is null — ModelSelectorPanel renders its pill row
                  immediately but the initial paint cost is small; null avoids layout
                  shift on first load (wave 31 lazy boundary). */}
              <Suspense fallback={null}>
                <ModelSelectorPanel
                  models={allModels}
                  onToggleModel={onToggleModel}
                  onAddModel={onAddModel}
                  onUpdateSystemPrompt={onUpdateSystemPrompt}
                  onSelectModelVersion={onSelectModelVersion}
                  onClearModelVersion={onClearModelVersion}
                  sessionUsage={sessionUsage}
                  tokenCountVisibility={tokenCountVisibility}
                  onOpenProviderSettings={handleOpenProviderSettings}
                  requestOpen={modelSelectorRequestOpen}
                  onRequestOpenHandled={handleModelSelectorRequestHandled}
                />
              </Suspense>
            </div>
            {/* Interaction mode switcher — right-aligned on both viewports.
                On desktop it sits beside the model selector; on mobile it is below
                the trigger chip in its own row (the panel opens above the trigger). */}
            <div className="mb-2 flex-shrink-0 self-end">
              <InteractionModeSwitcher
                activeMode={activeMode}
                onModeChange={onModeChange}
              />
            </div>
          </div>
        </div>

        {/* Input bar — fixed at bottom of main area.
            textareaId="skip-target" places the skip-link anchor on the textarea when
            the roster is populated (active conversation state). When isRosterEmpty is
            true, the OnboardingEmptyState CTA holds the id instead; InputBar still
            renders but its textarea gets no id in that state, preventing a duplicate-id
            collision in the DOM. */}
        <div className="flex-shrink-0">
          <InputBar
            onSend={onSend}
            isStreaming={isStreaming}
            onStopMessage={stopMessage}
            isGhostMode={isGhostMode}
            onToggleGhostMode={onToggleGhostMode}
            directedReplyTarget={directedReplyTarget}
            onClearDirectedReply={onClearDirectedReply}
            activeModelCount={allModels.filter((m) => m.isActive).length}
            activeModels={activeModels}
            textareaId={isRosterEmpty ? undefined : 'skip-target'}
            editingMessage={editingMessage}
            onCancelEdit={onCancelEdit}
            prefillText={prefillText}
            onPrefillConsumed={handlePrefillConsumed}
            autoFocusKey={inputAutoFocusKey}
          />
        </div>
      </main>
    </div>
  );
}
