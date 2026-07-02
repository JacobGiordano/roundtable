# Ada Audit — #285 Wave 3: File Attachment UI
**Date:** 2026-07-02
**Auditor:** Ada
**Standard:** WCAG 2.1 Level AA
**Scope:** Narrowed per Coda spawn prompt — keyboard operability, ARIA attributes, focus management only. Full 7-theme contrast audit explicitly skipped (chips use existing `--accent-user` values at 15%/40% opacity, same as previously audited directed-reply chips).

---

## Files Audited

- `src/ui/InputBar.tsx` — attach button, chips row, chip remove buttons, drag-drop zone, VisionWarningModal integration, file input
- `src/ui/components/VisionWarningModal.tsx` — dialog structure, focus trap, focus management
- `src/ui/hooks/useAttachments.ts` — reviewed for error messaging (role="alert" source)
- `src/ui/icons/index.tsx` — PaperclipIcon, SmallCloseIcon (aria-hidden confirmation)

## Testing Method

Static code analysis of all four files. No dev server session required for this narrowed scope — the audit items are all decidable from the markup and event handler logic.

---

## BLOCKER Findings

### BLOCKER-1: Chip remove button — Enter/Space loses focus after activation
**WCAG 2.4.3 Focus Order (Level A)**
**Severity:** Critical — keyboard users lose focus position when removing an attachment via Enter or Space.

**Observed behavior:**
The chip × button has two code paths for removal:

1. `onClick={() => removeAttachment(att.id)}` — fires for mouse click, Enter, and Space
2. `onKeyDown={(e) => handleChipKeyDown(e, att.id, index)}` — fires for Delete and Backspace

`handleChipKeyDown` (InputBar.tsx:363–379) correctly manages focus after removal: it moves focus to the previous chip's remove button (if `chipIndex > 0`) or to the attach button (if `chipIndex === 0`). However, the `onClick` handler calls `removeAttachment` with no focus management. When Enter or Space activates the remove button, the button is removed from the DOM and focus is lost to the browser default (typically `document.body`), stranding keyboard users.

**Location:** `src/ui/InputBar.tsx`, lines 607–622 (chip × button markup) and 363–379 (`handleChipKeyDown`).

**Fix:**
Extract the focus-management logic into a shared helper and call it from both paths. The simplest correct fix is to add focus management to the `onClick` handler directly:

```tsx
onClick={() => {
  removeAttachment(att.id);
  // Manage focus explicitly — mirroring handleChipKeyDown so Enter/Space
  // and Delete/Backspace both land focus in the correct place (WCAG 2.4.3).
  requestAnimationFrame(() => {
    if (index > 0) {
      const chips = document.querySelectorAll<HTMLElement>('[data-chip-remove]');
      chips[index - 1]?.focus();
    } else {
      attachButtonRef.current?.focus();
    }
  });
}}
```

Alternatively, refactor into a `removeAndFocus(id, index)` function used by both `onClick` and `onKeyDown`. Either approach is acceptable.

---

## ADVISORY Findings

### ADVISORY-1: File addition is silent to assistive technology
**WCAG 4.1.3 Status Messages (Level AA)**
**Severity:** Serious — screen reader users have no feedback when a file is successfully attached.

**Observed behavior:**
When a file is added via the file picker, drag-drop, or paste, the chip appears in the DOM but the chips list (`role="list"`, InputBar.tsx:584) has no `aria-live` attribute. AT receives no announcement that the file was accepted. The error case (5-image limit exceeded) is correctly announced via `role="alert"` on the error paragraph (line 560). The success case is not.

A keyboard user who presses Enter on the attach button, selects a file in the native file picker, and returns to the page has no programmatic notification that anything happened.

**Fix:**
Add `aria-live="polite"` and `aria-relevant="additions"` to the chips list container, or add a dedicated sr-only live region in the chips section that announces the updated count:

```tsx
<div
  className="flex gap-2 overflow-x-auto pb-2"
  role="list"
  aria-label="Pending attachments"
  aria-live="polite"
  aria-relevant="additions removals"
>
```

Or a separate sr-only announcement span adjacent to the list:
```tsx
<span className="sr-only" aria-live="polite" aria-atomic="true">
  {attachments.length > 0 ? `${attachments.length} image${attachments.length === 1 ? '' : 's'} attached` : ''}
</span>
```

### ADVISORY-2: File picker focus return is not explicitly guaranteed
**WCAG 2.4.3 Focus Order (Level AA)**
**Severity:** Moderate — focus return after the native file dialog closes is browser-dependent; Safari may lose it.

**Observed behavior:**
`handleAttachClick` calls `fileInputRef.current?.click()` on an `sr-only` hidden input (InputBar.tsx:287). `handleFileInputChange` processes the result (lines 291–300) but does not explicitly restore focus to `attachButtonRef`. In Chrome and Firefox, focus typically remains on the attach button after the file dialog closes because the programmatic click originates from a button the user was focused on. In Safari, this is less reliable — focus can fall to the document body, stranding keyboard users.

