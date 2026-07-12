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
export type { ModelRegistryEntry } from './registry';

// Remote and live-API catalog fetch utilities — documented cross-agent exceptions.
// Aria may call these to populate the version picker with dynamically fetched
// model lists. ModelCatalogEntry is defined in @/types — no new types exported here.
//
//   fetchRemoteCatalog(url)              — fetches a remote models.json
//   fetchLiveApiCatalog(endpoint, key)   — fetches a live provider /models endpoint (OpenRouter)
//   fetchAnthropicCatalog(key)           — fetches Anthropic /v1/models with x-api-key auth
//   fetchGeminiCatalog(key)              — fetches Google /v1beta/models with key-as-query-param
//   resolveVersionCatalog(entry, key?)   — resolver: live API → remote → bundled fallback
//   resolveCustomProviderCatalog(ep, key) — resolver for custom (non-registry) providers
//
// Aria should call resolveVersionCatalog for built-in registry entries and
// resolveCustomProviderCatalog for custom providers — not the individual fetch
// functions directly. Provider routing is handled inside resolveVersionCatalog
// based on ModelRegistryEntry.liveApiProvider.
export {
  fetchRemoteCatalog,
  fetchLiveApiCatalog,
  fetchAnthropicCatalog,
  fetchGeminiCatalog,
  resolveVersionCatalog,
  resolveCustomProviderCatalog,
} from './catalog';
