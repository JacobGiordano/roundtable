# Roundtable — GitHub Issues

Copy each issue below into GitHub. Suggested labels are noted in brackets.
Create these labels first: `phase-1`, `phase-2`, `phase-3`, `phase-4`, `aria`, `atlas`, `vault`, `gate`, `architecture`, `dx`, `bug`, `enhancement`

---

## Architecture (Pre-Phase 1)

---

**Issue: Define core interface contracts**
Labels: `architecture`
Milestone: Pre-Phase 1

Define and document the four interface contracts that all agents will code to. No implementation — interfaces only.

- [ ] `ModelProvider` interface (Atlas)
- [ ] `StorageProvider` interface (Vault)
- [ ] `ConversationStore` type (consumed by Aria)
- [ ] `sendMessage()` signature (Atlas exposes, Aria calls)
- [ ] `getCredentials()` / `saveCredentials()` (Gate)

These must be signed off before any Phase 1 work begins. All agents build to these contracts.

---

**Issue: Project scaffold and directory structure**
Labels: `architecture`, `dx`
Milestone: Pre-Phase 1

Set up the base project so all four agents can work in parallel without conflicts.

- [ ] Create React + TypeScript project (Vite recommended)
- [ ] Set up Tailwind CSS
- [ ] Create `/src/ui`, `/src/models`, `/src/storage`, `/src/auth` directories
- [ ] Add placeholder index files in each directory
- [ ] Configure ESLint + Prettier
- [ ] Set up GitHub Actions for CI (lint + build check)
- [ ] Add `.env.example` with required API key variables

---

## Phase 1 — MVP

---

**Issue: [Aria] Chat interface layout**
Labels: `phase-1`, `aria`
Milestone: Phase 1 — MVP

Build the core chat UI shell.

- [ ] Full-height chat layout with input fixed at bottom
- [ ] Message bubble component (supports user + model messages)
- [ ] Color-coded model identity per bubble (name + color)
- [ ] Scrollable message thread
- [ ] Empty state (no conversations yet)
- [ ] Input field with send button and keyboard submit (Enter)

---

**Issue: [Aria] Model selector panel**
Labels: `phase-1`, `aria`
Milestone: Phase 1 — MVP

UI for choosing which models are active in a conversation.

- [ ] Model list panel (sidebar or top bar)
- [ ] Toggle models on/off per conversation
- [ ] Visual indicator for active/inactive models
- [ ] Works without breaking existing message thread

---

**Issue: [Atlas] Claude integration**
Labels: `phase-1`, `atlas`
Milestone: Phase 1 — MVP

Implement the Anthropic API ModelProvider.

- [ ] `ClaudeModelProvider` implementing `ModelProvider` interface
- [ ] Streaming response support
- [ ] Error handling (auth failure, rate limit, network)
- [ ] Respects `getCredentials()` from Gate for API key
- [ ] Returns structured message for Aria to render

---

**Issue: [Atlas] GPT-5.5 integration**
Labels: `phase-1`, `atlas`
Milestone: Phase 1 — MVP

Implement the OpenAI API ModelProvider.

- [ ] `GPT55ModelProvider` implementing `ModelProvider` interface
- [ ] Streaming response support
- [ ] Error handling (auth failure, rate limit, network)
- [ ] Respects `getCredentials()` from Gate for API key
- [ ] Returns structured message for Aria to render

---

**Issue: [Atlas] Parallel broadcast**
Labels: `phase-1`, `atlas`
Milestone: Phase 1 — MVP

When user sends a message, all active models receive it simultaneously.

- [ ] Fire requests to all active ModelProviders in parallel
- [ ] Responses stream in independently (not blocked by each other)
- [ ] Each response attributed to its model in ConversationStore
- [ ] Graceful handling if one model fails (others continue)

---

**Issue: [Vault] LocalStorage provider**
Labels: `phase-1`, `vault`
Milestone: Phase 1 — MVP

Implement the default client-side storage.

