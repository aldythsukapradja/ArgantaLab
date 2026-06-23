# App Builder — Complete Design Summary
**Date**: 2026-06-23  
**Model**: Opus 4.8  
**Status**: Design locked, ready for implementation

---

## What We Designed

A **modular, scalable app builder** that turns KinetikCircle from a platform you fill forms for into a **platform you can build on**.

Currently: "Fill a form to register your app."  
→ Future: "Describe an app idea, get a working KinetikCircle app in 5 minutes."

---

## The Five Core Documents

### 1. **CONCEPT_APP_BUILDER.md**
The vision and strategy.
- Why an app builder (GameBuilder proved the "paste LLM output" pattern works)
- The three-layer design: **templates → prompt assistant → smart manifest**
- Base44/Lovable patterns translated to KinetikCircle context
- Reuse map (device frames, catalog, form, starter-prompt pattern)

**Read this for**: Understanding the product philosophy.

---

### 2. **DESIGN_APP_BUILDER_UI_UX.md**
The complete visual design and interactions.
- **Screen 1**: Catalog (template carousel + registered apps)
- **Screen 2**: Build (3-step workflow on left, device preview on right)
  - Step 1: Pick template (switch between presets)
  - Step 2: Paste HTML (copy starter prompt first)
  - Step 3: Confirm manifest (auto-filled, editable)
- Mobile-first responsive breakpoints (<640px, 640–1024px, >1024px)
- Component inventory: What's new vs. reused from GameBuilder
- Data flows and user interactions
- Mobile touch targets (44px) and spacing

**Read this for**: How the UI looks and works.

---

### 3. **SPEC_CIRCLE_APP_SDK.md**
The JavaScript API every app uses.

**Core API**:
- `CircleApp.init()` → Get user + circle context
- `CircleApp.circle` → Circle metadata (name, members, type)
- `CircleApp.db.list/save/remove/on()` → CRUD on shared data
- `CircleApp.agent('surface', params)` → Call AI (planner, coach, budgeter, etc.)
- `CircleApp.emit(event, data)` → Send events to Portfolio/Pulse
- `CircleApp.on(event, callback)` → Subscribe to SDK events

**Two versions**:
- **Mock** (dev preview): localStorage-backed, fake user, instant
- **Real** (KinetikCircle): Supabase auth, RLS, realtime, actual agents

**No code changes needed** — same app code works in both.

**Storage**:
- `app_record` table: All apps' shared data (RLS by circle)
- `hq_event` table: Events for Portfolio/Pulse aggregation
- `hq_app_template` table: (future) Operator-created templates

**Read this for**: How apps talk to the platform.

---

### 4. **STARTER_PROMPT_CIRCLE_APP_SDK.md**
The LLM prompt developers copy into Claude/ChatGPT.

**Includes**:
- The Circle App SDK injected mock (minified, production-ready)
- API reference with examples
- 7 mandatory requirements (init, load, save, emit, responsive, complete, polish)
- Full working example: **Habit Tracker app** (240 lines, production-quality HTML)
- 6-question guide for developers to describe their app idea
- Template variants (Grocery, Matchday, Cooking) for reference

**Workflow**:
1. Copy master prompt
2. Paste into ChatGPT
3. Describe app (6 questions)
4. ChatGPT generates complete HTML (with SDK already baked in)
5. Paste HTML into App Builder
6. Publish

**Read this for**: How to generate apps.

---

### 5. **APP_INVENTORY_MAPPING.md**
The 9 sample apps that will prove this works.

**Tight scope** (start here):
- 🛒 **Grocery** — Shopping list + spending (2 entities, familiar form)
- 📅 **Matchday** — Padel match scheduling + roster (2 entities, social)
- 🍳 **Cooking** — Meal plan + recipe sync (2 entities, practical)
- 💬 **Chatbot** — Family AI Q&A (3 entities, novel)
- ✅ **Daily Habits** — Habit + streak tracking (3 entities, gamified)
- 📸 **Family Album** — Photo timeline + memories (3 entities, visual)

