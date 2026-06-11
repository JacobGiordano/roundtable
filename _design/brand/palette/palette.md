# Roundtable Brand Palette

**Owner:** Marque  
**Status:** Complete  
**Last updated:** 2026-06-11

---

## Palette Overview

The brand palette is exactly three colors. It is distinct from Luma's model accent palette (amber, teal, purple, coral, blue, pink — all reserved for model identity) and from Luma's theme token palette (which varies per theme). The brand palette is stable across all themes and contexts.

These three colors mean **Roundtable**, not any model.

---

## Contrast Ratio Calculation Method

WCAG 2.1 relative luminance formula. Background references:
- White (Chalk bg): `#F8F8F8` — L = 0.955
- Slate background: `#0F1117` — L = 0.003
- Linen background: `#F5F0E8` — L = 0.923

Contrast = (L_lighter + 0.05) / (L_darker + 0.05)

---

## Color 1: Roundtable Indigo

| | |
|---|---|
| **Name** | Roundtable Indigo |
| **Hex** | `#2D2B55` |
| **Role** | Brand primary — the mark fill, the wordmark color, icon backgrounds |

**Rationale:** A deep blue-violet that reads as authoritative, precise, and slightly formal — matching the "constructed, non-playful" brief. Not Gemini's purple (`#AF5FF8` — that's a vivid violet, obviously a model accent). This is a dark neutral-indigo: desaturated enough to read as a professional anchor, with just enough hue to be distinctly Roundtable. It avoids the over-used slate-navy territory while not competing with any model accent family. The depth ensures it reads as the heaviest element on any page — a proper primary.

**Luminance:** L ≈ 0.030

| Background | Contrast | WCAG AA (4.5:1) | WCAG AA Large (3:1) |
|------------|----------|-----------------|---------------------|
| White `#FFFFFF` (L=1.0) | **13.3:1** | PASS | PASS |
| Chalk `#F8F8F8` (L=0.955) | **12.7:1** | PASS | PASS |
| Linen `#F5F0E8` (L=0.923) | **12.3:1** | PASS | PASS |
| Slate bg `#0F1117` (L=0.003) | **1.5:1** | FAIL | FAIL |

**Flag — dark surfaces:** `#2D2B55` fails on Slate and all dark theme backgrounds. This is expected and correct behavior: the brand primary is a dark mark color and must not be used as foreground text or a standalone mark on dark surfaces. Use the **on-dark variant** (`#C4C2E8`) instead — see below.

**Uses:** Wordmark fill, symbol fill, icon background (icon bg uses this color as surface, not as text), app header in light themes, marketing on white/cream.

---

## Color 2: Roundtable Mist

| | |
|---|---|
| **Name** | Roundtable Mist |
| **Hex** | `#C4C2E8` |
| **Role** | On-dark variant of brand primary — wordmark and mark on dark theme backgrounds |

**Rationale:** The on-dark version of Roundtable Indigo. A light, desaturated violet that preserves the indigo family hue while providing the luminance needed to pass WCAG AA on dark surfaces. "Mist" — a lighter expression of the same identity, like morning light on a deep lake. Not a pure white (which would lose brand character) and not the model accent colors (no amber/teal/purple/coral in this family). Desaturated enough to read as neutral, saturated enough to feel ownable.

**Luminance:** L ≈ 0.572

| Background | Contrast | WCAG AA (4.5:1) | WCAG AA Large (3:1) |
|------------|----------|-----------------|---------------------|
| Slate bg `#0F1117` (L=0.003) | **11.0:1** | PASS | PASS |
| Slate card `#1A1D26` (L=0.013) | **9.5:1** | PASS | PASS |
| Slate sidebar `#13151C` (L=0.007) | **10.1:1** | PASS | PASS |
| White `#FFFFFF` (L=1.0) | **1.8:1** | FAIL | FAIL |
| Chalk `#F8F8F8` (L=0.955) | **1.7:1** | FAIL | FAIL |

