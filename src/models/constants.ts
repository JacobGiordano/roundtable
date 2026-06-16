/**
 * Atlas — constants.ts
 *
 * Centralised output-token limits for every built-in provider.
 *
 * Each constant is the maximum number of output tokens the provider's API
 * will accept in a single request. Values are sourced from each provider's
 * published documentation (August 2025).
 *
 * IMPORTANT: These are *output* token limits, not context-window sizes.
 *
 * Provider notes
 * ──────────────
 * Claude (Anthropic)
 *   claude-opus-4:   up to 32 000 output tokens
 *   claude-sonnet-4: up to 16 000 output tokens  ← default model ceiling
 *   claude-haiku-4:  up to  8 192 output tokens
 *   We request 16 000 — the lowest shared ceiling for the non-Haiku Claude 4
 *   models. Haiku will cap internally if needed; Opus supports more but this
 *   keeps the default meaningful for the most-used model.
 *
 * GPT / OpenAI
 *   gpt-5.5, gpt-4o, gpt-4o-mini: 16 384 output tokens
 *   o3 / o1 series use max_completion_tokens, but those models accept this
 *   field too — the API ignores it or maps it accordingly.
 *
 * Gemini (Google)
 *   gemini-2.5-flash: 8 192 output tokens (default model)
 *   gemini-2.5-pro:   65 536 output tokens
 *   We use the Flash ceiling as a conservative shared default; the Flash
 *   model is the default version in MODEL_REGISTRY.
 *
 * Grok (xAI)
 *   grok-3, grok-3-mini: 16 384 output tokens
 *
 * DeepSeek
 *   deepseek-chat, deepseek-reasoner: 8 192 output tokens
 *
 * Mistral
 *   mistral-large-latest, mistral-small-latest, open-mistral-nemo: 8 192 output tokens
 *
 * Generic (custom OpenAI-compatible providers)
 *   Unknown endpoint — use 8 192 as a safe conservative default.
 *   Per the note in generic.ts, per-provider overrides via CustomProviderConfig
 *   are a future phase extension.
 */

/** Anthropic Claude 4 series — 16 000 output tokens (sonnet-4 ceiling). */
export const MAX_TOKENS_CLAUDE = 16_000;

/** OpenAI GPT-5.5 / GPT-4o series — 16 384 output tokens. */
export const MAX_TOKENS_GPT = 16_384;

/**
 * Google Gemini — 8 192 output tokens.
 * Matches the default gemini-2.5-flash ceiling.
 */
export const MAX_TOKENS_GEMINI = 8_192;

/** xAI Grok 3 — 16 384 output tokens. */
export const MAX_TOKENS_GROK = 16_384;

/** DeepSeek — 8 192 output tokens. */
export const MAX_TOKENS_DEEPSEEK = 8_192;

/** Mistral — 8 192 output tokens. */
export const MAX_TOKENS_MISTRAL = 8_192;

/**
 * Generic / custom OpenAI-compatible providers — 8 192 output tokens.
 * Conservative default; individual endpoints may support more.
 */
export const MAX_TOKENS_GENERIC = 8_192;
