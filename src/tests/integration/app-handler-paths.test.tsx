/**
 * Integration: App.tsx handler paths — issues #207, #208, #209
 *
 * Covers three handler paths in App.tsx that were left uncovered by the
 * prior Scout session (#189 / app-chunk-handler.test.tsx):
 *
 *   #207 — handleToggleGhostMode (async ghost ↔ normal toggle coordination)
 *   #208 — handleRosterChange (model list re-derivation on provider changes)
 *   #209 — handleSend with pendingTargetModelId (directed-reply routing path)
 *
 * Mocking strategy: identical to app-chunk-handler.test.tsx — mock @/models,
 * @/storage, and @/auth at the module boundary; replace @/ui/AppLayout with a
 * prop-capturing spy so we observe what App passes down without DOM coupling.
 *
 * Cross-agent contracts exercised:
 *   toggleGhostMode (Vault/useGhostMode) — ghost ↔ normal promotion/demotion
 *   store.updateConversation (Vault) — called after ghost→normal promotion
 *   getProviderRoster (Gate) — re-read on every handleRosterChange call
 *   sendMessage (Atlas) — receives targetModelId from pendingTargetModelId
 *   Message.targetModelId (Arch/types) — stamped onto user message on directed send
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import type {
  Conversation,
  ModelConfig,
  ProviderRoster,
} from '@/types/index';
import type { RoundtableContextValue } from '@/ui/RoundtableContext';
import { buildLocalStorageMock, resetIdSeq } from '../fixtures/conversations';

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

// Mutable roster — tests swap this to drive handleRosterChange behavior.
let currentRoster: ProviderRoster = [
  { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
];

// Controlled sendMessage mock — captures options so directed-reply tests can
// inspect what targetModelId was passed in.
let capturedSendOptions: Record<string, unknown> | null = null;

vi.mock('@/models', () => ({
  sendMessage: vi.fn(
    (opts: Record<string, unknown>) => {
      capturedSendOptions = opts;
      return Promise.resolve();
    },
  ),
  MODEL_REGISTRY: [
    {
      modelId: 'claude',
      name: 'Claude',
      providerName: 'Anthropic',
      color: 'accent-claude',
      defaultActive: true,
      availableVersions: [{ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4' }],
    },
    {
      modelId: 'gpt-5.5',
      name: 'GPT-5.5',
      providerName: 'OpenAI',
      color: 'accent-gpt',
      defaultActive: false,
      availableVersions: [],
    },
  ],
  getSessionTokenUsage: vi.fn().mockReturnValue([]),
  buildDefaultModelConfigs: vi.fn().mockReturnValue([]),
  PROVIDERS: [],
}));

// Mutable conversation for tests.
let mockActiveConversation: Conversation | undefined;

const mockUpdateConversation = vi.fn();
const mockCreateConversation = vi.fn();
const mockSetActiveConversation = vi.fn();

// Mutable ghost-mode mocks — re-assigned per test for #207 scenarios.
let mockToggleGhostMode = vi.fn();
let mockSaveGhostConversation = vi.fn();
let mockGetGhostConversation = vi.fn().mockReturnValue(undefined);

vi.mock('@/storage', () => ({
  useConversationStore: vi.fn(() => ({
    conversations: mockActiveConversation ? [mockActiveConversation] : [],
    activeConversationId: mockActiveConversation?.id ?? null,
    isLoading: false,
    storageError: null,
    getActiveConversation: vi.fn(() => mockActiveConversation),
    updateConversation: mockUpdateConversation,
    createConversation: mockCreateConversation,
    setActiveConversation: mockSetActiveConversation,
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    setConversationGroup: vi.fn(),
    exportConversation: vi.fn(),
  })),
  downloadExportedConversation: vi.fn(),
  // #342: useConversationDefaults imports these from @/storage.
  // Plain arrow functions (not vi.fn()) so vi.restoreAllMocks() in afterEach
  // does not reset them back to undefined between tests.
  getConversationDefaults: () => Promise.resolve(null),
  saveConversationDefaults: () => Promise.resolve(undefined),
  useGhostMode: vi.fn(() => ({
    isGhost: false,
    toggleGhostMode: mockToggleGhostMode,
    saveGhostConversation: mockSaveGhostConversation,
    getGhostConversation: mockGetGhostConversation,
  })),
}));

vi.mock('@/auth', () => ({
  getProviderRoster: vi.fn(() => currentRoster),
  getModelVersion: () => undefined,
  setModelVersion: () => {},
  clearModelVersion: () => {},
  getActiveStorageProvider: () => ({}),
  useUserPreferences: () => [{ tokenCountVisibility: 'always' }],
  getCredentials: () => null,
  saveCredentials: () => {},
  clearCredentials: () => {},
  hasCredential: () => false,
  getThemePreference: () => null,
  saveThemePreference: () => {},
  setActiveTheme: () => {},
  getUserPreferences: () => ({}),
  saveUserPreferences: () => {},
  getModelVersions: () => [],
  // #353: App.tsx calls refreshPricing() on mount to prefetch pricing data.
  refreshPricing: () => Promise.resolve(),
}));

// AppLayout spy — captures props AND context values on every render.
// After #174, most state is delivered via RoundtableContext rather than props.
let lastAppLayoutProps: Record<string, unknown> = {};
let lastContextValue: RoundtableContextValue | null = null;
vi.mock('@/ui/AppLayout', async () => {
  const { useRoundtable } = await import('@/ui/RoundtableContext');
  return {
    AppLayout: (props: Record<string, unknown>) => {
      lastAppLayoutProps = props;
      lastContextValue = useRoundtable();
      return null;
    },
  };
});

// ─── Imports (after mocks are declared) ──────────────────────────────────────

import App from '@/App';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_CONV_ID = 'conv-app-handler-001';

function makeTestConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: BASE_CONV_ID,
    messages: [],
    models: [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true } as ModelConfig,
    ],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Call onToggleGhostMode from context (post-#174: no longer a prop). */
