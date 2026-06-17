import ashTheme from '../../_design/themes/ash.json';
import chalkTheme from '../../_design/themes/chalk.json';
import emberTheme from '../../_design/themes/ember.json';
import linenTheme from '../../_design/themes/linen.json';
import midnightTheme from '../../_design/themes/midnight.json';
import outrunTheme from '../../_design/themes/outrun.json';
import slateTheme from '../../_design/themes/slate.json';
import type { CustomThemeJSON, ModelAccentColors, ModelId, ThemeId } from '@/types';

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
  // `prose` is not yet in CustomThemeJSON — Arch needs to add it (#TODO).
  // Access via cast until the type is updated; runtime values are present in all 7 theme JSONs.
  const prose = (theme as unknown as { prose: Record<string, string> }).prose;
  if (prose) {
    root.style.setProperty('--prose-link',       prose['link']);
    root.style.setProperty('--prose-link-hover', prose['link-hover']);
  }

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
 * Call this:
 * - On app load, immediately after applyTheme().
 * - On every theme switch, immediately after applyTheme().
 * - Immediately after any setModelAccentColor() call.
 * - Immediately after any clearModelAccentColor() call (pass the current
 *   stored record — the cleared model simply won't be present, so its CSS
 *   var is untouched and reverts to the Pass 1 theme value).
 */
export function applyUserAccentColors(userColors: ModelAccentColors): void {
  const root = document.documentElement;

  const mapping: Record<ModelId, string> = {
    'claude':    '--accent-claude',
    'gpt-5.5':  '--accent-gpt',
    'gemini':   '--accent-gemini',
    'grok':     '--accent-grok',
    'deepseek': '--accent-deepseek',
    'mistral':  '--accent-mistral',
  };

  for (const [modelId, cssVar] of Object.entries(mapping) as [ModelId, string][]) {
    if (userColors[modelId]) {
      root.style.setProperty(cssVar, userColors[modelId]!);
    }
  }
}