**Medium scope** (focused but bigger):
- 🎯 **Life Coaching** — Goals + progress journal (4 entities, reflective)
- ✈️ **Travel Prep** — Trip planning + packing + budget (4 entities, complex)
- 💰 **Family Budget** — Household income/expenses + allowance (4 entities, financial)

For each: **audience**, **circle types**, **Supabase entities**, **emitted events**, **real-world analogs**.

**Read this for**: Validating scope and understanding KinetikCircle fit.

---

### 6. **ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md**
The blueprint for long-term scalability.

**Core insight**: Two decoupled layers.
- **Layer 1: Circle App SDK** (the engine — all apps share it)
- **Layer 2: App Templates** (the variety — just data)

**Scalability paths**:
- Add 10th app template → Copy template definition, done (3 min)
- Swap backends → Update one function, done (1 SQL migration)
- Add agent surface → Use in app, auto-inferred, done (no UI changes)
- Let operators create templates → Add Supabase table + UI (future)

**Implementation roadmap**:
1. Refactor AppBuilder.tsx
2. Implement parseSDK.ts (inference logic)
3. Create appSDK.ts (Circle App SDK mock)
4. Create appTemplates.ts (template definitions)
5. Build components (TemplateCarousel, InferencePanel, ManifestForm)
6. Wire device preview + SDK injection
7. Test with real app

**Read this for**: How to keep it maintainable and scalable.

---

