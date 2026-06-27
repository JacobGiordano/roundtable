/**
 * Gate — providerRoster.test.ts
 *
 * Tests for the `capabilities` field on CustomProviderConfig:
 *   - addCustomProvider: stores capabilities when provided; omits when absent
 *   - updateCustomProvider: writes capabilities when provided; clears when absent
 *   - getProviderRoster / saveProviderRoster: round-trips capabilities cleanly
 *   - isValidCustomConfig (via readRoster): accepts valid capabilities; rejects
 *     entries where capabilities contains a non-boolean field value
 *
 * Also covers the pre-existing contract that configs stored without `capabilities`
 * continue to load correctly — no migration required.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCustomProvider,
  getProviderById,
  getProviderRoster,
  saveProviderRoster,
  updateCustomProvider,
} from './providerRoster';
import type { CustomProviderConfig, ProviderCapabilities } from '@/types';

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