async function triggerToggleGhostMode(): Promise<void> {
  await act(async () => {
    await lastContextValue!.onToggleGhostMode();
  });
}

/** Call onRosterChange from context (post-#174: no longer a prop). */
function triggerRosterChange(): void {
  act(() => {
    lastContextValue!.onRosterChange();
  });
}

/** Call onSend — still a prop after #174. */
function triggerSend(content = 'hello'): void {
  act(() => {
    const onSend = lastAppLayoutProps.onSend as (content: string) => void;
    onSend(content);
  });
}

/** Call onDirectedReply from context (post-#174: no longer a prop). */
function triggerDirectedReply(modelId: string): void {
  act(() => {
    lastContextValue!.onDirectedReply(modelId);
  });
}

/** Call onClearDirectedReply from context (post-#174: no longer a prop). */
function triggerClearDirectedReply(): void {
  act(() => {
    lastContextValue!.onClearDirectedReply();
  });
}

/** Read allModels from context (post-#174: no longer a prop). */
function getAllModels(): ModelConfig[] {
  return lastContextValue?.allModels ?? [];
}

/** Read isGhostMode from context (post-#174: no longer a prop). */
function isGhostMode(): boolean {
  return Boolean(lastContextValue?.isGhostMode);
}

/** Read directedReplyTarget from context (post-#174: no longer a prop). */
function getDirectedReplyTarget(): ModelConfig | undefined {
  return lastContextValue?.directedReplyTarget;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(async () => {
  resetIdSeq();
  capturedSendOptions = null;
  lastAppLayoutProps = {};
  lastContextValue = null;
  mockActiveConversation = makeTestConversation();
  mockUpdateConversation.mockClear();
  mockCreateConversation.mockClear();
  mockToggleGhostMode = vi.fn();
  mockSaveGhostConversation = vi.fn();
  mockGetGhostConversation = vi.fn().mockReturnValue(undefined);
  // Reset roster to single-model default.
  currentRoster = [
    { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
  ];
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;

  // Re-apply mutable ghost-mode mocks after each reset.
  const { useGhostMode } = await import('@/storage');
  (useGhostMode as Mock).mockReturnValue({
    isGhost: false,
    toggleGhostMode: mockToggleGhostMode,
    saveGhostConversation: mockSaveGhostConversation,
    getGhostConversation: mockGetGhostConversation,
  });
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Issue #207 — handleToggleGhostMode ───────────────────────────────────────

describe('#207 — handleToggleGhostMode', () => {
  it('with no active conversation: flips isGhostMode flag without calling toggleGhostMode', async () => {
    // Remove the active conversation so handleToggleGhostMode takes the early-return path.
    mockActiveConversation = undefined;

    render(<App />);

    expect(isGhostMode()).toBe(false);

    await triggerToggleGhostMode();

    // toggleGhostMode (Vault) must NOT be called — no conversation to toggle.
    expect(mockToggleGhostMode).not.toHaveBeenCalled();
    // The global flag should have flipped.
    expect(isGhostMode()).toBe(true);
  });

  it('with no active conversation: second toggle flips isGhostMode back to false', async () => {
    mockActiveConversation = undefined;

    render(<App />);

    await triggerToggleGhostMode();
    expect(isGhostMode()).toBe(true);

    await triggerToggleGhostMode();
    expect(isGhostMode()).toBe(false);
  });

  it('with a normal conversation: calls toggleGhostMode with the active conversation', async () => {
    const conv = makeTestConversation({ isGhost: false });
    mockActiveConversation = conv;
    // Simulate demoting to ghost — returns conversation with isGhost: true.
    const demotedConv = { ...conv, isGhost: true };
    mockToggleGhostMode.mockResolvedValue(demotedConv);

    render(<App />);

    await triggerToggleGhostMode();

    expect(mockToggleGhostMode).toHaveBeenCalledTimes(1);
    expect(mockToggleGhostMode).toHaveBeenCalledWith(
      expect.objectContaining({ id: BASE_CONV_ID, isGhost: false }),
    );
  });

  it('when conversation is promoted to normal (ghost→normal): calls store.updateConversation', async () => {
    const conv = makeTestConversation({ isGhost: true });
    mockActiveConversation = conv;
    // Simulate promoting to normal — returns conversation with isGhost: false.
    const promotedConv = { ...conv, isGhost: false };
    mockToggleGhostMode.mockResolvedValue(promotedConv);

    render(<App />);

    await triggerToggleGhostMode();

    // After promotion, App must register the conversation with the store.
    expect(mockUpdateConversation).toHaveBeenCalledTimes(1);
    const [savedConv] = mockUpdateConversation.mock.calls[0] as [Conversation];
    expect(savedConv.isGhost).toBe(false);
    expect(savedConv.id).toBe(BASE_CONV_ID);
  });

  it('when conversation is demoted to ghost (normal→ghost): does NOT call store.updateConversation', async () => {
    const conv = makeTestConversation({ isGhost: false });
    mockActiveConversation = conv;
    const demotedConv = { ...conv, isGhost: true };
    mockToggleGhostMode.mockResolvedValue(demotedConv);

    render(<App />);

    await triggerToggleGhostMode();

    // Ghost-mode demotion is managed entirely by useGhostMode — store must not be called.
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it('toggle always flips isGhostMode regardless of ghost direction', async () => {
    const conv = makeTestConversation({ isGhost: false });
    mockActiveConversation = conv;
    const demotedConv = { ...conv, isGhost: true };
    mockToggleGhostMode.mockResolvedValue(demotedConv);

    render(<App />);
    expect(isGhostMode()).toBe(false);

    await triggerToggleGhostMode();

    expect(isGhostMode()).toBe(true);
  });
});

// ─── Issue #208 — handleRosterChange ─────────────────────────────────────────

describe('#208 — handleRosterChange', () => {
  it('re-reads the roster from Gate and rebuilds the model list', () => {
    // Start with claude-only roster.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);

    // Confirm initial state — only claude in allModels.
    const initialModels = getAllModels();
    expect(initialModels.map((m) => m.modelId)).toContain('claude');
    expect(initialModels.map((m) => m.modelId)).not.toContain('gpt-5.5');

    // Simulate provider settings panel adding gpt-5.5 to the roster.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
    ];

    triggerRosterChange();

    const updatedModels = getAllModels();
    expect(updatedModels.map((m) => m.modelId)).toContain('claude');
    expect(updatedModels.map((m) => m.modelId)).toContain('gpt-5.5');
  });

  it('removing a model from the roster removes it from allModels', () => {
    // Start with two models.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
    ];

    render(<App />);

    // Both models should be present initially.
    let models = getAllModels();
    expect(models).toHaveLength(2);

    // User removes gpt-5.5 from provider settings.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    triggerRosterChange();

    models = getAllModels();
    expect(models).toHaveLength(1);
    expect(models[0]!.modelId).toBe('claude');
  });

  it('roster change with empty roster produces an empty model list', () => {
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);

    currentRoster = [];
    triggerRosterChange();

    expect(getAllModels()).toHaveLength(0);
  });

  it('roster change preserves isActive state for existing models', () => {
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);

    // Activate claude via the onAddModel handler (post-#174: in context, not props).
    act(() => {
      lastContextValue!.onAddModel('claude');
    });

    // claude should now be active.
    let models = getAllModels();
    const claudeBefore = models.find((m) => m.modelId === 'claude');
    expect(claudeBefore?.isActive).toBe(true);

    // Adding gpt-5.5 to roster should not disturb claude's isActive state.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
    ];

    triggerRosterChange();

    models = getAllModels();
    const claudeAfter = models.find((m) => m.modelId === 'claude');
    expect(claudeAfter?.isActive).toBe(true);
  });

  it('newly added models start inactive', () => {
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);

    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
    ];

    triggerRosterChange();

    const gpt = getAllModels().find((m) => m.modelId === 'gpt-5.5');
    expect(gpt).toBeDefined();
    expect(gpt?.isActive).toBe(false);
  });

  it('multiple roster changes each re-derive the model list from the current roster', () => {
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);
    expect(getAllModels()).toHaveLength(1);

    // First change — add gpt-5.5.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
      { kind: 'builtin', modelId: 'gpt-5.5', credentialKey: 'openai', isVisible: true },
    ];
    triggerRosterChange();
    expect(getAllModels()).toHaveLength(2);

    // Second change — remove gpt-5.5 again.
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];
    triggerRosterChange();
    expect(getAllModels()).toHaveLength(1);
    expect(getAllModels()[0]!.modelId).toBe('claude');
  });
});

