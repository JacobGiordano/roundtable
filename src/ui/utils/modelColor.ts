/**
 * /src/ui/utils/modelColor.ts
 *
 * Shared color-resolution utilities for model identity dots and accent colors.
 *
 * Two concerns live here together because they share the same built-in color
 * mapping and both need to be updated in lockstep when a new provider is added:
 *
 *   1. MODEL_ACCENT_CSS_VARS — maps built-in modelId → CSS custom property name.
 *      Consumed by theme.ts (applyUserAccentColors) and AccentColorPicker.
 *      Previously duplicated in both files; single source of truth here.
 *
 *   2. getModelDotStyle / getModelAccentCssValue — resolves the CSS color value
 *      for a model identity dot given only a modelId string. Previously each of
 *      Sidebar, ModelSelectorPanel, and ProviderSettingsPanel had its own inline
 *      implementation; they all import from here now.
 *
 * Cross-agent imports:
 *   - getProviderRoster from @/auth — Gate persistence utility; permitted per
 *     CLAUDE.md exception for pure Gate read functions called by Aria.
 */

import type { ModelId } from '@/types';
// Gate cross-agent exception: getProviderRoster is a pure Gate persistence
// utility (reads from localStorage). Permitted per CLAUDE.md exception rule —
// Aria may call Gate read functions when it needs roster data for display.
import { getProviderRoster } from '@/auth';

// ─── Built-in accent token names ─────────────────────────────────────────────

/**
 * Static color token names for the six built-in providers.
 * Values are the CSS custom property suffix — prepend `--` to get the var name
 * (e.g. 'accent-claude' → '--accent-claude' → 'var(--accent-claude)').
 *
 * Kept as a minimal local map rather than importing MODEL_REGISTRY so this
 * utility does not pull in Atlas runtime provider code (sendMessage, streaming,
 * etc.) as a side effect. Display metadata only.
 */
const BUILTIN_COLOR_TOKEN: Partial<Record<string, string>> = {
  'claude':    'accent-claude',
  'gpt-5.5':  'accent-gpt',
  'gemini':   'accent-gemini',
  'grok':     'accent-grok',
  'deepseek': 'accent-deepseek',
  'mistral':  'accent-mistral',
};

// ─── #152 — Consolidated modelId → CSS variable name map ─────────────────────

/**
 * Maps each built-in ModelId to its CSS custom property name on :root.
 * Used by theme.ts (applyUserAccentColors) and AccentColorPicker.
 *
 * GPT's CSS var is '--accent-gpt' (not '--accent-gpt-5.5') because CSS property
 * names may not contain dots — hence the explicit mapping rather than a derivation.
 *
 * Previously defined independently in both files; this is the single source of
 * truth. Both files now import from here.
 */
export const MODEL_ACCENT_CSS_VARS: Record<ModelId, string> = {
  'claude':    '--accent-claude',
  'gpt-5.5':  '--accent-gpt',
  'gemini':   '--accent-gemini',
  'grok':     '--accent-grok',
  'deepseek': '--accent-deepseek',
  'mistral':  '--accent-mistral',
};

// ─── #286 — Custom provider CSS var name sanitization ────────────────────────

/**
 * Sanitizes a custom provider ID for use in a CSS custom-property name.
 *
 * CSS custom property names are ident-sequences: letters, digits, hyphens,
 * and underscores are reliably safe. Gate-generated IDs contain colons
 * (e.g. "custom:openrouter-1") which are not valid in idents; they are
 * replaced with hyphens here.
 *
 * Usage: `--accent-custom-${sanitizeCustomAccentId(modelId)}`
 *
 * This function is the single source of truth for the sanitization rule —
 * applyUserAccentColors (theme.ts), applyRosterAccentColors (theme.ts),
 * and rosterToModelConfigs (App.tsx) all import it so their CSS var names
 * stay in sync.
 */
export function sanitizeCustomAccentId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ─── #148 — Shared dot color resolution ──────────────────────────────────────

/**
 * Resolve the CSS color value for a model identity dot given its modelId.
 *
 * Resolution order:
 *   1. Built-in model IDs → var(--accent-{token}) via BUILTIN_COLOR_TOKEN
 *   2. Custom provider IDs → read getProviderRoster() and use the stored color:
 *        - Hex string (e.g. "#FF5500") → returned as-is
 *        - CSS token (e.g. "accent-other") → wrapped as var(--accent-other)
 *        - Absent → var(--accent-other) fallback
 *   3. Any unrecognized ID → var(--accent-other)
 *
 * Returns a CSS color string suitable for use in backgroundColor or similar.
 */
export function getModelAccentCssValue(modelId: string): string {
  // Built-in check first — no roster lookup needed.
  const builtinToken = BUILTIN_COLOR_TOKEN[modelId];
  if (builtinToken) {
    return `var(--${builtinToken})`;
  }

  // Custom provider — look up roster for its stored color.
  const roster = getProviderRoster();
  const custom = roster.find(
    (p) => p.kind === 'custom' && p.id === modelId,
  );
  if (custom && custom.kind === 'custom' && custom.color) {
    const c = custom.color;
    // Hex color (e.g. "#FF5500") — use directly.
    if (c.startsWith('#')) return c;
    // CSS token (e.g. "accent-other") — wrap in var().
    return `var(--${c})`;
  }

  // Final fallback.
  return 'var(--accent-other)';
}

/**
 * Returns an inline React style object for a model identity dot.
 * Convenience wrapper around getModelAccentCssValue for use with the style prop.
 *
 * Usage: <span style={getModelDotStyle(model.modelId)} />
 */
export function getModelDotStyle(modelId: string): React.CSSProperties {
  return { backgroundColor: getModelAccentCssValue(modelId) };
}
