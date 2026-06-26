import ashTheme from '../../_design/themes/ash.json';
import chalkTheme from '../../_design/themes/chalk.json';
import emberTheme from '../../_design/themes/ember.json';
import linenTheme from '../../_design/themes/linen.json';
import midnightTheme from '../../_design/themes/midnight.json';
import outrunTheme from '../../_design/themes/outrun.json';
import slateTheme from '../../_design/themes/slate.json';
import type { CustomThemeJSON, ModelAccentColors, ModelId, ProviderRoster, ThemeId } from '@/types';
// #152: MODEL_ACCENT_CSS_VARS is the single source of truth for modelId → CSS var name.
// Extracted from this file into utils/modelColor.ts so AccentColorPicker can share it.
// #286: sanitizeCustomAccentId converts a custom provider ID to a valid CSS ident segment.
import { MODEL_ACCENT_CSS_VARS, sanitizeCustomAccentId } from './utils/modelColor';

/**
 * Static lookup map from ThemeId to the corresponding theme JSON.
 * Vite requires static imports — no dynamic import() for JSON assets.
 * Shared by main.tsx (boot) and Sidebar.tsx (theme switcher).
 */
export const THEME_MAP: Record<ThemeId, CustomThemeJSON> = {
  ash: ashTheme as CustomThemeJSON,
  chalk: chalkTheme as CustomThemeJSON,
  ember: emberTheme as CustomThemeJSON,
  linen: linenTheme as CustomThemeJSON,
  midnight: midnightTheme as CustomThemeJSON,
  outrun: outrunTheme as CustomThemeJSON,
  slate: slateTheme as CustomThemeJSON,
};

/**
 * All theme IDs in display order for the theme switcher.
 */
export const THEME_IDS: ThemeId[] = ['slate', 'midnight', 'ash', 'chalk', 'linen', 'ember', 'outrun'];

/**
 * Applies a theme's design tokens as CSS custom properties on :root.
 * Call this at app startup and whenever the user switches themes.
 */
export function applyTheme(theme: CustomThemeJSON): void {
  const root = document.documentElement;

  // Surfaces
  root.style.setProperty('--surface-bg',      theme.surfaces.background);
  root.style.setProperty('--surface-card',    theme.surfaces.card);
  root.style.setProperty('--surface-sidebar', theme.surfaces.sidebar);
  root.style.setProperty('--surface-input',   theme.surfaces.input);

  // Text
  root.style.setProperty('--text-primary',   theme.text.primary);
  root.style.setProperty('--text-secondary', theme.text.secondary);
  root.style.setProperty('--text-muted',     theme.text.muted);
  root.style.setProperty('--text-inverse',   theme.text.inverse);

  // Borders
  root.style.setProperty('--border-default', theme.borders.default);
  root.style.setProperty('--border-subtle',  theme.borders.subtle);
  root.style.setProperty('--border-strong',  theme.borders.strong);

  // Accents
  root.style.setProperty('--accent-claude',    theme.accents['model-claude']);
  root.style.setProperty('--accent-gpt',       theme.accents['model-gpt']);
  root.style.setProperty('--accent-gemini',    theme.accents['model-gemini']);
  root.style.setProperty('--accent-other',     theme.accents['model-other']);

  // Wave-2 model accents
  root.style.setProperty('--accent-grok',      theme.accents['model-grok']);
  root.style.setProperty('--accent-deepseek',  theme.accents['model-deepseek']);
  root.style.setProperty('--accent-mistral',   theme.accents['model-mistral']);

  // User message identity accent (Pass 1 — theme default).
  // `accents.user` is present in all 7 built-in themes but not yet in the
  // CustomThemeJSON type (Arch tracks this in a follow-up). The cast handles
  // custom-imported themes that pre-date this key; fallback is periwinkle #A5B4FC.
  const accentUser = (theme.accents as Record<string, string | undefined>)['user'];
  root.style.setProperty('--accent-user', accentUser ?? '#A5B4FC');

  // Interactive
  root.style.setProperty('--interactive-hover',  theme.interactive.hover);
  root.style.setProperty('--interactive-active', theme.interactive.active);
  root.style.setProperty('--interactive-focus',  theme.interactive.focusRing);

  // Semantic
  root.style.setProperty('--semantic-success',  theme.semantic.success);
  root.style.setProperty('--semantic-warning',  theme.semantic.warning);
  root.style.setProperty('--semantic-error',    theme.semantic.error);
  root.style.setProperty('--semantic-error-bg', theme.semantic['error-bg']);
  root.style.setProperty('--semantic-info',     theme.semantic.info);

  // Radius
  root.style.setProperty('--radius-sm',   theme.radius.sm);
  root.style.setProperty('--radius-md',   theme.radius.md);
  root.style.setProperty('--radius-lg',   theme.radius.lg);
  root.style.setProperty('--radius-full', theme.radius.full);

  // Shadow
  root.style.setProperty('--shadow-none', theme.shadow.none);
  root.style.setProperty('--shadow-sm',   theme.shadow.sm);
  root.style.setProperty('--shadow-md',   theme.shadow.md);
  root.style.setProperty('--shadow-lg',   theme.shadow.lg);

  // Timing
  root.style.setProperty('--timing-instant', theme.timing.instant);
  root.style.setProperty('--timing-fast',    theme.timing.fast);
  root.style.setProperty('--timing-medium',  theme.timing.medium);
  root.style.setProperty('--timing-slow',    theme.timing.slow);

  // Prose markdown tokens (Luma spec: _design/specs/markdown.md)
  // All 7 prose fields wired here per #169 (previously only link and link-hover were set).
  root.style.setProperty('--prose-code-bg',           theme.prose['code-bg']);
  root.style.setProperty('--prose-code-border',       theme.prose['code-border']);
  root.style.setProperty('--prose-code-text',         theme.prose['code-text']);
  root.style.setProperty('--prose-block-bg',          theme.prose['block-bg']);
  root.style.setProperty('--prose-link',              theme.prose.link);
  root.style.setProperty('--prose-link-hover',        theme.prose['link-hover']);
  root.style.setProperty('--prose-blockquote-border', theme.prose['blockquote-border']);

  // Data attributes for CSS selectors that need mode-awareness
  root.setAttribute('data-theme', theme.name.toLowerCase());
  root.setAttribute('data-mode',  theme.mode);
}

