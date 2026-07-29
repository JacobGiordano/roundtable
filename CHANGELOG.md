# Changelog

All notable changes to Roundtable are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — 2026-07-29

### Added

**Conversation modes**
- Parallel broadcast — send a message to all active models simultaneously
- Directed reply — address a follow-up to one specific model
- Auto-chain — models respond in sequence, each seeing prior answers; order shuffled per pass
- Stop streaming — cancel all in-flight responses at any time

**Messages**
- Markdown rendering (headings, code blocks, lists, inline formatting, GFM tables)
- Image attachments via clip button, drag-and-drop, or paste; vision warning for non-vision providers
- Image generation via `gpt-image-2` (GPT) and `gemini-2.5-flash-image` (Gemini)
- Copy as markdown or plain text; inline edit and retry on every message
- Smart scroll — auto-scroll pauses when reading history, resumes at bottom
- Per-message token usage display with toggle

**Models and providers**
- Six built-in providers: Claude (Anthropic), GPT (OpenAI), Gemini (Google), Grok (xAI), Mistral, DeepSeek V4
- Custom OpenAI-compatible provider support (OpenRouter, Ollama, etc.) with inline edit, credential test, and capability toggles
- Live model version picker — model lists fetched from each provider's API
- Accent color customization per model

**Conversations**
- localStorage persistence with export as Markdown or HTML (images optional)
- Search, rename, per-model visibility toggle, and sidebar grouping
- System prompt per conversation, persisted with conversation state
- Ghost mode — browse and export history without saving new state
- Setup transfer — export and import provider configuration across devices

**UI and accessibility**
- Seven themes: Chalk, Linen (light); Ash, Ember, Midnight, Outrun, Slate (dark)
- Custom theme import via JSON
- Mobile-responsive layout with collapsible sidebar drawer
- Guided onboarding for first-time setup
- WCAG 2.1 AA keyboard accessibility across all interactive elements and themes

**Infrastructure**
- Cloudflare Workers CORS proxy for browser-based API calls (one-click deploy)
- Optional self-hosted Express + SQLite backend for shared or persistent storage
- Pre-built backend image on GitHub Container Registry (`ghcr.io/jacobgiordano/roundtable`)
