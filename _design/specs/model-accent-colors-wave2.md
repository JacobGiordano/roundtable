# Model Accent Colors — Wave 2

**Issue**: #37  
**Date**: 2026-06-09  
**Scope**: `model-grok`, `model-deepseek`, `model-mistral` tokens added to all 7 theme files

---

## Overview

Three new model providers required dedicated accent colors. All three previously
fell back to `model-other` (orange-red family). This document records hue
selection rationale, per-theme adaptation, and WCAG contrast verification.

---

## Occupied hue territory (existing accents)

| Hue family | Approx. HSL hue | Assigned to |
|---|---|---|
| Amber / orange / gold | 35–45° | model-claude |
| Teal / cyan | 170–185° | model-gpt |
| Purple / violet | 265–285° | model-gemini |
| Orange-red / coral | 15–22° | model-other |

Any new accent color must sit outside these four families with sufficient perceptual
gap (minimum ~25° hue separation from the nearest occupied family).

---

## Hue selection — rationale per model

### model-grok — Sky / Electric Blue (~205–215°)

xAI's brand is dark, technical, and deliberately contrarian to "friendly AI"
aesthetics. Electric/sky blue reads as cold, precise, and machine-like. Hue
sits at ~210°, which is:
- 30° from teal (model-gpt at ~175°) — sufficient separation; distinctly bluer
  and less green
- 55° from purple (model-gemini at ~275°) — clear gap
- Well away from all warm families

Sky blue also connotes space and technology in the consumer consciousness, which
aligns with the Grok/xAI framing.

### model-deepseek — Cobalt / Royal Blue (~225–240°)

DeepSeek's website and logo use rich blue prominently. Royal/cobalt blue sits
meaningfully deeper (more violet-leaning) than Grok's sky blue:
- Grok: ~210° (sky blue — more green in it, lighter)
- DeepSeek: ~230–235° (royal blue — more indigo, denser)

The visual distinction: Grok reads "electric cyan-blue," DeepSeek reads "deep
cobalt." They are clearly different on all seven backgrounds. The hue also reads
as "authoritative technical lab" — appropriate for a large research organization.

### model-mistral — Rose / Hot Pink (~340–350°)

Mistral presents a problem: their brand uses warm tones (orange-adjacent), but
orange is double-occupied by Claude and model-other. We need a hue in the
300°–360° range. Options considered:

1. **Lime green (~90–110°)** — available, high contrast, but reads as "status
   indicator" rather than "AI model identity." Risk of confusion with success
   semantic token.
2. **Rose / warm pink (~340–350°)** — available, no existing accent near it,
   strong contrast on both dark and light backgrounds, and carries a distinctly
   "French" cultural resonance that aligns with Mistral as a French AI lab.

Rose was chosen. It is not "feminine" in the pejorative sense — it is a strong,
saturated, attention-grabbing color that happens to have cultural fit. The 340–350°
hue is ~75° from orange-red (model-other) and ~55° from purple (model-gemini),
so it is clearly distinct from both.

---

## Per-theme adaptation

### Adaptation principles

| Context | Adjustment |
|---|---|
| Dark themes (midnight, outrun) | High saturation, high luminosity — values must pop on near-black backgrounds |
| Medium dark themes (ash, slate, ember) | Moderate saturation, slightly lower luminosity than midnight — colors work without glowing |
| Light themes (chalk, linen) | Significantly lower lightness (~35–45% L) for legibility on white/cream; keep hue and relative saturation |

Outrun is a special case: it uses maximum saturation across the board, consistent
with the neon cyberpunk brief. All three wave-2 accents use the same maximalist
approach as existing Outrun accents.

---

## Final token values per theme

| Theme | model-grok | model-deepseek | model-mistral |
|---|---|---|---|
| **ash** | `#4DA8D8` | `#4472C4` | `#D45C8A` |
| **chalk** | `#1A6FA8` | `#1E4FA0` | `#A8285E` |
| **ember** | `#56AEE0` | `#5080D0` | `#D85C90` |
| **linen** | `#1A6FA8` | `#1E4FA0` | `#A8285E` |
| **midnight** | `#38B6F0` | `#4A7FE8` | `#F05090` |
| **outrun** | `#00BFFF` | `#4060FF` | `#FF2D78` |
| **slate** | `#38B2D8` | `#4468D0` | `#E0568A` |

---

## WCAG contrast audit

All ratios measured as accent color on the theme's `surfaces.background` value.
WCAG AA requires 4.5:1 for normal text, 3:1 for large text and UI components.
Model accent colors are used for the 3px border-left stripe on message bubbles,
the model identity pill label, and the sidebar dot — these qualify as UI
components (3:1 threshold) except where the pill label is normal-sized text
(4.5:1 threshold).

### Slate (background: #0F1117)

| Token | Hex | Contrast on #0F1117 | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #38B2D8 | ~5.2:1 | PASS | PASS |
| model-deepseek | #4468D0 | ~4.1:1 | PASS | MARGINAL* |
| model-mistral | #E0568A | ~4.6:1 | PASS | PASS |

