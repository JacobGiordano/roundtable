# Deploy Roundtable in 5 minutes

Roundtable runs entirely in your browser — no server required. Built-in AI
providers (Claude, GPT, Gemini, and others) can't be called directly from a
browser page because of a browser security rule called
[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS). The
fix is a small free proxy service that forwards your requests on your behalf.
This guide walks you through setting one up.

## What you'll need

- A free [Cloudflare](https://cloudflare.com) account (you'll create one in
  Step 1 if you don't have one)
- API keys for whichever AI providers you want to use (Claude, GPT, Gemini,
  etc.) — you can get these from each provider's developer console

---

## Step 1 — Deploy your proxy

The proxy is a small script that runs on Cloudflare's free tier. You don't
need to write or edit any code. Cloudflare is a free service — you only need
an account, no credit card required.

1. Click the **Deploy to Cloudflare** button:

   [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JacobGiordano/roundtable&dir=workers)

2. Cloudflare will ask you to log in or create a free account.

3. You'll land on a **Set up your application** form. Fill it out as follows:

   - **Git account** — Connect your GitHub account when prompted. Cloudflare
     uses this to create a repository and deploy the proxy code automatically.
     Every push to the production branch will redeploy.

   - **Project name** — Defaults to `roundtable`. Leave it or rename it —
     this only affects the URL Cloudflare assigns to your Worker.

   - **VITE_BASE, VITE_PRICING_URL, VITE_ANTHROPIC_PROXY_URL,
     VITE_OPENAI_PROXY_URL** — Leave all four fields blank. These variables
     are for the main Roundtable frontend app, not the proxy Worker. The
     proxy needs no environment variables.

   - **Builds for non-production branches** and **Advanced settings** — Leave
     these alone.

4. Click **Deploy**. Cloudflare builds and deploys the proxy in about 30 seconds.

5. After deployment, find your Worker URL in the Cloudflare dashboard — it
   looks like `roundtable.yoursubdomain.workers.dev`. **Copy the full URL
   including `https://`** — you'll paste it into the app in the next step.

> **What the proxy does:** it forwards your API requests to the AI provider
> and adds the headers that make your browser accept the response. It does not
> log headers or body content. Your API keys and conversation content are never
> stored by the proxy. See [`/workers/index.js`](../workers/index.js) if you
> want to read the full source.

---

## Step 2 — Configure the app

1. Go to **[https://jacobgiordano.github.io/roundtable](https://jacobgiordano.github.io/roundtable)**.

2. Open **Settings** (the gear icon in the top right).

3. Go to **Connection Proxy**.

4. Paste your `*.workers.dev` URL and click **Save**.

5. Click **Test** — you should see "Connected."

> **If the test fails:** double-check that you copied the full URL including
> `https://`. If you deployed to a custom Cloudflare domain, use that URL
> instead.

---

## Step 3 — Add your API keys

1. Still in Settings, go to **API Keys**.

2. Add keys for whichever providers you want to use (Claude, GPT, Gemini,
   Grok, Mistral).

3. Your keys are stored in your browser only — they are never sent anywhere
   except directly to the AI provider through your proxy.

---

**You're done.** Start a conversation. The proxy setup is permanent — you
won't need to repeat these steps unless you clear your browser storage or
switch to a different browser.

---

## Free tier limits

- **Cloudflare Workers free tier:** 100,000 requests per day — sufficient for
  personal use. Shared across all Workers in your account.
- **GitHub Pages:** free for public repositories.

If you exceed the Cloudflare free tier, you can upgrade to the Workers Paid
plan ($5/month) for 10 million requests.

---

## Optional: self-hosted backend

If you want conversations synced across devices or shared with a team, the
self-hosted backend adds server-side session storage. See
[`/backend/README.md`](../backend/README.md) for Docker Compose setup.

The self-hosted backend runs alongside the GitHub Pages frontend — you point
the app's backend URL setting at your own server.

> **Required for cross-origin deployments:** set `CORS_ORIGIN` in your backend
> `.env` to the exact frontend origin before starting the server:
>
> ```
> CORS_ORIGIN=https://app.example.com
> ```
>
> Without this, the browser blocks all cross-origin requests to the backend.
> There is no wildcard default — if `CORS_ORIGIN` is unset, the backend logs a
> warning at startup and cross-origin access fails.

---

## Custom providers without a proxy

Custom OpenAI-compatible endpoints that support browser-direct CORS calls do
not need a proxy. Examples: [OpenRouter](https://openrouter.ai) and a locally
running [Ollama](https://ollama.com) instance.

Add them via **Settings → Providers → Add Custom Provider**. Use the full
endpoint URL (e.g. `https://openrouter.ai/api/v1`). The proxy URL setting has
no effect on custom providers.
