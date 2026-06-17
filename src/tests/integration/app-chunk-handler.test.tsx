/**
 * Integration: App.tsx chunk handler
 *
 * Tests the streaming chunk processing logic inside App.tsx — the anonymous
 * function passed as the second argument to sendMessage() within handleSend().
 * This is described as "the most complex imperative logic in the codebase" and
 * was previously untested.
 *
 * Cross-agent contract exercised:
 *   StreamChunk protocol (Arch) — content accumulation, isDone=true finalization
 *   accumulatorRef + streamingMessages state (App) — in-flight message tracking
 *   store.updateConversation (Vault) — final message persistence for normal convs
 *   saveGhostConversation (Vault) — final message persistence for ghost convs
 *   sendMessage() (Atlas) — mocked at the module boundary
 *
 * Mocking strategy: mock @/models and @/storage at the module boundary (not at
 * the agent interface boundary). @/ui/AppLayout is replaced with a prop-capturing
 * spy so we can observe the streamingMessages and messages props that App passes
 * down after each chunk. This gives us behavioral assertions (what does the UI
 * see?) without coupling to implementation details.
 *
 * Testing approach: render <App /> with controlled mocks; call onSend via the
 * captured AppLayout props; manually drive chunks through the captured onChunk
 * callback; assert on the streamingMessages and messages props captured from
 * AppLayout renders.
 *
 * NOTE on fake timers: userEvent v14 deadlocks with vi.useFakeTimers(). We use
 * act() + real timers here — the chunk handler is synchronous so no timer
 * manipulation is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import type {
  Conversation,
  Message,
  ModelConfig,
  StreamChunk,
  StreamHandler,
} from '@/types/index';
import { buildLocalStorageMock, resetIdSeq } from '../fixtures/conversations';

// ─── Module mocks (hoisted before imports) ────────────────────────────────────
//
// Vitest hoists vi.mock() to the top of the file, so these factories run before
// module initialization. The import of the mocked modules below will receive
// the mock implementations.

// Controlled sendMessage mock — lets tests capture the onChunk callback and
// drive chunks manually. The mock resolves immediately; tests push chunks
// through capturedOnChunk in act() blocks.
let capturedOnChunk: StreamHandler | null = null;

// NOTE: We do NOT use importOriginal for @/models because the async factory
// creates a module-resolution ordering issue with @/auth. Instead, we mock
// only the specific exports that App.tsx imports.
vi.mock('@/models', () => ({
  sendMessage: vi.fn(
    (_opts: unknown, onChunk: StreamHandler) => {
      capturedOnChunk = onChunk;
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
  ],
  getSessionTokenUsage: vi.fn().mockReturnValue([]),
  // Stub other exports that may be imported transitively.
  buildDefaultModelConfigs: vi.fn().mockReturnValue([]),
  PROVIDERS: [],
}));

// Conversation store mock — minimal shape that App consumes.
// activeConversation is mutable so tests can set up different states.
let mockActiveConversation: Conversation | undefined;
const mockUpdateConversation = vi.fn();
const mockCreateConversation = vi.fn();
const mockSetActiveConversation = vi.fn();

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
  useGhostMode: vi.fn(() => ({
    isGhost: false,
    toggleGhostMode: vi.fn(),
    saveGhostConversation: vi.fn(),
    getGhostConversation: vi.fn().mockReturnValue(undefined),
  })),
}));

vi.mock('@/auth', () => ({
  // Plain arrow functions (not vi.fn()) to guarantee the mock value is always
  // available even during module initialization, before vi.fn() instances are set up.
  getProviderRoster: () => [
    { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true },
  ],
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
}));

// AppLayout spy — captures the props App passes down so we can observe the
// chunk handler's output without relying on DOM rendering.
let lastAppLayoutProps: Record<string, unknown> = {};
vi.mock('@/ui/AppLayout', () => ({
  AppLayout: (props: Record<string, unknown>) => {
    lastAppLayoutProps = props;
    return null;
  },
}));

// ─── Imports (after mocks are declared) ──────────────────────────────────────

import App from '@/App';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_CONV_ID = 'conv-test-001';

function makeTestConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: BASE_CONV_ID,
    messages: [],
    models: [
      {
        modelId: 'claude',
        name: 'Claude',
        color: 'accent-claude',
        isActive: true,
      } as ModelConfig,
    ],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Push a single StreamChunk through the captured onChunk handler inside an
 * act() so React processes any resulting state updates before we assert.
 */
