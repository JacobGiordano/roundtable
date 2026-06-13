/**
 * Integration: MODEL_REGISTRY completeness guard
 *
 * Regression guard for issue #87. Verifies that every entry in MODEL_REGISTRY
 * has all required ModelRegistryEntry fields populated, and that the PROVIDERS
 * array stays in sync with the registry. A misconfigured entry (missing name,
 * empty availableVersions, etc.) is otherwise undetectable until runtime.
 *
 * This test should fail loudly the moment a developer adds a new model entry
 * without fully populating all fields, or adds a provider to PROVIDERS without
 * a matching registry entry (or vice versa).
 *
 * Source contracts exercised:
 *   MODEL_REGISTRY: ModelRegistryEntry[] — Atlas (registry.ts)
 *   PROVIDERS: ModelProvider[]           — Atlas (registry.ts)
 *   ModelProviderConfig                  — Arch (types/index.ts)
 *   ModelRegistryEntry                   — Atlas (registry.ts, local interface)
 */

import { describe, it, expect } from 'vitest';
import { MODEL_REGISTRY, PROVIDERS } from '@/models/registry';

// ─── ModelRegistryEntry completeness ─────────────────────────────────────────

describe('MODEL_REGISTRY — entry completeness', () => {
  it('registry is non-empty', () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0);
  });

  it('every entry has a truthy modelId', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(entry.modelId, `modelId missing on entry: ${JSON.stringify(entry)}`).toBeTruthy();
    }
  });

  it('every entry has a truthy name', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(entry.name, `name missing on entry for modelId "${entry.modelId}"`).toBeTruthy();
    }
  });

  it('every entry has a truthy providerName', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(
        entry.providerName,
        `providerName missing on entry for modelId "${entry.modelId}"`
      ).toBeTruthy();
    }
  });

  it('every entry has a truthy color', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(entry.color, `color missing on entry for modelId "${entry.modelId}"`).toBeTruthy();
    }
  });

  it('every entry has a boolean defaultActive field', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(
        typeof entry.defaultActive,
        `defaultActive missing or wrong type on entry for modelId "${entry.modelId}"`
      ).toBe('boolean');
    }
  });

  it('every entry has a non-empty availableVersions array', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(
        Array.isArray(entry.availableVersions),
        `availableVersions is not an array on entry for modelId "${entry.modelId}"`
      ).toBe(true);
      expect(
        entry.availableVersions.length,
        `availableVersions is empty on entry for modelId "${entry.modelId}"`
      ).toBeGreaterThan(0);
    }
  });

  it('every availableVersions entry has a truthy id and displayName', () => {
    for (const entry of MODEL_REGISTRY) {
      for (const version of entry.availableVersions) {
        expect(
          version.id,
          `version.id missing in availableVersions for modelId "${entry.modelId}"`
        ).toBeTruthy();
        expect(
          version.displayName,
          `version.displayName missing in availableVersions for modelId "${entry.modelId}", version id "${version.id}"`
        ).toBeTruthy();
      }
    }
  });
});

// ─── No duplicates ────────────────────────────────────────────────────────────

describe('MODEL_REGISTRY — no duplicates', () => {
  it('no two entries share the same modelId', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of MODEL_REGISTRY) {
      if (seen.has(entry.modelId)) {
        duplicates.push(entry.modelId);
      }
      seen.add(entry.modelId);
    }

    expect(
      duplicates,
      `Duplicate modelId(s) found in MODEL_REGISTRY: ${duplicates.join(', ')}`
    ).toHaveLength(0);
  });

  it('no two entries share the same color token', () => {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];

    for (const entry of MODEL_REGISTRY) {
      if (seen.has(entry.color)) {
        conflicts.push(`"${entry.modelId}" and "${seen.get(entry.color)}" both use color "${entry.color}"`);
      }
      seen.set(entry.color, entry.modelId);
    }

    expect(
      conflicts,
      `Duplicate color token(s) in MODEL_REGISTRY:\n${conflicts.join('\n')}`
    ).toHaveLength(0);
  });
});

// ─── PROVIDERS sync ───────────────────────────────────────────────────────────

describe('PROVIDERS — sync with MODEL_REGISTRY', () => {
  it('PROVIDERS length matches MODEL_REGISTRY length', () => {
    expect(PROVIDERS.length).toBe(MODEL_REGISTRY.length);
  });

  it('every PROVIDERS entry has a config object', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config,
        `provider missing config: ${JSON.stringify(provider)}`
      ).toBeDefined();
    }
  });

  it('every PROVIDERS entry config has a truthy modelId', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.modelId,
        `config.modelId missing on provider`
      ).toBeTruthy();
    }
  });

  it('every PROVIDERS entry config has a truthy name', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.name,
        `config.name missing on provider for modelId "${provider.config.modelId}"`
      ).toBeTruthy();
    }
  });

  it('every PROVIDERS entry config has a truthy color', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.color,
        `config.color missing on provider for modelId "${provider.config.modelId}"`
      ).toBeTruthy();
    }
  });

  it('every PROVIDERS entry config has a truthy credentialKey', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.credentialKey,
        `config.credentialKey missing on provider for modelId "${provider.config.modelId}"`
      ).toBeTruthy();
    }
  });

  it('every modelId in PROVIDERS has a matching entry in MODEL_REGISTRY', () => {
    const registryIds = new Set(MODEL_REGISTRY.map((e) => e.modelId));

    for (const provider of PROVIDERS) {
      expect(
        registryIds.has(provider.config.modelId),
        `PROVIDERS contains modelId "${provider.config.modelId}" with no corresponding MODEL_REGISTRY entry`
      ).toBe(true);
    }
  });

  it('every modelId in MODEL_REGISTRY has a matching entry in PROVIDERS', () => {
    const providerIds = new Set(PROVIDERS.map((p) => p.config.modelId));

    for (const entry of MODEL_REGISTRY) {
      expect(
        providerIds.has(entry.modelId),
        `MODEL_REGISTRY contains modelId "${entry.modelId}" with no corresponding PROVIDERS entry`
      ).toBe(true);
    }
  });
});

// ─── ModelProviderConfig field set ───────────────────────────────────────────

describe('PROVIDERS — ModelProviderConfig has no unexpected nulls or empty strings', () => {
  it('config.name is a non-empty string (not whitespace-only)', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.name.trim().length,
        `config.name is blank on provider for modelId "${provider.config.modelId}"`
      ).toBeGreaterThan(0);
    }
  });

  it('config.color is a non-empty string (not whitespace-only)', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.color.trim().length,
        `config.color is blank on provider for modelId "${provider.config.modelId}"`
      ).toBeGreaterThan(0);
    }
  });

  it('config.credentialKey is a non-empty string (not whitespace-only)', () => {
    for (const provider of PROVIDERS) {
      expect(
        provider.config.credentialKey.trim().length,
        `config.credentialKey is blank on provider for modelId "${provider.config.modelId}"`
      ).toBeGreaterThan(0);
    }
  });
});
