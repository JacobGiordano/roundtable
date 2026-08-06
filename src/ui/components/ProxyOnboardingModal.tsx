/**
 * ProxyOnboardingModal — first-run setup guide for the Cloudflare Workers proxy.
 *
 * Shown when the user presses Send with a built-in provider active but no proxy
 * configured, and import.meta.env.PROD is true (GitHub Pages deployment).
 *
 * This is NOT an error state. It is a guided first-run experience —
 * a three-step setup guide that gets the user from "no proxy" to "proxy working"
 * in under two minutes.
 *
 * Flow (issue #586 — copy-paste deploy):
 *   Step 1: Click "Copy proxy code" → script lands on clipboard
 *   Step 2: Click "Open Cloudflare Workers →" → workers.new opens in new tab;
 *           paste code, click Deploy, get Worker URL (~30 seconds)
 *   Step 3: Paste Worker URL into the input field → "Save & continue"
 *
 * Animation (Spark spec):
 *   Entry: scale(0.97) → scale(1) + opacity(0) → opacity(1), 200ms ease-out.
 *   Reduced-motion: no scale/fade — modal appears instantly in final state.
 *   Exit: no exit animation (instant dismiss) — exit animation deferred to Phase 2+.
 *
 * Dialog contract (WCAG 2.1 AA):
 *   - role="dialog" aria-modal="true" aria-labelledby pointing to title
 *   - Focus lands on "Copy proxy code" button on open (double-rAF) — Step 1 is
 *     the first user action; focusing it directs attention correctly.
 *   - Full focus trap — Tab cycles through all interactive elements; Escape dismisses
 *   - Focus returns to the caller-supplied returnFocusRef on close (double-rAF)
 *
 * Save feedback (Spark spec):
 *   - "Save & continue" button text changes to "Saved" instantly on click
 *   - 100ms beat (non-motion pause so user registers the confirmation)
 *   - Then onSaveAndContinue fires (InputBar handles save + send + modal unmount)
 *
 * Copy feedback:
 *   - "Copy proxy code" → "Copied!" instantly on click
 *   - Resets to "Copy proxy code" after 2000ms
 *   - aria-live="polite" region announces the state change to screen readers
 */

import { useState, useRef, useEffect, useId, useCallback } from 'react';

// ?raw import — Vite bundles the proxy script as a plain string at build time.
// The workers/ directory is at the project root (three levels up from this file).
// workers/index.js is ~5.5 kB — included in the lazy-loaded modal chunk.
import proxyCode from '../../../workers/index.js?raw';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CLOUDFLARE_WORKERS_URL = 'https://workers.new';

const SETUP_GUIDE_URL =
  'https://github.com/JacobGiordano/roundtable/blob/main/docs/deployment.md';

// 100ms beat between "Saved" appearing and onSaveAndContinue firing (Spark spec).
const SAVE_FEEDBACK_DELAY_MS = 100;

