/**
 * CustomThemeImport — Aria owns this file (/src/ui)
 *
 * Custom theme JSON file import widget for the Appearance section of the
 * Provider Settings Panel. Implements Luma's spec at:
 *   /_design/specs/custom-theme-import.md
 *
 * Gate API used (cross-agent permitted via @/auth index):
 *   validateCustomTheme  — Gate schema validator (themeValidation.ts)
 *   saveCustomTheme      — Gate persistence (auth/theme.ts)
 *   getActiveTheme       — Gate active-theme reader (auth/theme.ts)
 *
 * State machine:  Idle → Validating → Rejected | Applied
 *                 Rejected → Idle ("Try again")
 *                 Applied  → Idle ("Change")
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CustomThemeJSON } from '@/types';
// Gate cross-agent exception: validateCustomTheme, saveCustomTheme, getActiveTheme are
// pure Gate persistence/validation utilities — permitted per CLAUDE.md.
import { validateCustomTheme, saveCustomTheme, getActiveTheme } from '@/auth';
import type { ValidationResult } from '@/auth';
// applyTheme is in this same /src/ui directory — permitted.
import { applyTheme } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportState = 'idle' | 'validating' | 'rejected' | 'applied';

interface RejectedInfo {
  fileName: string;
  errors: Array<{ field: string; message: string }>;
  /** When true, the rejection came from saveCustomTheme() throwing — heading differs. */
  isSaveError?: boolean;
}

interface AppliedInfo {
  themeName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB

// ─── Inline SVGs (spec-required sizes, no emoji) ─────────────────────────────

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mb-1"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 12 15 16 9" />
    </svg>
  );
}

// ─── Spinner (spec: 20×20, accent-claude stroke, linear infinite) ─────────────

function Spinner() {
  return (
    // prefers-reduced-motion: spinner is replaced in parent when motion is reduced
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="text-accent-claude animate-spin"
      style={{ animationDuration: 'var(--timing-slow)', animationTimingFunction: 'linear' }}
    >
      <circle cx="12" cy="12" r="10" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" className="opacity-100" />
    </svg>
  );
}