## The Complete Flow (from concept to deployed app)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. OPERATOR VISITS APP BUILDER                                         │
├────────────────────────────────────────────────────────────────────────┤
│  Catalog screen:                                                       │
│  [📅 Plan Studio] [🛒 Grocery] [✅ Habits] [🖼️ Album] ...             │
│  [Registered apps: Grocery v1, Habits v1, ...]                        │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 2. OPERATOR PICKS A TEMPLATE                                           │
├────────────────────────────────────────────────────────────────────────┤
│  Click [🛒 Grocery] → Build screen opens                              │
│  Left: Step 1 shows "Current: Grocery" + [Change]                     │
│  Right: Device preview loads (shows empty Grocery app mockup)         │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 3. OPERATOR GETS STARTER PROMPT                                        │
├────────────────────────────────────────────────────────────────────────┤
│  Left: Step 2, click [Copy Starter Prompt]                            │
│  → Clipboard: Master prompt + Grocery-specific hints                  │
│                                                                        │
│  Operator pastes into Claude/ChatGPT with:                            │
│  "Build me a grocery app with categories, cost tracking, and a        │
│   leaderboard of who bought what"                                    │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 4. LLM GENERATES COMPLETE APP (HTML with SDK baked in)                 │
├────────────────────────────────────────────────────────────────────────┤
│  <html>                                                                │
│  <script>                                                              │
│  // Circle App SDK (mock)                                             │
│  (function() { ... })();                                              │
│  </script>                                                             │
│  <script>                                                              │
│  // Grocery app                                                        │
│  async function init() {                                              │
│    const user = await CircleApp.init();                               │
│    const items = await CircleApp.db.list();                           │
│    CircleApp.emit('app_loaded', { items_count: items.length });       │
│    // render grocery list...                                          │
│    CircleApp.db.on('create', (item) => { ... render ... });           │
│    CircleApp.db.on('update', (item) => { ... render ... });           │
│  }                                                                     │
│  </script>                                                             │
│  </html>                                                               │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 5. OPERATOR PASTES HTML INTO STEP 2                                    │
├────────────────────────────────────────────────────────────────────────┤
│  Left: Paste into textarea → [Preview updates]                        │
│  Right: Device preview now shows the ACTUAL app (with mock SDK)       │
│         User can click "Add item", type "milk", see it appear        │
│         Real interactions, real Circle App SDK (mocked)               │
│                                                                        │
│  SDK inference runs:                                                  │
│  - Scans HTML for CircleApp.emit() calls                              │
│    → Finds: item_added, item_bought, cost_logged                      │
│  - Scans for CircleApp.agent() calls                                   │
│    → Finds: budgeter                                                   │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 6. OPERATOR CONFIRMS MANIFEST IN STEP 3                                │
├────────────────────────────────────────────────────────────────────────┤
│  Left: Auto-filled form:                                              │
│  - Name: Grocery (hand-entered or pre-filled from template)           │
│  - Category: grocery (editable)                                       │
│  - Product: KinetikCircle (or ArgantaLab)                             │
│  - Status: planned / beta / live (defaults to planned)                │
│  - Audience: [kids 🔍] [parents 🔍] (inferred from template)          │
│  - Circle types: [family 🔍] (inferred)                               │
│  - Metrics: [item_added, item_bought, cost_logged] 🔍 (INFERRED!)    │
│  - Agents: [budgeter] 🔍 (INFERRED!)                                  │
│                                                                        │
│  [🔍 INFERRED badge means: automatically detected from code]          │
│                                                                        │
│  Operator can tweak anything. Most fields auto-filled so no typing.   │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 7. OPERATOR PUBLISHES                                                  │
├────────────────────────────────────────────────────────────────────────┤
│  Click [Publish] → saves to Supabase:                                 │
│                                                                        │
│  hq_app row:                                                           │
│  {                                                                     │
│    id: 'grocery',                                                      │
│    name: 'Grocery',                                                    │
│    product: 'kinetik',                                                │
│    category: 'grocery',                                               │
│    status: 'planned',                                                 │
│    audience: ['kids', 'parents'],                                     │
│    circle_types: ['family'],                                          │
│    metrics: ['item_added', 'item_bought', 'cost_logged'],             │
│    agent_surfaces: ['budgeter'],                                      │
│    template_id: 'grocery',                                            │
│    created_at: now()                                                  │
│  }                                                                     │
│                                                                        │
│  hq_app_html row:                                                      │
│  {                                                                     │
│    app_id: 'grocery',                                                 │
│    html: '<html>...'  // The full HTML from Claude                   │
│  }                                                                     │
└────────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 8. SUCCESS SCREEN                                                      │
├────────────────────────────────────────────────────────────────────────┤
│  ✓ Grocery is live in KinetikCircle                                   │
│                                                                        │
│  [Open in KinetikCircle ↗] [Return to Catalog]                        │
│                                                                        │
│  Portfolio auto-syncs:                                                │
│  → "Grocery app registered (0 events today)"                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions (Why)

| Decision | Why | Trade-off |
|---|---|---|
| **Circle App SDK spine** | One SDK for all 100 future apps, not 100 SDKs | More upfront complexity, faster long-term |
| **Auto-inferred manifest** | Reduces operator friction; metrics/agents are *detected*, not typed | Inference needs to be 90%+ accurate |
| **Hardcoded templates initially** | Fast MVP, easy to iterate | Manual to add template; Supabase-backed later |
| **Shared app_record table** | One entity model for all apps (Grocery items, Habits, photos are all "records") | Less control per-app; stronger RLS needed |
| **HTML-only apps** | Simplest distribution, no build step | Can't use frameworks; more string manipulation in LLM |
| **Mock SDK for preview** | Dev works offline, same code → prod | Mock ≠ perfect (no realtime, no real agents) |
| **Device frames from GameBuilder** | Reuse, faster | Must keep app sizes small |

---

## What Comes Next (When Implementation Starts)