**Flag — light surfaces:** `#C4C2E8` fails on white/cream. This is expected — it is an on-dark variant only. Never use Mist as text or a standalone mark on light surfaces. Use Roundtable Indigo (`#2D2B55`) on light surfaces.

**Uses:** Wordmark and symbol in app header/nav on dark themes (Slate, Midnight, Ash, Ember, Outrun), reversed-out logo on dark marketing backgrounds.

---

## Color 3: Roundtable Warm Neutral

| | |
|---|---|
| **Name** | Roundtable Warm Neutral |
| **Hex** | `#2E2926` |
| **Role** | Brand neutral anchor — high-contrast text ground for brand applications on cream/warm backgrounds |

**Rationale:** A deep warm charcoal — near-black with a faint warm-brown undertone matching Linen's surface family. Not a cold blue-grey (that would fight with the indigo primary on warm-toned surfaces like Linen). Not pure black (which reads as a default, not a brand choice). This is the anchor that makes the brand feel considered on warm, editorial surfaces. On Linen cream backgrounds, this is the text ground. It also serves as the "ink" color for any brand typesetting on cream/paper metaphor surfaces.

**Luminance:** L ≈ 0.024

| Background | Contrast | WCAG AA (4.5:1) | WCAG AA Large (3:1) |
|------------|----------|-----------------|---------------------|
| White `#FFFFFF` (L=1.0) | **15.0:1** | PASS | PASS |
| Chalk `#F8F8F8` (L=0.955) | **14.4:1** | PASS | PASS |
| Linen `#F5F0E8` (L=0.923) | **14.0:1** | PASS | PASS |
| Slate bg `#0F1117` (L=0.003) | **1.4:1** | FAIL | FAIL |

**Flag — dark surfaces:** Same constraint as the primary — `#2E2926` is a dark neutral and cannot be used on dark theme backgrounds. It is only relevant for brand applications on light/cream surfaces.

**Uses:** Brand typography ground on Linen-family backgrounds (marketing, editorial layouts, brand wordmark on cream), print/physical brand applications.

---

## Full Palette Reference

| Name | Hex | Role | Light bg | Dark bg |
|------|-----|------|----------|---------|
| Roundtable Indigo | `#2D2B55` | Brand primary (mark, wordmark) | PASS (12–13:1) | FAIL — use Mist |
| Roundtable Mist | `#C4C2E8` | On-dark mark/wordmark | FAIL — use Indigo | PASS (9.5–11:1) |
| Roundtable Warm Neutral | `#2E2926` | Neutral anchor, warm-surface type | PASS (14–15:1) | FAIL — not used on dark |

---

## What These Colors Are Not

- **Not model accents.** Amber, teal, purple, coral, grok-blue, deepseek-blue, mistral-pink — all reserved by Luma for model identity. None of these appear in the brand palette.
- **Not theme tokens.** These colors are not assigned to `surfaces.*`, `text.*`, or `borders.*` tokens. They are brand identity values that live in `/_design/brand/` and are referenced by the product only in specific branded surfaces (app header mark, favicon, marketing).
- **Not semantic colors.** Success, warning, error, info — those are Luma's semantic tokens. No overlap.

---

## Luma Token Candidates

These are **flagged, not implemented** — Arch must review any new token addition.

| Brand color | Suggested new token | Rationale |
|-------------|--------------------|-----------| 
| Roundtable Indigo `#2D2B55` | `brand.primary` | The mark fill; not currently representable in the token schema |
| Roundtable Mist `#C4C2E8` | `brand.primary-on-dark` | On-dark expression of the primary |
| Roundtable Warm Neutral `#2E2926` | `brand.neutral` | Warm anchor; distinct from `text.primary` tokens which vary per theme |

Current token schema (`tokens/schema.md`) has no `brand.*` category. Luma should propose adding a `brand` group to the schema via Arch. This group would contain stable, cross-theme brand identity values that do not vary per theme, in contrast to all current token categories which are theme-relative.
