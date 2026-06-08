/**
 * Atlas — sendMessage.ts
 *
 * Top-level SendMessageFn implementation. Supports three routing modes:
 *
 * 1. Parallel broadcast (default, issue #7):
 *    No targetModelId, no chainConfig — all active providers fire simultaneously.
 *    One failure never cancels or delays another provider's stream.
 *    Resolves only when every provider has completed (success or error).
 *
 * 2. Directed reply (issue #14):
 *    targetModelId is set — route to that single model only.
 *    Active-model guard still applies (model must be active in the conversation).
 *
 * 3. Auto-chain (issue #14):
 *    chainConfig is set — execute ChainStep[] in sequence (up to maxPasses times).
 *    When a step's appendToContext is true, the model's full response is appended
 *    to the shared message history before the next step runs, so each subsequent
 *    model sees all prior responses in context.
 *    When appendToContext is false, the step runs against the original context only.
 *
 * Aria calls this function; it is the primary public surface of /src/models.
 */

import type {
  SendMessageOptions,
  StreamHandler,
  StreamChunk,
  Conversation,
  Message,
  ModelId,
  SessionTokenUsage,
} from '@/types';
import { claudeProvider } from './claude';
import { gpt55Provider } from './gpt';

// Registry of all active providers — extend when new providers are added.
const PROVIDERS = [claudeProvider, gpt55Provider];

// Internal provider type alias for clarity
type Provider = typeof PROVIDERS[number];

/**
 * Given a conversation, return providers whose modelId is active in the
 * conversation's model list.
 */
function getActiveProviders(conversation: Conversation): Provider[] {
  const activeIds = new Set(
    conversation.models.filter((m) => m.isActive).map((m) => m.modelId)
  );
  return PROVIDERS.filter((p) => activeIds.has(p.config.modelId));
}

/**
 * Runs a single provider's sendMessage call in isolation.
 *
 * If the provider throws at any point (unexpected exception beyond its own
 * internal error handling), this function catches the error and emits a
 * synthetic isDone=true StreamChunk with an error payload so the UI always
 * receives a terminal event for every model, regardless of failure mode.
 *
 * Never rejects — always resolves — so Promise.allSettled (and callers) are
 * guaranteed to see every provider reach completion.
 */
async function runProviderIsolated(
  provider: Provider,
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler
): Promise<void> {
  try {
    await provider.sendMessage(messages, systemPrompt, onChunk);
  } catch (err) {
    // Unexpected throw from a provider (shouldn't happen given the providers'
    // own try/catch, but we guard here for robustness).
    const errorChunk: StreamChunk = {
      modelId: provider.config.modelId as ModelId,
      content: '',
      isDone: true,
      error: {
        code: 'unknown',
        message:
          err instanceof Error
            ? err.message
            : `Unexpected error from ${provider.config.name}`,
      },
    };
    onChunk(errorChunk);
  }
}

/**
 * Wrap onChunk to accumulate streamed text for a specific model.
 * The original onChunk still fires for every chunk (UI keeps streaming).
 * getText() returns the full accumulated response once the provider is done.
 */
function collectingChunkHandler(
  modelId: ModelId,
  onChunk: StreamHandler
): { handler: StreamHandler; getText: () => string } {
  let accumulated = '';
  const handler: StreamHandler = (chunk) => {
    if (chunk.modelId === modelId && !chunk.isDone && chunk.content) {
      accumulated += chunk.content;
    }
    onChunk(chunk);
  };
  return { handler, getText: () => accumulated };
}

// ─── Routing modes ────────────────────────────────────────────────────────────

/**
 * Mode 1 — Parallel broadcast.
 * Fans out to all active providers simultaneously.
 * Each provider resolves its own systemPrompt from conversation.models,
 * falling back to the shared systemPrompt parameter if none is set on the model.
 */
async function runParallel(
  providers: Provider[],
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler,
  conversation?: Conversation
): Promise<void> {
  // Fire all providers in parallel. Promise.allSettled ensures every provider
  // runs to completion regardless of whether siblings succeed or fail.
  await Promise.allSettled(
    providers.map((provider) => {
      const modelConfig = conversation?.models.find(
        (m) => m.modelId === provider.config.modelId
      );
      const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;
      return runProviderIsolated(provider, messages, resolvedSystemPrompt, onChunk);
    })
  );
}

/**
 * Mode 2 — Directed reply.
 * Routes to a single model (targetModelId). The model must be active.
 * Emits a synthetic error chunk if the target is not active or not found.
 * Resolves per-model systemPrompt from conversation.models, falling back to
 * the shared systemPrompt parameter.
 */
async function runDirected(
  targetModelId: ModelId,
  activeProviders: Provider[],
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler,
  conversation?: Conversation
): Promise<void> {
  const target = activeProviders.find((p) => p.config.modelId === targetModelId);

  if (!target) {
    const errorChunk: StreamChunk = {
      modelId: targetModelId,
      content: '',
      isDone: true,
      error: {
        code: 'unknown',
        message: `Model "${targetModelId}" is not active in this conversation.`,
      },
    };
    onChunk(errorChunk);
    return;
  }

  const modelConfig = conversation?.models.find(
    (m) => m.modelId === target.config.modelId
  );
  const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;
  await runProviderIsolated(target, messages, resolvedSystemPrompt, onChunk);
}

/**
 * Mode 3 — Auto-chain.
 * Executes ChainStep[] in order, up to chainConfig.maxPasses times.
 * When a step has appendToContext=true, the model's response text is appended
 * to the shared context before the next step executes.
 *
 * Active-model guard: steps referencing inactive models emit a synthetic error
 * chunk and continue the chain (they do not append to context).
 */
