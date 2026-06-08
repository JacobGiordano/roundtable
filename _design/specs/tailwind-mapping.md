# Roundtable Tailwind Token Mapping

This document tells Aria exactly how each design token maps to a CSS custom property and a Tailwind configuration key. Aria wires this up in `tailwind.config.js` and sets the CSS custom properties on `:root` at theme load time.

---

## How It Works

1. **Theme load**: When the app loads (or user switches themes), JavaScript reads the active theme JSON and writes each token as a CSS custom property on `:root`.
2. **Tailwind config**: `tailwind.config.js` extends the theme with custom values that reference those CSS custom properties via `var(--...)`.
3. **Usage**: Aria uses Tailwind utility classes in JSX. No hardcoded hex values, no inline styles.

---

## CSS Custom Property Naming Convention

Format: `--{category}-{key}` where category and key match the token schema.

Examples:
- `surfaces.background` → `--surface-bg`
- `text.primary` → `--text-primary`
- `accents.model-claude` → `--accent-claude`
- `timing.slow` → `--timing-slow`

Full mapping below.

---

## Surfaces

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `surfaces.background` | `--surface-bg` | `colors.bg` | `bg-bg` |
| `surfaces.card` | `--surface-card` | `colors.card` | `bg-card` |
| `surfaces.sidebar` | `--surface-sidebar` | `colors.sidebar` | `bg-sidebar` |
| `surfaces.input` | `--surface-input` | `colors.input` | `bg-input` |

---

## Text

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `text.primary` | `--text-primary` | `colors.text-primary` | `text-text-primary` |
| `text.secondary` | `--text-secondary` | `colors.text-secondary` | `text-text-secondary` |
| `text.muted` | `--text-muted` | `colors.text-muted` | `text-text-muted` |
| `text.inverse` | `--text-inverse` | `colors.text-inverse` | `text-text-inverse` |

**Note**: Tailwind's `text-{color}` utility uses `colors.{key}`. The `text-` prefix in the key name means the full class is `text-text-primary`. This is intentional — it's verbose but unambiguous. Aria may alias these in `tailwind.config.js` if the double-prefix bothers her (e.g. map `colors.fg` to `--text-primary`). If she aliases, she documents the alias here.

---

## Borders

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `borders.default` | `--border-default` | `colors.border` | `border-border` |
| `borders.subtle` | `--border-subtle` | `colors.border-subtle` | `border-border-subtle` |
| `borders.strong` | `--border-strong` | `colors.border-strong` | `border-border-strong` |

---

## Accents (Model Colors)

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `accents.model-claude` | `--accent-claude` | `colors.accent-claude` | `bg-accent-claude`, `border-accent-claude`, `text-accent-claude` |
| `accents.model-gpt` | `--accent-gpt` | `colors.accent-gpt` | `bg-accent-gpt`, `border-accent-gpt`, `text-accent-gpt` |
| `accents.model-gemini` | `--accent-gemini` | `colors.accent-gemini` | `bg-accent-gemini`, `border-accent-gemini`, `text-accent-gemini` |
| `accents.model-other` | `--accent-other` | `colors.accent-other` | `bg-accent-other`, `border-accent-other`, `text-accent-other` |

**Note**: These are the most heavily used tokens in the UI. The left border accent on message bubbles, the dot in pills, and the streaming indicator all use these. Because model identity is load-bearing, these values should never be hardcoded — always reference the token.

---

## Interactive

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `interactive.hover` | `--interactive-hover` | `colors.hover` | `bg-hover`, `hover:bg-hover` |
| `interactive.active` | `--interactive-active` | `colors.active` | `bg-active`, `active:bg-active` |
| `interactive.focusRing` | `--interactive-focus` | `colors.focus` | Used in `ring-focus` |

**Note on focusRing**: Tailwind uses `ring-{color}` for focus rings. Map `colors.focus` and use `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` as the standard focus pattern.

---

## Semantic

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `semantic.success` | `--semantic-success` | `colors.success` | `text-success`, `bg-success` |
| `semantic.warning` | `--semantic-warning` | `colors.warning` | `text-warning`, `bg-warning` |
| `semantic.error` | `--semantic-error` | `colors.error` | `text-error`, `bg-error` |
| `semantic.info` | `--semantic-info` | `colors.info` | `text-info`, `bg-info` |

---

## Radius

