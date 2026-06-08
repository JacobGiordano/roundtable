# roundtable

## Development environment

This project uses a VS Code dev container that pre-installs Node 20, the GitHub
CLI, and Claude Code, and applies a network firewall that restricts outbound
traffic to approved API endpoints.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
and [VS Code](https://code.visualstudio.com/) with the
[Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

**Getting started:**

1. Open the repository in VS Code.
2. When prompted, click **Reopen in Container** (or run
   `Dev Containers: Reopen in Container` from the command palette).
3. Wait for the container to build and the firewall to initialize.
4. Open a terminal inside VS Code and run:
   ```
   claude --dangerously-skip-permissions
   ```
   The container + sandbox boundaries make this safe — no host credentials are
   mounted, and outbound network access is allowlisted.
5. Start the dev server with `npm run dev`. The app is available at
   `http://localhost:5173`.

> **Note — OpenAI connection failures mid-session:** The firewall resolves
> `api.openai.com` to a set of IPs at container start. OpenAI's CDN can rotate
> those IPs during a long session, causing intermittent network errors. If that
> happens, restart the container to re-resolve. No code change needed.
