/**
 * Atlas — registry.ts
 *
 * Central model registry. This is the single source of truth for all
 * available ModelProvider instances. Aria imports MODEL_REGISTRY to populate
 * the model selector. sendMessage.ts imports PROVIDERS for broadcast routing.
 *
 * To add a new provider:
 *   1. Ensure Arch has added the new ModelId and CredentialKey to /src/types/index.ts
 *   2. Ensure Gate has added the new CredentialKey to CREDENTIAL_LABELS and
 *      MODEL_CREDENTIAL_MAP in /src/auth/credentials.ts
 *   3. Add the new provider file to /src/models/
 *   4. Import the provider and its config below
 *   5. Add the provider singleton to PROVIDERS
 *   6. Add a ModelRegistryEntry to MODEL_REGISTRY
 *
 * Phase 4 additions pending Arch types PR (issue: add 'gemini' and 'grok' to
 * ModelId, and 'google' and 'xai' to CredentialKey in /src/types/index.ts):
 *   - GeminiModelProvider (see gemini.ts — implementation complete, blocked on types)
 *   - GrokModelProvider (see grok.ts — implementation complete, blocked on types)
 */

import type { ModelId } from '@/types';
import type { ModelProvider } from '@/types';
import { claudeProvider, CLAUDE_CONFIG } from './claude';
import { gpt55Provider, GPT55_CONFIG } from './gpt';

// ─── Provider list — consumed by sendMessage.ts ───────────────────────────────

/**
 * Ordered list of all registered ModelProvider instances.
 * sendMessage.ts imports this to resolve active providers for a conversation.
 *
 * Phase 4: GeminiModelProvider and GrokModelProvider will be added here once
 * Arch extends ModelId and CredentialKey in /src/types/index.ts.
 */
export const PROVIDERS: ModelProvider[] = [
  claudeProvider,
  gpt55Provider,
  // geminiProvider,  // TODO(arch): activate after types PR lands
  // grokProvider,    // TODO(arch): activate after types PR lands
];

// ─── Registry entry — consumed by Aria for model selector UI ─────────────────

/**
 * Rich display metadata for a registered model. Aria uses MODEL_REGISTRY to
 * populate the model selector without importing individual providers.
 *
 * This is the clean replacement for the MOCK_MODELS array in App.tsx.
 * Once Aria consumes MODEL_REGISTRY, App.tsx can remove MOCK_MODELS and its
 * `const [models, setModels]` initial state can seed from MODEL_REGISTRY.
 */
export interface ModelRegistryEntry {
  modelId: ModelId;
  /** Display name shown in the model selector and message bubbles. */
  name: string;
  /**
   * Tailwind color token for the model's accent color, e.g. 'accent-claude'.
   * Matches the token names used in the design system (Luma).
   */
  color: string;
  /**
   * Whether this model is active by default when a new conversation is created.
   * Users can toggle this per-conversation.
   */
  defaultActive: boolean;
}

/**
 * All registered models in display order.
 *
 * Aria consumes this to build the initial ModelConfig[] for new conversations
 * and to populate the model selector panel. The `color` values here use the
 * design-system token names (e.g. 'accent-claude') rather than raw Tailwind
 * colors, matching the pattern used in App.tsx's MOCK_MODELS.
 *
 * Phase 4: Gemini and Grok entries will be added here once the types PR lands.
 */
export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    modelId: CLAUDE_CONFIG.modelId,
    name: CLAUDE_CONFIG.name,
    color: 'accent-claude',
    defaultActive: true,
  },
  {
    modelId: GPT55_CONFIG.modelId,
    name: GPT55_CONFIG.name,
    color: 'accent-gpt',
    defaultActive: true,
  },
  // { modelId: 'gemini', name: 'Gemini', color: 'accent-gemini', defaultActive: false },
  // { modelId: 'grok',   name: 'Grok',   color: 'accent-other',  defaultActive: false },
  // TODO(arch): activate after types PR adds 'gemini' and 'grok' to ModelId
];

/**
 * Convenience: build initial ModelConfig[] for a new conversation from the
 * registry. Aria can call this instead of hardcoding MOCK_MODELS in App.tsx.
 *
 * Usage (in App.tsx):
 *   import { buildDefaultModelConfigs } from '@/models';
 *   const [models, setModels] = useState<ModelConfig[]>(buildDefaultModelConfigs());
 */
export function buildDefaultModelConfigs() {
  return MODEL_REGISTRY.map((entry) => ({
    modelId: entry.modelId,
    name: entry.name,
    color: entry.color,
    isActive: entry.defaultActive,
  }));
}
