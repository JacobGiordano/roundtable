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
 */

import type { ModelId } from '@/types';
import type { ModelProvider } from '@/types';
import { claudeProvider, CLAUDE_CONFIG } from './claude';
import { gpt55Provider, GPT55_CONFIG } from './gpt';
import { geminiProvider, GEMINI_CONFIG } from './gemini';
import { grokProvider, GROK_CONFIG } from './grok';
import { deepseekProvider, DEEPSEEK_CONFIG } from './deepseek';
import { mistralProvider, MISTRAL_CONFIG } from './mistral';

// ─── Provider list — consumed by sendMessage.ts ───────────────────────────────

/**
 * Ordered list of all registered ModelProvider instances.
 * sendMessage.ts imports this to resolve active providers for a conversation.
 *
 * Phase 4 Wave 1: GeminiModelProvider and GrokModelProvider added.
 * Phase 4 Wave 2: DeepSeekModelProvider and MistralModelProvider added.
 */
export const PROVIDERS: ModelProvider[] = [
  claudeProvider,
  gpt55Provider,
  geminiProvider,
  grokProvider,
  deepseekProvider,
  mistralProvider,
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
  {
    modelId: GEMINI_CONFIG.modelId,
    name: GEMINI_CONFIG.name,
    color: 'accent-gemini',
    defaultActive: false,
  },
  {
    modelId: GROK_CONFIG.modelId,
    name: GROK_CONFIG.name,
    color: 'accent-other',
    defaultActive: false,
  },
  {
    // color: 'accent-other' — no dedicated design token yet; Luma will define
    // accent-deepseek in a follow-up pass when the full Wave 2 palette lands.
    modelId: DEEPSEEK_CONFIG.modelId,
    name: DEEPSEEK_CONFIG.name,
    color: 'accent-other',
    defaultActive: false,
  },
  {
    // color: 'accent-other' — no dedicated design token yet; Luma will define
    // accent-mistral in a follow-up pass when the full Wave 2 palette lands.
    modelId: MISTRAL_CONFIG.modelId,
    name: MISTRAL_CONFIG.name,
    color: 'accent-other',
    defaultActive: false,
  },
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