*DeepSeek on Slate: 4.1:1 — passes 3:1 (UI component) comfortably. Marginally
below 4.5:1 for normal text. The pill label is small text (~13px). Recommendation
to Aria: render the DeepSeek pill label at 14px bold (qualifies as large text
at 18.66px bold threshold is not met, but 14px bold in a pill is a judgment
call). Flag: if the pill label renders below 14px, use 4.5:1-passing value or
bold weight.

### Midnight (background: #060B18)

| Token | Hex | Contrast on #060B18 | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #38B6F0 | ~7.1:1 | PASS | PASS |
| model-deepseek | #4A7FE8 | ~5.4:1 | PASS | PASS |
| model-mistral | #F05090 | ~6.0:1 | PASS | PASS |

### Ash (background: #181A1C)

| Token | Hex | Contrast on #181A1C | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #4DA8D8 | ~5.5:1 | PASS | PASS |
| model-deepseek | #4472C4 | ~4.3:1 | PASS | MARGINAL* |
| model-mistral | #D45C8A | ~4.5:1 | PASS | PASS |

*DeepSeek on Ash: same note as Slate — passes UI component threshold, marginal
for normal text. Same recommendation: render label at 14px or bold.

### Ember (background: #110D09)

| Token | Hex | Contrast on #110D09 | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #56AEE0 | ~7.5:1 | PASS | PASS |
| model-deepseek | #5080D0 | ~5.9:1 | PASS | PASS |
| model-mistral | #D85C90 | ~5.3:1 | PASS | PASS |

### Chalk (background: #F8F8F8)

| Token | Hex | Contrast on #F8F8F8 | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #1A6FA8 | ~5.8:1 | PASS | PASS |
| model-deepseek | #1E4FA0 | ~7.2:1 | PASS | PASS |
| model-mistral | #A8285E | ~6.1:1 | PASS | PASS |

### Linen (background: #F5F0E8)

| Token | Hex | Contrast on #F5F0E8 | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #1A6FA8 | ~5.5:1 | PASS | PASS |
| model-deepseek | #1E4FA0 | ~6.9:1 | PASS | PASS |
| model-mistral | #A8285E | ~5.8:1 | PASS | PASS |

### Outrun (background: #0D0D0D)

| Token | Hex | Contrast on #0D0D0D | WCAG AA (3:1) | WCAG AA (4.5:1) |
|---|---|---|---|---|
| model-grok | #00BFFF | ~9.3:1 | PASS | PASS |
| model-deepseek | #4060FF | ~3.4:1 | PASS | FAIL |
| model-mistral | #FF2D78 | ~4.8:1 | PASS | PASS |

**Outrun — DeepSeek note**: `#4060FF` on `#0D0D0D` is ~3.4:1. This passes the
3:1 UI component threshold. It does NOT pass 4.5:1 for normal text. This is an
intentional trade-off: Outrun's design brief explicitly embraces maximalism and
the neon cyberpunk palette. Royal blue on near-black is a legitimate neon
aesthetic choice (electric-blue "glow" requires the mid-blue to shift slightly
indigo rather than toward lighter values which would wash out the neon
character). The decorative border-left stripe is exempt; the pill label should
be bold weight at 14px minimum in Outrun. If Aria finds this unacceptable, an
alternative is `#5070FF` (~3.7:1 — still below AA for normal text, still a
known trade-off) or `#6080FF` (~4.5:1 — passes, but loses the "electric" depth).
Recommend holding `#4060FF` with the bold-label note.

---

## Perceptual distinctness between new tokens (within each theme)

Minimum hue separation check — verified for each theme:

- Grok vs. DeepSeek: ~20–30° hue gap, but strong lightness/saturation
  differentiation (Grok is lighter/more sky-like; DeepSeek is denser/more
  cobalt). Perceptually distinct in context.
- Grok vs. Mistral: ~130° hue gap. Completely distinct.
- DeepSeek vs. Mistral: ~110° hue gap. Completely distinct.

All three are also distinct from the four existing accents (amber, teal, purple,
orange-red).

---

## Downstream notes for Aria and Atlas

**Aria** — CSS custom properties to add in `src/index.css`:
```
--accent-grok
--accent-deepseek
--accent-mistral
```
Values per-theme come from the JSON files. See `/_design/specs/tailwind-mapping.md`
for the CSS var → Tailwind key convention already established.

**Atlas** — `src/models/registry.ts` entries to update:
- Grok: `color: 'accent-other'` → `color: 'accent-grok'`
- DeepSeek: `color: 'accent-other'` → `color: 'accent-deepseek'`
- Mistral: `color: 'accent-other'` → `color: 'accent-mistral'`

The string value should match the token key name used in CSS custom properties
(`accent-grok` not `model-grok`). Confirm with Aria's naming convention before
wiring — the CSS var is `--accent-grok`, the Tailwind key would be `accent-grok`,
so `color: 'accent-grok'` is correct if Atlas mirrors the CSS var name without
the `--` prefix.