async function runAutoChain(
  options: SendMessageOptions & { conversation?: Conversation; systemPrompt?: string },
  initialMessages: Message[],
  onChunk: StreamHandler
): Promise<void> {
  const { chainConfig, conversation, systemPrompt } = options;
  if (!chainConfig) return;

  const { steps, maxPasses } = chainConfig;
  if (steps.length === 0 || maxPasses < 1) return;

  const activeProviders = conversation ? getActiveProviders(conversation) : PROVIDERS;

  // Shared context that grows as appendToContext steps complete.
  let sharedMessages: Message[] = [...initialMessages];

  for (let pass = 0; pass < maxPasses; pass++) {
    for (const step of steps) {
      const provider = activeProviders.find((p) => p.config.modelId === step.modelId);

      if (!provider) {
        // Model inactive — emit error chunk and skip (do not halt the chain).
        const errorChunk: StreamChunk = {
          modelId: step.modelId,
          content: '',
          isDone: true,
          error: {
            code: 'unknown',
            message: `Chain step ${step.stepIndex}: model "${step.modelId}" is not active.`,
          },
        };
        onChunk(errorChunk);
        continue;
      }

      // Resolve per-model systemPrompt, falling back to shared systemPrompt.
      const modelConfig = conversation?.models.find(
        (m) => m.modelId === step.modelId
      );
      const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;

      if (step.appendToContext) {
        // Wrap onChunk to accumulate the full response text for this step.
        const { handler, getText } = collectingChunkHandler(step.modelId, onChunk);
        await runProviderIsolated(provider, sharedMessages, resolvedSystemPrompt, handler);

        // Append the model's response as an assistant message for subsequent steps.
        const responseText = getText();
        if (responseText) {
          sharedMessages = [
            ...sharedMessages,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: responseText,
              modelId: step.modelId,
              timestamp: Date.now(),
            },
          ];
        }
      } else {
        // Run in isolation against current context — do not extend shared context.
        await runProviderIsolated(provider, sharedMessages, resolvedSystemPrompt, onChunk);
      }
    }
  }
}

// ─── SendMessageFn ────────────────────────────────────────────────────────────

/**
 * SendMessageFn — routes to the appropriate mode based on options.
 *
 * - chainConfig set → auto-chain mode (sequential, context-feeding)
 * - targetModelId set → directed mode (single model)
 * - neither set → parallel broadcast mode (all active models)
 *
 * Each provider streams incremental chunks back via onChunk independently.
 * Resolves when the chosen mode has completed all provider calls.
 *
 * Usage by Aria:
 *   import { sendMessage } from '@/models';
 *   // Parallel:
 *   await sendMessage({ conversationId, content }, onChunk);
 *   // Directed:
 *   await sendMessage({ conversationId, content, targetModelId: 'claude' }, onChunk);
 *   // Auto-chain:
 *   await sendMessage({ conversationId, content, chainConfig: { steps, maxPasses: 1 } }, onChunk);
 *
 * Note: The extended signature accepts an optional conversation parameter so callers
 * can scope active providers to a specific conversation. If omitted, all
 * registered providers are used.
 */
export async function sendMessage(
  options: SendMessageOptions & { conversation?: Conversation; systemPrompt?: string },
  onChunk: StreamHandler
): Promise<void> {
  const { conversation, systemPrompt, content, targetModelId, chainConfig } = options;

  const activeProviders = conversation ? getActiveProviders(conversation) : PROVIDERS;

  // Build message history from the conversation, if provided.
  // The current user message is appended at the end.
  const history = conversation?.messages ?? [];
  const messages: Message[] = [
    ...history,
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: Date.now(),
    },
  ];

  // ── Mode selection ──────────────────────────────────────────────────────────

  // Auto-chain takes precedence — if chainConfig is supplied, sequence the steps.
  if (chainConfig) {
    await runAutoChain(
      { ...options, conversation, systemPrompt },
      messages,
      onChunk
    );
    return;
  }

  // Directed reply — route to a single model.
  if (targetModelId) {
    await runDirected(targetModelId, activeProviders, messages, systemPrompt, onChunk, conversation);
    return;
  }

  // Default — parallel broadcast.
  if (activeProviders.length === 0) return;
  await runParallel(activeProviders, messages, systemPrompt, onChunk, conversation);
}

/**
 * Utility: aggregate token usage per model across all messages in a conversation.
 *
 * Returns one SessionTokenUsage entry per model that has at least one message
 * with token data. The order mirrors the order models first appear in the
 * message history.
 *
 * Exported here (not from /src/ui) per the cross-agent exception rule in CLAUDE.md:
 * "Pure utility functions exported from /src/models/index.ts may be imported by Aria."
 *
 * Aria may also call ConversationStore.getSessionTokenUsage() which delegates
 * to this function via Vault's implementation.
 */
export function getSessionTokenUsage(conversation: Conversation): SessionTokenUsage[] {
  // Accumulate per-model totals preserving insertion order.
  const byModel = new Map<ModelId, SessionTokenUsage>();

  for (const msg of conversation.messages) {
    if (!msg.tokenUsage || !msg.modelId) continue;

    const existing = byModel.get(msg.modelId);
    if (existing) {
      existing.inputTokens += msg.tokenUsage.inputTokens;
      existing.outputTokens += msg.tokenUsage.outputTokens;
      existing.totalTokens += msg.tokenUsage.totalTokens;
    } else {
      byModel.set(msg.modelId, {
        modelId: msg.modelId,
        inputTokens: msg.tokenUsage.inputTokens,
        outputTokens: msg.tokenUsage.outputTokens,
        totalTokens: msg.tokenUsage.totalTokens,
      });
    }
  }

  return Array.from(byModel.values());
}
