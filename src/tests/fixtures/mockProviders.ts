/**
 * Mock ModelProvider factory for integration tests.
 *
 * These mocks sit at the network boundary — they replace the fetch calls
 * that would go to real AI APIs, not the ModelProvider interface itself.
 * This lets us test that sendMessage() correctly wires the routing logic,
 * chunk accumulation, and error propagation without making real HTTP calls.
 *
 * Design principle (from scout.md): mock at the boundary (network, localStorage),
 * not at the agent boundary. We use real ModelProvider instances with a mocked
 * fetch — not stub providers.
 */

import type {
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  TokenUsage,
  ModelId,
  ModelErrorCode,
} from '@/types/index';

// ─── Fake streaming provider ──────────────────────────────────────────────────

/**
 * A fully-functional fake ModelProvider that streams canned text chunks.
 * Useful for testing that sendMessage() accumulates content correctly.
 */
export class FakeStreamingProvider implements ModelProvider {
  readonly config: ModelProviderConfig;
  private readonly _chunks: string[];
  private readonly _tokenUsage: TokenUsage;
  private _callCount = 0;

  constructor(
    modelId: ModelId,
    chunks: string[],
    tokenUsage: TokenUsage = { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
  ) {
    this.config = {
      modelId,
      name: `Fake-${modelId}`,
      color: 'gray',
      credentialKey: 'anthropic', // dummy — never called
    };
    this._chunks = chunks;
    this._tokenUsage = tokenUsage;
  }

  get callCount(): number { return this._callCount; }

  async sendMessage(
    _messages: Message[],
    _systemPrompt: string | undefined,
    onChunk: StreamHandler,
  ): Promise<{ tokenUsage?: TokenUsage }> {
    this._callCount++;

    for (const text of this._chunks) {
      onChunk({
        modelId: this.config.modelId,
        content: text,
        isDone: false,
      });
    }

    onChunk({
      modelId: this.config.modelId,
      content: '',
      isDone: true,
      tokenUsage: this._tokenUsage,
    });

    return { tokenUsage: this._tokenUsage };
  }
}

// ─── Fake error provider ──────────────────────────────────────────────────────

/**
 * A ModelProvider that immediately emits an error chunk.
 * Useful for testing error propagation through sendMessage().
 */
export class FakeErrorProvider implements ModelProvider {
  readonly config: ModelProviderConfig;
  private readonly _errorCode: ModelErrorCode;
  private readonly _errorMessage: string;

  constructor(
    modelId: ModelId,
    errorCode: ModelErrorCode = 'auth_failure',
    errorMessage = 'Test error',
  ) {
    this.config = {
      modelId,
      name: `FakeError-${modelId}`,
      color: 'gray',
      credentialKey: 'anthropic',
    };
    this._errorCode = errorCode;
    this._errorMessage = errorMessage;
  }

  async sendMessage(
    _messages: Message[],
    _systemPrompt: string | undefined,
    onChunk: StreamHandler,
  ): Promise<{ tokenUsage?: TokenUsage }> {
    onChunk({
      modelId: this.config.modelId,
      content: '',
      isDone: true,
      error: {
        code: this._errorCode,
        message: this._errorMessage,
      },
    });
    return {};
  }
}

// ─── Chunk accumulator ────────────────────────────────────────────────────────

/**
 * Collects all StreamChunks emitted by sendMessage() for inspection.
 * Pass `accumulator.onChunk` as the StreamHandler.
 */
export class ChunkAccumulator {
  private readonly _chunks: import('@/types/index').StreamChunk[] = [];

  get onChunk(): StreamHandler {
    return (chunk) => { this._chunks.push(chunk); };
  }

  /** All chunks received, in order. */
  get all(): import('@/types/index').StreamChunk[] {
    return [...this._chunks];
  }

  /** Content-only chunks (isDone === false). */
  get contentChunks(): import('@/types/index').StreamChunk[] {
    return this._chunks.filter((c) => !c.isDone);
  }

  /** Done chunks per model (the terminal event for each provider). */
  get doneChunks(): import('@/types/index').StreamChunk[] {
    return this._chunks.filter((c) => c.isDone);
  }

  /** Accumulated text for a specific model. */
  textFor(modelId: ModelId): string {
    return this._chunks
      .filter((c) => c.modelId === modelId && !c.isDone)
      .map((c) => c.content)
      .join('');
  }

  /** True if any done chunk for the given model carries an error. */
  hasErrorFor(modelId: ModelId): boolean {
    return this._chunks.some((c) => c.modelId === modelId && c.isDone && c.error != null);
  }

  /** The error from the done chunk for the given model, if any. */
  errorFor(modelId: ModelId): import('@/types/index').ModelError | undefined {
    const done = this._chunks.find((c) => c.modelId === modelId && c.isDone);
    return done?.error;
  }

  reset(): void {
    this._chunks.length = 0;
  }
}