// ─── Issue #209 — handleSend with pendingTargetModelId ───────────────────────

describe('#209 — handleSend with pendingTargetModelId (directed reply)', () => {
  it('onDirectedReply sets directedReplyTarget to the chosen model', () => {
    currentRoster = [
      { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
    ];

    render(<App />);

    // No target initially.
    expect(getDirectedReplyTarget()).toBeUndefined();

    triggerDirectedReply('claude');

    // directedReplyTarget should now resolve to the claude ModelConfig.
    const target = getDirectedReplyTarget();
    expect(target).toBeDefined();
    expect(target?.modelId).toBe('claude');
  });

  it('onClearDirectedReply clears directedReplyTarget', () => {
    render(<App />);

    triggerDirectedReply('claude');
    expect(getDirectedReplyTarget()).toBeDefined();

    triggerClearDirectedReply();
    expect(getDirectedReplyTarget()).toBeUndefined();
  });

  it('directed send stamps targetModelId on the user message', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    triggerDirectedReply('claude');
    triggerSend('speak to claude only');

    expect(mockUpdateConversation).toHaveBeenCalledTimes(1);
    const [savedConv] = mockUpdateConversation.mock.calls[0] as [Conversation];
    const userMsg = savedConv.messages[savedConv.messages.length - 1];
    expect(userMsg?.role).toBe('user');
    expect(userMsg?.targetModelId).toBe('claude');
  });

  it('directed send passes targetModelId to sendMessage options', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    triggerDirectedReply('claude');
    triggerSend('only claude should see this');

    expect(capturedSendOptions).not.toBeNull();
    expect(capturedSendOptions?.targetModelId).toBe('claude');
  });

  it('pendingTargetModelId is cleared after send (returns to broadcast mode)', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    triggerDirectedReply('claude');
    expect(getDirectedReplyTarget()).toBeDefined();

    triggerSend('directed message');

    // After send, target pill should be gone.
    expect(getDirectedReplyTarget()).toBeUndefined();
  });

  it('broadcast send (no target): targetModelId is undefined on user message', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    // No directed reply set — regular broadcast.
    triggerSend('broadcast to all');

    expect(mockUpdateConversation).toHaveBeenCalledTimes(1);
    const [savedConv] = mockUpdateConversation.mock.calls[0] as [Conversation];
    const userMsg = savedConv.messages[savedConv.messages.length - 1];
    expect(userMsg?.targetModelId).toBeUndefined();
  });

  it('broadcast send: sendMessage receives no targetModelId (undefined)', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    triggerSend('broadcast');

    expect(capturedSendOptions?.targetModelId).toBeUndefined();
  });

  it('pendingTargetModelId cleared after directed send — subsequent send is a broadcast', () => {
    mockActiveConversation = makeTestConversation();
    mockUpdateConversation.mockResolvedValue(undefined);

    render(<App />);

    // First send is directed.
    triggerDirectedReply('claude');
    triggerSend('directed');

    // Reset mocks to track second send independently.
    mockUpdateConversation.mockClear();
    capturedSendOptions = null;

    // Second send — no explicit directed reply — should be a broadcast.
    triggerSend('broadcast after directed');

    const [savedConv] = mockUpdateConversation.mock.calls[0] as [Conversation];
    const userMsg = savedConv.messages[savedConv.messages.length - 1];
    expect(userMsg?.targetModelId).toBeUndefined();
    expect((capturedSendOptions as Record<string, unknown> | null)?.['targetModelId']).toBeUndefined();
  });
});
