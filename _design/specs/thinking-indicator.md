# Thinking Indicator Spec

Addresses issue #371: the assistant bubble body zone is empty before the first streaming token
arrives, leaving users with no in-flight feedback. Under `prefers-reduced-motion`, the existing
streaming shimmer is also suppressed, making the gap worse for users with motion sensitivities.

---

## Design Decision: Three Dots

**Form**: Three 6×6px filled circles, left-aligned in the bubble body zone, arranged in a
horizontal flex row.

**Rationale over alternatives**:
- Three dots is the universal chat convention for "thinking/pending." The static state
  (dots at reduced opacity, no animation) retains legible meaning without motion — unlike a
  shimmer (frozen bar reads as content) or a spinner (static arc has no clear convention).
- Dots don't imply content shape or length, unlike skeleton lines which set structural expectations
  the model response may not fulfill.
- Fits comfortably inside the bubble body zone with no fixed-height constraint needed beyond a
  32px minimum, which is already narrower than a single line of text.

---

## Visual Form

| Property | Value | Token |
|----------|-------|-------|
| Dot diameter | 6px × 6px | — (explicit; between the 7px identity dot and nothing) |
| Border-radius | 9999px (fully circular) | `radius.full` |
| Dot fill color | `--text-muted` | `text.muted` |
| Gap between dots | 8px | `spacing.2` |
| Container layout | `display: flex`, `align-items: center` | — |
| Container min-height | 32px | `spacing.8` |
| Horizontal alignment | Left-aligned (not centered) | — matches text content alignment |

The 6px dot size is intentionally smaller than the 7px model identity dot in the nameplate —
less prominent, because this indicator is transient while the nameplate dot is persistent identity.

---

## Animated State (motion allowed)

Sequential opacity pulse — dots breathe in a rolling wave reading left to right.

| Dot | Delay | Opacity cycle |
|-----|-------|--------------|
| Dot 1 | 0ms | `0.35 → 1.0 → 0.35` |
| Dot 2 | `timing.medium` (200ms) | same |
| Dot 3 | `timing.medium × 2` (400ms) | same |

- **Cycle duration**: 1.2s, `infinite`, `ease-in-out`
- **Stagger**: uses `timing.medium` (200ms) — from the timing scale

The 1.2s total cycle is a concrete animation value, not a timing token. Timing tokens control
transition durations on discrete state changes; @keyframes cycle times use explicit values
(same precedent as the 500ms cursor blink in `motion.md §1`).

CSS reference (illustrative — Aria implements using Tailwind custom animation or global CSS):

```css
@keyframes thinkingPulse {
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 1.0; }
}
.thinking-dot {
  animation: thinkingPulse 1.2s ease-in-out infinite;
}
.thinking-dot:nth-child(2) { animation-delay: 200ms; }
.thinking-dot:nth-child(3) { animation-delay: 400ms; }
```

---

## Static State (`prefers-reduced-motion: reduce`)

All three dots render at `opacity: 0.6`. No animation of any kind.

**Why 0.6, not 1.0**: Full opacity reads as content that has already arrived. 0.6 signals
"provisional/pending" without motion. The animated version averages approximately 0.67 opacity
over a full cycle; 0.6 is the deliberate static calibration — slightly below that average to
remain clearly pending.

**Contrast note**: The dots are `aria-hidden="true"` — they carry no semantic meaning for AT.
The `role="status"` wrapper label is the semantic channel. WCAG 4.5:1 text contrast does not
apply to decorative, aria-hidden elements. No contrast exception is needed here.

---

## Token Mapping

| Visual element | Token | CSS custom property | Tailwind illustrative class |
|----------------|-------|---------------------|-----------------------------|
| Dot fill color | `text.muted` | `--text-muted` | `bg-text-muted` |
| Body zone horizontal padding | `spacing.4` (16px) | — (inherited from body zone wrapper) | `px-4` |
| Body zone top padding | `spacing.2` (8px) | — (inherited from body zone wrapper) | `pt-2` |
| Body zone bottom padding | `spacing.3` (12px) | — (inherited from body zone wrapper) | `pb-3` |
| Inter-dot gap | `spacing.2` (8px) | — | `gap-2` |
| Container min-height | `spacing.8` (32px) | — | `min-h-8` |
| Dot border-radius | `radius.full` (9999px) | `--radius-full` | `rounded-full` |
| Transition-out duration | `timing.fast` (100ms) | `--timing-fast` | `duration-fast` |