**Fix:**
Add an explicit focus restoration at the end of `handleFileInputChange`:

```tsx
const handleFileInputChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files);
    }
    e.target.value = '';
    // Restore focus to the attach button after the native file dialog closes.
    // Browser behavior after programmatic file input .click() is inconsistent;
    // explicit restoration is required for Safari (WCAG 2.4.3).
    requestAnimationFrame(() => attachButtonRef.current?.focus());
  },
  [addFiles],
);
```

### ADVISORY-3: Modal backdrop has redundant aria-hidden="false"
**WCAG 4.1.2 Name, Role, Value (minor markup correctness)**
**Severity:** Minor — no AT impact in practice, but contradicts best practice for modal backdrop markup.

**Observed behavior:**
`VisionWarningModal.tsx` line 92: the full-screen backdrop `<div>` has `aria-hidden="false"`. This is the implicit default and is therefore redundant. The semantically correct approach for a modal backdrop is `aria-hidden="true"` — the backdrop has no meaningful content of its own; the inner `role="dialog"` panel with `aria-modal="true"` is what AT should interact with.

Note: `aria-modal="true"` on the inner panel causes modern AT to treat non-dialog content as inert, so `aria-hidden="false"` on the backdrop causes no practical harm with current AT. It is a markup quality issue.

**Fix:**
Change `aria-hidden="false"` to `aria-hidden="true"` on the backdrop div (VisionWarningModal.tsx:92).

---

## Clean Findings

The following items passed and should be preserved:

**VisionWarningModal dialog structure:** `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` are all present and correctly wired (`titleId` from `useId()` applied to both the dialog and the `<h2>` title). ✓

**VisionWarningModal focus management on open:** Double-rAF pattern correctly moves focus to the "Send anyway" button on mount. The eslint lint note (capturing `returnFocusRef.current` at effect-run time, not cleanup time) is correctly applied. ✓

**VisionWarningModal focus restoration on close:** `useEffect` cleanup captures the return target at mount time and restores focus via double-rAF on unmount. This correctly handles both Cancel and Send paths, since both paths call `setPendingVisionSend(null)` which unmounts the modal. ✓

**VisionWarningModal focus trap:** Tab and Shift+Tab toggle between the two buttons via `e.preventDefault()` + manual `focus()`. Escape fires `onCancel()`. With only two buttons, the toggle approach is correct and sufficient. ✓

**Attach button ARIA:** `aria-label="Attach images"` present. `aria-disabled="true"` (string form, not boolean) used in ghost mode — correct; `disabled` is not used, so the button remains in the tab order and screenreaders announce the disabled state. `aria-describedby` wired to the tooltip in ghost mode. ✓

**Chips list ARIA:** `role="list"` on the container, `role="listitem"` on each chip div, `aria-label="Pending attachments"` on the list. ✓

**Chip remove button ARIA:** `aria-label={`Remove ${att.filename ?? att.mimeType}`}` present on each remove button. `data-chip-remove="true"` selector used correctly for focus management. ✓

**Error paragraph ARIA:** `role="alert"` present on the attachment error paragraph (line 560). Limit-exceeded error will be announced immediately by AT. ✓

**Ghost mode tooltip ARIA:** `role="tooltip"` present; `id={ghostTooltipId}` wired to `aria-describedby` on the ghost icon div. Tooltip shows on focus and hides on blur (not just on hover). ✓

**Attach button tooltip ARIA (ghost mode):** `role="tooltip"` present; `id={attachTooltipId}` wired to `aria-describedby` on the attach button in ghost mode. Tooltip shows on focus (`onFocus` handler). ✓

**Drag-drop overlay:** `aria-hidden="true"` and `pointer-events-none` correctly exclude the visual drag overlay from AT and from intercepting drop events. ✓

**Hidden file input:** `aria-hidden="true"`, `tabIndex={-1}`, and `sr-only` class — correctly excluded from AT tree and tab order. ✓

**All icons:** `PaperclipIcon` and `SmallCloseIcon` use the shared `iconSvg()` helper which sets `aria-hidden="true"` on every SVG. All icons correctly decorative. ✓

**Delete/Backspace focus management for chips:** `handleChipKeyDown` correctly focuses the previous chip's remove button or the attach button after Delete/Backspace removal. Query runs inside `requestAnimationFrame` so the removed chip is out of the DOM before the query runs. ✓

**Keyboard submit path (attach → file picker):** The attach button is a native `<button>` element; Enter/Space activation is handled natively and correctly opens the file picker via programmatic `.click()`. The accessible keyboard path for attachment is complete. ✓

---

## Summary

| | Count |
|---|---|
| BLOCKER findings | 1 |
| ADVISORY findings | 3 |
| Clean / passing | 15 |

**BLOCKER-1** (chip remove Enter/Space loses focus) must be fixed before this wave can merge. The fix is localized to the `onClick` handler on the chip × button in `InputBar.tsx` and requires no architectural changes.

**ADVISORY-1, ADVISORY-2, ADVISORY-3** should be filed as GitHub issues and deferred to a follow-up Aria session.
