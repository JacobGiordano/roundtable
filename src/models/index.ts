// Atlas owns this directory — /src/models

export { ClaudeModelProvider, claudeProvider, CLAUDE_CONFIG } from './claude';
export { GPT55ModelProvider, gpt55Provider, GPT55_CONFIG } from './gpt';
export { GeminiModelProvider, geminiProvider, GEMINI_CONFIG } from './gemini';
export { GrokModelProvider, grokProvider, GROK_CONFIG } from './grok';
export { DeepSeekModelProvider, deepseekProvider, DEEPSEEK_CONFIG } from './deepseek';
export { MistralModelProvider, mistralProvider, MISTRAL_CONFIG } from './mistral';
export { GenericOpenAIProvider, createCustomProvider } from './generic';
export { sendMessage, stopMessage, getSessionTokenUsage } from './sendMessage';
// stopMessage — Aria may import this to wire the stop button. Cross-agent exception:
// Atlas installs the real implementation when sendMessage dispatches and resets to
// a no-op once all streams settle. Documented exception per CLAUDE.md. (#383)

// Central model registry — Aria may import MODEL_REGISTRY and buildDefaultModelConfigs
// to populate the model selector (documented cross-agent exception per CLAUDE.md).
export {
  PROVIDERS,
  MODEL_REGISTRY,
  buildDefaultModelConfigs,
} from './registry';
// ModelRegistryEntry is the canonical type from @/types (promoted by Arch in #549).
// Re-exported here for callers that import from @/models for convenience.
export type { ModelRegistryEntry } from '@/types';

// Remote and live-API catalog fetch utilities — documented cross-agent exceptions.
// Aria may call these to populate the version picker with dynamically fetched
// model lists. ModelCatalogEntry is defined in @/types — no new types exported here.
//
//   fetchRemoteCatalog(url)                   — fetches a remote models.json (array-at-root format)
//   fetchLiveApiCatalog(endpoint, key)        — fetches a live provider /models endpoint (OpenRouter)
//   fetchOpenRouterBuiltinCatalog(prefix)     — fetches OpenRouter public /models, filters by prefix (no key)
//   fetchModelsFallbackJson(url, providerKey) — fetches shared models.json, extracts per-provider list
//   fetchAnthropicCatalog(key)                — fetches Anthropic /v1/models with x-api-key auth
//   fetchGeminiCatalog(key)                   — fetches Google /v1beta/models with key-as-query-param
//   fetchOpenAICatalog(key)                   — fetches OpenAI /v1/models with Bearer auth (issue #420)
//   resolveVersionCatalog(entry, key?)        — resolver: live API → OpenRouter → models.json → bundled
//   resolveCustomProviderCatalog(ep, key)     — resolver for custom (non-registry) providers
//
// Aria should call resolveVersionCatalog for built-in registry entries and
// resolveCustomProviderCatalog for custom providers — not the individual fetch
// functions directly. Provider routing is handled inside resolveVersionCatalog
// based on ModelRegistryEntry.liveApiProvider and openrouterPrefix.
export {
  fetchRemoteCatalog,
  fetchLiveApiCatalog,
  fetchOpenRouterBuiltinCatalog,
  fetchModelsFallbackJson,
  fetchAnthropicCatalog,
  fetchGeminiCatalog,
  fetchOpenAICatalog,
  resolveVersionCatalog,
  resolveCustomProviderCatalog,
} from './catalog';