1. **Refactor AppBuilder.tsx** — Split into steps, add template carousel
2. **Implement parseSDK.ts** — Parse CircleApp calls from HTML
3. **Create appSDK.ts** — Mock SDK (localStorage-backed)
4. **Create appTemplates.ts** — 9 template definitions
5. **Build components** — TemplateCarousel, InferencePanel, ManifestForm, BuildSteps
6. **Test with Grocery** — Build a real app using the SDK, test end-to-end
7. **Polish mobile** — Verify on iPhone 9:19.5 frame
8. **Document** — SDK usage examples, troubleshooting guide

---

## Success Criteria (Post-Implementation)

- ✅ Operator creates a new app in < 5 minutes (template → paste → publish)
- ✅ Manifest auto-filled with 90%+ accuracy (metrics, agents, audience)
- ✅ All 9 sample apps build without ANY SDK changes
- ✅ App works identically in dev preview and live KinetikCircle
- ✅ Mobile preview looks polished (device frames scale correctly)
- ✅ Inference parser catches 100% of CircleApp.emit() and .agent() calls
- ✅ No hard-coded UI for specific app types (everything is generic + template-driven)
- ✅ Portfolio auto-populates when apps emit events

---

## Files You Have

All committed to branch `claude/circlehq-tab-app-overview-q46g6r`:

1. `CONCEPT_APP_BUILDER.md` — Vision & strategy
2. `DESIGN_APP_BUILDER_UI_UX.md` — Visual design + flows
3. `SPEC_CIRCLE_APP_SDK.md` — API specification
4. `STARTER_PROMPT_CIRCLE_APP_SDK.md` — LLM prompt template
5. `APP_INVENTORY_MAPPING.md` — 9 apps + scope analysis
6. `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md` — Scalability blueprint
7. `BUILD_PLAN_MOBILE_VISUALS.md` — Mobile-first responsive plan (from earlier)
8. **README_APP_BUILDER_DESIGN.md** (this file) — Everything tied together

---

## How to Use These Documents

**For Product/Design Review**:
1. Read `CONCEPT_APP_BUILDER.md` (15 min) — Understand the vision
2. Read `DESIGN_APP_BUILDER_UI_UX.md` (20 min) — See the screens
3. Skim `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md` (10 min) — Understand scalability
4. Read `APP_INVENTORY_MAPPING.md` (15 min) — See what works with 9 real apps

**For Implementation**:
1. Start with `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md` (implementation roadmap)
2. Use `DESIGN_APP_BUILDER_UI_UX.md` as the visual spec
3. Use `SPEC_CIRCLE_APP_SDK.md` as the API contract
4. Use `STARTER_PROMPT_CIRCLE_APP_SDK.md` as the prompt template (copy into live.ts)
5. Use `APP_INVENTORY_MAPPING.md` for testing — build Grocery or Habits first

**For LLM Training** (future):
- Feed `SPEC_CIRCLE_APP_SDK.md` + `STARTER_PROMPT_CIRCLE_APP_SDK.md` as system context
- Users describe app ideas in plain English
- LLM generates KinetikCircle apps automatically

---

## Design Review Checklist

Before implementation starts, verify:

- [ ] UI/UX flows make sense (templates → paste → manifest → publish)
- [ ] Circle App SDK API is complete (init, circle, db, agent, emit, on)
- [ ] 9 apps are the right scope (mix of tight + medium)
- [ ] Inference logic will work (emit() & agent() parser sufficient?)
- [ ] Mobile design passes (44px targets, single column)
- [ ] Reuse from GameBuilder is correct (device frames, textarea, validation)
- [ ] Scalability paths are clear (template addition doesn't require code changes)
- [ ] No blockers for MVP (hardcoded templates, mock SDK, single app_record table)

---

## That's It

**Design is complete.** All decisions are locked. Ready to implement whenever you are.

**Key insight**: This isn't just an app builder — it's a **platform for building platforms**. Every new template, every new agent surface, every new metric just works because the spine is separate from the variety.

No more "add a feature to AppBuilder" — it's all "add a template definition" or "teach the LLM a new pattern."

**Mobile-first, modular, scalable, and beautiful.**

Ready? Let's build.
