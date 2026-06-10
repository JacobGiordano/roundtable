// Atlas owns this directory — /src/models

export { ClaudeModelProvider, claudeProvider, CLAUDE_CONFIG } from './claude';
export { GPT55ModelProvider, gpt55Provider, GPT55_CONFIG } from './gpt';
export { sendMessage, getSessionTokenUsage } from './sendMessage';

// Central model registry — Aria may import MODEL_REGISTRY and buildDefaultModelConfigs
// to populate the model selector (documented cross-agent exception per CLAUDE.md).
// GeminiModelProvider and GrokModelProvider are not yet exported — blocked on Arch
// types PR adding 'gemini'/'grok' to ModelId and 'google'/'xai' to CredentialKey.
export {
  PROVIDERS,
  MODEL_REGISTRY,
  buildDefaultModelConfigs,
} from './registry';
export type { ModelRegistryEntry } from './registry';
