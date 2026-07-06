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
 *   - The API key is only transmitted to the resolved OpenAI endpoint (direct or via proxy)
 *
 * URL resolution (evaluated at request time — proxy settings take effect without reload):
 *   1. getProxyConfig()?.url + '/openai'  — runtime Cloudflare Workers proxy (new)
 *   2. VITE_OPENAI_PROXY_URL              — legacy build-time proxy (kept for compat)
 *   3. /openai-proxy                      — Vite dev server proxy (DEV only)
 *   4. https://api.openai.com             — direct (CORS-blocked in many browser environments)
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
    const base = this.resolveBaseUrl(
      '/openai',
      import.meta.env.VITE_OPENAI_PROXY_URL,
      '/openai-proxy',
      'https://api.openai.com',
    );
    return `${base}/v1/chat/completions`;
  }

  /**
   * Default model string sent to the OpenAI API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for GPT.
   *
   * Spike #346 — gpt-5.5 availability confirmed:
   * GPT-5.5 is broadly available to all paid API tiers (Tier 1+) as of
   * April 24, 2026. A live 500 error observed in a 3-model conversation was a
   * transient server-side error, not a model-not-found failure — OpenAI docs
   * classify 500s as temporary and recommend exponential backoff retries. The
   * default remains gpt-5.5; no fallback to gpt-4o is needed.
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
