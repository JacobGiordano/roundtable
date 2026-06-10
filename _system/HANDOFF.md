Last updated: 2026-06-10

## Current phase

Phase 4 — 6 model providers live. Color system complete.

## Last closed (this session)

- #24 (Vault): ServerStorageProvider implemented. REST client over fetch, no
  new dependencies. StorageConfig factory and migrateLocalToServer migration
  helper added. 37 new tests, all passing. Lint and build clean.

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

## Next issues in priority order

1. [Gate] Backend auth support (session tokens, login/logout) (#25)
   Gate needs to: read/write a server URL from user prefs, store the auth token
   securely, pass authToken to createStorageProvider({ mode: 'server', baseUrl,
   authToken }). StorageConfig type lives in @/storage/storageFactory.ts —
   Gate imports createStorageProvider from @/storage, NOT the concrete classes.
2. [Luma → Arch → Gate → Aria] User-customizable model accent colors (#38)
3. Self-hosted backend service (#26) — Atlas
4. Open source launch prep (#27)

## Decisions made this session

- StorageConfig type stays internal to /src/storage (not in types/index.ts).
  Gate imports createStorageProvider from @/storage; it does not need the type
  directly unless it needs to construct configs at compile time (it does — see
  above). If Gate needs the type explicitly, Arch should add it to types/index.ts.
- StorageError class lives in /src/storage/StorageError.ts and is exported from
  /src/storage/index.ts. Gate and Aria can catch StorageError by name.
- migrateLocalToServer() takes concrete class instances (not the interface)
  because LocalStorageProvider is the only source and ServerStorageProvider is
  the only target. If this needs to be more generic, refactor then.
- exportConversation on ServerStorageProvider delegates to the backend; the
  backend returns ExportedConversation JSON. The backend must implement
  GET /conversations/:id/export?format=<format>.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- useConversationStore still hard-wires LocalStorageProvider (providerRef.current =
  new LocalStorageProvider()). Phase 4 wiring: Gate passes StorageConfig to
  useConversationStore (requires Arch + Aria work to thread the prop/context).
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY exported from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null for missing conversations — always null-check before download
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI components now auto-update
