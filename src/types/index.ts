/**
 * /src/types/index.ts — Cross-agent interface contracts
 *
 * This is the most critical file in the project. It is the sole contract
 * between all agents. Rules:
 *   - No agent modifies this file unilaterally
 *   - Changes require a PR reviewed by all active agents
 *   - No implementation code — types and interfaces only
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type ModelId = 'claude' | 'gpt-5.5';

export type InteractionMode = 'parallel' | 'manual' | 'auto-chain';

export type MessageRole = 'user' | 'assistant';

/**
 * Display metadata for a single interaction mode. Aria uses a typed registry
 * of these to render the mode-switcher control and tooltips (issue #12).
 */
export interface InteractionModeConfig {
  mode: InteractionMode;
  /** Short label shown in the switcher button. */
  label: string;
  /** One-sentence description shown in the tooltip. */
  description: string;
}

/**
 * A single step in an auto-chain sequence.
 * Defines which model speaks at this position and what role it plays.
 */
export interface ChainStep {
  /** Index of this step in the chain (0-based). */
  stepIndex: number;
  modelId: ModelId;
  /**
   * When true, this model's response is appended to the shared context before
   * the next step runs. When false the step runs in isolation.
   */
  appendToContext: boolean;
}

/**
 * Configuration for an auto-chain run. Atlas uses this to sequence
 * model calls; Aria may read it to render chain progress (issue #14).
 */
export interface AutoChainConfig {
  /** Ordered steps to execute. */
  steps: ChainStep[];
  /**
   * Maximum number of times the full step sequence may repeat before
   * the chain terminates automatically. 1 = single pass.
   */
  maxPasses: number;
}

export type CredentialKey = 'anthropic' | 'openai';

export type ExportFormat = 'markdown' | 'html';

// ─── Token usage ──────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Running session totals for a single model. Aria reads this to display
 * per-model usage in the UI (issue #15 / #16).
 */
export interface SessionTokenUsage {
  modelId: ModelId;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  /** Present on assistant messages. */
  modelId?: ModelId;
  timestamp: number;
  /** Populated when isDone is true on the final StreamChunk. */
  tokenUsage?: TokenUsage;
  /** Phase 2 — directed replies. */
  targetModelId?: ModelId;
  /** True while the message is still streaming. */
  isStreaming?: boolean;
}

// ─── Model config ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  modelId: ModelId;
  /** Display name shown in UI. */
  name: string;
  /** Tailwind color token, e.g. "violet" or "sky". */
  color: string;
  /** Phase 2 — per-model system prompt. */
  systemPrompt?: string;
  isActive: boolean;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  /** Auto-generated from the first user message. */
  title?: string;
  messages: Message[];
  models: ModelConfig[];
  interactionMode: InteractionMode;
  /** Ghost mode: nothing is ever written to storage. */
  isGhost: boolean;
  createdAt: number;
  updatedAt: number;
  /** Set when the conversation is archived. */
  archivedAt?: number;
  /** Phase 3 — group/folder assignment. */
  groupId?: string;
}

// ─── ConversationStore — consumed by Aria ────────────────────────────────────

/**
 * Read-only view of conversation state exposed to the UI layer.
 * Vault owns the implementation; Aria consumes it (e.g. via React context).
 */
export interface ConversationStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  getConversation(id: string): Conversation | undefined;
  getActiveConversation(): Conversation | undefined;
  /**
   * Returns running session token totals for every active model in the given
   * conversation. Aria uses this for the per-model usage display (issue #15 / #16).
   * Atlas also exports a standalone getSessionTokenUsage() utility from
   * @/models for convenience (documented exception to the boundary rule).
   */
  getSessionTokenUsage(conversationId: string): SessionTokenUsage[];
}

// ─── Streaming — sendMessage plumbing ─────────────────────────────────────────

export interface StreamChunk {
  modelId: ModelId;
  /** Incremental text delta. */
  content: string;
  isDone: boolean;
  /** Present only when isDone is true. */
  tokenUsage?: TokenUsage;
  error?: ModelError;
}

export type StreamHandler = (chunk: StreamChunk) => void;

// ─── sendMessage — Atlas exposes, Aria calls ──────────────────────────────────