**New token values introduced**: None.

---

## Sizing and Placement

The indicator occupies the bubble body zone — the same region as `MessageContent`. The two are
mutually exclusive: when `ThinkingIndicator` renders, `MessageContent` does not, and vice versa.

```
[Bubble nameplate — 28px fixed]
[Body zone wrapper: px-4 pt-2 pb-3]    ← padding belongs to the wrapper, not the indicator
  [ThinkingIndicator]
    [dot] [8px gap] [dot] [8px gap] [dot]
    min-height: 32px, flex row, align-items: center
```

Dots are left-aligned — consistent with the left-aligned text content that replaces them.
Centering would create a visual jump as arriving text snaps to the left edge.

---

## Transition Out

Trigger: `message.content` changes from `''` to any non-empty string (first token arrives).

**Motion allowed**: Aria fades the indicator out over `timing.fast` (100ms), `ease-out`, then
unmounts it. On the same render tick, `MessageContent` mounts and the first chunk receives the
existing `.chunk-entering` class (`chunkFadeIn` per `motion.md §1`). The 100ms fade-out overlaps
the 100ms chunk fade-in — a crossfade at the transition point. Implementation approach (timed
opacity-0 before unmount vs. a React exit animation utility) is Aria's call; duration and
easing are specified here.

**`prefers-reduced-motion`**: Instant swap — `ThinkingIndicator` unmounts and `MessageContent`
mounts on the same React render tick. The `.chunk-entering` animation is already suppressed under
the media query (per `motion.md §1`), so the first token appears immediately at full opacity.

---

## Accessibility

- **Wrapper element**: `role="status"`, `aria-label="[modelName] is thinking"`
- `role="status"` implies `aria-live="polite"` + `aria-atomic="true"`. The label announces once
  when the element mounts. Subsequent animation cycles do not change DOM content, so no
  re-announcement fires.
- **Dot elements**: `aria-hidden="true"`. Purely decorative — all meaning is in the wrapper label.
- When the indicator unmounts and `MessageContent` mounts, AT transitions naturally to the
  existing `aria-live="polite"` streaming region already on `MessageContent`. No teardown needed.

**Screen reader sequence**:
1. User sends message — user bubble announced (existing behavior, unchanged)
2. Assistant bubble mounts with empty body — `ThinkingIndicator` mounts → AT announces
   "[ModelName] is thinking"
3. First token arrives — indicator unmounts, `MessageContent` mounts → AT follows the existing
   streaming `aria-live` region per current behavior

**`modelName` source**: `modelConfig.name` — the same value rendered in the nameplate label.
Fallback when `modelConfig` is unavailable: `"Assistant"`.

---

## Component Contract for Aria

```tsx
interface ThinkingIndicatorProps {
  /**
   * Model display name for the accessible announcement.
   * Source: modelConfig.name. Fallback: "Assistant".
   * Produces: aria-label="[modelName] is thinking"
   */
  modelName: string;
}
```

**Render condition** — evaluated in `MessageBubble`, within the body zone:

```
Render ThinkingIndicator when:
  message.role === 'assistant'
  AND isStreaming === true
  AND (message.content ?? '') === ''

Render MessageContent in all other cases
```

**Motion handling**: CSS-only via `@media (prefers-reduced-motion: reduce)`. Aria does not read
this media query in JavaScript — the animation definitions and opacity values switch automatically
at the CSS layer.

---

## motion.md Update Note

When `motion.md` is next edited, add these rows to the summary table:

| Animation | Duration | Easing | `prefers-reduced-motion` |
|-----------|----------|--------|--------------------------|
| Thinking indicator pulse | 1.2s cycle, 200ms stagger | `ease-in-out` | Static dots at 0.6 opacity — no animation |
| Thinking indicator transition-out | `fast` (100ms) | `ease-out` | Instant unmount |
