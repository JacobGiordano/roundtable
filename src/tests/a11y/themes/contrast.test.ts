/**
 * Contrast Ratio Tests — WCAG 2.1 AA
 *
 * Verifies that foreground/background color pairs in every built-in theme meet
 * the WCAG 2.1 AA minimums:
 *   - Normal text (< 18pt / < 14pt bold): 4.5:1
 *   - Large text (≥ 18pt or ≥ 14pt bold) and UI components: 3.0:1
 *
 * Color values are sourced directly from /_design/themes/*.json.
 * Any theme token change that degrades contrast below threshold will break
 * these tests — that is intentional. The failing test name identifies the
 * specific pair to fix.
 *
 * NOTE: Token sizes in the UI —
 *   - 12px uppercase font-semibold model headers: NOT large text (9pt). 4.5:1 required.
 *   - 11px token count / reply button text: NOT large text. 4.5:1 required.
 *   - Accent colors used as left border only (decorative, not text): 3.0:1 required.
 *   - Focus rings (3px, visual only): 3.0:1 required per WCAG 2.4.11 (AA).
 *
 * Tests marked it.fails() document known failing pairs — they will automatically
 * begin passing once Luma adjusts the corresponding token. When that happens,
 * remove the .fails() wrapper from the now-passing test.
 */

import { describe, it, expect } from 'vitest';

// ─── WCAG contrast math ───────────────────────────────────────────────────────

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

// ─── Theme token snapshots ────────────────────────────────────────────────────
// Values copied verbatim from /_design/themes/*.json.
// When a theme file changes, update the matching record here.

interface ThemeTokens {
  bg: string;
  card: string;
  sidebar: string;
  input: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentClaude: string;
  accentGpt: string;
  accentGemini: string;
  accentOther: string;
  accentGrok: string;
  accentDeepseek: string;
  accentMistral: string;
  error: string;
  errorBg: string;
  hover: string;
  focusRing: string;
  warning: string;
}

