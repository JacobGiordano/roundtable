/**
 * TransferSetupPanel — Aria owns this file (/src/ui)
 *
 * "Transfer setup" section for ProviderSettingsPanel (issue #305).
 *
 * Export flow: shows an inline security warning before downloading.
 * Import flow: opens a file picker, validates + applies via Gate, refreshes roster.
 *
 * Gate cross-agent exception: exportSetup, importSetup from @/auth — pure Gate
 * persistence/validation utilities, permitted per CLAUDE.md.
 *
 * Vault cross-agent exception: downloadJSON, readJSONFile from @/storage —
 * browser file I/O primitives exposed for this exact feature.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
// Gate cross-agent exception: setup export/import utilities — permitted per CLAUDE.md.
import { exportSetup, importSetup } from '@/auth';
// Vault cross-agent exception: browser file I/O primitives — permitted per CLAUDE.md.
import { downloadJSON, readJSONFile } from '@/storage';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransferSetupPanelProps {
  /** Called after a successful import so ProviderSettingsPanel can refresh its roster. */
  onRosterRefresh: () => void;
}

// ─── State machines ───────────────────────────────────────────────────────────

/** Export phases: idle → confirm → (download triggers, return to idle) */
type ExportPhase = 'idle' | 'confirm';

/**
 * Import phases:
 *   idle → reading (file picker / FileReader) → success | error
 *   success | error → idle (via Dismiss button)
 */
type ImportPhase = 'idle' | 'reading' | 'success' | 'error';

interface ImportSuccessInfo {
  /**
   * ISO 8601 exportedAt string from the payload — shown in the success notice
   * so the user knows when the file was created (spec §4).
   */
  exportedAt?: string;
}

interface ImportErrorInfo {
  errors: string[];
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Format ISO 8601 timestamp for display, e.g. "Jul 1, 2026, 12:00 PM". */
function formatExportedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransferSetupPanel({ onRosterRefresh }: TransferSetupPanelProps) {
  // ── Export state ────────────────────────────────────────────────────────
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle');

  // ── Import state ────────────────────────────────────────────────────────
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importSuccess, setImportSuccess] = useState<ImportSuccessInfo | null>(null);
  const [importError, setImportError] = useState<ImportErrorInfo | null>(null);

  // ── Refs for focus management ───────────────────────────────────────────
  // Export button — focus returns here after confirm is dismissed.
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  // Cancel button in confirm state — focus moves here when confirm opens (WCAG 2.4.3).
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  // Import button — focus returns here after success/error is dismissed.
  const importBtnRef = useRef<HTMLButtonElement>(null);
  // Success heading — receives programmatic focus when import succeeds.
  const successHeadingRef = useRef<HTMLParagraphElement>(null);
  // Error heading — receives programmatic focus when import fails.
  const errorHeadingRef = useRef<HTMLParagraphElement>(null);

  // ── Export handlers ─────────────────────────────────────────────────────

  const handleExportClick = useCallback(() => {
    setExportPhase('confirm');
  }, []);

  const handleCancelExport = useCallback(() => {
    setExportPhase('idle');
    requestAnimationFrame(() => {
      exportBtnRef.current?.focus();
    });
  }, []);

  const handleConfirmExport = useCallback(() => {
    const payload = exportSetup();
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON(payload, `roundtable-setup-${date}.json`);
    setExportPhase('idle');
    requestAnimationFrame(() => {
      exportBtnRef.current?.focus();
    });
  }, []);

  // Focus Cancel button when confirm opens (WCAG 2.4.3).
  useEffect(() => {
    if (exportPhase === 'confirm') {
      requestAnimationFrame(() => {
        cancelBtnRef.current?.focus();
      });
    }
  }, [exportPhase]);

  // ── Import handlers ─────────────────────────────────────────────────────

