/**
 * Atlas — gpt.ts
 *
 * GPT55ModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Extends BaseOpenAIProvider — streaming logic, SSE parsing, error handling, and
 * token counting all live there. This file declares only the GPT-specific config:
 * API URL, default model, max tokens, and credential key.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.openai.com
 *
 * Dev proxy:
 *   OpenAI's CORS stance changed — browser-direct calls now fail preflight in many
 *   environments. In development, we route through Vite's /openai-proxy → api.openai.com
 *   server-side proxy (configured in vite.config.ts), matching the pattern used by
 *   Claude (/anthropic-proxy), Gemini (/google-proxy), and others.
 *   VITE_OPENAI_PROXY_URL overrides both dev and prod paths when set.
 */

import type { ModelProviderConfig } from '@/types';
import { MAX_TOKENS_GPT } from './constants';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

// ─── Provider config ──────────────────────────────────────────────────────────

export const GPT55_CONFIG: ModelProviderConfig = {
  modelId: 'gpt-5.5',
  name: 'ChatGPT',
  color: 'emerald',
  credentialKey: 'openai',
};

// ─── GPT55ModelProvider ───────────────────────────────────────────────────────

export class GPT55ModelProvider extends BaseOpenAIProvider {
  readonly config: ModelProviderConfig = GPT55_CONFIG;

  protected get apiUrl(): string {
    const base =
      import.meta.env.VITE_OPENAI_PROXY_URL ??
      (import.meta.env.DEV ? '/openai-proxy' : 'https://api.openai.com');
    return `${base}/v1/chat/completions`;
  }

  /**
   * Default model string sent to the OpenAI API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for GPT.
   */
  protected get defaultModel(): string {
    return 'gpt-5.5';
  }

  protected get maxTokens(): number {
    return MAX_TOKENS_GPT;
  }

  protected get authErrorMessage(): string {
    return 'OpenAI API key is not set. Add it in Settings.';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gpt55Provider = new GPT55ModelProvider();
