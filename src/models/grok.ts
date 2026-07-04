/**
 * Atlas — grok.ts
 *
 * GrokModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Extends BaseOpenAIProvider — streaming logic, SSE parsing, error handling, and
 * token counting all live there. This file declares only the Grok-specific config:
 * API URL, default model, max tokens, and credential key.
 *
 * The xAI API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the resolved xAI endpoint (direct or via proxy)
 *
 * URL resolution (evaluated at request time — proxy settings take effect without reload):
 *   1. getProxyConfig()?.url + '/grok'  — runtime Cloudflare Workers proxy (new)
 *   2. /xai-proxy                       — Vite dev server proxy (DEV only)
 *   3. https://api.x.ai                 — direct (CORS behavior undocumented; may fail in browser)
 */

import type { ModelProviderConfig } from '@/types';
import { MAX_TOKENS_GROK } from './constants';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

// ─── Provider config ──────────────────────────────────────────────────────────

export const GROK_CONFIG: ModelProviderConfig = {
  modelId: 'grok',
  name: 'Grok',
  color: 'sky',
  credentialKey: 'xai',
};

// ─── GrokModelProvider ────────────────────────────────────────────────────────

export class GrokModelProvider extends BaseOpenAIProvider {
  readonly config: ModelProviderConfig = GROK_CONFIG;

  protected get apiUrl(): string {
    const base = this.resolveBaseUrl(
      '/grok',
      undefined,
      '/xai-proxy',
      'https://api.x.ai',
    );
    return `${base}/v1/chat/completions`;
  }

  /**
   * Default model string sent to the xAI API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Grok.
   */
  protected get defaultModel(): string {
    return 'grok-3';
  }

  protected get maxTokens(): number {
    return MAX_TOKENS_GROK;
  }

  protected get authErrorMessage(): string {
    return 'xAI API key is not set. Add it in Settings.';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const grokProvider = new GrokModelProvider();
