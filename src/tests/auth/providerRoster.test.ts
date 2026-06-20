/**
 * Tests for providerRoster.ts (Gate) — Scout unit/regression suite
 *
 * Placed in /src/tests/auth/ (not /src/auth/) — Scout's boundary rule.
 * Imports Gate's public API without modifying any application code.
 *
 * Coverage targets:
 *   getProviderRoster()    — read + validate from localStorage
 *   saveProviderRoster()   — full roster write
 *   addBuiltInProvider()   — idempotent add, credentialKey derivation
 *   addCustomProvider()    — ID generation, credentialKey default, color opt-in
 *   removeProvider()       — built-in/custom removal, no-op on missing
 *   getProviderById()      — lookup by modelId (built-in) or id (custom)
 *
 * Validation behavior (fail-closed) tested through the public API:
 *   - Corrupt JSON returns []
 *   - Non-array JSON returns []
 *   - localStorage.getItem throwing returns []
 *   - Invalid entries are silently dropped
 *   - Valid built-in and custom entries survive round-trips
 *
 * Slug / collision-safe ID generation tested through addCustomProvider:
 *   - Display names are slugified
 *   - Collisions with existing custom IDs increment suffix
 *   - Custom IDs never collide with BuiltInModelId values
 *
 * Storage key under test: "roundtable:provider-roster"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildLocalStorageMock } from '../fixtures/conversations';
import type { BuiltInProviderConfig, CustomProviderConfig, ProviderRoster, BuiltInModelId, BuiltInCredentialKey } from '@/types';

// ─── localStorage mock ────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;
let store: Map<string, string>;

beforeEach(() => {
  const mock = buildLocalStorageMock();
  store = mock.store;
  restoreLocalStorage = mock.restore;
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Import under test (after mock is in place) ───────────────────────────────

import {
  getProviderRoster,
  saveProviderRoster,
  addBuiltInProvider,
  addCustomProvider,
  removeProvider,
  getProviderById,
} from '@/auth/providerRoster';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROSTER_KEY = 'roundtable:provider-roster';

/** All six known BuiltInModelId values from /src/types/index.ts. */
const ALL_BUILTIN_IDS = ['claude', 'gpt-5.5', 'gemini', 'grok', 'deepseek', 'mistral'] as const;

/**
 * Expected credentialKey for each BuiltInModelId — mirrors MODEL_CREDENTIAL_MAP
 * from /src/auth/credentials.ts. If this map drifts from credentials.ts, these
 * tests will catch it.
 */
const EXPECTED_CREDENTIAL_KEYS: Record<string, string> = {
  claude: 'anthropic',
  'gpt-5.5': 'openai',
  gemini: 'google',
  grok: 'xai',
  deepseek: 'deepseek',
  mistral: 'mistral',
};

// ─── Raw storage helpers ──────────────────────────────────────────────────────

function setRaw(value: string): void {
  store.set(ROSTER_KEY, value);
}

function getRaw(): string | null {
  return store.get(ROSTER_KEY) ?? null;
}

function getParsed(): ProviderRoster | null {
  const raw = getRaw();
  if (raw === null) return null;
  return JSON.parse(raw) as ProviderRoster;
}

// ─── Minimal valid config builders ───────────────────────────────────────────

function builtInConfig(overrides: Partial<BuiltInProviderConfig> = {}): BuiltInProviderConfig {
  return {
    kind: 'builtin',
    modelId: 'claude',
    credentialKey: 'anthropic',
    isVisible: true,
    ...overrides,
  };
}

function customConfig(overrides: Partial<CustomProviderConfig> = {}): CustomProviderConfig {
  return {
    kind: 'custom',
    id: 'custom:test-provider',
    displayName: 'Test Provider',
    endpointUrl: 'https://api.example.com/v1/chat/completions',
    modelString: 'test-model-v1',
    ...overrides,
  };
}

// ─── getProviderRoster ────────────────────────────────────────────────────────

