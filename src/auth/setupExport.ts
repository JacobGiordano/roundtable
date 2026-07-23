/**
 * Gate — setupExport.ts
 *
 * Implements exportSetup() and importSetup() for cross-device setup transfer
 * (issue #305).
 *
 * exportSetup() reads all Gate-owned data from localStorage and returns a
 * serializable SetupExport payload. No side effects.
 *
 * importSetup() validates and applies a SetupExport payload, writing credentials,
 * custom providers, and preferences back to localStorage.
 *
 * Security rules (non-negotiable):
 *   - The SetupExport payload contains plaintext API keys — the exported file is
 *     the secret. Gate never logs, transmits, or stores the payload except via
 *     the existing saveCredentials() path.
 *   - Auth tokens are NEVER included in the export — session state is local only.
 *   - getCredentials() is the only function in this module that reads
 *     roundtable:key:* values. Verified by grep.
 *   - saveCredentials() is the only function in this module that writes
 *     roundtable:key:* values. Verified by grep.
 */

import type {
  SetupExport,
  ImportResult,
  CustomProviderConfig,
  BuiltInModelId,
  ModelId,
  ThemeId,
  ThemePreferences,
  UserPreferences,
  TokenCountVisibility,
} from '@/types';
import { getCredentials, saveCredentials, MODEL_CREDENTIAL_MAP } from './credentials';
import { getProviderRoster, saveProviderRoster } from './providerRoster';
import { getThemePreference, saveThemePreference } from './theme';
import { getUserPreferences, saveUserPreferences } from './preferences';
import {
  getModelAccentColors,
  setModelAccentColor,
  clearAllModelAccentColors,
} from './accentColors';
import { getUserAccentColor, setUserAccentColor, clearUserAccentColor } from './userAccentColor';
import {
  getSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from './sidebarWidth';
import { getSidebarOpen, setSidebarOpen } from './sidebarOpen';
import { getModelVersions, setModelVersion, clearModelVersion } from './modelVersion';
import { getServerUrl, saveServerUrl } from './backendAuth';
import { BUILTIN_MODEL_IDS } from './builtinModelIds';

// ─── Schema version ───────────────────────────────────────────────────────────

/**
 * Current schema version for SetupExport payloads.
 *
 * Increment (via an Arch types PR) when the payload shape changes in a
 * backward-incompatible way. importSetup() rejects any payload whose
 * schemaVersion exceeds this value — they may have been produced by a newer
 * version of the app and could contain fields this version does not understand.
 */
export const SETUP_SCHEMA_VERSION = 1 as const;

// ─── exportSetup ─────────────────────────────────────────────────────────────

/**
 * Collect all Gate-owned data and return a serializable SetupExport payload.
 *
 * Credentials: reads all built-in credential keys (from MODEL_CREDENTIAL_MAP)
 * and all custom provider credential keys (from the provider roster). Only keys
 * with a stored value are included — missing credentials are absent from the
 * payload rather than present with empty values.
 *
 * CustomProviders: only custom (kind === 'custom') roster entries. Built-in
 * provider roster state is not included; it is inferred from credential
 * availability on the target device.
 *
 * Preferences: all Gate-owned preferences:
 *   - theme (active theme id and optional custom theme JSON)
 *   - userPreferences (token count visibility)
 *   - modelAccentColors (per-model hex overrides)
 *   - userAccentColor (user bubble accent hex; omitted when not set)
 *   - sidebarWidth (px)
 *   - sidebarOpen (boolean)
 *   - modelVersions (per-model selected version id)
 *   - serverUrl (self-hosted backend URL; omitted when not configured)
 *
 * Auth tokens are NEVER exported — session state is not portable.
 *
 * No side effects. Safe to call at any time.
 */
export function exportSetup(): SetupExport {
  // ── Credentials ──────────────────────────────────────────────────────────
  const credentials: Record<string, string> = {};

  // Built-in credential keys from MODEL_CREDENTIAL_MAP values.
  // Set deduplicates in case two built-ins ever share a credential key.
  const builtInKeys = new Set(Object.values(MODEL_CREDENTIAL_MAP));
  for (const key of builtInKeys) {
    const value = getCredentials(key);
    if (value !== undefined) {
      credentials[key] = value;
    }
  }

  // Custom provider credential keys — each provider's credentialKey field.
  const roster = getProviderRoster();
  const customProviders = roster.filter(
    (p): p is CustomProviderConfig => p.kind === 'custom',
  );
  for (const provider of customProviders) {
    if (provider.credentialKey) {
      const value = getCredentials(provider.credentialKey);
      if (value !== undefined) {
        credentials[provider.credentialKey] = value;
      }
    }
  }

  // ── Preferences ──────────────────────────────────────────────────────────
  const preferences: Record<string, unknown> = {
    theme: getThemePreference(),
    userPreferences: getUserPreferences(),
    modelAccentColors: getModelAccentColors(),
    sidebarWidth: getSidebarWidth(),
    sidebarOpen: getSidebarOpen(),
    modelVersions: getModelVersions(),
  };

  // Omit optional keys when not set so the payload stays clean.
  const userAccentColor = getUserAccentColor();
  if (userAccentColor !== null) {
    preferences['userAccentColor'] = userAccentColor;
  }

  const serverUrl = getServerUrl();
  if (serverUrl !== undefined) {
    preferences['serverUrl'] = serverUrl;
  }

  return {
    schemaVersion: SETUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    credentials,
    customProviders,
    preferences,
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_THEME_IDS: ReadonlySet<ThemeId> = new Set<ThemeId>([
  'slate',
  'linen',
  'midnight',
  'ash',
  'ember',
  'chalk',
  'outrun',
]);

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && VALID_THEME_IDS.has(value as ThemeId);
}

const VALID_TOKEN_COUNT_VISIBILITY: ReadonlySet<TokenCountVisibility> = new Set<TokenCountVisibility>(
  ['always', 'active', 'never'],
);

function isTokenCountVisibility(value: unknown): value is TokenCountVisibility {
  return (
    typeof value === 'string' &&
    VALID_TOKEN_COUNT_VISIBILITY.has(value as TokenCountVisibility)
  );
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value);
}

// Matches the custom ID pattern used in providerRoster.ts and accentColors.ts.
const CUSTOM_ID_PATTERN = /^custom:[^\s]+$/;

function isValidModelId(value: unknown): value is ModelId {
  if (typeof value !== 'string') return false;
  return BUILTIN_MODEL_IDS.has(value as BuiltInModelId) || CUSTOM_ID_PATTERN.test(value);
}

// ─── importSetup ─────────────────────────────────────────────────────────────

/**
 * Validate and apply a SetupExport payload.
 *
 * Validation rules (abort early on failure):
 *   - `data` must be a plain object (not null, not array)
 *   - `schemaVersion` must be a number
 *   - `schemaVersion` must be <= SETUP_SCHEMA_VERSION (higher = unknown future format)
 *   - `credentials` must be a plain object
 *   - `customProviders` must be an array when present
 *
 * Write order on a valid payload:
 *   1. Credentials — each entry written via saveCredentials(); entries whose
 *      value is not a string are skipped and recorded as errors
 *   2. Custom providers — built-in roster entries preserved; custom entries
 *      replaced entirely with the imported array. Individual entries that fail
 *      a minimum type guard are silently dropped (consistent with readRoster())
 *   3. Preferences — each key applied via its dedicated setter; malformed
 *      values are silently skipped (consistent with all Gate preference parsers)
 *
 * Returns { ok: true, errors: [] } when all operations completed without error.
 * Returns { ok: false, errors: [...] } when one or more credential values were
 * invalid or a structural validation check failed.
 *
 * Note: `preferences` and `customProviders` are optional fields for backward-
 * compatibility with partial exports. Missing fields are silently skipped.
 */
export function importSetup(data: unknown): ImportResult {
  const errors: string[] = [];

  // ── Structural validation (abort early) ──────────────────────────────────

  if (!isPlainObject(data)) {
    return { ok: false, errors: ['Invalid export payload: expected a plain object'] };
  }

  if (typeof data['schemaVersion'] !== 'number') {
    return { ok: false, errors: ['Missing or invalid schemaVersion'] };
  }

  if (data['schemaVersion'] > SETUP_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Unsupported schema version ${String(data['schemaVersion'])}: maximum supported version is ${String(SETUP_SCHEMA_VERSION)}`,
      ],
    };
  }

  if (!isPlainObject(data['credentials'])) {
    return { ok: false, errors: ['credentials must be a plain object'] };
  }

  if (
    data['customProviders'] !== undefined &&
    !Array.isArray(data['customProviders'])
  ) {
    return { ok: false, errors: ['customProviders must be an array'] };
  }

  // ── Write credentials ─────────────────────────────────────────────────────
  // Allowlist: built-in credential keys (from MODEL_CREDENTIAL_MAP) plus the
  // "custom:<id>" prefix pattern used by Gate for custom provider keys.
  // Any key that does not match is silently skipped — unknown keys could be
  // crafted to overwrite unrelated localStorage entries or to inject prototype
  // pollution via "__proto__" / "constructor" etc. (issue #443).
  const BUILTIN_CREDENTIAL_KEYS: ReadonlySet<string> = new Set(
    Object.values(MODEL_CREDENTIAL_MAP),
  );
  const CUSTOM_CREDENTIAL_KEY_PATTERN = /^custom:[^\s]+$/;

  function isAllowedCredentialKey(key: string): boolean {
    return BUILTIN_CREDENTIAL_KEYS.has(key) || CUSTOM_CREDENTIAL_KEY_PATTERN.test(key);
  }

  const rawCredentials = data['credentials'] as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawCredentials)) {
    if (!isAllowedCredentialKey(key)) {
      // Skip unknown keys silently — do not surface them to the UI (the key
      // name itself could be adversarially long or contain misleading content).
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`credentials.${key}: value must be a string`);
      continue;
    }
    saveCredentials(key, value);
  }

  // ── Write custom providers ────────────────────────────────────────────────
  if (Array.isArray(data['customProviders'])) {
    // Preserve existing built-in roster entries; replace custom entries.
    const currentRoster = getProviderRoster();
    const builtinEntries = currentRoster.filter((p) => p.kind === 'builtin');

    // Minimum guard: must be an object with kind:'custom' and a non-empty id.
    // Full structural validation occurs in readRoster() on next access; invalid
    // entries are silently dropped there (consistent with existing roster behavior).
    const importedCustom = (data['customProviders'] as unknown[]).filter(
      (entry): entry is CustomProviderConfig =>
        isPlainObject(entry) &&
        entry['kind'] === 'custom' &&
        typeof entry['id'] === 'string' &&
        (entry['id'] as string).length > 0,
    );

    saveProviderRoster([...builtinEntries, ...importedCustom]);
  }

  // ── Write preferences ─────────────────────────────────────────────────────
  // Each key applied independently. Malformed values are silently skipped to
  // match the fail-safe behavior of all existing Gate preference parsers.
  if (isPlainObject(data['preferences'])) {
    const prefs = data['preferences'];

    // Theme
    if (isPlainObject(prefs['theme'])) {
      const theme = prefs['theme'];
      if (isThemeId(theme['activeThemeId'])) {
        const themePrefs: ThemePreferences = { activeThemeId: theme['activeThemeId'] };
        if (isPlainObject(theme['customTheme'])) {
          // Accept stored custom theme objects as-is; Luma's schema validation
          // runs at display time when the user activates the custom theme.
          themePrefs.customTheme = theme['customTheme'] as unknown as ThemePreferences['customTheme'];
        }
        saveThemePreference(themePrefs);
      }
    }

    // UserPreferences
    if (isPlainObject(prefs['userPreferences'])) {
      const up = prefs['userPreferences'];
      if (isTokenCountVisibility(up['tokenCountVisibility'])) {
        const userPrefs: UserPreferences = {
          tokenCountVisibility: up['tokenCountVisibility'],
        };
        saveUserPreferences(userPrefs);
      }
    }

    // Model accent colors — clear first so the import is authoritative.
    if (isPlainObject(prefs['modelAccentColors'])) {
      clearAllModelAccentColors();
      const colors = prefs['modelAccentColors'];
      for (const [key, value] of Object.entries(colors)) {
        if (isValidModelId(key) && isValidHex(value)) {
          setModelAccentColor(key as ModelId, value);
        }
      }
    }

    // User accent color
    if ('userAccentColor' in prefs) {
      if (isValidHex(prefs['userAccentColor'])) {
        setUserAccentColor(prefs['userAccentColor'] as string);
      } else {
        // Exported as null/undefined or invalid — clear any existing override.
        clearUserAccentColor();
      }
    }

    // Sidebar width
    if (typeof prefs['sidebarWidth'] === 'number') {
      const width = prefs['sidebarWidth'];
      if (
        Number.isFinite(width) &&
        width >= SIDEBAR_WIDTH_MIN &&
        width <= SIDEBAR_WIDTH_MAX
      ) {
        saveSidebarWidth(width);
      }
    }

    // Sidebar open state
    if (typeof prefs['sidebarOpen'] === 'boolean') {
      setSidebarOpen(prefs['sidebarOpen'] as boolean);
    }

    // Model version selections — clear first so the import is authoritative.
    if (isPlainObject(prefs['modelVersions'])) {
      const currentVersions = getModelVersions();
      for (const key of Object.keys(currentVersions)) {
        clearModelVersion(key as ModelId);
      }
      const versions = prefs['modelVersions'];
      for (const [key, value] of Object.entries(versions)) {
        if (isValidModelId(key) && typeof value === 'string' && value.length > 0) {
          setModelVersion(key as ModelId, value);
        }
      }
    }

    // Server URL — not a secret (just a URL to a self-hosted backend).
    if (typeof prefs['serverUrl'] === 'string' && (prefs['serverUrl'] as string).length > 0) {
      saveServerUrl(prefs['serverUrl'] as string);
    }
  }

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors };
}
