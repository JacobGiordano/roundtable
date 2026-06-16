/**
 * Gate — ApiKeyPanel.tsx
 *
 * Settings UI for entering, masking, and clearing API keys.
 * This component is self-contained — it calls useCredentials() directly.
 * Aria mounts this panel wherever the settings drawer/modal lives.
 *
 * Styling: Tailwind utility classes only — no inline styles, no CSS modules.
 */

import { useState, useRef } from 'react';
import type { CredentialKey } from '@/types';
import { CREDENTIAL_LABELS } from './credentials';
import { useCredentials } from './useCredentials';

// ─── Missing-key warning ──────────────────────────────────────────────────────

interface MissingKeyWarningProps {
  providerName: string;
}

function MissingKeyWarning({ providerName }: MissingKeyWarningProps) {
  return (
    <p
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-[12px] text-warning"
    >
      {/* Warning icon */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <path
          d="M6 1.5L10.5 9.5H1.5L6 1.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M6 5V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6" cy="8.5" r="0.5" fill="currentColor" />
      </svg>
      {providerName} key required to activate this model
    </p>
  );
}

// ─── Single key row ───────────────────────────────────────────────────────────

interface ApiKeyRowProps {
  credentialKey: CredentialKey;
  isSet: boolean;
  /** Raised when this key is required but not set (e.g. model is active). */
  showWarning?: boolean;
  onSave: (key: CredentialKey, value: string) => void;
  onClear: (key: CredentialKey) => void;
}

function ApiKeyRow({ credentialKey, isSet, showWarning = false, onSave, onClear }: ApiKeyRowProps) {
  const meta = CREDENTIAL_LABELS[credentialKey];
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(!isSet);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(credentialKey, trimmed);
    setDraft('');
    setEditing(false);
    setRevealed(false);
  };

  const handleClear = () => {
    onClear(credentialKey);
    setDraft('');
    setEditing(true);
    setRevealed(false);
  };

  const handleEdit = () => {
    setEditing(true);
    setDraft('');
    // Focus the input on next tick after it mounts
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setDraft('');
      if (isSet) setEditing(false);
    }
  };

  const rowId = `api-key-${credentialKey}`;
  const inputId = `${rowId}-input`;

  return (
    <div className="py-3 border-b border-border-subtle last:border-0">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={editing ? inputId : undefined}
          className="text-[13px] font-medium text-text-primary"
        >
          {meta.provider}
        </label>

        {isSet && !editing && (
          <span className="flex items-center gap-1 text-[11px] text-success">
            {/* Check icon */}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path
                d="M2 5.5L4.5 8L9 3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Key entry / masked display */}
      {editing ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id={inputId}
              type={revealed ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={meta.placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`${meta.provider} API key`}
              className={[
                'w-full h-8 px-3 pr-8 rounded-md text-[13px] font-mono',
                'bg-input text-text-primary placeholder:text-text-muted',
                'border border-border focus:border-border-strong',
                'outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                'transition-colors duration-fast',
              ].join(' ')}
            />
            {/* Reveal/hide toggle */}
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide key' : 'Show key'}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors duration-fast"
            >
              {revealed ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7C1 7 3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7C1 7 3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim()}
            className={[
              'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
              'bg-hover text-text-primary border border-border',
              'hover:border-border-strong',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Save
          </button>

          {isSet && (
            <button
              type="button"
              onClick={() => { setDraft(''); setEditing(false); }}
              className={[
                'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
                'text-text-muted border border-border',
                'hover:text-text-secondary hover:border-border-strong',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        /* Masked display when key is saved */
        <div className="flex items-center gap-2">
          <div
            className={[
              'flex-1 h-8 px-3 flex items-center',
              'bg-input rounded-md border border-border',
              'text-[13px] font-mono text-text-muted',
            ].join(' ')}
            aria-label={`${meta.provider} API key — saved and masked`}
          >
            ••••••••••••••••
          </div>

          <button
            type="button"
            onClick={handleEdit}
            className={[
              'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
              'text-text-secondary border border-border',
              'hover:text-text-primary hover:border-border-strong',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Change
          </button>

          <button
            type="button"
            onClick={handleClear}
            aria-label={`Clear ${meta.provider} API key`}
            className={[
              'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
              'text-error border border-border',
              'hover:border-error/50',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Clear
          </button>
        </div>
      )}

      {/* Get key link */}
      <p className="mt-1.5 text-[11px] text-text-muted">
        <a
          href={meta.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-text-secondary transition-colors duration-fast"
        >
          Get your {meta.provider} API key
        </a>
      </p>

      {/* Missing-key warning — only shown when the caller signals a required key is absent */}
      {showWarning && !isSet && <MissingKeyWarning providerName={meta.provider} />}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/** Keys that have an active model needing them — passed in by the caller (Aria). */
export interface ApiKeyPanelProps {
  /**
   * Set of CredentialKeys currently required by at least one active model.
   * The panel shows a warning for any required key that is not yet set.
   */
  requiredKeys?: CredentialKey[];
}

/**
 * Self-contained settings panel for managing API keys.
 * Mount this wherever settings are shown (modal, drawer, settings page).
 *
 * Props:
 *   requiredKeys — CredentialKeys needed by currently active models.
 *                  Panel shows a warning for any required key that is missing.
 */
export function ApiKeyPanel({ requiredKeys = [] }: ApiKeyPanelProps) {
  const { status, save, clear } = useCredentials();

  /**
   * Derived from CREDENTIAL_LABELS so adding a 7th built-in provider only
   * requires a new entry in credentials.ts — no changes needed here.
   */
  const KEYS: CredentialKey[] = Object.keys(CREDENTIAL_LABELS) as CredentialKey[];

  return (
    <section aria-labelledby="api-keys-heading" className="w-full">
      <h2
        id="api-keys-heading"
        className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-1 px-1"
      >
        API Keys
      </h2>

      <p className="text-[12px] text-text-muted mb-3 px-1 leading-relaxed">
        Keys are stored locally in your browser and never leave your device.
      </p>

      <div className="rounded-lg border border-border bg-card px-4">
        {KEYS.map((key) => (
          <ApiKeyRow
            key={key}
            credentialKey={key}
            isSet={status[key].isSet}
            showWarning={requiredKeys.includes(key)}
            onSave={save}
            onClear={clear}
          />
        ))}
      </div>
    </section>
  );
}
