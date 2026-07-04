/**
 * Atlas — proxyConfig.ts
 *
 * Thin runtime proxy-config reader for use within /src/models/.
 *
 * The canonical source for the runtime proxy URL is Gate's getProxyConfig()
 * function exported from @/auth. Atlas model files are authorized to import
 * getProxyConfig() from @/auth directly — documented as a cross-agent exception
 * in the ProxyConfig JSDoc in /src/types/index.ts, following the same pattern as
 * Aria importing getProviderRoster() from @/auth.
 *
 * This bridge module exists purely for build-time compatibility while Gate's
 * getProxyConfig export stabilizes in @/auth/index.ts (Gate issue #330 is being
 * implemented in a parallel worktree). It reads from the same localStorage key
 * ("roundtable:proxy-config") that Gate manages, using the same ProxyConfig type
 * from @/types — behavior is identical to Gate's implementation.
 *
 * Migration path: once Gate exports getProxyConfig from @/auth/index.ts, replace
 * all `import { getProxyConfig } from './proxyConfig'` callsites in this directory
 * with `import { getProxyConfig } from '@/auth'`, then delete this file.
 *
 * Security note: the proxy URL is not an API key. Reading it from localStorage
 * within Atlas does not violate the key-access rules (which apply to provider
 * credentials only). Gate owns this key exclusively for writes.
 */

import type { ProxyConfig } from '@/types';

// The localStorage key is defined in the ProxyConfig JSDoc in /src/types/index.ts.
// Gate owns all writes to this key — Atlas reads it as a documented cross-agent exception.
const PROXY_CONFIG_KEY = 'roundtable:proxy-config';

/**
 * Read the runtime proxy configuration from localStorage.
 * Returns null when no proxy is configured or the stored value is corrupt.
 *
 * Must be called at request time (inside sendMessage or URL-resolving logic),
 * not at module load time. Calling at request time ensures a proxy-settings change
 * takes effect without a page reload.
 */
export function getProxyConfig(): ProxyConfig | null {
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
      return parsed as ProxyConfig;
    }
    return null;
  } catch {
    return null;
  }
}
