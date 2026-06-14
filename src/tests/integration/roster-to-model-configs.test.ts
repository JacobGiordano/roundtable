/**
 * Integration: rosterToModelConfigs
 *
 * Tests the pure mapping function that converts a ProviderRoster (Gate's
 * persisted provider list) into a ModelConfig[] (Aria's model selector state).
 * This function is the join point between Gate's roster data and Aria's runtime
 * UI state — a critical cross-agent contract.
 *
 * Cross-agent contract exercised:
 *   ProviderRoster / BuiltInProviderConfig / CustomProviderConfig — Arch types
 *   ModelConfig — Arch type
 *   MODEL_REGISTRY — Atlas static registry (name/color/versions per built-in)
 *   getModelVersion() — Gate persistence (selectedVersionId seed on boot)
 *
 * Mocking strategy: mock at the module boundary — @/models (for MODEL_REGISTRY)
 * and @/auth (for getModelVersion). These are the two external dependencies the
 * function calls. We do not mock the function itself; we test its behavior
 * given controlled registry and persistence state.
 *
 * rosterToModelConfigs is exported from App.tsx for testability. It is a pure
 * utility — no React, no side effects, no DOM needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Must be declared before the import that uses them. Vitest hoists vi.mock()
// calls to the top of the file, so the mock factories run before module init.

vi.mock('@/models', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/models')>();
  return {
    ...original,
    MODEL_REGISTRY: [
      {
        modelId: 'claude',
        name: 'Claude',
        providerName: 'Anthropic',
        color: 'accent-claude',
        defaultActive: true,
        availableVersions: [
          { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4' },
        ],
      },
      {
        modelId: 'gpt-5.5',
        name: 'GPT-5.5',
        providerName: 'OpenAI',
        color: 'accent-gpt',
        defaultActive: true,
        availableVersions: [
          { id: 'gpt-5.5', displayName: 'GPT-5.5' },
        ],
      },
    ],
  };
});

vi.mock('@/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/auth')>();
  return {
    ...original,
    getModelVersion: vi.fn().mockReturnValue(undefined),
    getProviderRoster: vi.fn().mockReturnValue([]),
  };
});

// Also mock @/storage and @/ui/AppLayout to prevent full component tree setup
// when App.tsx module is imported. rosterToModelConfigs has no deps on these,
// but App's module-level code pulls in the full application tree.
vi.mock('@/storage', () => ({
  useConversationStore: vi.fn().mockReturnValue({
    conversations: [],
    activeConversationId: null,
    isLoading: false,
    storageError: null,
    getActiveConversation: vi.fn().mockReturnValue(undefined),
    updateConversation: vi.fn(),
    createConversation: vi.fn(),
    setActiveConversation: vi.fn(),
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    setConversationGroup: vi.fn(),
    exportConversation: vi.fn(),
  }),
  downloadExportedConversation: vi.fn(),
}));

vi.mock('@/ui/AppLayout', () => ({
  AppLayout: () => null,
}));

// ─── Import the function under test ───────────────────────────────────────────

import { rosterToModelConfigs } from '@/App';
import { getModelVersion } from '@/auth';

// ─── Typed helpers ────────────────────────────────────────────────────────────

import type {
  BuiltInProviderConfig,
  CustomProviderConfig,
  ModelConfig,
  ProviderRoster,
} from '@/types';

const mockGetModelVersion = getModelVersion as ReturnType<typeof vi.fn>;

// ─── Roster builder helpers ────────────────────────────────────────────────────

function builtIn(
  modelId: BuiltInProviderConfig['modelId'],
  credentialKey: BuiltInProviderConfig['credentialKey'] = 'anthropic',
): BuiltInProviderConfig {
  return { kind: 'builtin', modelId, credentialKey, isVisible: true };
}

function custom(
  id: string,
  displayName: string,
  color?: string,
): CustomProviderConfig {
  return {
    kind: 'custom',
    id,
    displayName,
    endpointUrl: 'https://example.com/v1/chat/completions',
    credentialKey: `custom:${id}`,
    modelString: 'some-model',
    color,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetModelVersion.mockReturnValue(undefined);
});

describe('rosterToModelConfigs — empty roster', () => {
  it('returns [] when roster is empty', () => {
    const result = rosterToModelConfigs([], []);
    expect(result).toEqual([]);
  });

  it('returns [] when roster is empty regardless of prevModels', () => {
    const prev: ModelConfig[] = [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    ];
    const result = rosterToModelConfigs([], prev);
    expect(result).toEqual([]);
  });
});

describe('rosterToModelConfigs — built-in provider', () => {
  it('uses name from MODEL_REGISTRY for a known built-in', () => {
    const roster: ProviderRoster = [builtIn('claude')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.name).toBe('Claude');
  });

  it('uses color from MODEL_REGISTRY for a known built-in', () => {
    const roster: ProviderRoster = [builtIn('claude')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.color).toBe('accent-claude');
  });

  it('sets isActive to false for a new built-in provider', () => {
    const roster: ProviderRoster = [builtIn('claude')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.isActive).toBe(false);
  });

  it('seeds selectedVersionId from getModelVersion when a version is stored', () => {
    mockGetModelVersion.mockReturnValue('claude-opus-4-8');
    const roster: ProviderRoster = [builtIn('claude')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.selectedVersionId).toBe('claude-opus-4-8');
  });

  it('leaves selectedVersionId undefined when getModelVersion returns undefined', () => {
    mockGetModelVersion.mockReturnValue(undefined);
    const roster: ProviderRoster = [builtIn('claude')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.selectedVersionId).toBeUndefined();
  });

  it('falls back to modelId as name when entry is absent from MODEL_REGISTRY', () => {
    // 'grok' is not in the mocked MODEL_REGISTRY (only claude and gpt-5.5 are)
    const roster: ProviderRoster = [builtIn('grok', 'xai')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.name).toBe('grok');
  });

  it('falls back to accent-other when color is absent from MODEL_REGISTRY', () => {
    const roster: ProviderRoster = [builtIn('grok', 'xai')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.color).toBe('accent-other');
  });

  it('maps the modelId correctly onto the output config', () => {
    const roster: ProviderRoster = [builtIn('gpt-5.5', 'openai')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.modelId).toBe('gpt-5.5');
  });
});

describe('rosterToModelConfigs — custom provider', () => {
  it('uses displayName from the roster entry', () => {
    const roster: ProviderRoster = [custom('openrouter-1', 'OpenRouter Llama')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.name).toBe('OpenRouter Llama');
  });

  it('uses the custom id as modelId', () => {
    const roster: ProviderRoster = [custom('openrouter-1', 'OpenRouter Llama')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.modelId).toBe('openrouter-1');
  });

  it('uses the provided color when present', () => {
    const roster: ProviderRoster = [custom('local-1', 'Local Ollama', '#FF5500')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.color).toBe('#FF5500');
  });

  it('falls back to accent-other when color is absent', () => {
    const roster: ProviderRoster = [custom('local-1', 'Local Ollama')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.color).toBe('accent-other');
  });

  it('sets isActive to false for a new custom provider', () => {
    const roster: ProviderRoster = [custom('openrouter-1', 'OpenRouter Llama')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.isActive).toBe(false);
  });

  it('leaves selectedVersionId undefined (custom providers have no version registry)', () => {
    const roster: ProviderRoster = [custom('openrouter-1', 'OpenRouter Llama')];
    const [config] = rosterToModelConfigs(roster, []);
    expect(config.selectedVersionId).toBeUndefined();
  });
});

describe('rosterToModelConfigs — preserving existing ModelConfig state', () => {
  it('returns the existing ModelConfig unchanged when the modelId is in prevModels', () => {
    const prev: ModelConfig[] = [
      {
        modelId: 'claude',
        name: 'Claude',
        color: 'accent-claude',
        isActive: true,
        systemPrompt: 'You are a pirate.',
        selectedVersionId: 'claude-opus-4-8',
      },
    ];
    const roster: ProviderRoster = [builtIn('claude')];
    const [result] = rosterToModelConfigs(roster, prev);
    expect(result).toBe(prev[0]); // exact same object reference — not a copy
  });

  it('preserves isActive: true for an already-active model', () => {
    const prev: ModelConfig[] = [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    ];
    const [result] = rosterToModelConfigs([builtIn('claude')], prev);
    expect(result.isActive).toBe(true);
  });

  it('preserves systemPrompt for an existing model', () => {
    const prev: ModelConfig[] = [
      {
        modelId: 'gpt-5.5',
        name: 'GPT-5.5',
        color: 'accent-gpt',
        isActive: false,
        systemPrompt: 'Be concise.',
      },
    ];
    const [result] = rosterToModelConfigs([builtIn('gpt-5.5', 'openai')], prev);
    expect(result.systemPrompt).toBe('Be concise.');
  });

  it('preserves selectedVersionId from prev over what getModelVersion would return', () => {
    mockGetModelVersion.mockReturnValue('claude-haiku-4-5-20251001');
    const prev: ModelConfig[] = [
      {
        modelId: 'claude',
        name: 'Claude',
        color: 'accent-claude',
        isActive: true,
        selectedVersionId: 'claude-opus-4-8', // user's runtime choice
      },
    ];
    const [result] = rosterToModelConfigs([builtIn('claude')], prev);
    // prev wins — we return the existing config as-is
    expect(result.selectedVersionId).toBe('claude-opus-4-8');
  });
});

describe('rosterToModelConfigs — new models start inactive even when prev has entries', () => {
  it('new built-in not in prev starts inactive', () => {
    const prev: ModelConfig[] = [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    ];
    // Add gpt-5.5 to the roster — not yet in prev
    const roster: ProviderRoster = [builtIn('claude'), builtIn('gpt-5.5', 'openai')];
    const results = rosterToModelConfigs(roster, prev);
    const gpt = results.find((m) => m.modelId === 'gpt-5.5');
    expect(gpt).toBeDefined();
    expect(gpt!.isActive).toBe(false);
  });

  it('new custom provider not in prev starts inactive', () => {
    const prev: ModelConfig[] = [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    ];
    const roster: ProviderRoster = [builtIn('claude'), custom('router-1', 'Router')];
    const results = rosterToModelConfigs(roster, prev);
    const router = results.find((m) => m.modelId === 'router-1');
    expect(router).toBeDefined();
    expect(router!.isActive).toBe(false);
  });

  it('existing model in prev retains its isActive state when surrounded by new models', () => {
    const prev: ModelConfig[] = [
      { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    ];
    const roster: ProviderRoster = [
      builtIn('gpt-5.5', 'openai'), // new
      builtIn('claude'),             // existing
      custom('router-1', 'Router'),  // new
    ];
    const results = rosterToModelConfigs(roster, prev);
    const claudeResult = results.find((m) => m.modelId === 'claude');
    expect(claudeResult!.isActive).toBe(true);
  });
});

describe('rosterToModelConfigs — output ordering', () => {
  it('output order matches roster order', () => {
    const roster: ProviderRoster = [
      builtIn('gpt-5.5', 'openai'),
      builtIn('claude'),
      custom('router-1', 'Router'),
    ];
    const results = rosterToModelConfigs(roster, []);
    expect(results.map((m) => m.modelId)).toEqual(['gpt-5.5', 'claude', 'router-1']);
  });
});
