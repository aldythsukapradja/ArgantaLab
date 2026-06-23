# App Builder Architecture — Modular & Scalable
**Date**: 2026-06-23  
**Model**: Opus 4.8  
**Status**: Design locked — ready for implementation

---

## Core Insight: The Spine & The Templates

The App Builder is built on **two decoupled layers**:

```
┌─────────────────────────────────────────────────────┐
│ LAYER 1: CIRCLE APP SDK SPINE                       │
│ (the engine — all apps share this)                  │
├─────────────────────────────────────────────────────┤
│ init() · circle · db{list,save,remove,on} ·         │
│ agent() · emit() · on()                              │
│                                                     │
│ Mock version: localStorage, fake user/circle       │
│ Real version: Supabase auth, RLS, realtime         │
└─────────────────────────────────────────────────────┘
           ↓ Every app gets this injected
```

```
┌─────────────────────────────────────────────────────┐
│ LAYER 2: APP TEMPLATES (the variety)                │
├─────────────────────────────────────────────────────┤
│ Grocery { list, categories, spending }              │
│ Habits { frequency, logs, streaks }                 │
│ Matchday { date, court, attendees }                 │
│ Plan Studio { recipes, meals, ingredients }         │
│ Memory Wall { photos, dates, memories }             │
│ Chatbot { threads, topics, feedback }               │
│ Life Coaching { goals, milestones, progress }       │
│ Travel Prep { itinerary, packing, budget }          │
│ Family Budget { income, expenses, allowance }       │
│                                                     │
│ Each template = starter prompt + default manifest  │
│ + demo HTML                                         │
└─────────────────────────────────────────────────────┘
           ↓ User picks one, LLM generates the rest
```

**The magic**: A developer says "I want a Grocery app" → picks template → gets starter prompt → pastes LLM output → the SDK is already baked in → app works.

To add a 10th app (say, "Pet Care Tracker"), you only need to:
1. Add a template definition (name, emoji, prompt, manifest defaults)
2. The SDK is already there — no code changes needed

---

## How to Add a New Template (Future Scalability)

### The Template Data Structure

```typescript
interface AppTemplate {
  id: string                    // unique: 'grocery', 'habits', 'pet-care', etc.
  name: string                  // display: "Grocery", "Daily Habits", "Pet Care"
  emoji: string                 // "🛒", "✅", "🐾"
  description: string           // "Shared shopping list + spending tracker"
  category?: string             // "organization" | "family" | "tracking" | "social"
  
  // The LLM prompt seeded for this template
  prompt: string                // The Circle App Starter Prompt + template-specific hints
  
  // Default manifest values
  defaultManifest: {
    category: string            // "grocery" | "habit" | "planner"
    audience: string[]          // ["parents", "kids"] | ["educators", "students"]
    circle_types: string[]      // ["family"] | ["friends", "family"] | ["class"]
    suggested_metrics: string[] // ["item_added", "item_bought"]
    suggested_agents: string[]  // ["budgeter"] | ["reminder", "coach"]
  }
  
  // Optional: a demo/preview version
  preview_html?: string         // HTML to show in the preview during template selection
  
  // Metadata
  created_at?: string
  updated_at?: string
}
```

### Implementation Path

#### Phase 1: Hardcoded templates (NOW)
```typescript
// apps/hq/src/data/appTemplates.ts
export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'grocery',
    name: 'Grocery',
    emoji: '🛒',
    description: 'Shared shopping list + spending tracker',
    category: 'organization',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}\n\n...grocery-specific hints...`,
    defaultManifest: {
      category: 'grocery',
      audience: ['parents', 'kids'],
      circle_types: ['family'],
      suggested_metrics: ['item_added', 'item_bought'],
      suggested_agents: ['budgeter']
    }
  },
  // ... repeat for all 9 templates
  {
    id: 'pet-care',  // ← Adding a 10th template
    name: 'Pet Care Tracker',
    emoji: '🐾',
    description: 'Track pet care tasks, vet appointments, and health',
    category: 'tracking',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}\n\n...pet-care-specific hints...`,
    defaultManifest: {
      category: 'pet-care',
      audience: ['kids', 'parents'],
      circle_types: ['family'],
      suggested_metrics: ['task_logged', 'vet_appointment_scheduled'],
      suggested_agents: ['reminder', 'coach']
    }
  }
];
```

To add a new template: **copy-paste the last entry, change the fields, done.** The UI doesn't change.

#### Phase 2: Supabase-backed templates (future)
When templates become editable from HQ (operators create custom templates):

```typescript
// apps/hq/src/data/live.ts
export const live = {
  // ... existing methods ...
  
  async listAppTemplates(): Promise<AppTemplate[]> {
    const { data, error } = await supabase
      .from('hq_app_template')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) return []
    return data as AppTemplate[]
  },
  
  async saveAppTemplate(template: AppTemplate): Promise<boolean> {
    const { error } = await supabase
      .from('hq_app_template')
      .upsert({ ...template, updated_at: now() })
    return !error
  }
}
```