function pushChunk(chunk: StreamChunk): void {
  act(() => {
    if (!capturedOnChunk) throw new Error('onChunk not yet captured — call onSend first');
    capturedOnChunk(chunk);
  });
}

/**
 * Call the onSend handler that App passed to AppLayout, then capture the
 * resulting onChunk callback from the mocked sendMessage call.
 */
function triggerSend(content = 'hello'): void {
  act(() => {
    const onSend = lastAppLayoutProps.onSend as (content: string) => void;
    onSend(content);
  });
}

/** Read streamingMessages from the last AppLayout render. */
function getStreamingMessages(): Message[] {
  return (lastAppLayoutProps.streamingMessages ?? []) as Message[];
}

/** True if isStreaming prop passed to AppLayout is currently true. */
function isStreaming(): boolean {
  return Boolean(lastAppLayoutProps.isStreaming);
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  resetIdSeq();
  capturedOnChunk = null;
  lastAppLayoutProps = {};
  mockActiveConversation = makeTestConversation();
  mockUpdateConversation.mockClear();
  mockCreateConversation.mockClear();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('chunk handler — normal streaming accumulation', () => {
  it('first content chunk creates an in-progress streaming message', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Hello', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming).toHaveLength(1);
    expect(streaming[0].content).toBe('Hello');
    expect(streaming[0].modelId).toBe('claude');
    expect(streaming[0].isStreaming).toBe(true);
    expect(streaming[0].role).toBe('assistant');
  });

  it('subsequent content chunks accumulate onto the same message', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Hello', isDone: false });
    pushChunk({ modelId: 'claude', content: ' world', isDone: false });
    pushChunk({ modelId: 'claude', content: '!', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming).toHaveLength(1);
    expect(streaming[0].content).toBe('Hello world!');
  });

  it('accumulation produces exactly one streaming message per model', () => {
    render(<App />);
    triggerSend('hello');

    // Three chunks for claude — should collapse into a single streaming entry.
    pushChunk({ modelId: 'claude', content: 'A', isDone: false });
    pushChunk({ modelId: 'claude', content: 'B', isDone: false });
    pushChunk({ modelId: 'claude', content: 'C', isDone: false });

    expect(getStreamingMessages()).toHaveLength(1);
  });

  it('isStreaming is true while content chunks are in flight', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Thinking...', isDone: false });

    expect(isStreaming()).toBe(true);
  });
});

describe('chunk handler — done chunk finalization', () => {
  it('done chunk removes the message from streamingMessages', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Hello', isDone: false });
    expect(getStreamingMessages()).toHaveLength(1);

    pushChunk({ modelId: 'claude', content: '', isDone: true, tokenUsage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } });

    expect(getStreamingMessages()).toHaveLength(0);
  });

  it('isStreaming flips to false after the done chunk', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Hi', isDone: false });
    expect(isStreaming()).toBe(true);

    pushChunk({ modelId: 'claude', content: '', isDone: true });

    expect(isStreaming()).toBe(false);
  });

  it('done chunk persists the finalized message to the conversation store', () => {
    // handleSend calls updateConversation TWICE per send+done cycle:
    //   call[0] — persists the user message
    //   call[1] — persists the finalized assistant message
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'The answer', isDone: false });
    pushChunk({ modelId: 'claude', content: '', isDone: true, tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } });

    expect(mockUpdateConversation).toHaveBeenCalledTimes(2);
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('The answer');
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.modelId).toBe('claude');
  });

  it('done chunk attaches tokenUsage to the finalized message', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Response', isDone: false });
    pushChunk({
      modelId: 'claude',
      content: '',
      isDone: true,
      tokenUsage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
    });

    // call[1] is the assistant message finalization (call[0] is the user message).
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.tokenUsage).toEqual({ inputTokens: 20, outputTokens: 40, totalTokens: 60 });
  });

  it('done chunk with no preceding content chunks is handled gracefully (no-op)', () => {
    // If no content chunk arrived before isDone, there is nothing in the accumulator.
    // The handler should not throw. updateConversation IS called once for the user message,
    // but NOT a second time for an assistant message (nothing to finalize).
    render(<App />);
    triggerSend('hello');

    // Push done with no prior content chunk for this key.
    expect(() => {
      pushChunk({ modelId: 'claude', content: '', isDone: true });
    }).not.toThrow();

    // Only the user-message persist call — no assistant finalization.
    expect(mockUpdateConversation).toHaveBeenCalledTimes(1);
    const [savedConv] = mockUpdateConversation.mock.calls[0] as [Conversation];
    // The saved conversation should contain only the user message, no assistant message.
    const lastMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(lastMsg.role).toBe('user');
  });
});