describe('getProviderRoster', () => {
  it('returns [] when the storage key is absent', () => {
    expect(getProviderRoster()).toEqual([]);
  });

  it('returns [] on corrupt JSON', () => {
    setRaw('{corrupt json');
    expect(getProviderRoster()).toEqual([]);
  });

  it('returns [] on JSON null', () => {
    setRaw('null');
    expect(getProviderRoster()).toEqual([]);
  });

  it('returns [] when stored value is a JSON object (not array)', () => {
    setRaw('{"kind":"builtin"}');
    expect(getProviderRoster()).toEqual([]);
  });

  it('returns [] on an empty JSON array', () => {
    setRaw('[]');
    expect(getProviderRoster()).toEqual([]);
  });

  it('never throws when localStorage.getItem throws', () => {
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError: access denied');
    });
    expect(() => getProviderRoster()).not.toThrow();
    expect(getProviderRoster()).toEqual([]);
  });

  it('returns a valid BuiltInProviderConfig entry unchanged', () => {
    const entry = builtInConfig();
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()).toEqual([entry]);
  });

  it('returns a valid CustomProviderConfig entry unchanged', () => {
    const entry = customConfig();
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()).toEqual([entry]);
  });

  it('returns a mixed roster with built-in and custom entries', () => {
    const bi = builtInConfig();
    const cu = customConfig();
    setRaw(JSON.stringify([bi, cu]));
    expect(getProviderRoster()).toEqual([bi, cu]);
  });

  it('silently drops entries with an unknown kind field', () => {
    const bad = { kind: 'unknown', id: 'x', displayName: 'X' };
    const good = builtInConfig();
    setRaw(JSON.stringify([bad, good]));
    expect(getProviderRoster()).toEqual([good]);
  });

  it('silently drops entries with no kind field', () => {
    const bad = { modelId: 'claude', credentialKey: 'anthropic', isVisible: true };
    const good = customConfig();
    setRaw(JSON.stringify([bad, good]));
    expect(getProviderRoster()).toEqual([good]);
  });

  it('silently drops built-in entries with an invalid modelId', () => {
    const bad = builtInConfig({ modelId: 'not-a-real-model' as unknown as BuiltInModelId });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops built-in entries with an invalid credentialKey', () => {
    const bad = builtInConfig({ credentialKey: 'not-a-real-key' as unknown as BuiltInCredentialKey });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops built-in entries where isVisible is missing', () => {
    const bad = { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic' };
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops built-in entries where isVisible is a non-boolean', () => {
    const bad = { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: 'yes' };
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('accepts a built-in entry with an optional selectedVersionId string', () => {
    const entry = builtInConfig({ selectedVersionId: 'claude-opus-4-5' });
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()[0]).toEqual(entry);
  });

  it('silently drops built-in entries where selectedVersionId is a non-string non-undefined', () => {
    const bad = { kind: 'builtin', modelId: 'claude', credentialKey: 'anthropic', isVisible: true, selectedVersionId: 123 };
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops custom entries with an empty id', () => {
    const bad = customConfig({ id: '' });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops custom entries with an empty displayName', () => {
    const bad = customConfig({ displayName: '' });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops custom entries with an empty endpointUrl', () => {
    const bad = customConfig({ endpointUrl: '' });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('silently drops custom entries with an empty modelString', () => {
    const bad = customConfig({ modelString: '' });
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('accepts custom entries with no credentialKey (field is optional)', () => {
    const entry = customConfig();
    delete entry.credentialKey;
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()).toHaveLength(1);
  });

  it('accepts custom entries with no color field (field is optional)', () => {
    const entry = customConfig();
    delete entry.color;
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()).toHaveLength(1);
  });

  it('accepts custom entries with a color field', () => {
    const entry = customConfig({ color: '#FF5500' });
    setRaw(JSON.stringify([entry]));
    expect(getProviderRoster()[0]).toEqual(entry);
  });

  it('silently drops custom entries with a non-string credentialKey', () => {
    const bad = { ...customConfig(), credentialKey: 123 };
    setRaw(JSON.stringify([bad]));
    expect(getProviderRoster()).toEqual([]);
  });

  it('preserves array ordering', () => {
    const first = builtInConfig({ modelId: 'claude' });
    const second = builtInConfig({ modelId: 'gpt-5.5', credentialKey: 'openai' });
    const third = customConfig({ id: 'custom:z', displayName: 'Z Provider' });
    setRaw(JSON.stringify([first, second, third]));
    const roster = getProviderRoster();
    expect(roster[0]).toEqual(first);
    expect(roster[1]).toEqual(second);
    expect(roster[2]).toEqual(third);
  });

  it('returns a new array each call — not a cached reference', () => {
    const entry = builtInConfig();
    setRaw(JSON.stringify([entry]));
    const a = getProviderRoster();
    const b = getProviderRoster();
    expect(a).not.toBe(b);
  });
});

// ─── saveProviderRoster ───────────────────────────────────────────────────────

describe('saveProviderRoster', () => {
  it('writes a JSON-serialized roster to the correct storage key', () => {
    const entry = builtInConfig();
    saveProviderRoster([entry]);
    expect(getRaw()).toBe(JSON.stringify([entry]));
  });

  it('writes an empty array when given []', () => {
    saveProviderRoster([]);
    expect(getRaw()).toBe('[]');
  });

  it('overwrites any previously stored roster entirely', () => {
    const first = builtInConfig({ modelId: 'claude' });
    const second = builtInConfig({ modelId: 'gpt-5.5', credentialKey: 'openai' });
    saveProviderRoster([first]);
    saveProviderRoster([second]);
    const parsed = getParsed();
    expect(parsed).toHaveLength(1);
    expect(parsed![0]).toEqual(second);
  });

  it('round-trips a mixed roster through saveProviderRoster → getProviderRoster', () => {
    const bi = builtInConfig();
    const cu = customConfig({ color: '#AABBCC' });
    saveProviderRoster([bi, cu]);
    expect(getProviderRoster()).toEqual([bi, cu]);
  });

  it('preserves ordering in the written JSON', () => {
    const a = builtInConfig({ modelId: 'claude' });
    const b = builtInConfig({ modelId: 'gpt-5.5', credentialKey: 'openai' });
    saveProviderRoster([b, a]);
    const result = getProviderRoster();
    expect(result[0].kind === 'builtin' && (result[0] as BuiltInProviderConfig).modelId).toBe('gpt-5.5');
    expect(result[1].kind === 'builtin' && (result[1] as BuiltInProviderConfig).modelId).toBe('claude');
  });
});

// ─── addBuiltInProvider ───────────────────────────────────────────────────────

describe('addBuiltInProvider', () => {
  it('adds a new built-in provider and persists it', () => {
    addBuiltInProvider('claude');
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0].kind).toBe('builtin');
    expect((roster[0] as BuiltInProviderConfig).modelId).toBe('claude');
  });

  it('returns the new BuiltInProviderConfig entry', () => {
    const result = addBuiltInProvider('gemini');
    expect(result.kind).toBe('builtin');
    expect(result.modelId).toBe('gemini');
  });

  it('sets isVisible to true by default', () => {
    const result = addBuiltInProvider('claude');
    expect(result.isVisible).toBe(true);
  });

  it('does not set selectedVersionId on the new entry', () => {
    const result = addBuiltInProvider('claude');
    expect(result.selectedVersionId).toBeUndefined();
  });

  it('derives the credentialKey from MODEL_CREDENTIAL_MAP for all six built-ins', () => {
    for (const modelId of ALL_BUILTIN_IDS) {
      store.clear();
      const result = addBuiltInProvider(modelId);
      expect(result.credentialKey).toBe(EXPECTED_CREDENTIAL_KEYS[modelId]);
    }
  });

  it('is a no-op when the built-in is already in the roster — does not duplicate', () => {
    addBuiltInProvider('claude');
    addBuiltInProvider('claude');
    expect(getProviderRoster()).toHaveLength(1);
  });

  it('returns the existing entry when the built-in is already in the roster', () => {
    const first = addBuiltInProvider('gpt-5.5');
    const second = addBuiltInProvider('gpt-5.5');
    expect(second).toEqual(first);
  });

  it('appends to the roster without disturbing existing entries', () => {
    addBuiltInProvider('claude');
    addBuiltInProvider('gemini');
    const roster = getProviderRoster();
    expect(roster).toHaveLength(2);
    const modelIds = roster
      .filter((p): p is BuiltInProviderConfig => p.kind === 'builtin')
      .map((p) => p.modelId);
    expect(modelIds).toContain('claude');
    expect(modelIds).toContain('gemini');
  });

  it('appends a built-in after existing custom providers', () => {
    const cu = customConfig();
    saveProviderRoster([cu]);
    addBuiltInProvider('claude');
    const roster = getProviderRoster();
    expect(roster).toHaveLength(2);
    expect(roster[0].kind).toBe('custom');
    expect(roster[1].kind).toBe('builtin');
  });

  it('does not disturb a pre-existing custom entry when a built-in is added', () => {
    const cu = customConfig();
    saveProviderRoster([cu]);
    addBuiltInProvider('grok');
    const roster = getProviderRoster();
    const custom = roster.find((p) => p.kind === 'custom') as CustomProviderConfig;
    expect(custom).toEqual(cu);
  });
});

