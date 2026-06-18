/**
 * Gate — credentialTest.ts
 *
 * Validates a stored API key against its provider's cheapest available endpoint
 * (list-models or equivalent — no tokens consumed). Uses native browser fetch()
 * only; no Node.js http/https module.
 *
 * Security note: the `value` parameter is the raw API key. It is sent only to
 * the respective provider's official API endpoint and is never logged, stored,
 * or transmitted anywhere else.
 */

import type { CredentialKey } from '@/types';

// ─── Result type ──────────────────────────────────────────────────────────────

export type TestResult =
  | { status: 'valid'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'rate-limited'; message: string }
  | { status: 'error'; message: string };

// ─── Provider endpoint config ─────────────────────────────────────────────────

interface ProviderTestConfig {
  url: string;
  /** Build request init for the fetch call given the raw key value. */
  buildInit: (value: string) => RequestInit;
}

const PROVIDER_TEST_CONFIGS: Record<string, ProviderTestConfig> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        'x-api-key': value,
        'anthropic-version': '2023-06-01',
      },
    }),
  },
  openai: {
    url: 'https://api.openai.com/v1/models',
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
      },
    }),
  },
  google: {
    // Key is passed as a URL query parameter — no Authorization header needed.
    url: `https://generativelanguage.googleapis.com/v1beta/models`,
    buildInit: () => ({
      method: 'GET',
    }),
  },
  xai: {
    url: 'https://api.x.ai/v1/models',
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
      },
    }),
  },
  deepseek: {
    url: 'https://api.deepseek.com/models',
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
      },
    }),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
      },
    }),
  },
};

// ─── testCredential ────────────────────────────────────────────────────────────

/**
 * Test an API key by hitting the provider's cheapest endpoint (list-models).
 * Returns a TestResult indicating validity without consuming any tokens.
 *
 * The `value` parameter is sent only to the official provider endpoint.
 * It is never logged.
 */
export async function testCredential(
  credentialKey: CredentialKey,
  value: string,
): Promise<TestResult> {
  const config = PROVIDER_TEST_CONFIGS[credentialKey];

  if (!config) {
    return { status: 'error', message: 'Test not supported for this provider' };
  }

  let url = config.url;

  // Google passes the key as a query parameter rather than a header.
  if (credentialKey === 'google') {
    url = `${url}?key=${encodeURIComponent(value)}`;
  }

  let response: Response;
  try {
    response = await fetch(url, config.buildInit(value));
  } catch {
    // Network failure — DNS lookup error, connection refused, CORS abort, etc.
    return { status: 'error', message: 'Network error' };
  }

  if (response.status >= 200 && response.status <= 299) {
    return { status: 'valid', message: 'Key is valid' };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'invalid', message: 'Invalid key' };
  }

  if (response.status === 429) {
    return { status: 'rate-limited', message: 'Rate limited — key is valid' };
  }

  return { status: 'error', message: `Error (HTTP ${response.status})` };
}
