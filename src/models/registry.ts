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

import type { ModelId, ModelVersionOption } from '@/types';
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
   * Human-readable provider/company name. Aria uses this in the model selector
   * panel instead of hardcoding a per-model ternary.
   * Examples: "Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Mistral"
   */
  providerName: string;
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
  /**
   * All selectable API-level model versions for this provider.
   * The first entry is treated as the default (used when ModelConfig.selectedVersionId
   * is absent or does not match any entry).
   *
   * Atlas populates these; Aria renders them as a version picker; Gate persists
   * the user's choice via ModelConfig.selectedVersionId. The `id` on each entry
   * is the exact string passed to the provider's API endpoint.
   */
  availableVersions: ModelVersionOption[];
  /**
   * URL of a remote `models.json` file to fetch at runtime via `fetchRemoteCatalog`.
   * When present, `resolveVersionCatalog` fetches this URL and returns the result.
   * The URL is expected to be hosted on `raw.githubusercontent.com` (on the network
   * allowlist). Falls back to `availableVersions` if the fetch fails.
   *
   * None of the built-in registry entries populate this field — their version lists
   * are complete and static. This field is reserved for future providers whose
   * canonical version list is maintained externally.
   */
  remoteCatalogUrl?: string;
  /**
   * Base API endpoint for live model discovery via `fetchLiveApiCatalog`.
   * When present (and an `apiKey` is provided), `resolveVersionCatalog` calls
   * `fetchLiveApiCatalog(liveApiEndpoint, apiKey)` and returns the result.
   * Takes precedence over `remoteCatalogUrl` when both are set.
   *
   * Example: `"https://openrouter.ai/api/v1"` (note: openrouter.ai is NOT on
   * the dev-container firewall allowlist — live fetch degrades to [] in dev).
   *
   * When `liveApiProvider` is also set, `resolveVersionCatalog` dispatches to
   * the matching provider-specific fetcher instead of the generic OpenRouter
   * fetcher (`fetchLiveApiCatalog`). In that case this field serves as a
   * documentation note about the endpoint rather than being passed to `fetchLiveApiCatalog`.
   */
  liveApiEndpoint?: string;
  /**
   * Identifies which provider-specific live catalog fetcher to use when
   * `liveApiEndpoint` is set. When absent, `fetchLiveApiCatalog` (OpenRouter
   * wire format) is used. When set, `resolveVersionCatalog` dispatches to the
   * matching named fetcher in catalog.ts.
   *
   *   'anthropic' — `fetchAnthropicCatalog(apiKey)` (Anthropic `/v1/models`)
   *   'gemini'    — `fetchGeminiCatalog(apiKey)` (Google `/v1beta/models`)
   *
   * Custom providers always use the OpenRouter wire format via
   * `resolveCustomProviderCatalog` — this field is only for built-in registry
   * entries whose provider API differs from the OpenRouter shape.
   */
  liveApiProvider?: 'anthropic' | 'gemini';
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
    providerName: 'Anthropic',
    color: 'accent-claude',
    defaultActive: true,
    availableVersions: [
      { id: 'claude-opus-4-8', displayName: 'Claude Opus 4', description: 'Most capable — complex reasoning and long-horizon tasks' },
      { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4', description: 'Balanced capability and speed — default' },
      { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4', description: 'Fastest and most compact' },
    ],
    // Live model discovery via Anthropic's /v1/models endpoint.
    // Surfaces max_input_tokens as contextWindow per model version.
    // Note: Anthropic's API is CORS-blocked in browser without a proxy — live
    // fetch degrades to [] (bundled fallback) when no proxy is configured.
    liveApiEndpoint: 'https://api.anthropic.com/v1/models',
    liveApiProvider: 'anthropic' as const,
  },
  {
    modelId: GPT55_CONFIG.modelId,
    name: GPT55_CONFIG.name,
    providerName: 'OpenAI',
    color: 'accent-gpt',
    defaultActive: true,
    availableVersions: [
      { id: 'gpt-5.5', displayName: 'GPT-5.5', description: 'Latest flagship — default' },
      { id: 'gpt-4o', displayName: 'GPT-4o', description: 'High capability, multimodal' },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', description: 'Fast and cost-efficient' },
      { id: 'o3', displayName: 'o3', description: 'Advanced reasoning model' },
      { id: 'o1', displayName: 'o1', description: 'Strong reasoning, slower responses' },
      { id: 'o1-mini', displayName: 'o1-mini', description: 'Compact reasoning model' },
    ],
  },
  {
    modelId: GEMINI_CONFIG.modelId,
    name: GEMINI_CONFIG.name,
    providerName: 'Google',
    color: 'accent-gemini',
    defaultActive: false,
    availableVersions: [
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Most capable — complex tasks and long context' },
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast and efficient — default' },
      // Issue #375 — native image generation (opt-in by version selection).
      // gemini-2.5-flash-image ("Nano Banana") is the GA image-gen model that supports
      // responseModalities: ["TEXT", "IMAGE"] in generationConfig. Selecting this version
      // opts in to image output — the Gemini provider includes responseModalities only
      // when the resolved model string is in IMAGE_GEN_MODEL_STRINGS (gemini.ts).
      // The existing inlineData parser handles the returned image content blocks (#364/#366).
      // Only this model string is confirmed to support image output via responseModalities.
      // gemini-2.5-pro and gemini-2.5-flash are text-only; image output is unconfirmed.
      // gemini-2.0-flash was removed — it was shut down June 1, 2026.
      { id: 'gemini-2.5-flash-image', displayName: 'Gemini 2.5 Flash Image', description: 'Native image generation ("Nano Banana") — produces text + images' },
    ],
    // Live model discovery via Google's /v1beta/models endpoint.
    // Surfaces inputTokenLimit as contextWindow; filters to generateContent-capable
    // models only (chat models, not embedding or code-execution only).
    // Note: the Google API uses key-as-query-param auth — fetchGeminiCatalog
    // handles this internally. The endpoint listed here is for documentation only.
    liveApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    liveApiProvider: 'gemini' as const,
  },
  {
    modelId: GROK_CONFIG.modelId,
    name: GROK_CONFIG.name,
    providerName: 'xAI',
    color: 'accent-grok',
    defaultActive: false,
    availableVersions: [
      { id: 'grok-3', displayName: 'Grok 3', description: 'Flagship — default' },
      { id: 'grok-3-mini', displayName: 'Grok 3 mini', description: 'Efficient reasoning model' },
      { id: 'grok-2', displayName: 'Grok 2', description: 'Stable prior-generation model' },
    ],
  },
  {
    modelId: DEEPSEEK_CONFIG.modelId,
    name: DEEPSEEK_CONFIG.name,
    providerName: 'DeepSeek',
    color: 'accent-deepseek',
    defaultActive: false,
    availableVersions: [
      { id: 'deepseek-chat', displayName: 'DeepSeek Chat', description: 'General-purpose chat — default' },
      { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', description: 'Advanced reasoning (R1)' },
    ],
  },
  {
    modelId: MISTRAL_CONFIG.modelId,
    name: MISTRAL_CONFIG.name,
    providerName: 'Mistral',
    color: 'accent-mistral',
    defaultActive: false,
    availableVersions: [
      { id: 'mistral-large-latest', displayName: 'Mistral Large', description: 'Most capable — default' },
      { id: 'mistral-small-latest', displayName: 'Mistral Small', description: 'Fast and cost-efficient' },
      { id: 'open-mistral-nemo', displayName: 'Mistral Nemo', description: 'Open-weight, 12B parameters' },
    ],
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