// 2000ms before copy button resets to idle state.
const COPY_FEEDBACK_RESET_MS = 2000;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ProxyOnboardingModalProps {
  /**
   * Called after the 100ms save-feedback beat. The trimmed proxy URL is passed
   * to the caller; InputBar calls saveProxyConfig(url) and then re-submits the
   * original message before clearing pendingProxySend state.
   */
  onSaveAndContinue: (proxyUrl: string) => void;
  /**
   * Called when the user dismisses without saving ("I'll set this up later").
   * The original message remains in the InputBar textarea — nothing is cleared.
   */
  onDismiss: () => void;
  /**
   * Element to restore focus to after the modal unmounts (double-rAF).
   */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

// ─── ProxyOnboardingModal ──────────────────────────────────────────────────────

export function ProxyOnboardingModal({
  onSaveAndContinue,
  onDismiss,
  returnFocusRef,
}: ProxyOnboardingModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Initial focus target: copy button (Step 1 — the first user action).
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL input state — held locally, passed to onSaveAndContinue on confirm.
  const [proxyUrl, setProxyUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  // Save feedback state per Spark spec: 'idle' → 'saved' → modal unmounts.
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  // Copy feedback state: 'idle' → 'copied' → 'idle' (after 2000ms).
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  // ── Entry animation state (Spark spec) ────────────────────────────────────
  // Detect prefers-reduced-motion once at mount — check is stable for component lifetime.
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  // isVisible drives opacity + scale: starts false (opacity-0 scale-[0.97]) and
  // transitions to true (opacity-100 scale-100) after one rAF. Reduced-motion users
  // start at true — no animation, modal appears instantly in final state.
  const [isVisible, setIsVisible] = useState(prefersReducedMotion);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Trigger entry animation on the frame after mount (non-reduced-motion users).
    if (!prefersReducedMotion) {
      requestAnimationFrame(() => setIsVisible(true));
    }

    // Clean up timers if the component unmounts early.
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus management ───────────────────────────────────────────────────────
  // Focus "Copy proxy code" when the modal mounts (WCAG 2.4.3).
  // Step 1 is the first user action — directing focus there is semantically correct.
  // Double-rAF ensures the DOM has settled after React's render cycle.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => copyButtonRef.current?.focus());
    });

    // Capture returnFocusRef.current at effect-run time so cleanup restores
    // to the element that was focused when the modal opened (not when it closes).
    const returnTarget = returnFocusRef.current;
    return () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          returnTarget?.focus();
        });
      });
    };
  }, [returnFocusRef]);

  // ── URL validation ─────────────────────────────────────────────────────────
  const validateUrl = useCallback((url: string): boolean => {
    if (!url.trim()) {
      setUrlError('Paste your proxy URL here.');
      return false;
    }
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setUrlError('Enter a valid URL (e.g. https://my-name.workers.dev)');
      return false;
    }
    setUrlError('');
    return true;
  }, []);

  // ── Save & continue (Spark spec: text swap → 100ms beat → fire callback) ──
  const handleSave = useCallback(() => {
    if (saveState === 'saved') return; // Prevent double-fire.
    if (!validateUrl(proxyUrl)) return;
    // Step 1: button text → "Saved" instantly.
    setSaveState('saved');
    // Step 2: 100ms beat, then fire the callback (InputBar saves + sends + unmounts).
    saveTimerRef.current = setTimeout(() => {
      onSaveAndContinue(proxyUrl.trim());
    }, SAVE_FEEDBACK_DELAY_MS);
  }, [saveState, proxyUrl, validateUrl, onSaveAndContinue]);

  // ── Copy proxy code ────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (copyState === 'copied') return; // Prevent double-fire during feedback window.
    void navigator.clipboard.writeText(proxyCode).then(() => {
      setCopyState('copied');
      copyTimerRef.current = setTimeout(() => {
        setCopyState('idle');
      }, COPY_FEEDBACK_RESET_MS);
    });
  }, [copyState]);

  // ── Focus trap keydown handler ─────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }

      // Enter on the URL input triggers save.
      if (e.key === 'Enter' && document.activeElement?.tagName === 'INPUT') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (e.key !== 'Tab') return;

      // Focus trap: cycle through all focusable elements in the dialog panel.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      );
      if (!focusable || focusable.length === 0) return;

      const elements = Array.from(focusable);
      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);

      e.preventDefault();
      if (e.shiftKey) {
        const prev = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
        elements[prev]?.focus();
      } else {
        const next = currentIndex >= elements.length - 1 ? 0 : currentIndex + 1;
        elements[next]?.focus();
      }
    },
    [onDismiss, handleSave],
  );

  // ── Shared input class ─────────────────────────────────────────────────────
  const inputBase = [
    'w-full h-9 px-3 rounded-md text-[13px] text-text-primary placeholder:text-text-muted',
    'bg-input border transition-colors duration-fast',
    'focus:outline-none focus:border-border-strong',
    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
  ].join(' ');

  return (
    /* Backdrop — clicking outside the dialog panel = dismiss */
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        // Backdrop fades with the panel (Spark: medium 200ms, reduced-motion: instant)
        prefersReducedMotion ? '' : 'transition-opacity duration-medium ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {/* Dialog panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'bg-card border border-border rounded-lg shadow-lg',
          'max-w-md w-full',
          'flex flex-col gap-5 p-6',
          // Entry animation: opacity + scale (Spark spec: medium 200ms ease-out)
          prefersReducedMotion ? '' : 'transition-[opacity,transform] duration-medium ease-out',
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]',
        ].join(' ')}
        onKeyDown={handleKeyDown}
        // Prevent backdrop click from firing inside panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <h2
          id={titleId}
          className="text-[16px] font-semibold text-text-primary leading-snug"
        >
          Connect your proxy
        </h2>

        {/* ── Steps ───────────────────────────────────────────────────────── */}
        {/* role="list" restores list semantics in VoiceOver/Safari when
            list-style: none removes the default list marker — a known VoiceOver
            quirk. Without it, VoiceOver on Safari announces items without list
            context ("item 1 of 3" becomes absent). Ada advisory #332. */}
        <ol role="list" className="flex flex-col gap-5 list-none" aria-label="Setup steps">

          {/* Step 1 — Copy the proxy code */}
          <li className="flex gap-3">
            <StepNumber n={1} />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary">
                Copy the proxy code
              </p>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                Click Copy to put the proxy script on your clipboard.
              </p>
              {/* aria-live region announces copy state change to screen readers.
                  aria-atomic ensures the full string is announced, not a diff.
                  Ada advisory #586. */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {copyState === 'copied' ? 'Copied to clipboard.' : ''}
              </div>
              <button
                ref={copyButtonRef}
                type="button"
                onClick={handleCopy}
                aria-label={
                  copyState === 'copied'
                    ? 'Proxy code copied to clipboard'
                    : 'Copy proxy code to clipboard'
                }
                className={[
                  'flex items-center justify-center w-full',
                  'px-4 py-2.5 rounded-md',
                  'text-[14px] font-semibold',
                  copyState === 'copied'
                    ? 'bg-success/10 text-success border border-success/30 cursor-default'
                    : 'bg-accent-claude text-text-inverse hover:opacity-90 active:opacity-80 transition-opacity duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {copyState === 'copied' ? 'Copied!' : 'Copy proxy code'}
              </button>
            </div>
          </li>

          {/* Step 2 — Open Cloudflare Workers */}
          <li className="flex gap-3">
            <StepNumber n={2} />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary">
                Open Cloudflare Workers
              </p>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                Select all (Ctrl+A), paste, click Go to apply the code, then click Deploy. Takes about 30 seconds.
              </p>
              {/* Primary external action — full-width, group for arrow nudge (Spark spec).
                  aria-label includes "(opens in new tab)" so screen reader users
                  know the link opens a new browser context. Ada advisory #332. */}
              <a
                href={CLOUDFLARE_WORKERS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Cloudflare Workers (opens in new tab)"
                className={[
                  'group flex items-center justify-center w-full',
                  'px-4 py-2.5 rounded-md',
                  'text-[14px] font-semibold text-text-inverse bg-accent-claude',
                  'hover:opacity-90 active:opacity-80',
                  'transition-opacity duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                ].join(' ')}
              >
                Open Cloudflare Workers
                {/* Arrow nudges right on hover (Spark spec: translate-x-0.5 at fast 100ms) */}
                <span
                  className={[
                    'ml-1.5',
                    'transition-transform duration-fast ease-out',
                    'group-hover:translate-x-0.5',
                    // Reduced-motion: no translate on arrow
                    'motion-reduce:transition-none motion-reduce:group-hover:translate-x-0',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  →
                </span>
              </a>
            </div>
          </li>

          {/* Step 3 — Paste your Worker URL */}
          <li className="flex gap-3">
            <StepNumber n={3} />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary">
                Paste your Worker URL
              </p>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                After deploying, copy the URL from the Cloudflare dashboard and paste it here.
              </p>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <input
                    type="url"
                    value={proxyUrl}
                    onChange={(e) => {
                      setProxyUrl(e.target.value);
                      if (urlError) setUrlError('');
                    }}
                    placeholder="https://your-name.workers.dev"
                    autoComplete="url"
                    aria-label="Proxy URL"
                    aria-invalid={urlError ? true : undefined}
                    aria-describedby={urlError ? 'proxy-onboarding-url-error' : undefined}
                    className={[inputBase, urlError ? 'border-error' : 'border-border'].join(' ')}
                  />
                  {/* Error: instant appearance (Spark spec: not a motion moment) */}
                  {urlError && (
                    <p
                      id="proxy-onboarding-url-error"
                      role="alert"
                      className="mt-1 text-[11px] text-error"
                    >
                      {urlError}
                    </p>
                  )}
                </div>
                {/* Save & continue — text swaps to "Saved", then 100ms beat (Spark spec).
                    aria-disabled only (no native disabled) — native disabled drops focus
                    to document.body; aria-disabled keeps focus on the button during the
                    100ms beat so AT can announce the state change. Click handler guards
                    against double-fire via saveState check. Ada advisory #332. */}
                <button
                  type="button"
                  onClick={handleSave}
                  aria-disabled={saveState === 'saved'}
                  className={[
                    'h-9 px-3 rounded-md text-[13px] font-semibold flex-shrink-0',
                    saveState === 'saved'
                      ? 'bg-success/10 text-success border border-success/30 cursor-default'
                      : 'bg-accent-claude text-text-inverse hover:brightness-110 active:brightness-90 active:scale-[0.97] transition-[filter,transform] duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                  ].join(' ')}
                >
                  {saveState === 'saved' ? 'Saved' : 'Save & continue'}
                </button>
              </div>
            </div>
          </li>
        </ol>

        {/* ── Security note (Spark: "just" not "only") ─────────────────────── */}
        <p className="text-[11px] text-text-muted leading-relaxed border-t border-border pt-4">
          Your API keys go directly from your browser to the AI provider. The proxy just
          handles CORS — it never sees your keys.
        </p>

        {/* ── Full setup guide link — escape hatch for users who get stuck ── */}
        {/* Opens deployment.md in a new tab. Visually quiet: text-text-muted, small.
            WCAG 1.4.1: underline present at rest (not color alone) satisfies the
            two-cue requirement. hover:decoration-2 provides a distinct hover affordance
            while keeping the resting style subdued. aria-label includes "(opens in new tab)". */}
        <div className="flex justify-center">
          <a
            href={SETUP_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Full setup guide (opens in new tab)"
            className={[
              'text-[12px] text-text-muted underline',
              'underline-offset-2',
              'hover:text-text-secondary hover:decoration-2',
              'focus:outline-none',
              'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:rounded-sm',
            ].join(' ')}
          >
            Full setup guide →
          </a>
        </div>

        {/* ── Dismiss link (Spark: py-2 px-2, quiet, no underline at rest) ── */}
        <div className="flex justify-center -mt-1">
          <button
            type="button"
            onClick={onDismiss}
            className={[
              'py-2 px-2 rounded',
              'text-[13px] text-text-muted',
              'hover:text-text-secondary',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            I'll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── StepNumber ────────────────────────────────────────────────────────────────
// Spark spec: w-6 h-6, rounded-full, bg-hover, text-text-muted, aria-hidden.

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'w-6 h-6 flex-shrink-0 rounded-full',
        'flex items-center justify-center',
        'text-[11px] font-medium',
        'bg-hover text-text-muted',
        'mt-0.5', // optical alignment with the adjacent text baseline
      ].join(' ')}
    >
      {n}
    </span>
  );
}
