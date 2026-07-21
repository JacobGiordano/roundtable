# Settings Panels — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21
**Components covered:** `BackendServerPanel`, `TransferSetupPanel`

These two components are rendered as sections within `ProviderSettingsPanel`. See `provider-settings.md` for the outer panel shell (dimensions, slide-in animation, close behavior, focus trap). This document specs the two section components that are outside the scope of `provider-settings.md`.

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Shared Section Conventions

Both panels are sections within `ProviderSettingsPanel`. They share these conventions:

### Section heading

- **Typography**: `11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em` (`tracking-wide`), `{text.muted}`
- **Margin-bottom**: `8px` (`mb-2`)

### Field label

- **Typography**: `11px`, `font-weight: 500`, `{text.secondary}`
- **Margin-bottom**: `4px` (`mb-1`)
- **Display**: `block` — label above its field, never inline

### Text input (base spec)

- **Height**: `36px` (`h-9`)
- **Horizontal padding**: `12px` (`px-3`)
- **Width**: full width
- **Border-radius**: `{radius.md}` (8px)
- **Font size**: `13px`
- **Text color**: `{text.primary}`; placeholder: `{text.muted}`
- **Background**: `{surfaces.input}`
- **Border**: `1px solid {borders.default}` default; `{borders.strong}` on focus
- **Error border**: `1px solid {semantic.error}` when field has a validation error
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset` (`focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1`)
- **Transition**: `border-color` at `fast` (100ms)

### Inline error message

- **Placement**: directly below the field it describes. `margin-top: 4px` (`mt-1`)
- **Typography**: `11px`, `{semantic.error}`
- **Role**: `role="alert"` so screen readers announce it without focus moving
- When the field has a `role="alert"` error, the field also carries `aria-invalid="true"` and `aria-describedby` pointing to the error element's `id`

### Action button (default/secondary style)

Used for Cancel, Disconnect, and similar non-primary actions:
- **Height**: varies by context (see per-component specs)
- **Padding**: `12px` horizontal (`px-3`)
- **Border-radius**: `{radius.md}`
- **Background**: transparent
- **Border**: `1px solid {borders.default}`
- **Text**: `{text.secondary}`
- **Hover**: background `{interactive.hover}`, border `{borders.strong}`
- **Transition**: `background-color`, `border-color`, `color` at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`

### Action button (primary style — Claude amber)

