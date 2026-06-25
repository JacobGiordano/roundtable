import { useState, useEffect, useRef, useCallback } from 'react';
import type { BuiltInModelId, ProviderConfig, BuiltInProviderConfig } from '@/types';
// CustomThemeImport — Appearance section (Section 4) added per #169.
import { CustomThemeImport } from './CustomThemeImport';
// Gate cross-agent exception: provider roster CRUD functions and credential
// helpers are pure Gate persistence utilities — permitted per CLAUDE.md.
// BUILTIN_MODEL_IDS: Gate's canonical ReadonlySet<BuiltInModelId> — imported
// per #151 so this file does not re-enumerate the union members locally.
// testCredential, testCustomCredential, TestResult: Gate's live API-key test
// utilities — wired into TestButton per #249 once Gate exported them in #238.
import {
  getProviderRoster,
  addBuiltInProvider,
  addCustomProvider,
  updateCustomProvider,
  removeProvider,
  hasCredential,
  saveCredentials,
  clearCredentials,
  getCredentials,
  BUILTIN_MODEL_IDS,
  testCredential,
  testCustomCredential,
} from '@/auth';
import type { TestResult } from '@/auth';
// #148: getModelAccentCssValue is the shared utility for model identity dot colors.
// Replaces the inline getProviderDotColor function in this file.
import { getModelAccentCssValue } from './utils/modelColor';
// #147: shared icon system — CloseIcon, EditIcon, TrashIcon, EyeIcon, EyeOffIcon
// replace the inline SVGs throughout this file.
import { CloseIcon, EditIcon, TrashIcon, EyeIcon, EyeOffIcon } from './icons';

// ─── Credential-test support ──────────────────────────────────────────────────

/**
 * Credential keys for which live provider testing is available.
 * Derived from credentialTest.ts PROVIDER_TEST_CONFIGS (Gate owns that file;
 * this local set is the cross-agent contract boundary).
 * Wired to testCredential / testCustomCredential in TestButton per #249.
 */
const TESTABLE_CREDENTIAL_KEYS = new Set([
  'anthropic',
  'openai',
  'google',
  'xai',
  'deepseek',
  'mistral',
]);

/** Returns true when a live API test is available for the given credential key. */
function isCredentialTestable(credentialKey: string | undefined): boolean {
  if (!credentialKey) return false;
  return TESTABLE_CREDENTIAL_KEYS.has(credentialKey);
}

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


// ─── Provider helpers ─────────────────────────────────────────────────────────

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
  // requiresApiKey === false takes priority — provider is always ready without a key.
  if (provider.requiresApiKey === false) return 'no-key-required';
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

// ─── Test button ──────────────────────────────────────────────────────────────

interface TestButtonProps {
  credentialKey: string;
  providerName: string;
  /**
   * For custom providers: the endpoint base URL to pass to testCustomCredential.
   * When present, testCustomCredential is used instead of testCredential.
   * When absent, the provider is treated as built-in and testCredential is used.
   */
  endpointUrl?: string;
}

/**
 * Test button for verifying a stored API key against the provider's live endpoint.
 *
 * For supported built-in providers: calls testCredential(credentialKey, savedValue).
 * For custom providers with a key: calls testCustomCredential(endpointUrl, savedValue).
 * For keyless custom providers (canTest = false): disabled, shows tooltip (#240).
 *
 * Test lifecycle state mirrors ApiKeyPanel.tsx: TestState union, testMessage,
 * 5-second auto-clear timer. Wired per #249.
 *
 * Tooltip pattern: identical to InteractionModeSwitcher.tsx — 600ms hover
 * intentionality delay, immediate on focus, aria-describedby on the trigger.
 */
