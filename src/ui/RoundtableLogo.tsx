/**
 * RoundtableLogo — horizontal lockup (symbol + wordmark) for the app header.
 *
 * Uses the mono SVG approach: all paths render with `currentColor` so that
 * setting CSS `color` on the container controls the entire mark.
 * Brand token `--brand-logo-color` switches between Indigo (light mode) and
 * Mist (dark mode) via `[data-mode]` selectors in brand-tokens.css.
 *
 * The symbol height is 24px (the minimum for the full lockup per identity.md).
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
        style={{ height: '24px', width: '24px', flexShrink: 0 }}
      >
        <title>Roundtable</title>
        <defs>
          <mask id="rt-logo-mask">
            {/* White = show, black = cut through to reveal page bg */}
            <rect width="48" height="48" fill="white" />
            <polygon
              points="36.12,17 38,24 36.12,31 11.88,31 10,24 11.88,17"
              fill="black"
            />
            <circle cx="24" cy="24" r="3" fill="black" />
          </mask>
        </defs>
        {/* Filled circle with hexagon + dot voids punched through */}
        <circle cx="24" cy="24" r="22" fill="currentColor" mask="url(#rt-logo-mask)" />
        {/* Hexagon stroke ring on top — makes the hexagon edge visible in currentColor */}
        <polygon
          points="36.12,17 38,24 36.12,31 11.88,31 10,24 11.88,17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Center dot */}
        <circle cx="24" cy="24" r="3" fill="currentColor" />
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