Then `TemplateCarousel` loads from `live.listAppTemplates()` instead of hardcoded array. **No UI change.**

#### Phase 3: Template editor (future)
Add a screen in the Operator UI to create/edit templates. Uses `saveAppTemplate()`.

---

## Data Model Diagram

```
┌─────────────────────────────────────────────────────────┐
│ SUPABASE SCHEMA                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  hq_app (app manifests)                                 │
│  ├─ id, name, product, category, status, owner        │
│  ├─ audience[], circle_types[], metrics[], agents[]   │
│  └─ template_id (which template was used)             │
│                                                         │
│  hq_app_html (app source code)                          │
│  ├─ id (= hq_app.id)                                    │
│  └─ html (the LLM-generated single file)               │
│                                                         │
│  app_record (all apps' shared data)                     │
│  ├─ id, circle_id, app_id, created_by, created_at    │
│  ├─ data (jsonb, app-specific fields)                  │
│  ├─ status, priority, category (indexed columns)       │
│  └─ RLS: circle isolation, role-aware                  │
│                                                         │
│  hq_event (portfolio/pulse events)                      │
│  ├─ circle_id, app_id, event, data, timestamp         │
│  └─ RLS: operators can read, users can write           │
│                                                         │
│  hq_app_template (future: operator-created templates) │
│  ├─ id, name, emoji, description, category            │
│  ├─ prompt, defaultManifest (jsonb)                    │
│  └─ RLS: operators only                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## The Build Workflow (from user's perspective)

```
1. Operator visits Circle HQ → Builder tab → [Games] [Apps ▼]
   
2. Click "Apps" → Catalog view
   
   ┌─────────────────────────────────────────────┐
   │ [📅 Plan Studio] [🖼️ Memory Wall] [✅ Habits]│  ← Template carousel
   │ [➕ Blank]                                    │
   │                                               │
   │ [Existing App 1] [Existing App 2]            │  ← Registered apps
   │                                               │
   └─────────────────────────────────────────────┘

3. Click template [🛒 Grocery] → Build screen
   
   LEFT PANEL                    RIGHT PANEL
   ─────────────────────         ──────────────────────
   1️⃣ PICK TEMPLATE              [Desktop] [Tablet] [iPhone]
   [Current: Grocery ▼]          ┌──────────────────────┐
                                 │  (Live preview)      │
   2️⃣ PASTE CODE                 │  App renders with    │
   [Paste HTML]                  │  mock SDK + demo     │
   [Copy Starter Prompt ▼]        │  user + circle       │
   [← Previous Prompt]            │                      │
                                 │                      │
   3️⃣ CONFIRM DETAILS            │                      │
   Name: Grocery                 │                      │
   Category: [______]            │                      │
   Audience: [kids] [parents]    │                      │
   Metrics: [item_added, ...]    │  [🔍 Inferred]       │
   Agents: [budgeter]            │  [🔍 Inferred]       │
                                 │                      │
   [Publish] [Save Draft]        └──────────────────────┘

4. ChatGPT generates HTML with Circle App SDK baked in
   
   <html>
   <script>
   // ── Circle App SDK (mock) ───
   (function() {
     // mock init, db, agent, emit, on
   })();
   
   // ── Your app's code ──
   async function init() {
     const user = await CircleApp.init();
     const records = await CircleApp.db.list();
     // ...render grocery list...
   }
   </script>
   </html>

5. Paste HTML into Step 2 → Preview updates live
   
   SDK calls are auto-inferred (emit('item_added', ...), agent('budgeter', ...))
   → Step 3 form fills: metrics = ['item_added', 'item_bought'], agents = ['budgeter']

6. Review manifest, publish → hq_app row created
   
   {
     id: 'grocery',
     name: 'Grocery',
     product: 'kinetik',
     category: 'grocery',
     status: 'live',
     audience: ['parents', 'kids'],
     circle_types: ['family'],
     metrics: ['item_added', 'item_bought'],      ← inferred
     agent_surfaces: ['budgeter'],                ← inferred
     template_id: 'grocery',
     html: '<html>...'
   }

7. Portfolio/Pulse auto-sync
   
   → "Grocery app created: 0 events so far"
   → When deployed in KinetikCircle, real data flows in

