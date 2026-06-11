/**
 * RoundtableLogo — horizontal lockup (symbol + wordmark) for the app header.
 *
 * Symbol: solid Indigo circle (`--brand-primary`) with white hexagon stroke and
 * white center dot, per Marque's identity spec (issue #69).
 * Wordmark: `fill="currentColor"` — the wrapper `color: var(--brand-logo-color)`
 * switches between Indigo (light mode) and Mist (dark mode) via [data-mode]
 * selectors in brand-tokens.css.
 *
 * The symbol renders at 32px height (identity.md minimum is 24px; 32px is used for legibility).
 * Below 640px (sm breakpoint), the wordmark is hidden and only the symbol renders.
 *
 * Accessibility: role="img" + aria-label on the wrapping element; the inline
 * SVG <title> provides an additional screen-reader hook.
 */
export function RoundtableLogo() {
  return (
    <div
      role="img"
      aria-label="Roundtable"
      className="flex items-center"
      style={{ color: 'var(--brand-logo-color)' }}
    >
      {/* Symbol — always visible */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        style={{ height: '32px', width: '32px', flexShrink: 0 }}
      >
        <title>Roundtable</title>
        {/* Solid Indigo circle */}
        <circle cx="24" cy="24" r="22" fill="var(--brand-primary)" />
        {/* Hexagon — explicitly filled with brand-primary so the interior is never
            transparent to the page background; white stroke paints the outline */}
        <polygon
          points="36.12,17 38,24 36.12,31 11.88,31 10,24 11.88,17"
          fill="var(--brand-primary)"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Center dot in white */}
        <circle cx="24" cy="24" r="3" fill="white" />
      </svg>

      {/* Wordmark — hidden on mobile (below sm breakpoint) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 220 32"
        fill="none"
        aria-hidden="true"
        className="hidden sm:block"
        style={{ height: '16px', marginLeft: '10px', flexShrink: 0 }}
      >
        <text
          x="0"
          y="22"
          fontFamily="'Space Grotesk Variable', 'Space Grotesk', 'DM Sans', system-ui, sans-serif"
          fontSize="20"
          fontWeight="500"
          letterSpacing="2.4"
          fill="currentColor"
        >
          ROUNDTABLE
        </text>
      </svg>
    </div>
  );
}
