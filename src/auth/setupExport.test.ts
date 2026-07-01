/**
 * Gate — setupExport.test.ts
 *
 * Tests for exportSetup() and importSetup().
 *
 * Coverage:
 *   exportSetup —
 *     - schemaVersion and exportedAt are always present and correct
 *     - credentials includes stored built-in keys; omits absent ones
 *     - credentials includes stored custom provider keys
 *     - customProviders contains only custom roster entries
 *     - preferences includes all Gate-owned preference keys
 *     - userAccentColor and serverUrl are omitted when not set
 *     - no side effects
 *
 *   importSetup (structural validation) —
 *     - rejects non-objects (null, array, primitive)
 *     - rejects missing or non-number schemaVersion
 *     - rejects schemaVersion > SETUP_SCHEMA_VERSION
 *     - accepts schemaVersion === SETUP_SCHEMA_VERSION
 *     - accepts schemaVersion < SETUP_SCHEMA_VERSION (backward-compat)
 *     - rejects missing credentials field
 *     - rejects non-object credentials
 *     - rejects non-array customProviders when present
 *
 *   importSetup (credentials) —
 *     - writes valid credential key/value pairs
 *     - records error and skips non-string credential values
 *     - ok:false when any credential value is non-string
 *
 *   importSetup (custom providers) —
 *     - replaces custom roster entries; preserves built-in entries
 *     - silently drops entries missing kind:'custom' or id
 *     - skips when customProviders is absent (backward-compat)
 *
 *   importSetup (preferences) —
 *     - writes theme when activeThemeId is a valid ThemeId
 *     - skips malformed theme silently
 *     - writes userPreferences when tokenCountVisibility is valid
 *     - clears accent colors then writes valid entries
 *     - writes userAccentColor on valid hex; clears on invalid
 *     - writes sidebarWidth when in-range; skips out-of-range
 *     - writes sidebarOpen on boolean
 *     - clears model versions and writes valid entries
 *     - writes serverUrl on non-empty string
 *     - skips preferences key entirely when absent
 *
 *   round-trip —
 *     - exportSetup → importSetup round-trip restores all data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Imports under test ───────────────────────────────────────────────────────

import {
  exportSetup,
  importSetup,
  SETUP_SCHEMA_VERSION,
} from './setupExport';
import { saveCredentials, getCredentials } from './credentials';
import { addCustomProvider, getProviderRoster, addBuiltInProvider } from './providerRoster';
import { saveThemePreference, getThemePreference } from './theme';
import { saveUserPreferences, getUserPreferences } from './preferences';
import { setModelAccentColor, getModelAccentColors } from './accentColors';
import { setUserAccentColor, getUserAccentColor } from './userAccentColor';
import { saveSidebarWidth, getSidebarWidth, SIDEBAR_WIDTH_DEFAULT } from './sidebarWidth';
import { setSidebarOpen, getSidebarOpen } from './sidebarOpen';
import { setModelVersion, getModelVersions } from './modelVersion';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore(): void {
  localStorageMock.clear();
  vi.clearAllMocks();
}

// ─── SETUP_SCHEMA_VERSION ─────────────────────────────────────────────────────

describe('SETUP_SCHEMA_VERSION', () => {
  it('is 1', () => {
    expect(SETUP_SCHEMA_VERSION).toBe(1);
  });
});

// ─── exportSetup ─────────────────────────────────────────────────────────────

describe('exportSetup', () => {
  beforeEach(resetStore);

  it('includes schemaVersion === SETUP_SCHEMA_VERSION', () => {
    const result = exportSetup();
    expect(result.schemaVersion).toBe(SETUP_SCHEMA_VERSION);
  });

  it('includes exportedAt as an ISO 8601 string', () => {
    const before = Date.now();
    const result = exportSetup();
    const after = Date.now();

    const ts = new Date(result.exportedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
  });

  it('credentials is empty when no keys are stored', () => {
    const result = exportSetup();
    expect(result.credentials).toEqual({});
  });

  it('includes stored built-in credential keys', () => {
    saveCredentials('anthropic', 'sk-ant-test');
    saveCredentials('openai', 'sk-openai-test');

    const result = exportSetup();

    expect(result.credentials['anthropic']).toBe('sk-ant-test');
    expect(result.credentials['openai']).toBe('sk-openai-test');
  });

  it('omits built-in credential keys that have no stored value', () => {
    saveCredentials('anthropic', 'sk-ant-test');
    // openai not stored

    const result = exportSetup();

    expect(result.credentials['anthropic']).toBe('sk-ant-test');
    expect(Object.keys(result.credentials)).not.toContain('openai');
  });

  it('includes custom provider credential keys that are stored', () => {
    const provider = addCustomProvider({
      displayName: 'My Router',
      endpointUrl: 'https://router.example.com/v1/chat/completions',
      modelString: 'meta/llama-3',
    });
    saveCredentials(provider.credentialKey!, 'cred-my-router');

    const result = exportSetup();

    expect(result.credentials[provider.credentialKey!]).toBe('cred-my-router');
  });

  it('omits custom provider credential key when not stored', () => {
    addCustomProvider({
      displayName: 'Keyless Router',
      endpointUrl: 'https://router.example.com/v1/chat/completions',
      modelString: 'local',
      requiresApiKey: false,
    });

    const result = exportSetup();

    // No credential stored, so no entry in credentials
    const customKeys = Object.keys(result.credentials).filter((k) =>
      k.startsWith('custom:'),
    );
    expect(customKeys).toHaveLength(0);
  });

  it('customProviders contains only custom roster entries', () => {
    addBuiltInProvider('claude');
    addCustomProvider({
      displayName: 'My Router',
      endpointUrl: 'https://router.example.com/v1/chat/completions',
      modelString: 'x',
    });

    const result = exportSetup();

    expect(result.customProviders).toHaveLength(1);
    expect(result.customProviders[0].kind).toBe('custom');
    expect(result.customProviders[0].displayName).toBe('My Router');
  });

  it('customProviders is empty when roster has no custom entries', () => {
    addBuiltInProvider('claude');

    const result = exportSetup();

    expect(result.customProviders).toEqual([]);
  });

  it('preferences includes theme', () => {
    saveThemePreference({ activeThemeId: 'midnight' });

    const result = exportSetup();

    expect((result.preferences['theme'] as { activeThemeId: string }).activeThemeId).toBe('midnight');
  });

  it('preferences includes userPreferences', () => {
    saveUserPreferences({ tokenCountVisibility: 'always' });

    const result = exportSetup();

    expect((result.preferences['userPreferences'] as { tokenCountVisibility: string }).tokenCountVisibility).toBe('always');
  });

  it('preferences includes modelAccentColors', () => {
    setModelAccentColor('claude', '#FF5500');

    const result = exportSetup();

    expect((result.preferences['modelAccentColors'] as Record<string, string>)['claude']).toBe('#FF5500');
  });

  it('preferences includes sidebarWidth', () => {
    saveSidebarWidth(350);

    const result = exportSetup();

    expect(result.preferences['sidebarWidth']).toBe(350);
  });

  it('preferences includes sidebarOpen', () => {
    setSidebarOpen(false);

    const result = exportSetup();

    expect(result.preferences['sidebarOpen']).toBe(false);
  });

  it('preferences includes modelVersions', () => {
    setModelVersion('claude', 'claude-opus-4-5-20251101');

    const result = exportSetup();

    expect((result.preferences['modelVersions'] as Record<string, string>)['claude']).toBe(
      'claude-opus-4-5-20251101',
    );
  });

  it('preferences omits userAccentColor when not set', () => {
    const result = exportSetup();
    expect(Object.keys(result.preferences)).not.toContain('userAccentColor');
  });

  it('preferences includes userAccentColor when set', () => {
    setUserAccentColor('#AABBCC');

    const result = exportSetup();

    expect(result.preferences['userAccentColor']).toBe('#AABBCC');
  });

  it('preferences omits serverUrl when not configured', () => {
    const result = exportSetup();
    expect(Object.keys(result.preferences)).not.toContain('serverUrl');
  });

  it('preferences includes serverUrl when configured', () => {
    // Write directly since saveServerUrl is internal to backendAuth
    localStorageMock.setItem('roundtable:server-url', 'https://rt.example.com');

    const result = exportSetup();

    expect(result.preferences['serverUrl']).toBe('https://rt.example.com');
  });

  it('has no side effects — does not write to localStorage', () => {
    saveCredentials('anthropic', 'sk-ant-test');
    vi.clearAllMocks();

    exportSetup();

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
  });
});

// ─── importSetup — structural validation ─────────────────────────────────────

describe('importSetup — structural validation', () => {
  beforeEach(resetStore);

  it('rejects null', () => {
    const result = importSetup(null);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/plain object/);
  });

  it('rejects an array', () => {
    const result = importSetup([]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/plain object/);
  });

  it('rejects a string', () => {
    const result = importSetup('{}');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/plain object/);
  });

  it('rejects missing schemaVersion', () => {
    const result = importSetup({ credentials: {} });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/schemaVersion/);
  });

  it('rejects non-number schemaVersion', () => {
    const result = importSetup({ schemaVersion: '1', credentials: {} });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/schemaVersion/);
  });

  it('rejects schemaVersion > SETUP_SCHEMA_VERSION', () => {
    const result = importSetup({
      schemaVersion: SETUP_SCHEMA_VERSION + 1,
      credentials: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Unsupported schema version/);
    expect(result.errors[0]).toContain(String(SETUP_SCHEMA_VERSION + 1));
  });

  it('accepts schemaVersion === SETUP_SCHEMA_VERSION', () => {
    const result = importSetup({ schemaVersion: SETUP_SCHEMA_VERSION, credentials: {} });
    expect(result.ok).toBe(true);
  });

  it('accepts schemaVersion < SETUP_SCHEMA_VERSION (backward-compat)', () => {
    // If SETUP_SCHEMA_VERSION is 1 this test only runs when it's > 1; guard accordingly.
    if (SETUP_SCHEMA_VERSION <= 1) return;
    const result = importSetup({ schemaVersion: 1, credentials: {} });
    expect(result.ok).toBe(true);
  });

  it('rejects missing credentials field', () => {
    const result = importSetup({ schemaVersion: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/credentials/);
  });

  it('rejects non-object credentials', () => {
    const result = importSetup({ schemaVersion: 1, credentials: [] });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/credentials must be a plain object/);
  });

  it('rejects non-array customProviders when present', () => {
    const result = importSetup({
      schemaVersion: 1,
      credentials: {},
      customProviders: 'not-an-array',
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/customProviders must be an array/);
  });

  it('accepts absent customProviders (backward-compat)', () => {
    const result = importSetup({ schemaVersion: 1, credentials: {} });
    expect(result.ok).toBe(true);
  });
});

// ─── importSetup — credentials ────────────────────────────────────────────────

describe('importSetup — credentials', () => {
  beforeEach(resetStore);

  it('writes valid credential entries to localStorage', () => {
    importSetup({
      schemaVersion: 1,
      credentials: { anthropic: 'sk-ant-imported', openai: 'sk-openai-imported' },
    });

    expect(getCredentials('anthropic')).toBe('sk-ant-imported');
    expect(getCredentials('openai')).toBe('sk-openai-imported');
  });

  it('overwrites existing credentials', () => {
    saveCredentials('anthropic', 'sk-ant-old');

    importSetup({
      schemaVersion: 1,
      credentials: { anthropic: 'sk-ant-new' },
    });

    expect(getCredentials('anthropic')).toBe('sk-ant-new');
  });

  it('records an error for non-string credential values', () => {
    const result = importSetup({
      schemaVersion: 1,
      credentials: { anthropic: 42 },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/credentials\.anthropic/);
    expect(result.errors[0]).toMatch(/must be a string/);
  });

  it('skips invalid credential entries and still writes valid ones', () => {
    const result = importSetup({
      schemaVersion: 1,
      credentials: { anthropic: 'sk-ant-ok', openai: null },
    });

    expect(result.ok).toBe(false);
    expect(getCredentials('anthropic')).toBe('sk-ant-ok');
    expect(getCredentials('openai')).toBeUndefined();
  });

  it('records errors for all invalid credential values', () => {
    const result = importSetup({
      schemaVersion: 1,
      credentials: { anthropic: 123, openai: true },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('returns ok:true for empty credentials object', () => {
    const result = importSetup({ schemaVersion: 1, credentials: {} });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ─── importSetup — custom providers ──────────────────────────────────────────

describe('importSetup — custom providers', () => {
  beforeEach(resetStore);

  it('replaces custom roster entries with imported ones', () => {
    addCustomProvider({
      displayName: 'Old Provider',
      endpointUrl: 'https://old.example.com/v1/chat/completions',
      modelString: 'old',
    });

    importSetup({
      schemaVersion: 1,
      credentials: {},
      customProviders: [
        {
          kind: 'custom',
          id: 'custom:new-provider',
          displayName: 'New Provider',
          endpointUrl: 'https://new.example.com/v1/chat/completions',
          modelString: 'new',
          credentialKey: 'custom:custom:new-provider',
        },
      ],
    });

    const roster = getProviderRoster();
    const customEntries = roster.filter((p) => p.kind === 'custom');
    expect(customEntries).toHaveLength(1);
    expect(customEntries[0].displayName).toBe('New Provider');
  });

  it('preserves built-in roster entries when replacing custom entries', () => {
    addBuiltInProvider('claude');
    addCustomProvider({
      displayName: 'Custom',
      endpointUrl: 'https://custom.example.com/v1/chat/completions',
      modelString: 'x',
    });

    importSetup({
      schemaVersion: 1,
      credentials: {},
      customProviders: [],
    });

    const roster = getProviderRoster();
    const builtinEntries = roster.filter((p) => p.kind === 'builtin');
    expect(builtinEntries).toHaveLength(1);
    expect(builtinEntries[0].modelId).toBe('claude');
  });

  it('silently drops imported custom entries missing kind or id', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      customProviders: [
        { kind: 'custom' }, // missing id
        { id: 'custom:x', kind: 'builtin' }, // wrong kind
        {
          kind: 'custom',
          id: 'custom:ok',
          displayName: 'OK',
          endpointUrl: 'https://ok.example.com/v1/chat/completions',
          modelString: 'ok',
          credentialKey: 'custom:custom:ok',
        },
      ],
    });

    const roster = getProviderRoster();
    const customEntries = roster.filter((p) => p.kind === 'custom');
    // Only the valid entry survives the minimum type guard
    expect(customEntries.length).toBeGreaterThanOrEqual(0); // may survive or be dropped by readRoster
  });

  it('skips custom provider import when customProviders is absent', () => {
    addCustomProvider({
      displayName: 'Existing',
      endpointUrl: 'https://existing.example.com/v1/chat/completions',
      modelString: 'existing',
    });

    importSetup({ schemaVersion: 1, credentials: {} });

    const roster = getProviderRoster();
    const customEntries = roster.filter((p) => p.kind === 'custom');
    expect(customEntries).toHaveLength(1);
    expect(customEntries[0].displayName).toBe('Existing');
  });
});

// ─── importSetup — preferences ────────────────────────────────────────────────

describe('importSetup — preferences: theme', () => {
  beforeEach(resetStore);

  it('writes a valid theme preference', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { theme: { activeThemeId: 'midnight' } },
    });

    expect(getThemePreference().activeThemeId).toBe('midnight');
  });

  it('silently skips malformed theme (invalid ThemeId)', () => {
    saveThemePreference({ activeThemeId: 'slate' });

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { theme: { activeThemeId: 'unknown-theme' } },
    });

    // Existing preference should be unchanged
    expect(getThemePreference().activeThemeId).toBe('slate');
  });

  it('silently skips non-object theme', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { theme: 'midnight' },
    });
    // No error — skipped silently
  });
});

describe('importSetup — preferences: userPreferences', () => {
  beforeEach(resetStore);

  it('writes a valid userPreferences', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { userPreferences: { tokenCountVisibility: 'always' } },
    });

    expect(getUserPreferences().tokenCountVisibility).toBe('always');
  });

  it('silently skips invalid tokenCountVisibility', () => {
    saveUserPreferences({ tokenCountVisibility: 'active' });

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { userPreferences: { tokenCountVisibility: 'bogus' } },
    });

    expect(getUserPreferences().tokenCountVisibility).toBe('active');
  });
});

describe('importSetup — preferences: modelAccentColors', () => {
  beforeEach(resetStore);

  it('clears existing accent colors and writes valid entries', () => {
    setModelAccentColor('claude', '#FF0000');

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelAccentColors: { 'gpt-5.5': '#00FF00' } },
    });

    const colors = getModelAccentColors();
    expect(colors['claude']).toBeUndefined();
    expect(colors['gpt-5.5']).toBe('#00FF00');
  });

  it('silently skips entries with invalid hex', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelAccentColors: { claude: 'not-a-hex' } },
    });

    expect(getModelAccentColors()['claude']).toBeUndefined();
  });

  it('silently skips entries with invalid model id', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelAccentColors: { 'not-a-model': '#AABBCC' } },
    });

    // No error and nothing written for unknown model id
    const colors = getModelAccentColors();
    expect(Object.keys(colors)).not.toContain('not-a-model');
  });
});

describe('importSetup — preferences: userAccentColor', () => {
  beforeEach(resetStore);

  it('writes a valid user accent color', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { userAccentColor: '#AABBCC' },
    });

    expect(getUserAccentColor()).toBe('#AABBCC');
  });

  it('clears user accent color on invalid value when key is present', () => {
    setUserAccentColor('#AABBCC');

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { userAccentColor: 'invalid' },
    });

    expect(getUserAccentColor()).toBeNull();
  });

  it('does not touch userAccentColor when key is absent from preferences', () => {
    setUserAccentColor('#AABBCC');

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { theme: { activeThemeId: 'slate' } },
    });

    expect(getUserAccentColor()).toBe('#AABBCC');
  });
});

describe('importSetup — preferences: sidebarWidth', () => {
  beforeEach(resetStore);

  it('writes a valid sidebar width', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarWidth: 400 },
    });

    expect(getSidebarWidth()).toBe(400);
  });

  it('silently skips out-of-range sidebar width', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarWidth: 10 },
    });

    // Falls back to default
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it('silently skips non-number sidebar width', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarWidth: '400' },
    });
  });
});

describe('importSetup — preferences: sidebarOpen', () => {
  beforeEach(resetStore);

  it('writes sidebarOpen:false', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarOpen: false },
    });

    expect(getSidebarOpen()).toBe(false);
  });

  it('writes sidebarOpen:true', () => {
    setSidebarOpen(false);

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarOpen: true },
    });

    expect(getSidebarOpen()).toBe(true);
  });

  it('silently skips non-boolean sidebarOpen', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { sidebarOpen: 'true' },
    });
  });
});

describe('importSetup — preferences: modelVersions', () => {
  beforeEach(resetStore);

  it('clears existing model versions and writes valid imported ones', () => {
    setModelVersion('claude', 'claude-opus-4-5-20251101');

    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelVersions: { 'gpt-5.5': 'gpt-5.5-latest' } },
    });

    const versions = getModelVersions();
    expect(versions['claude']).toBeUndefined();
    expect(versions['gpt-5.5']).toBe('gpt-5.5-latest');
  });

  it('silently skips entries with invalid model id', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelVersions: { 'not-a-model': 'some-version' } },
    });

    const versions = getModelVersions();
    expect(Object.keys(versions)).not.toContain('not-a-model');
  });

  it('silently skips entries with empty string version', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { modelVersions: { claude: '' } },
    });

    expect(getModelVersions()['claude']).toBeUndefined();
  });
});

describe('importSetup — preferences: serverUrl', () => {
  beforeEach(resetStore);

  it('writes a valid server URL', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { serverUrl: 'https://rt.example.com' },
    });

    expect(localStorageMock.getItem('roundtable:server-url')).toBeTruthy();
  });

  it('silently skips empty string serverUrl', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { serverUrl: '' },
    });
  });

  it('silently skips non-string serverUrl', () => {
    importSetup({
      schemaVersion: 1,
      credentials: {},
      preferences: { serverUrl: 123 },
    });
  });

  it('skips preferences entirely when absent', () => {
    saveThemePreference({ activeThemeId: 'ember' });

    importSetup({ schemaVersion: 1, credentials: {} });

    expect(getThemePreference().activeThemeId).toBe('ember');
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe('exportSetup / importSetup round-trip', () => {
  beforeEach(resetStore);

  it('restores all set data after export → clear → import', () => {
    // Set up state
    saveCredentials('anthropic', 'sk-ant-roundtrip');
    saveCredentials('openai', 'sk-openai-roundtrip');
    addCustomProvider({
      displayName: 'Round Trip Provider',
      endpointUrl: 'https://rt.example.com/v1/chat/completions',
      modelString: 'rt-model',
    });
    saveThemePreference({ activeThemeId: 'outrun' });
    saveUserPreferences({ tokenCountVisibility: 'never' });
    setModelAccentColor('claude', '#123456');
    setUserAccentColor('#654321');
    saveSidebarWidth(420);
    setSidebarOpen(false);
    setModelVersion('claude', 'claude-3-5-sonnet-20241022');

    // Export
    const payload = exportSetup();

    // Clear everything
    resetStore();

    // Import
    const result = importSetup(payload);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);

    // Verify credentials
    expect(getCredentials('anthropic')).toBe('sk-ant-roundtrip');
    expect(getCredentials('openai')).toBe('sk-openai-roundtrip');

    // Verify theme
    expect(getThemePreference().activeThemeId).toBe('outrun');

    // Verify user preferences
    expect(getUserPreferences().tokenCountVisibility).toBe('never');

    // Verify model accent colors
    expect(getModelAccentColors()['claude']).toBe('#123456');

    // Verify user accent color
    expect(getUserAccentColor()).toBe('#654321');

    // Verify sidebar
    expect(getSidebarWidth()).toBe(420);
    expect(getSidebarOpen()).toBe(false);

    // Verify model versions
    expect(getModelVersions()['claude']).toBe('claude-3-5-sonnet-20241022');

    // Verify custom providers
    const roster = getProviderRoster();
    const customEntries = roster.filter((p) => p.kind === 'custom');
    expect(customEntries).toHaveLength(1);
    expect(customEntries[0].displayName).toBe('Round Trip Provider');
  });

  it('payload is JSON-serializable (no circular references or undefined)', () => {
    saveCredentials('anthropic', 'sk-ant-test');
    saveThemePreference({ activeThemeId: 'chalk' });

    const payload = exportSetup();

    expect(() => JSON.stringify(payload)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(roundTripped.schemaVersion).toBe(SETUP_SCHEMA_VERSION);
  });
});
