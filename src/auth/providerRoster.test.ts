/**
 * Gate — providerRoster.test.ts
 *
 * Tests for the `capabilities` field on BuiltInProviderConfig and CustomProviderConfig.
 *
 * BuiltInProviderConfig (issue #285 Wave 2):
 *   - addBuiltInProvider: always populates capabilities from BUILTIN_CAPABILITIES_MAP
 *   - getProviderRoster (readRoster): backfills capabilities on legacy built-in records
 *     that were stored without it (transparent on-read migration)
 *   - getProviderRoster (readRoster): preserves existing capabilities when already set
 *
 * CustomProviderConfig:
 *   - addCustomProvider: stores capabilities when provided; omits when absent
 *   - updateCustomProvider: writes capabilities when provided; clears when absent
 *   - getProviderRoster / saveProviderRoster: round-trips capabilities cleanly
 *   - isValidCustomConfig (via readRoster): accepts valid capabilities; rejects
 *     entries where capabilities contains a non-boolean field value
 *
 * Also covers the pre-existing contract that configs stored without `capabilities`
 * continue to load correctly — no migration required for custom providers.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addBuiltInProvider,
  addCustomProvider,
  getProviderById,
  getProviderRoster,
  saveProviderRoster,
  updateCustomProvider,
} from './providerRoster';
import type { BuiltInProviderConfig, CustomProviderConfig, ProviderCapabilities } from '@/types';

// ─── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  // Clear the in-memory store before each test.
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
    writable: true,
    configurable: true,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minimalInput(overrides: Partial<Parameters<typeof addCustomProvider>[0]> = {}) {
  return {
    displayName: 'Test Provider',
    endpointUrl: 'https://example.com/v1/chat/completions',
    modelString: 'test-model',
    ...overrides,
  };
}

// ─── addBuiltInProvider — capabilities from BUILTIN_CAPABILITIES_MAP ─────────

describe('addBuiltInProvider — capabilities field (issue #285 Wave 2)', () => {
  it('populates capabilities for claude (vision-capable provider)', () => {
    const entry = addBuiltInProvider('claude');
    expect(entry.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
    });

    const loaded = getProviderById('claude') as BuiltInProviderConfig;
    expect(loaded.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
    });
  });

  it('populates capabilities for gpt-5.5 (vision-capable provider)', () => {
    const entry = addBuiltInProvider('gpt-5.5');
    expect(entry.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
      imageGeneration: true,
    });
  });

  it('populates capabilities for gemini (streamUsage: false)', () => {
    const entry = addBuiltInProvider('gemini');
    expect(entry.capabilities).toEqual({
      vision: true,
      streamUsage: false,
      toolUse: true,
      systemPrompt: true,
      imageGeneration: true,
    });
  });

  it('populates capabilities for grok (conservative: vision: false)', () => {
    const entry = addBuiltInProvider('grok');
    expect(entry.capabilities).toEqual({ vision: false });
  });

  it('populates capabilities for deepseek (conservative: vision: false)', () => {
    const entry = addBuiltInProvider('deepseek');
    expect(entry.capabilities).toEqual({ vision: false });
  });

  it('populates capabilities for mistral (conservative: vision: false)', () => {
    const entry = addBuiltInProvider('mistral');
    expect(entry.capabilities).toEqual({ vision: false });
  });

  it('returns the existing entry when the built-in is already in the roster', () => {
    // First add — creates with capabilities.
    addBuiltInProvider('claude');
    // Second add — no-op, returns existing entry.
    const second = addBuiltInProvider('claude');
    expect(second.capabilities).toBeDefined();
    // Only one entry in the roster.
    expect(getProviderRoster()).toHaveLength(1);
  });
});

// ─── readRoster — migration of legacy built-in records ───────────────────────

describe('getProviderRoster — built-in capabilities migration (issue #285 Wave 2)', () => {
  it('backfills capabilities on a legacy claude record missing the field', () => {
    // Simulate a pre-Wave-2 stored record — no capabilities field.
    const legacy = JSON.stringify([
      {
        kind: 'builtin',
        modelId: 'claude',
        credentialKey: 'anthropic',
        isVisible: true,
      },
    ]);
    store['roundtable:provider-roster'] = legacy;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    const loaded = roster[0] as BuiltInProviderConfig;
    expect(loaded.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
    });
  });

  it('backfills capabilities on a legacy gemini record missing the field', () => {
    const legacy = JSON.stringify([
      {
        kind: 'builtin',
        modelId: 'gemini',
        credentialKey: 'google',
        isVisible: true,
      },
    ]);
    store['roundtable:provider-roster'] = legacy;

    const roster = getProviderRoster();
    const loaded = roster[0] as BuiltInProviderConfig;
    expect(loaded.capabilities).toEqual({
      vision: true,
      streamUsage: false,
      toolUse: true,
      systemPrompt: true,
      imageGeneration: true,
    });
  });

  it('backfills capabilities on a legacy grok record missing the field', () => {
    const legacy = JSON.stringify([
      {
        kind: 'builtin',
        modelId: 'grok',
        credentialKey: 'xai',
        isVisible: true,
      },
    ]);
    store['roundtable:provider-roster'] = legacy;

    const roster = getProviderRoster();
    const loaded = roster[0] as BuiltInProviderConfig;
    expect(loaded.capabilities).toEqual({ vision: false });
  });

  it('preserves existing capabilities when already set on a built-in record', () => {
    // A record that was already written with capabilities — no backfill should occur.
    const withCaps = JSON.stringify([
      {
        kind: 'builtin',
        modelId: 'claude',
        credentialKey: 'anthropic',
        isVisible: true,
        capabilities: { vision: true, streamUsage: true, toolUse: true, systemPrompt: true },
      },
    ]);
    store['roundtable:provider-roster'] = withCaps;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(1);
    const loaded = roster[0] as BuiltInProviderConfig;
    // Should be the stored value, not a re-derived one (same here, but verifies the branch).
    expect(loaded.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
    });
  });

  it('backfills capabilities correctly when the roster contains both built-in and custom entries', () => {
    const mixed = JSON.stringify([
      {
        kind: 'builtin',
        modelId: 'gpt-5.5',
        credentialKey: 'openai',
        isVisible: true,
        // no capabilities — should be backfilled
      },
      {
        kind: 'custom',
        id: 'custom:ollama',
        displayName: 'Ollama',
        endpointUrl: 'http://localhost:11434/v1/chat/completions',
        modelString: 'llama3',
        // no capabilities — custom providers are NOT backfilled
      },
    ]);
    store['roundtable:provider-roster'] = mixed;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(2);

    const builtin = roster.find((p) => p.kind === 'builtin') as BuiltInProviderConfig;
    expect(builtin.capabilities).toEqual({
      vision: true,
      streamUsage: true,
      toolUse: true,
      systemPrompt: true,
      imageGeneration: true,
    });

    const custom = roster.find((p) => p.kind === 'custom') as CustomProviderConfig;
    // Custom providers are not migrated — absence stays absent.
    expect(custom.capabilities).toBeUndefined();
  });
});

// ─── addCustomProvider — capabilities field ───────────────────────────────────

describe('addCustomProvider — capabilities field', () => {
  it('omits capabilities from the stored entry when not provided', () => {
    const entry = addCustomProvider(minimalInput());
    expect(entry.capabilities).toBeUndefined();

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toBeUndefined();
  });

  it('stores capabilities when provided with all four fields', () => {
    const caps: ProviderCapabilities = {
      streamUsage: false,
      vision: true,
      toolUse: false,
      systemPrompt: true,
    };
    const entry = addCustomProvider(minimalInput({ capabilities: caps }));
    expect(entry.capabilities).toEqual(caps);

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toEqual(caps);
  });

  it('stores capabilities with only a subset of fields', () => {
    const caps: ProviderCapabilities = { streamUsage: false };
    const entry = addCustomProvider(minimalInput({ capabilities: caps }));
    expect(entry.capabilities).toEqual({ streamUsage: false });

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toEqual({ streamUsage: false });
  });

  it('stores an empty capabilities object when provided', () => {
    const caps: ProviderCapabilities = {};
    const entry = addCustomProvider(minimalInput({ capabilities: caps }));
    expect(entry.capabilities).toEqual({});

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toEqual({});
  });
});

// ─── updateCustomProvider — capabilities field ────────────────────────────────

describe('updateCustomProvider — capabilities field', () => {
  it('writes capabilities when provided in the update input', () => {
    const entry = addCustomProvider(minimalInput());
    expect(entry.capabilities).toBeUndefined();

    const caps: ProviderCapabilities = { vision: true, streamUsage: false };
    updateCustomProvider(entry.id, {
      displayName: entry.displayName,
      endpointUrl: entry.endpointUrl,
      modelString: entry.modelString,
      capabilities: caps,
    });

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toEqual(caps);
  });

  it('clears capabilities when omitted from the update input', () => {
    const caps: ProviderCapabilities = { vision: true };
    const entry = addCustomProvider(minimalInput({ capabilities: caps }));
    expect(entry.capabilities).toEqual(caps);

    // Update without passing capabilities — should clear the stored value.
    updateCustomProvider(entry.id, {
      displayName: entry.displayName,
      endpointUrl: entry.endpointUrl,
      modelString: entry.modelString,
    });

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toBeUndefined();
  });

  it('replaces capabilities when a new value is provided', () => {
    const original: ProviderCapabilities = { streamUsage: true, vision: false };
    const entry = addCustomProvider(minimalInput({ capabilities: original }));

    const updated: ProviderCapabilities = { streamUsage: false, toolUse: true };
    updateCustomProvider(entry.id, {
      displayName: entry.displayName,
      endpointUrl: entry.endpointUrl,
      modelString: entry.modelString,
      capabilities: updated,
    });

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.capabilities).toEqual(updated);
    expect(loaded.capabilities?.vision).toBeUndefined();
  });

  it('preserves other fields when only capabilities changes', () => {
    const entry = addCustomProvider(
      minimalInput({ color: '#FF5500', requiresApiKey: false }),
    );

    updateCustomProvider(entry.id, {
      displayName: entry.displayName,
      endpointUrl: entry.endpointUrl,
      modelString: entry.modelString,
      color: entry.color,
      requiresApiKey: false,
      capabilities: { systemPrompt: false },
    });

    const loaded = getProviderById(entry.id) as CustomProviderConfig;
    expect(loaded.color).toBe('#FF5500');
    expect(loaded.requiresApiKey).toBe(false);
    expect(loaded.capabilities).toEqual({ systemPrompt: false });
  });
});

// ─── saveProviderRoster / getProviderRoster — round-trip ─────────────────────

describe('saveProviderRoster / getProviderRoster — capabilities round-trip', () => {
  it('round-trips a CustomProviderConfig with all capability fields', () => {
    const caps: ProviderCapabilities = {
      streamUsage: false,
      vision: true,
      toolUse: false,
      systemPrompt: true,
    };
    const config: CustomProviderConfig = {
      kind: 'custom',
      id: 'custom:test',
      displayName: 'Test',
      endpointUrl: 'https://example.com/v1/chat/completions',
      modelString: 'test-model',
      capabilities: caps,
    };

    saveProviderRoster([config]);
    const roster = getProviderRoster();

    expect(roster).toHaveLength(1);
    const loaded = roster[0] as CustomProviderConfig;
    expect(loaded.capabilities).toEqual(caps);
  });

  it('round-trips a CustomProviderConfig without capabilities (pre-existing record)', () => {
    const config: CustomProviderConfig = {
      kind: 'custom',
      id: 'custom:legacy',
      displayName: 'Legacy',
      endpointUrl: 'https://example.com/v1/chat/completions',
      modelString: 'legacy-model',
    };

    saveProviderRoster([config]);
    const roster = getProviderRoster();

    expect(roster).toHaveLength(1);
    const loaded = roster[0] as CustomProviderConfig;
    expect(loaded.capabilities).toBeUndefined();
  });
});

// ─── Validation — corrupted capabilities are rejected ─────────────────────────

describe('getProviderRoster — rejects entries with invalid capabilities', () => {
  it('drops an entry where a capabilities field is a non-boolean', () => {
    // Write a syntactically valid JSON array but with an invalid capabilities value.
    const corrupt = JSON.stringify([
      {
        kind: 'custom',
        id: 'custom:bad',
        displayName: 'Bad',
        endpointUrl: 'https://example.com/v1/chat/completions',
        modelString: 'bad-model',
        capabilities: { streamUsage: 'yes' }, // string instead of boolean — invalid
      },
    ]);
    store['roundtable:provider-roster'] = corrupt;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(0); // entry silently dropped
  });

  it('accepts an entry where capabilities is an object with unknown fields', () => {
    // Unknown fields should not cause rejection (forward-compat with future schema).
    const withExtra = JSON.stringify([
      {
        kind: 'custom',
        id: 'custom:future',
        displayName: 'Future',
        endpointUrl: 'https://example.com/v1/chat/completions',
        modelString: 'future-model',
        capabilities: { streamUsage: true, futureCapability: true },
      },
    ]);
    store['roundtable:provider-roster'] = withExtra;

    const roster = getProviderRoster();
    // The entry passes because known fields are valid; unknown fields are not
    // checked by isValidCapabilities (forward-compat).
    expect(roster).toHaveLength(1);
  });

  it('drops an entry where capabilities is a non-object', () => {
    const corrupt = JSON.stringify([
      {
        kind: 'custom',
        id: 'custom:bad2',
        displayName: 'Bad2',
        endpointUrl: 'https://example.com/v1/chat/completions',
        modelString: 'bad2-model',
        capabilities: 'not-an-object',
      },
    ]);
    store['roundtable:provider-roster'] = corrupt;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(0);
  });

  it('drops an entry where capabilities is an array', () => {
    const corrupt = JSON.stringify([
      {
        kind: 'custom',
        id: 'custom:bad3',
        displayName: 'Bad3',
        endpointUrl: 'https://example.com/v1/chat/completions',
        modelString: 'bad3-model',
        capabilities: [true, false],
      },
    ]);
    store['roundtable:provider-roster'] = corrupt;

    const roster = getProviderRoster();
    expect(roster).toHaveLength(0);
  });
});