describe('chunk handler — error propagation', () => {
  it('error on done chunk is attached to the finalized message', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Partial...', isDone: false });
    pushChunk({
      modelId: 'claude',
      content: '',
      isDone: true,
      error: { code: 'rate_limit', message: 'Too many requests' },
    });

    // call[1] is the assistant finalization; call[0] is the user message persist.
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.error).toEqual({ code: 'rate_limit', message: 'Too many requests' });
  });

  it('error on done chunk still clears the streaming message from state', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Partial', isDone: false });
    pushChunk({
      modelId: 'claude',
      content: '',
      isDone: true,
      error: { code: 'network_error', message: 'Connection lost' },
    });

    expect(getStreamingMessages()).toHaveLength(0);
    expect(isStreaming()).toBe(false);
  });

  it('auth_failure error on done chunk is propagated correctly', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: '', isDone: false });
    pushChunk({
      modelId: 'claude',
      content: '',
      isDone: true,
      error: { code: 'auth_failure', message: 'Invalid API key' },
    });

    // call[1] is the assistant finalization.
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.error?.code).toBe('auth_failure');
    expect(assistantMsg.isStreaming).toBe(false);
  });

  it('done chunk without error does not attach an error field to the message', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Clean response', isDone: false });
    pushChunk({ modelId: 'claude', content: '', isDone: true });

    // call[1] is the assistant finalization.
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.error).toBeUndefined();
  });
});

describe('chunk handler — empty and whitespace content chunks', () => {
  it('empty string content chunk does not corrupt accumulated content', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Hello', isDone: false });
    pushChunk({ modelId: 'claude', content: '', isDone: false }); // empty delta
    pushChunk({ modelId: 'claude', content: ' world', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming[0].content).toBe('Hello world');
  });

  it('whitespace-only content chunk is accumulated as literal content', () => {
    // Whitespace is meaningful in markdown — we must not silently strip it.
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Line 1', isDone: false });
    pushChunk({ modelId: 'claude', content: '\n\n', isDone: false });
    pushChunk({ modelId: 'claude', content: 'Line 2', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming[0].content).toBe('Line 1\n\nLine 2');
  });

  it('an empty first content chunk still creates exactly one streaming message entry', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: '', isDone: false });

    // An empty first chunk still creates exactly one in-progress entry.
    expect(getStreamingMessages()).toHaveLength(1);
  });
});

describe('chunk handler — conversation isolation', () => {
  it('chunks for the active conversation appear in streamingMessages', () => {
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Reply', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming).toHaveLength(1);
  });

  it('done chunk only persists to conversation that initiated the send', () => {
    // Verifies that sendingConversationId closure captures the correct conv.
    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Reply', isDone: false });
    pushChunk({ modelId: 'claude', content: '', isDone: true });

    // call[1] is the assistant finalization — verify it targets the correct conv.
    const [savedConv] = mockUpdateConversation.mock.calls[1] as [Conversation];
    expect(savedConv.id).toBe(BASE_CONV_ID);
  });
});

