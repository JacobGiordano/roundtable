import { useState, useCallback, useRef } from 'react';
import type { Conversation, ExportFormat, InteractionMode, Message, ModelConfig, ModelId, SessionTokenUsage, TokenCountVisibility } from '@/types';
import { MessageThread } from './MessageThread';
import { InputBar } from './InputBar';
import { InteractionModeSwitcher } from './InteractionModeSwitcher';
import { Sidebar } from './Sidebar';
import { ModelSelectorPanel } from './ModelSelectorPanel';
import { RoundtableLogo } from './RoundtableLogo';
import { ProviderSettingsPanel } from './ProviderSettingsPanel';
import { OnboardingEmptyState } from './OnboardingEmptyState';

interface AppLayoutProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeModels: ModelConfig[];
  /** Full model list for the active conversation (active + inactive). */
  allModels: ModelConfig[];
  messages: Message[];
  /**
   * In-flight streaming messages for the active conversation.
   * Keyed externally by `${conversationId}:${modelId}` in App; threaded here
   * as a flat array for MessageThread to append after persisted messages.
   * Cleared from this array when isDone — at that point the message is in `messages`.
   */
  streamingMessages?: Message[];
  isStreaming?: boolean;
  isGhostMode?: boolean;
  /** Called when the user clicks the ghost mode toggle button. */
  onToggleGhostMode?: () => void;
  onSend: (content: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRetry?: (messageId: string) => void;
  /** Called when user toggles a model pill on/off. */
  onToggleModel: (modelId: ModelId) => void;
  /** Called when user adds an inactive model back into the active set. */
  onAddModel: (modelId: ModelId) => void;
  /** Current interaction mode for the active conversation. */
  activeMode: InteractionMode;
  /** Called when the user switches interaction modes. Parent persists the change. */
  onModeChange: (mode: InteractionMode) => void;
  /** Called when user edits or clears a per-model system prompt. */
  onUpdateSystemPrompt: (modelId: ModelId, value: string) => void;
  /**
   * Called when the user selects a model version in the per-model version picker.
   * App persists to Gate and updates ModelConfig.selectedVersionId in state.
   */
  onSelectModelVersion: (modelId: ModelId, versionId: string) => void;
  /**
   * Called when the user resets a model's version to provider default.
   * App calls clearModelVersion (Gate) and sets selectedVersionId to undefined in state.
   */
  onClearModelVersion: (modelId: ModelId) => void;
  /**
   * Per-model token usage totals for the current conversation session.
   * Passed through to ModelSelectorPanel for display in the slide-up panel.
   */
  sessionUsage: SessionTokenUsage[];
  /**
   * When set, the InputBar shows a directed-reply pill for this model.
   * App owns this state; AppLayout threads it through to InputBar and MessageThread.
   */
  directedReplyTarget?: ModelConfig;
  /** Called when user clicks "Reply to [Model]" on a bubble. Sets the directed-reply target. */
  onDirectedReply: (modelId: ModelId) => void;
  /** Called when user clicks × on the directed-reply pill to clear the target. */
  onClearDirectedReply: () => void;
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility.
   * Threaded from App → AppLayout → MessageThread and ModelSelectorPanel.
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
  /**
   * True while the initial conversation list load is in flight.
   * Threaded from App (useConversationStore) → AppLayout → Sidebar.
   */
  isConversationsLoading?: boolean;
  /**
   * Set when a storage operation fails (e.g. quota exceeded).
   * Threaded from App (useConversationStore) → AppLayout → Sidebar.
   */
  conversationStoreError?: Error | null;
  /**
   * Called when the user picks an export format from the ExportButton popover.
   * Threaded from App → AppLayout → MessageThread → ExportButton.
   * Omit to hide the export button (e.g. when no active conversation exists).
   */
  onExportConversation?: (format: ExportFormat) => void;
  /** Archive a single conversation. Threaded App → AppLayout → Sidebar. */
  onArchiveConversation?: (id: string) => void;
  /** Unarchive a single conversation. Threaded App → AppLayout → Sidebar. */
  onUnarchiveConversation?: (id: string) => void;
  /** Permanently delete a single conversation. Threaded App → AppLayout → Sidebar. */
  onDeleteConversation?: (id: string) => void;
  /** Assign or clear a group on a conversation. Threaded App → AppLayout → Sidebar. */
  onSetConversationGroup?: (id: string, groupId: string | undefined) => void;
  /** Archive multiple conversations. Threaded App → AppLayout → Sidebar. */
  onBulkArchive?: (ids: string[]) => void;
  /** Delete multiple conversations. Threaded App → AppLayout → Sidebar. */
  onBulkDelete?: (ids: string[]) => void;
  /**
   * True when the ProviderRoster is empty (no built-in or custom providers configured).
   * When true, the conversation column body is replaced by OnboardingEmptyState.
   * Derived in App from getProviderRoster().length === 0 — see #100.
   * When false (or omitted), the normal MessageThread renders.
   */
  isRosterEmpty?: boolean;
  /**
   * Called whenever the ProviderSettingsPanel closes, giving App a chance to
   * re-read the roster and update isRosterEmpty. This is the simplest subscription
   * model: Gate exposes sync-only CRUD; AppLayout notifies App on panel close.
   */
  onRosterChange?: () => void;
}

