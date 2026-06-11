/**
 * RoundtableLogo — horizontal lockup (symbol + wordmark) for the app header.
 *
 * Symbol: solid Indigo circle (`--brand-primary`) with a white ring (table surface,
 * r=14) and six white seat dots at the hexagonal vertex positions on the ring,
 * plus a white center dot. This is the R1 mark per Marque's identity spec (issue #69).
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
        <title>Roundtable — ring and six seat dots mark</title>
        {/* Solid Indigo circle — outer badge */}
        <circle cx="24" cy="24" r="22" fill="var(--brand-primary)" />
        {/* Ring — table surface, r=14 */}
        <circle cx="24" cy="24" r="14" fill="none" stroke="white" strokeWidth="2" />
        {/* Six seat dots at hexagonal vertex positions on the ring (r=14 from center) */}
        {/* Top */}
        <circle cx="24" cy="10" r="3" fill="white" />
        {/* Upper-right */}
        <circle cx="36.12" cy="17" r="3" fill="white" />
        {/* Lower-right */}
        <circle cx="36.12" cy="31" r="3" fill="white" />
        {/* Bottom */}
        <circle cx="24" cy="38" r="3" fill="white" />
        {/* Lower-left */}
        <circle cx="11.88" cy="31" r="3" fill="white" />
        {/* Upper-left */}
        <circle cx="11.88" cy="17" r="3" fill="white" />
        {/* Center dot */}
        <circle cx="24" cy="24" r="3.5" fill="white" />
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
