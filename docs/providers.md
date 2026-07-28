# Provider reference

Roundtable ships with six built-in providers and supports any number of custom
OpenAI-compatible endpoints. This page covers how to obtain API keys, where
they are stored, and current provider status.

## How API keys are stored

API keys are stored exclusively in your browser's `localStorage` under the key
prefix `roundtable:key:<provider>` (for example, `roundtable:key:anthropic`).
They are:

- **Never logged** — not to the console, not to any file
- **Never exported** — not via conversation export, not via settings transfer
- **Never transmitted** to any destination other than the respective provider's
  official API endpoint (or your proxy, if configured)

Clearing your browser storage removes all stored keys. There is no server-side
copy unless you are running the optional self-hosted backend with backend
authentication enabled.

---

## Built-in providers

### Claude (Anthropic)

| | |
|---|---|
| **Credential key** | `anthropic` |
| **Key format** | `sk-ant-…` |
| **Get a key** | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Status** | Active |

Available model versions: Claude Opus 4, Claude Sonnet 4, Claude Haiku 4.
Live model discovery is available via the Anthropic `/v1/models` endpoint when
a proxy is configured (CORS blocks browser-direct requests without one).

---

### GPT (OpenAI)

| | |
|---|---|
| **Credential key** | `openai` |
| **Key format** | `sk-…` |
| **Get a key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Status** | Active |

Available model versions: GPT-5.6, GPT-5.5, GPT-4o, GPT-4o mini, o3, o1,
o1-mini, GPT Image 2 (native image generation), GPT Image 1 (deprecated
October 23, 2026).

Live model discovery falls back to OpenRouter (no key required) then to a
bundled `models.json` snapshot when no live endpoint is reachable.

---

### Gemini (Google)

| | |
|---|---|
| **Credential key** | `google` |
| **Key format** | `AIza…` |
| **Get a key** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| **Status** | Active |

Available model versions: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash
Image (native image generation — "Nano Banana" — produces text and images).

Live model discovery uses Google's `/v1beta/models` endpoint. The Gemini
provider uses query-parameter auth (`key=<api-key>`) rather than a bearer
token header.

---

### Grok (xAI)

| | |
|---|---|
| **Credential key** | `xai` |
| **Key format** | `xai-…` |
| **Get a key** | [console.x.ai/team/default/api-keys](https://console.x.ai/team/default/api-keys) |
| **Status** | Active |

Available model versions: Grok 3, Grok 3 mini, Grok 2.

---

### Mistral (Mistral AI)

| | |
|---|---|
| **Credential key** | `mistral` |
| **Key format** | (varies) |
| **Get a key** | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/) |
| **Status** | Active |

Available model versions: Mistral Large, Mistral Small, Mistral Nemo
(open-weight, 12B parameters).

---

### DeepSeek

| | |
|---|---|
| **Credential key** | `deepseek` |
| **Key format** | `sk-…` |
| **Get a key** | [platform.deepseek.com/api-keys](https://platform.deepseek.com/api-keys) |
| **Status** | Active |

Available model versions:

| Model ID | Display name | Notes |
|---|---|---|
| `deepseek-v4-flash` | DeepSeek V4 Flash | Fast — default |
| `deepseek-v4-pro` | DeepSeek V4 Pro | Extended thinking, 1M context |

---

## Custom providers (OpenAI-compatible)

You can add any OpenAI-compatible endpoint via **Settings → Providers → Add
Custom Provider**. Custom providers support:

- Inline credential entry and testing
- Per-provider capability toggles (vision, image generation)
- Model version strings entered manually

**Examples that work without a proxy:**

- [OpenRouter](https://openrouter.ai) — `https://openrouter.ai/api/v1`
- A locally running [Ollama](https://ollama.com) instance — `http://localhost:11434/v1`

These endpoints support browser-direct CORS calls and do not require the
Cloudflare Workers proxy. Other custom endpoints that do not support CORS
from a browser origin will need a proxy URL set in **Settings → Connection
Proxy**.

---

## Proxy configuration

Built-in providers (Claude, OpenAI, Gemini, Grok, Mistral) cannot be called
directly from a browser page because of CORS restrictions. You need a proxy.
See [docs/deployment.md](deployment.md) for the five-minute Cloudflare Workers
proxy setup.

When a proxy URL is configured, all built-in provider requests are routed
through it. The proxy URL setting has no effect on custom providers that
already support browser-direct CORS.
