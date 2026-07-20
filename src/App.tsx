import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Attachment, AutoChainConfig, Conversation, ExportFormat, InteractionMode, Message, ModelConfig, ModelId, ProviderRoster, StopMessageFn } from '@/types';
import { AppLayout } from '@/ui/AppLayout';
import { RoundtableContext } from '@/ui/RoundtableContext';
// #286: applyRosterAccentColors re-initialises --accent-custom-{id} CSS vars
// when the roster changes (new provider added, color updated via ProviderSettingsPanel).
import { applyRosterAccentColors } from '@/ui/theme';
// useStreamingMessages: UI-owned hook for in-flight streaming accumulation (#158).
// Extracted from App.tsx to reduce the god-component footprint. Pure React state
// management — persistence callbacks are supplied by App so the hook stays
// agnostic about @/storage and ghost-mode concerns.
import { useStreamingMessages } from '@/ui/useStreamingMessages';
// Cross-agent exception: sendMessage, getSessionTokenUsage, and MODEL_REGISTRY
// are pure utilities exported from @/models per the documented exception in
// CLAUDE.md. MODEL_REGISTRY is the static display-metadata registry Atlas
// maintains; we use it to resolve name/color/versions for built-in providers
// when mapping ProviderRoster → ModelConfig[].
import { sendMessage, getSessionTokenUsage, MODEL_REGISTRY } from '@/models';
// Gate cross-agent exception: getModelVersion / setModelVersion / clearModelVersion
// are Gate-owned utilities for persisting per-model version selections.
// getProviderRoster is Gate's public API for the user's configured provider list.
// Aria reads it at app boot to seed model selector state from the real roster
// instead of the static buildDefaultModelConfigs() fallback.
// getActiveStorageProvider is Gate's StorageProvider factory — used here to
// supply useGhostMode with the active provider without App needing to know
// which concrete implementation (Local vs Server) is in use.
import { getModelVersion, setModelVersion, clearModelVersion, getProviderRoster, getActiveStorageProvider, refreshPricing } from '@/auth';
// usePreferencesSync: UI-owned reactive hook for UserPreferences (#312).
// Replaces the former useUserPreferences() (Gate) call here. useUserPreferences
// uses React useState — each call site owns its own state, so TokenCountControl's
// save never propagated back to App.tsx's instance. usePreferencesSync uses
// useSyncExternalStore + a localStorage.setItem patch to give real-time reactivity
// without crossing the /src/auth boundary.
import { usePreferencesSync } from '@/ui/hooks/usePreferencesSync';
// useConversationDefaults: UI-owned hook for loading/saving conversation defaults (#342).
// Reads stored defaults on mount to seed the initial active-model roster and
// interaction mode when there is no active conversation. Writes defaults whenever
// the user changes the active model set or interaction mode, so the next session
// starts with the same state.
import { useConversationDefaults } from '@/ui/hooks/useConversationDefaults';
// Vault cross-agent exception: useConversationStore is the persistence hook
// exported from @/storage. Aria consumes it at the App root to provide real
// persisted conversation state to the sidebar and message thread.
// downloadExportedConversation triggers a Blob download — also imported from
// @/storage per the documented exception. Called by handleExportConversation
// after exportConversation returns the serialized content.
// useGhostMode is the ghost-mode React hook from @/storage. Aria calls it at
// the App root (alongside useConversationStore) to read and toggle ghost status
// for the active conversation, and to save ghost-mode message updates to the
// in-memory GhostModeManager instead of localStorage.
import { useConversationStore, downloadExportedConversation, useGhostMode } from '@/storage';

// ─── Roster → ModelConfig mapping ─────────────────────────────────────────────