function TestButton({ credentialKey, providerName, endpointUrl }: TestButtonProps) {
  const canTest = isCredentialTestable(credentialKey);
  const tooltipId = `test-btn-tooltip-${credentialKey.replace(/[^a-z0-9]/gi, '-')}`;

  // Test lifecycle state — mirrors ApiKeyPanel.tsx pattern.
  type TestState = 'idle' | 'testing' | TestResult['status'];
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tooltip show/hide with 600ms hover delay (tooltip.md §1).
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (canTest) return; // No tooltip for supported providers.
    hoverTimerRef.current = setTimeout(() => setIsTooltipVisible(true), 600);
  }, [canTest]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsTooltipVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (canTest) return;
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsTooltipVisible(true);
  }, [canTest]);

  const handleBlur = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsTooltipVisible(false);
  }, []);

  const handleTest = useCallback(async () => {
    if (!canTest) return;
    if (testState === 'testing') return;
    // Cancel any in-flight auto-clear before starting a new test.
    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    setTestState('testing');
    setTestMessage('');
    const savedValue = getCredentials(credentialKey);
    let result: TestResult;
    if (endpointUrl) {
      // Custom provider with a key: test via testCustomCredential.
      result = await testCustomCredential(endpointUrl, savedValue ?? undefined);
    } else {
      // Built-in provider: test via testCredential.
      result = await testCredential(credentialKey, savedValue ?? '');
    }
    setTestState(result.status);
    setTestMessage(result.message);
    // Auto-clear after 5 seconds; store handle for cleanup on unmount.
    clearTimerRef.current = setTimeout(() => {
      setTestState('idle');
      setTestMessage('');
    }, 5000);
  }, [canTest, testState, credentialKey, endpointUrl]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Derive button label from current test state.
  let label: string;
  if (testState === 'idle') label = 'Test';
  else if (testState === 'testing') label = 'Testing…';
  else if (testState === 'valid') label = '✓ Valid';
  else if (testState === 'rate-limited') label = '✓ Valid (rate limited)';
  else if (testState === 'invalid') label = '✗ Invalid key';
  else if (testState === 'error') label = `✗ ${testMessage}`;
  else label = '? CORS / network'; // cors-or-network

  // Derive button color from test state.
  const stateColorClass =
    testState === 'valid' || testState === 'rate-limited'
      ? 'text-success'
      : testState === 'cors-or-network'
        ? 'text-warning'
        : testState === 'invalid' || testState === 'error'
          ? 'text-error'
          : testState === 'testing'
            ? 'text-text-secondary opacity-50 cursor-not-allowed'
            : 'text-text-secondary hover:text-text-primary hover:border-border-strong';

  return (
    // Wrapper div carries mouse events so tooltip shows when hovering the
    // disabled button (pointer-events:none on disabled prevents mouseenter).
    <div
      className="relative w-fit"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        aria-disabled={!canTest ? true : undefined}
        disabled={testState === 'testing'}
        aria-label={`Test ${providerName} API key`}
        aria-describedby={!canTest ? tooltipId : undefined}
        onClick={handleTest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={[
          'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
          'border border-border',
          'transition-colors duration-fast',
          canTest
            ? [
                stateColorClass,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')
            : [
                'text-text-muted opacity-50 cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' '),
        ].join(' ')}
      >
        {label}
      </button>

      {/* Visually-hidden live region for screen reader announcements */}
      {canTest && (
        <span role="status" aria-live="polite" className="sr-only">
          {testMessage}
        </span>
      )}

      {/* Tooltip — shown for unsupported (keyless) providers only */}
      {!canTest && (
        <div
          id={tooltipId}
          role="tooltip"
          className={[
            'absolute bottom-full left-0 mb-2',
            'w-max max-w-[240px]',
            'bg-sidebar border border-border rounded-sm shadow-md',
            'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
            'pointer-events-none',
            'transition-opacity duration-fast',
            'z-20',
            isTooltipVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          Key testing isn&apos;t available for this provider. Start a conversation to verify your connection.
          {/* Caret */}
          <span
            className="absolute top-full left-3 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

// ─── Provider row ─────────────────────────────────────────────────────────────

type RowConfirmState = 'idle' | 'confirm-remove' | 'confirm-remove-last';

interface ProviderRowProps {
  provider: ProviderConfig;
  isLast: boolean;
  onRemoved: () => void;
  onUpdated?: () => void;
  isNew?: boolean;
  /**
   * Endpoint URL for custom providers with a credential key — threaded through
   * to TestButton so it can route to testCustomCredential (#249).
   */
  endpointUrl?: string;
}

function ProviderRow({ provider, isLast, onRemoved, onUpdated, isNew = false, endpointUrl }: ProviderRowProps) {
  const [confirmState, setConfirmState] = useState<RowConfirmState>('idle');
  const [isRemoving, setIsRemoving] = useState(false);

  // Ref to the Cancel button in confirm states — focus moves here when the row
  // enters either confirm-remove or confirm-remove-last (WCAG 2.4.3 fix, #115).
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // ── Inline key editor state ────────────────────────────────────────────────
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);

  // ── Inline provider editor state (custom providers only) ──────────────────
  const [isEditingProvider, setIsEditingProvider] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEndpointUrl, setEditEndpointUrl] = useState('');
  const [editModelString, setEditModelString] = useState('');
  const [editAccentColor, setEditAccentColor] = useState('');
  const [editRequiresApiKey, setEditRequiresApiKey] = useState(true);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editSubmitAttempted, setEditSubmitAttempted] = useState(false);
  // Ref to the pencil button — focus returns here on Save or Cancel.
  const editPencilRef = useRef<HTMLButtonElement>(null);
  // Ref to the display name input — receives focus when the edit form opens.
  const editDisplayNameRef = useRef<HTMLInputElement>(null);

  const name = getProviderName(provider);
  const id = getProviderId(provider);
  const dotColor = getModelAccentCssValue(getProviderId(provider));

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
    setKeyRevealed(false);
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
    setKeyRevealed(false);
    setBadgeState(getBadgeState(provider));
  }, [credentialKey, keyInputValue, provider]);

  // Clear the stored key and close the editor.
  const handleClearKey = useCallback(() => {
    if (!credentialKey) return;
    clearCredentials(credentialKey);
    setIsEditingKey(false);
    setKeyInputValue('');
    setShowKeyInput(false);
    setKeyRevealed(false);
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

  // ── Provider edit handlers ─────────────────────────────────────────────────

  // Open the inline provider editor — pre-populate fields from current provider data.
  const handleOpenProviderEdit = useCallback(() => {
    if (provider.kind !== 'custom') return;
    setEditDisplayName(provider.displayName);
    setEditEndpointUrl(provider.endpointUrl);
    setEditModelString(provider.modelString);
    setEditAccentColor(provider.color ?? '');
    // requiresApiKey absent or true → key required; false → no key required.
    setEditRequiresApiKey(provider.requiresApiKey !== false);
    setEditErrors({});
    setEditSubmitAttempted(false);
    setIsEditingProvider(true);
    // Double-rAF: first frame commits the DOM; second ensures focus-visible ring renders.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editDisplayNameRef.current?.focus();
      });
    });
  }, [provider]);

  // Close the editor and return focus to the pencil button.
  const handleCancelProviderEdit = useCallback(() => {
    setIsEditingProvider(false);
    setEditErrors({});
    setEditSubmitAttempted(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editPencilRef.current?.focus();
      });
    });
  }, []);

  // Validate a single field and update editErrors (only when submit has been attempted).
  const handleEditValidateField = useCallback(
    (field: keyof FormErrors) => {
      if (!editSubmitAttempted) return;
      const newErrors = validateForm(editDisplayName, editEndpointUrl, editModelString);
      setEditErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
    },
    [editSubmitAttempted, editDisplayName, editEndpointUrl, editModelString],
  );

  // Save the updated provider and close the editor.
  const handleSaveProviderEdit = useCallback(() => {
    setEditSubmitAttempted(true);
    const newErrors = validateForm(editDisplayName, editEndpointUrl, editModelString);
    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }
    updateCustomProvider(id, {
      displayName: editDisplayName.trim(),
      endpointUrl: editEndpointUrl.trim(),
      modelString: editModelString.trim(),
      ...(editAccentColor ? { color: editAccentColor } : {}),
      // Pass requiresApiKey: false only when explicitly disabled; omit otherwise
      // so Gate treats the provider as requiring a key (the default).
      ...(editRequiresApiKey ? {} : { requiresApiKey: false }),
    });
    // Refresh badge — the provider prop won't update until the parent re-renders
    // from onUpdated(), but badgeState is local state and needs an explicit push.
    // When requiresApiKey is toggled off, show no-key-required immediately.
    if (!editRequiresApiKey) {
      setBadgeState('no-key-required');
    } else {
      // Re-derive from the updated roster entry.
      const fresh = provider.kind === 'custom'
        ? { ...provider, requiresApiKey: true }
        : provider;
      setBadgeState(getBadgeState(fresh));
    }
    onUpdated?.();
    setIsEditingProvider(false);
    setEditErrors({});
    setEditSubmitAttempted(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editPencilRef.current?.focus();
      });
    });
  }, [id, editDisplayName, editEndpointUrl, editModelString, editAccentColor, editRequiresApiKey, onUpdated]);

  // Move focus to the Cancel button when the row enters a confirm state so
  // keyboard users land on a usable control rather than body (WCAG 2.4.3, #115).
  useEffect(() => {
    if (confirmState === 'confirm-remove' || confirmState === 'confirm-remove-last') {
      requestAnimationFrame(() => {
        cancelBtnRef.current?.focus();
      });
    }
  }, [confirmState]);

  const rowStyle: React.CSSProperties = isRemoving
    ? { height: 0, opacity: 0, transition: 'height 200ms ease-in, opacity 100ms ease-in', overflow: 'hidden' }
    : { overflow: 'hidden' };

  const enterStyle: React.CSSProperties = isNew
    ? { animation: 'provider-enter 200ms ease-out' }
    : {};

  // "Set key" button — only when no key is set yet, not in edit mode, and the provider requires a key.
  const providerRequiresApiKey = provider.kind !== 'custom' || provider.requiresApiKey !== false;
  const showSetKeyButton = badgeState === 'no-key' && credentialKey !== undefined && !isEditingKey && providerRequiresApiKey;

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
            {showSetKeyButton && (
              <button
                type="button"
                aria-label={`Set API key for ${name}`}
                onClick={handleOpenKeyEditor}
                className={[
                  'ml-2 text-[11px] text-text-muted underline cursor-pointer',
                  'hover:text-text-secondary bg-transparent border-0 p-0',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus rounded',
                  'transition-colors duration-fast',
                ].join(' ')}
              >
                Set key
              </button>
            )}
            {/* Pencil button — custom providers only, not while editing key */}
            {provider.kind === 'custom' && !isEditingKey && (
              <button
                ref={editPencilRef}
                type="button"
                aria-label={`Edit ${name}`}
                onClick={handleOpenProviderEdit}
                className={[
                  'w-7 h-7 flex items-center justify-center rounded-sm flex-shrink-0 ml-2',
                  'bg-transparent text-text-muted',
                  'hover:bg-hover hover:text-text-primary',
                  'transition-all duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                {/* Edit icon — shared icon (#147) */}
                <EditIcon />
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
              {/* Trash icon — shared icon (#147) */}
              <TrashIcon />
            </button>
          </div>

          {/* ── Masked key display (when key is set and not editing, and key is required) ───── */}
          {badgeState === 'key-set' && !isEditingKey && credentialKey !== undefined && providerRequiresApiKey && (
            <div className="pb-3 flex flex-col gap-2">
              {/* Masked/revealed key row with eye toggle */}
              <div
                className="relative w-full h-8 bg-input rounded-md border border-border overflow-hidden"
                aria-label={`${name} API key — ${keyRevealed ? 'revealed' : 'saved and masked'}`}
              >
                <span className="absolute inset-0 flex items-center px-3 pr-9 text-[13px] font-mono text-text-muted overflow-hidden">
                  <span className="truncate">
                    {keyRevealed ? (getCredentials(credentialKey) ?? '—') : '••••••••••••••••••••••••••••••••'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setKeyRevealed((v) => !v)}
                  aria-label={keyRevealed ? 'Hide key' : 'Show key'}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors duration-fast focus:outline-none"
                >
                  {/* Eye icons — shared icon system (#147) */}
                  {keyRevealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {/* Test | Edit | Clear — single row, consistent with ApiKeyPanel.tsx */}
              <div className="flex items-center gap-1.5">
                <TestButton credentialKey={credentialKey} providerName={name} endpointUrl={endpointUrl} />
                <button
                  type="button"
                  aria-label={`Edit API key for ${name}`}
                  onClick={handleOpenKeyEditor}
                  className={[
                    'h-8 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
                    'text-text-secondary border border-border',
                    'hover:text-text-primary hover:border-border-strong',
                    'transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleClearKey}
                  aria-label={`Clear API key for ${name}`}
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
            </div>
          )}

          {/* ── Inline provider editor (custom providers only) ────────── */}
          {isEditingProvider && provider.kind === 'custom' && (
            // onKeyDown: capture Escape here so it closes only the edit form, not
            // the entire panel. e.nativeEvent.stopImmediatePropagation() prevents the
            // document-level panel Escape listener from also firing.
            <div
              className="mt-2 pb-3 border-t border-border pt-3"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.nativeEvent.stopImmediatePropagation();
                  handleCancelProviderEdit();
                }
              }}
            >
              <p className="text-[12px] font-medium text-text-secondary mb-3">Edit provider</p>
              <div className="flex flex-col gap-4">
                {/* Display name */}
                <div>
                  <label htmlFor={`edit-display-name-${id}`} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                    Display name
                  </label>
                  <input
                    ref={editDisplayNameRef}
                    id={`edit-display-name-${id}`}
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    onBlur={() => handleEditValidateField('displayName')}
                    maxLength={40}
                    className={[
                      'w-full h-10 px-3 rounded-md text-[14px] text-text-primary placeholder:text-text-muted',
                      'bg-input border transition-colors duration-fast',
                      'focus:outline-none focus:border-border-strong',
                      'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                      editErrors.displayName ? 'border-error' : 'border-border',
                    ].join(' ')}
                    placeholder="My Llama Server"
                  />
                  {editErrors.displayName ? (
                    <p role="alert" className="mt-1 text-[11px] text-error">{editErrors.displayName}</p>
                  ) : null}
                </div>

                {/* Endpoint URL */}
                <div>
                  <label htmlFor={`edit-endpoint-url-${id}`} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                    Endpoint URL
                  </label>
                  <input
                    id={`edit-endpoint-url-${id}`}
                    type="url"
                    value={editEndpointUrl}
                    onChange={(e) => setEditEndpointUrl(e.target.value)}
                    onBlur={() => handleEditValidateField('endpointUrl')}
                    className={[
                      'w-full h-10 px-3 rounded-md text-[14px] text-text-primary placeholder:text-text-muted',
                      'bg-input border transition-colors duration-fast',
                      'focus:outline-none focus:border-border-strong',
                      'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                      editErrors.endpointUrl ? 'border-error' : 'border-border',
                    ].join(' ')}
                    placeholder="https://my-server.example.com/v1"
                  />
                  {editErrors.endpointUrl ? (
                    <p role="alert" className="mt-1 text-[11px] text-error">{editErrors.endpointUrl}</p>
                  ) : null}
                </div>

                {/* Model string */}
                <div>
                  <label htmlFor={`edit-model-string-${id}`} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                    Model string
                  </label>
                  <input
                    id={`edit-model-string-${id}`}
                    type="text"
                    value={editModelString}
                    onChange={(e) => setEditModelString(e.target.value)}
                    onBlur={() => handleEditValidateField('modelString')}
                    className={[
                      'w-full h-10 px-3 rounded-md text-[14px] text-text-primary placeholder:text-text-muted',
                      'bg-input border transition-colors duration-fast',
                      'focus:outline-none focus:border-border-strong',
                      'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                      editErrors.modelString ? 'border-error' : 'border-border',
                    ].join(' ')}
                    placeholder="llama3.2:latest"
                  />
                  {editErrors.modelString ? (
                    <p role="alert" className="mt-1 text-[11px] text-error">{editErrors.modelString}</p>
                  ) : null}
                </div>

                {/* No API key required toggle */}
                <div>
                  <label
                    htmlFor={`edit-requires-api-key-${id}`}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    {/* Visually styled checkbox */}
                    <div className="relative flex-shrink-0">
                      <input
                        id={`edit-requires-api-key-${id}`}
                        type="checkbox"
                        checked={!editRequiresApiKey}
                        onChange={(e) => setEditRequiresApiKey(!e.target.checked)}
                        className={[
                          'w-4 h-4 rounded cursor-pointer',
                          'accent-[var(--accent-claude)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                        ].join(' ')}
                      />
                    </div>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary transition-colors duration-fast">
                        No API key required
                      </span>
                      <span className="text-[11px] text-text-muted">
                        For local providers like Ollama or LM Studio that don&apos;t need authentication
                      </span>
                    </span>
                  </label>
                </div>

                {/* Accent color */}
                <div>
                  {/* htmlFor associates the label with the color swatch button (#237). */}
                  <label htmlFor={`edit-accent-color-btn-${id}`} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                    Accent color
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        id={`edit-accent-color-btn-${id}`}
                        type="button"
                        aria-label="Choose accent color"
                        onClick={() => {
                          const el = document.getElementById(`edit-color-input-${id}`) as HTMLInputElement | null;
                          el?.click();
                        }}
                        className={[
                          'w-9 h-9 rounded-sm border border-border',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                        ].join(' ')}
                        style={{ backgroundColor: editAccentColor || 'var(--accent-other)' }}
                      />
                      <input
                        id={`edit-color-input-${id}`}
                        type="color"
                        value={editAccentColor || '#9966cc'}
                        onChange={(e) => setEditAccentColor(e.target.value)}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-[12px] text-text-muted">
                      {editAccentColor ? editAccentColor.toUpperCase() : 'Default'}
                    </span>
                    {editAccentColor && (
                      <button
                        type="button"
                        onClick={() => setEditAccentColor('')}
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

              {/* Save / Cancel */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleSaveProviderEdit}
                  className={[
                    'h-8 px-4 rounded-md text-[12px] font-medium',
                    'bg-accent-claude text-text-inverse',
                    'hover:brightness-110 transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelProviderEdit}
                  className={[
                    'h-8 px-4 rounded-md text-[12px] font-medium',
                    'bg-transparent border border-border text-text-secondary',
                    'hover:bg-hover transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  ].join(' ')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Inline key editor (expands below row, only when API key is required) ────── */}
          {isEditingKey && providerRequiresApiKey && (
            <div className="mt-2 pb-3">
              {/* Password input — full-width, eye toggle overlaid absolutely */}
              <div className="relative w-full">
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
                    'w-full h-9 rounded-md text-[13px] text-text-primary placeholder:text-text-muted',
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
                  {/* Eye icons — shared icon system (#147) */}
                  {showKeyInput ? <EyeOffIcon /> : <EyeIcon />}
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
            ref={cancelBtnRef}
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
              'bg-error-bg text-[12px] text-text-inverse',
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
            ref={cancelBtnRef}
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
              'bg-error-bg text-[12px] text-text-inverse',
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
  const [noApiKeyRequired, setNoApiKeyRequired] = useState(false);
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
        // Pass requiresApiKey: false only when toggled on — omit otherwise so
        // Gate treats the provider as requiring a key (the default behavior).
        ...(noApiKeyRequired ? { requiresApiKey: false } : {}),
      });

      // Save the API key only when the provider requires one and a key was entered.
      if (!noApiKeyRequired && apiKey.trim() && newConfig.credentialKey) {
        saveCredentials(newConfig.credentialKey, apiKey.trim());
      }

      // Clear form state.
      setDisplayName('');
      setEndpointUrl('');
      setModelString('');
      setApiKey('');
      setNoApiKeyRequired(false);
      setAccentColor('');
      setErrors({});
      setSubmitAttempted(false);
      setShowApiKey(false);

      onAdded();
    },
    [displayName, endpointUrl, modelString, apiKey, noApiKeyRequired, accentColor, onAdded],
  );

  const handleClear = useCallback(() => {
    setDisplayName('');
    setEndpointUrl('');
    setModelString('');
    setApiKey('');
    setNoApiKeyRequired(false);
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

        {/* Field 4: No API key required toggle */}
        <div>
          <label
            htmlFor="psp-no-api-key-required"
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <input
              id="psp-no-api-key-required"
              type="checkbox"
              checked={noApiKeyRequired}
              onChange={(e) => {
                setNoApiKeyRequired(e.target.checked);
                // Clear any stored key input when switching to keyless mode.
                if (e.target.checked) setApiKey('');
              }}
              className={[
                'w-4 h-4 rounded cursor-pointer',
                'accent-[var(--accent-claude)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              ].join(' ')}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary transition-colors duration-fast">
                No API key required
              </span>
              <span className="text-[11px] text-text-muted">
                For local providers like Ollama or LM Studio that don&apos;t need authentication
              </span>
            </span>
          </label>
        </div>

        {/* Field 5: API Key (optional, hidden when no key required) */}
        {!noApiKeyRequired && (
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
              {/* Eye icons — shared icon system (#147) */}
              {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Never logged or transmitted except to your endpoint.
          </p>
        </div>
        )}

        {/* Accent Color */}
        <div>
          {/* htmlFor="psp-accent-color-btn" associates the label with the color
              swatch button (#237). Clicking the label activates the button, which
              programmatically opens the native color picker. */}
          <label htmlFor="psp-accent-color-btn" className={labelClass}>
            Accent color
          </label>
          <p className="text-[11px] text-text-muted mb-2">
            Used for this provider's identity dot.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                id="psp-accent-color-btn"
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
  // Ref to the drawer container — used by the focus trap (WCAG 2.1.2, 2.4.3, #116).
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Focus trap — intercept Tab and Shift+Tab while the drawer is open so
  // keyboard focus cycles within the drawer rather than escaping to content
  // behind the backdrop (WCAG 2.1.2 / 2.4.3, #116; verified for 2.4.11, #258).
  // 2.4.11 compliance summary: panel is fixed z-40 with backdrop z-30. When open,
  // the main content area is visually obscured. This trap prevents Tab from
  // reaching obscured elements. Combined with inert={!isOpen} on the drawer itself
  // (prevents AT interaction when off-screen), aria-modal="true", Escape close,
  // focus-on-open (close button), and focus-return-on-close (triggerRef), the
  // panel satisfies the full modal dialog keyboard contract.
  useEffect(() => {
    if (!isOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        drawer!.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on or before the first element, wrap to last.
        if (active === first || !drawer!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on the last element, wrap to first.
        if (active === last || !drawer!.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

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
  const availableBuiltIns = [...BUILTIN_MODEL_IDS].filter((id) => !configuredBuiltInIds.has(id));

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="psp-heading"
      aria-hidden={!isOpen}
      // inert removes all descendants from the tab order + AT tree when the panel is
      // off-screen. @types/react 18.3 only exposes this in experimental.d.ts, so we
      // cast rather than import the experimental types globally.
      {...({ inert: !isOpen ? '' : undefined } as React.HTMLAttributes<HTMLDivElement>)}
      className={[
        'fixed top-0 right-0 h-screen bg-bg overflow-y-auto z-40',
        'motion-reduce:transition-none',
        !isOpen ? 'pointer-events-none' : '',
      ].join(' ')}
      style={{
        // --sidebar-width is set on :root by Sidebar.tsx and updated on every
        // drag-resize. The 280px fallback matches SIDEBAR_WIDTH_DEFAULT from Gate
        // and handles the brief window before Sidebar mounts.
        width: 'calc(100vw - var(--sidebar-width, 280px))',
        // maxWidth caps the drawer shell to the content width on wide desktops.
        // The content body inside is constrained to max-w-[640px] with px-8 (64px
        // total horizontal padding), so 704px is the natural fit. On viewports
        // where calc(100vw - var(--sidebar-width, 280px)) < 704px the width property wins unchanged.
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
          {/* Close icon — shared icon (#147) */}
          <CloseIcon />
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
                      onUpdated={refreshRoster}
                      isNew={isNew}
                      endpointUrl={provider.kind === 'custom' && provider.credentialKey ? provider.endpointUrl : undefined}
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
        <section className="border-t border-border pt-8 mb-8">
          <AddCustomForm onAdded={handleCustomAdded} />
        </section>

        {/* ── Section 4: Appearance ─────────────────────────────────────── */}
        {/* Custom theme import — spec: /_design/specs/custom-theme-import.md */}
        <section className="border-t border-border pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-2">
            Appearance
          </p>
          <p className="text-[12px] font-medium text-text-secondary mb-2">
            Custom theme
          </p>
          <p className="text-[12px] font-normal text-text-muted mb-4">
            Import a theme JSON file conforming to the Roundtable token schema.
          </p>
          <CustomThemeImport />
        </section>
      </div>
    </div>
  );
}
