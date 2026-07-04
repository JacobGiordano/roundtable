/**
 * ProxySettingsPanel — Connection Proxy section for the sidebar settings panel.
 *
 * Renders:
 *   - Section heading: "Connection Proxy"
 *   - One-sentence description of when the proxy is needed
 *   - URL input (pre-populated from Gate on mount)
 *   - "Test" button — sends OPTIONS to {url}/anthropic; shows connected/failed indicator
 *   - "Save" button — persists the URL via Gate (visible only when there is input)
 *   - "Clear" link — removes stored proxy config, resets the input (visible only when there is input)
 *
 * Gate cross-agent imports (permitted per CLAUDE.md):
 *   - getProxyConfig: read-only utility, reads the stored ProxyConfig on mount
 *   - saveProxyConfig: persistence utility, called when the user saves a URL
 *   - clearProxyConfig: persistence utility, called when the user clears the config
 */

import { useState, useCallback, useRef, useEffect } from 'react';
// Gate cross-agent exception: getProxyConfig, saveProxyConfig, clearProxyConfig are
// pure Gate persistence utilities consumed here per the permitted exception in CLAUDE.md.
import { getProxyConfig, saveProxyConfig, clearProxyConfig } from '@/auth';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';
type SaveStatus = 'idle' | 'saved';

// ─── ProxySettingsPanel ────────────────────────────────────────────────────────

export function ProxySettingsPanel() {
  // URL input — initialised from Gate storage on mount.
  const [inputUrl, setInputUrl] = useState<string>(() => getProxyConfig()?.url ?? '');
  // Test status: idle / testing / success / failed.
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  // Save status: idle / saved (brief flash).
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // Timer ref to clear the "Saved" flash state.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the save timer on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ── Test ───────────────────────────────────────────────────────────────────
  // Sends an OPTIONS request to {url}/anthropic. The proxy is expected to
  // respond with a 2xx status to CORS preflight requests.
  const handleTest = useCallback(async () => {
    const url = inputUrl.trim().replace(/\/+$/, '');
    if (!url) return;
    setTestStatus('testing');
    try {
      const resp = await fetch(`${url}/anthropic`, {
        method: 'OPTIONS',
        // No body, credentials, or custom headers — plain preflight probe.
      });
      setTestStatus(resp.status >= 200 && resp.status < 300 ? 'success' : 'failed');
    } catch {
      setTestStatus('failed');
    }
  }, [inputUrl]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const url = inputUrl.trim();
    if (!url) return;
    saveProxyConfig({ url });
    setSaveStatus('saved');
    // Reset test status: the saved URL is the source of truth now.
    setTestStatus('idle');
    // Flash "Saved" for 2 s then return to "Save".
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [inputUrl]);

  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    clearProxyConfig();
    setInputUrl('');
    setTestStatus('idle');
    setSaveStatus('idle');
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  // ── Shared input class (matches BackendServerPanel pattern) ────────────────
  const inputBase = [
    'h-9 px-3 rounded-md text-[13px] text-text-primary placeholder:text-text-muted',
    'bg-input border border-border transition-colors duration-fast',
    'focus:outline-none focus:border-border-strong',
    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
  ].join(' ');

  const hasInput = inputUrl.trim().length > 0;

  return (
    <div>
      {/* Section heading */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
        Connection Proxy
      </p>
      {/* One-sentence description */}
      <p className="text-[12px] text-text-muted mb-3">
        Required for built-in providers when using the hosted version. Not needed for local
        dev or custom providers.
      </p>

      {/* URL input + Test button row */}
      <div className="flex gap-2 items-center">
        <input
          id="proxy-url-input"
          type="url"
          value={inputUrl}
          onChange={(e) => {
            setInputUrl(e.target.value);
            // Clear the test status when the URL changes — stale result no longer applies.
            setTestStatus('idle');
          }}
          placeholder="https://your-proxy.workers.dev"
          autoComplete="url"
          aria-label="Proxy URL"
          aria-describedby={
            testStatus === 'success'
              ? 'proxy-test-status'
              : testStatus === 'failed'
                ? 'proxy-test-status'
                : undefined
          }
          className={`${inputBase} flex-1 min-w-0`}
        />
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={!hasInput || testStatus === 'testing'}
          aria-disabled={!hasInput || testStatus === 'testing'}
          className={[
            'h-9 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
            'border border-border bg-hover',
            'text-text-secondary hover:text-text-primary',
            'hover:border-border-strong',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            !hasInput || testStatus === 'testing' ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test'}
        </button>
      </div>

      {/* Test status indicator */}
      {testStatus === 'success' && (
        <p
          id="proxy-test-status"
          role="status"
          aria-live="polite"
          className="mt-1 text-[11px] text-success"
        >
          Connected
        </p>
      )}
      {testStatus === 'failed' && (
        <p
          id="proxy-test-status"
          role="alert"
          className="mt-1 text-[11px] text-error"
        >
          Failed — check the URL and try again
        </p>
      )}

      {/* Save and Clear — only visible when there is input content */}
      {hasInput && (
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={handleSave}
            className={[
              'h-7 px-3 rounded-md text-[12px] font-medium',
              saveStatus === 'saved'
                ? 'text-success bg-success/10 border border-success/30'
                : 'text-text-inverse bg-accent-claude hover:brightness-110',
              'transition-all duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            {saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className={[
              'text-[12px] text-text-muted',
              'hover:text-text-secondary hover:underline',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
            ].join(' ')}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