export function AppLayout({
  conversations,
  activeConversationId,
  activeModels,
  allModels,
  messages,
  streamingMessages,
  isStreaming = false,
  isGhostMode = false,
  onToggleGhostMode,
  onSend,
  onSelectConversation,
  onNewConversation,
  onRetry,
  onToggleModel,
  onAddModel,
  activeMode,
  onModeChange,
  onUpdateSystemPrompt,
  onSelectModelVersion,
  onClearModelVersion,
  sessionUsage,
  directedReplyTarget,
  onDirectedReply,
  onClearDirectedReply,
  tokenCountVisibility,
  isConversationsLoading,
  conversationStoreError,
  onExportConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onDeleteConversation,
  onSetConversationGroup,
  onBulkArchive,
  onBulkDelete,
  isRosterEmpty = false,
  onRosterChange,
}: AppLayoutProps) {
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
  // Ref to the sidebar gear icon button — ProviderSettingsPanel uses this to
  // return focus on close, per the accessibility spec.
  // Typed as RefObject<HTMLButtonElement> (not |null) so it matches Sidebar's prop type.
  const providerSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenProviderSettings = useCallback(() => setIsProviderPanelOpen(true), []);
  const handleCloseProviderSettings = useCallback(() => {
    setIsProviderPanelOpen(false);
    // Notify App that the panel closed so it can re-read the roster.
    // This is the roster subscription mechanism: Gate is sync-only, so App
    // learns about roster changes by rechecking on panel close.
    onRosterChange?.();
  }, [onRosterChange]);

  const handleOpenMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const handleCloseMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Mobile backdrop — covers main content while the sidebar drawer is open.
          Tapping it closes the drawer. Hidden on desktop via md:hidden. */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={handleCloseMobileMenu}
        />
      )}

      {/* Sidebar — static on desktop, fixed drawer on mobile */}
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
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={handleCloseMobileMenu}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={handleToggleSettings}
        onOpenProviderSettings={handleOpenProviderSettings}
        providerSettingsTriggerRef={providerSettingsTriggerRef}
        isGhostMode={isGhostMode}
        onToggleGhostMode={onToggleGhostMode}
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
          respects the actual sidebar width rather than assuming a fixed pixel value. */}
      <ProviderSettingsPanel
        isOpen={isProviderPanelOpen}
        onClose={handleCloseProviderSettings}
        triggerRef={providerSettingsTriggerRef}
      />

      {/* Main area — flex-1 */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top header bar — visible only on small screens (below md breakpoint).
            Contains: hamburger (opens sidebar) | logo | new-conversation button.
            Hidden on desktop where the sidebar is always visible. */}
        <div className="flex md:hidden h-12 items-center justify-between px-3 border-b border-border bg-sidebar flex-shrink-0">
          {/* Hamburger — opens mobile sidebar drawer */}
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={isMobileMenuOpen}
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
            {/* Three-line hamburger icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logo — symbol only on very small screens, wordmark appears at sm (640px) */}
          <RoundtableLogo />

          {/* Right-side controls: settings gear + new conversation */}
          <div className="flex items-center">
            {/* Settings gear — opens the mobile drawer and the settings panel within it.
                Must fire both: open the drawer (so the panel is visible) and open settings.
                data-testid distinguishes this from the sidebar settings toggle; both
                legitimately share aria-controls="sidebar-settings-panel" (same panel). */}
            <button
              type="button"
              onClick={() => { handleOpenMobileMenu(); if (!isSettingsOpen) handleToggleSettings(); }}
              aria-label="Settings"
              aria-expanded={isSettingsOpen}
              aria-controls="sidebar-settings-panel"
              data-testid="mobile-settings-toggle"
              className={[
                'flex items-center justify-center',
                'min-w-[44px] min-h-[44px]',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-hover rounded-md',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M13.5 8c0-.34-.03-.67-.09-.99l1.59-1.24-1.5-2.6-1.9.76a5.5 5.5 0 0 0-1.71-.99L9.5 1h-3l-.39 1.94c-.62.26-1.19.58-1.71.99l-1.9-.76-1.5 2.6 1.59 1.24A5.6 5.6 0 0 0 2.5 8c0 .34.03.67.09.99L1 10.23l1.5 2.6 1.9-.76c.52.41 1.09.73 1.71.99L6.5 15h3l.39-1.94c.62-.26 1.19-.58 1.71-.99l1.9.76 1.5-2.6-1.59-1.24c.06-.32.09-.65.09-.99Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* New conversation button */}
            <button
              type="button"
              onClick={onNewConversation}
              aria-label="New conversation"
              className={[
                'flex items-center justify-center',
                'min-w-[44px] min-h-[44px]',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-hover rounded-md',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 2v12M2 8h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation column body — either onboarding (empty roster) or message thread.
            OnboardingEmptyState unmounts automatically when isRosterEmpty becomes false
            (first provider added), revealing the normal MessageThread. */}
        {isRosterEmpty ? (
          <OnboardingEmptyState onOpenProviderSettings={handleOpenProviderSettings} />
        ) : (
          <MessageThread
            messages={messages}
            streamingMessages={streamingMessages}
            models={activeModels}
            onRetry={onRetry}
            onDirectedReply={onDirectedReply}
            tokenCountVisibility={tokenCountVisibility}
            onExport={onExportConversation}
          />
        )}

        {/* Bottom section: model selector + mode switcher + input bar */}
        <div className="flex-shrink-0 px-4 pb-0">
          {/* Row: model selector trigger (left) + mode switcher (right) */}
          <div className="flex items-end justify-between">
            {/* Model selector side — min-w-0 + overflow-hidden so it yields space to the switcher */}
            <div className="min-w-0 overflow-hidden flex-1 mr-3">
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
              />
            </div>
            {/* Interaction mode switcher — flex-shrink-0 so it always renders at natural width */}
            <div className="mb-2 flex-shrink-0">
              <InteractionModeSwitcher
                activeMode={activeMode}
                onModeChange={onModeChange}
              />
            </div>
          </div>
        </div>

        {/* Input bar — fixed at bottom of main area */}
        <div className="flex-shrink-0">
          <InputBar
            onSend={onSend}
            isStreaming={isStreaming}
            isGhostMode={isGhostMode}
            directedReplyTarget={directedReplyTarget}
            onClearDirectedReply={onClearDirectedReply}
            activeModelCount={allModels.filter((m) => m.isActive).length}
          />
        </div>
      </main>
    </div>
  );
}