// ─── addCustomProvider ────────────────────────────────────────────────────────

describe('addCustomProvider', () => {
  it('returns a CustomProviderConfig with kind "custom"', () => {
    const result = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com/v1/chat/completions',
      modelString: 'llama-3-70b',
    });
    expect(result.kind).toBe('custom');
  });

  it('persists the new entry to localStorage', () => {
    addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com/v1',
      modelString: 'llama-3-70b',
    });
    expect(getProviderRoster()).toHaveLength(1);
  });

  it('generates an id with the "custom:" prefix and a slug from the display name', () => {
    const result = addCustomProvider({
      displayName: 'OpenRouter Config',
      endpointUrl: 'https://openrouter.ai/api/v1',
      modelString: 'meta-llama/llama-3-70b',
    });
    expect(result.id).toBe('custom:openrouter-config');
  });

  it('slugifies display names to lowercase with hyphens replacing non-alphanumeric chars', () => {
    const result = addCustomProvider({
      displayName: 'My OpenRouter Config!',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(result.id).toBe('custom:my-openrouter-config');
  });

  it('trims leading and trailing hyphens from slugs', () => {
    const result = addCustomProvider({
      displayName: '!!! Special !!!',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(result.id).toBe('custom:special');
  });

  it('falls back to "custom:provider" when display name yields no slug characters', () => {
    const result = addCustomProvider({
      displayName: '!!!',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(result.id).toBe('custom:provider');
  });

  it('generates a default credentialKey as "custom:<id>" when credentialKey is not supplied', () => {
    const result = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(result.credentialKey).toBe(`custom:${result.id}`);
  });

  it('uses the supplied credentialKey when provided', () => {
    const result = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
      credentialKey: 'my-custom-key',
    });
    expect(result.credentialKey).toBe('my-custom-key');
  });

  it('includes color in the entry when supplied', () => {
    const result = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
      color: '#FF5500',
    });
    expect(result.color).toBe('#FF5500');
  });

  it('does not include color in the entry when not supplied', () => {
    const result = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect('color' in result).toBe(false);
  });

  it('stores the exact endpointUrl and modelString provided', () => {
    const endpointUrl = 'https://openrouter.ai/api/v1/chat/completions';
    const modelString = 'meta-llama/llama-3-70b-instruct';
    const result = addCustomProvider({ displayName: 'OR', endpointUrl, modelString });
    expect(result.endpointUrl).toBe(endpointUrl);
    expect(result.modelString).toBe(modelString);
  });

  it('appends to existing entries without overwriting them', () => {
    addBuiltInProvider('claude');
    addCustomProvider({
      displayName: 'My Custom',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    const roster = getProviderRoster();
    expect(roster).toHaveLength(2);
    expect(roster.some((p) => p.kind === 'builtin')).toBe(true);
    expect(roster.some((p) => p.kind === 'custom')).toBe(true);
  });

  it('the returned entry survives getProviderRoster round-trip validation', () => {
    const result = addCustomProvider({
      displayName: 'Round Trip Test',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
      color: '#AABBCC',
    });
    // The returned entry must be valid enough that readRoster() doesn't drop it.
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0]).toEqual(result);
  });
});

