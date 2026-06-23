# App Builder — UI/UX Concept
**Date**: 2026-06-23
**Status**: Concept only — no build yet
**Model**: Drafted on Haiku 4.5. Visual/architecture design phase will flag a move to Opus 4.8.

---

## Decisions locked (from product owner)
- **Builder depth**: Hybrid — **templates + smart manifest + prompt assistant** (all three layered).
- **App artifact**: **Self-contained HTML**, but wired to **real Supabase data + login info** (not a mock-only file).

These two together = the proven **Game Builder loop**, upgraded for *data-backed circle apps*.

---

## 1. What an "app" is here
A **KinetikCircle mini-app for a circle** (family / kids / class / friends). Unlike a game (a self-contained HTML file with score/currency), an app is **data-backed + social + agent-augmented**:
- Serves an **audience** (kids, parents, educators…)
- Lives inside a **circle type**
- **Emits events** to `hq_event` → auto-appears in Portfolio / Pulse
- Exposes **agent surfaces** (in-app AI: planner, reminder, summarizer)

Examples: Plan Studio, Memory Wall, Family Quests, Class Board.

---

## 2. The core unlock — a **Circle App SDK** (sibling to the Circle Game SDK)
The Game SDK provides currency/score/leaderboard. The **App SDK** provides the things this concept needs while keeping the app a single HTML file:

```
CircleApp.init()           → real signed-in user { id, name, avatar, role, circle }
CircleApp.circle           → current circle { id, type, members }
CircleApp.db.list(query)   → read the app's own entity, RLS-scoped to the circle
CircleApp.db.save(record)  → write a record
CircleApp.db.remove(id)    → delete a record
CircleApp.agent(surface,p) → call an agent surface (planner, summarizer…)
CircleApp.emit(event,data) → write to hq_event → Portfolio / Pulse pick it up
CircleApp.on(event, fn)    → subscribe to realtime changes
```

**Self-contained + connected** is achieved the same way games do it:
- A **mock SDK** (localStorage-backed) runs the app standalone during dev/preview.
- The **real SDK is injected** by the platform when deployed inside KinetikCircle — real Supabase auth + a per-app data table, RLS-scoped to the circle.

This means no per-app backend; one shared, namespaced entity model serves every app.

---

## 3. The three layers as one flow

### Layer 1 — Templates (entry)
A gallery row of starter app types instead of a blank form (the Lovable/Base44 "start" feeling):

`📅 Plan Studio · 🖼️ Memory Wall · ✅ Family Quests · 📋 Class Board · ➕ Blank`

Each template pre-seeds:
- the **starter prompt** (App SDK spine + entity hints),
- the **entity shape** (fields the app reads/writes),
- a **draft manifest** (audience, circle types, suggested metrics).

### Layer 2 — Prompt assistant (build)
Reuse Game Builder's proven 3-step spine:
- **Step 1** — pick template → *Copy App Starter Prompt* (LLM-agnostic, like games).
- **Step 2** — paste LLM-generated HTML.
- **Step 3** — **live preview in the existing device frames** (Desktop 16:9 / Tablet / iPhone), now rendering a **logged-in user + real circle data** via the App SDK.

### Layer 3 — Smart manifest (confirm, don't author)
The current manifest form stays, but becomes **auto-derived** and shown for confirmation:
| Field | How it's derived |
|---|---|
| `name` / `category` | Parsed / suggested from the app + template |
| `metrics` | Inferred from `CircleApp.emit()` calls in the HTML |
| `agent_surfaces` | Inferred from `CircleApp.agent()` calls |
| `audience` / `circle_types` | Suggested from template, editable as pills |
| `status` / `owner` | Defaults (planned / current operator) |

The operator **tweaks**, never types from scratch. Publish → `hq_app` row + app goes live in KinetikCircle → Portfolio updates automatically.

---

## 4. base44 / Lovable patterns → grounded version
| Their pattern | Our grounded version |
|---|---|
| Prompt-first entry | Template → starter prompt (keeps it LLM-agnostic) |
| Chat + live preview | Paste-loop + device-frame preview with real login/data |
| Auto-wired backend | Circle App SDK = real Supabase auth + per-app entity (RLS) |
| Entities/manifest for free | Manifest auto-derived & confirmed |
| Deploy + share URL | Publish → live in KinetikCircle + open-in-new-tab |
| App gallery home | Existing app catalog + templates row |

---

## 5. Screen inventory (concept — to design next)
1. **Catalog (home)** — templates row on top, then registered apps grid (reuse current AppBuilder catalog + card).
2. **Template picker** — gallery of starter types with one-line descriptions and a preview thumbnail.
3. **Build screen** — left: 3-step workflow (template/prompt → paste → details); right: device-frame preview with live login + data. (Mirrors Game Builder's BuildView.)
4. **Smart manifest panel** — auto-filled Identity + Reach/contracts cards, editable, with "inferred" badges on auto-detected fields.
5. **Publish state** — success banner + open-in-new-tab + "appears in Portfolio" confirmation.

---

## 6. Reuse map (what already exists)
- **Device preview frames** (`DEVICES`, BuildView preview) — reuse as-is.
- **Catalog + AppCard** (AppBuilder.tsx) — reuse, add templates row above.
- **Manifest form** (BuildForm) — repurpose as the auto-filled confirm panel.
- **Starter-prompt pattern** (starterPrompt.ts) — clone into an **App Starter Prompt** with the App SDK spine.
- **live.ts** — extend with App SDK data helpers (per-app entity CRUD) alongside `saveApp`/`listApps`.

---

## 7. Open questions for the design phase
1. **Entity model**: one shared `app_record` table (app_id + circle_id + json payload, RLS by circle) vs. per-app tables? (Shared table = simplest, recommended.)
2. **Agent surfaces**: do agents run client-side via a hosted endpoint, or as Supabase edge functions the SDK calls?
3. **Template source**: hardcoded starter set first, or templates themselves stored in Supabase so they're editable from HQ?
4. **Preview auth**: preview as the current operator, or as a simulated circle member (kid/parent) to test audience views?

---

## 8. Next step (when we build)
Design the **Build screen** mock first (it's the heart), then the **App Starter Prompt** + **Circle App SDK** spec, then wire the smart-manifest derivation. Flag Opus 4.8 at the design step.