  const handleImportClick = useCallback(async () => {
    setImportPhase('reading');
    setImportSuccess(null);
    setImportError(null);

    let data: unknown;
    try {
      data = await readJSONFile();
    } catch (err) {
      // readJSONFile rejects on read/parse failure.
      const msg = err instanceof Error ? err.message : 'Failed to read file.';
      setImportError({ errors: [msg] });
      setImportPhase('error');
      requestAnimationFrame(() => {
        errorHeadingRef.current?.focus();
      });
      return;
    }

    // User cancelled file picker — null resolves, no-op (spec §2).
    if (data === null) {
      setImportPhase('idle');
      return;
    }

    const result = importSetup(data);

    if (result.ok) {
      // Extract exportedAt from the raw parsed data for display.
      const rawData = data as Record<string, unknown>;
      const exportedAt =
        typeof rawData['exportedAt'] === 'string' ? rawData['exportedAt'] : undefined;

      setImportSuccess({ exportedAt });
      setImportPhase('success');
      // Refresh the provider roster so imported custom providers become visible (spec §7).
      onRosterRefresh();
      requestAnimationFrame(() => {
        successHeadingRef.current?.focus();
      });
    } else {
      setImportError({ errors: result.errors });
      setImportPhase('error');
      requestAnimationFrame(() => {
        errorHeadingRef.current?.focus();
      });
    }
  }, [onRosterRefresh]);

  const handleDismissSuccess = useCallback(() => {
    setImportPhase('idle');
    setImportSuccess(null);
    requestAnimationFrame(() => {
      importBtnRef.current?.focus();
    });
  }, []);

