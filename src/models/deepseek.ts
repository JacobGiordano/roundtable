/**
 * Atlas — deepseek.ts
 *
 * DeepSeekModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Extends BaseOpenAIProvider — streaming logic, SSE parsing, error handling, and
 * token counting all live there. This file declares only the DeepSeek-specific config:
 * API URL, default model, max tokens, and credential key.
 *
 * DeepSeek's API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.deepseek.com
 */

import type { ModelProviderConfig } from '@/types';
import { MAX_TOKENS_DEEPSEEK } from './constants';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

// ─── Provider config ──────────────────────────────────────────────────────────

export const DEEPSEEK_CONFIG: ModelProviderConfig = {
  modelId: 'deepseek',
  name: 'DeepSeek',
  color: 'sky',
  credentialKey: 'deepseek',
};

// ─── DeepSeekModelProvider ────────────────────────────────────────────────────

export class DeepSeekModelProvider extends BaseOpenAIProvider {
  readonly config: ModelProviderConfig = DEEPSEEK_CONFIG;

  protected get apiUrl(): string {
    return 'https://api.deepseek.com/v1/chat/completions';
  }

  /**
   * Default model string sent to the DeepSeek API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for DeepSeek.
   */
  protected get defaultModel(): string {
    return 'deepseek-chat';
  }

  protected get maxTokens(): number {
    return MAX_TOKENS_DEEPSEEK;
  }

  protected get authErrorMessage(): string {
    return 'DeepSeek API key is not set. Add it in Settings.';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const deepseekProvider = new DeepSeekModelProvider();
