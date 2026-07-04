/**
 * Atlas — mistral.ts
 *
 * MistralModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Extends BaseOpenAIProvider — streaming logic, SSE parsing, error handling, and
 * token counting all live there. This file declares only the Mistral-specific config:
 * API URL, default model, max tokens, and credential key.
 *
 * Mistral's API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the resolved Mistral endpoint (direct or via proxy)
 *
 * URL resolution (evaluated at request time — proxy settings take effect without reload):
 *   1. getProxyConfig()?.url + '/mistral'  — runtime Cloudflare Workers proxy (new)
 *   2. /mistral-proxy                      — Vite dev server proxy (DEV only)
 *   3. https://api.mistral.ai              — direct (CORS behavior undocumented; may fail in browser)
 */

import type { ModelProviderConfig } from '@/types';
import { MAX_TOKENS_MISTRAL } from './constants';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

// ─── Provider config ──────────────────────────────────────────────────────────

export const MISTRAL_CONFIG: ModelProviderConfig = {
  modelId: 'mistral',
  name: 'Mistral',
  color: 'orange',
  credentialKey: 'mistral',
};

// ─── MistralModelProvider ─────────────────────────────────────────────────────

export class MistralModelProvider extends BaseOpenAIProvider {
  readonly config: ModelProviderConfig = MISTRAL_CONFIG;

  protected get apiUrl(): string {
    const base = this.resolveBaseUrl(
      '/mistral',
      undefined,
      '/mistral-proxy',
      'https://api.mistral.ai',
    );
    return `${base}/v1/chat/completions`;
  }

  /**
   * Default model string sent to the Mistral AI API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Mistral.
   */
  protected get defaultModel(): string {
    return 'mistral-large-latest';
  }

  protected get maxTokens(): number {
    return MAX_TOKENS_MISTRAL;
  }

  protected get authErrorMessage(): string {
    return 'Mistral API key is not set. Add it in Settings.';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const mistralProvider = new MistralModelProvider();