  const handleDismissError = useCallback(() => {
    setImportPhase('idle');
    setImportError(null);
    requestAnimationFrame(() => {
      importBtnRef.current?.focus();
    });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/*
        sr-only live region — polite, aria-atomic.
        Announces state transitions to screen readers without interrupting.
        Focus management handles keyboard users; this covers AT users who may
        not receive focus announcements in all contexts.
        Pattern mirrors CustomThemeImport.tsx.
      */}
      <div role="status" aria-atomic="true" className="sr-only">
        {importPhase === 'success'
          ? 'Setup imported successfully.'
          : importPhase === 'error' && importError
            ? `Import failed. ${importError.errors.length} error${importError.errors.length !== 1 ? 's' : ''}.`
            : exportPhase === 'confirm'
              ? 'Security warning: this file will contain your API keys in plain text.'
              : ''}
      </div>

      {/* ── Export sub-section ─────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-[12px] font-medium text-text-secondary mb-1">
          Export setup
        </p>
        <p className="text-[12px] text-text-muted mb-3">
          Download your API keys, custom providers, and preferences as a JSON file to set up Roundtable on another device.
        </p>

        {exportPhase === 'idle' && (
          <button
            ref={exportBtnRef}
            type="button"
            onClick={handleExportClick}
            className={[
              'h-8 px-4 rounded-md text-[12px] font-medium',
              'bg-transparent border border-border text-text-secondary',
              'hover:bg-hover hover:border-border-strong transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Export setup
          </button>
        )}

        {exportPhase === 'confirm' && (
          /*
           * Inline confirm state — Escape cancels the confirm (stops propagation so
           * the panel's document-level Escape handler does not also close the panel).
           * Tab/Shift+Tab cycling is handled by ProviderSettingsPanel's existing
           * focus trap. Focus opens on Cancel (WCAG 2.4.3).
           */
          <div
            className="rounded-md border border-border bg-card"
            style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-warning)' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.nativeEvent.stopImmediatePropagation();
                handleCancelExport();
              }
            }}
          >
            <div className="px-4 pt-3 pb-3">
              <p className="text-[12px] font-semibold text-text-primary mb-1.5">
                Security warning
              </p>
              <p className="text-[12px] text-text-secondary leading-[1.5] mb-3">
                This file will contain your API keys in plain text. Do not share it, email it, or leave it in your Downloads folder.
              </p>
              <div className="flex gap-2">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  data-confirm="true"
                  onClick={handleCancelExport}
                  className={[
                    'h-7 px-3 rounded-md text-[12px] font-medium',
                    'bg-transparent border border-border text-text-secondary',
                    'hover:bg-hover transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-confirm="true"
                  onClick={handleConfirmExport}
                  className={[
                    'h-7 px-3 rounded-md text-[12px] font-medium',
                    'bg-accent-claude text-text-inverse',
                    'hover:brightness-110 transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Confirm download
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Import sub-section ─────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-medium text-text-secondary mb-1">
          Import setup
        </p>
        <p className="text-[12px] text-text-muted mb-3">
          Restore your API keys, custom providers, and preferences from a previously exported file.
        </p>

        {/*
          Import button — aria-disabled while the file picker / FileReader is active.
          Using aria-disabled (not disabled) keeps it keyboard-discoverable.
          onClick guarded against click in reading state to match aria-disabled behavior.
        */}
        <button
          ref={importBtnRef}
          type="button"
          aria-disabled={importPhase === 'reading' ? true : undefined}
          onClick={importPhase !== 'reading' ? handleImportClick : undefined}
          className={[
            'h-8 px-4 rounded-md text-[12px] font-medium',
            'bg-transparent border border-border',
            importPhase === 'reading'
              ? 'text-text-muted opacity-50 cursor-not-allowed'
              : 'text-text-secondary hover:bg-hover hover:border-border-strong',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
          ].join(' ')}
        >
          {importPhase === 'reading' ? 'Reading file…' : 'Import setup'}
        </button>

        {/* ── Success notice ───────────────────────────────────────────── */}
        {importPhase === 'success' && importSuccess && (
          <div
            className="mt-3 rounded-md border border-border bg-card"
            style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-success)' }}
          >
            <div className="px-4 pt-3 pb-3">
              {/*
                tabIndex={-1}: programmatic focus target, not in tab order.
                focus:outline-none: no ring on programmatic focus (tabIndex=-1 pattern).
              */}
              <p
                ref={successHeadingRef}
                tabIndex={-1}
                className="text-[13px] font-semibold text-text-primary mb-1 focus:outline-none"
              >
                Setup imported.
              </p>
              {/* Prominent "delete this file" warning — spec §4 verbatim */}
              <p className="text-[12px] font-semibold text-warning mb-2">
                Delete this file now.
              </p>
              {/* exportedAt from the payload so the user knows which backup this was */}
              {importSuccess.exportedAt && (
                <p className="text-[11px] text-text-muted mb-3">
                  Exported on {formatExportedAt(importSuccess.exportedAt)}
                </p>
              )}
              <button
                type="button"
                onClick={handleDismissSuccess}
                className={[
                  'h-7 px-3 rounded-md text-[11px] font-medium',
                  'bg-transparent border border-border text-text-secondary',
                  'hover:bg-hover transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Error notice ─────────────────────────────────────────────── */}
        {importPhase === 'error' && importError && (
          <div
            className="mt-3 rounded-md border border-border bg-card"
            style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-error)' }}
          >
            <div className="px-4 pt-3 pb-3">
              {/*
                tabIndex={-1}: programmatic focus target, not in tab order.
                focus:outline-none: no ring on programmatic focus (tabIndex=-1 pattern).
              */}
              <p
                ref={errorHeadingRef}
                tabIndex={-1}
                className="text-[13px] font-semibold text-text-primary mb-2 focus:outline-none"
              >
                Import failed.
              </p>
              <ul
                role="list"
                aria-label="Import errors"
                className="list-none m-0 p-0 flex flex-col gap-1.5 mb-3"
              >
                {importError.errors.map((err, i) => (
                  <li key={i} role="listitem" className="flex items-start gap-2">
                    <span
                      className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-error"
                      aria-hidden="true"
                    />
                    <span className="text-[12px] text-text-secondary">{err}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleDismissError}
                className={[
                  'h-7 px-3 rounded-md text-[11px] font-medium',
                  'bg-transparent border border-border text-text-secondary',
                  'hover:bg-hover transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
