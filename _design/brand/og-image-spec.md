# Roundtable OG / Social Image Specification

**Owner:** Marque
**Status:** Complete
**Last updated:** 2026-08-05 (Midnight theme redesign — v2)

---

## Asset Paths

| Variant | File | Dimensions | Use |
|---------|------|-----------|-----|
| Standard OG | `/public/social/og-image.png` | 1200 × 630 px | `og:image`, Twitter `summary_large_image` |
| Square card | `/public/social/og-image-square.png` | 600 × 600 px | Twitter `summary` card (square crop contexts) |
| SVG source | `/public/social/og-image.svg` | 1200 × 630 viewBox | Source of record; update this first |

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

## Design Direction (v2)

**Theme:** Midnight — Roundtable's most polished dark theme. The card mockup layout communicates the core value proposition (multiple AI models responding simultaneously) visually before a user reads a word.

**What changed from v1:**
- Background: Roundtable Indigo `#2D2B55` → Midnight deep navy `#060B18` with subtle radial gradient
- Mark / wordmark color: white `#FFFFFF` → Roundtable Mist `#C4C2E8` (on-dark brand variant)
- Right zone: plain wordmark + tagline → 4 model response card mockups showing the UI
- Mark position: centered vertically (315) → upper-left focal point (235) to make room for text below
- Divider: white at 12% → Midnight border `#1E2D4A` (restrained, integrates with card borders)
- No Outrun theme colors anywhere

---

## Layout Specification (1200 × 630)

### Canvas
- **Dimensions:** 1200 × 630 px
- **Background:** Radial gradient — `#101825` center fading to `#060B18` edges

### Zone division
- **Left zone (0–440px):** Symbol mark + wordmark + tagline
- **Divider:** Vertical rule at x=440, y1=70 to y2=560, `#1E2D4A`, 1px
- **Right zone (440–1200px):** 4 model response card mockups

### Symbol mark (left zone)
- Mark center: (220, 235)
- Ghost halo: r=70, `#C4C2E8` at 5% opacity
- Ring: r=46, stroke 6.5px, `#C4C2E8`
- Six seat dots: r=9.5, `#C4C2E8`, pointy-top arrangement
  - Top: (220, 189)
  - Upper-right: (259.8, 212)
  - Lower-right: (259.8, 258)
  - Bottom: (220, 281)
  - Lower-left: (180.2, 258)
  - Upper-left: (180.2, 212)
- Center dot: r=11, `#C4C2E8`, at (220, 235)

### Text block (left zone, below mark)
- **Wordmark:** "ROUNDTABLE", x=62, y=348 (baseline), 38px, weight 700, letter-spacing 4, `#C4C2E8`
- **Tagline:** "Multi-model AI conversation", x=64, y=379 (baseline), 15px, weight 400, letter-spacing 1.5, `#94A3C8`
- Font stack: Space Grotesk, DM Sans, system-ui, sans-serif

### Model response card mockups (right zone)

