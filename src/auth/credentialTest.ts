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

// ─── Runtime proxy config reader ─────────────────────────────────────────────
//
// Reads Gate's proxy config from localStorage at call time. This inline
// implementation matches the ProxyConfig shape from @/types/index.ts and uses
// the canonical localStorage key ("roundtable:proxy-config") documented there.
//
// When Gate exports getProxyConfig() from ./proxyConfig, this inline reader can
// be replaced with that import. Behavior is identical either way.
//
// Security note: the proxy URL is not an API key — reading it here does not
// violate credential-handling rules.

const PROXY_CONFIG_KEY = 'roundtable:proxy-config';

function readRuntimeProxyUrl(): string | null {
  try {
    const raw = localStorage.getItem(PROXY_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'url' in parsed &&
      typeof (parsed as Record<string, unknown>).url === 'string'
    ) {
      return (parsed as Record<string, unknown>).url as string;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Per-provider test config builder ────────────────────────────────────────
//
// Built at call time inside testCredential() so the runtime proxy URL is always
// current — a proxy-settings change takes effect without a page reload.
//
// Priority chain for each provider's base URL (matches /src/models/* pattern):
//   1. runtimeProxyUrl + '/<provider-segment>'  — Cloudflare Workers proxy (new)
//   2. VITE_<PROVIDER>_PROXY_URL env var         — legacy build-time proxy (kept for compat)
//   3. /<provider>-proxy                         — Vite dev server proxy (DEV only)
//   4. https://api.provider.com                  — direct (CORS-blocked in most browsers)

function buildProviderTestConfigs(runtimeProxyUrl: string | null): Record<string, ProviderTestConfig> {
  /**
   * Resolve a provider's API base URL using the four-tier priority chain.
   *
   * @param proxySegment  - Provider path segment, e.g. '/anthropic'. Must start with '/'.
   * @param legacyEnvVar  - Legacy env var name to check (e.g. 'VITE_ANTHROPIC_PROXY_URL'),
   *                        or undefined if no legacy var exists for this provider.
   * @param devPath       - Vite dev proxy path, e.g. '/anthropic-proxy'.
   * @param directUrl     - Provider's canonical API base URL.
   */
  function resolveBase(
    proxySegment: string,
    legacyEnvVar: string | undefined,
    devPath: string,
    directUrl: string,
  ): string {
    if (runtimeProxyUrl) return runtimeProxyUrl + proxySegment;
    if (legacyEnvVar) {
      const envValue = (import.meta.env as Record<string, string | undefined>)[legacyEnvVar];
      if (envValue) return envValue;
    }
    return import.meta.env.DEV ? devPath : directUrl;
  }

  const anthropicBase = resolveBase('/anthropic', 'VITE_ANTHROPIC_PROXY_URL', '/anthropic-proxy', 'https://api.anthropic.com');
  const openaiBase    = resolveBase('/openai',    'VITE_OPENAI_PROXY_URL',    '/openai-proxy',    'https://api.openai.com');
  const googleBase    = resolveBase('/gemini',    'VITE_GOOGLE_PROXY_URL',    '/google-proxy',    'https://generativelanguage.googleapis.com');
  const xaiBase       = resolveBase('/grok',      'VITE_XAI_PROXY_URL',       '/xai-proxy',       'https://api.x.ai');
  const deepseekBase  = resolveBase('/deepseek',  'VITE_DEEPSEEK_PROXY_URL',  '/deepseek-proxy',  'https://api.deepseek.com');
  const mistralBase   = resolveBase('/mistral',   'VITE_MISTRAL_PROXY_URL',   '/mistral-proxy',   'https://api.mistral.ai');

  return {
    anthropic: {
      // Anthropic blocks browser-direct API calls (CORS). The dangerous-direct-browser-access
      // header satisfies Anthropic's origin check on proxied requests.
      url: `${anthropicBase}/v1/models`,
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
      // OpenAI — CORS preflight failures have been observed; proxy through Vite dev server.
      url: `${openaiBase}/v1/models`,
      buildInit: (value) => ({
        method: 'GET',
        headers: {
          Authorization: `Bearer ${value}`,
        },
      }),
    },
    google: {
      // Key is passed as a URL query parameter — no Authorization header needed.
      // The query param is appended in testCredential() after URL resolution.
      url: `${googleBase}/v1beta/models`,
      buildInit: () => ({
        method: 'GET',
      }),
    },
    xai: {
      url: `${xaiBase}/v1/models`,
      buildInit: (value) => ({
        method: 'GET',
        headers: {
          Authorization: `Bearer ${value}`,
        },
      }),
    },
    deepseek: {
      url: `${deepseekBase}/models`,
      buildInit: (value) => ({
        method: 'GET',
        headers: {
          Authorization: `Bearer ${value}`,
        },
      }),
    },
    mistral: {
      url: `${mistralBase}/v1/models`,
      buildInit: (value) => ({
        method: 'GET',
        headers: {
          Authorization: `Bearer ${value}`,
        },
      }),
    },
  };
}

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
  // Resolve the runtime proxy URL at call time — a settings change takes effect
  // without a page reload. Build the per-provider config with the current proxy URL.
  const runtimeProxyUrl = readRuntimeProxyUrl();
  const providerTestConfigs = buildProviderTestConfigs(runtimeProxyUrl);
  const config = providerTestConfigs[credentialKey];

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
 * No-auth providers (requiresApiKey === false):
 *   Short-circuits immediately without making any network call. Returns
 *   `{ status: 'valid', message: 'No API key required' }`. This prevents
 *   surfacing a spurious auth_failure when the provider is intentionally keyless
 *   (e.g. a local Ollama instance). The caller is still responsible for verifying
 *   endpoint reachability through other means if desired.
 *
 * URL normalisation:
 *   `endpointUrl` is the full endpoint URL the user configured — it may include
 *   the /chat/completions path (e.g. "http://localhost:11434/v1/chat/completions"
 *   or "https://openrouter.ai/api/v1/chat/completions"). We strip a trailing
 *   /chat/completions suffix before probing, then append /models. Trailing
 *   slashes are also stripped. If the resulting base URL already ends with
 *   "/models" we use it as-is.
 *
 * Security: `apiKey` is sent only to `endpointUrl` and is never logged.
 */
export async function testCustomCredential(
  endpointUrl: string,
  apiKey?: string,
  requiresApiKey?: boolean,
): Promise<TestResult> {
  // Short-circuit for explicitly keyless providers. No credential is needed
  // and no credential check should be attempted. Return 'valid' — the provider
  // is considered ready without auth.
  if (requiresApiKey === false) {
    return { status: 'valid', message: 'No API key required' };
  }

  if (!endpointUrl || !endpointUrl.trim()) {
    return { status: 'error', message: 'No endpoint URL configured' };
  }

  const base = endpointUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
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