/**
 * Pass 2 of the two-pass color application.
 * Overwrites CSS custom properties on :root for every model that has a
 * user-chosen accent color stored. Models absent from userColors keep the
 * theme default already set by applyTheme (Pass 1).
 *
 * Built-in providers: uses MODEL_ACCENT_CSS_VARS (static map).
 * Custom providers: dynamically sets --accent-custom-{sanitized-id}.
 *   Gate's getModelAccentColors() currently strips custom IDs on read
 *   (documented design for the current phase). Callers that need to apply
 *   a custom provider's live-session override must merge the hex into the
 *   record before calling this function (see AccentColorPicker.saveColor).
 *
 * Call this:
 * - On app load, immediately after applyTheme() and applyRosterAccentColors().
 * - On every theme switch, same order.
 * - Immediately after any setModelAccentColor() call.
 * - Immediately after any clearModelAccentColor() call (pass the current
 *   stored record — the cleared model simply won't be present, so its CSS
 *   var is untouched and reverts to the roster default or theme value).
 */
export function applyUserAccentColors(userColors: ModelAccentColors): void {
  const root = document.documentElement;

  // Built-in providers: iterate the static CSS var map.
  for (const [modelId, cssVar] of Object.entries(MODEL_ACCENT_CSS_VARS) as [ModelId, string][]) {
    if (userColors[modelId]) {
      root.style.setProperty(cssVar, userColors[modelId]!);
    }
  }

  // Custom providers: set --accent-custom-{sanitized-id} for any ID not in
  // MODEL_ACCENT_CSS_VARS. Gate strips custom IDs from getModelAccentColors(),
  // so these entries only arrive when the caller has merged them manually
  // (AccentColorPicker does this for live-session picks).
  for (const [modelId, hex] of Object.entries(userColors)) {
    if ((modelId as string) in MODEL_ACCENT_CSS_VARS || !hex) continue;
    root.style.setProperty(`--accent-custom-${sanitizeCustomAccentId(modelId)}`, hex);
  }
}

/**
 * Initialises --accent-custom-{id} CSS variables from the provider roster.
 * Called at app boot (after applyTheme) and on roster change so every custom
 * provider has a CSS var that rosterToModelConfigs can reference by token name.
 *
 * Resolution order for each custom provider:
 *   1. roster.color is a hex string  → used directly
 *   2. roster.color is a CSS token   → wrapped as var(--{token})
 *   3. roster.color absent           → var(--accent-other) fallback
 *
 * applyUserAccentColors should be called immediately after this to overlay
 * any AccentColorPicker overrides on top of the roster defaults.
 *
 * Call this:
 * - On app load, between applyTheme() and applyUserAccentColors().
 * - On every theme switch, same position.
 * - After handleRosterChange() re-derives models (roster may have new colors).
 */
export function applyRosterAccentColors(roster: ProviderRoster): void {
  const root = document.documentElement;
  for (const entry of roster) {
    if (entry.kind !== 'custom') continue;
    const varName = `--accent-custom-${sanitizeCustomAccentId(entry.id)}`;
    const rosterColor = entry.color ?? 'accent-other';
    if (rosterColor.startsWith('#')) {
      root.style.setProperty(varName, rosterColor);
    } else {
      root.style.setProperty(varName, `var(--${rosterColor})`);
    }
  }
}

/**
 * Pass 2 of the user message accent override.
 * If the user stored a custom hex via Gate's setUserAccentColor(), it overrides
 * the theme default set by applyTheme (Pass 1). When storedHex is null (no
 * stored override), this is a no-op — applyTheme() already set --accent-user
 * via setProperty, and calling removeProperty here would strip it entirely,
 * leaving no value on load (the bug this fixes).
 *
 * Callers that need to restore the theme default (e.g. "Reset to theme default")
 * must call applyTheme(currentTheme) before calling applyUserMessageColor(null).
 *
 * Call this:
 * - On app load, after applyTheme() and after applyUserAccentColors().
 * - On every theme switch, same order.
 * - Immediately after setUserAccentColor() — pass the new hex.
 * - After clearUserAccentColor() — pass null (no-op; applyTheme already set the default).
 */
export function applyUserMessageColor(storedHex: string | null): void {
  const root = document.documentElement;
  if (storedHex !== null) {
    root.style.setProperty('--accent-user', storedHex);
  }
  // No else — when storedHex is null, applyTheme() already set --accent-user.
  // removeProperty would strip the inline style, leaving no value at runtime.
}
