# Roundtable

A browser-based multi-model AI conversation interface. Talk with multiple AI
models simultaneously in a shared chat thread — compare responses, direct
follow-ups to specific models, and manage long conversations with full session
persistence.

## Features

- **Parallel broadcast** — send a message to all active models at once and see
  responses side by side
- **Directed replies** — address a follow-up to one specific model without
  losing context from the others
- **Multiple providers** — Claude (Anthropic), GPT (OpenAI), Gemini (Google),
  Grok (xAI), DeepSeek, and Mistral supported out of the box
- **Session persistence** — conversations saved to localStorage; exportable as
  Markdown or HTML
- **Ghost mode** — browse and export past sessions without creating new history
- **Accent color customization** — set a distinct color per model so responses
  are visually distinct at a glance
- **Self-hostable backend** — optional Express + SQLite backend for shared or
  persistent server-side storage
- **Seven built-in themes** — including light, dark, and high-contrast variants
- **Client-side first** — API keys stay in your browser's localStorage; never
  transmitted except directly to each provider's official API endpoint

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

Requirements: Node 20+

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
