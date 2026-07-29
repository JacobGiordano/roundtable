# Security Policy

## Supported versions

The latest commit on `main` is the only supported version.

## Reporting a vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Email **jacob.giordano12@gmail.com** with:

- A description of the vulnerability and where it appears
- Steps to reproduce (the more specific the better)
- Potential impact

We will respond within 7 days. Please give us reasonable time to investigate and fix the issue before public disclosure.

## Scope

Areas of particular interest:

- **API key handling** — keys are stored in `localStorage` and should never be logged, exported without user consent, or transmitted anywhere except the provider's official API endpoint
- **Model output rendering** — markdown from model responses is rendered via `react-markdown`; XSS must remain impossible
- **Cloudflare Workers proxy** (`/workers/index.js`) — should not log or store API keys or conversation content
- **Optional self-hosted backend** (`/backend/`) — API auth, rate limiting, SQL injection surface
