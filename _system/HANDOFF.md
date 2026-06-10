Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.

## Last closed

- #44 (Scout): First integration test pass. 4 integration test files, 64 new
  tests covering ghost mode + storage, storage lifecycle, auth + models error
  paths, and streaming chunk accumulation. Baseline before: 1032 tests.
  Baseline after: 1096 tests. All pass; lint and build clean.

## In progress

None. All known issues closed.

## Decisions made this session

- Test infrastructure lives in src/tests/{integration,regression,fixtures}.
- Fixtures pattern: localStorage mocked via buildLocalStorageMock() (Map-backed,
  global assignment, restore on afterEach). No jsdom, no @testing-library/react.
- FakeStreamingProvider and FakeErrorProvider in fixtures/mockProviders.ts for
  streaming invariant tests. Real providers used for auth-failure path tests.
- @testing-library/react not installed — React hook layer (useConversationStore,
  useGhostMode) is untested at hook level. See gap report in PR.

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with ModelId union
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry
- React hook layer (useConversationStore, useGhostMode) needs @testing-library/react
  + jsdom before it can be integration-tested; neither is in devDependencies.

## Next issues in priority order

1. Add @testing-library/react + jsdom so Scout can test the React hook layer
   (useConversationStore state transitions, useGhostMode toggle flow, isLoading
   state during initial load, storageError surfacing).
2. Regression test suite for known bugs as they are fixed.
3. Ada — accessibility audit of the chat interface (src/tests/a11y/).
