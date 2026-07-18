/**
 * ModelSelectorPanel — deprecation warning contrast tests (#517)
 *
 * Background:
 *   Wave 5 added a deprecation warning banner to ModelSelectorPanel (issue #423).
 *   The initial implementation used `text-warning/80` on `bg-warning/10` which
 *   failed WCAG AA contrast in the linen and chalk themes:
 *     - linen: 3.34:1 (required 4.5:1)
 *     - chalk: 3.59:1 (required 4.5:1)
 *   The fix landed in the same wave (commit 621f891): the body text class was
 *   changed from `text-warning/80` to full-opacity `text-warning`.
 *
 *   These tests were drafted with it.fails() while the bug existed. Now that the
 *   fix is live they run as passing it() tests (issue #517).
 *
 * Scope:
 *   Contrast audit is limited to linen and chalk — the two themes that previously
 *   failed. Dark themes (slate, midnight, ash, ember, outrun) passed with the
 *   original text-warning/80 and continue to pass with full-opacity text-warning.
 *   Expanding the audit to all 7 themes is not warranted for this targeted fix.
 *
 * What this tests:
 *   1. The body text paragraph in the deprecation banner carries `text-warning`
 *      (full-opacity), NOT `text-warning/80` (the regressed value).
 *   2. Full-opacity `text-warning` on the composited `bg-warning/10` banner
 *      background meets WCAG 2.1 AA 4.5:1 contrast in both linen and chalk.
 *
 * Color math:
 *   The banner background is `bg-warning/10` composited over `bg-sidebar`.
 *   Alpha-composite formula: result = warning * 0.10 + sidebar * 0.90
 *     linen:  #8A4E00 * 0.10 + #EDE8DF * 0.90 = #E3D9C9  → text-warning #8A4E00 = 4.74:1 PASS
 *     chalk:  #854D0E * 0.10 + #F0F0F0 * 0.90 = #E5E0D9  → text-warning #854D0E = 5.22:1 PASS
 *   Old value (text-warning/80) for reference:
 *     linen:  #9C6A28 (80% blend) on #E3D9C9 = 3.34:1 FAIL
 *     chalk:  #986A37 (80% blend) on #E5E0D9 = 3.59:1 FAIL
 *
 * WCAG criterion:
 *   1.4.3 Contrast (Minimum) — Level AA
 *   Body text at 12px/11px (not large text): 4.5:1 required.
 *
 * Component under test:
 *   /src/ui/ModelSelectorPanel.tsx — deprecation warning section (lines 364–388).
 *   The body text paragraph uses class `text-[11px] text-warning leading-relaxed mt-0.5`.
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// @/models mock: provide a MODEL_REGISTRY with one deprecated model so the
// deprecation banner renders. ModelSelectorPanel imports MODEL_REGISTRY directly.
vi.mock('@/models', () => ({
  MODEL_REGISTRY: [
    {
      modelId: 'deepseek',
      name: 'DeepSeek',
      providerName: 'DeepSeek',
      availableVersions: [],
      deprecated: true,
      deprecationDate: '2026-07-24',
    },
  ],
}));

// @/auth mock: ModelSelectorPanel calls getModelAccentColors() on mount.
// Return an empty object (no overrides) so we don't need real localStorage.
vi.mock('@/auth', () => ({
  getModelAccentColors: vi.fn(() => ({})),
}));

// jsdom does not implement matchMedia — stub it so components using
// window.matchMedia do not throw.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { ModelSelectorPanel } from '@/ui/ModelSelectorPanel';
import type { ModelConfig } from '@/types';

// ─── WCAG contrast math ───────────────────────────────────────────────────────
// Identical to the implementation in /src/tests/a11y/themes/contrast.test.ts.

function hexToRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = hexToRelativeLuminance(fg);
  const l2 = hexToRelativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Alpha-composite a foreground color at `alpha` opacity over a background.
 * Models Tailwind's /opacity modifier behavior: `bg-warning/10` composites
 * `warning` at 10% over whatever surface lies beneath it.
 */
