# Roundtable Visual Identity Guide

**Owner:** Marque  
**Status:** Complete  
**Last updated:** 2026-06-11 (R1 mark adopted — ring + seat dots, hexagon retired)

---

## Positioning Statement

Roundtable is a multi-model AI conversation interface for people who want to hear every voice at the table — precise, open, unhierarchical, built to get out of the way.

---

## The Mark

The Roundtable symbol is a filled circle containing a ring with six seat dots and a center dot.

- **Circle:** The roundtable form — closed, continuous, no head of the table.
- **Ring:** The table surface viewed from directly above. A stroked circle at r=14 — pure round form, no angular elements.
- **Six seat dots:** Six equal participants, evenly spaced at the hexagonal vertex positions on the ring. Each dot center sits on the ring circumference (r=14 from center). The dots straddle the ring, simultaneously part of it and distinct from it.
- **Center dot:** The gathering point. The conversation. The common ground.

The mark is constructed on a 48-unit grid. The outer circle has radius 22. The ring is at radius 14, stroke-width 2. Six seat dots at radius 3 each, centered on the ring at the pointy-top hexagonal positions. The center dot has radius 3.5. All forms are pixel-aligned on the grid. Every element is a circle — no angular geometry anywhere in the mark.

**Seat dot positions (pointy-top arrangement, first dot at top/90°):**

| Seat | cx | cy |
|------|----|----|
| Top | 24 | 10 |
| Upper-right | 36.12 | 17 |
| Lower-right | 36.12 | 31 |
| Bottom | 24 | 38 |
| Lower-left | 11.88 | 31 |
| Upper-left | 11.88 | 17 |

The mark is rotationally symmetric at 60° intervals. It has no top, no bottom, no head of the table.

---

## Clear Space

**Minimum clear space:** 0.5 × the symbol height on all four sides.

For the 48-unit symbol: minimum 24 units of clear space on each side. Nothing — text, images, other graphic elements, container edges — may intrude into this space.

For the full horizontal lockup (symbol + wordmark): clear space is calculated from the outer bounding box of the lockup, not from the symbol alone.

For the stacked lockup: same rule — 0.5 × symbol height on all sides from the bounding box.

---

## Minimum Sizes

| Context | Minimum size | Variant |
|---------|-------------|---------|
| Symbol only (digital) | 16 × 16 px | Symbol only (`symbol.svg`) |
| Symbol only (print) | 8 mm | Symbol only |
| Full lockup (digital) | Symbol at 24px height | Horizontal (`primary.svg`) |
| Full lockup (print) | Symbol at 12 mm height | Horizontal or stacked |
| Stacked lockup (digital) | Symbol at 32px height | Stacked (`primary-stacked.svg`) |
| Wordmark only (digital) | 14px cap height | Wordmark only (`wordmark.svg`) |

Below minimum sizes, the ring and seat dot detail collapses. At the symbol minimum (16px), the mark reads as a circle badge — this is acceptable. The brand identity is preserved in the circle form. The ring and seat dots read clearly at 32px and above. Below 24px, the interior reduces to the outer circle only.

---

## Placement Rules

### Browser tab / Favicon

Use the SVG favicon (`public/favicon.svg`) — symbol only. The wordmark is never present in favicon contexts. Background: Roundtable Indigo `#2D2B55`. Mark: white `#FFFFFF`.

### App header / Navigation bar

- **Light themes (Linen, Chalk):** Horizontal lockup (`primary.svg`), Roundtable Indigo mark and wordmark. Minimum symbol height: 24px.
- **Dark themes (Slate, Midnight, Ash, Ember):** Horizontal lockup with on-dark colors — Mist `#C4C2E8` for both mark fill and wordmark text. Alternatively, the full-color symbol (Indigo-filled circle with white ring and dots) may be used if the header surface provides sufficient contrast.
- **Outrun theme:** Symbol in full-color (Indigo circle, white hexagon and dot). Do not use Mist on Outrun — Mist reads washed-out against Outrun's near-black. The solid indigo circle reads as a grounding element against Outrun's neon chrome.

### Marketing / landing page

Use the horizontal lockup on white or cream backgrounds. The brand primary (`#2D2B55`) is the default rendering. For marketing on dark backgrounds, use the Mist-colored version or the reversed full-color lockup (symbol remains Indigo-filled with white interior; wordmark in Mist).

### Print / physical

Symbol minimum 8mm. Use Roundtable Indigo on white/cream stock. Use Mist on dark stock. Never use the model accent colors as brand colors in print.

---

## Approved Logo Variants

| File | Description | Use when |
|------|-------------|---------|
| `logo/primary.svg` | Symbol + wordmark, horizontal | Default; header, marketing |
| `logo/primary-stacked.svg` | Symbol + wordmark, stacked | Square-format contexts |
| `logo/symbol.svg` | Symbol only | Favicon, app icon, avatar |
| `logo/wordmark.svg` | Wordmark only | Co-branding lockups, text-heavy contexts |
| `logo/mono-light.svg` | Monochrome horizontal, dark mark | Light surface with `currentColor` |
| `logo/mono-dark.svg` | Monochrome horizontal, light mark | Dark surface with `currentColor` |

---

## On-Color Usage