const THEMES: Record<string, ThemeTokens> = {
  slate: {
    bg: '#0F1117', card: '#1A1D26', sidebar: '#13151C', input: '#1F2230',
    textPrimary: '#E8EAF0', textSecondary: '#A0A8BC', textMuted: '#868EAC' /* #276 fix — was #7C84A2 (#58 fix) */,
    accentClaude: '#F59E0B', accentGpt: '#14B8A6', accentGemini: '#AF5FF8' /* #60 fix */,
    accentOther: '#F97316', accentGrok: '#38B2D8', accentDeepseek: '#5A82E1' /* #60 fix */,
    accentMistral: '#E0568A', error: '#FF5252' /* #119/#120 fix */, errorBg: '#C53030' /* #119 fix */,
    hover: '#242838', focusRing: '#F59E0B', warning: '#EAB308',
  },
  linen: {
    bg: '#F5F0E8', card: '#FDFAF5', sidebar: '#EDE8DF', input: '#F9F5EE',
    textPrimary: '#1C1A16', textSecondary: '#4A4640', textMuted: '#6B6660' /* #58 fix, #277 fix */,
    accentClaude: '#B45309', accentGpt: '#0F766E', accentGemini: '#7E22CE',
    accentOther: '#C2410C', accentGrok: '#1A6FA8', accentDeepseek: '#1E4FA0',
    accentMistral: '#A8285E', error: '#B91C1C', errorBg: '#B91C1C' /* same value, light theme */,
    hover: '#EDE6DA', focusRing: '#B45309', warning: '#A16207',
  },
  midnight: {
    bg: '#060B18', card: '#0D1525', sidebar: '#080D1E', input: '#111A2E',
    textPrimary: '#F0F4FF', textSecondary: '#94A3C8', textMuted: '#6F86A9' /* #276 fix — was #6B82A5 */,
    accentClaude: '#FBB034', accentGpt: '#00CDB8', accentGemini: '#B06EFF',
    accentOther: '#FF7A52', accentGrok: '#38B6F0', accentDeepseek: '#4A7FE8',
    accentMistral: '#F05090', error: '#F87171', errorBg: '#B82828' /* #119 fix */,
    hover: '#121D30', focusRing: '#00CDB8', warning: '#FBBF24',
  },
  ash: {
    bg: '#181A1C', card: '#22252A', sidebar: '#1B1D20', input: '#272B31',
    textPrimary: '#D8DCDF', textSecondary: '#8E969E', textMuted: '#8C969F' /* #276 fix — was #838D96 (#58 fix) */,
    accentClaude: '#E8943A', accentGpt: '#3DB8A8', accentGemini: '#A278E1' /* #60 fix */,
    accentOther: '#E07060', accentGrok: '#4DA8D8', accentDeepseek: '#648ADC' /* #60 fix */,
    accentMistral: '#DC6294' /* #60 fix */, error: '#FF6060' /* #119/#120 fix */, errorBg: '#C03030' /* #119 fix */,
    hover: '#2A2E33', focusRing: '#3DB8A8', warning: '#D4A82A',
  },
  ember: {
    bg: '#110D09', card: '#1D1712', sidebar: '#140F0A', input: '#231B14',
    textPrimary: '#EDE5D8', textSecondary: '#B09070', textMuted: '#9E8270' /* #276 fix — was #987C6A (#58 fix) */,
    accentClaude: '#F5A623', accentGpt: '#2DB8A8', accentGemini: '#C080F0',
    accentOther: '#E06840', accentGrok: '#56AEE0', accentDeepseek: '#5080D0',
    accentMistral: '#D85C90', error: '#FF5555' /* #119/#120 fix */, errorBg: '#C83428' /* #119 fix */,
    hover: '#26201A', focusRing: '#F5A623', warning: '#DBA830',
  },
  chalk: {
    bg: '#F8F8F8', card: '#FFFFFF', sidebar: '#F0F0F0', input: '#FFFFFF',
    textPrimary: '#111111', textSecondary: '#404040', textMuted: '#6D6D6D' /* #58 fix */,
    accentClaude: '#B45309', accentGpt: '#0F766E', accentGemini: '#6D28D9',
    accentOther: '#C2410C', accentGrok: '#1A6FA8', accentDeepseek: '#1E4FA0',
    accentMistral: '#A8285E', error: '#991B1B', errorBg: '#991B1B' /* same value, light theme */,
    hover: '#F0F0F0', focusRing: '#6D28D9', warning: '#854D0E',
  },
  outrun: {
    bg: '#16141D', card: '#12203A', sidebar: '#0E1220', input: '#221E34',
    textPrimary: '#EEEAF8', textSecondary: '#3DC8FF', textMuted: '#6BBFB8',
    accentClaude: '#FFE600', accentGpt: '#2EE4B9', accentGemini: '#D060FF' /* #60 fix */,
    accentOther: '#FF8D77', accentGrok: '#C0CFFF', accentDeepseek: '#7AA0FF' /* #60 fix */,
    accentMistral: '#FF6090', error: '#FF5050' /* #119/#120 fix */, errorBg: '#CC2C2C' /* #119 fix */,
    hover: '#1C2840', focusRing: '#2EE4B9', warning: '#FFE259',
  },
};

// ─── Primary and secondary text — all should pass ─────────────────────────────

