/**
 * Gate — proxyConfig.ts
 *
 * Implements getProxyConfig(), saveProxyConfig(), and clearProxyConfig() for
 * the ProxyConfig interface defined in /src/types/index.ts.
 *
 * Storage key: 'roundtable:proxy-config'
 * Persistence layer: localStorage only
 *
 * Users who deploy Roundtable to GitHub Pages configure a Cloudflare Workers
 * proxy URL here. Atlas reads getProxyConfig() at call time to determine the
 * effective API base URL for every provider request (documented cross-agent
 * import exception in /src/types/index.ts).
 *
 * Trailing slash normalisation: saveProxyConfig() strips one or more trailing
 * slashes from config.url before persisting (e.g. "https://my-proxy.workers.dev/"
 * becomes "https://my-proxy.workers.dev"). This matches the backendAuth.ts
 * convention and ensures Atlas can safely append a path segment without
 * producing double slashes.
 */

import type { ProxyConfig } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

const PROXY_CONFIG_STORAGE_KEY = 'roundtable:proxy-config' as const;

// ─── Shape validation ─────────────────────────────────────────────────────────

/**
 * Returns true iff the value is a ProxyConfig — an object with a non-empty
 * string `url` field.
 */
function isProxyConfig(value: unknown): value is ProxyConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.url === 'string' && obj.url.length > 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the stored proxy configuration, or null if no proxy has been
 * configured.
 *
 * Returns null on: missing key, JSON parse failure, or any value that does
 * not conform to ProxyConfig shape (object with a non-empty `url` string).
 * Never throws.
 */
export function getProxyConfig(): ProxyConfig | null {
  try {
    const raw = localStorage.getItem(PROXY_CONFIG_STORAGE_KEY);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!isProxyConfig(parsed)) return null;

    return parsed;
  } catch {
    // localStorage unavailable (e.g. SSR context or storage access denied)
    return null;
  }
}

/**
 * Persist the proxy configuration to localStorage.
 *
 * Strips trailing slashes from `config.url` before storing so that Atlas can
 * safely append path segments without double slashes.
 *
 * Throws TypeError if `config.url` is not a string or is empty — Aria
 * validates the form field before calling this function.
 */
export function saveProxyConfig(config: ProxyConfig): void {
  if (typeof config.url !== 'string' || config.url.length === 0) {
    throw new TypeError('saveProxyConfig: config.url must be a non-empty string');
  }

  const normalised: ProxyConfig = {
    url: config.url.replace(/\/+$/, ''),
  };

  localStorage.setItem(PROXY_CONFIG_STORAGE_KEY, JSON.stringify(normalised));
}

/**
 * Remove the stored proxy configuration from localStorage.
 *
 * No-op if the key does not exist.
 */
export function clearProxyConfig(): void {
  localStorage.removeItem(PROXY_CONFIG_STORAGE_KEY);
}