// ─── Utility: truncate file name ──────────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomThemeImport() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [importState, setImportState] = useState<ImportState>(() => {
    const active = getActiveTheme();
    return active.source === 'custom' ? 'applied' : 'idle';
  });

  const [validatingFileName, setValidatingFileName] = useState('');
  const [rejectedInfo, setRejectedInfo] = useState<RejectedInfo | null>(null);
  const [appliedInfo, setAppliedInfo] = useState<AppliedInfo | null>(() => {
    const active = getActiveTheme();
    if (active.source === 'custom') return { themeName: active.name };
    return null;
  });

  // Detect prefers-reduced-motion (spec: instant transitions + static dots instead of spinner).
  // Guard with typeof window.matchMedia check — jsdom does not implement matchMedia.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Refs for focus management ───────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateContainerRef = useRef<HTMLDivElement>(null);
  const rejectedHeadingRef = useRef<HTMLParagraphElement>(null);
  const appliedHeadingRef = useRef<HTMLParagraphElement>(null);
  const chooseFileBtnRef = useRef<HTMLButtonElement>(null);

  // ── File processing ─────────────────────────────────────────────────────────

  const processFileAsync = useCallback(async (file: File) => {
    const fileName = file.name;

    // File size guard — no spinner for oversized files (spec §9)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setRejectedInfo({
        fileName,
        errors: [
          {
            field: 'root',
            message: 'File is too large (max 512 KB). Theme JSON files should be under 5 KB.',
          },
        ],
      });
      setImportState('rejected');
      // Focus rejected heading
      requestAnimationFrame(() => {
        rejectedHeadingRef.current?.focus();
      });
      return;
    }

    // Transition to Validating — focus state container while spinner shows
    setValidatingFileName(fileName);
    setImportState('validating');
    requestAnimationFrame(() => {
      stateContainerRef.current?.focus();
    });

    // Read file text then run validation in the next rAF so Validating state renders first
    let text: string;
    try {
      text = await file.text();
    } catch {
      requestAnimationFrame(() => {
        setRejectedInfo({
          fileName,
          errors: [{ field: 'root', message: 'Could not read file.' }],
        });
        setImportState('rejected');
        requestAnimationFrame(() => {
          rejectedHeadingRef.current?.focus();
        });
      });
      return;
    }

    requestAnimationFrame(() => {
      // Empty file guard
      if (!text.trim()) {
        setRejectedInfo({
          fileName,
          errors: [{ field: 'root', message: 'File is empty.' }],
        });
        setImportState('rejected');
        requestAnimationFrame(() => {
          rejectedHeadingRef.current?.focus();
        });
        return;
      }

      // JSON parse
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setRejectedInfo({
          fileName,
          errors: [
            { field: 'root', message: 'File is not valid JSON. Check for syntax errors.' },
          ],
        });
        setImportState('rejected');
        requestAnimationFrame(() => {
          rejectedHeadingRef.current?.focus();
        });
        return;
      }

      // Schema validation via Gate
      const result: ValidationResult = validateCustomTheme(parsed);
      if (!result.valid) {
        setRejectedInfo({ fileName, errors: result.errors });
        setImportState('rejected');
        requestAnimationFrame(() => {
          rejectedHeadingRef.current?.focus();
        });
        return;
      }

      // Valid — save and apply
      const theme = parsed as CustomThemeJSON;
      try {
        saveCustomTheme(theme);
        applyTheme(theme);
      } catch {
        setRejectedInfo({
          fileName,
          errors: [
            {
              field: 'root',
              message: "Failed to save theme. Check your browser's storage settings.",
            },
          ],
          isSaveError: true,
        });
        setImportState('rejected');
        requestAnimationFrame(() => {
          rejectedHeadingRef.current?.focus();
        });
        return;
      }

      setAppliedInfo({ themeName: theme.name });
      setImportState('applied');
      requestAnimationFrame(() => {
        appliedHeadingRef.current?.focus();
      });
    });
  }, []);

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFileAsync(file);
      // Reset input so same file can be re-selected after correction
      e.target.value = '';
    },
    [processFileAsync],
  );

  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      processFileAsync(file);
    },
    [processFileAsync],
  );

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleTryAgain = useCallback(() => {
    setRejectedInfo(null);
    setValidatingFileName('');
    setImportState('idle');
    // Reset file input so same file can be chosen again
    if (fileInputRef.current) fileInputRef.current.value = '';
    requestAnimationFrame(() => {
      chooseFileBtnRef.current?.focus();
    });
  }, []);

  const handleChange = useCallback(() => {
    setAppliedInfo(null);
    setImportState('idle');
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
    requestAnimationFrame(() => {
      chooseFileBtnRef.current?.focus();
    });
  }, []);

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ── Transition class helpers ────────────────────────────────────────────────

  const transitionDuration = prefersReducedMotion ? 'duration-instant' : 'duration-fast';

  // ── Rendered error count text ──────────────────────────────────────────────

  function errorCountText(n: number): string {
    return n === 1 ? '1 issue found:' : `${n} issues found:`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Hidden file input — remains in accessibility tree per spec §6 */}
      <input
        ref={fileInputRef}
        id="theme-file-input"
        type="file"
        accept=".json,application/json"
        aria-label="Select a custom theme JSON file"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/*
        Visually-hidden live region for screen reader announcements
        (spec §6 — ARIA Roles and Live Regions). Using aria-live="polite"
        without role="status" to avoid query conflicts with the TestButton
        sr-only live region in the existing Ada test suite. aria-atomic="true"
        ensures the whole announcement text is read together.
      */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {importState === 'rejected' && rejectedInfo
          ? `Theme validation failed. ${errorCountText(rejectedInfo.errors.length)}`
          : importState === 'applied' && appliedInfo
            ? `Theme applied: ${appliedInfo.themeName}.`
            : ''}
      </div>

      {/*
        Visible state container — plain div, no ARIA role.
        tabIndex={-1} allows programmatic focus; no ring (tabIndex=-1 pattern).
      */}
      <div
        ref={stateContainerRef}
        tabIndex={-1}
        className="focus:outline-none"
      >
        {/* ── Idle State ───────────────────────────────────────────────────── */}
        {importState === 'idle' && (
          /*
           * Drop zone: drag events handled here, but NOT role="button" to avoid
           * WCAG "nested-interactive" violation — the <button> inside is the sole
           * interactive element in the tab order. The zone is a visual affordance
           * only; drag-and-drop semantics don't require role="button" on the wrapper.
           */
          <div
            aria-label="Drop zone for theme JSON file. Drag a file here or use the button below."
            onDrop={handleDropZoneDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragLeave}
            className={[
              'w-full h-[120px] flex flex-col items-center justify-center gap-2',
              'rounded-md border border-dashed',
              `transition-colors ${transitionDuration}`,
              isDragOver
                ? 'bg-hover border-border-strong border-solid'
                : 'bg-input border-border',
            ].join(' ')}
          >
            <span className="text-text-muted pointer-events-none">
              <UploadIcon />
            </span>

            {/* "Choose a file" — the sole interactive element in this zone */}
            <button
              ref={chooseFileBtnRef}
              type="button"
              aria-controls="theme-file-input"
              onClick={handleChooseFile}
              className={[
                'text-[13px] font-medium text-text-secondary bg-transparent border-0 p-0 cursor-pointer',
                `hover:text-text-primary hover:underline transition-colors ${transitionDuration}`,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 rounded-sm',
              ].join(' ')}
            >
              Choose a file
            </button>

            <p className="text-[12px] font-normal text-text-muted pointer-events-none">
              or drag and drop a JSON file here
            </p>
          </div>
        )}

        {/* ── Validating State ─────────────────────────────────────────────── */}
        {importState === 'validating' && (
          <div
            className={[
              'w-full h-[120px] flex flex-col items-center justify-center gap-2',
              'bg-input border border-border rounded-md',
            ].join(' ')}
          >
            {prefersReducedMotion ? (
              <span className="text-[13px] text-text-muted">...</span>
            ) : (
              <Spinner />
            )}
            <p className="text-[13px] font-normal text-text-muted">Validating theme...</p>
            <p className="text-[11px] text-text-muted">
              {truncate(validatingFileName, 32)}
            </p>
          </div>
        )}

        {/* ── Rejected State ───────────────────────────────────────────────── */}
        {importState === 'rejected' && rejectedInfo && (
          <div
            className={[
              'w-full bg-card border border-border rounded-md',
              `transition-all ${prefersReducedMotion ? 'duration-instant' : 'duration-medium'}`,
            ].join(' ')}
            style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-error)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <span className="text-error flex-shrink-0">
                <ErrorCircleIcon />
              </span>
              <p
                ref={rejectedHeadingRef}
                tabIndex={-1}
                className="text-[13px] font-semibold text-text-primary focus:outline-none"
              >
                {rejectedInfo.isSaveError ? 'Save failed' : 'Theme validation failed'}
              </p>
              <span className="ml-auto text-[11px] text-text-muted text-right flex-shrink-0">
                {truncate(rejectedInfo.fileName, 24)}
              </span>
            </div>

            {/* Error list */}
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium text-text-muted mb-2">
                {errorCountText(rejectedInfo.errors.length)}
              </p>
              <ul
                role="list"
                aria-label={rejectedInfo.errors.length > 16 ? 'Validation errors' : undefined}
                tabIndex={rejectedInfo.errors.length > 16 ? 0 : undefined}
                className={[
                  'list-none m-0 p-0 flex flex-col gap-1.5',
                  rejectedInfo.errors.length > 16
                    ? 'max-h-[240px] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded-sm'
                    : '',
                ].join(' ')}
              >
                {rejectedInfo.errors.map((err, i) => (
                  <li key={i} role="listitem" className="flex items-start gap-2">
                    <span
                      className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-error"
                      aria-hidden="true"
                    />
                    <span className="text-[12px] text-text-secondary">
                      <span className="font-semibold font-mono">{err.field}</span>
                      {err.field ? ': ' : ''}
                      <span className="font-normal">{err.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-t border-border-subtle">
              <p className="text-[11px] font-normal text-text-muted">
                Fix the issues above in your JSON file and try again.
              </p>
              <button
                type="button"
                data-confirm="true"
                aria-label="Try again — choose a new theme file"
                onClick={handleTryAgain}
                className={[
                  'h-8 px-4 rounded-md text-[12px] font-medium flex-shrink-0 ml-4',
                  'bg-transparent border border-border text-text-secondary',
                  `hover:bg-hover hover:border-border-strong active:brightness-90 transition-colors ${transitionDuration}`,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                ].join(' ')}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Applied State ────────────────────────────────────────────────── */}
        {importState === 'applied' && appliedInfo && (
          <div
            className={[
              'w-full h-20 flex items-center px-4 gap-3',
              'bg-card border border-border rounded-md',
              `transition-all ${prefersReducedMotion ? 'duration-instant' : 'duration-medium'}`,
            ].join(' ')}
            style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-success)' }}
          >
            <span className="text-success flex-shrink-0">
              <CheckCircleIcon />
            </span>

            <div className="flex-1 min-w-0">
              <p
                ref={appliedHeadingRef}
                tabIndex={-1}
                className="text-[14px] font-semibold text-text-primary focus:outline-none"
              >
                Theme applied
              </p>
              <p className="text-[12px] font-normal text-text-muted mt-0.5 truncate">
                {appliedInfo.themeName.length > 40
                  ? appliedInfo.themeName.slice(0, 39) + '…'
                  : appliedInfo.themeName}
              </p>
            </div>

            <button
              type="button"
              aria-label="Change custom theme"
              onClick={handleChange}
              className={[
                'h-7 px-3 rounded-md text-[11px] font-medium flex-shrink-0',
                'bg-transparent border border-border text-text-secondary',
                `hover:bg-hover hover:border-border-strong active:brightness-90 transition-colors ${transitionDuration}`,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              ].join(' ')}
            >
              Change
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
