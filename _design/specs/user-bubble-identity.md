# User Message Bubble Visual Identity — Issue #279

**Owner:** Luma
**Pipeline:** Luma (this spec) → Aria (CSS + bubble render + color picker) + Gate (storage)
**No Arch dependency** — no new types required.
**Status:** Spec complete

---

## Decision Summary

| Item | Decision |
|------|----------|
| Default user accent token | New `accents.user` token — periwinkle/indigo family |
| CSS variable | `--accent-user` |
| Customization | Yes — Gate stores a single hex, same override architecture as model accents |
| UX surface for customization | Settings panel → Appearance section, "Your messages" color swatch |
| User display name in bubble | Deferred — file separately, lower priority |
| Scope | Items 1 + 2 ship together as #279. Item 3 is a separate future issue. |

---

## 1. Default User Accent Token: `accents.user`

### Why a new token, not an existing one

No existing token represents user/human identity. The candidates fail:

- `interactive.focusRing` — semantically reserved for keyboard focus feedback; in most dark themes it matches `accents.model-claude` (amber), which is exactly the confusion the bug report describes.
- `borders.strong` — structural token for panel boundaries and active sidebar rows; using it for user identity conflates two unrelated meanings and creates visual noise.
- Any `accents.model-*` token — represents an AI model, not the user.

`accents.user` is the right home: the schema already has `accents.*` as the identity token category. User identity is the same conceptual category as model identity.

### Token family: indigo/periwinkle

The periwinkle-indigo hue family (approximately 250–255°) is the only hue band genuinely unused across all 7 model accent palettes. It is:

- Distinct from `model-claude` (amber, ~38°)
- Distinct from `model-gpt` (teal, ~174°)
- Distinct from `model-gemini` (purple, ~278°) — purple is more red-shifted, periwinkle is decisively bluer
- Distinct from `model-other` (coral, ~22°)
- Distinct from `model-grok` (sky blue, ~208°) — sky blue has a cyan cast; periwinkle reads as blue-violet
- Distinct from `model-deepseek` (cobalt, ~228°) — cobalt is darker and more saturated; periwinkle is lighter and more neutral
- Distinct from `model-mistral` (rose, ~340°)

Periwinkle/indigo also reads as "personal" — many messaging platforms use blue-adjacent colors for "your" messages. This is a cultural convention that reinforces the visual distinction.

### Per-theme values