export interface SendMessageOptions {
  conversationId: string;
  content: string;
  /** Phase 2 — omit to broadcast to all active models. */
  targetModelId?: ModelId;
  /** Phase 2 — omit for parallel/manual modes. Atlas uses this to sequence auto-chain calls. */
  chainConfig?: AutoChainConfig;
}

/**
 * Top-level send function. Fans out to all active ModelProviders in parallel.
 * Streams each model's response via onChunk. Resolves when all models are done.
 */
export type SendMessageFn = (
  options: SendMessageOptions,
  onChunk: StreamHandler
) => Promise<void>;

// ─── ModelProvider — Atlas implements per model ───────────────────────────────

export type ModelErrorCode =
  | 'auth_failure'
  | 'rate_limit'
  | 'network_error'
  | 'context_length_exceeded'
  | 'unknown';

export interface ModelError {
  code: ModelErrorCode;
  message: string;
}

export interface ModelProviderConfig {
  modelId: ModelId;
  name: string;
  color: string;
  /** The CredentialKey used to fetch the API key from Gate. */
  credentialKey: CredentialKey;
}

export interface ModelProvider {
  readonly config: ModelProviderConfig;
  /**
   * Sends messages to the underlying model and streams the response.
   * Resolves with token usage once the stream is complete.
   * Rejects if a non-recoverable error occurs (auth, network, etc.).
   */
  sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler
  ): Promise<{ tokenUsage?: TokenUsage }>;
}

// ─── StorageProvider — Vault implements ───────────────────────────────────────

export interface StorageProvider {
  saveConversation(conversation: Conversation): Promise<void>;
  loadConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<Conversation[]>;
  deleteConversation(id: string): Promise<void>;
  archiveConversation(id: string): Promise<void>;
  /** Phase 3 — triggers browser download. */
  exportConversation(id: string, format: ExportFormat): Promise<void>;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export type ThemeId = 'slate' | 'linen' | 'midnight' | 'ash' | 'ember' | 'chalk' | 'outrun';

/** Full token schema for a Roundtable theme. All fields required. */
export interface CustomThemeJSON {
  name: string;
  mode: 'dark' | 'light';
  surfaces: {
    background: string;
    card: string;
    sidebar: string;
    input: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  borders: {
    default: string;
    subtle: string;
    strong: string;
  };
  accents: {
    'model-claude': string;
    'model-gpt': string;
    'model-gemini': string;
    'model-other': string;
  };
  interactive: {
    hover: string;
    active: string;
    focusRing: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  spacing: {
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '6': string;
    '8': string;
    '12': string;
    '16': string;
  };
  shadow: {
    none: 'none';
    sm: string;
    md: string;
    lg: string;
  };
  timing: {
    instant: string;
    fast: string;
    medium: string;
    slow: string;
  };
}

export interface ThemePreferences {
  activeThemeId: ThemeId;
  customTheme?: CustomThemeJSON;
}

// ─── Credentials — Gate implements ───────────────────────────────────────────

/**
 * Retrieve a stored API key. Returns undefined if not set.
 */
export type GetCredentialsFn = (key: CredentialKey) => string | undefined;

/**
 * Persist an API key to localStorage. Never transmit, log, or export keys.
 */
export type SaveCredentialsFn = (key: CredentialKey, value: string) => void;

/**
 * Remove a stored API key.
 */
export type ClearCredentialsFn = (key: CredentialKey) => void;

// ─── User preferences — Gate implements, Aria consumes ───────────────────────

/**
 * Controls when per-message token counts are visible in the chat UI.
 *
 * - 'always' — token counts shown unconditionally on all completed model bubbles
 * - 'active' — hover reveals on desktop, tap reveals on mobile (default;
 *              matches the hover-reveal behavior shipped in #16)
 * - 'never'  — token count element removed from DOM entirely (not hidden with CSS)
 *
 * Gate reads and writes this value; Aria reads it to determine render behavior.
 */
export type TokenCountVisibility = 'always' | 'active' | 'never';

/**
 * Persistent user preferences. Gate owns storage (localStorage); Aria reads
 * these values to drive conditional rendering and display behavior.
 *
 * Default values when no preference is stored:
 *   tokenCountVisibility: 'active'
 */
export interface UserPreferences {
  tokenCountVisibility: TokenCountVisibility;
}
