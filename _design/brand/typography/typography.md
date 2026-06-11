# Roundtable Brand Typography

**Owner:** Marque  
**Status:** Complete  
**Last updated:** 2026-06-11

---

## Typeface Decisions

### Display / Wordmark Typeface: Space Grotesk

| | |
|---|---|
| **Typeface** | Space Grotesk |
| **Designer** | Florian Karsten |
| **License** | SIL Open Font License 1.1 (OFL) — confirmed open |
| **Source** | github.com/floriankarsten/space-grotesk (raw.githubusercontent.com is on the allowed domain list) |
| **npm package** | `@fontsource/space-grotesk` — installable via `npm install` (registry.npmjs.org is on the allowed domain list) |
| **Weights used** | 500 (Medium) for wordmark; 400 (Regular) for body fallback |

**Rationale for Space Grotesk as the display/wordmark face:**

Space Grotesk is a geometric grotesque with a slightly unusual character — specific letters (G, R, a, t) have constructed, mechanical details that give it a technical identity without being cold. It reads as "built, not found," which matches Roundtable's positioning as a crafted, purposeful tool. It is not Inter (too generic, over-used in developer tooling), not Outfit (too friendly), not Syne (too expressive and editorial-as-style, which fights with the "interface recedes" principle). Space Grotesk hits the precise/formal/slightly-distinctive brief without being quirky or calling attention to itself.

The all-caps wordmark at weight 500 with generous tracking (0.12em) reads as a proper logotype — precise, non-decorative, confident. It does not borrow editorial warmth from a serif, which would feel incongruous with a multi-model AI tool; instead it borrows from technical publishing traditions (manuals, documentation, instruments).

**Why not a serif?** Fraunces and Playfair were evaluated. Both read too literary/precious for a tool that surfaces AI model output side by side. Roundtable is editorial-neutral, not editorial-warm. The serif path risks reading as a blogging platform or a reading app rather than an AI conversation interface.

---

### Body / UI Typeface: DM Sans

| | |
|---|---|
| **Typeface** | DM Sans |
| **Designer** | Colophon Foundry for Google |
| **License** | SIL Open Font License 1.1 (OFL) — confirmed open |
| **Source** | github.com/googlefonts/dm-fonts (raw.githubusercontent.com is on the allowed domain list) |
| **npm package** | `@fontsource/dm-sans` — installable via `npm install` |
| **Weights used** | 400 (Regular), 500 (Medium), 600 (SemiBold) |

**Rationale for DM Sans as the body/UI face:**

DM Sans is a geometric sans with slightly warmer proportions than Inter — the letterforms are rounder without being playful. It pairs naturally with Space Grotesk because both occupy the geometric grotesque category with different personalities: Space Grotesk is constructed and slightly peculiar; DM Sans is warm and smooth. The pairing has formal cohesion (both geometric sans) with functional contrast (display vs. body roles are perceptually distinguishable).

Critically, DM Sans does not compete with Space Grotesk for attention in a mixed-weight layout. If both are set at the same size and weight, Space Grotesk reads as the "designed" element and DM Sans reads as the "neutral container." This is exactly the relationship needed for a brand where display use is in the wordmark/header and body use is in UI chrome.

DM Sans at 15px/400 is the UI body text specification, consistent with Luma's existing type scale. The system-font fallback (`system-ui, -apple-system, sans-serif`) bridges gracefully — DM Sans is close enough in proportion to SF Pro (macOS) and Segoe UI (Windows) that the fallback does not produce layout reflow at the sizes Roundtable uses.

---

## Complete Font Stack Specification

### Wordmark / Brand Display

```css
font-family: 'Space Grotesk', 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
font-weight: 500;
letter-spacing: 0.12em;
text-transform: uppercase;
```

### UI / Body

```css
font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
font-weight: 400; /* body */
font-weight: 500; /* labels, model name headers */
font-weight: 600; /* section headings, timestamps (uppercase small) */
```

---

## Delivery Method

**Required approach: npm package installation (`@fontsource`).**

Google Fonts CDN (`fonts.googleapis.com`) is **not on the project's allowed network list** and must not be used. The Fontsource npm packages (`@fontsource/space-grotesk`, `@fontsource/dm-sans`) are the correct delivery mechanism — they install font files locally into `node_modules` and import as CSS from the package, eliminating any external CDN dependency.

Installation:
```
npm install @fontsource/space-grotesk @fontsource/dm-sans
```

Import in the app entry point (e.g., `src/main.tsx`):
```js
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
```

This approach is Aria's responsibility to implement — Marque specs the selection and delivery method; Aria wires the imports. Gate does not need to touch this.

**Fallback chain behavior:** If Fontsource fails to load (dev environment without npm install), the system font stack fallback (`system-ui`) is close enough in proportion that no layout breakage occurs. Luma's current type scale (15px/400, 12px/600 uppercase, etc.) was specified against system fonts and those values carry over directly to DM Sans.

---

## Variable Font Availability

Both Space Grotesk and DM Sans are available as variable fonts (`@fontsource/space-grotesk/variable.css`, `@fontsource/dm-sans/variable.css`). Variable fonts are recommended for production — they reduce HTTP requests and allow fine-grained weight control. The variable font axis for both is `wght` (weight), range 300–700.

Variable import:
```js
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/dm-sans';
```

Note: the variable font packages are `@fontsource-variable/<name>`, not `@fontsource/<name>`. Both are on npm.

---

## Pairing Rationale Summary

Space Grotesk (display) + DM Sans (body) work together because:

1. **Shared DNA:** Both are geometric grotesques. They share construction logic — circular bowls, open apertures, consistent stroke contrast. The visual grammar is the same, preventing the "two strangers" problem.

2. **Functional contrast:** Space Grotesk has distinctive character in larger display settings; DM Sans recedes at smaller UI sizes. The hierarchy is perceptually clear without needing size or weight to carry all the differentiation.

3. **Tone alignment:** Space Grotesk reads as technical and precise; DM Sans reads as warm and functional. Together they locate Roundtable in "capable technical tool with human consideration" — neither purely clinical nor friendly-casual.

4. **Scale coherence:** Both typefaces have similar x-height ratios, meaning mixed-use layouts (e.g., a wordmark adjacent to a UI label) will not produce jarring cap-height mismatches.

---

## Luma Handoff Notes

- The Fontsource packages need to be added as `npm install` dependencies — this is an implementation task for Aria, gated on user authorization to install packages.
- Luma's current type scale values (`15px/400`, `12px/600 uppercase`, etc.) are specified against system fonts. These values are directly compatible with DM Sans — no scale adjustment needed.
- The wordmark SVG files in `/_design/brand/logo/` specify `font-family: 'Space Grotesk', 'DM Sans', system-ui, sans-serif` — the SVG text elements will render correctly once the Fontsource package is installed. For environments without the package, the system fallback renders legibly.
- No new Luma token additions are required for typography. The existing type scale tokens map cleanly.