- [ ] `LocalStorageProvider` implementing `StorageProvider` interface
- [ ] Save and load full conversation history
- [ ] Survives browser refresh
- [ ] Handles storage quota errors gracefully

---

**Issue: [Vault] Ghost mode**
Labels: `phase-1`, `vault`
Milestone: Phase 1 — MVP

Ephemeral conversations that leave no trace.

- [ ] Ghost mode toggle per conversation
- [ ] In ghost mode, nothing written to storage at any point
- [ ] Closing tab or navigating away clears ghost conversation completely
- [ ] Visual indicator that ghost mode is active

---

**Issue: [Gate] API key management**
Labels: `phase-1`, `gate`
Milestone: Phase 1 — MVP

Secure local storage and retrieval of API keys.

- [ ] Settings UI for entering API keys (Anthropic, OpenAI)
- [ ] Keys stored in localStorage (never transmitted)
- [ ] `getCredentials()` and `saveCredentials()` implemented
- [ ] Keys masked in UI after entry
- [ ] Clear/reset option per key
- [ ] Warning if a required key is missing when model is activated

---

## Phase 2 — Conversation Intelligence

---

**Issue: [Aria] Directed reply UI**
Labels: `phase-2`, `aria`
Milestone: Phase 2 — Conversation Intelligence

Allow users to target a specific model or ask one model to respond to another.

- [ ] "Reply to [Model]" affordance on each message bubble
- [ ] "Ask [Model A] to respond to [Model B]'s message" UI pattern
- [ ] Clear visual indication of who a message is directed to
- [ ] Works within existing thread layout

---

**Issue: [Aria] Interaction mode switcher**
Labels: `phase-2`, `aria`
Milestone: Phase 2 — Conversation Intelligence

UI control for switching between the three interaction modes.

- [ ] Switcher component (Parallel / Manual / Auto-chain)
- [ ] Persisted per conversation
- [ ] Tooltip explaining each mode
- [ ] Mode change does not break existing thread

---

**Issue: [Aria] Per-model system prompt UI**
Labels: `phase-2`, `aria`
Milestone: Phase 2 — Conversation Intelligence

Let users give each model a custom system prompt.

- [ ] Expandable per-model settings panel
- [ ] System prompt text field per model
- [ ] Persisted per conversation via Vault
- [ ] Clear/reset option

---

**Issue: [Atlas] Directed reply routing**
Labels: `phase-2`, `atlas`
Milestone: Phase 2 — Conversation Intelligence

Logic for routing messages to specific models or chaining model responses.

- [ ] `sendMessage()` accepts optional `targetModel` param
- [ ] Auto-chain mode: Model B receives Model A's response as context
- [ ] Manual mode: no automatic routing, user controls flow
- [ ] Per-model system prompts passed with each request

---

**Issue: [Atlas] Token usage tracking**
Labels: `phase-2`, `atlas`
Milestone: Phase 2 — Conversation Intelligence

Track and surface token usage per model per session.

- [ ] Parse token counts from each API response
- [ ] Store in ConversationStore per message
- [ ] Expose via interface for Aria to display
- [ ] Running session total per model

---

**Issue: [Aria] Token usage display**
Labels: `phase-2`, `aria`
Milestone: Phase 2 — Conversation Intelligence

Surface token counts without cluttering the UI.

- [ ] Per-message token count (tucked away, not prominent)
- [ ] Session total per model (in model panel or settings)
- [ ] Progressively disclosed — hidden by default, available on demand

---

## Phase 3 — Sessions + History

---

**Issue: [Aria] Session browser**
Labels: `phase-3`, `aria`
Milestone: Phase 3 — Sessions + History

UI for viewing and managing past conversations.

- [ ] Sidebar or drawer listing all saved conversations
- [ ] Conversation title (auto-generated from first message)
- [ ] Date/time stamp
- [ ] Click to open/resume
- [ ] Group conversations (folders or tags)

---

**Issue: [Aria] Archive, delete, group UI**
Labels: `phase-3`, `aria`
Milestone: Phase 3 — Sessions + History