function alphaComposite(fg: string, bg: string, alpha: number): string {
  const fgR = parseInt(fg.slice(1, 3), 16);
  const fgG = parseInt(fg.slice(3, 5), 16);
  const fgB = parseInt(fg.slice(5, 7), 16);
  const bgR = parseInt(bg.slice(1, 3), 16);
  const bgG = parseInt(bg.slice(3, 5), 16);
  const bgB = parseInt(bg.slice(5, 7), 16);
  const r = Math.round(fgR * alpha + bgR * (1 - alpha));
  const g = Math.round(fgG * alpha + bgG * (1 - alpha));
  const b = Math.round(fgB * alpha + bgB * (1 - alpha));
  return `#${r.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}`;
}

// ─── Theme token snapshots (linen + chalk only) ───────────────────────────────
// Values sourced from /_design/themes/linen.json and /_design/themes/chalk.json.
// The warning token values here reflect the #356 fix (linen) and current chalk;
// these are also the values in contrast.test.ts THEMES record.

const LINEN_WARNING = '#8A4E00';   // semantic.warning — fixed in #356 from #A16207
const LINEN_SIDEBAR = '#EDE8DF';   // surfaces.sidebar

const CHALK_WARNING = '#854D0E';   // semantic.warning
const CHALK_SIDEBAR = '#F0F0F0';   // surfaces.sidebar

// Pre-computed composited banner backgrounds (warning/10 over sidebar):
//   linen: #8A4E00 * 0.10 + #EDE8DF * 0.90 = #E3D9C9
//   chalk: #854D0E * 0.10 + #F0F0F0 * 0.90 = #E5E0D9
const LINEN_BANNER_BG = alphaComposite(LINEN_WARNING, LINEN_SIDEBAR, 0.10);
const CHALK_BANNER_BG = alphaComposite(CHALK_WARNING, CHALK_SIDEBAR, 0.10);

// ─── Fixture ──────────────────────────────────────────────────────────────────

const DEPRECATED_MODEL: ModelConfig = {
  modelId: 'deepseek',
  name: 'DeepSeek',
  color: 'accent-deepseek',
  isActive: true,
};

function renderPanelOpen() {
  const utils = render(
    <ModelSelectorPanel
      models={[DEPRECATED_MODEL]}
      onToggleModel={vi.fn()}
      onAddModel={vi.fn()}
      onUpdateSystemPrompt={vi.fn()}
      onSelectModelVersion={vi.fn()}
      onClearModelVersion={vi.fn()}
      sessionUsage={[]}
    />,
  );
  return utils;
}

// ─── Test 1: Tailwind class audit — text-warning (not text-warning/80) ───────
//
// WCAG 1.4.3: We verify at the class level that the body text paragraph uses
// full-opacity `text-warning`, not the regressed `text-warning/80`.
// This is the structural guarantee that the contrast numbers in Tests 2–3 apply.

describe('ModelSelectorPanel deprecation warning — Tailwind class audit (WCAG 1.4.3)', () => {
  it('body text paragraph carries text-warning (full-opacity), not text-warning/80', () => {
    const { container } = renderPanelOpen();

    // The deprecation body text is an 11px <p> element inside the warning banner.
    // Its text contains "This provider" (from the deprecationDate branch).
    const allParagraphs = Array.from(container.querySelectorAll('p'));
    const bodyParagraph = allParagraphs.find(
      (p) =>
        p.textContent?.includes("provider's API") ||
        p.textContent?.includes('Switch to another'),
    );

    expect(bodyParagraph).not.toBeNull();

    const className = bodyParagraph?.className ?? '';

    // Must include text-warning (full-opacity)
    expect(className).toContain('text-warning');

    // Must NOT include text-warning/80 (the pre-fix regressed value).
    // Tailwind renders opacity modifiers as a separate class token.
    expect(className).not.toContain('text-warning/80');
  });

  it('heading paragraph also carries text-warning (full-opacity)', () => {
    const { container } = renderPanelOpen();

    const allParagraphs = Array.from(container.querySelectorAll('p'));
    const headingParagraph = allParagraphs.find(
      (p) =>
        p.textContent?.includes('being discontinued') ||
        p.textContent?.includes('DeepSeek'),
    );

    expect(headingParagraph).not.toBeNull();

    const className = headingParagraph?.className ?? '';
    expect(className).toContain('text-warning');
    expect(className).not.toContain('text-warning/80');
  });
});