/**
 * Maps a ProviderRoster to ModelConfig[]. Called both at boot (initializer)
 * and on every roster change (handleRosterChange) to keep the model selector
 * in sync with provider additions and removals without a full page reload.
 *
 * prevModels is used to preserve runtime state (isActive, systemPrompt,
 * selectedVersionId) for models that already exist. New models start inactive.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function rosterToModelConfigs(
  roster: ProviderRoster,
  prevModels: ModelConfig[],
): ModelConfig[] {
  if (roster.length === 0) return [];
  const registryMap = new Map(MODEL_REGISTRY.map((e) => [e.modelId, e]));
  const prevMap = new Map(prevModels.map((m) => [m.modelId, m]));
  return roster.map((config): ModelConfig => {
    const modelId = config.kind === 'builtin' ? config.modelId : config.id;
    const existing = prevMap.get(modelId);
    if (config.kind === 'builtin') {
      // Built-in: name and color are static (MODEL_REGISTRY never changes at runtime).
      // Return the existing ModelConfig unchanged to preserve all runtime state.
      if (existing) return existing;
      const entry = registryMap.get(config.modelId);
      return {
        modelId: config.modelId,
        name: entry?.name ?? config.modelId,
        color: entry?.color ?? 'accent-other',
        isActive: false,
        systemPrompt: undefined,
        selectedVersionId: getModelVersion(config.modelId),
      };
    } else {
      // Custom provider — no registry entry; use roster display metadata.
      // Always refresh name and color from the roster so user edits propagate
      // without a page reload. (#278: the former early-return was silently
      // discarding color/name edits made to existing providers.) Runtime state
      // (isActive, systemPrompt) is preserved from the existing ModelConfig.
      //
      // #286: color stays as the raw roster value (hex or CSS token). The
      // resolveAccentCssColor function in MessageBubble.tsx redirects custom
      // providers through var(--accent-custom-{id}) at render time, picking up
      // both the roster default (set by applyRosterAccentColors) and any live
      // AccentColorPicker session override (set by AccentColorPicker.saveColor).
      const rosterColor = config.color ?? 'accent-other';
      if (existing) {
        return { ...existing, name: config.displayName, color: rosterColor };
      }
      return {
        modelId: config.id,
        name: config.displayName,
        color: rosterColor,
        isActive: false,
        systemPrompt: undefined,
        selectedVersionId: undefined,
      };
    }
  });
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Conversation store (Vault) ─────────────────────────────────────────────
  // useConversationStore is the persistence hook from @/storage. It provides
  // real persisted conversations and exposes mutation methods. Replaces the
  // former MOCK_CONVERSATIONS + useState<Conversation[]> approach.
  const store = useConversationStore();

  // ── Ghost mode (Vault) ────────────────────────────────────────────────────
  // storageProviderRef holds the active StorageProvider instance for the
  // lifetime of this component — used by useGhostMode to promote/demote
  // conversations between localStorage and the in-memory GhostModeManager.
  // Initialized once via getActiveStorageProvider() (Gate utility).
  const storageProviderRef = useRef(getActiveStorageProvider());

  const {
    toggleGhostMode,
    saveGhostConversation,
    getGhostConversation,
  } = useGhostMode(store.activeConversationId, storageProviderRef.current);

  // isGlobalGhostMode: when true, new conversations are created as ghost
  // conversations (not persisted to localStorage). Toggling via
  // handleToggleGhostMode also demotes/promotes the current active conversation.
  const [isGlobalGhostMode, setIsGlobalGhostMode] = useState(false);

  // Model state seeded from the user's ProviderRoster (Gate) rather than the
  // static buildDefaultModelConfigs(). On app boot we read the roster and map
  // each entry to a ModelConfig:
  //   - Built-in: look up name/color/versions from MODEL_REGISTRY; all start inactive.
  //   - Custom: use displayName and optional color; no versions available.
  // If the roster is empty we produce [] — AppLayout / ModelSelectorPanel will
  // render the empty-roster placeholder (no fallback to buildDefaultModelConfigs).
  // selectedVersionId is seeded from Gate's persisted store (getModelVersion).
  // Re-derived on every roster change via handleRosterChange (see below).
  const [models, setModels] = useState<ModelConfig[]>(() =>
    rosterToModelConfigs(getProviderRoster(), []),
  );

  // Directed reply: when set, the next send is targeted at this model only.
  // Cleared automatically after a message is sent, or manually via the × pill.
  const [pendingTargetModelId, setPendingTargetModelId] = useState<ModelId | null>(null);

  // Edit state (#162): when set, InputBar is in edit mode pre-filled with the
  // original message content. handleSend routes through the truncate+resend path
  // when this is non-null. Cleared on send, cancel, or conversation switch.
  const [editingMessage, setEditingMessage] = useState<{
    messageIndex: number;
    originalContent: string;
  } | null>(null);

  // Interaction mode before any conversation exists (#340): captures the mode
  // the user selects in the switcher before the first message is sent (no active
  // conversation) or when New Chat resets the view. Applied to the next
  // conversation created by handleNewConversation. Seeded as 'parallel' (the
  // default) so the UI starts in a consistent state on every page load.
  // (#342: overridden by stored defaults when getConversationDefaults() resolves
  // and there is no active conversation — see the defaults-apply useEffect below.)
  const [pendingMode, setPendingMode] = useState<InteractionMode>('parallel');

  // Conversation defaults (#342): loads last-used model roster + interaction mode
  // from storage on mount. App applies these to seed the UI when there is no
  // active conversation. Writes updated defaults whenever the user changes the
  // model roster or interaction mode, so the next session inherits the current state.
  const { defaults, defaultsLoaded, saveDefaults } = useConversationDefaults();

  // Ref guard: ensures stored defaults are applied at most once per session.
  // Without this guard, switching away from an active conversation (e.g. after
  // deleting all conversations) would re-apply defaults and override whatever
  // roster state the user had before the delete.
  const defaultsAppliedRef = useRef(false);

  // UserPreferences — reactive read via usePreferencesSync (#312).
  // usePreferencesSync subscribes to localStorage writes via a targeted setItem
  // patch, so tokenCountVisibility updates in real-time when TokenCountControl
  // saves a new preference (without requiring /src/auth modifications).
  const { tokenCountVisibility } = usePreferencesSync();


  // ── Provider roster empty state (#100) ────────────────────────────────────
  // rosterVersion is a monotonic counter. Bumping it forces a re-read of
  // getProviderRoster() whenever the ProviderSettingsPanel closes. This is the
  // simplest roster subscription model: Gate is sync-only, so we re-derive
  // isRosterEmpty on-demand instead of subscribing to storage events.
  const [rosterVersion, setRosterVersion] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const isRosterEmpty = useMemo(
    () => getProviderRoster().length === 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rosterVersion],
  );
  const handleRosterChange = useCallback(() => {
    const freshRoster = getProviderRoster();
    setRosterVersion((v) => v + 1);
    setModels((prev) => rosterToModelConfigs(freshRoster, prev));
    // #286: re-init --accent-custom-{id} CSS vars when the roster changes
    // (new provider added, or ProviderSettingsPanel saved a new roster color).
    applyRosterAccentColors(freshRoster);
  }, []);

  // ── Backend connection change (#265) ───────────────────────────────────────
  // Called by BackendServerPanel (via Sidebar → AppLayout) whenever the user
  // logs in or out of a self-hosted backend server.
  //
  // Two things to refresh:
  //   1. storageProviderRef.current — useGhostMode holds a direct reference to
  //      the StorageProvider; updating the ref here ensures ghost-mode promote/
  //      demote operations use the correct provider (local ↔ server) immediately
  //      without requiring a page reload.
  //   2. handleRosterChange() — re-reads getProviderRoster() so the model
  //      selector reflects any roster changes that took effect with the new
  //      backend session.
  //
  // Note: useConversationStore's internal provider is init-once (a Vault design
  // constraint). Full conversation-store switching still requires a page reload.
  // This handler covers the ghost-mode and roster cases; a Vault-side
  // setProvider() API would be needed to eliminate the reload requirement entirely.
  const handleBackendConnectionChange = useCallback(() => {
    storageProviderRef.current = getActiveStorageProvider();
    handleRosterChange();
  }, [handleRosterChange]);

  // ── Pricing prefetch (#353) ───────────────────────────────────────────────
  // Kick off a background pricing fetch on mount so the table is cached before
  // the first done chunk fires. Fast models (Gemini) can finish streaming before
  // the lazy getPricingTable() fetch completes if we wait until send time.
  useEffect(() => { void refreshPricing(); }, []);

  // ── Pending user message (#270) ───────────────────────────────────────────
  // Tracks a user message that has been sent but whose store update may not yet
  // have propagated through the async persistence path. Without this, the user
  // message disappears from the thread the moment streaming begins — because the
  // first streaming chunk triggers a re-render before replaceInState() fires.
  //
  // Keyed by conversationId so switching conversations never shows a stale pending
  // message. Cleared in the render path once the persisted messages array includes
  // the pending message ID (meaning the store update landed).
  const [pendingUserMessages, setPendingUserMessages] = useState<
    Map<string, Message>
  >(new Map());

  // Derive the active conversation from either the persisted store (normal
  // conversations) or the in-memory GhostModeManager (ghost conversations).
  // Ghost conversations are not in store.conversations, so getActiveConversation()
  // returns undefined for them — fall back to getGhostConversation().
  const activeConversation =
    store.getActiveConversation() ??
    (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);
  // useMemo so the array reference is stable when contents are unchanged.
  // This prevents the pendingUserMessages cleanup effect from re-running on every
  // render — it should only run when the persisted messages actually change.
  const persistedMessages = useMemo(() => activeConversation?.messages ?? [], [activeConversation?.messages]);

  // Merge pending user message into the messages array if it isn't yet in the
  // persisted list. Once the store update lands, the pending entry is dropped
  // automatically because its ID already appears in persistedMessages.
  const pendingMsg = store.activeConversationId
    ? pendingUserMessages.get(store.activeConversationId)
    : undefined;
  const messages =
    pendingMsg && !persistedMessages.some((m) => m.id === pendingMsg.id)
      ? [...persistedMessages, pendingMsg]
      : persistedMessages;

  // Clean up stale pending entries after the store catches up (message ID found
  // in persistedMessages). useEffect defers the cleanup until after paint so the
  // render path above can still use the pendingMsg on that same render cycle.
  // The effect fires whenever persistedMessages identity changes (i.e. after every
  // store update) or the active conversation switches.
  useEffect(() => {
    if (!store.activeConversationId) return;
    const convId = store.activeConversationId;
    const pending = pendingUserMessages.get(convId);
    if (!pending) return;
    // If the pending message is now in the persisted list, remove the Map entry.
    if (persistedMessages.some((m) => m.id === pending.id)) {
      setPendingUserMessages((prev) => {
        const next = new Map(prev);
        next.delete(convId);
        return next;
      });
    }
  }, [persistedMessages, store.activeConversationId, pendingUserMessages]);

  // Derive active models from the shared models array
  const activeModels = models.filter((m) => m.isActive);

  // Seed isActive from the active conversation's stored models when the store
  // finishes loading, or when the user switches to a different conversation.
  // This fixes the reload regression: rosterToModelConfigs() always initialises
  // isActive to false; this effect restores the persisted selection afterwards.
  // Dependency on activeConversation?.id (not the full object) prevents
  // re-seeding on every message update.
  useEffect(() => {
    if (store.isLoading) return;
    if (!activeConversation) return;

    setModels((prev) =>
      prev.map((m) => {
        const savedModel = activeConversation.models.find((sm) => sm.modelId === m.modelId);
        if (!savedModel) return m;
        return { ...m, isActive: savedModel.isActive };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isLoading, activeConversation?.id]);

  // Apply stored defaults (#342) to seed the model roster and interaction mode
  // when there is no active conversation (fresh app load or after all conversations
  // are deleted). This runs after the store finishes loading so we do not fight
  // with the conversation-seeding effect above.
  //
  // Guard: the ref ensures defaults are applied at most once per session. We do
  // not re-apply defaults every time activeConversation becomes null (e.g. after
  // a delete) — one application per session is enough; subsequent roster/mode
  // changes are already saved as new defaults.
  //
  // Priority: the conversation-seeding effect above runs when activeConversation
  // is set and takes precedence over any defaults-applied state. If defaults are
  // applied before the store finishes loading and then a conversation is restored,
  // the conversation-seeding effect will correctly override the defaults-applied
  // model state.
  useEffect(() => {
    if (store.isLoading || !defaultsLoaded) return;
    if (defaultsAppliedRef.current) return;
    if (defaults === null) return;

    defaultsAppliedRef.current = true;
    // Always seed pendingMode from defaults so new conversations inherit the
    // stored mode even when a previous conversation is already active.
    setPendingMode(defaults.interactionMode);
    // Only override the model roster when starting blank — an already-active
    // conversation controls its own roster.
    if (!activeConversation) {
      const defaultActiveIds = new Set(defaults.activeModelIds);
      setModels((prev) =>
        prev.map((m) => ({ ...m, isActive: defaultActiveIds.has(m.modelId) })),
      );
    }
  }, [store.isLoading, defaultsLoaded, defaults, activeConversation]);

  // Resolve ModelConfig for the pending directed-reply target (for pill display).
  const directedReplyTarget = pendingTargetModelId
    ? models.find((m) => m.modelId === pendingTargetModelId)
    : undefined;

  // Compute per-model session token totals for the active conversation.
  // getSessionTokenUsage is a pure utility from @/models — documented cross-agent exception.
  const sessionUsageBase = (activeConversation ? getSessionTokenUsage(activeConversation) : null) ?? [];
  // #353: Enrich sessionUsage with per-model estimated costs from message-level
  // tokenUsage.estimatedCost. getSessionTokenUsage sums token counts only — this
  // pass fills in the estimatedCost field (already on SessionTokenUsage via TokenUsage)
  // so SessionTokenSection can display the cost column.
  const sessionUsage = (() => {
    if (sessionUsageBase.length === 0) return sessionUsageBase;
    const costByModel: Record<string, number> = {};
    for (const msg of activeConversation?.messages ?? []) {
      if (msg.tokenUsage?.estimatedCost !== undefined && msg.modelId) {
        costByModel[msg.modelId] = (costByModel[msg.modelId] ?? 0) + msg.tokenUsage.estimatedCost;
      }
    }
    return sessionUsageBase.map((u) =>
      costByModel[u.modelId] !== undefined
        ? { ...u, estimatedCost: costByModel[u.modelId] }
        : u,
    );
  })();

  // ── Streaming cancellation (#159) ─────────────────────────────────────────
  // abortControllerRef holds the AbortController for the in-flight sendMessage
  // call. Created just before each sendMessage call; cleared when the promise
  // resolves (stream done OR aborted). Stored in a ref (not state) so changes
  // do not trigger re-renders — the stop button visibility is driven by
  // isStreaming (derived from streaming messages state), not by this ref.
  //
  // handleStopMessage is the stable StopMessageFn passed through context. It
  // aborts via the ref so it never goes stale. No-op before any send and after
  // all streams settle (ref is null). useCallback with [] gives a stable
  // reference for the entire lifetime of App — context consumers do not
  // re-render merely because a send started.
  const abortControllerRef = useRef<AbortController | null>(null);

  // flushAbortedStreamsRef allows handleStopMessage ([] deps, stable) to call
  // flushAbortedStreams without adding it to deps — flushAbortedStreams itself is
  // stable (useCallback []) so the ref never goes stale; this just avoids the
  // linter warning and prevents unnecessary context consumer re-renders.
  const flushAbortedStreamsRef = useRef<((conversationId: string) => void) | null>(null);

  // activeConversationIdRef mirrors store.activeConversationId so that
  // handleStopMessage ([] deps, stable) can read the current value without
  // capturing it reactively and without causing context-consumer re-renders.
  // Updated on every render below (same pattern as flushAbortedStreamsRef).
  const activeConversationIdRef = useRef<string | null>(null);

  // handleStopMessage: stable StopMessageFn passed through context ([] deps).
  // Aborts the in-flight request via abortControllerRef and cleans up any
  // priming-chunk placeholder that won't receive a done chunk (#347).
  // All reads go through stable refs — this callback never goes stale.
  const handleStopMessage = useCallback<StopMessageFn>(() => {
    abortControllerRef.current?.abort();
    // #347: Remove empty-content accumulator entries for the active conversation.
    // When abort fires before the HTTP response arrives, Atlas swallows AbortError
    // and emits no done chunk — the priming placeholder hangs forever in the
    // streaming state map. flushAbortedStreams removes only entries with content===''
    // so partial streams (which will still emit their own done chunk) are untouched.
    const convId = activeConversationIdRef.current;
    if (convId) {
      flushAbortedStreamsRef.current?.(convId);
    }
  }, []); // stable: all state reads go through refs above

  // ── In-flight conversation ref (#270 root-cause fix) ─────────────────────
  // sentConversationRef holds the conversation object that was passed to
  // updateConversation / saveGhostConversation in handleSend. This ref is the
  // canonical source of truth for handleMessageComplete — it includes the user
  // message that was just sent, which React's batched state updates may not yet
  // have propagated into store.getActiveConversation() when the first streaming
  // chunk arrives.
  //
  // The race: store.updateConversation() calls replaceInState() → setConversations()
  // (a batched React state update). The Atlas streaming promise resolves almost
  // immediately (first chunk) before React flushes that state update. So
  // store.getActiveConversation() reads the *old* conversations array — without
  // the user message — and handleMessageComplete saves [oldMessages, assistantMsg],
  // silently dropping the user message.
  //
  // Fix: set this ref synchronously in handleSend before the sendMessage() call.
  // handleMessageComplete reads it instead of store.getActiveConversation(). After
  // appending each completed assistant message, the ref is updated so parallel-
  // model completions each start from the correct base (user msg + prior assistants).
  //
  // Ghost conversations: getGhostConversation() is already synchronous and correct;
  // using the ref uniformly avoids divergence between ghost and normal paths.
  const sentConversationRef = useRef<Conversation | null>(null);

  // ── Streaming state (useStreamingMessages hook, #158) ─────────────────────
  // Persistence callback supplied by App so the hook stays agnostic about
  // @/storage, ghost-mode, and conversation-store internals.
  const handleMessageComplete = useCallback(
    (sendingConversationId: string, finalMsg: Message) => {
      // Use sentConversationRef as the base — it always contains the user message
      // because it is set synchronously in handleSend before the first chunk arrives.
      // Falling back to store.getActiveConversation() here would re-introduce the
      // race: React's batched state updates for setConversations may not have fired
      // yet when the first streaming chunk resolves.
      const baseConv =
        (sentConversationRef.current?.id === sendingConversationId
          ? sentConversationRef.current
          : null) ??
        getGhostConversation(sendingConversationId);

      if (baseConv && baseConv.id === sendingConversationId) {
        const updated: Conversation = {
          ...baseConv,
          messages: [...baseConv.messages, finalMsg],
          updatedAt: Date.now(),
        };
        // Advance the ref so the next parallel model completion uses the correct
        // base (includes this assistant message too, not just the user message).
        sentConversationRef.current = updated;
        if (updated.isGhost) {
          saveGhostConversation(updated);
        } else {
          // Fire-and-forget: replaceInState inside updateConversation uses a
          // stale-write guard (updatedAt comparison) so a late-resolving call
          // from a prior auto-chain step cannot overwrite a newer snapshot
          // that has already been applied to state (#374).
          void store.updateConversation(updated);
        }
      }
    },
    [store, getGhostConversation, saveGhostConversation],
  );

  const {
    activeStreamingMessages,
    isStreaming: anyStreaming,
    handleChunk,
    flushAbortedStreams,
  } = useStreamingMessages({
    activeConversationId: store.activeConversationId,
    onMessageComplete: handleMessageComplete,
  });
  // Keep refs current so handleStopMessage (stable [] deps) can access the
  // latest values without capturing them reactively or causing re-renders.
  flushAbortedStreamsRef.current = flushAbortedStreams;
  activeConversationIdRef.current = store.activeConversationId;

  const handleSend = (content: string, attachments: Attachment[] = [], atMentionTargetId?: ModelId) => {
    // Snapshot the active conversation before state updates so sendMessage
    // receives a consistent view and we have a base to build the updated conv from.
    let conversationSnapshot = store.getActiveConversation() ??
      (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);

    // #394: No active conversation (e.g. all conversations deleted, empty state
    // showing) — auto-create one before sending so the message is not silently
    // dropped. Mirrors handleNewConversation: save defaults, build the Conversation
    // object, fire-and-forget storage, and set it active. The rest of handleSend
    // then runs normally using the new conversation as the snapshot.
    if (!conversationSnapshot) {
      saveDefaults(
        models.filter((m) => m.isActive).map((m) => m.modelId),
        pendingMode,
        isGlobalGhostMode,
      );
      const autoConv: Conversation = {
        id: `conv-${Date.now()}`,
        messages: [],
        models: models,
        interactionMode: pendingMode,
        isGhost: isGlobalGhostMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (isGlobalGhostMode) {
        saveGhostConversation(autoConv);
      } else {
        void store.createConversation(autoConv);
      }
      store.setActiveConversation(autoConv.id);
      conversationSnapshot = autoConv;
    }

    let updatedConversation: Conversation;

    if (editingMessage) {
      // ── Edit path (#162) ───────────────────────────────────────────────────
      // Truncate the conversation to the edit point, replace with the edited
      // user message, and re-send. All model responses after the edited message
      // are discarded — the user is restarting from that point.

      // 1. Truncate to the edit point (exclusive: drop the original + all after)
      const truncated: Conversation = {
        ...conversationSnapshot,
        messages: conversationSnapshot.messages.slice(0, editingMessage.messageIndex),
        updatedAt: Date.now(),
      };

      // 2. Build the edited user message
      const editedUserMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // 3. Compose the updated conversation
      updatedConversation = {
        ...truncated,
        messages: [...truncated.messages, editedUserMessage],
      };

      // 4. Clear edit state before persisting so UI snaps to normal mode immediately
      setEditingMessage(null);

      // #270: Register the edited user message as pending so it stays visible
      // while the async store update propagates. Same pattern as normal send path.
      setPendingUserMessages((prev) => {
        const next = new Map(prev);
        next.set(conversationSnapshot.id, editedUserMessage);
        return next;
      });
    } else {
      // ── Normal send path ───────────────────────────────────────────────────
      // #382: @mention targeting takes precedence over the directed-reply pill target.
      const resolvedTargetModelId = atMentionTargetId ?? pendingTargetModelId ?? undefined;
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        // Stamp targetModelId onto the user message so it persists in the thread.
        targetModelId: resolvedTargetModelId,
        timestamp: Date.now(),
        // #285: attach image attachments to the user message for persistence and replay.
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      // Build the updated conversation with the new user message.
      updatedConversation = {
        ...conversationSnapshot,
        messages: [...conversationSnapshot.messages, userMessage],
        updatedAt: Date.now(),
      };

      // #270: Register the user message as pending immediately so it stays
      // visible in the thread even before the async store update lands.
      // Cleared automatically in the render path once the store catches up.
      setPendingUserMessages((prev) => {
        const next = new Map(prev);
        next.set(conversationSnapshot.id, userMessage);
        return next;
      });
    }

    // Persist the updated conversation to storage. updateConversation handles
    // auto-titling (first user message → title) and optimistic in-memory update.
    // Ghost-mode guard: ghost conversations go to GhostModeManager (in-memory),
    // normal conversations go to the LocalStorageProvider via the store.
    if (updatedConversation.isGhost) {
      saveGhostConversation(updatedConversation);
    } else {
      void store.updateConversation(updatedConversation);
    }

    // Set the in-flight ref synchronously so handleMessageComplete has an
    // immediately-correct base that includes the user message (#270 root-cause fix).
    // This must happen before sendMessage() is called so the ref is ready by the
    // time the first streaming chunk arrives and handleMessageComplete fires.
    sentConversationRef.current = updatedConversation;

    // Clear the pending target after send — returns to broadcast mode.
    setPendingTargetModelId(null);

    // Capture conversationId in a local binding so the chunk handler closure
    // always refers to the conversation that initiated this send, not whatever
    // is active at chunk-receipt time (the user may switch conversations mid-stream).
    const sendingConversationId = conversationSnapshot.id;

    // Pass the conversation so sendMessage can resolve per-model systemPrompts
    // from each ModelConfig.systemPrompt on the conversation's models array.
    // handleChunk(sendingConversationId) returns a stable per-send callback that
    // accumulates chunks and calls onMessageComplete when isDone — see #158.
    //
    // AbortController lifecycle (#159): create a fresh controller per send.
    // The signal is threaded into SendMessageOptions so Atlas can abort all
    // in-flight provider streams when the user clicks stop. The controller is
    // cleared in the finally block so abortControllerRef never holds a stale
    // controller after the fan-out resolves (whether normally or via abort).

    // Auto-chain (#299): when the conversation's interaction mode is 'auto-chain',
    // build a ChainConfig from the active roster in their current order. Each step
    // appends its response to context so every subsequent model sees prior replies.
    // maxPasses: 1 — single pass through the sequence per user message.
    // For parallel (or any other mode), chainConfig is undefined — existing
    // fan-out behaviour is preserved.
    const interactionMode = updatedConversation.interactionMode;
    const chainConfig: AutoChainConfig | undefined =
      interactionMode === 'auto-chain'
        ? {
            steps: activeModels.map((model, index) => ({
              modelId: model.modelId,
              appendToContext: true,
              stepIndex: index,
            })),
            maxPasses: 1,
          }
        : undefined;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsPending(true);
    void sendMessage(
      {
        conversationId: sendingConversationId,
        content,
        // Thread targetModelId into SendMessageOptions so Atlas routes to only that model.
        // #382: atMentionTargetId (from @mention) takes precedence over pendingTargetModelId (from pill).
        targetModelId: atMentionTargetId ?? pendingTargetModelId ?? undefined,
        chainConfig,
        conversation: updatedConversation,
        signal: controller.signal,
        // #285: pass attachments so Atlas can include them in vision-capable provider requests.
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      handleChunk(sendingConversationId),
    ).finally(() => {
      // Clear the ref when the stream settles (done or aborted) so
      // handleStopMessage becomes a safe no-op again.
      abortControllerRef.current = null;
      setIsPending(false);
    });
  };

  const handleNewConversation = () => {
    // (#342) Persist the current roster + mode as defaults before creating the
    // new conversation. This ensures that even if the user has not changed
    // anything this session, the next session still inherits their last-used
    // state. Ghost-mode guard is enforced inside saveDefaults.
    saveDefaults(
      models.filter((m) => m.isActive).map((m) => m.modelId),
      activeConversation?.interactionMode ?? pendingMode,
      activeConversation?.isGhost ?? false,
    );

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      messages: [],
      models: models,
      // #340: seed with pendingMode so the user's pre-conversation mode selection
      // (or the mode from the previous conversation) carries forward into the new
      // conversation rather than hardcoding 'parallel' every time.
      interactionMode: pendingMode,
      isGhost: isGlobalGhostMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Ghost-mode path: register with GhostModeManager (in-memory only) and
    // set as active — no localStorage write occurs.
    // Normal path: persist via the conversation store.
    if (isGlobalGhostMode) {
      saveGhostConversation(newConv);
      store.setActiveConversation(newConv.id);
    } else {
      void store.createConversation(newConv).then(() => {
        store.setActiveConversation(newConv.id);
      });
    }
    // Clear directed-reply target and edit state when switching conversations.
    setPendingTargetModelId(null);
    setEditingMessage(null);
  };

  const handleSelectConversation = (id: string) => {
    store.setActiveConversation(id);
    // Clear directed-reply target and edit state when switching conversations.
    setPendingTargetModelId(null);
    setEditingMessage(null);
  };

  /**
   * Called by MessageBubble (via MessageThread) when the user clicks the edit button.
   * Sets edit mode: InputBar pre-fills with the original content of that message.
   * The conversation is truncated and re-sent when the user submits the edit.
   */
  const handleEditMessage = useCallback((messageIndex: number) => {
    const conv = store.getActiveConversation() ??
      (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);
    const msg = conv?.messages[messageIndex];
    if (!msg || msg.role !== 'user') return;
    setEditingMessage({ messageIndex, originalContent: msg.content });
  }, [store, getGhostConversation]);

  /** Called by InputBar Cancel button or Escape key — abandons the current edit. */
  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleToggleModel = (modelId: ModelId) => {
    // Compute the next model list directly (not via functional updater) so we
    // can pass it to both setModels and saveDefaults in the same synchronous
    // event handler. This is safe: handleToggleModel is only called from click
    // handlers, so `models` from the closure is always current.
    const activeCount = models.filter((m) => m.isActive).length;
    const next = models.map((m) => {
      if (m.modelId !== modelId) return m;
      // Guard: cannot deactivate the last active model
      if (m.isActive && activeCount === 1) return m;
      return { ...m, isActive: !m.isActive };
    });

    setModels(next);

    // Persist the updated models to the active conversation.
    // Ghost-mode guard: skip storage writes for ghost conversations.
    const conv = store.getActiveConversation();
    if (conv && !conv.isGhost) {
      void store.updateConversation({
        ...conv,
        models: next,
        updatedAt: Date.now(),
      });
    }

    // (#342) Save conversation defaults so the next new conversation inherits
    // this model roster. Ghost-mode guard is enforced inside saveDefaults.
    saveDefaults(
      next.filter((m) => m.isActive).map((m) => m.modelId),
      conv?.interactionMode ?? pendingMode,
      conv?.isGhost ?? isGlobalGhostMode,
    );
  };

  const handleAddModel = (modelId: ModelId) => {
    // Compute next list directly (not via functional updater) — same rationale
    // as handleToggleModel: called from click handlers only, so `models` is current.
    const next = models.map((m) => (m.modelId === modelId ? { ...m, isActive: true } : m));

    setModels(next);

    // Persist the updated models to the active conversation.
    // Ghost-mode guard: skip storage writes for ghost conversations.
    const conv = store.getActiveConversation();
    if (conv && !conv.isGhost) {
      void store.updateConversation({
        ...conv,
        models: next,
        updatedAt: Date.now(),
      });
    }

    // (#342) Save conversation defaults so the next new conversation includes
    // this model. Ghost-mode guard is enforced inside saveDefaults.
    saveDefaults(
      next.filter((m) => m.isActive).map((m) => m.modelId),
      conv?.interactionMode ?? pendingMode,
      conv?.isGhost ?? isGlobalGhostMode,
    );
  };

  /** Persists the chosen interaction mode on the active conversation. */
  const handleModeChange = (mode: InteractionMode) => {
    // Always keep pendingMode in sync so new conversations inherit the correct
    // mode regardless of whether a conversation is currently active.
    setPendingMode(mode);
    const conv = store.getActiveConversation();
    // #340: No active conversation yet — pendingMode is the only state to update.
    if (!conv) {
      saveDefaults(
        models.filter((m) => m.isActive).map((m) => m.modelId),
        mode,
        isGlobalGhostMode,
      );
      return;
    }
    // Ghost-mode guard: ghost conversations are in-memory only; no storage write.
    if (conv.isGhost) return;
    void store.updateConversation({ ...conv, interactionMode: mode, updatedAt: Date.now() });
    saveDefaults(
      models.filter((m) => m.isActive).map((m) => m.modelId),
      mode,
      false,
    );
  };

  const handleUpdateSystemPrompt = (modelId: ModelId, value: string) => {
    const updatedSystemPrompt = value || undefined;

    // Keep top-level models mirror in sync.
    setModels((prev) =>
      prev.map((m) =>
        m.modelId === modelId ? { ...m, systemPrompt: updatedSystemPrompt } : m,
      ),
    );

    // Also sync into the active conversation's models so the prompt survives
    // persistence and is available to sendMessage when it reads conversation.models.
    // Ghost-mode guard: skip storage writes for ghost conversations.
    const conv = store.getActiveConversation();
    if (conv && !conv.isGhost) {
      void store.updateConversation({
        ...conv,
        models: conv.models.map((m) =>
          m.modelId === modelId ? { ...m, systemPrompt: updatedSystemPrompt } : m,
        ),
        updatedAt: Date.now(),
      });
    }
  };

  /**
   * Persists the user's version choice for a model (Gate) and mirrors it into
   * local ModelConfig state so the picker reflects the selection immediately.
   */
  const handleSelectModelVersion = useCallback((modelId: ModelId, versionId: string) => {
    setModelVersion(modelId, versionId);
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, selectedVersionId: versionId } : m)),
    );
  }, []);

  /**
   * Clears the stored version for a model (Gate), reverting to provider default.
   * Mirrors the reset into local state by setting selectedVersionId to undefined.
   */
  const handleClearModelVersion = useCallback((modelId: ModelId) => {
    clearModelVersion(modelId);
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, selectedVersionId: undefined } : m)),
    );
  }, []);

  const handleDirectedReply = useCallback((modelId: ModelId) => {
    setPendingTargetModelId(modelId);
  }, []);

  const handleClearDirectedReply = useCallback(() => {
    setPendingTargetModelId(null);
  }, []);

  /**
   * Retry a failed model response.
   *
   * Removes the failed assistant message from the conversation, then re-sends
   * to only the model that failed. The rest of the conversation history
   * (including any other models' successful responses) is preserved as context.
   *
   * Mirrors the handleSend flow for sentConversationRef and AbortController
   * lifecycle: the ref is set synchronously before sendMessage() is called so
   * handleMessageComplete reads the correct base when the retry stream completes.
   *
   * Ghost-mode guard: follows the same saveGhostConversation / updateConversation
   * branching as handleSend.
   */
  const handleRetry = useCallback((messageId: string) => {
    const conversationSnapshot =
      store.getActiveConversation() ??
      (store.activeConversationId
        ? getGhostConversation(store.activeConversationId)
        : undefined);
    if (!conversationSnapshot) return;

    // Locate the failed assistant message.
    const failedMessage = conversationSnapshot.messages.find((m) => m.id === messageId);
    if (!failedMessage || failedMessage.role !== 'assistant' || !failedMessage.modelId) return;

    const failedModelId = failedMessage.modelId;

    // Build a conversation without the failed message. This is the base
    // handleMessageComplete will append the new response to, and the history
    // the retried provider will receive (so it does not see its own failed attempt).
    const conversationWithoutFailed: Conversation = {
      ...conversationSnapshot,
      messages: conversationSnapshot.messages.filter((m) => m.id !== messageId),
      updatedAt: Date.now(),
    };

    // Persist the removal so the failed message disappears from the UI immediately.
    if (conversationWithoutFailed.isGhost) {
      saveGhostConversation(conversationWithoutFailed);
    } else {
      void store.updateConversation(conversationWithoutFailed);
    }

    // Set the ref synchronously — same requirement as in handleSend. When the
    // retry stream completes, handleMessageComplete reads this ref as the base
    // to append the new response to. It must be set before sendMessage() so it
    // is ready when the first chunk arrives.
    sentConversationRef.current = conversationWithoutFailed;

    // content is required by SendMessageOptions but ignored when `conversation`
    // is provided (sendMessage uses conversation.messages directly in that path).
    // Pass the last user message content to keep the value semantically correct.
    const lastUserMsg = [...conversationWithoutFailed.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const content = lastUserMsg?.content ?? '';

    const sendingConversationId = conversationSnapshot.id;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsPending(true);
    void sendMessage(
      {
        conversationId: sendingConversationId,
        content,
        targetModelId: failedModelId,
        conversation: conversationWithoutFailed,
        signal: controller.signal,
      },
      handleChunk(sendingConversationId),
    ).finally(() => {
      abortControllerRef.current = null;
      setIsPending(false);
    });
  }, [store, getGhostConversation, saveGhostConversation, handleChunk]);

  // ── Ghost mode toggle ─────────────────────────────────────────────────────
  // Toggles the active conversation's ghost status via useGhostMode, and
  // flips isGlobalGhostMode so subsequent new conversations follow suit.
  const handleToggleGhostMode = useCallback(async () => {
    if (!activeConversation) {
      // No active conversation — just flip the global flag so the next new
      // conversation is created in the correct mode.
      setIsGlobalGhostMode((prev) => !prev);
      return;
    }
    const updated = await toggleGhostMode(activeConversation);
    // After toggle, the conversation has moved (ghost ↔ normal). If it was
    // promoted to normal, it is now in localStorage and we need to register
    // it with the store. If demoted to ghost, useGhostMode already handled
    // removal from localStorage and registration with GhostModeManager.
    if (!updated.isGhost) {
      // Promoted: register in the conversation store so it appears in the sidebar.
      void store.updateConversation(updated);
    }
    setIsGlobalGhostMode((prev) => !prev);
  }, [activeConversation, toggleGhostMode, store]);

  // ── Conversation management mutations ──────────────────────────────────────
  // These are thin pass-throughs — App only threads UI props, no business logic.

  const handleArchiveConversation = useCallback(
    (id: string) => { void store.archiveConversation(id); },
    [store],
  );

  const handleUnarchiveConversation = useCallback(
    (id: string) => { void store.unarchiveConversation(id); },
    [store],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => { void store.deleteConversation(id); },
    [store],
  );

  const handleSetConversationGroup = useCallback(
    (id: string, groupId: string | undefined) => { void store.setConversationGroup(id, groupId); },
    [store],
  );

  const handleBulkArchive = useCallback(
    (ids: string[]) => { for (const id of ids) void store.archiveConversation(id); },
    [store],
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => { for (const id of ids) void store.deleteConversation(id); },
    [store],
  );

  /**
   * Rename a conversation by setting (or clearing) its `title` field.
   * An empty newTitle clears the title so auto-title can re-derive it from
   * the first user message on next updateConversation. A non-empty newTitle
   * is persisted directly, bypassing auto-title (which only fires when title
   * is undefined — so explicitly setting "" is treated as "let auto-title fire").
   */
  const handleRenameConversation = useCallback(
    (id: string, newTitle: string) => {
      const conv = store.getConversation(id);
      if (!conv || conv.isGhost) return;
      const trimmed = newTitle.trim();
      // Pass undefined for title to let auto-title re-derive; pass the string to set explicitly.
      void store.updateConversation({
        ...conv,
        title: trimmed === '' ? undefined : trimmed,
        updatedAt: Date.now(),
      });
    },
    [store],
  );

  /**
   * Export handler: delegates to store.exportConversation then triggers a
   * browser download via downloadExportedConversation from @/storage.
   * Only fires when there is an active conversation — ExportButton is disabled
   * when no conversation is active or it has no messages.
   */
  const handleExportConversation = useCallback(
    async (format: ExportFormat) => {
      if (!store.activeConversationId) return;
      const result = await store.exportConversation(store.activeConversationId, format);
      if (result) downloadExportedConversation(result);
    },
    [store],
  );

  return (
    <RoundtableContext.Provider
      value={{
        conversations: store.conversations,
        activeConversationId: store.activeConversationId,
        isConversationsLoading: store.isLoading,
        conversationStoreError: store.storageError,
        onSelectConversation: handleSelectConversation,
        onNewConversation: handleNewConversation,
        onArchiveConversation: handleArchiveConversation,
        onUnarchiveConversation: handleUnarchiveConversation,
        onDeleteConversation: handleDeleteConversation,
        onSetConversationGroup: handleSetConversationGroup,
        onRenameConversation: handleRenameConversation,
        onBulkArchive: handleBulkArchive,
        onBulkDelete: handleBulkDelete,
        isGhostMode: isGlobalGhostMode,
        onToggleGhostMode: handleToggleGhostMode,
        messages,
        streamingMessages: activeStreamingMessages,
        activeModels,
        allModels: models,
        onRetry: handleRetry,
        onDirectedReply: handleDirectedReply,
        tokenCountVisibility,
        onExportConversation: store.activeConversationId ? handleExportConversation : undefined,
        onEditMessage: handleEditMessage,
        editingMessage: editingMessage ?? undefined,
        onCancelEdit: handleCancelEdit,
        isStreaming: anyStreaming || isPending,
        directedReplyTarget,
        onClearDirectedReply: handleClearDirectedReply,
        stopMessage: handleStopMessage,
        onToggleModel: handleToggleModel,
        onAddModel: handleAddModel,
        onUpdateSystemPrompt: handleUpdateSystemPrompt,
        onSelectModelVersion: handleSelectModelVersion,
        onClearModelVersion: handleClearModelVersion,
        sessionUsage,
        // #340: fall back to pendingMode (not literal 'parallel') so the
        // mode switcher reflects the user's selection before any conversation exists.
        activeMode: activeConversation?.interactionMode ?? pendingMode,
        onModeChange: handleModeChange,
        isRosterEmpty,
        onRosterChange: handleRosterChange,
      }}
    >
      <AppLayout onSend={handleSend} onBackendConnectionChange={handleBackendConnectionChange} />
    </RoundtableContext.Provider>
  );
}