8. Done. Operator adds a 2nd app (same flow, different template or blank)
```

---

## Scalability Checklist

### Adding a 10th App Template
- ✅ Update `APP_TEMPLATES` array (3 min)
- ✅ No SDK changes
- ✅ No UI changes
- ✅ No database migrations
- ✅ Works immediately

### Swapping Backends (Hardcoded → Supabase templates)
- ✅ Add `hq_app_template` table (1 SQL migration)
- ✅ Update `live.listAppTemplates()` to query Supabase
- ✅ Update `TemplateCarousel` to load from async function
- ✅ Add operator UI for editing templates
- ✅ **Zero changes to the App Builder UI or build workflow**

### Adding a New Agent Surface (reminder → budgeter)
- ✅ Add agent name to `AGENT_SURFACES` enum (if needed)
- ✅ App uses `CircleApp.agent('budgeter', {...})`
- ✅ Edge Function routes to Claude API
- ✅ **No SDK changes, no UI changes**

### Adding Agent Surface Usage
- ✅ LLM-generated app calls `CircleApp.agent('surface', {...})`
- ✅ Inference parser sees the call
- ✅ Step 3 form auto-populates `agent_surfaces` with [🔍 Inferred] badge
- ✅ **No changes to the inference logic**

---

## File Inventory (Implementation)

```
apps/hq/src/
├── surfaces/
│   ├── AppBuilder.tsx                    (REFACTOR)
│   └── Builder.tsx                       (exists: tabs)
│
├── data/
│   ├── live.ts                           (EXTEND: app methods)
│   ├── appTemplates.ts                   (NEW: APP_TEMPLATES)
│   └── appSDK.ts                         (NEW: Circle App SDK spec + mock)
│
├── components/
│   ├── AppBuilder/                       (NEW folder)
│   │   ├── TemplateCarousel.tsx          (NEW)
│   │   ├── InferencePanel.tsx            (NEW)
│   │   ├── ManifestForm.tsx              (NEW)
│   │   ├── BuildStep1.tsx                (NEW: pick template)
│   │   ├── BuildStep2.tsx                (NEW: paste code)
│   │   ├── BuildStep3.tsx                (NEW: confirm manifest)
│   │   └── DevicePreview.tsx             (REUSE from GameBuilder)
│   └── (existing)
│
├── lib/
│   ├── parseSDK.ts                       (NEW: inference logic)
│   └── (existing)
│
└── theme.css                             (no changes)
```

---

## Design Decisions Locked

1. **One SDK, many templates** — Templates are data, not code. Scalable.
2. **Auto-inferred manifest** — Users confirm, don't type. Reduces friction.
3. **Hardcoded templates initially** — Fastest path to MVP. Supabase-backed later.
4. **Shared app_record table** — All apps use one entity. RLS scopes it by circle.
5. **Mock SDK for preview** — Dev works offline. Real SDK injected on deploy.
6. **HTML-only apps** — No build step, no framework required. Simple distribution.
7. **Event-driven portfolio** — Apps emit, Platform consumes. Decoupled.

---

## What's NOT in Scope (yet)

- 🚫 Custom app templates via UI (future: Phase 3)
- 🚫 App versioning / rollback (future: audit log)
- 🚫 A/B testing or canary deploys (future: advanced)
- 🚫 App collaboration / multi-author editing (future: Google Docs-style)
- 🚫 App marketplace (future: cross-circle sharing)
- 🚫 Real Supabase integration in dev preview (dev stays local)

---

## Success Criteria (Post-Implementation)

- ✅ Operator creates an app in < 5 minutes (template pick → paste → publish)
- ✅ New template added in < 10 minutes (copy template definition)
- ✅ App works identically in dev preview and prod KinetikCircle
- ✅ All 9 sample apps build without SDK changes
- ✅ Developer can describe app in plain English, LLM generates working code
- ✅ Manifest auto-inferred with 90%+ accuracy (metrics/agents from code)
- ✅ Mobile preview looks good on iPhone (9:19.5 AR)
- ✅ Inference parser handles 100% of app calls (no false negatives)

---

## Next: Implementation

This architecture is **locked for implementation**. The next phase:

1. **Refactor AppBuilder.tsx** — Add template carousel, build steps, inference panel
2. **Implement parseSDK.ts** — Extract emit() & agent() calls from HTML
3. **Create appSDK.ts** — Circle App SDK mock (localStorage-backed)
4. **Create appTemplates.ts** — Template definitions (hardcoded, 9 templates)
5. **Extend live.ts** — App data methods (list, save, saveHTML)
6. **Build components** — TemplateCarousel, InferencePanel, ManifestForm, BuildSteps
7. **Wire device preview** — Reuse DEVICES, inject mock SDK into iframe
8. **Test with one template** — Build & test a real app (Grocery or Habits)
9. **Iterate** — Polish UI/UX based on real usage

---

## Design Handed Off

All three specifications are locked and committed:
- `DESIGN_APP_BUILDER_UI_UX.md` — screens, flows, components
- `SPEC_CIRCLE_APP_SDK.md` — API, storage, security
- `STARTER_PROMPT_CIRCLE_APP_SDK.md` — LLM prompt for developers
- `APP_INVENTORY_MAPPING.md` — 9 sample apps, their scope
- `BUILD_PLAN_MOBILE_VISUALS.md` — responsive mobile design

**Ready to implement.**
