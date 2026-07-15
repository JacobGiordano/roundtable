/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
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
        'accent-claude':    'var(--accent-claude)',
        'accent-gpt':       'var(--accent-gpt)',
        'accent-gemini':    'var(--accent-gemini)',
        'accent-other':     'var(--accent-other)',
        'accent-grok':      'var(--accent-grok)',
        'accent-deepseek':  'var(--accent-deepseek)',
        'accent-mistral':   'var(--accent-mistral)',
        // User message identity accent — set by applyTheme (Pass 1 theme default)
        // and optionally overridden by applyUserMessageColor (Pass 2 user choice).
        'accent-user':      'var(--accent-user)',
        // Interactive
        'hover':           'var(--interactive-hover)',
        'active':          'var(--interactive-active)',
        'focus':           'var(--interactive-focus)',
        // Semantic
        'success':         'var(--semantic-success)',
        'warning':         'var(--semantic-warning)',
        'error':           'var(--semantic-error)',
        'error-bg':        'var(--semantic-error-bg)',
        'info':            'var(--semantic-info)',
        // Prose (markdown rendering tokens — Luma spec: markdown.md + tailwind-mapping.md)
        // Step 1 of two-step token verification: these map to CSS vars set by applyTheme().
        // Step 2: all 7 vars confirmed in theme.ts applyTheme() prose block.
        'code':            'var(--prose-code-bg)',       // bg-code
        'code-border':     'var(--prose-code-border)',   // border-code
        'code-text':       'var(--prose-code-text)',     // text-code
        'code-block':      'var(--prose-block-bg)',      // bg-code-block
        'link':            'var(--prose-link)',           // text-link
        'link-hover':      'var(--prose-link-hover)',    // hover:text-link-hover
        'blockquote':      'var(--prose-blockquote-border)', // border-blockquote
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
};
