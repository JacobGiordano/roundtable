# Roundtable

A browser-based multi-model AI conversation interface. Talk with multiple AI
models simultaneously in a shared chat thread — compare responses, direct
follow-ups to specific models, and manage long conversations with full session
persistence.

## Hosted version

**[→ Open Roundtable](https://jacobgiordano.github.io/roundtable)** — no install required.

First time? Built-in providers need a one-time free proxy setup (~2 minutes).
See the [deployment guide](docs/deployment.md) to get started.

## Features

**Conversation modes**
- **Parallel broadcast** — send a message to all active models at once and see
  responses side by side
- **Directed replies** — address a follow-up to one specific model without
  losing thread context
- **Auto-chain** — models respond in sequence, each seeing prior answers;
  order shuffled per pass for fairness
- **Stop streaming** — cancel in-flight responses from all active models
  at any time

**Messages**
- **Markdown rendering** — headings, code blocks, lists, and inline formatting
  rendered in all responses
- **Image attachments & vision** — attach via clip button, drag-and-drop, or
  paste; vision warning shown when addressing a non-vision provider
- **Message actions** — copy, inline edit, and retry available on every
  message bubble
- **Smart scroll** — auto-scroll pauses when you scroll up to read; resumes
  when you return to the bottom

**Models & providers**
- **Six built-in providers** — Claude (Anthropic), GPT-5.5 (OpenAI), Gemini
  (Google), Grok (xAI), DeepSeek, and Mistral
- **Custom OpenAI-compatible providers** — add any compatible endpoint
  (OpenRouter, Ollama, etc.) with inline edit, credential test, and capability
  toggles
- **Model version picker** — choose the specific API model string per provider
- **Accent color customization** — set a distinct color per model for
  at-a-glance differentiation
- **Token count display** — per-message usage shown in the nameplate; toggle
  visibility in settings

**Conversations**
- **Session persistence** — conversations saved to localStorage; exportable as
  Markdown or HTML (images optional)
- **Conversation management** — search/filter, rename, per-model visibility
  toggle, and sidebar grouping
- **Ghost mode** — browse and export past sessions without creating new history

**UI & setup**
- **Seven built-in themes** — 2 light (Chalk, Linen) and 5 dark (Ash, Ember,
  Midnight, Outrun, Slate)
- **Custom theme import** — import a theme via JSON (must pass the full token
  schema)
- **Mobile-responsive layout** — collapsible sidebar drawer on mobile with
  proper touch targets
- **Onboarding** — guided first-run experience when no providers are configured
- **Setup transfer** — export your provider configuration (API keys excluded)
  and import it on another device
- **Self-hostable backend** — optional Express + SQLite backend for shared or
  persistent server-side storage
- **Client-side first** — API keys stay in your browser; never transmitted
  except directly to each provider's official API endpoint

## Quick start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/) with the
  [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Run in dev container (recommended)

1. Clone the repository and open it in VS Code.
2. When prompted, click **Reopen in Container** (or run
   `Dev Containers: Reopen in Container` from the command palette).
3. Wait for the container to build. The firewall initializes automatically and
   restricts outbound traffic to approved API endpoints only.
4. Open a terminal inside VS Code and start the dev server:
   ```
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.
6. Add at least one API key in the Settings panel and start a conversation.

### Run locally (without dev container)

Requirements: Node 24+

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Add at least one API key in the Settings panel and
start a conversation.

> **Note — OpenAI connection failures mid-session:** The dev container firewall
> resolves `api.openai.com` to a set of IPs at container start time. OpenAI's
> CDN can rotate those IPs during a long session, causing intermittent network
> errors. Restart the container to re-resolve. No code change needed.

> **Note — personal VS Code extensions:** `.devcontainer/devcontainer.json`
> includes a few extensions beyond the project essentials (e.g.
> `man-vu.claude-code-usage-dashboard`). If you don't want them, remove the
> relevant entries from the `customizations.vscode.extensions` array before
> building the container. The project requires only `anthropic.claude-code`,
> `dbaeumer.vscode-eslint`, and `esbenp.prettier-vscode`.

## Self-hosted backend (optional)

A standalone Express + SQLite backend is included in `/backend/` for teams or
individuals who want server-side session storage instead of localStorage.

```bash
cd backend
npm install
npm run dev
```

See [`/backend/README.md`](backend/README.md) for full setup, Docker Compose
instructions, and environment variables.

A pre-built backend image is published to
`ghcr.io/jacobgiordano/roundtable` on GitHub Container Registry (`:latest`
and version tags). The frontend is a static build and does not have a
container image.

If you want to use the GitHub Pages–hosted frontend with a self-hosted backend
instead of running everything locally, see the [deployment guide](docs/deployment.md).

## Development

```bash
npm run dev        # start dev server (http://localhost:5173)
npm run build      # type-check + production build
npm run lint       # ESLint (zero warnings policy)
npm test           # Vitest watch mode
npm run test:run   # Vitest single run
npm run typecheck  # tsc --noEmit
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the agent-based development model,
directory ownership rules, and how to submit changes.

## License

[MIT](LICENSE)
