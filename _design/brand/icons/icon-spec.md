# Roundtable App Icon Specification

**Owner:** Marque  
**Status:** Complete  
**Last updated:** 2026-06-11

---

## Construction Grid

- **Base canvas:** 512 × 512 px
- **Safe zone:** 64 px each side (128 px total per axis)
- **Live area:** 384 × 384 px (centered)
- All mark elements must remain within the live area. Padding is structural — do not fill it.

---

## Container Shape Decision

**Rounded square with continuous curvature (squircle approximation).**

Rationale: Platform-standard for app icons on iOS, macOS, and Android adaptive icons. A full-bleed circle is rejected — it reads as a logo badge, not an app icon, and loses legibility at 16px. A hard-corner square is rejected — too rigid for the Roundtable character. The squircle approximates `border-radius: 22.5%` of the container edge (roughly 115px on a 512px base), consistent with iOS icon rounding.

For SVG rendering, approximate the squircle with a rounded rect:
```svg
<rect x="0" y="0" width="512" height="512" rx="115" ry="115" fill="#2D2B55"/>
```

For platform-native delivery, export as full-bleed 512×512 PNG (no embedded border-radius); each platform clips to its own shape.

---

## Background Color Decision

**Solid brand primary: `#2D2B55` (Roundtable Indigo).**

Rationale: The app icon must identify the application, not adapt to the user's wallpaper. Transparent backgrounds are rejected — they produce unreadable results on dark wallpapers. The brand primary provides a consistent, ownable identity across home screens, taskbars, and browser tabs. The white mark on `#2D2B55` clears WCAG AA contrast (see palette.md for full ratios).

The icon background uses the dark value of the brand primary regardless of system light/dark mode — app icons do not theme-switch. Only the SVG favicon supports `prefers-color-scheme` adaptation.

---

## Icon Construction at 512px

Within the 384 × 384 px live area:

- **Symbol:** Roundtable mark (circle + hexagon + center dot) scaled to **288 × 288 px**, centered at (256, 256)
- The outer circle of the mark: radius = 144 px, center (256, 256)
- Hexagon inscribed at radius = 84 px (proportional to 48-unit grid: 14/24 × 144)
- Center dot: radius = 18 px
- Hexagon stroke weight: **12 px** (scaled from 2px on 48-unit grid: 2/48 × 288 = 12)
- All elements: white (`#FFFFFF`)

---

## Export Size Table

| Size (px) | Use | Format | Notes |
|-----------|-----|--------|-------|
| 16 | Browser tab favicon | SVG / ICO | Symbol only; hexagon detail not visible — solid circle reads |
| 32 | Browser tab (HiDPI) / Windows taskbar | SVG / ICO | Symbol only; center dot faintly visible |
| 48 | Windows taskbar / desktop shortcut | PNG | Full mark; hexagon faintly readable |
| 128 | macOS Dock / Linux desktop | PNG | Full mark; hexagon clearly readable |
| 180 | iOS home screen (`apple-touch-icon`) | PNG | Full mark with squircle crop |
| 192 | Android adaptive icon / PWA manifest | PNG | Full-bleed; platform clips to squircle |
| 256 | Windows app tile / large shortcut | PNG | Full mark; all detail resolved |
| 512 | App store / PWA manifest | PNG | Master export; full detail |

---

## SVG Favicon Specification

**File:** `public/favicon.svg`

The SVG favicon uses `prefers-color-scheme` media queries to adapt the icon mark to system appearance, while keeping the symbol readable in both contexts.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <title>Roundtable</title>

  <!-- Dark mode (default): filled circle on transparent background -->
  <style>
    @media (prefers-color-scheme: light) {
      .icon-bg   { fill: #2D2B55; }
      .icon-mark { stroke: #FFFFFF; fill: #FFFFFF; }
      .icon-mark-fill { fill: #FFFFFF; }
    }
    @media (prefers-color-scheme: dark) {
      .icon-bg   { fill: #2D2B55; }
      .icon-mark { stroke: #FFFFFF; fill: #FFFFFF; }
      .icon-mark-fill { fill: #FFFFFF; }
    }
  </style>
  <!-- Note: both modes use the same rendering — the brand primary background
       is intentional in both contexts. The media query block is retained for
       future differentiation (e.g., a lighter bg version in light mode). -->

  <circle cx="24" cy="24" r="22" class="icon-bg" fill="#2D2B55"/>
  <polygon
    points="38,24 31,36.12 17,36.12 10,24 17,11.88 31,11.88"
    fill="none"
    class="icon-mark"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <circle cx="24" cy="24" r="3" class="icon-mark-fill" fill="#FFFFFF"/>
</svg>
```

**HTML `<head>` reference:**
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

## ICO Fallback Rules

1. The `.ico` file must contain **two sizes**: 16×16 and 32×32 PNG frames embedded.
2. Use the symbol-only mark (no wordmark) in the ICO.
3. Background: solid `#2D2B55`. Do not use transparency in ICO — legacy IE and some Windows shell contexts do not composite transparent ICOs correctly.
4. At 16px, the hexagon interior is not rendered — the mark is a plain filled circle with a barely-visible white center dot. This is acceptable. The circle silhouette is the brand identifier at this size.
5. ICO is a fallback only — browsers that support SVG favicons will use `favicon.svg`. ICO serves IE 11, older Chromium on Windows, and some shell integrations.

---

## Production Notes

- All PNG exports: use lossless compression (oxipng or equivalent); no JPEG compression for icon assets.
- Do not embed ICC color profiles in icon PNGs — they inflate file size without visible benefit at icon dimensions.
- The squircle crop is applied by the platform at runtime from full-bleed PNGs. Do not pre-apply the crop in PNG exports (except `apple-touch-icon`, which Apple clips — either approach works but pre-rounded is safe).
- `apple-touch-icon` (180px): Apple pre-applies a gloss layer on older iOS. This project does not use `apple-touch-icon-precomposed` — allow the gloss if desired; it does not affect legibility.
