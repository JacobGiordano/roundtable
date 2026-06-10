/**
 * Tests for colorUtils.ts — WCAG contrast formula.
 *
 * Pure functions: hexToRelativeLuminance and contrastRatio.
 * These are worth testing because:
 * 1. The WCAG formula has specific numeric properties that are easy to verify.
 * 2. The contrast warning threshold (4.5:1) is a user-visible behavior.
 * 3. The formula is implementation-sensitive (linearize branching at 0.04045).
 */

import { describe, it, expect } from 'vitest';
import { hexToRelativeLuminance, contrastRatio } from './colorUtils';

describe('hexToRelativeLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(hexToRelativeLuminance('#000000')).toBe(0);
  });

  it('returns 1 for pure white', () => {
    expect(hexToRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 4);
  });

  it('accepts lowercase hex', () => {
    expect(hexToRelativeLuminance('#ffffff')).toBeCloseTo(1, 4);
  });

  it('red channel contributes 0.2126 weight', () => {
    // Pure red at full intensity — after linearizing #FF0000.
    // R = 255/255 = 1.0 → linearized = ((1.0 + 0.055) / 1.055)^2.4 ≈ 1.0
    // Luminance = 0.2126 * 1.0 = 0.2126
    expect(hexToRelativeLuminance('#FF0000')).toBeCloseTo(0.2126, 3);
  });

  it('green channel contributes 0.7152 weight', () => {
    // Pure green at full intensity.
    // G = 255/255 = 1.0 → linearized ≈ 1.0
    // Luminance = 0.7152 * 1.0 = 0.7152
    expect(hexToRelativeLuminance('#00FF00')).toBeCloseTo(0.7152, 3);
  });

  it('blue channel contributes 0.0722 weight', () => {
    // Pure blue at full intensity.
    // B = 255/255 = 1.0 → linearized ≈ 1.0
    // Luminance = 0.0722 * 1.0 = 0.0722
    expect(hexToRelativeLuminance('#0000FF')).toBeCloseTo(0.0722, 3);
  });

  it('uses the linear branch for dark channels (c <= 0.04045)', () => {
    // #080808: R = G = B = 8/255 ≈ 0.0314 — below the 0.04045 threshold.
    // linearize(0.0314) = 0.0314 / 12.92 ≈ 0.002431
    // luminance = (0.2126 + 0.7152 + 0.0722) * 0.002431 ≈ 0.002431
    const lum = hexToRelativeLuminance('#080808');
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(0.005);
  });
});

describe('contrastRatio', () => {
  it('black on white gives the maximum ratio of 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('white on black gives the same ratio (symmetric)', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });

  it('same color gives 1:1 ratio', () => {
    expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 4);
  });

  it('result is always >= 1', () => {
    expect(contrastRatio('#FF0000', '#00FF00')).toBeGreaterThanOrEqual(1);
    expect(contrastRatio('#4468D0', '#1C2333')).toBeGreaterThanOrEqual(1);
  });

  it('Amber on a dark slate background passes 4.5:1', () => {
    // #F59E0B (Amber) on #1C2333 (Slate background approximation).
    // This is one of the default theme colors — should comfortably pass.
    const ratio = contrastRatio('#F59E0B', '#1C2333');
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('Snow (#E8EAF0) on white background fails 4.5:1', () => {
    // #E8EAF0 is near-white. On a white background the contrast is very low.
    const ratio = contrastRatio('#E8EAF0', '#FFFFFF');
    expect(ratio).toBeLessThan(4.5);
  });
});
