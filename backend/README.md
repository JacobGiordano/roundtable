# Roundtable Backend

Self-hosted REST backend for [Roundtable](../README.md) — a browser-based
multi-model AI conversation interface. Enables conversation sync, persistence
across devices, and optional multi-user support.

The backend is **optional**. The Roundtable frontend works entirely in the
browser using `localStorage` by default. This backend is for users who want
server-side persistence, cross-device sync, or the ability to self-host on
a shared server.

---

## Quick start (Docker Compose)

1. Copy the example env file and edit it:

   ```bash
   cp .env.example .env
   ```

   At minimum, change `JWT_SECRET` to a long random string:

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

   Also change `ADMIN_PASSWORD` before exposing the server to the network.

2. Start the backend:

   ```bash
   docker compose up -d
   ```

3. Verify it is running:

   ```bash
   curl http://localhost:3001/health
   # → {"status":"ok"}
   ```

4. Log in to get a token:

   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"changeme"}'
   # → {"token":"<jwt>"}
   ```

5. Configure the Roundtable frontend to use the backend by providing the
   server URL and the JWT token in the Settings panel.

---

## Manual run (without Docker)

Requirements: Node.js 20+, npm.

```bash
cd backend/
npm install
npm run build
cp .env.example .env    # edit .env with your values
node dist/index.js
```

For development with auto-reload:

```bash
npm run dev
```

---

## Environment variables

All variables are set in `.env` (copied from `.env.example`). Docker Compose
reads this file automatically.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `JWT_SECRET` | — | **Required.** Secret for signing JWTs. Must be changed in production. |
| `DATABASE_PATH` | `./roundtable.db` | Path to the SQLite database file. In Docker the default is `/app/data/roundtable.db`. |
| `ADMIN_USERNAME` | `admin` | Username for the admin account created on first startup. |
| `ADMIN_PASSWORD` | `changeme` | Password for the admin account. **Change before deploying.** |
| `CORS_ORIGIN` | `*` | Value for the `Access-Control-Allow-Origin` header. Set to your frontend URL in production (e.g. `https://roundtable.example.com`). |

---

## Endpoint reference

### Auth (unprotected)

#### `POST /auth/login`

Validate credentials and issue a 7-day JWT.

**Request body:**
```json
{ "username": "admin", "password": "changeme" }
```

**Response `200`:**
```json
{ "token": "<jwt>" }
```

**Response `400`:**
```json
{ "error": "username and password are required" }
```

**Response `401`:**
```json
{ "error": "invalid credentials" }
```

---

#### `POST /auth/refresh`

Issue a fresh 7-day JWT. Requires a valid token in the `Authorization` header.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{ "token": "<new-jwt>" }
```

**Response `401`:**
```json
{ "error": "unauthorized" }
```

> **Note:** The previous token is not invalidated. Both the old and new token
> remain valid until their respective 7-day expiry. If you need immediate
> revocation, restart the server (all outstanding JWTs become invalid when
> `JWT_SECRET` is rotated).

---

### Conversations (all require `Authorization: Bearer <token>`)

#### `GET /conversations`

List all conversations, newest-first.

Optional query param: `?archived=true` — return only archived conversations.

**Response `200`:** Array of `Conversation` objects.

---

#### `GET /conversations/:id`

Get a single conversation.

**Response `200`:** `Conversation` object.
**Response `404`:** `{ "error": "not_found" }`

---

#### `PUT /conversations/:id`

Create or replace a conversation (upsert).

**Request body:** Full `Conversation` JSON object.

**Response `200`:** `{ "ok": true }`

---

#### `DELETE /conversations/:id`

Delete a conversation. Idempotent — returns `204` even if the record did not exist.

**Response `204`:** (no body)

---

#### `PATCH /conversations/:id`

Archive or unarchive a conversation.

**Request body:**
```json
{ "archived": true }
```
or
```json
{ "archived": false }
```

**Response `200`:** `{ "ok": true }`
**Response `404`:** `{ "error": "not_found" }`

---

#### `GET /conversations/:id/export?format=<format>`

Export a conversation in the requested format.

**Supported formats:** `json`, `markdown`, `html`

**Response `200`:** `ExportedConversation` object:
```json
{
  "content": "...",
  "filename": "my-conversation.md",
  "mimeType": "text/markdown;charset=utf-8"
}
```

**Response `404`:** `{ "error": "not_found" }`
**Response `400`:** `{ "error": "invalid_format", "message": "..." }`

> **Note:** `markdown` and `html` exports are basic implementations. The
> markdown export renders speaker labels and message content as plain text.
> The HTML export wraps the markdown in a minimal HTML document. Rich
> formatting (syntax highlighting, proper styling, conversation metadata
> tables) is a future enhancement.

---

### Health

#### `GET /health`

No auth required. Returns `{ "status": "ok" }` when the server is running.

---

## Database

The backend uses a single SQLite file (default: `roundtable.db`). Two tables:

- **`conversations`** — one row per conversation; the full `Conversation` JSON
  is stored in the `data` column as a blob. The `archived` column mirrors
  `archivedAt` in the JSON for efficient SQL filtering.
- **`users`** — username + bcrypt-hashed password.

No migration tooling is included — the schema is created with `CREATE TABLE IF NOT EXISTS`
on startup. If you need to add columns in a future version, run the ALTER TABLE
statements manually against the SQLite file, or delete the database file and
re-import your conversations.

---

## Security notes

- **Change `JWT_SECRET` and `ADMIN_PASSWORD`** before exposing the server
  to the internet. The defaults are intentionally weak.
- **`CORS_ORIGIN`** defaults to `*` for local self-hosting convenience. Set it
  to your frontend origin in any internet-facing deployment.
- Passwords are stored as bcrypt hashes (12 rounds). Plaintext passwords are
  never logged or stored.
- API keys for AI providers (Anthropic, OpenAI, etc.) are handled exclusively
  by the Roundtable frontend in `localStorage`. They are never sent to this
  backend.