These map to Tailwind's `borderRadius` extension. Values are fixed and do not change per theme.

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `radius.sm` | `--radius-sm` | `borderRadius.sm` | `rounded-sm` |
| `radius.md` | `--radius-md` | `borderRadius.md` | `rounded-md` |
| `radius.lg` | `--radius-lg` | `borderRadius.lg` | `rounded-lg` |
| `radius.full` | `--radius-full` | `borderRadius.full` | `rounded-full` |

**Note**: Tailwind already has `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full` with different values. Aria must **override** these in `tailwind.config.js` to use the token values (`4px`, `8px`, `12px`, `9999px`) rather than Tailwind's defaults (`2px`, `4px`, `6px`, `9999px`). This is intentional — the design system owns these values.

---

## Spacing

These extend Tailwind's `spacing` scale. The token keys match Tailwind's numeric scale intentionally.

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `spacing.1` (4px) | `--spacing-1` | Built-in (Tailwind `spacing.1` = 4px) | `p-1`, `m-1`, `gap-1` |
| `spacing.2` (8px) | `--spacing-2` | Built-in (Tailwind `spacing.2` = 8px) | `p-2`, `m-2`, `gap-2` |
| `spacing.3` (12px) | `--spacing-3` | Built-in (Tailwind `spacing.3` = 12px) | `p-3`, `m-3`, `gap-3` |
| `spacing.4` (16px) | `--spacing-4` | Built-in (Tailwind `spacing.4` = 16px) | `p-4`, `m-4`, `gap-4` |
| `spacing.6` (24px) | `--spacing-6` | Built-in (Tailwind `spacing.6` = 24px) | `p-6`, `m-6`, `gap-6` |
| `spacing.8` (32px) | `--spacing-8` | Built-in (Tailwind `spacing.8` = 32px) | `p-8`, `m-8`, `gap-8` |
| `spacing.12` (48px) | `--spacing-12` | Built-in (Tailwind `spacing.12` = 48px) | `p-12`, `m-12` |
| `spacing.16` (64px) | `--spacing-16` | Built-in (Tailwind `spacing.16` = 64px) | `p-16`, `m-16` |

**Good news**: Tailwind's default spacing scale (`spacing.1` = 4px, `spacing.2` = 8px, etc.) already matches Roundtable's 4-point base. No custom config needed for spacing. Aria uses standard Tailwind spacing classes directly.

**Note**: Do not set CSS custom properties for spacing — they're not needed since Tailwind's built-in values match.

---

## Shadow

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `shadow.none` | `--shadow-none` | `boxShadow.none` | `shadow-none` |
| `shadow.sm` | `--shadow-sm` | `boxShadow.sm` | `shadow-sm` |
| `shadow.md` | `--shadow-md` | `boxShadow.md` | `shadow-md` |
| `shadow.lg` | `--shadow-lg` | `boxShadow.lg` | `shadow-lg` |

**Note**: Tailwind already has `shadow-sm`, `shadow-md`, `shadow-lg` but with different values. Aria **overrides** these in `tailwind.config.js` to use the CSS custom properties. This ensures Outrun's neon glow shadows are applied correctly when the Outrun theme is active.

```js
// tailwind.config.js excerpt
boxShadow: {
  none: 'none',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
}
```

---

## Timing

These are used in custom CSS (not standard Tailwind utilities) but are included in the CSS custom property set for consistency.

| Token | CSS Custom Property | Usage |
|-------|---------------------|-------|
| `timing.instant` | `--timing-instant` | `transition-duration: var(--timing-instant)` in component CSS |
| `timing.fast` | `--timing-fast` | `transition-duration: var(--timing-fast)` |
| `timing.medium` | `--timing-medium` | `transition-duration: var(--timing-medium)` |
| `timing.slow` | `--timing-slow` | `transition-duration: var(--timing-slow)` |

**Note**: Tailwind's `transitionDuration` utilities don't map cleanly to these values. Aria should extend `tailwind.config.js` with:
```js
transitionDuration: {
  instant: 'var(--timing-instant)',   // 0ms
  fast: 'var(--timing-fast)',          // 100ms
  medium: 'var(--timing-medium)',      // 200ms
  slow: 'var(--timing-slow)',          // 350ms
}
```
Usage: `duration-fast`, `duration-medium`, `duration-slow`.

---

## Complete `tailwind.config.js` Extension Block

