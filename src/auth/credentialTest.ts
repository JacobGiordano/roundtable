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
  | { status: 'error'; message: string }
  /**
   * The fetch() call threw — most likely a CORS preflight rejection or a
   * network-level failure (DNS, connection refused, timeout). These are
   * indistinguishable at the browser level. The endpoint may still be valid;
   * the user should verify it directly.
   *
   * Both built-in and custom providers return this status on fetch throw.
   * Some built-in endpoints (e.g. Anthropic) do not return CORS headers on
   * error responses, so an invalid key may surface as a fetch throw rather
   * than a 401. The UI should guide the user to verify their key and network.
   */
  | { status: 'cors-or-network'; message: string };

// ─── Provider endpoint config ─────────────────────────────────────────────────

interface ProviderTestConfig {
  url: string;
  /** Build request init for the fetch call given the raw key value. */
  buildInit: (value: string) => RequestInit;
}

/**
 * Anthropic blocks browser-direct API calls (CORS). Route through the Vite
 * dev proxy in development — identical pattern to /src/models/claude.ts.
 *
 *   - Development: /anthropic-proxy → https://api.anthropic.com (Vite proxy,
 *     configured in vite.config.ts)
 *   - Production with self-hosted backend: VITE_ANTHROPIC_PROXY_URL env var
 *   - Production fallback: direct URL (will fail in browser due to CORS)
 *
 * The `anthropic-dangerous-direct-browser-access: true` header satisfies
 * Anthropic's browser-origin check on the proxied request.
 */
const ANTHROPIC_TEST_BASE =
  import.meta.env.VITE_ANTHROPIC_PROXY_URL ??
  (import.meta.env.DEV ? '/anthropic-proxy' : 'https://api.anthropic.com');

const PROVIDER_TEST_CONFIGS: Record<string, ProviderTestConfig> = {
  anthropic: {
    url: `${ANTHROPIC_TEST_BASE}/v1/models`,
    buildInit: (value) => ({
      method: 'GET',
      headers: {
        'x-api-key': value,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
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

// ─── Shared HTTP status interpreter ───────────────────────────────────────────

/**
 * Interpret a fetch Response's HTTP status code into a TestResult.
 * Shared by testCredential and testCustomCredential.
 */
function interpretHttpStatus(status: number): TestResult {
  if (status >= 200 && status <= 299) {
    return { status: 'valid', message: 'Key is valid' };
  }
  if (status === 401 || status === 403) {
    return { status: 'invalid', message: 'Invalid key' };
  }
  if (status === 429) {
    return { status: 'rate-limited', message: 'Rate limited — key is valid' };
  }
  return { status: 'error', message: `Error (HTTP ${status})` };
}

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
    // fetch() threw — network failure, DNS error, connection refused, or a
    // CORS preflight rejection. These are indistinguishable at the browser API
    // level. Some provider endpoints (e.g. Anthropic) do not return CORS
    // headers on error responses, so an invalid key can surface as a fetch
    // throw rather than a 401. Return 'cors-or-network' so the UI can surface
    // an informative message rather than a misleading generic error.
    return {
      status: 'cors-or-network',
      message:
        'Cannot reach provider — CORS or network error. ' +
        'Verify your API key and network connection.',
    };
  }

  return interpretHttpStatus(response.status);
}

// ─── testCustomCredential ─────────────────────────────────────────────────────

/**
 * Test connectivity and authentication for a user-configured custom
 * OpenAI-compatible endpoint.
 *
 * Strategy: issue a GET request to `<endpointUrl>/v1/models`.
 * - If the fetch() itself throws, the cause is almost always either CORS or a
 *   network-level failure. These are indistinguishable at the browser API
 *   level — a CORS preflight rejection and a TCP connection-refused both surface
 *   as a TypeError with no status code. We return 'cors-or-network' to surface
 *   this ambiguity clearly to the user rather than a misleading "invalid key".
 * - 2xx → 'valid'
 * - 401/403 → 'invalid' (endpoint reachable; key is wrong)
 * - 429 → 'rate-limited' (key is valid)
 * - Other → 'error' with HTTP status
 *
 * Keyless endpoints (apiKey absent or empty string):
 *   The Authorization header is omitted entirely. A 2xx response confirms the
 *   endpoint is reachable; 401/403 indicates auth IS required.
 *
 * URL normalisation:
 *   `endpointUrl` is the base URL the user configured — it should be the
 *   /chat/completions root (e.g. "http://localhost:11434/v1"). We probe
 *   `<endpointUrl>/models` (stripping any trailing slash) to avoid double-slash.
 *   If the base URL already ends with "/models" we use it as-is.
 *
 * Security: `apiKey` is sent only to `endpointUrl` and is never logged.
 */
export async function testCustomCredential(
  endpointUrl: string,
  apiKey?: string,
): Promise<TestResult> {
  if (!endpointUrl || !endpointUrl.trim()) {
    return { status: 'error', message: 'No endpoint URL configured' };
  }

  const base = endpointUrl.trim().replace(/\/+$/, '');
  const probeUrl = base.endsWith('/models') ? base : `${base}/models`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const trimmedKey = apiKey?.trim() ?? '';
  if (trimmedKey) {
    // Only attach Authorization if a key was supplied — keyless endpoints
    // (e.g. a local Ollama instance) do not want or need this header.
    headers['Authorization'] = `Bearer ${trimmedKey}`;
  }

  let response: Response;
  try {
    response = await fetch(probeUrl, {
      method: 'GET',
      headers,
    });
  } catch {
    // fetch() threw — indistinguishable between CORS rejection and network
    // failure (DNS, connection refused, timeout). Return 'cors-or-network'
    // so the UI can show an informative message rather than "invalid key".
    return {
      status: 'cors-or-network',
      message:
        'Cannot reach endpoint — CORS or network error. ' +
        'The endpoint may be valid; verify it is running and allows browser requests.',
    };
  }

  // If the endpoint requires auth but none was supplied, surface that clearly.
  if (!trimmedKey && (response.status === 401 || response.status === 403)) {
    return {
      status: 'invalid',
      message: 'Endpoint requires an API key',
    };
  }

  return interpretHttpStatus(response.status);
}