| Background type | Variant to use |
|-----------------|----------------|
| White (`#FFFFFF`, `#F8F8F8`) | Full-color: `primary.svg` with Indigo |
| Cream / warm light (Linen `#F5F0E8`) | Full-color: `primary.svg` with Indigo |
| Dark neutral (Slate `#0F1117`, Midnight) | Full-color symbol (Indigo circle, white ring + dots) + Mist wordmark; or `mono-dark.svg` |
| Warm dark (Ash, Ember) | Same as dark neutral |
| Outrun neon-black (`#0D0D0D`) | Full-color symbol only; no wordmark in neon contexts unless on a stable non-Outrun surface |
| Photography / busy image | Do not place logo directly on images. Use a solid color field (Indigo, white, or cream) as a background container first |
| Model accent colors (amber, teal, purple, etc.) | Never place the brand logo on a model accent color field |

---

## Forbidden Uses

The following are prohibited in all contexts:

1. **Stretching or distorting the mark.** The lockup proportions are fixed. Never scale the symbol and wordmark independently.

2. **Recoloring outside approved variants.** The only approved mark colors are: Roundtable Indigo `#2D2B55`, Roundtable Mist `#C4C2E8`, white `#FFFFFF`, and `currentColor` (mono SVG only). Never render the mark in a model accent color (amber, teal, purple, coral, blue, pink). The brand is not a model.

3. **Drop shadows on the mark.** No `box-shadow`, `filter: drop-shadow`, or text-shadow on the wordmark or symbol. The mark is flat.

4. **Outlined / stroked version of the filled symbol.** The symbol is a filled circle — its identity depends on the filled form. A stroked-only outline version is not an approved variant.

5. **Placing the logo on busy backgrounds without a field.** Never place any variant directly on a photograph, illustration, textured surface, or model accent color without a clear backer field.

6. **Using model accent colors as brand colors.** Amber `#F59E0B`, teal `#14B8A6`, purple `#AF5FF8`, coral `#F97316` and their theme variants are model identity colors. They identify Claude, GPT, Gemini, and other models respectively. Using them for the Roundtable brand would confuse model identity with product identity.

7. **Rotating or reflecting the mark.** The R1 mark is rotationally symmetric at 60° intervals — all elements are circles. The mark has no preferred orientation and no "head." Despite this symmetry, do not casually rotate the mark in digital contexts, as it introduces inconsistency across placements without adding meaning. Use the canonical SVG files as delivered.

8. **Animating the mark outside authorized animation contexts.** The only authorized mark animation is the app loading state (fade-in at `timing.slow: 350ms`). No pulsing, spinning, bouncing, or morphing of the symbol in any application context.

9. **Adding taglines to the lockup.** Taglines are placed separately from the lockup, outside the clear space, in body typography. They are never embedded into the logo files.

---

## Luma Handoff Notes

### Palette token proposal (flagged — Arch review required)

The brand palette (`/_design/brand/palette/palette.md`) introduces three values not currently representable in the token schema:

| Brand value | Proposed token | Action needed |
|-------------|---------------|---------------|
| `#2D2B55` Roundtable Indigo | `brand.primary` | Arch adds `brand` group to schema |
| `#C4C2E8` Roundtable Mist | `brand.primary-on-dark` | Arch adds `brand` group to schema |
| `#2E2926` Roundtable Warm Neutral | `brand.neutral` | Arch adds `brand` group to schema |

Current schema has no `brand.*` category. The proposal: add a `brand` top-level group to `tokens/schema.md` with these three fixed values. Unlike `surfaces.*` and `text.*`, brand tokens do not vary per theme — they are constants, not theme-relative. Luma should evaluate whether to add them as a `brand` group in the schema or handle them as CSS custom properties outside the theme JSON system. The latter is simpler and avoids forcing all 7 theme files to declare identical brand values.

**Recommendation:** Handle brand colors as a separate static CSS file (`brand-tokens.css`) with `:root { --brand-primary: #2D2B55; --brand-primary-on-dark: #C4C2E8; --brand-neutral: #2E2926; }`, loaded at app startup independently of the theme system. This keeps brand identity stable regardless of theme switching without polluting the theme JSON schema.

### Typography implementation

The Fontsource package installation (`@fontsource/space-grotesk`, `@fontsource/dm-sans` or their variable equivalents) is a dependency addition that requires user authorization before Aria implements it. Marque has specified the typefaces, weights, and delivery method in `/_design/brand/typography/typography.md`. No schema change required for typography.

### Contrast flags

- `#2D2B55` FAILS on dark theme backgrounds (all 5 dark themes). This color must never be used as foreground text on dark surfaces. It is a background color (icon bg, light-theme mark fill) — not a text color.
- `#C4C2E8` FAILS on light theme backgrounds. This color is on-dark only.
- `#2E2926` FAILS on dark theme backgrounds. Light surface / warm context use only.
- No brand colors pass in both contexts simultaneously. This is structurally unavoidable — a single hex value cannot achieve 4.5:1 contrast against both `#0F1117` and `#FFFFFF` simultaneously (those contexts require light and dark values respectively). The two-variant system (Indigo + Mist) handles this correctly.

### No new token additions needed for existing theme system

The model accent palette, semantic colors, surface tokens, and text tokens in the existing schema are not affected by this brand pass. Luma does not need to change any existing theme files as a result of this work.