Aria should merge this into her `tailwind.config.js`:

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        'bg':              'var(--surface-bg)',
        'card':            'var(--surface-card)',
        'sidebar':         'var(--surface-sidebar)',
        'input':           'var(--surface-input)',
        // Text
        'text-primary':    'var(--text-primary)',
        'text-secondary':  'var(--text-secondary)',
        'text-muted':      'var(--text-muted)',
        'text-inverse':    'var(--text-inverse)',
        // Borders
        'border':          'var(--border-default)',
        'border-subtle':   'var(--border-subtle)',
        'border-strong':   'var(--border-strong)',
        // Accents
        'accent-claude':   'var(--accent-claude)',
        'accent-gpt':      'var(--accent-gpt)',
        'accent-gemini':   'var(--accent-gemini)',
        'accent-other':    'var(--accent-other)',
        // Interactive
        'hover':           'var(--interactive-hover)',
        'active':          'var(--interactive-active)',
        'focus':           'var(--interactive-focus)',
        // Semantic
        'success':         'var(--semantic-success)',
        'warning':         'var(--semantic-warning)',
        'error':           'var(--semantic-error)',
        'info':            'var(--semantic-info)',
      },
      borderRadius: {
        'sm':   'var(--radius-sm)',    // 4px
        'md':   'var(--radius-md)',    // 8px
        'lg':   'var(--radius-lg)',    // 12px
        'full': 'var(--radius-full)',  // 9999px
      },
      boxShadow: {
        'none': 'none',
        'sm':   'var(--shadow-sm)',
        'md':   'var(--shadow-md)',
        'lg':   'var(--shadow-lg)',
      },
      transitionDuration: {
        'instant': 'var(--timing-instant)',  // 0ms
        'fast':    'var(--timing-fast)',      // 100ms
        'medium':  'var(--timing-medium)',    // 200ms
        'slow':    'var(--timing-slow)',      // 350ms
      },
    },
  },
  plugins: [],
}
```

---

## Theme Loader Function (Pseudocode for Aria)

Aria writes this JavaScript to apply a theme's tokens as CSS custom properties:

```ts
function applyTheme(theme: ThemeTokens): void {
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

  // Radius (fixed — same in all themes, but set from token for consistency)
  root.style.setProperty('--radius-sm',   theme.radius.sm);
  root.style.setProperty('--radius-md',   theme.radius.md);
  root.style.setProperty('--radius-lg',   theme.radius.lg);
  root.style.setProperty('--radius-full', theme.radius.full);

  // Shadow
  root.style.setProperty('--shadow-none', theme.shadow.none);
  root.style.setProperty('--shadow-sm',   theme.shadow.sm);
  root.style.setProperty('--shadow-md',   theme.shadow.md);
  root.style.setProperty('--shadow-lg',   theme.shadow.lg);

  // Timing (fixed — same in all themes)
  root.style.setProperty('--timing-instant', theme.timing.instant);
  root.style.setProperty('--timing-fast',    theme.timing.fast);
  root.style.setProperty('--timing-medium',  theme.timing.medium);
  root.style.setProperty('--timing-slow',    theme.timing.slow);

  // Set data attribute for any CSS selectors that need to know the theme
  root.setAttribute('data-theme', theme.name.toLowerCase());
  root.setAttribute('data-mode',  theme.mode);
}
```

**Note on `data-mode`**: Setting `data-mode="dark"` or `data-mode="light"` on `:root` allows CSS selectors like `[data-mode="dark"] .some-element` for any overrides that need mode-awareness beyond token values. Use sparingly — if it's needed often, it probably means a token is missing.

---

## Conflict Resolution: Tailwind's Defaults vs. Token Values

Tailwind ships with default values for `borderRadius`, `boxShadow`, and color names that may conflict with Roundtable's token keys. Resolution strategy:

| Conflict | Resolution |
|----------|-----------|
| `rounded-sm` default = 2px | **Override** in config — token value (4px) wins |
| `rounded-md` default = 6px | **Override** in config — token value (8px) wins |
| `rounded-lg` default = 8px | **Override** in config — token value (12px) wins |
| `shadow-sm`, `shadow-md`, `shadow-lg` defaults | **Override** in config — token CSS vars win |
| Tailwind color names (e.g. `bg-blue-500`) | Leave as-is — Tailwind default palette is available but should not be used in components. All components use token-mapped classes only. |

The rule: when in doubt, use a token class. Never use Tailwind's default color palette in component code. If a design needs a color that isn't in the token set, that means a token is missing — Luma adds it, not Aria.