describe('theme contrast — primary and secondary text (WCAG 2.1 AA, 4.5:1)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    describe(name, () => {
      it('text-primary on background', () => {
        expect(contrastRatio(t.textPrimary, t.bg)).toBeGreaterThanOrEqual(4.5);
      });
      it('text-primary on card surface', () => {
        expect(contrastRatio(t.textPrimary, t.card)).toBeGreaterThanOrEqual(4.5);
      });
      it('text-secondary on background', () => {
        expect(contrastRatio(t.textSecondary, t.bg)).toBeGreaterThanOrEqual(4.5);
      });
      it('text-secondary on card surface', () => {
        expect(contrastRatio(t.textSecondary, t.card)).toBeGreaterThanOrEqual(4.5);
      });
      it('text-secondary on sidebar surface', () => {
        expect(contrastRatio(t.textSecondary, t.sidebar)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});

// ─── text-muted — per-surface, per-theme ─────────────────────────────────────
// text-muted (#text.muted in theme tokens) is used for timestamps, token counts,
// placeholders, and helper copy — all normal-weight small text (11–13px), not
// large text. Threshold: 4.5:1.
//
// Verified failure map (computed at audit time — pre-#58):
//   slate:    card FAILS (4.43)          bg passes, sidebar passes   → FIXED in #58
//   linen:    bg FAILS (4.02), card FAILS (4.38), sidebar FAILS (3.74) → FIXED in #58
//   midnight: all PASS
//   ash:      card FAILS (4.04), sidebar FAILS (4.43)   bg passes   → FIXED in #58
//   ember:    bg FAILS (4.32), card FAILS (3.96), sidebar FAILS (4.26) → FIXED in #58
//   chalk:    bg FAILS (4.47), card passes,              sidebar FAILS (4.16) → FIXED in #58
//   outrun:   all PASS
//
// All failures above are resolved. it.fails() wrappers removed after #58 merged.

describe('theme contrast — text-muted on background (4.5:1)', () => {
  it('slate: PASS', () => {
    expect(contrastRatio(THEMES.slate.textMuted, THEMES.slate.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('linen: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.linen.textMuted, THEMES.linen.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.textMuted, THEMES.midnight.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS', () => {
    expect(contrastRatio(THEMES.ash.textMuted, THEMES.ash.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.ember.textMuted, THEMES.ember.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.chalk.textMuted, THEMES.chalk.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.textMuted, THEMES.outrun.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme contrast — text-muted on card surface (4.5:1)', () => {
  it('slate: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.slate.textMuted, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('linen: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.linen.textMuted, THEMES.linen.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.textMuted, THEMES.midnight.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.ash.textMuted, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.ember.textMuted, THEMES.ember.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS (card is #FFFFFF)', () => {
    expect(contrastRatio(THEMES.chalk.textMuted, THEMES.chalk.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.textMuted, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme contrast — text-muted on sidebar surface (4.5:1)', () => {
  it('slate: PASS', () => {
    expect(contrastRatio(THEMES.slate.textMuted, THEMES.slate.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('linen: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.linen.textMuted, THEMES.linen.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.textMuted, THEMES.midnight.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.ash.textMuted, THEMES.ash.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.ember.textMuted, THEMES.ember.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS (fixed #58)', () => {
    expect(contrastRatio(THEMES.chalk.textMuted, THEMES.chalk.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.textMuted, THEMES.outrun.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
});

// ─── text-muted on interactive.hover (#276 fix) ───────────────────────────────
// interactive.hover is used as the solid background color on active thread rows
// in the sidebar. text-muted content (timestamps, token counts, helper copy)
// appears on these rows. This surface is the most constraining context for
// text-muted in the 4 dark themes — it was the specific failure target for #276.
//
// #276 lightened text.muted in 4 dark themes to pass 4.5:1 on hover:
//   slate:    #7C84A2 → #868EAC  (was 3.96:1 → now 4.51:1)
//   midnight: #6B82A5 → #6F86A9  (was 4.31:1 → now 4.55:1)
//   ash:      #838D96 → #8C969F  (was 4.04:1 → now 4.54:1)
//   ember:    #987C6A → #9E8270  (was 4.16:1 → now 4.51:1)
//
// Pre-existing advisory finding — linen text.muted (#6D6863) on hover (#EDE6DA)
// computes 4.44:1. This was not addressed in #276 (dark-themes-only scope).
// Marked it.fails() so the failure is documented and will auto-promote when Luma
// adjusts the linen hover or muted token. Filed as GitHub issue (see Ada report).
//
// chalk (4.54:1) and outrun (6.85:1) pass without modification.

describe('theme contrast — text-muted on interactive.hover (4.5:1)', () => {
  it('slate: PASS (fixed #276)', () => {
    expect(contrastRatio(THEMES.slate.textMuted, THEMES.slate.hover)).toBeGreaterThanOrEqual(4.5);
  });
  // Fixed in #277: darkened text.muted #6D6863 → #6B6660; now 4.58:1.
  it('linen: PASS (fixed #277 — text-muted 4.58:1 on hover)', () => {
    expect(contrastRatio(THEMES.linen.textMuted, THEMES.linen.hover)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS (fixed #276)', () => {
    expect(contrastRatio(THEMES.midnight.textMuted, THEMES.midnight.hover)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS (fixed #276)', () => {
    expect(contrastRatio(THEMES.ash.textMuted, THEMES.ash.hover)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS (fixed #276)', () => {
    expect(contrastRatio(THEMES.ember.textMuted, THEMES.ember.hover)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS', () => {
    expect(contrastRatio(THEMES.chalk.textMuted, THEMES.chalk.hover)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.textMuted, THEMES.outrun.hover)).toBeGreaterThanOrEqual(4.5);
  });
});

// ─── Error text — all pass after #59 and #119/#120 fixes ─────────────────────
// Pre-#59 failures (against card surface):
//   slate: FAIL (4.47:1) — #EF4444 → #F04A4A fixed in #59
//   ash:   FAIL (4.10:1) — #E05555 → #EA6060 fixed in #59
//
// Pre-#120 failures (error text on interactive.hover):
//   slate, ash, ember, outrun: FAIL — error brightened in #119/#120:
//     slate: #F04A4A → #FF5252; ash: #EA6060 → #FF6060
//     ember: #E05050 → #FF5555; outrun: #FF4040 → #FF5050

describe('theme contrast — error text on card (WCAG 2.1 AA, 4.5:1)', () => {
  it('slate: PASS (fixed #59, #119/#120)', () => {
    expect(contrastRatio(THEMES.slate.error, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('linen: PASS', () => {
    expect(contrastRatio(THEMES.linen.error, THEMES.linen.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.error, THEMES.midnight.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS (fixed #59)', () => {
    expect(contrastRatio(THEMES.ash.error, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS', () => {
    expect(contrastRatio(THEMES.ember.error, THEMES.ember.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS', () => {
    expect(contrastRatio(THEMES.chalk.error, THEMES.chalk.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.error, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme contrast — error text on background (WCAG 2.1 AA, 4.5:1)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: PASS`, () => {
      expect(contrastRatio(t.error, t.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ─── Focus rings — UI component threshold (3.0:1) ─────────────────────────────

describe('theme contrast — focus rings (WCAG 2.1 AA, 3.0:1 UI component)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    describe(name, () => {
      it('focus ring on background', () => {
        expect(contrastRatio(t.focusRing, t.bg)).toBeGreaterThanOrEqual(3.0);
      });
      it('focus ring on card surface', () => {
        expect(contrastRatio(t.focusRing, t.card)).toBeGreaterThanOrEqual(3.0);
      });
    });
  }
});

// ─── Accent colors used as text labels (4.5:1) ───────────────────────────────
// Accent colors appear as text in:
//   - Model name headers in ModelPill (12px uppercase semibold — NOT large text)
//   - "Reply to [Model]" button text (11px font-medium — NOT large text)
//   - Directed-reply pill text (12px font-medium — NOT large text)
// Threshold: 4.5:1 on the card surface (message bubble background).
//
// Pre-#60 failures identified in audit (against card surface):
//   slate:  accent-gemini (4.25), accent-deepseek (3.32) → FIXED in #60
//   ash:    accent-deepseek (3.26), accent-gemini (4.26), accent-mistral (4.17) → FIXED in #60
//   outrun: accent-deepseek (3.99), accent-gemini (4.29) → FIXED in #60
//
// All accents in all themes now pass on card.

describe('theme contrast — accent colors as text on card (4.5:1)', () => {
  // Themes where all accents pass
  for (const name of ['linen', 'midnight', 'ember', 'chalk'] as const) {
    const t = THEMES[name];
    for (const [model, hex] of [
      ['claude', t.accentClaude], ['gpt', t.accentGpt], ['gemini', t.accentGemini],
      ['other', t.accentOther], ['grok', t.accentGrok], ['deepseek', t.accentDeepseek],
      ['mistral', t.accentMistral],
    ] as [string, string][]) {
      it(`${name}: accent-${model} PASS`, () => {
        expect(contrastRatio(hex, t.card)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // slate — all pass after #60 fixes
  it('slate: accent-claude PASS', () => {
    expect(contrastRatio(THEMES.slate.accentClaude, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-gpt PASS', () => {
    expect(contrastRatio(THEMES.slate.accentGpt, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-gemini PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.slate.accentGemini, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-other PASS', () => {
    expect(contrastRatio(THEMES.slate.accentOther, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-grok PASS', () => {
    expect(contrastRatio(THEMES.slate.accentGrok, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-deepseek PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.slate.accentDeepseek, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('slate: accent-mistral PASS', () => {
    expect(contrastRatio(THEMES.slate.accentMistral, THEMES.slate.card)).toBeGreaterThanOrEqual(4.5);
  });

  // ash — all pass after #60 fixes
  it('ash: accent-claude PASS', () => {
    expect(contrastRatio(THEMES.ash.accentClaude, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-gpt PASS', () => {
    expect(contrastRatio(THEMES.ash.accentGpt, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-gemini PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.ash.accentGemini, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-other PASS', () => {
    expect(contrastRatio(THEMES.ash.accentOther, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-grok PASS', () => {
    expect(contrastRatio(THEMES.ash.accentGrok, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-deepseek PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.ash.accentDeepseek, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: accent-mistral PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.ash.accentMistral, THEMES.ash.card)).toBeGreaterThanOrEqual(4.5);
  });

  // outrun — all pass after #60 fixes
  it('outrun: accent-claude PASS', () => {
    expect(contrastRatio(THEMES.outrun.accentClaude, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-gpt PASS', () => {
    expect(contrastRatio(THEMES.outrun.accentGpt, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-gemini PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.outrun.accentGemini, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-other PASS', () => {
    expect(contrastRatio(THEMES.outrun.accentOther, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-grok PASS', () => {
    expect(contrastRatio(THEMES.outrun.accentGrok, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-deepseek PASS (fixed #60)', () => {
    expect(contrastRatio(THEMES.outrun.accentDeepseek, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: accent-mistral PASS', () => {
    expect(contrastRatio(THEMES.outrun.accentMistral, THEMES.outrun.card)).toBeGreaterThanOrEqual(4.5);
  });
});

// ─── Delete button: white text on error-bg (#119 fix) ────────────────────────
// The confirm-delete button in ThreadActionMenu and BulkActionBar uses
// `bg-error-bg text-white`. semantic.error-bg is the darker, AA-safe variant
// of the error color — sufficient contrast for white foreground text (4.5:1).
//
// All 7 themes verified at audit time (#119/#120):
//   slate: 5.47:1 | midnight: 6.23:1 | ash: 5.67:1 | chalk: 8.31:1
//   linen: 6.47:1 | ember: 5.28:1 | outrun: 5.30:1

describe('theme contrast — white text on error-bg delete button (WCAG 2.1 AA, 4.5:1)', () => {
  const WHITE = '#FFFFFF';
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: PASS (fixed #119)`, () => {
      expect(contrastRatio(WHITE, t.errorBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ─── Error text on interactive.hover (#120 fix) ───────────────────────────────
// `text-error` appears on hover rows in the context menu confirm-delete state.
// interactive.hover is the hovered sidebar row background. The #120 fix
// brightened semantic.error in the 4 dark themes where it previously failed.
//
// All 7 themes verified at audit time (#119/#120):
//   slate: 4.58:1 | midnight: 6.10:1 | ash: 4.62:1 | chalk: 7.29:1
//   linen: 5.22:1 | ember: 5.12:1 | outrun: 4.57:1

describe('theme contrast — error text on interactive.hover (WCAG 2.1 AA, 4.5:1)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: PASS (fixed #120)`, () => {
      expect(contrastRatio(t.error, t.hover)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ─── semantic.warning text (#353 — staleness footer) ─────────────────────────
// SessionTokenSection renders a staleness footer with `text-warning` (class maps
// to semantic.warning CSS variable) when pricing data is 48h+ old. The footer
// lives in ModelSelectorPanel which uses `bg-sidebar` (#321). The text is 10px
// (0.75rem) — not large text — so the 4.5:1 normal-text threshold applies.
//
// Contrast measured at audit time (#353):
//   slate:    #EAB308 on #13151C  9.51:1  PASS
//   linen:    #A16207 on #EDE8DF  4.03:1  FAIL  ← ticket opened for Luma
//   midnight: #FBBF24 on #080D1E  11.58:1 PASS
//   ash:      #D4A82A on #1B1D20  7.59:1  PASS
//   ember:    #DBA830 on #140F0A  8.76:1  PASS
//   chalk:    #854D0E on #F0F0F0  6.01:1  PASS
//   outrun:   #FFE259 on #0E1220  14.45:1 PASS
//
// The Linen failure is tracked in GitHub (issue opened by Ada for Luma to fix).
// The it.fails() wrapper will auto-promote to a standard passing test once Luma
// darkens semantic.warning in the Linen theme.

describe('theme contrast — semantic.warning text on sidebar (WCAG 2.1 AA, 4.5:1)', () => {
  it('slate: PASS', () => {
    expect(contrastRatio(THEMES.slate.warning, THEMES.slate.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  // FAIL — #A16207 on #EDE8DF = 4.03:1. Ticket opened for Luma.
  it.fails('linen: FAIL — #A16207 on #EDE8DF = 4.03:1 (needs Luma fix)', () => {
    expect(contrastRatio(THEMES.linen.warning, THEMES.linen.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.warning, THEMES.midnight.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS', () => {
    expect(contrastRatio(THEMES.ash.warning, THEMES.ash.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS', () => {
    expect(contrastRatio(THEMES.ember.warning, THEMES.ember.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS', () => {
    expect(contrastRatio(THEMES.chalk.warning, THEMES.chalk.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.warning, THEMES.outrun.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme contrast — semantic.warning text on background (WCAG 2.1 AA, 4.5:1)', () => {
  it('slate: PASS', () => {
    expect(contrastRatio(THEMES.slate.warning, THEMES.slate.bg)).toBeGreaterThanOrEqual(4.5);
  });
  // FAIL — #A16207 on #F5F0E8 = 4.34:1. Tracked by same Luma ticket.
  it.fails('linen: FAIL — #A16207 on #F5F0E8 = 4.34:1 (needs Luma fix)', () => {
    expect(contrastRatio(THEMES.linen.warning, THEMES.linen.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('midnight: PASS', () => {
    expect(contrastRatio(THEMES.midnight.warning, THEMES.midnight.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('ash: PASS', () => {
    expect(contrastRatio(THEMES.ash.warning, THEMES.ash.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('ember: PASS', () => {
    expect(contrastRatio(THEMES.ember.warning, THEMES.ember.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('chalk: PASS', () => {
    expect(contrastRatio(THEMES.chalk.warning, THEMES.chalk.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('outrun: PASS', () => {
    expect(contrastRatio(THEMES.outrun.warning, THEMES.outrun.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