describe('chunk handler — ghost conversation path', () => {
  it('done chunk for a ghost conversation calls saveGhostConversation, not updateConversation', async () => {
    // Switch the active conversation to a ghost conversation.
    mockActiveConversation = makeTestConversation({ isGhost: true });

    // Re-import mocked saveGhostConversation to inspect calls.
    const { useGhostMode } = await import('@/storage');
    const mockSaveGhostConversation = vi.fn();
    (useGhostMode as Mock).mockReturnValue({
      isGhost: true,
      toggleGhostMode: vi.fn(),
      saveGhostConversation: mockSaveGhostConversation,
      getGhostConversation: vi.fn().mockReturnValue(mockActiveConversation),
    });

    render(<App />);
    triggerSend('ghost message');

    pushChunk({ modelId: 'claude', content: 'Ghost reply', isDone: false });
    pushChunk({ modelId: 'claude', content: '', isDone: true });

    // For ghost conversations, handleSend calls saveGhostConversation TWICE:
    //   call[0] — persists the user message to GhostModeManager
    //   call[1] — persists the finalized assistant message to GhostModeManager
    // updateConversation must never be called for ghost conversations.
    expect(mockUpdateConversation).not.toHaveBeenCalled();
    expect(mockSaveGhostConversation).toHaveBeenCalledTimes(2);

    const [savedConv] = mockSaveGhostConversation.mock.calls[1] as [Conversation];
    const assistantMsg = savedConv.messages[savedConv.messages.length - 1]!;
    expect(assistantMsg.content).toBe('Ghost reply');
    expect(assistantMsg.isStreaming).toBe(false);
  });
});

describe('chunk handler — multi-model parallel streaming', () => {
  it('two models stream independently — each gets its own accumulator entry', () => {
    // Set up a conversation with two active models.
    mockActiveConversation = makeTestConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'accent-gpt', isActive: true },
      ] as ModelConfig[],
    });

    render(<App />);
    triggerSend('hello');

    // Chunks arrive interleaved from two models.
    pushChunk({ modelId: 'claude', content: 'Claude: Hello', isDone: false });
    pushChunk({ modelId: 'gpt-5.5', content: 'GPT: Hi', isDone: false });

    const streaming = getStreamingMessages();
    expect(streaming).toHaveLength(2);

    const claudeMsg = streaming.find((m) => m.modelId === 'claude');
    const gptMsg = streaming.find((m) => m.modelId === 'gpt-5.5');

    expect(claudeMsg?.content).toBe('Claude: Hello');
    expect(gptMsg?.content).toBe('GPT: Hi');
  });

  it('finalizing one model leaves the other still streaming', () => {
    mockActiveConversation = makeTestConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'accent-gpt', isActive: true },
      ] as ModelConfig[],
    });

    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'Claude done', isDone: false });
    pushChunk({ modelId: 'gpt-5.5', content: 'GPT still going', isDone: false });

    // Finalize claude only.
    pushChunk({ modelId: 'claude', content: '', isDone: true });

    // gpt-5.5 is still in flight.
    const streaming = getStreamingMessages();
    expect(streaming).toHaveLength(1);
    expect(streaming[0].modelId).toBe('gpt-5.5');
    expect(isStreaming()).toBe(true);
  });

  it('isStreaming only reaches false when ALL models send isDone', () => {
    mockActiveConversation = makeTestConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'accent-gpt', isActive: true },
      ] as ModelConfig[],
    });

    render(<App />);
    triggerSend('hello');

    pushChunk({ modelId: 'claude', content: 'A', isDone: false });
    pushChunk({ modelId: 'gpt-5.5', content: 'B', isDone: false });

    // Only claude done.
    pushChunk({ modelId: 'claude', content: '', isDone: true });
    expect(isStreaming()).toBe(true); // gpt-5.5 still streaming

    // Now gpt-5.5 done.
    pushChunk({ modelId: 'gpt-5.5', content: '', isDone: true });
    expect(isStreaming()).toBe(false); // both done
  });
});