Used for Connect, Confirm download:
- **Background**: `{accents.model-claude}` (amber)
- **Text**: `{text.inverse}` (white)
- **Hover**: `filter: brightness(1.1)`
- **Disabled/loading**: `opacity: 0.5`, `cursor: not-allowed`
- **Transition**: all at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`

---

## 2. BackendServerPanel

Allows the user to connect to a self-hosted Roundtable backend server via username/password authentication.

### 2.1 Section Heading

**Content**: "Backend Server"

### 2.2 Connection Status Badge

A pill-shaped badge that communicates connection state. Position: top of the section, inline with any adjacent controls.

**Connected badge**
- **Content**: "Connected"
- **Typography**: `11px`, `font-weight: 500`, `{semantic.success}` text
- **Background**: `{semantic.success}` at `10%` opacity (`bg-success/10`)
- **Border-radius**: `{radius.full}` (pill)
- **Padding**: `2px 8px` (`px-2 py-0.5`)
- **Display**: `inline` (not `block`) — sits within a flex row

**Not connected badge**
- **Content**: "Not connected"
- **Typography**: `11px`, `font-weight: 500`, `{text.muted}`
- **Background**: `{interactive.hover}`
- **Border-radius**: `{radius.full}`
- **Padding**: `2px 8px`

### 2.3 Connected State Layout

When the user is connected (`isBackendConfigured()` returns true):

- A flex row containing the "Connected" status badge (left) and a "Disconnect" button (right), `gap: 8px`, `justify-content: space-between`
- Below that row: the stored server URL in truncated text (`max-width: 100%`, `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap`). Shown only when `serverUrl` is non-empty. The full URL is available via the element's `title` attribute (for mouse hover native tooltip).

**Stored URL typography**: `11px`, `{text.muted}`

**Disconnect button**
- **Height**: `28px` (`h-7`)
- **Padding**: `0 12px` (`px-3`)
- **Border-radius**: `{radius.md}`
- **Font size**: `12px`, `font-weight: 500`
- **Text color**: `{semantic.error}` — signals this is a destructive action (ends the session)
- **Background**: transparent
- **Border**: `1px solid {borders.default}`
- **Hover**: border `{semantic.error}` at 50% opacity, background `{semantic.error}` at 5% opacity
- **Transition**: `border-color`, `background-color` at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **`aria-label`**: "Disconnect from backend server"
- **Action**: calls Gate's `logout()`, clears all form fields and local state, fires `onConnectionChange()`

No confirmation step for Disconnect. The action is reversible (user can log in again).

### 2.4 Disconnected State Layout

When not connected, show:

1. "Not connected" status badge (full-width block, not in a row with a button)
2. Server URL input
3. Username input
4. Password input (with show/hide toggle)
5. Inline auth error (conditional — only when `loginState === 'error'`)
6. Connect button

All fields are in a vertical flex column with `gap: 12px` (`gap-3`).

`Enter` key in any field submits the login form (same behavior as clicking "Connect"), unless the login is in-progress.

#### Server URL input

- **Label**: "Server URL"
- **Type**: `url`
- **Placeholder**: "https://my-server.example.com"
- **`autocomplete`**: `"url"`
- **Persistence**: URL is saved to Gate storage (`saveServerUrl()`) on `blur` — only if the URL passes format validation (`/^https?:\/\/.+/`). Blank or invalid URLs are not saved.
- **Validation error**: shown below the field. Message: "Server URL is required." (empty) or "Enter a valid URL (e.g. https://my-server.example.com)" (format invalid).
- **Error border**: active when `urlError` is non-empty

#### Username input

- **Label**: "Username"
- **Type**: `text`
- **Placeholder**: "Username"
- **`autocomplete`**: `"username"`
- **Validation error**: "Username is required." — shown below field, `id="backend-username-error"`, referenced by `aria-describedby` on the input, `aria-invalid="true"` when active
- **Focus on validation failure**: when username is missing, focus moves to the username input via `requestAnimationFrame` after validation runs

#### Password input

- **Label**: "Password"
- **Type**: `password` / `text` (toggled by show/hide)
- **Placeholder**: "Password"
- **`autocomplete`**: `"current-password"`
- **Validation error**: "Password is required." — shown below field, `id="backend-password-error"`, same `aria-describedby` / `aria-invalid` pattern
- **Focus on validation failure**: focus moves to password input if username is valid but password is empty
- **Padding-right**: `36px` — reserves space for the show/hide toggle button inside the input

**Show/hide toggle button** (inside the password input, right-aligned):
- **Position**: absolute, `right: 8px`, `top: 50%`, `transform: translateY(-50%)`
- **Icon**: `EyeIcon` (16px, show state) / `EyeOffIcon` (16px, hide state)
- **`aria-label`**: "Show password" / "Hide password"
- **`tabIndex={-1}`** — not in the tab order. The show/hide function is a convenience; keyboard users can still read their password in the input.
- **Color**: `{text.muted}` default, `{text.secondary}` hover
- **Background**: none, no border
- **Transition**: `color` at `fast` (100ms)

#### Inline auth error

Shown when `loginState === 'error'` and `loginError` is non-empty. Displayed between the password field and the Connect button.

- **Typography**: `11px`, `{semantic.error}`
- **Role**: `role="alert"`, `aria-live="polite"` — announces to screen readers without interrupting other announcements
- **Content**: human-readable error message keyed on `BackendAuthErrorCode`:
  - `network_error`: "Could not reach the server. Check the URL and your network connection."
  - `unauthorized`: "Invalid username or password."
  - `server_error`: "The server returned an error. Try again later."
  - `invalid_response`: "The server returned an unexpected response."
  - default: "Login failed. Please try again."

#### Connect button

- **Content**: "Connect" (idle) / "Connecting…" (loading)
- **Height**: `32px` (`h-8`)
- **Padding**: `0 16px` (`px-4`)
- **Border-radius**: `{radius.md}`
- **Font size**: `12px`, `font-weight: 600`
- **Style**: primary (Claude amber) — see §1 "Action button (primary style)"
- **`align-self: flex-start`** — button does not stretch full width
- **Disabled + `aria-disabled` when loading**: button is `disabled` (HTML) and `aria-disabled="true"`. Opacity: 0.5, `cursor: not-allowed`.
- **On success**: `isConnected` → true, form fields clear, `onConnectionChange()` is called, component displays the Connected state
- **On failure**: error message appears, focus returns to the username input

### 2.5 Focus Management

- **Validation failure (username empty)**: focus → username input
- **Validation failure (username valid, password empty)**: focus → password input
- **Auth failure (network/credentials error)**: focus → username input (user needs to re-enter credentials)
- **Logout**: no focus management needed — user stays in the settings panel

---

## 3. TransferSetupPanel

Allows the user to export their entire setup (API keys, custom providers, preferences) to a JSON file, or import from a previously exported file. The section is divided into two sub-sections: Export setup and Import setup.

### 3.1 Section Heading

`TransferSetupPanel` does not render its own section heading — the heading comes from its parent section in `ProviderSettingsPanel`. This is documented here so Aria does not accidentally add a duplicate heading inside the component.

### 3.2 Screen Reader Live Region

A visually-hidden `role="status"` `aria-atomic="true"` element sits at the top of the component. It announces state transitions to screen readers:
- When `importPhase === 'success'`: announces "Setup imported successfully. Delete this file now."
- When `importPhase === 'error'`: announces "Import failed. {N} error{s}."
- When `exportPhase === 'confirm'`: announces "Security warning: this file will contain your API keys in plain text."
- All other states: empty string (no announcement)

This covers AT users who may not receive focus announcements in all contexts. Focus management handles keyboard users; the live region covers other AT users.

---

### 3.3 Export Sub-Section

**Sub-section label**: "Export setup" — `12px`, `font-weight: 500`, `{text.secondary}`, `margin-bottom: 4px`

**Description**: "Download your API keys, custom providers, and preferences as a JSON file to set up Roundtable on another device." — `12px`, `{text.muted}`, `margin-bottom: 12px`

**Export phases**: `idle` → `confirm` → (download triggers, return to `idle`)

#### Idle phase — Export button

- **Content**: "Export setup"
- **Height**: `32px` (`h-8`)
- **Padding**: `0 16px` (`px-4`)
- **Border-radius**: `{radius.md}`
- **Font size**: `12px`, `font-weight: 500`
- **Style**: secondary (transparent + border) — see §1 "Action button (default/secondary style)"
- **Ref**: `exportBtnRef` — focus returns here after confirm is dismissed
- **Action**: transitions to `confirm` phase

#### Confirm phase — Security warning card

Replaces the export button with an inline warning card. Focus moves to the Cancel button when the card appears (WCAG 2.4.3).

**Card container**
- **Border-radius**: `{radius.md}`
- **Border**: `1px solid {borders.default}`
- **Left border override**: `3px solid {semantic.warning}` — a thicker left border signals caution. This is a deliberate design decision: the 3px left accent is used here as a severity signal, not as model identity (which it serves in message bubbles). The contexts do not conflict — settings panels have no model bubble identity use.
- **Background**: `{surfaces.card}`
- **Padding**: `12px 16px` (`px-4 pt-3 pb-3`)

**Warning heading**
- **Content**: "Security warning"
- **Typography**: `12px`, `font-weight: 600`, `{text.primary}`
- **Margin-bottom**: `6px` (`mb-1.5`)

**Warning body**
- **Content**: "This file will contain your API keys in plain text. Do not share it, email it, or leave it in your Downloads folder."
- **Typography**: `12px`, `{text.secondary}`, `line-height: 1.5`
- **Margin-bottom**: `12px` (`mb-3`)

**Button row** (`gap: 8px` flex row):

*Cancel button*
- **Content**: "Cancel"
- **Height**: `28px` (`h-7`)
- **Padding**: `0 12px` (`px-3`)
- **Font size**: `12px`, `font-weight: 500`
- **Style**: secondary
- **Ref**: `cancelBtnRef` — receives focus when confirm phase opens
- **`data-confirm="true"`** — used by ProviderSettingsPanel's existing focus trap for Tab cycling
- **Action**: returns to idle phase, focus → `exportBtnRef`
- **Keyboard**: `Escape` key on the card cancels (fires `handleCancelExport`). The `stopImmediatePropagation()` call prevents the panel's document-level Escape handler from also closing the settings panel — Escape should cancel the confirm, not close the panel.

*Confirm download button*
- **Content**: "Confirm download"
- **Height**: `28px`
- **Padding**: `0 12px`
- **Font size**: `12px`, `font-weight: 500`
- **Style**: primary (Claude amber)
- **`data-confirm="true"`**
- **Action**: calls `exportSetup()` → `downloadJSON(payload, filename)`. Filename format: `roundtable-setup-{YYYY-MM-DD}.json`. Returns to idle phase, focus → `exportBtnRef`.

**Tab cycling within the card**: Tab and Shift+Tab cycle between the two `data-confirm="true"` buttons only. Focus does not escape the card while in confirm phase. The outer ProviderSettingsPanel focus trap handles Tab at the panel level, but the confirm card intercepts Tab first and keeps it within the card's two buttons.

---

### 3.4 Import Sub-Section

**Sub-section label**: "Import setup" — `12px`, `font-weight: 500`, `{text.secondary}`, `margin-bottom: 4px`

**Description**: "Restore your API keys, custom providers, and preferences from a previously exported file." — `12px`, `{text.muted}`, `margin-bottom: 12px`

**Import phases**: `idle` ← → `reading` ← → `success` | `error` → (dismiss) → `idle`

#### Import button (present in all phases)

- **Content**: "Import setup" (idle/success/error) / "Reading file…" (reading)
- **Height**: `32px`
- **Padding**: `0 16px`
- **Border-radius**: `{radius.md}`
- **Font size**: `12px`, `font-weight: 500`
- **Idle/success/error style**: secondary (transparent + border)
- **Reading style**: `{text.muted}`, `opacity: 0.5`, `cursor: not-allowed`, `border: 1px solid {borders.default}`
- **`aria-disabled="true"`** while reading (not HTML `disabled`) — keeps the button keyboard-focusable. Click is a no-op in reading state.
- **Ref**: `importBtnRef` — focus returns here when success/error notices are dismissed
- **Action**: opens the browser's native file picker (via `readJSONFile()` which creates a hidden `<input type="file">`). If the user cancels the picker, nothing happens (the picker resolves with `null`).

#### Success notice

Appears below the import button after a successful import. Displayed as an inline card.

**Card container**
- **Border-radius**: `{radius.md}`
- **Border**: `1px solid {borders.default}`, left override: `3px solid {semantic.success}`
- **Background**: `{surfaces.card}`
- **Padding**: `12px 16px`
- **Margin-top**: `12px` (`mt-3`)

**Success heading**
- **Content**: "Setup imported."
- **Typography**: `13px`, `font-weight: 600`, `{text.primary}`
- **Margin-bottom**: `4px` (`mb-1`)
- **`tabIndex={-1}`**: receives programmatic focus when the notice appears (WCAG 2.4.3 — keyboard users are informed of success without a confusing focus jump to a destructive button)
- **`focus:outline-none`**: no visible focus ring on programmatic focus (the ring is for user-initiated focus only)

**Delete file warning** — high visibility
- **Content**: "Delete this file now."
- **Typography**: `12px`, `font-weight: 600`, `{semantic.warning}` — warning color, not error. The file is not dangerous if the user destroys it; the warning is a strong advisory.
- **Margin-bottom**: `8px` (`mb-2`)

**Export timestamp** (conditional — only when `exportedAt` is present in the file payload)
- **Content**: "Exported on {formatted date}" — e.g. "Exported on Jul 1, 2026, 12:00 PM"
- **Format**: `new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })`
- **Typography**: `11px`, `{text.muted}`
- **Margin-bottom**: `12px` (`mb-3`)

**Dismiss button**
- **Content**: "Dismiss"
- **Height**: `28px`
- **Padding**: `0 12px`
- **Font size**: `11px`, `font-weight: 500`
- **Style**: secondary
- **Action**: returns to idle phase, focus → `importBtnRef`

#### Error notice

Appears below the import button after a failed import (file read error or validation failure).

**Card container**
- **Border-radius**: `{radius.md}`
- **Border**: `1px solid {borders.default}`, left override: `3px solid {semantic.error}`
- **Background**: `{surfaces.card}`
- **Padding**: `12px 16px`
- **Margin-top**: `12px`

**Error heading**
- **Content**: "Import failed."
- **Typography**: `13px`, `font-weight: 600`, `{text.primary}`
- **Margin-bottom**: `8px` (`mb-2`)
- **`tabIndex={-1}`**: receives programmatic focus when the notice appears

**Error list**
- **Element**: `<ul role="list" aria-label="Import errors">`, `list-style: none`, `margin: 0`, `padding: 0`
- **Layout**: flex column, `gap: 6px`, `margin-bottom: 12px`
- **Each item**: `<li role="listitem">`, flex row, `align-items: flex-start`, `gap: 8px`
  - **Bullet**: `4px × 4px` (`w-1 h-1`) circle, `{semantic.error}`, `margin-top: 6px`, `flex-shrink: 0`, `aria-hidden="true"` — decorative
  - **Text**: `12px`, `{text.secondary}`

**Dismiss button**: same spec as success notice Dismiss button.

---

### 3.5 Focus Management Summary

| Transition | Focus target |
|------------|-------------|
| Export: idle → confirm | `cancelBtnRef` (safe default for the warning card) |
| Export: confirm → idle (cancel or confirm) | `exportBtnRef` |
| Import: idle/reading → success | `successHeadingRef` (programmatic, `tabIndex={-1}`) |
| Import: idle/reading → error | `errorHeadingRef` (programmatic, `tabIndex={-1}`) |
| Import: success → idle (dismiss) | `importBtnRef` |
| Import: error → idle (dismiss) | `importBtnRef` |

All programmatic focus uses `requestAnimationFrame(() => ref.current?.focus())` — deferred one frame to ensure React has committed the new DOM before focus is applied.

---

## 4. No Reduced-Motion Considerations

Neither `BackendServerPanel` nor `TransferSetupPanel` use enter/exit animations for their state transitions. Content swaps are instant. Color transitions use `fast` (100ms) and snap to `0ms` under `prefers-reduced-motion: reduce` automatically. No additional handling is needed.