// ─── ID collision avoidance ───────────────────────────────────────────────────

describe('addCustomProvider — collision-safe ID generation', () => {
  it('generates "custom:my-provider-2" when "custom:my-provider" already exists', () => {
    addCustomProvider({ displayName: 'My Provider', endpointUrl: 'https://a.com', modelString: 'm' });
    const second = addCustomProvider({ displayName: 'My Provider', endpointUrl: 'https://b.com', modelString: 'm' });
    expect(second.id).toBe('custom:my-provider-2');
  });

  it('generates "custom:my-provider-3" when -2 is also taken', () => {
    addCustomProvider({ displayName: 'My Provider', endpointUrl: 'https://a.com', modelString: 'm' });
    addCustomProvider({ displayName: 'My Provider', endpointUrl: 'https://b.com', modelString: 'm' });
    const third = addCustomProvider({ displayName: 'My Provider', endpointUrl: 'https://c.com', modelString: 'm' });
    expect(third.id).toBe('custom:my-provider-3');
  });

  it('each collision-suffixed entry gets a distinct ID', () => {
    const r1 = addCustomProvider({ displayName: 'Provider', endpointUrl: 'https://a.com', modelString: 'm' });
    const r2 = addCustomProvider({ displayName: 'Provider', endpointUrl: 'https://b.com', modelString: 'm' });
    const r3 = addCustomProvider({ displayName: 'Provider', endpointUrl: 'https://c.com', modelString: 'm' });
    const ids = new Set([r1.id, r2.id, r3.id]);
    expect(ids.size).toBe(3);
  });

  it('slugifies dots and special characters in display names', () => {
    // "gpt-5.5" → slug "gpt-5-5" (dot becomes hyphen), so id is "custom:gpt-5-5"
    const r = addCustomProvider({
      displayName: 'gpt-5.5',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(r.id).toBe('custom:gpt-5-5');
  });

  it('trims multiple consecutive hyphens to a single hyphen in the slug', () => {
    const r = addCustomProvider({
      displayName: 'My   Provider',  // multiple spaces → multiple hyphens → collapsed
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    expect(r.id).toBe('custom:my-provider');
  });

  it('all returned IDs are unique when adding the same display name repeatedly', () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(addCustomProvider({ displayName: 'Same Name', endpointUrl: `https://${i}.com`, modelString: 'm' }));
    }
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(5);
  });
});

// ─── removeProvider ───────────────────────────────────────────────────────────

describe('removeProvider', () => {
  it('removes a built-in provider matched by modelId', () => {
    addBuiltInProvider('claude');
    removeProvider('claude');
    expect(getProviderRoster()).toHaveLength(0);
  });

  it('removes a custom provider matched by id', () => {
    const cu = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    removeProvider(cu.id);
    expect(getProviderRoster()).toHaveLength(0);
  });

  it('is a no-op when the roster is empty', () => {
    expect(() => removeProvider('claude')).not.toThrow();
    expect(getProviderRoster()).toEqual([]);
  });

  it('is a no-op when the id does not match any entry', () => {
    const entry = builtInConfig();
    saveProviderRoster([entry]);
    removeProvider('gpt-5.5');
    expect(getProviderRoster()).toEqual([entry]);
  });

  it('does not write to localStorage when the id is not found', () => {
    addBuiltInProvider('claude');
    const setItemSpy = vi.spyOn(globalThis.localStorage, 'setItem');
    removeProvider('not-a-real-id');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not affect other entries when one built-in is removed', () => {
    addBuiltInProvider('claude');
    addBuiltInProvider('gemini');
    const cu = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    removeProvider('gemini');
    const roster = getProviderRoster();
    expect(roster).toHaveLength(2);
    const ids = roster.map((p) => (p.kind === 'builtin' ? p.modelId : p.id));
    expect(ids).toContain('claude');
    expect(ids).toContain(cu.id);
    expect(ids).not.toContain('gemini');
  });

  it('removes only the matching custom provider when two share a similar name', () => {
    const a = addCustomProvider({ displayName: 'Provider', endpointUrl: 'https://a.com', modelString: 'm' });
    const b = addCustomProvider({ displayName: 'Provider', endpointUrl: 'https://b.com', modelString: 'm' });
    removeProvider(a.id);
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect((roster[0] as CustomProviderConfig).id).toBe(b.id);
  });

  it('built-in removal by modelId does not accidentally remove a custom with a similar id string', () => {
    // "claude" as displayName slugifies to "custom:claude" — removing by "claude"
    // should only remove the builtin (matched via modelId), not the custom.
    const cu = addCustomProvider({
      displayName: 'claude',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    addBuiltInProvider('claude');
    removeProvider('claude');
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect((roster[0] as CustomProviderConfig).id).toBe(cu.id);
  });

  it('custom removal by id does not accidentally remove a built-in with the same string', () => {
    addBuiltInProvider('claude');
    // 'claude' is the modelId of the built-in, but it is NOT the id of any custom.
    // removeProvider('claude') should match the builtin via its modelId discriminant.
    // A custom provider with id 'custom:claude' should not be removed by removeProvider('claude').
    const cu = addCustomProvider({ displayName: 'Other', endpointUrl: 'https://api.example.com', modelString: 'm' });
    removeProvider(cu.id);  // removes the custom
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0].kind).toBe('builtin');
  });
});

// ─── getProviderById ──────────────────────────────────────────────────────────

describe('getProviderById', () => {
  it('returns undefined when the roster is empty', () => {
    expect(getProviderById('claude')).toBeUndefined();
  });

  it('returns undefined when the id does not match any entry', () => {
    addBuiltInProvider('claude');
    expect(getProviderById('gpt-5.5')).toBeUndefined();
  });

  it('finds a built-in provider by its modelId', () => {
    const added = addBuiltInProvider('claude');
    const found = getProviderById('claude');
    expect(found).toEqual(added);
  });

  it('finds a custom provider by its id', () => {
    const added = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    const found = getProviderById(added.id);
    expect(found).toEqual(added);
  });

  it('returns the correct entry from a roster with multiple providers', () => {
    addBuiltInProvider('claude');
    addBuiltInProvider('gpt-5.5');
    const cu = addCustomProvider({
      displayName: 'My Custom',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
    });
    const found = getProviderById(cu.id);
    expect(found).toEqual(cu);
    expect(found!.kind).toBe('custom');
  });

  it('does not match a custom provider when searching for a bare built-in modelId that is part of the custom id', () => {
    // "claude" as displayName → id "custom:claude". getProviderById("claude") should not match.
    addCustomProvider({ displayName: 'claude', endpointUrl: 'https://api.example.com', modelString: 'm' });
    const found = getProviderById('claude');
    expect(found).toBeUndefined();
  });

  it('does not match a built-in when searching by a custom-format id string', () => {
    addBuiltInProvider('claude');
    // "custom:claude" is not the modelId of any built-in ('claude' is).
    expect(getProviderById('custom:claude')).toBeUndefined();
  });

  it('returns a BuiltInProviderConfig when a built-in is found', () => {
    addBuiltInProvider('grok');
    const found = getProviderById('grok');
    expect(found).toBeDefined();
    expect(found!.kind).toBe('builtin');
    expect((found as BuiltInProviderConfig).modelId).toBe('grok');
    expect((found as BuiltInProviderConfig).credentialKey).toBe('xai');
  });

  it('returns a CustomProviderConfig when a custom provider is found', () => {
    const cu = addCustomProvider({
      displayName: 'My Provider',
      endpointUrl: 'https://api.example.com',
      modelString: 'model-v1',
      color: '#AABBCC',
    });
    const found = getProviderById(cu.id);
    expect(found!.kind).toBe('custom');
    expect((found as CustomProviderConfig).color).toBe('#AABBCC');
  });

  it('finds each of the six built-ins by their respective modelIds', () => {
    for (const modelId of ALL_BUILTIN_IDS) {
      addBuiltInProvider(modelId);
    }
    for (const modelId of ALL_BUILTIN_IDS) {
      const found = getProviderById(modelId);
      expect(found).toBeDefined();
      expect(found!.kind).toBe('builtin');
    }
  });
});

// ─── Round-trip consistency ───────────────────────────────────────────────────

describe('round-trip consistency', () => {
  it('addBuiltInProvider → getProviderRoster → removeProvider → getProviderRoster returns []', () => {
    addBuiltInProvider('deepseek');
    expect(getProviderRoster()).toHaveLength(1);
    removeProvider('deepseek');
    expect(getProviderRoster()).toHaveLength(0);
  });

  it('addCustomProvider → getProviderById → removeProvider → getProviderById is undefined', () => {
    const cu = addCustomProvider({ displayName: 'X', endpointUrl: 'https://x.com', modelString: 'x' });
    expect(getProviderById(cu.id)).toBeDefined();
    removeProvider(cu.id);
    expect(getProviderById(cu.id)).toBeUndefined();
  });

  it('saveProviderRoster of a built-in config with selectedVersionId round-trips correctly', () => {
    const bi = builtInConfig({ selectedVersionId: 'claude-sonnet-4-6' });
    saveProviderRoster([bi]);
    const retrieved = getProviderRoster()[0] as BuiltInProviderConfig;
    expect(retrieved.selectedVersionId).toBe('claude-sonnet-4-6');
    expect(retrieved.isVisible).toBe(true);
  });

  it('addCustomProvider then saveProviderRoster (overwrite) reflects the overwrite', () => {
    addCustomProvider({ displayName: 'Original', endpointUrl: 'https://orig.com', modelString: 'm' });
    const newEntry = builtInConfig({ modelId: 'mistral', credentialKey: 'mistral' });
    saveProviderRoster([newEntry]);
    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0].kind).toBe('builtin');
  });

  it('all six built-ins can be added, retrieved, and removed cleanly', () => {
    for (const modelId of ALL_BUILTIN_IDS) {
      addBuiltInProvider(modelId);
    }
    expect(getProviderRoster()).toHaveLength(6);

    for (const modelId of ALL_BUILTIN_IDS) {
      expect(getProviderById(modelId)).toBeDefined();
    }

    for (const modelId of ALL_BUILTIN_IDS) {
      removeProvider(modelId);
    }
    expect(getProviderRoster()).toHaveLength(0);
  });

  it('mixed built-in and custom roster survives saveProviderRoster → getProviderRoster unchanged', () => {
    const bi = builtInConfig({ modelId: 'claude', credentialKey: 'anthropic', isVisible: false });
    const cu = customConfig({ color: '#FF5500', credentialKey: 'my-key' });
    saveProviderRoster([bi, cu]);
    const result = getProviderRoster();
    expect(result).toEqual([bi, cu]);
  });
});

