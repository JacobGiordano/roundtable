// Atlas owns this directory — /src/models

export { ClaudeModelProvider, claudeProvider, CLAUDE_CONFIG } from './claude';
export { GPT55ModelProvider, gpt55Provider, GPT55_CONFIG } from './gpt';
export { GeminiModelProvider, geminiProvider, GEMINI_CONFIG } from './gemini';
export { GrokModelProvider, grokProvider, GROK_CONFIG } from './grok';
export { DeepSeekModelProvider, deepseekProvider, DEEPSEEK_CONFIG } from './deepseek';
export { MistralModelProvider, mistralProvider, MISTRAL_CONFIG } from './mistral';
export { GenericOpenAIProvider, createCustomProvider } from './generic';
export { sendMessage, getSessionTokenUsage } from './sendMessage';

// Central model registry — Aria may import MODEL_REGISTRY and buildDefaultModelConfigs
// to populate the model selector (documented cross-agent exception per CLAUDE.md).
export {
  PROVIDERS,
  MODEL_REGISTRY,
  buildDefaultModelConfigs,
} from './registry';
export type { ModelRegistryEntry } from './registry';

// Remote and live-API catalog fetch utilities.
// Aria may call these to populate the version picker with dynamically fetched
// model lists (documented cross-agent exception per CLAUDE.md).
// ModelCatalogEntry is defined in @/types — no new types exported here.
export { fetchRemoteCatalog, fetchLiveApiCatalog } from './catalog';