**Card template:**
- Body: x=472, width=668, height=108, rx=8, fill=`#0D1525`, stroke=`#1E2D4A` 1px
- Left glow wash: x=472, width=668, height=108, rx=8, fill=gradient url(#glow-MODEL) — horizontal, model color at 7% opacity on left edge fading to 0% at right edge
- Left accent bar: x=473, y=card_y+7, width=4, height=94, rx=2, fill=MODEL_COLOR
- Model dot: cx=492, cy=card_y+22, r=4.5, fill=MODEL_COLOR
- Label rect: x=503, y=card_y+13, height=9, rx=4, fill=`#1A2840`
- Content lines: rx=4, fill=`#1A2840` (lines 1–2), `#152035` (line 3, shorter/lighter)

**Card vertical positions and dimensions:**

| Card | Model | Accent | y position | Label width | Line widths |
|------|-------|--------|-----------|-------------|-------------|
| 1 | Claude | `#FBB034` amber | 75 | 55px | 540, 460, 310 |
| 2 | GPT | `#00CDB8` teal | 197 | 48px | 555, 420, 285 |
| 3 | Gemini | `#B06EFF` purple | 319 | 62px | 510, 445, 380 |
| 4 | Grok | `#38B6F0` blue | 441 | 50px | 530, 390, 255 |

Gap between cards: 14px (197-75-108=14).

---

## Layout Specification (600 × 600 square variant)

### Canvas
- **Dimensions:** 600 × 600 px
- **Background:** Radial gradient — `#101825` center fading to `#060B18` edges

### Symbol mark (upper half)
- Mark center: (300, 190)
- Ghost halo: r=62, `#C4C2E8` at 5% opacity
- Ring: r=40, stroke 6px, `#C4C2E8`
- Six seat dots: r=8, `#C4C2E8`, pointy-top arrangement
- Center dot: r=10, `#C4C2E8`

### Text block (lower third) — center-aligned
- **Wordmark:** "ROUNDTABLE", centered at x=300, 32px, bold, letter-spacing 3.5, `#C4C2E8`
- **Tagline:** "Multi-model AI conversation", centered at x=300, 14px, regular, letter-spacing 1.5, `#94A3C8`
- Generated using ImageMagick `-gravity Center`

### Model accent dots (square variant — replaces full card mockup)
- A horizontal divider at y=390, x1=150 to x2=450, `#1E2D4A` — symmetric around x=300
- Four model dots below at y=420, evenly spaced centered at x=300:
  - 4 dots × 24px diameter + 3 gaps × 20px = 156px total width; start x = (600-156)/2 = 222
  - Claude (amber `#FBB034`): cx=234, r=12
  - GPT (teal `#00CDB8`): cx=278, r=12
  - Gemini (purple `#B06EFF`): cx=322, r=12
  - Grok (blue `#38B6F0`): cx=366, r=12
- Rationale: The full card mockup is illegible at 600px square. Four accent dots communicate "multiple models" without visual noise. Center alignment corrects the lopsided left-aligned layout.

---

## Brand Values Used

| Element | Color | Hex |
|---------|-------|-----|
| Background center | Midnight bg lighter | `#101825` |
| Background edge | Midnight bg | `#060B18` |
| Mark, wordmark | Roundtable Mist (on-dark) | `#C4C2E8` |
| Tagline | Secondary text | `#94A3C8` |
| Divider, card borders | Midnight border | `#1E2D4A` |
| Card surface | Midnight card | `#0D1525` |
| Card label rects | Dark blue | `#1A2840` |
| Card line 3 (subdued) | Darker blue | `#152035` |
| Claude accent | Amber | `#FBB034` |
| GPT accent | Teal | `#00CDB8` |
| Gemini accent | Purple | `#B06EFF` |
| Grok accent | Blue | `#38B6F0` |

No Outrun theme colors. No white `#FFFFFF` — all mark/text elements use Mist on dark.

---

## PNG Export Notes

- Generated with ImageMagick 6.9 (`convert`) using drawing primitives
- No SVG rasterization (rsvg-convert and Inkscape not available in container)
- Font used in PNG export: DejaVu Sans Bold (wordmark), DejaVu Sans (tagline) — closest available system font to Space Grotesk
- Radial gradient: `radial-gradient:'#101825-#060B18'` (ImageMagick built-in)
- Semi-transparent fills: `rgba()` color spec in `-draw` commands
- For a higher-fidelity export with Space Grotesk, install the font and re-export from `og-image.svg` using rsvg-convert or Inkscape
- Both exports are 16-bit sRGB PNG; lossless compression
- Do not use JPEG for these assets

---

## Regeneration

The PNG is drawn from primitives, not rasterized from SVG. To regenerate, re-run the ImageMagick commands in `/_design/brand/scripts/` (or reproduce from this spec). The SVG is the design source of record; the PNG is generated independently.

If Space Grotesk is later installed in the build environment:

```sh
rsvg-convert -w 1200 -h 630 public/social/og-image.svg -o public/social/og-image.png
rsvg-convert -w 600 -h 600 public/social/og-image-square.svg -o public/social/og-image-square.png
```
