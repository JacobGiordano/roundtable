# @Mention Autocomplete — Design Spec

Covers the `@ModelName` directed-reply feature for the chat input. This spec rules on two open design questions and provides implementation-ready values for Aria.

---

## Question 1 — Does `@ModelName` stay in the sent message text?

**Ruling: Strip it. Use a routing indicator on the bubble instead.**

The `@ModelName` token is routing metadata, not message content. Keeping it in the delivered text pollutes conversation history with UI artifacts — other models reading prior turns in the thread will encounter "Hey @Gemini, explain this…" where the mention adds no semantic value beyond what the existing "[Name responded:]" framing already establishes. Stripping it keeps message content clean and model-agnostic.

The routing signal belongs on the bubble, not in the text. A directed-reply message bubble gets a small routing label in the nameplate zone: "→ Gemini" rendered in `text.muted` at `11px` / `font-weight: 400`, appended after the model name, right of the dot-and-label group, left of the timestamp. This is the only place the routing intent is communicated post-send.

---

## Question 2 — Visual treatment in the input

**Ruling: Highlighted span, not a pill/chip.**

The input is a plain textarea. Introducing a contenteditable-based rich-text approach to support non-editable pill tokens is implementation cost that does not earn its keep: the atomic/non-editable property of a pill matters most when a mention is embedded mid-sentence and partial edits would corrupt it. For a directed-reply that routes the entire message, a partial edit is not a meaningful risk — the user can simply delete the `@ModelName` text and re-type `@` to re-trigger autocomplete.

The highlight treatment: `@ModelName` text in the input gets `background: color-mix(in srgb, var(--accent-{modelId}) 15%, var(--surface-input))` and `color: var(--accent-{modelId})`. This is consistent with the nameplate tint pattern already established in the message bubble spec. The highlight applies from the `@` character through the end of the model name, and is cleared on send (alongside the strip behavior from Q1).

---

## Token implications

No new tokens required. All values map to existing schema:

| Visual element | Token used |
|----------------|------------|
| Highlight background on `@mention` in input | `color-mix()` against `surfaces.input` + model accent — same pattern as nameplate tint |
| Highlight text color | Model accent (`accents.model-{id}`) |
| Routing label "→ ModelName" on bubble | `text.muted`, `11px`, same as timestamp |
| Autocomplete popover background | `surfaces.card` |
| Autocomplete popover border | `borders.default` |
| Autocomplete popover shadow | `shadow.lg` |
| Autocomplete item hover state | `interactive.hover` |
| Autocomplete item active/selected state | `interactive.active` |

The autocomplete popover positions above the input bar (not below — the input sits at the bottom of the viewport; the popover must clear it upward). Maximum 5 items visible without scrolling; remaining items scroll within the popover. Popover width matches the input bar width.

---

## Routing indicator spec (nameplate addition)

When a message bubble was sent as a directed reply, the nameplate flex row gains one additional element between the model name label and the timestamp:

- **Content**: `→ ModelName` — literal arrow character (U+2192), space, model display name
- **Typography**: `11px`, `font-weight: 400`, `color: {text.muted}`
- **Position in flex row**: after the model name label, before the timestamp (`margin-left: auto` stays on the timestamp)
- **No additional gap token needed** — inherits `gap: 8px` already specced on the nameplate flex row

This is the only visual change to the existing bubble spec. The model receiving the message renders its own bubble as normal; the routing indicator appears on that bubble to confirm delivery.