Management actions for conversations.

- [ ] Archive conversation (removes from main list, keeps in archive)
- [ ] Delete conversation (with confirmation)
- [ ] Create and assign groups/folders
- [ ] Bulk actions (select multiple, archive/delete)

---

**Issue: [Aria] Export UI**
Labels: `phase-3`, `aria`
Milestone: Phase 3 — Sessions + History

One-click export of any conversation.

- [ ] Export button on conversation view
- [ ] Choose format: markdown or HTML
- [ ] HTML export is self-contained and shareable without a server

---

**Issue: [Vault] Full session management**
Labels: `phase-3`, `vault`
Milestone: Phase 3 — Sessions + History

Complete session persistence and organization in storage layer.

- [ ] Save/load full conversation with all messages and metadata
- [ ] Archive flag per conversation
- [ ] Group/folder assignment per conversation
- [ ] Delete with full cleanup
- [ ] Auto-generate conversation title from first message

---

**Issue: [Vault] Markdown + HTML export**
Labels: `phase-3`, `vault`
Milestone: Phase 3 — Sessions + History

Export implementation in the storage layer.

- [ ] `exportConversation(id, format)` method on StorageProvider
- [ ] Markdown: clean, readable, model names as headers
- [ ] HTML: self-contained, styled, shareable file (no external dependencies)
- [ ] Triggers browser download

---

**Issue: [Vault] Finalize StorageProvider abstraction**
Labels: `phase-3`, `vault`, `architecture`
Milestone: Phase 3 — Sessions + History

Ensure the StorageProvider interface is clean, complete, and ready for ServerStorageProvider in Phase 4.

- [ ] Audit all storage calls — none should bypass the interface
- [ ] Interface covers all operations needed by Phase 4 backend
- [ ] Full unit tests for LocalStorageProvider
- [ ] Document interface contract in code comments

---

## Phase 4 — Expansion

---

**Issue: [Atlas] Add all supported models**
Labels: `phase-4`, `atlas`
Milestone: Phase 4 — Expansion

Implement ModelProvider for every supported model at launch.

- [ ] Gemini (Google)
- [ ] Grok (xAI)
- [ ] Any additional models available at time of Phase 4
- [ ] Each follows `ModelProvider` interface exactly
- [ ] Model registry: central list of available providers

---

**Issue: [Vault] ServerStorageProvider**
Labels: `phase-4`, `vault`
Milestone: Phase 4 — Expansion

Self-hosted backend storage implementation.

- [ ] `ServerStorageProvider` implementing `StorageProvider` interface
- [ ] REST API client pointing to self-hosted backend
- [ ] Swap between Local and Server provider via settings
- [ ] Data migration path: local → server

---

**Issue: [Gate] Backend auth support**
Labels: `phase-4`, `gate`
Milestone: Phase 4 — Expansion

Auth support for self-hosted backend instances.

- [ ] User session token management
- [ ] Login/logout flow (self-hosted only)
- [ ] Token refresh
- [ ] Graceful fallback to local mode if backend unavailable

---

**Issue: Self-hosted backend service**
Labels: `phase-4`, `architecture`
Milestone: Phase 4 — Expansion

The optional backend for users who want sync, accounts, and shareable links.

- [ ] Node/Express (or equivalent) REST API
- [ ] Endpoints matching `StorageProvider` interface operations
- [ ] PostgreSQL or SQLite storage
- [ ] Docker Compose file for one-command self-hosting
- [ ] README for self-hosting setup

---

**Issue: Open source launch prep**
Labels: `phase-4`, `dx`
Milestone: Phase 4 — Expansion

Everything needed to ship as a proper open source project.

- [ ] README with product overview, screenshots, quick start
- [ ] CONTRIBUTING.md with agent boundary rules explained
- [ ] LICENSE file (MIT recommended)
- [ ] Issue and PR templates
- [ ] Code of conduct
- [ ] Agency Agents setup instructions for contributors

---

## Post-Launch Polish

---

