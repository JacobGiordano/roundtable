# Roundtable OG / Social Image Specification

**Owner:** Marque
**Status:** Complete
**Last updated:** 2026-07-22

---

## Asset Paths

| Variant | File | Dimensions | Use |
|---------|------|-----------|-----|
| Standard OG | `/public/social/og-image.png` | 1200 × 630 px | `og:image`, Twitter `summary_large_image` |
| Square card | `/public/social/og-image-square.png` | 600 × 600 px | Twitter `summary` card (square crop contexts) |
| SVG source | `/public/social/og-image.svg` | 1200 × 630 viewBox | Source for re-export if regeneration needed |

---

## For Forge — Meta Tag Wiring

The primary OG image path is:

```
/public/social/og-image.png
```

Wire this in `index.html` (or the HTML template) as:

```html
<meta property="og:image" content="/social/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="/social/og-image.png">
```

For the square variant (Twitter `summary` card — less common):

```html
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="/social/og-image-square.png">
```

Note: Vite serves `public/` as the root. The in-HTML path is `/social/og-image.png`, not `/public/social/og-image.png`.

---

## Layout Specification (1200 × 630)

### Canvas
- **Dimensions:** 1200 × 630 px
- **Background:** Roundtable Indigo `#2D2B55`

### Zone division
- **Left zone (0–420px):** Symbol mark, centered at (220, 315)
- **Divider:** Vertical rule at x=420, `#FFFFFF` at 12% opacity
- **Right zone (420–1200px):** Wordmark + tagline, text block starting at x=490

### Symbol mark (left zone)
- Outer ghost circle: r=101, `#FFFFFF` at 10% opacity — provides soft halo behind mark
- Ring: r=64, stroke 9px, `#FFFFFF`
- Six seat dots: r=14, `#FFFFFF`, pointy-top arrangement on the ring
  - Top: (220, 251)
  - Upper-right: (275, 283)
  - Lower-right: (275, 347)
  - Bottom: (220, 379)
  - Lower-left: (165, 347)
  - Upper-left: (165, 283)
- Center dot: r=16, `#FFFFFF`, at (220, 315)

### Text block (right zone)
- **Wordmark:** "ROUNDTABLE", x=490, y=305 (baseline), 72px, bold weight, `#FFFFFF`
- **Tagline:** "Multi-model AI conversation", x=490, y=365 (baseline), 28px, regular weight, Roundtable Mist `#C4C2E8`
- Font stack: Space Grotesk, DM Sans, system-ui, sans-serif

---

## Layout Specification (600 × 600 square variant)

### Canvas
- **Dimensions:** 600 × 600 px
- **Background:** Roundtable Indigo `#2D2B55`

### Symbol mark (upper half)
- Centered at (300, 220) — upper-center of the square
- Ghost halo: r=120, `#FFFFFF` at 10% opacity
- Ring: r=64, stroke 8px, `#FFFFFF`
- Six seat dots: r=13, `#FFFFFF`, pointy-top arrangement
- Center dot: r=15, `#FFFFFF`

### Text block (lower third)
- **Wordmark:** "ROUNDTABLE", x=80, y=420, 54px, bold, `#FFFFFF`
- **Tagline:** "Multi-model AI conversation", x=81, y=460, 22px, regular, `#C4C2E8`

---

## Brand Values Used

| Element | Color | Hex |
|---------|-------|-----|
| Background | Roundtable Indigo | `#2D2B55` |
| Mark, wordmark | White | `#FFFFFF` |
| Tagline | Roundtable Mist | `#C4C2E8` |

No model accent colors. No theme tokens. Brand palette only.

---

## PNG Export Notes

- Generated with ImageMagick 6 (`convert`) from the SVG source and direct drawing primitives
- Font used in PNG export: DejaVu Sans Bold (wordmark), DejaVu Sans (tagline) — closest available system font to Space Grotesk
- For a higher-fidelity export with Space Grotesk, install the font in the build environment and re-export from `og-image.svg` using `rsvg-convert` or Inkscape
- Both exports are 16-bit RGBA PNG; lossless compression
- Do not use JPEG for these assets — JPEG compression artifacts are visible on flat-color social cards

---

## Regeneration

To regenerate from SVG source (requires `rsvg-convert` or Inkscape with Space Grotesk installed):

```sh
rsvg-convert -w 1200 -h 630 public/social/og-image.svg -o public/social/og-image.png
```

Or via ImageMagick (system font only):

```sh
convert -size 1200x630 xc:"#2D2B55" [drawing primitives...] public/social/og-image.png
```

See `/_design/brand/scripts/` for any generation scripts if added.
