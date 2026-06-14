import { useState, useEffect, useRef, useCallback } from 'react';
import type { BuiltInModelId, ProviderConfig, BuiltInProviderConfig } from '@/types';
// Gate cross-agent exception: provider roster CRUD functions and credential
// helpers are pure Gate persistence utilities — permitted per CLAUDE.md.
import {
  getProviderRoster,
  addBuiltInProvider,
  addCustomProvider,
  removeProvider,
  hasCredential,
  saveCredentials,
  clearCredentials,
} from '@/auth';

// ─── Built-in model metadata ───────────────────────────────────────────────────

/**
 * Static display metadata for the six built-in providers.
 * Used to render chips for un-configured built-ins and to look up
 * display names and accent tokens for configured built-in rows.
 *
 * Rather than importing MODEL_REGISTRY (which pulls in all provider
 * implementations from @/models), we maintain a minimal local copy of the
 * three fields needed here. This keeps ProviderSettingsPanel free of Atlas
 * runtime dependencies and avoids crossing the agent boundary for data we own
 * the display interpretation of.
 */
const BUILTIN_META: Record<BuiltInModelId, { name: string; color: string }> = {
  'claude':    { name: 'Claude',    color: 'accent-claude' },
  'gpt-5.5':  { name: 'GPT-5.5',   color: 'accent-gpt' },
  'gemini':   { name: 'Gemini',    color: 'accent-gemini' },
  'grok':     { name: 'Grok',      color: 'accent-grok' },
  'deepseek': { name: 'DeepSeek',  color: 'accent-deepseek' },
  'mistral':  { name: 'Mistral',   color: 'accent-mistral' },
};

const ALL_BUILTIN_IDS: BuiltInModelId[] = [
  'claude', 'gpt-5.5', 'gemini', 'grok', 'deepseek', 'mistral',
];

// ─── Provider helpers ─────────────────────────────────────────────────────────

function getProviderDotColor(provider: ProviderConfig): string {
  if (provider.kind === 'builtin') {
    return `var(--${BUILTIN_META[provider.modelId].color})`;
  }
  return provider.color ? provider.color : 'var(--accent-other)';
}

function getProviderName(provider: ProviderConfig): string {
  if (provider.kind === 'builtin') {
    return BUILTIN_META[provider.modelId].name;
  }
  return provider.displayName;
}

function getProviderId(provider: ProviderConfig): string {
  if (provider.kind === 'builtin') return provider.modelId;
  return provider.id;
}

// ─── API key status badge ─────────────────────────────────────────────────────

type BadgeState = 'key-set' | 'no-key' | 'no-key-required';

function getBadgeState(provider: ProviderConfig): BadgeState {
  if (provider.kind === 'builtin') {
    return hasCredential(provider.credentialKey) ? 'key-set' : 'no-key';
  }
  if (!provider.credentialKey) return 'no-key-required';
  return hasCredential(provider.credentialKey) ? 'key-set' : 'no-key';
}

