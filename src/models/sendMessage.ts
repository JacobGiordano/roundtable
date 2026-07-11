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
  Conversation,
  Message,
  ModelId,
  SessionTokenUsage,
} from '@/types';
import { getProviderRoster, getCredentials, getPricingTable } from '@/auth';
import { PROVIDERS, MODEL_REGISTRY } from './registry';
import { createCustomProvider } from './generic';
import { emitErrorChunk, buildModelError } from './openai-sse';
import { buildAttributedMessages, buildAttributionSystemPrompt } from './attribution';

// Internal provider type alias for clarity
type Provider = typeof PROVIDERS[number];

/**
 * Narrow internal interface that extends ModelProvider with the optional
 * selectedVersionId, signal, and requestImageGeneration parameters. All concrete
 * provider classes accept these extra optional args — their implementations remain
 * compatible with ModelProvider (extra optional params are additive). sendMessage.ts
 * casts to this type at the call site so the version, abort signal, and image-gen
 * opt-in can be threaded through without modifying the ModelProvider interface
 * contract in /src/types/index.ts.
 *
 * The signal originates from SendMessageOptions.signal (set by Aria via an
 * AbortController) and flows down through runProviderIsolated to each provider's
 * fetch call. When the signal fires, fetch rejects and the provider resolves
 * cleanly (no error chunk) with whatever partial token usage was accumulated.
 *
 * requestImageGeneration carries the per-model opt-in from ModelConfig.imageGenerationEnabled
 * (stored by Aria when the user toggles image gen). Only providers that support image
 * generation (generic.ts, gemini.ts) read this parameter — others ignore it safely
 * because it is optional and additive.
 *
 * This is entirely internal to /src/models — no other agent sees this type.
 */
interface VersionAwareProvider extends Provider {
  sendMessage(
    messages: Parameters<Provider['sendMessage']>[0],
    systemPrompt: Parameters<Provider['sendMessage']>[1],
    onChunk: Parameters<Provider['sendMessage']>[2],
    selectedVersionId?: string,
    signal?: AbortSignal,
    requestImageGeneration?: boolean
  ): ReturnType<Provider['sendMessage']>;
}

/**
 * Result of resolving active providers for a conversation.
 *
 * `providers` — successfully resolved ModelProvider instances, in the order
 *   the active modelIds appear in conversation.models.
 * `missing` — active modelIds that had no matching entry in the ProviderRoster.
 *   Each of these must receive an auth_failure StreamChunk before dispatch.
 * `visionCapable` — modelIds whose ProviderConfig has `capabilities.vision === true`.
 *   sendMessage.ts strips attachments from messages before dispatching to any
 *   provider NOT in this set (Phase 5, issue #285).
 * `imageGenEnabled` — modelIds where ModelConfig.imageGenerationEnabled === true.
 *   sendMessage.ts passes requestImageGeneration: true to providers in this set.
 *   Providers NOT in this set receive requestImageGeneration: false (or undefined),
 *   which suppresses image output regardless of provider capability. Defaults to an
 *   empty set when no conversation is provided (legacy/test path — safe default).
 */
interface ResolvedProviders {
  providers: Provider[];
  missing: ModelId[];
  visionCapable: Set<ModelId>;
  imageGenEnabled: Set<ModelId>;
}

/**
 * Given a conversation, resolve the active providers from the ProviderRoster.
 *
 * Built-in providers: resolved from the static PROVIDERS array (kind: 'builtin'
 * roster entries are authoritative for visibility/version, but the PROVIDERS
 * array is always the fallback — built-ins are always available whether or not
 * they have an explicit roster entry). This preserves backward compatibility
 * with conversations that predate roster configuration.
 *
 * Custom providers (kind: 'custom'): require a roster entry. Instantiated
 * on-the-fly via createCustomProvider(). Each call produces a fresh instance;
 * no shared state exists between calls. This is intentional: custom providers
 * are stateless wrappers around a config+credential fetch.
 *
 * Active modelIds with no matching roster entry AND no built-in implementation
 * are returned in `missing`. The caller is responsible for emitting an
 * auth_failure StreamChunk for each missing ID and skipping it from dispatch.
 *
 * The static PROVIDERS array is never modified.
 */
