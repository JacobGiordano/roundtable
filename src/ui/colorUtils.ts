/**
 * Pure color utility functions — no React, no side effects, no dependencies.
 *
 * Exported separately from component files to satisfy the react-refresh
 * requirement that component files only export components.
 */

// ─── WCAG contrast helpers ────────────────────────────────────────────────────

/**
 * Compute the relative luminance of a hex color per the WCAG 2.1 formula.
 *
 * @param hex - 6-digit hex string (e.g. "#FF5500")
 * @returns relative luminance in [0, 1]
 */
export function hexToRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linearize = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = linearize(r);
  const gLin = linearize(g);
  const bLin = linearize(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colors.
 *
 * Returns a value in [1, 21]. WCAG AA requires >= 4.5 for normal text,
 * >= 3.0 for large text.
 *
 * @param hex1 - 6-digit hex string
 * @param hex2 - 6-digit hex string
 * @returns contrast ratio
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const L1 = hexToRelativeLuminance(hex1);
  const L2 = hexToRelativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