function ApiKeyBadge({ state }: { state: BadgeState }) {
  if (state === 'key-set') {
    return (
      <span className="text-[11px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5 flex-shrink-0">
        Key set
      </span>
    );
  }
  if (state === 'no-key') {
    return (
      <span className="text-[11px] font-medium text-warning bg-warning/10 rounded-full px-2 py-0.5 flex-shrink-0">
        No key
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-text-muted bg-hover rounded-full px-2 py-0.5 flex-shrink-0">
      No key required
    </span>
  );
}

// ─── Provider row ─────────────────────────────────────────────────────────────

type RowConfirmState = 'idle' | 'confirm-remove' | 'confirm-remove-last';

interface ProviderRowProps {
  provider: ProviderConfig;
  isLast: boolean;
  onRemoved: () => void;
  isNew?: boolean;
}

function ProviderRow({ provider, isLast, onRemoved, isNew = false }: ProviderRowProps) {
  const [confirmState, setConfirmState] = useState<RowConfirmState>('idle');
  const [isRemoving, setIsRemoving] = useState(false);

  // ── Inline key editor state ────────────────────────────────────────────────
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const name = getProviderName(provider);
  const id = getProviderId(provider);
  const dotColor = getProviderDotColor(provider);

  // The credential key for this provider (undefined means keyless).
  const credentialKey: string | undefined =
    provider.kind === 'builtin' ? provider.credentialKey : provider.credentialKey;

  // Badge state is stored in component state so it can be refreshed after a
  // save/clear without relying on a prop update from the parent.
  const [badgeState, setBadgeState] = useState<BadgeState>(() => getBadgeState(provider));

  // Open the inline key editor and move focus to the input.
  const handleOpenKeyEditor = useCallback(() => {
    setIsEditingKey(true);
    setKeyInputValue('');
    setShowKeyInput(false);
    requestAnimationFrame(() => {
      keyInputRef.current?.focus();
    });
  }, []);

  // Close the inline editor without saving.
  const handleCancelKeyEdit = useCallback(() => {
    setIsEditingKey(false);
    setKeyInputValue('');
    setShowKeyInput(false);
  }, []);

  // Save the new key and close the editor.
  const handleSaveKey = useCallback(() => {
    if (!credentialKey || !keyInputValue.trim()) return;
    saveCredentials(credentialKey, keyInputValue.trim());
    setIsEditingKey(false);
    setKeyInputValue('');
    setShowKeyInput(false);
    setBadgeState(getBadgeState(provider));
  }, [credentialKey, keyInputValue, provider]);

  // Clear the stored key and close the editor.
  const handleClearKey = useCallback(() => {
    if (!credentialKey) return;
    clearCredentials(credentialKey);
    setIsEditingKey(false);
    setKeyInputValue('');
    setShowKeyInput(false);
    setBadgeState(getBadgeState(provider));
  }, [credentialKey, provider]);

  const handleRemoveClick = useCallback(() => {
    setConfirmState(isLast ? 'confirm-remove-last' : 'confirm-remove');
  }, [isLast]);

  const handleCancel = useCallback(() => {
    setConfirmState('idle');
  }, []);

  const handleConfirmRemove = useCallback(() => {
    setIsRemoving(true);
    setTimeout(() => {
      removeProvider(id);
      onRemoved();
    }, 200);
  }, [id, onRemoved]);

  const rowStyle: React.CSSProperties = isRemoving
    ? { height: 0, opacity: 0, transition: 'height 200ms ease-in, opacity 100ms ease-in', overflow: 'hidden' }
    : { overflow: 'hidden' };

  const enterStyle: React.CSSProperties = isNew
    ? { animation: 'provider-enter 200ms ease-out' }
    : {};

  // Edit affordance button — only when credentialKey is defined and not in remove-confirm.
  const editButtonLabel =
    badgeState === 'key-set' ? `Edit API key for ${name}` : `Set API key for ${name}`;
  const editButtonText = badgeState === 'key-set' ? 'Edit' : 'Set key';
  const showEditButton = badgeState !== 'no-key-required' && credentialKey !== undefined;

  return (
    // aria-live="polite" lets screen readers announce confirmation message on row update.
    <div role="listitem" aria-live="polite" style={{ ...rowStyle, ...enterStyle }}>
      {confirmState === 'idle' ? (
        <div
          className={[
            'px-3 rounded-md',
            'bg-card border border-border',
            'hover:bg-hover hover:border-border-strong',
            'transition-colors duration-fast',
          ].join(' ')}
        >
          {/* ── Main row ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 h-12">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
              aria-hidden="true"
            />
            <span className="flex-1 text-[14px] font-medium text-text-primary truncate min-w-0">
              {name}
            </span>
            <ApiKeyBadge state={badgeState} />
            {showEditButton && !isEditingKey && (
              <button
                type="button"
                aria-label={editButtonLabel}
                onClick={handleOpenKeyEditor}
                className={[
                  'ml-2 text-[11px] text-text-muted underline cursor-pointer',
                  'hover:text-text-secondary bg-transparent border-0 p-0',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
                  'transition-colors duration-fast',
                ].join(' ')}
              >
                {editButtonText}
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={handleRemoveClick}
              className={[
                'w-7 h-7 flex items-center justify-center rounded-sm flex-shrink-0 ml-2',
                'bg-transparent text-text-muted',
                'hover:bg-hover hover:text-error',
                'transition-all duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              {/* Trash icon — 14px */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 3.5h10M5.5 3.5V2.5h3V3.5M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* ── Inline key editor (expands below row) ─────────────────── */}
          {isEditingKey && (
            <div className="mt-2 pb-3">
              {/* Password input with show/hide toggle */}
              <div className="relative flex items-center">
                <input
                  ref={keyInputRef}
                  id={`key-input-${id}`}
                  type={showKeyInput ? 'text' : 'password'}
                  aria-label="New API key"
                  value={keyInputValue}
                  onChange={(e) => setKeyInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && keyInputValue.trim()) handleSaveKey();
                    if (e.key === 'Escape') handleCancelKeyEdit();
                  }}
                  placeholder="Enter new API key"
                  className={[
                    'flex-1 h-9 rounded-md text-[13px] text-text-primary placeholder:text-text-muted',
                    'bg-input border border-border',
                    'focus:outline-none focus:border-border-strong',
                    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    'transition-colors duration-fast',
                  ].join(' ')}
                  style={{ paddingLeft: '10px', paddingRight: '36px' }}
                />
                {/* Eye toggle */}
                <button
                  type="button"
                  aria-label={showKeyInput ? 'Hide API key' : 'Show API key'}
                  onClick={() => setShowKeyInput((v) => !v)}
                  className={[
                    'absolute right-3 top-1/2 -translate-y-1/2',
                    'text-text-muted hover:text-text-secondary',
                    'transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
                  ].join(' ')}
                >
                  {showKeyInput ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M1.5 1.5l11 11M6.07 6.08A2 2 0 0 0 7 9a2 2 0 0 0 1.93-1.93M2.5 4.5A9.7 9.7 0 0 0 1 7c1.2 2.8 3.6 4.5 6 4.5 1.1 0 2.1-.3 3-.9M11.5 9.5A9.7 9.7 0 0 0 13 7c-1.2-2.8-3.6-4.5-6-4.5-.5 0-1 .07-1.5.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M1 7c1.2-2.8 3.6-4.5 6-4.5S11.8 4.2 13 7c-1.2 2.8-3.6 4.5-6 4.5S2.2 9.8 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-2">
                {/* Save */}
                <button
                  type="button"
                  disabled={!keyInputValue.trim()}
                  aria-disabled={!keyInputValue.trim()}
                  onClick={handleSaveKey}
                  className={[
                    'h-7 px-3 rounded-md text-[12px] text-text-inverse',
                    'bg-accent-claude',
                    'hover:brightness-110 transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    !keyInputValue.trim() ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  Save
                </button>

                {/* Remove key — only when a key is already set */}
                {badgeState === 'key-set' && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className={[
                      'h-7 px-3 rounded-md text-[12px] text-error',
                      'bg-transparent border border-error',
                      'hover:bg-error/10 transition-all duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    ].join(' ')}
                  >
                    Remove key
                  </button>
                )}

                {/* Cancel */}
                <button
                  type="button"
                  onClick={handleCancelKeyEdit}
                  className={[
                    'h-7 px-3 rounded-md text-[12px] text-text-secondary',
                    'bg-transparent border border-border',
                    'hover:bg-hover transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : confirmState === 'confirm-remove' ? (
        <div
          className="flex items-center gap-2 h-12 px-3 rounded-md bg-card border border-border"
          style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-error)' }}
        >
          <span className="flex-1 text-[13px] text-text-primary truncate min-w-0">
            {name} — Remove this provider?
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className={[
              'h-7 px-3 rounded-md flex-shrink-0',
              'bg-transparent border border-border text-[12px] text-text-secondary',
              'hover:bg-hover transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRemove}
            className={[
              'h-7 px-3 rounded-md flex-shrink-0',
              'bg-error text-[12px] text-text-inverse',
              'hover:brightness-90 transition-all duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Remove
          </button>
        </div>
      ) : (
        /* confirm-remove-last — warning + option to still remove */
        <div
          className="flex items-center gap-2 h-12 px-3 rounded-md bg-card border border-border"
          style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--semantic-error)' }}
        >
          <span className="flex-1 text-[13px] text-text-primary truncate min-w-0">
            {name} — Last provider. Remove and start over?
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className={[
              'h-7 px-3 rounded-md flex-shrink-0',
              'bg-transparent border border-border text-[12px] text-text-secondary',
              'hover:bg-hover transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRemove}
            className={[
              'h-7 px-3 rounded-md flex-shrink-0',
              'bg-error text-[12px] text-text-inverse',
              'hover:brightness-90 transition-all duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Form validation ──────────────────────────────────────────────────────────

interface FormErrors {
  displayName?: string;
  endpointUrl?: string;
  modelString?: string;
}

function validateForm(
  displayName: string,
  endpointUrl: string,
  modelString: string,
): FormErrors {
  const errors: FormErrors = {};
  if (!displayName.trim()) {
    errors.displayName = 'Display name is required.';
  }
  if (!endpointUrl.trim()) {
    errors.endpointUrl = 'Endpoint URL is required.';
  } else if (!/^https?:\/\/.+/.test(endpointUrl.trim())) {
    errors.endpointUrl = 'Enter a valid URL (e.g. https://my-server.example.com/v1)';
  }
  if (!modelString.trim()) {
    errors.modelString = 'Model string is required.';
  }
  return errors;
}

// ─── Add custom endpoint form ─────────────────────────────────────────────────

interface AddCustomFormProps {
  onAdded: () => void;
}

function AddCustomForm({ onAdded }: AddCustomFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [modelString, setModelString] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [accentColor, setAccentColor] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const hasCustomColor = accentColor !== '';
  const currentColorStyle = accentColor || 'var(--accent-other)';

  const validateField = useCallback(
    (field: keyof FormErrors) => {
      if (!submitAttempted) return;
      const newErrors = validateForm(displayName, endpointUrl, modelString);
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
    },
    [submitAttempted, displayName, endpointUrl, modelString],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitAttempted(true);
      const newErrors = validateForm(displayName, endpointUrl, modelString);
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const newConfig = addCustomProvider({
        displayName: displayName.trim(),
        endpointUrl: endpointUrl.trim(),
        modelString: modelString.trim(),
        ...(accentColor ? { color: accentColor } : {}),
      });

      if (apiKey.trim() && newConfig.credentialKey) {
        saveCredentials(newConfig.credentialKey, apiKey.trim());
      }

      // Clear form state.
      setDisplayName('');
      setEndpointUrl('');
      setModelString('');
      setApiKey('');
      setAccentColor('');
      setErrors({});
      setSubmitAttempted(false);
      setShowApiKey(false);

      onAdded();
    },
    [displayName, endpointUrl, modelString, apiKey, accentColor, onAdded],
  );

  const handleClear = useCallback(() => {
    setDisplayName('');
    setEndpointUrl('');
    setModelString('');
    setApiKey('');
    setAccentColor('');
    setErrors({});
    setSubmitAttempted(false);
    setShowApiKey(false);
  }, []);

  const inputBase = [
    'w-full h-10 px-3 rounded-md text-[14px] text-text-primary placeholder:text-text-muted',
    'bg-input border transition-colors duration-fast',
    'focus:outline-none focus:border-border-strong',
    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
  ].join(' ');

  const labelClass = 'block text-[12px] font-medium text-text-secondary mb-1.5';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="text-[12px] font-medium text-text-secondary mb-3">Custom endpoint</p>
      <p className="text-[12px] text-text-muted mb-4">
        Connect any OpenAI-compatible API endpoint.
      </p>

      <div className="flex flex-col gap-4">
        {/* Field 1: Display Name */}
        <div>
          <label htmlFor="psp-display-name" className={labelClass}>
            Display name
          </label>
          <input
            id="psp-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => validateField('displayName')}
            placeholder="My Llama Server"
            maxLength={40}
            className={`${inputBase} ${errors.displayName ? 'border-error' : 'border-border'}`}
          />
          {errors.displayName ? (
            <p role="alert" className="mt-1 text-[11px] text-error">
              {errors.displayName}
            </p>
          ) : null}
        </div>

        {/* Field 2: Endpoint URL */}
        <div>
          <label htmlFor="psp-endpoint-url" className={labelClass}>
            Endpoint URL
          </label>
          <input
            id="psp-endpoint-url"
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            onBlur={() => validateField('endpointUrl')}
            placeholder="https://my-server.example.com/v1"
            className={`${inputBase} ${errors.endpointUrl ? 'border-error' : 'border-border'}`}
          />
          {errors.endpointUrl ? (
            <p role="alert" className="mt-1 text-[11px] text-error">
              {errors.endpointUrl}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-text-muted">
              Must be an OpenAI-compatible <code>/chat/completions</code> endpoint.
            </p>
          )}
        </div>

        {/* Field 3: Model String */}
        <div>
          <label htmlFor="psp-model-string" className={labelClass}>
            Model string
          </label>
          <input
            id="psp-model-string"
            type="text"
            value={modelString}
            onChange={(e) => setModelString(e.target.value)}
            onBlur={() => validateField('modelString')}
            placeholder="llama3.2:latest"
            className={`${inputBase} ${errors.modelString ? 'border-error' : 'border-border'}`}
          />
          {errors.modelString ? (
            <p role="alert" className="mt-1 text-[11px] text-error">
              {errors.modelString}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-text-muted">
              The model identifier passed to the API.
            </p>
          )}
        </div>

        {/* Field 4: API Key (optional) */}
        <div>
          <label htmlFor="psp-api-key" className={`${labelClass} !mb-1.5 flex gap-1.5 items-baseline`}>
            API key
            <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="psp-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank for keyless endpoints (Ollama, LM Studio)"
              style={{ paddingRight: '36px' }}
              className={`${inputBase} border-border`}
            />
            <button
              type="button"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              onClick={() => setShowApiKey((v) => !v)}
              className={[
                'absolute right-3 top-1/2 -translate-y-1/2',
                'text-text-muted hover:text-text-secondary',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
              ].join(' ')}
            >
              {showApiKey ? (
                /* Eye-slash icon */
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5l11 11M6.07 6.08A2 2 0 0 0 7 9a2 2 0 0 0 1.93-1.93M2.5 4.5A9.7 9.7 0 0 0 1 7c1.2 2.8 3.6 4.5 6 4.5 1.1 0 2.1-.3 3-.9M11.5 9.5A9.7 9.7 0 0 0 13 7c-1.2-2.8-3.6-4.5-6-4.5-.5 0-1 .07-1.5.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : (
                /* Eye icon */
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7c1.2-2.8 3.6-4.5 6-4.5S11.8 4.2 13 7c-1.2 2.8-3.6 4.5-6 4.5S2.2 9.8 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Never logged or transmitted except to your endpoint.
          </p>
        </div>

        {/* Accent Color */}
        <div>
          <label className={labelClass}>
            Accent color
          </label>
          <p className="text-[11px] text-text-muted mb-2">
            Used for this provider's identity dot.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Choose accent color"
                onClick={() => {
                  const el = document.getElementById('psp-color-input') as HTMLInputElement | null;
                  el?.click();
                }}
                className={[
                  'w-9 h-9 rounded-sm border border-border',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
                style={{ backgroundColor: currentColorStyle }}
              />
              <input
                id="psp-color-input"
                type="color"
                value={accentColor || '#9966cc'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            <span className="text-[12px] text-text-muted">
              {accentColor ? accentColor.toUpperCase() : 'Default'}
            </span>
            {hasCustomColor && (
              <button
                type="button"
                onClick={() => setAccentColor('')}
                className={[
                  'text-[11px] text-text-muted',
                  'hover:text-text-secondary hover:underline',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
                ].join(' ')}
              >
                Reset to default
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submit + Clear */}
      <div className="flex gap-2 mt-6">
        <button
          type="submit"
          className={[
            'h-10 px-5 rounded-md',
            'bg-accent-claude text-text-inverse text-[14px] font-semibold',
            'hover:brightness-110 active:brightness-90 active:scale-[0.98]',
            'transition-all duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          Add provider
        </button>
        <button
          type="button"
          onClick={handleClear}
          className={[
            'h-10 px-4 rounded-md',
            'bg-transparent border border-border',
            'text-[14px] font-medium text-text-secondary',
            'hover:bg-hover hover:border-border-strong',
            'transition-all duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          Clear
        </button>
      </div>
    </form>
  );
}

// ─── ProviderSettingsPanel ────────────────────────────────────────────────────

interface ProviderSettingsPanelProps {
  /** Whether the panel is currently open. */
  isOpen: boolean;
  /** Called when the user closes the panel (close button or Escape key). */
  onClose: () => void;
  /** Ref to the gear icon button that triggered the panel — focus returns here on close. */
  triggerRef: React.RefObject<HTMLButtonElement>;
}

export function ProviderSettingsPanel({
  isOpen,
  onClose,
  triggerRef,
}: ProviderSettingsPanelProps) {
  const [roster, setRoster] = useState(() => getProviderRoster());
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const newRowRef = useRef<HTMLDivElement | null>(null);

  // Re-read roster from Gate after any mutation.
  const refreshRoster = useCallback(() => {
    setRoster(getProviderRoster());
  }, []);

  // Focus the close button when the panel opens; refresh roster.
  useEffect(() => {
    if (isOpen) {
      refreshRoster();
      setNewlyAddedId(null);
      requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });
    }
  }, [isOpen, refreshRoster]);

  // Return focus to gear trigger on close.
  const handleClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [onClose, triggerRef]);

  // Escape key closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Add built-in chip clicked.
  const handleAddBuiltIn = useCallback((modelId: BuiltInModelId) => {
    const config = addBuiltInProvider(modelId);
    setNewlyAddedId(config.modelId);
    refreshRoster();
    setTimeout(() => {
      newRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, [refreshRoster]);

  // Custom provider added via form.
  const handleCustomAdded = useCallback(() => {
    const fresh = getProviderRoster();
    const last = fresh[fresh.length - 1];
    if (last) {
      setNewlyAddedId(last.kind === 'builtin' ? last.modelId : last.id);
    }
    setRoster(fresh);
    setTimeout(() => {
      newRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  // Provider removed.
  const handleProviderRemoved = useCallback(() => {
    refreshRoster();
  }, [refreshRoster]);

  // Built-ins available to add (not yet in roster).
  const configuredBuiltInIds = new Set(
    roster
      .filter((p): p is BuiltInProviderConfig => p.kind === 'builtin')
      .map((p) => p.modelId),
  );
  const availableBuiltIns = ALL_BUILTIN_IDS.filter((id) => !configuredBuiltInIds.has(id));

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="psp-heading"
      aria-hidden={!isOpen}
      className={[
        'fixed top-0 right-0 h-screen bg-bg overflow-y-auto z-40',
        'motion-reduce:transition-none',
        !isOpen ? 'pointer-events-none' : '',
      ].join(' ')}
      style={{
        width: 'calc(100vw - 256px)',
        // maxWidth caps the drawer shell to the content width on wide desktops.
        // The content body inside is constrained to max-w-[640px] with px-8 (64px
        // total horizontal padding), so 704px is the natural fit. On viewports
        // where calc(100vw - 256px) < 704px the width property wins unchanged.
        maxWidth: '704px',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: isOpen
          ? 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)'
          : 'transform 200ms ease-in',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
      }}
    >
      {/* Panel header — sticky */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-6 border-b border-border bg-bg flex-shrink-0">
        <h2 id="psp-heading" className="text-[16px] font-semibold text-text-primary">
          My Providers
        </h2>
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close provider settings"
          onClick={handleClose}
          className={[
            'w-8 h-8 flex items-center justify-center rounded-md',
            'text-text-muted hover:bg-hover',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Panel body — mx-auto centers the content block within the shell on wide viewports
          where max-w-[640px] is active (shell is max 704px). Without mx-auto the 640px
          content block left-aligns in the 704px shell, producing 64px more space on the
          right than the left. mx-auto splits that gap evenly (32px each side). */}
      <div className="px-8 pt-6 pb-12 max-w-[640px] mx-auto">

        {/* ── Section 1: Configured Providers ──────────────────────────── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-2">
            Configured providers
          </p>
          {roster.length === 0 ? (
            <div className="h-20 flex items-center justify-center rounded-md border border-dashed border-border">
              <p className="text-[13px] text-text-muted text-center">
                No providers yet. Add one below.
              </p>
            </div>
          ) : (
            <div role="list" aria-label="Configured providers" className="flex flex-col gap-1">
              {roster.map((provider) => {
                const pid = getProviderId(provider);
                const isNew = pid === newlyAddedId;
                return (
                  <div
                    key={pid}
                    ref={isNew ? newRowRef : undefined}
                    style={isNew ? { animation: 'provider-enter 200ms ease-out' } : undefined}
                  >
                    <ProviderRow
                      provider={provider}
                      isLast={roster.length === 1}
                      onRemoved={handleProviderRemoved}
                      isNew={isNew}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 2: Add Built-in Provider ─────────────────────────── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-2">
            Add a provider
          </p>
          <p className="text-[12px] font-medium text-text-secondary mb-2">
            Built-in providers
          </p>
          {availableBuiltIns.length === 0 ? (
            <p className="text-[13px] text-text-muted">
              All built-in providers are configured.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableBuiltIns.map((modelId) => {
                const meta = BUILTIN_META[modelId];
                return (
                  <button
                    key={modelId}
                    type="button"
                    aria-label={`Add ${meta.name} to your providers`}
                    onClick={() => handleAddBuiltIn(modelId)}
                    className={[
                      'flex items-center gap-2 h-8 px-3 rounded-full cursor-pointer',
                      'bg-transparent border border-dashed border-border',
                      'text-[13px] font-medium text-text-muted',
                      'hover:bg-hover hover:border-solid hover:border-border-strong hover:text-text-secondary',
                      'transition-all duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:rounded-full',
                    ].join(' ')}
                  >
                    <span
                      className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                      style={{ backgroundColor: `var(--${meta.color})` }}
                      aria-hidden="true"
                    />
                    {meta.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 3: Add Custom Endpoint ───────────────────────────── */}
        <section className="border-t border-border pt-8">
          <AddCustomForm onAdded={handleCustomAdded} />
        </section>
      </div>
    </div>
  );
}
