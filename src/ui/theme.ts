import type { CustomThemeJSON } from '@/types';

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
  root.style.setProperty('--accent-claude',  theme.accents['model-claude']);
  root.style.setProperty('--accent-gpt',     theme.accents['model-gpt']);
  root.style.setProperty('--accent-gemini',  theme.accents['model-gemini']);
  root.style.setProperty('--accent-other',   theme.accents['model-other']);

  // Interactive
  root.style.setProperty('--interactive-hover',  theme.interactive.hover);
  root.style.setProperty('--interactive-active', theme.interactive.active);
  root.style.setProperty('--interactive-focus',  theme.interactive.focusRing);

  // Semantic
  root.style.setProperty('--semantic-success', theme.semantic.success);
  root.style.setProperty('--semantic-warning', theme.semantic.warning);
  root.style.setProperty('--semantic-error',   theme.semantic.error);
  root.style.setProperty('--semantic-info',    theme.semantic.info);

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

  // Data attributes for CSS selectors that need mode-awareness
  root.setAttribute('data-theme', theme.name.toLowerCase());
  root.setAttribute('data-mode',  theme.mode);
}