function getActiveProviders(conversation: Conversation): ResolvedProviders {
  const activeModels = conversation.models.filter((m) => m.isActive);
  const activeIds = activeModels.map((m) => m.modelId);

  if (activeIds.length === 0) {
    return { providers: [], missing: [], visionCapable: new Set(), imageGenEnabled: new Set() };
  }

  const roster = getProviderRoster();
  const providers: Provider[] = [];
  const missing: ModelId[] = [];
  const visionCapable = new Set<ModelId>();
  // Issue #379 — always-on for capable models. Built from roster capabilities so
  // any active provider declaring imageGeneration: true always receives image
  // output modalities. No per-turn user toggle — the model/version selection is
  // the opt-in signal.
  const imageGenEnabled = new Set<ModelId>();

  for (const modelId of activeIds) {
    // Check the static PROVIDERS array first — built-ins are always resolvable
    // regardless of roster state (backward compatible with pre-roster conversations).
    const builtIn = PROVIDERS.find((p) => p.config.modelId === modelId);
    if (builtIn) {
      // Check roster for this built-in's declared capabilities (Phase 5 #285).
      // Gate populates BuiltInProviderConfig.capabilities for all six built-ins
      // on roster init/migration. When absent (pre-migration records), the
      // conservative default applies: vision: false.
      const rosterEntry = roster.find(
        (e) => e.kind === 'builtin' && e.modelId === modelId
      );
      if (rosterEntry?.capabilities?.vision === true) {
        visionCapable.add(modelId);
      }
      if (rosterEntry?.capabilities?.imageGeneration === true) {
        imageGenEnabled.add(modelId);
      }
      providers.push(builtIn);
      continue;
    }

    // Not a built-in — look for a custom roster entry.
    const customEntry = roster.find(
      (e) => e.kind === 'custom' && e.id === modelId
    );

    if (customEntry && customEntry.kind === 'custom') {
      // Custom provider — check capabilities before instantiating.
      if (customEntry.capabilities?.vision === true) {
        visionCapable.add(modelId);
      }
      if (customEntry.capabilities?.imageGeneration === true) {
        imageGenEnabled.add(modelId);
      }
      // Instantiate from config. Pass getCredentials and getPricingTable from
      // @/auth here rather than letting generic.ts import them directly, keeping
      // the @/models boundary clean. getPricingTable enables cost computation
      // for custom providers at stream completion (issue #352).
      providers.push(createCustomProvider(customEntry, getCredentials, getPricingTable));
    } else {
      // Neither a built-in nor a roster-backed custom provider.
      // Caller will emit auth_failure and skip.
      missing.push(modelId);
    }
  }

  return { providers, missing, visionCapable, imageGenEnabled };
}

/**
 * Emit an auth_failure StreamChunk for each modelId that had no roster entry.
 * This is called at every dispatch site before handing off to the routing mode.
 */
function emitMissingProviderErrors(missing: ModelId[], onChunk: StreamHandler): void {
  for (const modelId of missing) {
    const error = buildModelError('auth_failure', `Provider not found in roster: ${modelId}`);
    emitErrorChunk(modelId, error, onChunk);
  }
}

