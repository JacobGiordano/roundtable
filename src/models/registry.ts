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

import type { ModelRegistryEntry } from '@/types';
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

// ModelRegistryEntry is the canonical type from @/types/index.ts (promoted by
// Arch in #549). The local interface formerly defined here is removed — use the
// imported type directly.
//
// RegistryEntryWithDeprecation extends ModelRegistryEntry with the deprecated
// and deprecationDate fields that have not yet been promoted to the canonical
// type. These are Atlas-local for now; Aria reads them via its own local
// RegistryEntryWithDeprecation cast in ModelSelectorPanel.tsx (issue #423).
// When Arch promotes deprecated/deprecationDate to ModelRegistryEntry in a
// future types PR, this local extension can be deleted.
interface RegistryEntryWithDeprecation extends ModelRegistryEntry {
  /**
   * Whether this provider is deprecated. When true, Aria should surface a
   * deprecation warning so users have time to migrate before the API stops
   * responding.
   *
   * Set this field ahead of the shutdown date — do not remove the entry until
   * after the deprecation date has passed and any ongoing sessions have cleared.
   * The `deprecationDate` field records the exact cutoff.
   */
  deprecated?: boolean;
  /**
   * ISO 8601 date string (YYYY-MM-DD) on which this provider's API is expected
   * to stop accepting requests. Used by Aria to display a deadline in the
   * deprecation warning banner.
   *
   * Only meaningful when `deprecated` is true.
   */
  deprecationDate?: string;
}

/**
 * All registered models in display order.
 *
 * Aria consumes this to build the initial ModelConfig[] for new conversations
 * and to populate the model selector panel. The `color` values here use the
 * design-system token names (e.g. 'accent-claude') rather than raw Tailwind
 * colors, matching the pattern used in App.tsx's MOCK_MODELS.
 *
 * Typed as RegistryEntryWithDeprecation[] internally to accommodate the
 * deprecated/deprecationDate fields on entries like DeepSeek. The array is
 * assignable to ModelRegistryEntry[] at the export boundary since
 * RegistryEntryWithDeprecation is a strict superset of ModelRegistryEntry.
 */
export const MODEL_REGISTRY: RegistryEntryWithDeprecation[] = [
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
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'anthropic',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
  },
  {
    modelId: GPT55_CONFIG.modelId,
    name: GPT55_CONFIG.name,
    providerName: 'OpenAI',
    color: 'accent-gpt',
    defaultActive: true,
    availableVersions: [
      { id: 'gpt-5.6', displayName: 'GPT-5.6', description: 'Latest flagship — released July 2026' },
      { id: 'gpt-5.5', displayName: 'GPT-5.5', description: 'Previous flagship' },
      { id: 'gpt-4o', displayName: 'GPT-4o', description: 'High capability, multimodal' },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', description: 'Fast and cost-efficient' },
      { id: 'o3', displayName: 'o3', description: 'Advanced reasoning model' },
      { id: 'o1', displayName: 'o1', description: 'Strong reasoning, slower responses' },
      { id: 'o1-mini', displayName: 'o1-mini', description: 'Compact reasoning model' },
      // Issue #377 — native image generation via the /v1/images/generations endpoint.
      // Selecting gpt-image-2 routes to generateImage() in GPT55ModelProvider (gpt.ts)
      // instead of the normal /v1/chat/completions path. The model selection is the
      // opt-in signal; Gate must also set imageGeneration: true in BUILTIN_CAPABILITIES_MAP
      // for 'gpt-5.5' so sendMessage.ts populates imageGenEnabled and passes
      // requestImageGeneration: true to the provider (same pattern as Gemini, issue #375).
      { id: 'gpt-image-2', displayName: 'GPT Image 2', description: 'Native image generation — produces images from text prompts' },
      // gpt-image-1: DEPRECATED — scheduled for removal October 23 2026 (OpenAI deprecation notice).
      // Included here so existing sessions using gpt-image-1 remain functional until that date.
      // Do NOT add UI affordances for this model; gpt-image-2 is the primary target.
      { id: 'gpt-image-1', displayName: 'GPT Image 1 (deprecated)', description: 'Legacy image generation — deprecated October 23 2026; use GPT Image 2' },
    ],
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'openai',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
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
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'google',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
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
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'x-ai',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
  },
  {
    modelId: DEEPSEEK_CONFIG.modelId,
    name: DEEPSEEK_CONFIG.name,
    providerName: 'DeepSeek',
    color: 'accent-deepseek',
    defaultActive: false,
    // DeepSeek APIs will stop responding 2026-07-24. Do not remove this entry
    // until after that date so in-flight sessions can drain gracefully.
    // Aria reads `deprecated` and `deprecationDate` to show a warning banner.
    deprecated: true,
    deprecationDate: '2026-07-24',
    availableVersions: [
      { id: 'deepseek-chat', displayName: 'DeepSeek Chat', description: 'Deprecated 2026-07-24 — migrate to another provider' },
      { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', description: 'Deprecated 2026-07-24 — migrate to another provider' },
    ],
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'deepseek',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
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
    // OpenRouter no-key discovery: first tier of fallback chain.
    openrouterPrefix: 'mistralai',
    // models.json fallback: second tier — fetched from GitHub raw URL without a key.
    remoteCatalogUrl: 'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json',
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
