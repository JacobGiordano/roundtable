# Roundtable Proxy Worker

This is a Cloudflare Workers script that acts as a CORS proxy for the Roundtable frontend. Because browser security blocks direct cross-origin requests to most AI provider APIs, Roundtable routes those calls through this worker — which you deploy to your own Cloudflare account. The worker receives requests from the browser, adds the appropriate CORS headers, and forwards them to the upstream provider. Your API keys stay in the browser; they are sent directly in the forwarded request headers, never stored by the worker.

---

## Deploy to Cloudflare (one click)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JacobGiordano/roundtable&dir=workers)

---

## After deploying

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
2. Click on the deployed worker (named `roundtable-proxy` by default).
3. Copy the URL shown under **Routes** — it looks like `roundtable-proxy.<your-subdomain>.workers.dev`.
4. In the Roundtable app, open **Settings** and paste the URL into the **Connection Proxy** field.

Roundtable will route all provider API calls through your worker from that point on.

---

## Manual deploy (CLI)

If you prefer the command line:

```bash
cd workers
wrangler deploy
```

A one-time `wrangler login` is required before the first deploy.

---

## Free tier

Cloudflare Workers free tier includes **100,000 requests per day**. For personal use this is sufficient — each message turn generates one request per model.