/**
 * Runs a single provider's sendMessage call in isolation.
 *
 * If the provider throws at any point (unexpected exception beyond its own
 * internal error handling), this function catches the error and emits a
 * synthetic isDone=true StreamChunk with an error payload so the UI always
 * receives a terminal event for every model, regardless of failure mode.
 *
 * AbortError handling: when the caller-supplied AbortSignal fires, the
 * provider's fetch/stream throws a DOMException with name 'AbortError'. This
 * is NOT an unexpected failure — it is a user-initiated stop. runProviderIsolated
 * catches it here (after the provider's own catch re-throws it or before, if the
 * provider itself doesn't handle it) and silently resolves without emitting any
 * additional error chunk. The provider is responsible for emitting a clean done
 * chunk with partial token usage before re-throwing, or this wrapper simply
 * swallows the AbortError if it escapes.
 *
 * Never rejects — always resolves — so Promise.allSettled (and callers) are
 * guaranteed to see every provider reach completion.
 *
 * selectedVersionId and signal are threaded through to the provider via
 * VersionAwareProvider. If undefined, each provider falls back to its own
 * hardcoded defaults.
 */
async function runProviderIsolated(
  provider: Provider,
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler,
  selectedVersionId?: string,
  signal?: AbortSignal,
  requestImageGeneration?: boolean
): Promise<void> {
  try {
    await (provider as VersionAwareProvider).sendMessage(messages, systemPrompt, onChunk, selectedVersionId, signal, requestImageGeneration);
  } catch (err) {
    // AbortError — user initiated stop. The provider should have emitted a
    // clean done chunk already. If it didn't (e.g., abort fired before any
    // chunk), we silently resolve rather than emitting a spurious error.
    // This is not a failure condition — it is the expected abort path.
    //
    // Duck-type the name check instead of using `instanceof Error` because
    // jsdom's DOMException does not extend Error — `err instanceof Error`
    // evaluates to false in vitest/jsdom even for a valid AbortError. The
    // duck-type check works in both browsers (DOMException extends Error) and
    // jsdom (DOMException does not extend Error).
    if ((err as { name?: string })?.name === 'AbortError') {
      return;
    }
    // Unexpected throw from a provider (shouldn't happen given the providers'
    // own try/catch, but we guard here for robustness).
    const modelId = provider.config.modelId as ModelId;
    const error = buildModelError(
      'unknown',
      err instanceof Error
        ? err.message
        : `Unexpected error from ${provider.config.name}`,
    );
    emitErrorChunk(modelId, error, onChunk);
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

// ─── Attachment filtering (Phase 5, issue #285) ───────────────────────────────

/**
 * Returns a copy of the messages array with `attachments` removed from every
 * message. Used to scrub image data before dispatching to providers whose
 * `ProviderConfig.capabilities.vision` is `false` or absent.
 *
 * Passing image content to a non-vision endpoint produces an API error (Anthropic
 * 400, OpenAI 400, Gemini 400). This helper is the single enforcement point so
 * provider formatters never need to check capabilities themselves.
 *
 * Fast path: if the message has no `attachments` (the common case for all
 * non-image messages), the original object is returned unchanged — no allocation.
 */
function stripAttachments(messages: Message[]): Message[] {
  return messages.map((msg) => {
    if (!msg.attachments?.length) return msg;
    const stripped: Message = { ...msg };
    delete stripped.attachments;
    return stripped;
  });
}

// ─── Chain step ordering ──────────────────────────────────────────────────────

/**
 * Returns a new array containing the same elements in a random order.
 * Uses Fisher-Yates (Knuth) shuffle, seeded by Math.random() at call time.
 * Called once per pass in runAutoChain so each pass produces an independent
 * ordering — giving both across-chain and within-chain variation.
 *
 * The original array is never mutated; a shallow copy is shuffled in place
 * and returned.
 *
 * Issue #313 — auto-chain non-linear response ordering.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Routing modes ────────────────────────────────────────────────────────────

/**
 * Mode 1 — Parallel broadcast.
 * Fans out to all active providers simultaneously.
 * Each provider resolves its own systemPrompt from conversation.models,
 * falling back to the shared systemPrompt parameter if none is set on the model.
 * The signal (if provided) is forwarded to every provider so all streams stop
 * when the user triggers abort.
 *
 * visionCapable — set of modelIds whose roster config has capabilities.vision true.
 * Providers not in this set receive messages with attachments stripped (Phase 5 #285).
 *
 * imageGenEnabled — set of modelIds where ModelConfig.imageGenerationEnabled === true.
 * Each provider receives requestImageGeneration: true only when it appears in this set
 * (issue #379). Empty set by default — safe when no conversation is provided.
 */
async function runParallel(
  providers: Provider[],
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler,
  conversation?: Conversation,
  signal?: AbortSignal,
  visionCapable?: Set<ModelId>,
  imageGenEnabled?: Set<ModelId>
): Promise<void> {
  // Emit dispatch-time priming chunks so Aria can render placeholder bubbles
  // immediately when the user sends a message, before the first real content
  // byte arrives from any provider. Issue #349.
  //
  // Note: emitErrorChunk (called on the error path inside each provider) also
  // emits a priming non-done chunk. A provider that fails immediately will
  // therefore produce two consecutive non-done chunks (content: ''), which is
  // harmless — useStreamingMessages creates the accumulator entry on the first
  // and no-ops on the second.
  for (const provider of providers) {
    onChunk({ modelId: provider.config.modelId, content: '', isDone: false });
  }

  // Fire all providers in parallel. Promise.allSettled ensures every provider
  // runs to completion regardless of whether siblings succeed or fail.
  await Promise.allSettled(
    providers.map((provider) => {
      const modelConfig = conversation?.models.find(
        (m) => m.modelId === provider.config.modelId
      );
      const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;
      const selectedVersionId = modelConfig?.selectedVersionId;

      // Option B: build a per-provider message array that attributes other
      // models' assistant messages as user-role messages with "[Name responded: ...]"
      // framing. Stored messages are never mutated — this is wire-format only.
      const attributedMessages = conversation
        ? buildAttributedMessages(messages, provider.config.modelId, conversation.models)
        : messages;

      // Option C: prepend multi-model framing to the effective system prompt so
      // the provider knows its own name and can interpret attribution markers.
      // Only applied when conversation is available and modelConfig is resolved.
      const otherActiveModels = conversation
        ? conversation.models.filter(
            (m) => m.isActive && m.modelId !== provider.config.modelId
          )
        : [];
      const effectiveSystemPrompt =
        modelConfig && conversation
          ? buildAttributionSystemPrompt(resolvedSystemPrompt, modelConfig, otherActiveModels)
          : resolvedSystemPrompt;

      // Phase 5 (#285): strip attachments for providers that do not support vision.
      // Passing image parts to a non-vision endpoint produces a 400 error.
      const isVision = visionCapable?.has(provider.config.modelId) ?? false;
      const providerMessages = isVision ? attributedMessages : stripAttachments(attributedMessages);

      // Issue #379: pass requestImageGeneration only when the user has explicitly
      // enabled image gen for this model via the per-model toggle in Aria.
      const requestImageGeneration = imageGenEnabled?.has(provider.config.modelId) ?? false;

      return runProviderIsolated(provider, providerMessages, effectiveSystemPrompt, onChunk, selectedVersionId, signal, requestImageGeneration);
    })
  );
}

/**
 * Mode 2 — Directed reply.
 * Routes to a single model (targetModelId). The model must be active.
 * Emits a synthetic error chunk if the target is not active or not found.
 * Resolves per-model systemPrompt from conversation.models, falling back to
 * the shared systemPrompt parameter.
 * The signal (if provided) is forwarded to the target provider.
 *
 * visionCapable — set of modelIds whose roster config has capabilities.vision true.
 * The target provider receives messages with attachments stripped if not vision-capable
 * (Phase 5, issue #285).
 *
 * imageGenEnabled — set of modelIds where ModelConfig.imageGenerationEnabled === true.
 * The target provider receives requestImageGeneration: true only when present in this
 * set (issue #379).
 */
async function runDirected(
  targetModelId: ModelId,
  activeProviders: Provider[],
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: StreamHandler,
  conversation?: Conversation,
  signal?: AbortSignal,
  visionCapable?: Set<ModelId>,
  imageGenEnabled?: Set<ModelId>
): Promise<void> {
  const target = activeProviders.find((p) => p.config.modelId === targetModelId);

  if (!target) {
    const error = buildModelError('unknown', `Model "${targetModelId}" is not active in this conversation.`);
    emitErrorChunk(targetModelId, error, onChunk);
    return;
  }

  const modelConfig = conversation?.models.find(
    (m) => m.modelId === target.config.modelId
  );
  const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;
  const selectedVersionId = modelConfig?.selectedVersionId;

  // Option B: attribute other models' messages for the directed target.
  const attributedMessages = conversation
    ? buildAttributedMessages(messages, target.config.modelId, conversation.models)
    : messages;

  // Option C: prepend multi-model framing to the effective system prompt.
  const otherActiveModels = conversation
    ? conversation.models.filter(
        (m) => m.isActive && m.modelId !== target.config.modelId
      )
    : [];
  const effectiveSystemPrompt =
    modelConfig && conversation
      ? buildAttributionSystemPrompt(resolvedSystemPrompt, modelConfig, otherActiveModels)
      : resolvedSystemPrompt;

  // Phase 5 (#285): strip attachments for providers that do not support vision.
  const isVision = visionCapable?.has(target.config.modelId) ?? false;
  const providerMessages = isVision ? attributedMessages : stripAttachments(attributedMessages);

  // Issue #379: pass requestImageGeneration only when the user has explicitly
  // enabled image gen for this model via the per-model toggle in Aria.
  const requestImageGeneration = imageGenEnabled?.has(target.config.modelId) ?? false;

  // Emit dispatch-time priming chunk so Aria can render a placeholder bubble
  // immediately when the user sends a directed message. Issue #349.
  onChunk({ modelId: target.config.modelId, content: '', isDone: false });

  await runProviderIsolated(target, providerMessages, effectiveSystemPrompt, onChunk, selectedVersionId, signal, requestImageGeneration);
}

/**
 * Mode 3 — Auto-chain.
 * Executes ChainStep[] in order, up to chainConfig.maxPasses times.
 * When a step has appendToContext=true, the model's response text is appended
 * to the shared context before the next step executes.
 *
 * Active-model guard: steps referencing inactive or roster-missing models emit a
 * synthetic error chunk and continue the chain (they do not append to context).
 *
 * Abort handling: before dispatching each step, we check signal.aborted. If the
 * signal has fired, the chain exits silently — no error chunk, no further steps.
 */
async function runAutoChain(
  options: SendMessageOptions & { conversation?: Conversation; systemPrompt?: string },
  initialMessages: Message[],
  onChunk: StreamHandler
): Promise<void> {
  const { chainConfig, conversation, systemPrompt, signal } = options;
  if (!chainConfig) return;

  const { steps, maxPasses } = chainConfig;
  if (steps.length === 0 || maxPasses < 1) return;

  // Resolve providers from the roster when a conversation is available.
  // Missing entries get error chunks emitted inline per-step (see below).
  let activeProviders: Provider[];
  let missingIds: ModelId[];
  let visionCapable = new Set<ModelId>();
  let imageGenEnabled = new Set<ModelId>();
  if (conversation) {
    const resolved = getActiveProviders(conversation);
    activeProviders = resolved.providers;
    missingIds = resolved.missing;
    visionCapable = resolved.visionCapable;
    imageGenEnabled = resolved.imageGenEnabled;
    // Emit missing-provider errors upfront (before any step runs).
    emitMissingProviderErrors(missingIds, onChunk);
  } else {
    activeProviders = PROVIDERS;
    missingIds = [];
  }

  // Shared context that grows as appendToContext steps complete.
  let sharedMessages: Message[] = [...initialMessages];

  for (let pass = 0; pass < maxPasses; pass++) {
    // Shuffle the step list independently on each pass (issue #313).
    // Each pass produces its own random ordering — chains never follow the
    // deterministic roster order, and multi-pass chains produce non-repeating
    // sequences (A → C → B → A, not round-robin). shuffleArray always returns
    // all steps: no model is silenced, only the execution order varies.
    const passSteps = shuffleArray(steps);
    for (const step of passSteps) {
      // If the caller aborted, stop dispatching further chain steps silently.
      if (signal?.aborted) return;

      // Skip steps whose modelId had no roster entry — error was emitted above.
      if (missingIds.includes(step.modelId)) continue;

      const provider = activeProviders.find((p) => p.config.modelId === step.modelId);

      if (!provider) {
        // Model not in the active provider list (inactive in conversation).
        const error = buildModelError(
          'unknown',
          `Chain step ${step.stepIndex}: model "${step.modelId}" is not active.`,
        );
        emitErrorChunk(step.modelId, error, onChunk);
        continue;
      }

      // Resolve per-model systemPrompt and selectedVersionId, falling back to shared values.
      const modelConfig = conversation?.models.find(
        (m) => m.modelId === step.modelId
      );
      const resolvedSystemPrompt = modelConfig?.systemPrompt ?? systemPrompt;
      const selectedVersionId = modelConfig?.selectedVersionId;

      // Option B: build a per-step attributed message array. sharedMessages grows
      // as appendToContext steps complete — the transform is applied at dispatch
      // time so each step's provider sees its own prior responses as assistant
      // turns and all other participants' responses as attributed user turns.
      const attributedMessages = conversation
        ? buildAttributedMessages(sharedMessages, step.modelId, conversation.models)
        : sharedMessages;

      // Option C: prepend multi-model framing to the effective system prompt.
      const otherActiveModels = conversation
        ? conversation.models.filter(
            (m) => m.isActive && m.modelId !== step.modelId
          )
        : [];
      const effectiveSystemPrompt =
        modelConfig && conversation
          ? buildAttributionSystemPrompt(resolvedSystemPrompt, modelConfig, otherActiveModels)
          : resolvedSystemPrompt;

      // Phase 5 (#285): strip attachments for providers that do not support vision.
      const isVision = visionCapable.has(step.modelId);
      const providerMessages = isVision ? attributedMessages : stripAttachments(attributedMessages);

      // Issue #379: pass requestImageGeneration only when the user has explicitly
      // enabled image gen for this model via the per-model toggle in Aria.
      const requestImageGeneration = imageGenEnabled.has(step.modelId);

      if (step.appendToContext) {
        // Wrap onChunk to accumulate the full response text for this step.
        const { handler, getText } = collectingChunkHandler(step.modelId, onChunk);
        await runProviderIsolated(provider, providerMessages, effectiveSystemPrompt, handler, selectedVersionId, signal, requestImageGeneration);

        // Append the raw response to sharedMessages (not attributedMessages) so
        // subsequent steps accumulate real content, not re-attributed wire format.
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
        await runProviderIsolated(provider, providerMessages, effectiveSystemPrompt, onChunk, selectedVersionId, signal, requestImageGeneration);
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
 * Provider resolution (issue #95):
 *   When a conversation is provided, active providers are resolved from the
 *   ProviderRoster (Gate's `getProviderRoster()`). Built-in roster entries map
 *   to static PROVIDERS instances; custom entries are instantiated via
 *   `createCustomProvider()`. Active modelIds with no roster entry receive an
 *   auth_failure StreamChunk and are excluded from dispatch.
 *
 *   When no conversation is provided (legacy/test path), PROVIDERS is used
 *   directly as before — no roster lookup occurs.
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
  const { conversation, systemPrompt, content, targetModelId, chainConfig, signal } = options;

  // Resolve active providers from the ProviderRoster when a conversation is available.
  // The PROVIDERS fallback (no conversation) preserves existing behavior for callers
  // that do not pass a conversation — e.g. legacy call sites and some tests.
  // visionCapable and imageGenEnabled are empty in the fallback path: messages built
  // without a conversation never carry attachments, and no image gen is requested,
  // so both capability gates are no-ops there.
  let activeProviders: Provider[];
  let visionCapable = new Set<ModelId>();
  let imageGenEnabled = new Set<ModelId>();
  if (conversation) {
    const resolved = getActiveProviders(conversation);
    activeProviders = resolved.providers;
    visionCapable = resolved.visionCapable;
    imageGenEnabled = resolved.imageGenEnabled;
    // Emit auth_failure chunks for any active modelIds missing from the roster
    // before routing — this happens for all modes except auto-chain (which handles
    // its own per-step emission in runAutoChain).
    if (!chainConfig) {
      emitMissingProviderErrors(resolved.missing, onChunk);
    }
  } else {
    activeProviders = PROVIDERS;
  }

  // Build the message array to send to providers.
  //
  // When a conversation is provided, the caller (App.tsx handleSend) has ALREADY
  // appended the current user message to conversation.messages before calling
  // sendMessage. Using conversation.messages directly avoids double-appending
  // the user message, which would produce two consecutive user-role messages at
  // the tail of the history. Most providers (Anthropic in particular) reject
  // requests with consecutive same-role messages with a 400 error.
  //
  // When no conversation is provided (legacy/test path), build the user message
  // from `content` here — that is the only source of truth in that path.
  const messages: Message[] = conversation
    ? [...conversation.messages]
    : [
        {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content,
          timestamp: Date.now(),
        },
      ];

  // ── User message tokenUsage backfill (issue #370) ────────────────────────────
  //
  // After each provider stream completes successfully, backfill the preceding user
  // message with the input token count and input-only estimated cost. Aria's
  // MessageBubble already renders tokenUsage on user messages when it is set.
  //
  // Mechanics: lastUserMsg is a reference to the same object that lives in
  // options.conversation.messages (shallow spread, not a deep copy). Mutating it
  // in-place means the mutation is visible to App.tsx's handleMessageComplete via
  // sentConversationRef.current, which spreads those same message references into
  // the updated conversation before calling store.updateConversation. So the change
  // persists to storage and propagates to React state without any extra save call.
  //
  // Order matters: the mutation must happen BEFORE calling onChunk so that
  // handleMessageComplete reads the already-mutated tokenUsage when it builds the
  // updated conversation.
  //
  // In parallel mode (multiple providers): the first provider to complete
  // successfully claims the backfill. All subsequent providers find
  // userMsgBackfilled === true and return early — the user message stores the
  // first-completing provider's input token count. This is the simplest correct
  // behaviour; all providers tokenize the same content so the counts are similar.
  //
  // Skip on AbortError: when the user clicks stop, signal.aborted is true before
  // the provider emits its done chunk (abort fires on the AbortController which
  // sets signal.aborted, then the provider catches the AbortError and emits a
  // partial done chunk). We check signal?.aborted in wrappedOnChunk to guard this.
  //
  // Skip on error: chunk.error is set on authentication, network, or rate-limit
  // failures. We never backfill from a failed stream.

  // Find the current user message — always the last user-role message in the array.
  // When a conversation is provided, App.tsx appends the user message to
  // conversation.messages before calling sendMessage, so it is the last element.
  const lastUserMsg = messages.slice().reverse().find((m) => m.role === 'user') ?? null;
  let userMsgBackfilled = false;

  /**
   * Resolve the API-level model string for a given provider and optional version
   * selection. This string is the pricing table key used to look up inputPer1M.
   *
   * Resolution order:
   *   1. selectedVersionId — explicitly selected by the user (e.g. 'claude-opus-4-8')
   *   2. Built-in registry — first availableVersions entry (the provider's default)
   *   3. Roster custom entry — modelString field from the user-configured endpoint
   *   4. undefined — no model string known; input cost is omitted
   */
  function getResolvedModelString(modelId: ModelId, selectedVersionId?: string): string | undefined {
    if (selectedVersionId) return selectedVersionId;
    // Built-in provider — use the first availableVersions entry (provider default).
    const registryEntry = MODEL_REGISTRY.find((e) => e.modelId === modelId);
    if (registryEntry) return registryEntry.availableVersions[0]?.id;
    // Custom provider — read modelString from the roster entry.
    const roster = getProviderRoster();
    const customEntry = roster.find((e) => e.kind === 'custom' && e.id === modelId);
    return customEntry?.kind === 'custom' ? customEntry.modelString : undefined;
  }

  /**
   * Mutate the last user message with the input-token portion of a completed stream.
   * Sets Message.tokenUsage with outputTokens:0 and the input-only estimatedCost.
   * The guard (userMsgBackfilled) ensures this runs at most once across all providers.
   */
  function backfillUserMessage(inputTokens: number, resolvedModelString: string | undefined): void {
    if (!lastUserMsg || userMsgBackfilled) return;
    userMsgBackfilled = true;
    const pricingTable = getPricingTable();
    const pricingEntry = resolvedModelString ? pricingTable?.[resolvedModelString] : undefined;
    // Input-only cost: exclude output tokens per issue #370 spec.
    // When no pricing entry is found the estimatedCost field is omitted (undefined).
    const estimatedCost =
      pricingEntry != null ? (inputTokens / 1_000_000) * pricingEntry.inputPer1M : undefined;
    lastUserMsg.tokenUsage = {
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
      ...(estimatedCost !== undefined ? { estimatedCost } : {}),
    };
  }

  // Wrap onChunk to intercept successful done chunks and backfill the user message.
  // The backfill runs before forwarding the chunk to Aria so that when
  // handleMessageComplete in App.tsx fires (triggered synchronously by the same
  // onChunk call below), sentConversationRef already holds the mutated user message.
  const wrappedOnChunk: StreamHandler = (chunk) => {
    if (chunk.isDone && !chunk.error && !(signal?.aborted) && chunk.tokenUsage) {
      const modelConfig = conversation?.models.find((m) => m.modelId === chunk.modelId);
      backfillUserMessage(
        chunk.tokenUsage.inputTokens,
        getResolvedModelString(chunk.modelId, modelConfig?.selectedVersionId),
      );
    }
    onChunk(chunk);
  };

  // ── Mode selection ──────────────────────────────────────────────────────────
  // Priority order: directed reply > auto-chain > parallel broadcast.
  //
  // targetModelId is checked first: a directed reply is an explicit per-message
  // override that must take precedence regardless of whether an auto-chain config
  // is also present. In auto-chain mode chainConfig is always built from all active
  // models, so checking it before targetModelId would silently swallow directed
  // replies and fan out to every model instead — the bug fixed in issue #373.

  // Directed reply — route to a single model.
  if (targetModelId) {
    await runDirected(targetModelId, activeProviders, messages, systemPrompt, wrappedOnChunk, conversation, signal, visionCapable, imageGenEnabled);
    return;
  }

  // Auto-chain — if chainConfig is supplied, sequence the steps.
  // runAutoChain performs its own roster resolution and missing-entry handling.
  if (chainConfig) {
    await runAutoChain(
      { ...options, conversation, systemPrompt },
      messages,
      wrappedOnChunk
    );
    return;
  }

  // Default — parallel broadcast.
  if (activeProviders.length === 0) return;
  await runParallel(activeProviders, messages, systemPrompt, wrappedOnChunk, conversation, signal, visionCapable, imageGenEnabled);
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
