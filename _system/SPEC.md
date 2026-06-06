# Roundtable — Master Product Spec v1.1

> A browser-based multi-model AI conversation interface. Talk with multiple AI models simultaneously, direct responses between them, and build a single shared thread. Built for collaborative problem solving, research, and creative work. Open source, self-hostable backend path.

---

## Core Principles

- **For the user:** Feels like a chat app, not a dev tool. Complexity is available but never in the way.
- **For contributors:** Clean vertical slices, clear contracts, easy to extend with new models.
- **For the codebase:** Client-side first, backend-optional, storage-abstracted from day one.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Hosting | Vercel / Netlify (static) |
| Storage (default) | localStorage / IndexedDB via abstraction layer |
| Storage (self-hosted) | Node/Express + DB via same abstraction layer |
| Backend | Optional, Dockerized, user-deployable |

---

## Agent Roster

Four named agents own the codebase in parallel-safe vertical slices. No agent touches another's directory. Cross-agent communication happens only through defined interfaces.

| Agent | Directory | Role | Interface Contract |
|-------|-----------|------|--------------------|
| **Aria** | `/src/ui` | All React components, layout, chat interface | Consumes `ConversationStore`, calls `sendMessage()` |
| **Atlas** | `/src/models` | All API integrations, streaming, model config | Exposes `ModelProvider` interface + `sendMessage()` |
| **Vault** | `/src/storage` | Storage layer, conversation history, ghost mode, export | Exposes `StorageProvider` interface + `ConversationStore` |
| **Gate** | `/src/auth` | API key management, settings, future backend auth | Exposes `getCredentials()` + `saveCredentials()` |

**Memory aid:** Aria talks to users. Atlas talks to AI models. Vault remembers everything. Gate controls access.

---

## Agency Agents Assignments (Claude Code)

Install the Engineering division from [agency-agents](https://github.com/msitarzewski/agency-agents) into Claude Code before starting.

| Agency Agent | Assigned To |
|--------------|-------------|
| Software Architect | Upfront interface contract design (all agents) |
| Frontend Developer | Aria |
| Backend Architect | Atlas |
| Senior Developer | Vault |
| Rapid Prototyper | Phase 1 sprint |
| Agents Orchestrator | Multi-agent session coordination |
| Reality Checker | Phase completion gates |

---

## Feature Set

### Conversation
- Single input broadcasts to all active models
- Chat-style layout — responses appear as named, color-coded message bubbles in a shared thread
- Directed replies — target one model, all models, or ask one to respond to another's output
- Interaction mode switchable per conversation:
  - **Parallel** — responses appear independently, no cross-pollination
  - **Manual** — you copy/paste one model's response to prompt another
  - **Auto-chain** — Model B automatically sees Model A's response

### Model Management
- Add/remove models per conversation
- Per-model system prompt customization
- Toggle models on/off mid-conversation without losing history
- All available models supported at launch

### Sessions
- **Ghost mode** — ephemeral, nothing saved
- **Standard mode** — full auto-save
- Archive, delete, and group conversations
- Export as markdown or formatted HTML snapshot (no server required)

### Settings
- API key management — stored locally by default, never transmitted
- Token usage display per model per session
- Default model configuration
- Power details (token counts, latency) — available but progressively disclosed

### UI
- Chat-like feel — familiar and approachable
- Clean by default, power-user details tucked away
- Named, color-coded model identities throughout

---

## Architecture: Storage Abstraction

The `StorageProvider` interface is the key architectural decision that enables Option C (client-side default + optional backend). The rest of the app never talks to storage directly.

```
StorageProvider (interface)
├── LocalStorageProvider    ← default, ships with app
└── ServerStorageProvider   ← self-hosted path, Phase 4
```

**Vault owns this entirely.** Aria, Atlas, and Gate consume `ConversationStore` without knowing which provider is active.

---

## Dev Phases

### Phase 1 — MVP (Weeks 1–3)
**Goal:** Usable core. Two models working, conversations persist, ghost mode available.

**Aria:** Chat interface, input field, message bubbles, model color-coding  
**Atlas:** Claude + GPT-4o integration, streaming responses  
**Vault:** LocalStorage provider, basic session save/load, ghost mode  
**Gate:** API key entry and local storage  

**Reality Check gate before Phase 2:** Two models respond in parallel, conversations persist across refresh, ghost mode leaves no trace.

---

### Phase 2 — Conversation Intelligence (Weeks 4–6)
**Goal:** Conversations feel directed and intelligent.

**Aria:** Directed reply UI, interaction mode switcher, per-model system prompt UI  
**Atlas:** Model-to-model prompting, interaction mode logic, token tracking  
**Vault:** No changes  
**Gate:** No changes  

**Reality Check gate before Phase 3:** All three interaction modes work, directed replies route correctly, token counts display.

---

### Phase 3 — Sessions + History (Weeks 7–9)
**Goal:** Conversations are persistent, organized, and portable.

**Aria:** Session browser, archive/delete/group UI, export button  
**Atlas:** No changes  
**Vault:** Full session management, archive/delete/group, markdown + HTML export, StorageProvider abstraction finalized and tested  
**Gate:** No changes  

**Reality Check gate before Phase 4:** Sessions survive browser close, export produces clean markdown and HTML, StorageProvider interface is clean and swappable.

---

### Phase 4 — Expansion (Weeks 10+)
**Goal:** More models, self-hosted backend option, open source launch.

**Aria:** Any UI updates for new models or backend settings  
**Atlas:** All remaining supported models added  
**Vault:** ServerStorageProvider implementation (self-hosted), shareable conversation snapshots  
**Gate:** Backend auth support  

**Launch checklist:** README, contributing guide, license, Docker Compose file for self-hosted option.

---

## GitHub Issues

See `roundtable-issues-detailed.md` for the full importable issues list. Each issue includes complete TypeScript type definitions, explicit acceptance criteria, error state specifications, technical constraints, and "Do Not Touch" boundary rules for each agent.

---

## Open Questions (Post-Launch Roadmap)

- Shareable conversation links (requires self-hosted backend)
- Mobile-responsive layout
- Keyboard shortcuts
- Custom model personas (beyond system prompts)
- Community model registry