**Issue #69: [Aria] Logo rendering does not match brand spec**
Labels: `aria`, `bug`

The `RoundtableLogo.tsx` uses a mask/void approach that differs from Marque's specification. A CSS mask punches the hexagon and center dot out as transparent holes through the filled circle, then draws the hexagon border stroke and center dot in `currentColor` on top. The result: hexagon interior shows the page background through the circle (not a white stroke on an Indigo fill), and all mark elements share one color when the spec requires two.

**Marque spec** (`/_design/brand/logo/symbol.svg`, `/_design/brand/identity.md`):
- Outer circle: solid Indigo fill (`#2D2B55`), always — use `--brand-primary` CSS var
- Hexagon: `stroke: white`, `fill: none`, `stroke-width: 2`, `stroke-linejoin: round`
- Center dot: `fill: white`
- Wordmark: controlled by `--brand-logo-color` (Indigo on light themes, Mist on dark)

**Fix:**
- [ ] Remove the `<defs><mask>` block entirely
- [ ] Circle: `fill="var(--brand-primary)"` (no mask needed)
- [ ] Hexagon polygon: same points, `stroke="white"` `fill="none"`
- [ ] Center dot: `fill="white"`
- [ ] Move `color: var(--brand-logo-color)` to the wordmark SVG only (symbol no longer uses `currentColor`)
- [ ] `npm run lint && npm run build` must pass
- [ ] Update `HANDOFF.md` before final commit

---

**Issue #70: [Gate] Sidebar minimum width too narrow — token count option wraps**
Labels: `gate`, `bug`

`SIDEBAR_WIDTH_MIN` in `/src/auth/sidebarWidth.ts` is 180px. At that width the `TokenCountControl` segmented button group ("Always" | "On tap" | "Never") clips and "On tap" wraps to two lines.

**Fix:**
- [ ] Change `SIDEBAR_WIDTH_MIN` from `180` to `278` in `/src/auth/sidebarWidth.ts`
- [ ] `npm run lint && npm run build` must pass
- [ ] Update `HANDOFF.md` before final commit

---

**Issue #71: [Aria] No mobile layout — app is unusable on small screens**
Labels: `aria`, `bug`, `enhancement`

The app has no responsive design beyond the logo wordmark hiding below 640px. The sidebar renders unconditionally at a fixed pixel width (~280px), leaving ~95px for the chat area on a 375px phone. Every interactive element is desktop-only.

**Required changes:**

_AppLayout.tsx_
- Add `isMobileMenuOpen: boolean` state (default false)
- On mobile (`< md`, 768px), render a thin top header bar containing: hamburger button (left, opens sidebar drawer), Roundtable logo (center-left), new-conversation button (right)
- Render a semi-transparent backdrop (`fixed inset-0 z-40 bg-black/40`) behind the sidebar when `isMobileMenuOpen && mobile`; tapping backdrop closes the drawer
- Pass `isMobileMenuOpen` and `onCloseMobileMenu` down to `Sidebar`

_Sidebar.tsx_
- On desktop: behavior unchanged (fixed inline-width `<aside>`)
- On mobile: `fixed inset-y-0 left-0 z-50 w-72 h-full`; translate-x-full when closed, translate-x-0 when open; `transition-transform duration-200`
- The close affordance: tapping the backdrop (in AppLayout) handles this; no need for an X button inside the sidebar
- The drag-resize handle must be disabled (hidden) on mobile

_InputBar.tsx_
- Add `pb-safe` / `env(safe-area-inset-bottom)` padding so the input isn't obscured by iOS home indicator
- Ensure tap target height ≥ 44px on the send button

_ModelSelectorPanel.tsx_
- The trigger pill row and slide-up panel must be horizontally scrollable on narrow screens; no overflow clipping

_General_
- All interactive elements must meet 44×44px minimum touch target (WCAG 2.5.5)
- Test at 375px (iPhone SE) and 390px (iPhone 14) viewport widths
- `npm run lint && npm run build` must pass
- Update `HANDOFF.md` before final commit