// ─── MODEL_CREDENTIAL_MAP sync guard ─────────────────────────────────────────

describe('MODEL_CREDENTIAL_MAP sync guard', () => {
  /**
   * Verifies that addBuiltInProvider correctly resolves the credentialKey for
   * every BuiltInModelId. If a new BuiltInModelId is added to the union but
   * not to MODEL_CREDENTIAL_MAP in credentials.ts, the credentialKey on the
   * returned entry will be undefined — and these tests catch it at CI time.
   *
   * If any of the 6 parameterized tests below fail after adding a new model,
   * it means MODEL_CREDENTIAL_MAP in /src/auth/credentials.ts needs updating,
   * AND EXPECTED_CREDENTIAL_KEYS in this test file needs updating.
   */
  it.each(ALL_BUILTIN_IDS)(
    'addBuiltInProvider("%s") produces a BuiltInProviderConfig with the expected credentialKey',
    (modelId) => {
      store.clear();
      const result = addBuiltInProvider(modelId);
      expect(result.credentialKey).toBe(EXPECTED_CREDENTIAL_KEYS[modelId]);
      expect(typeof result.credentialKey).toBe('string');
      expect(result.credentialKey.length).toBeGreaterThan(0);
    },
  );

  it('EXPECTED_CREDENTIAL_KEYS in this test file has exactly 6 entries (one per BuiltInModelId)', () => {
    // If this fails, update EXPECTED_CREDENTIAL_KEYS above to match types/index.ts.
    expect(Object.keys(EXPECTED_CREDENTIAL_KEYS)).toHaveLength(6);
  });

  it('ALL_BUILTIN_IDS in this test file has exactly 6 entries (one per BuiltInModelId)', () => {
    // If this fails, update ALL_BUILTIN_IDS above to match types/index.ts.
    expect(ALL_BUILTIN_IDS).toHaveLength(6);
  });
});