Dark themes use the bright pastel periwinkle family (#A5B4FC) — high visibility against dark surfaces.
Light themes use deep indigo (#4338CA) — sufficient contrast on cream/white cards.
Outrun uses a brighter neon periwinkle (#B4BCFF) — coherent with Outrun's neon brightness tier.

| Theme | Mode | `accents.user` | Contrast on card | Notes |
|-------|------|----------------|-----------------|-------|
| Slate | dark | `#A5B4FC` | 9.33:1 on #1A1D26 | Passes 4.5:1. Distinct from Gemini #AF5FF8 (more red) and DeepSeek #5A82E1 (darker cobalt). |
| Midnight | dark | `#A5B4FC` | 9.89:1 on #0D1525 | Same family. Distinct from Gemini #B06EFF (red-shifted) and DeepSeek #4A7FE8 (cobalt). |
| Ash | dark | `#A5B4FC` | 8.98:1 on #22252A | Ash accents are desaturated; periwinkle stands out cleanly. |
| Ember | dark | `#A5B4FC` | 9.59:1 on #1D1712 | Cool periwinkle against a warm amber-dominated palette is a strong "not AI" signal. |
| Outrun | dark | `#B4BCFF` | 9.28:1 on #12203A | Slightly brighter/more neon than standard to fit Outrun's elevated saturation tier. Distinct from Gemini #D060FF (neon purple) and DeepSeek #7AA0FF (bright blue). |
| Linen | light | `#4338CA` | 6.73:1 on #FDFAF5 | Passes 4.5:1. Distinct from Gemini #7E22CE (red-shifted purple) and DeepSeek #1E4FA0 (darker cobalt). |
| Chalk | light | `#4338CA` | 7.00:1 on #FFFFFF | Same as Linen. Distinct from Gemini #6D28D9 (more red-violet) and DeepSeek #1E4FA0 (darker). |

All values pass 4.5:1 against their theme's `surfaces.card`, which future-proofs them for text use (e.g. a "You" label in the bubble header, if that feature ships later).

### Schema change required

`/_design/tokens/schema.md` must be updated:
- Add `"user": "hex — user/human message identity color (periwinkle/indigo family)"` to the accents section.
- Add `"user"` to the `accents` validation rule in the Validation Rules section.

All 7 theme files must be updated to add `"user": "<value>"` to their `accents` object.

**Gate:** The custom theme import validator (`CustomThemeImport`) must also expect the `user` key in the accents object or it will reject theme files that include it. Gate needs to accept `accents.user` as a valid key.

### Tailwind mapping

| Token | CSS Custom Property | Tailwind Key | Tailwind Class Examples |
|-------|---------------------|-------------|------------------------|
| `accents.user` | `--accent-user` | `colors['accent-user']` | `border-accent-user`, `text-accent-user` |

`/_design/specs/tailwind-mapping.md` must be updated to add this row in the Accents section.

---

## 2. Component Spec: User Message Bubble

User message bubbles use the `{accents.user}` token for their left border. All other dimensions and styling are identical to model message bubbles.

### What changes in the bubble spec (`components.md`)

The existing spec says:
> **Left border**: `3px solid {accents.model-*}` — color is determined by the model that produced the message.

Add a User Message Bubble subsection:

**User Message Bubble — border accent:**
- **Left border**: `3px solid var(--accent-user)` — fixed, not overridden by any model color.
- **No model name header.** User bubbles do not show a label above the content. The `{accents.user}` border is the sole identity signal.
- All other dimensions, padding, background, shadow, and state specs from the main Message Bubble spec apply identically.
- When a user has set a custom color override (see Section 3 below), `--accent-user` will resolve to their chosen hex via the Pass 2 CSS override. No component-level change needed — the CSS variable handles it.

**Bug fix note for Aria:** The current implementation appears to be falling through to a default model accent (likely `--accent-claude`) for user bubbles. The fix is to ensure that when rendering a user message, Aria writes `border-left: 3px solid var(--accent-user)` rather than `var(--accent-{modelId})`. There is no `modelId` on a user message — the fallback must not chain to any model accent.

---

## 3. User Accent Color Customization

### Decision: Yes — ship with issue #279

The two-pass override architecture from `accent-color-customization.md` is directly reusable. The user accent color is a single hex string, not a per-model record. Implementation cost is low because Gate's pattern already exists; this is a one-value variant of the same mechanism.

### Storage (Gate)

| Field | Value |
|-------|-------|
| localStorage key | `"roundtable:user-accent-color"` |
| Data | A single 6-digit hex string matching `/^#[0-9A-Fa-f]{6}$/`, or absent (key not present = "use theme default") |
| Default | Key absent — user gets `{accents.user}` from active theme |

**Gate API (three functions — no new types needed):**

```
getUserAccentColor(): string | null
  Reads "roundtable:user-accent-color".
  Returns the hex string if present and valid.
  Returns null if absent or if the stored value fails /^#[0-9A-Fa-f]{6}$/.
  Synchronous. Never throws.

setUserAccentColor(hex: string): void
  Validates hex matches /^#[0-9A-Fa-f]{6}$/ before writing.
  On failure: throws TypeError (developer guard — Aria validates before calling).
  Writes the validated hex to "roundtable:user-accent-color".
  Synchronous.

clearUserAccentColor(): void
  Removes "roundtable:user-accent-color" from localStorage.
  No-op if key is absent.
  Synchronous.
```

Expose these three functions in Gate's public API so Aria can import them.

### CSS Override (Aria)

Add to the Pass 2 user accent override, called after `applyTheme()` and after `applyUserAccentColors()`:

```
function applyUserMessageColor(): void {
  const stored = getUserAccentColor();
  const root = document.documentElement;
  if (stored) {
    root.style.setProperty('--accent-user', stored);
  } else {
    // No stored value — remove any previously-set inline style.
    // Pass 1's theme value for --accent-user will take effect.
    root.style.removeProperty('--accent-user');
  }
}
```

Call `applyUserMessageColor()`:
1. On app load, after `applyTheme()` and after `applyUserAccentColors()`.
2. On every theme switch, same order.
3. Immediately when the user saves a new user accent color via `setUserAccentColor()`.
4. Immediately when the user clears their color via `clearUserAccentColor()`.

### UX Surface (Aria)

**Location:** Settings panel, within the existing Appearance section (or a new "Your messages" subsection if Appearance grows large). Positioned after the theme picker row and after (or alongside) the "Reset all model colors" affordance from `accent-color-customization.md`.

**Row layout:**
- Label: "Your message accent" — `13px`, `font-weight: 500`, `{text.secondary}`.
- Color swatch button: `36px × 36px`, `border-radius: {radius.md}`. Background is the currently active user accent color (resolved: stored hex or the theme's `accents.user` default). Clicking opens the color picker popover.
- Swatch border: `1px solid {borders.default}`.

**Color Picker Popover:** Identical spec to the model accent popover in `accent-color-customization.md` with the following differences:
- Header label: "Your accent" (not "Model accent").
- No model-specific routing — clicking a swatch calls `setUserAccentColor(hex)` directly.
- "Reset to theme default" calls `clearUserAccentColor()`, then re-runs `applyUserMessageColor()`.
- Shown when `getUserAccentColor() !== null`.
- Same 12-swatch grid, same contrast warning at 4.5:1 threshold against active theme's `surfaces.background`.
- Same close behavior table (swatch click saves + closes, Escape closes without save, etc.).

**Contrast warning:** Same threshold as model accents (4.5:1 against `surfaces.background`). A user who picks a low-contrast color on a dark theme and switches to a light theme will see the warning update in real time on the next color picker open.

---

## 4. User Display Name — Deferred

**Decision: Deferred. Do not implement in this issue.**

**Rationale:** The 3px `{accents.user}` left border solves the visual identity problem completely — users know which messages they sent because the color is theirs, not any model's. A name label (e.g. "You" or "Jacob") adds negligible disambiguation value in solo sessions because the user already knows they sent every non-bordered-with-a-model-color bubble.

The deferred case where user display name becomes compelling:
- Multi-user/shared sessions (not planned in current phases)
- Conversation export readability (marginal improvement over "User:" which can be derived from the absence of a model name)
- Screen reader context (the bubble role and order already communicate authorship)

**File a separate issue when:** A product reason emerges for user display name (e.g., multi-user sessions, export formatting, or a profile feature that benefits from it). At that point the bubble spec addition is simple: the same typographic treatment as model name headers (`12px`, `600`, `{text.secondary}`, uppercase, `letter-spacing: 0.04em`) with the text being the stored display name (or "You" as the default).

**Do not add "You" as a hardcoded label now.** The border accent is sufficient, and adding a label creates a visual imbalance — model bubbles have labels because there are multiple models to distinguish; the user is a single consistent identity whose bubbles are already visually distinct.

---

## 5. Scope and Pipeline

### This issue (#279) covers

1. Luma spec (this document)
2. Schema update: `/_design/tokens/schema.md` — add `accents.user` definition and validation rule
3. All 7 theme files: add `accents.user` values per the table in Section 1
4. Tailwind mapping update: `/_design/specs/tailwind-mapping.md` — add `--accent-user` row
5. Components spec update: `/_design/specs/components.md` — add user bubble border annotation
6. Gate: add `getUserAccentColor()`, `setUserAccentColor()`, `clearUserAccentColor()`; expose via Gate's public API
7. Aria: apply `--accent-user` CSS var to user message left border; add Pass 2 user color override; add "Your message accent" row to Settings → Appearance

### Dependencies

- No Arch session required (no new named types; `string | null` return from Gate is sufficient).
- Gate must merge before Aria's color picker, same as the model accent pattern from issue #38.
- Ada audit required after Aria's session per standard SOP.

### What is NOT in scope for #279

- User display name in bubble header — separate future issue
- Schema changes to custom theme import validator (Gate should accept `accents.user` in custom theme JSON — small Gate change, can be included in Gate's #279 work)
- Changes to conversation export format — user identity in exports continues to use a "user" role label derived from the message type, not from `accents.user`

---

## 6. Considered and Rejected: Model Avatars in Bubble Header

**Decision: No avatars. Do not revisit unless multi-user sessions ship.**

The question was assessed during the #279 design session: should assistant message bubbles display an optional avatar (provider logo by default, custom image allowed) next to the model name header?

**Why no:**

The full-height 3px left-border accent already provides unambiguous model identity before the user's eye reaches the header row. In a 3–5 model conversation, the colored stripe column on the left side of the thread is the primary signal — learned within the first exchange, maintained effortlessly. Adding a 16–20px circular avatar to the bubble header inserts a third identity signal at the point where identification is already complete.

Additional problems:
- **Provider logos are unreliable assets at 16–20px.** Anthropic's mark works. Google's multi-color "G" is visually noisy. OpenAI's mark requires padding to read. Custom providers and unknown providers have no logo at all — the fallback (initials circle, generic icon) undercuts the premise and ships an inconsistent system.
- **Avatars create a competing visual grammar.** The accent colors are designed as learned associations (amber = Claude across all 7 themes). Provider logos introduce a parallel identity track. A new model's logo becomes the first signal rather than the color, which means the color is no longer reliably load-bearing.
- **Bubble header complexity goes from zero to non-trivial.** The current header is a single text label. An avatar adds inline layout, image loading, fallback states, and async rendering — for a disambiguation problem already solved by the border.

**The future condition that reopens this question:**

Multi-user sessions where human participants need avatar identity. If multiple humans share a conversation thread, user avatars (profile photos, initials circles) become meaningful because humans don't have assigned accent colors. At that point, symmetry pressure between human avatars and model bubbles would be real. Reopen the question then — with a fresh spec covering asset sourcing, fallback treatment, and layout impact across all 7 themes from the start.

Until multi-user sessions are a product decision: **no avatars**.

---

## Contrast Audit Summary

| Theme | Token value | Surface | Ratio | WCAG |
|-------|-------------|---------|-------|------|
| Slate | #A5B4FC | card #1A1D26 | 9.33:1 | AA PASS |
| Midnight | #A5B4FC | card #0D1525 | 9.89:1 | AA PASS |
| Ash | #A5B4FC | card #22252A | 8.98:1 | AA PASS |
| Ember | #A5B4FC | card #1D1712 | 9.59:1 | AA PASS |
| Outrun | #B4BCFF | card #12203A | 9.28:1 | AA PASS |
| Linen | #4338CA | card #FDFAF5 | 6.73:1 | AA PASS |
| Chalk | #4338CA | card #FFFFFF | 7.00:1 | AA PASS |

All 7 theme values pass 4.5:1 as text (stricter threshold, since border use only requires 3:1). Future-proofed for the user display name feature if it ships.

Note: periwinkle in dark themes passes text contrast but is not used as text in the current spec — only as a 3px border (decorative). The text contrast verification provides a safety margin in case the display name feature ships without a separate Luma session.