// ─── Test 2: linen contrast — text-warning on bg-warning/10 banner ───────────
//
// WCAG 1.4.3 Contrast (Minimum) — Level AA
// Body text is 11px / heading text is 12px font-semibold.
// Neither qualifies as large text (18pt/24px plain or 14pt/~19px bold).
// Required ratio: 4.5:1.
//
// Measured: #8A4E00 on #E3D9C9 (composited bg-warning/10 over sidebar) = 4.74:1 PASS.
// Previous (text-warning/80): #9C6A28 on #E3D9C9 = 3.34:1 FAIL.

describe('ModelSelectorPanel deprecation warning — linen theme contrast (WCAG 1.4.3)', () => {
  it('linen: text-warning on bg-warning/10 banner meets 4.5:1 (body text)', () => {
    // The composited banner background is warning/10 over sidebar.
    const ratio = contrastRatio(LINEN_WARNING, LINEN_BANNER_BG);
    // Verify our computed banner BG is what we expect.
    expect(LINEN_BANNER_BG).toBe('#E3D9C9');
    // WCAG 1.4.3 AA: 4.5:1 minimum.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('linen: measured ratio is at least 4.74:1 (confirms fix margin)', () => {
    const ratio = contrastRatio(LINEN_WARNING, LINEN_BANNER_BG);
    // The fix lands at ~4.74:1. Assert the specific margin so token drift is
    // caught before it crosses the 4.5:1 threshold.
    expect(ratio).toBeGreaterThanOrEqual(4.7);
  });
});

// ─── Test 3: chalk contrast — text-warning on bg-warning/10 banner ───────────
//
// WCAG 1.4.3 Contrast (Minimum) — Level AA
// Required ratio: 4.5:1.
//
// Measured: #854D0E on #E5E0D9 (composited bg-warning/10 over sidebar) = 5.22:1 PASS.
// Previous (text-warning/80): #986A37 on #E5E0D9 = 3.59:1 FAIL.

describe('ModelSelectorPanel deprecation warning — chalk theme contrast (WCAG 1.4.3)', () => {
  it('chalk: text-warning on bg-warning/10 banner meets 4.5:1 (body text)', () => {
    const ratio = contrastRatio(CHALK_WARNING, CHALK_BANNER_BG);
    // Verify our computed banner BG.
    expect(CHALK_BANNER_BG).toBe('#E5E0D9');
    // WCAG 1.4.3 AA: 4.5:1 minimum.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('chalk: measured ratio is at least 5.2:1 (confirms fix margin)', () => {
    const ratio = contrastRatio(CHALK_WARNING, CHALK_BANNER_BG);
    // The fix lands at ~5.22:1. Assert the margin so token drift is caught early.
    expect(ratio).toBeGreaterThanOrEqual(5.2);
  });
});

// ─── Test 4: regression guard — text-warning/80 would FAIL ───────────────────
//
// This test makes explicit that the old text-warning/80 value fails 4.5:1.
// Its purpose is documentary: if someone ever proposes reverting to /80 opacity,
// this test demonstrates why that value cannot be used on these themes.
// The test passes by asserting the failure ratio is BELOW 4.5:1.

describe('ModelSelectorPanel deprecation warning — regression guard (WCAG 1.4.3)', () => {
  it('regression: text-warning/80 on linen banner bg would fail 4.5:1 (do not revert)', () => {
    // text-warning/80: warning color at 80% opacity over the banner background
    const textWarning80_linen = alphaComposite(LINEN_WARNING, LINEN_BANNER_BG, 0.80);
    const oldRatio = contrastRatio(textWarning80_linen, LINEN_BANNER_BG);
    // 3.34:1 — well below 4.5:1 AA threshold
    expect(oldRatio).toBeLessThan(4.5);
  });

  it('regression: text-warning/80 on chalk banner bg would fail 4.5:1 (do not revert)', () => {
    const textWarning80_chalk = alphaComposite(CHALK_WARNING, CHALK_BANNER_BG, 0.80);
    const oldRatio = contrastRatio(textWarning80_chalk, CHALK_BANNER_BG);
    // 3.59:1 — below 4.5:1 AA threshold
    expect(oldRatio).toBeLessThan(4.5);
  });
});
