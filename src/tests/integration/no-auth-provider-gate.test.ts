/**
 * Integration: Gate — no-auth custom provider logic (#269)
 *
 * Tests for the three Gate functions that implement requiresApiKey:false semantics:
 *
 *   isCustomProviderReady(config)   — readiness check that short-circuits for keyless providers
 *   addCustomProvider(input)        — stores requiresApiKey:false only when explicitly false
 *   updateCustomProvider(id, input) — same write-false-only semantics; deletes field otherwise
 *
 * Mocking strategy: localStorage is mocked at the boundary so getCredentials()
 * and the roster CRUD functions exercise real code against an in-memory store.
 *
 * Cross-agent contract: CustomProviderConfig.requiresApiKey is defined by Arch in
 * /src/types/index.ts. Gate (isCustomProviderReady, addCustomProvider,
 * updateCustomProvider) is the owner; this suite guards the contract.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isCustomProviderReady, hasCredential, saveCredentials } from '@/auth/credentials';
import { addCustomProvider, updateCustomProvider, getProviderRoster } from '@/auth/providerRoster';
import { buildLocalStorageMock } from '../fixtures/conversations';
import type { CustomProviderConfig } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
});

afterEach(() => {
  restoreLocalStorage();
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeKeylessConfig(overrides: Partial<CustomProviderConfig> = {}): CustomProviderConfig {
  return {
    kind: 'custom',
    id: 'custom:ollama',
    displayName: 'Ollama',
    endpointUrl: 'http://localhost:11434/v1',
    modelString: 'llama3',
    credentialKey: 'custom:custom:ollama',
    requiresApiKey: false,
    ...overrides,
  };
}

function makeKeyedConfig(overrides: Partial<CustomProviderConfig> = {}): CustomProviderConfig {
  return {
    kind: 'custom',
    id: 'custom:openrouter',
    displayName: 'OpenRouter',
    endpointUrl: 'https://openrouter.ai/api/v1',
    modelString: 'mistralai/mistral-7b-instruct',
    credentialKey: 'custom:custom:openrouter',
    ...overrides,
  };
}

// ─── isCustomProviderReady ────────────────────────────────────────────────────

describe('isCustomProviderReady — requiresApiKey:false', () => {
  it('returns true when requiresApiKey is false, regardless of stored credential', () => {
    const config = makeKeylessConfig();
    // No credential stored for this provider's credentialKey — still ready.
    expect(hasCredential(config.credentialKey!)).toBe(false);
    expect(isCustomProviderReady(config)).toBe(true);
  });

  it('returns true when requiresApiKey is false even if credentialKey is absent', () => {
    const config: CustomProviderConfig = {
      kind: 'custom',
      id: 'custom:bare',
      displayName: 'Bare',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
      // No credentialKey field at all.
    };
    expect(isCustomProviderReady(config)).toBe(true);
  });

  it('returns true when requiresApiKey is false and a credential IS stored (key presence irrelevant)', () => {
    const config = makeKeylessConfig();
    // Simulate a key being stored (e.g. user saved one before switching to keyless).
    saveCredentials(config.credentialKey!, 'some-old-key');
    expect(isCustomProviderReady(config)).toBe(true);
  });
});

describe('isCustomProviderReady — requiresApiKey:true or absent', () => {
  it('returns false when requiresApiKey is absent and no credential is stored', () => {
    const config = makeKeyedConfig(); // no requiresApiKey field
    expect(isCustomProviderReady(config)).toBe(false);
  });

  it('returns false when requiresApiKey is true and no credential is stored', () => {
    const config = makeKeyedConfig({ requiresApiKey: true });
    expect(isCustomProviderReady(config)).toBe(false);
  });

  it('returns true when requiresApiKey is absent and a credential IS stored', () => {
    const config = makeKeyedConfig();
    saveCredentials(config.credentialKey!, 'sk-openrouter-key');
    expect(isCustomProviderReady(config)).toBe(true);
  });

  it('returns true when requiresApiKey is true and a credential IS stored', () => {
    const config = makeKeyedConfig({ requiresApiKey: true });
    saveCredentials(config.credentialKey!, 'sk-openrouter-key');
    expect(isCustomProviderReady(config)).toBe(true);
  });

  it('returns false when credentialKey is missing and requiresApiKey is not false', () => {
    const config: CustomProviderConfig = {
      kind: 'custom',
      id: 'custom:no-key-field',
      displayName: 'NoKey',
      endpointUrl: 'http://example.com/v1',
      modelString: 'model-a',
      // No credentialKey, no requiresApiKey — treated as requiring a key but having none.
    };
    expect(isCustomProviderReady(config)).toBe(false);
  });
});

// ─── addCustomProvider ────────────────────────────────────────────────────────

describe('addCustomProvider — requiresApiKey field storage', () => {
  it('stores requiresApiKey:false on the returned config when explicitly false', () => {
    const entry = addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });
    expect(entry.requiresApiKey).toBe(false);
  });

  it('persists requiresApiKey:false to localStorage (readable back from roster)', () => {
    addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });
    const roster = getProviderRoster();
    const custom = roster.find((p) => p.kind === 'custom' && p.displayName === 'Ollama');
    expect(custom).toBeDefined();
    expect((custom as CustomProviderConfig).requiresApiKey).toBe(false);
  });

  it('does NOT store requiresApiKey when requiresApiKey is true (field absent from record)', () => {
    const entry = addCustomProvider({
      displayName: 'OpenRouter',
      endpointUrl: 'https://openrouter.ai/api/v1',
      modelString: 'mistralai/mistral-7b-instruct',
      requiresApiKey: true,
    });
    // Field should be absent, not set to true — absence === true is the contract.
    expect('requiresApiKey' in entry).toBe(false);
  });

  it('does NOT store requiresApiKey when requiresApiKey is absent (backwards compatible)', () => {
    const entry = addCustomProvider({
      displayName: 'OpenRouter',
      endpointUrl: 'https://openrouter.ai/api/v1',
      modelString: 'mistralai/mistral-7b-instruct',
      // No requiresApiKey field.
    });
    expect('requiresApiKey' in entry).toBe(false);
  });

  it('persisted record with requiresApiKey absent is absent in roster (backwards compat)', () => {
    addCustomProvider({
      displayName: 'OpenRouter',
      endpointUrl: 'https://openrouter.ai/api/v1',
      modelString: 'mistralai/mistral-7b-instruct',
    });
    const roster = getProviderRoster();
    const custom = roster.find((p) => p.kind === 'custom') as CustomProviderConfig;
    expect('requiresApiKey' in custom).toBe(false);
  });

  it('keyless provider is immediately ready via isCustomProviderReady after add', () => {
    const entry = addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });
    expect(isCustomProviderReady(entry)).toBe(true);
  });

  it('keyed provider is NOT ready immediately after add (no credential stored)', () => {
    const entry = addCustomProvider({
      displayName: 'OpenRouter',
      endpointUrl: 'https://openrouter.ai/api/v1',
      modelString: 'mistralai/mistral-7b-instruct',
    });
    expect(isCustomProviderReady(entry)).toBe(false);
  });
});

// ─── updateCustomProvider ─────────────────────────────────────────────────────

describe('updateCustomProvider — requiresApiKey field storage', () => {
  it('stores requiresApiKey:false when updated to keyless', () => {
    // First add a keyed provider.
    const entry = addCustomProvider({
      displayName: 'MyProvider',
      endpointUrl: 'http://example.com/v1',
      modelString: 'model-a',
    });
    expect('requiresApiKey' in entry).toBe(false);

    // Update it to keyless.
    updateCustomProvider(entry.id, {
      displayName: 'MyProvider',
      endpointUrl: 'http://example.com/v1',
      modelString: 'model-a',
      requiresApiKey: false,
    });

    const roster = getProviderRoster();
    const updated = roster.find((p) => p.kind === 'custom' && p.id === entry.id) as CustomProviderConfig;
    expect(updated.requiresApiKey).toBe(false);
  });

  it('deletes requiresApiKey when updated from keyless to keyed (requiresApiKey:true)', () => {
    // First add a keyless provider.
    const entry = addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });
    expect(entry.requiresApiKey).toBe(false);

    // Update it back to requiring a key.
    updateCustomProvider(entry.id, {
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: true,
    });

    const roster = getProviderRoster();
    const updated = roster.find((p) => p.kind === 'custom' && p.id === entry.id) as CustomProviderConfig;
    // Field must be absent (not set to true) — absence === true is the contract.
    expect('requiresApiKey' in updated).toBe(false);
  });

  it('deletes requiresApiKey when updated without supplying the field (absence === requiring a key)', () => {
    const entry = addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });

    // Update without specifying requiresApiKey — should remove the field.
    updateCustomProvider(entry.id, {
      displayName: 'Ollama Updated',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3.1',
    });

    const roster = getProviderRoster();
    const updated = roster.find((p) => p.kind === 'custom' && p.id === entry.id) as CustomProviderConfig;
    expect('requiresApiKey' in updated).toBe(false);
  });

  it('after updating from keyless to keyed, isCustomProviderReady returns false without stored credential', () => {
    const entry = addCustomProvider({
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: false,
    });

    updateCustomProvider(entry.id, {
      displayName: 'Ollama',
      endpointUrl: 'http://localhost:11434/v1',
      modelString: 'llama3',
      requiresApiKey: true,
    });

    const roster = getProviderRoster();
    const updated = roster.find((p) => p.kind === 'custom' && p.id === entry.id) as CustomProviderConfig;
    expect(isCustomProviderReady(updated)).toBe(false);
  });

  it('after updating from keyed to keyless, isCustomProviderReady returns true', () => {
    const entry = addCustomProvider({
      displayName: 'MyProvider',
      endpointUrl: 'http://example.com/v1',
      modelString: 'model-a',
    });

    updateCustomProvider(entry.id, {
      displayName: 'MyProvider',
      endpointUrl: 'http://example.com/v1',
      modelString: 'model-a',
      requiresApiKey: false,
    });

    const roster = getProviderRoster();
    const updated = roster.find((p) => p.kind === 'custom' && p.id === entry.id) as CustomProviderConfig;
    expect(isCustomProviderReady(updated)).toBe(true);
  });

  it('update is a no-op when id does not exist in roster', () => {
    const rosterBefore = getProviderRoster();
    updateCustomProvider('custom:nonexistent', {
      displayName: 'Ghost',
      endpointUrl: 'http://ghost/v1',
      modelString: 'ghost-model',
      requiresApiKey: false,
    });
    const rosterAfter = getProviderRoster();
    expect(rosterAfter).toEqual(rosterBefore);
  });
});
