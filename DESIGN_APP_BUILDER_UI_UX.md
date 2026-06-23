# App Builder — UI/UX Design
**Date**: 2026-06-23  
**Model**: Opus 4.8 (design phase)  
**Status**: Visual design + component inventory (ready for dev)

---

## 1. Design Principles

### Mobile-first, operator desktop-optimized
- **Mobile** (< 640px): Single-column, card-based, touch-friendly (44px targets)
- **Tablet** (640–1024px): 2-column layouts with sidebar
- **Desktop** (> 1024px): Full-width 3-column (sidebar + main + preview)

### Reuse Game Builder's spine
- Copy starter prompt → Paste HTML → Live preview → Publish
- Device frames (Desktop 16:9, Tablet 3:4, iPhone 9:19.5) already built
- App SDK injected at runtime (mock dev, real platform)

### Template-driven entry, smart manifest on exit
- Start with templates (Plan Studio, Habit Tracker, etc.), not blank
- Derive metrics/agents/audience from the code
- Confirm (don't retype) metadata before publish

---

## 2. Screen-by-Screen Flows

### SCREEN 1: Catalog Home (landing)

**Layout**:
```
┌─────────────────────────────────────────────┐
│ Circle HQ / Builder / [Games] [Apps ▼]     │  ← Rail + Topbar
├─────────────────────────────────────────────┤
│                                             │
│  📦 App Builder                             │
│  "Register and build KinetikCircle apps"   │
│                                             │
│  [Refresh ↻] [+ New App]                   │  ← Header, actions
│                                             │
│  ═══ APP TEMPLATES (row) ═══                │
│  [📅 Plan Studio] [🖼️ Memory Wall]         │
│  [✅ Habit Tracker] [📋 Recipes]           │
│  [➕ Blank]                                  │
│                                             │
│  ═══ REGISTERED APPS (grid) ═══             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Plan St. │ │ Habits   │ │ Grocery  │   │
│  │🔗 kinetik│ │🔗 kinetik│ │🔗 kinetik│   │
│  │● live    │ │● beta    │ │● planned │   │
│  │2 metrics │ │3 metrics │ │1 metric  │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Template row**: Horizontal scroll on mobile, full row on desktop.
**App grid**: 2 columns on mobile (responsive like GameBuilder), 3+ on desktop.
**AppCard**: Emoji + name + product + status + metric count (click to edit).

**Interactions**:
- Tap template → Step into Build screen (pre-seeded)
- Tap [+ New App] → Build screen with Blank template
- Tap AppCard → Build screen (editing mode)
- Tap [Refresh] → Re-fetch apps from Supabase

---

### SCREEN 2: Build Screen (two-panel: left workflow, right preview)

**Desktop layout** (> 1024px):
```
┌─────────────────────────────────────────────────────────────┐
│  [← Catalog] New App                    [Publish] [Discard]  │  ← Header
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│  LEFT PANEL          │      RIGHT PANEL                     │
│  ─────────────        │      ──────────────                  │
│  Workflow Steps       │      Device Preview                  │
│  (max 50% width)      │      (takes rest of space)          │
│                      │                                      │
│  1️⃣ PICK TEMPLATE    │  [Desktop] [Tablet] [iPhone]        │
│  ───────────────      │  ┌─────────────────────────────┐   │
│  Current: Blank       │  │                             │   │
│  [Change]             │  │  (App preview rendering     │   │
│                      │  │   Circle App SDK mocked,    │   │
│  2️⃣ PASTE CODE       │  │   logged-in demo user +     │   │
│  ───────────────      │  │   circle data visible)      │   │
│  [Paste HTML]         │  │                             │   │
│  [Open in new tab]    │  │                             │   │
│                      │  │                             │   │
│  3️⃣ CONFIRM DETAILS  │  │                             │   │
│  ───────────────      │  │                             │   │
│  Name: [input]        │  │                             │   │
│  Category: [input]    │  └─────────────────────────────┘   │
│  Audience: [pills]    │                                      │
│  Agent surfaces: ...  │  [Open in new tab ↗]               │
│                      │                                      │
│  [Publish] [Save]    │                                      │
│                      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

**Mobile layout** (< 640px):
```
┌────────────────────────────────────┐
│ [← Catalog] New App                │
├────────────────────────────────────┤
│                                    │
│ 1️⃣ PICK TEMPLATE                  │
│ [Change] Current: Blank            │
│                                    │
│ 2️⃣ PASTE CODE                     │
│ [Paste HTML]                       │
│ [Open in new tab]                  │
│                                    │
│ 3️⃣ CONFIRM DETAILS                │
│ [form fields below]                │
│                                    │
│ [Device Preview]                   │
│ [Desktop] [Tablet] [iPhone]        │
│ ┌──────────────────────────────┐  │
│ │  (preview, full width below)  │  │
│ │  Shows app in selected device │  │
│ └──────────────────────────────┘  │
│                                    │
│ [Publish]                          │
│                                    │
└────────────────────────────────────┘
```

---

### Step 1: Pick Template

**Component**: Horizontal carousel or radio buttons
```
Current template: [Blank ▼]

[📅 Plan Studio]     ← card, tap to change
  "Weekly meal planner + grocery sync"
  
[🖼️ Memory Wall]     ← card
  "Photo timeline + shared memories"

[✅ Habit Tracker]   ← card
  "Daily habits + streak gamification"

[➕ Blank]           ← card, currently selected (highlighted)
  "Start from scratch"
```

**What it does**:
- Pre-seeds the starter prompt (app SDK spine + entity hints)
- Shows a one-line description of what the template does
- Clicking changes the prompt below
- Tapping a template fetches `templates.${id}.prompt` from data

---

### Step 2: Paste Code

**Component**: Textarea + action buttons

```
┌──────────────────────────────────────────────────────────┐
│ Step 2 — Paste the generated HTML (from Claude/ChatGPT) │
│                                                          │
│ [Copy Starter Prompt] [Prompt for current template]     │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ <html>                                             │  │
│ │ <!-- Paste your LLM-generated app here -->         │  │
│ │ <script src="CircleApp.js"></script>               │  │
│ │ ...                                                │  │
│ │                                                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ⓘ The app runs with a mock Circle App SDK for dev.    │
│   When deployed in KinetikCircle, it gets real auth +  │
│   real data + real agents.                             │
│                                                          │
│ [Open in new tab ↗] [Run preview →]                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**What it does**:
- Reuses GameBuilder's textarea + validation
- "Copy Starter Prompt" button → clipboard (like GameBuilder)
- "Prompt for current template" → shows the template's seeded prompt
- Validates for `CircleApp` SDK calls (like GameBuilder validates for `CircleGame`)
- "Open in new tab" → blob URL, renders the HTML standalone (true preview)
- "Run preview" → updates the right panel live (debounced)

---

### Step 3: Confirm Details

**Component**: Auto-filled form with inference badges

```
┌──────────────────────────────────────────────────────────┐
│ Step 3 — App details (auto-detected, edit if needed)    │
│                                                          │
│ [Identity Card]                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Name          [________________________________________]│  │
│ │ Category      [________________________________________]│  │
│ │ Product       [🔗 KinetikCircle] [🎓 ArgantaLab]     │  │
│ │ Status        [planned ▼] [beta] [live]             │  │
│ │ Owner         [Operator ▼]                          │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [Reach & Contracts Card]                                │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Audience      [kids] [teens] [parents] [educators] │  │
│ │               [Inferred from template]  🔍          │  │
│ │                                                      │  │
│ │ Circle types  [family] [friends] [class]            │  │
│ │               [Inferred: family] 🔍                 │  │
│ │                                                      │  │
│ │ Metrics       [habit_logged, streak_milestone]      │  │
│ │               [Inferred from CircleApp.emit()]  🔍  │  │
│ │                                                      │  │
│ │ Agent surfaces [reminder, coach]                    │  │
│ │                [Inferred from CircleApp.agent()] 🔍 │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [Publish] [Save as draft]                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**What it does**:
- **Name & Category**: User types (or inferred from template/code)
- **Product**: Defaults to KinetikCircle, can switch to ArgantaLab
- **Status**: Defaults to "planned", operator can set to beta/live
- **Audience & Circle types**: Pre-selected from template, operator edits as pills
- **Metrics**: **Auto-inferred** by parsing `CircleApp.emit('habit_logged', ...)` calls in the HTML — shows [🔍 Inferred] badge
- **Agent surfaces**: **Auto-inferred** by parsing `CircleApp.agent('reminder', ...)` calls — shows [🔍 Inferred] badge
- Tap [🔍] badge → shows the inferred values with options to tweak

**Inference logic** (happens on paste):
```
Parse HTML for:
  CircleApp.emit('EVENT_NAME', ...) 
    → add to metrics[]
  CircleApp.agent('SURFACE_NAME', ...) 
    → add to agent_surfaces[]
  <!-- @template: plan-studio -->
    → suggests audience/circle_types from template meta
```

---

### Success State

After publish, show a confirmation screen (brief, then return to catalog):

```
┌──────────────────────────────────────────────────────────┐
│ ✓ App Published                                          │
│                                                          │
│ 📅 Plan Studio                                           │
│ "Weekly meal planner + grocery sync"                    │
│ is live in KinetikCircle. It appears in Portfolio.     │
│                                                          │
│ [Open in KinetikCircle ↗] [Return to Catalog]          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Component Inventory & Reuse

### Reused from GameBuilder
- ✅ Device frames (DEVICES, preview panel)
- ✅ Textarea for HTML paste
- ✅ "Open in new tab" pattern (blob URL)
- ✅ Validation helpers (v.hasSDK, v.size, etc.)
- ✅ Catalog grid + card layout
- ✅ Publish success banner

### New Components (specific to App Builder)
| Component | Purpose | Mobile | Desktop |
|---|---|---|---|
| **TemplateCarousel** | Pick a starter app template | Horizontal scroll | Full row |
| **TemplateCard** | Single template (emoji, name, desc) | Stack | Inline |
| **InferenceBadge** | Show auto-detected fields | Inline, right-aligned | Inline |
| **ManifestPanel** | Auto-filled form (Identity + Reach) | Stack / cards | 2-col grid |
| **DeviceSegment** | Switch preview device | Pill buttons | Pill buttons |

### Reusable Utilities (new, for all apps)
- `parseSDKCalls(html)` → extract emit() & agent() calls
- `inferMetrics(emitCalls)` → suggest metrics[]
- `inferAgents(agentCalls)` → suggest agent_surfaces[]
- `inferTemplate(manifest)` → match to likely template (fuzzy)

---

## 4. Data Flow & Interactions

### On load (Catalog):
```
useEffect(() => {
  live.listApps() → setApps(...)
  live.listTemplates() → setTemplates(...)  // NEW
})
```

### On pick template:
```
setSelectedTemplate(id)
prompt = templates[id].prompt  // seed the prompt
manifest = templates[id].defaultManifest  // pre-fill form
```

### On paste HTML:
```
onChange(html)
inferred = parseSDKCalls(html)  // Extract emit() & agent()
setMetrics(inferred.metrics)
setAgentSurfaces(inferred.agents)
updatePreview(html)  // Debounced, 300ms
```

### On publish:
```
save() {
  manifest = {
    id: slugify(name),
    name, category, product, status, owner,
    audience, circle_types,
    metrics: inferred.metrics,  // Use inferred!
    agent_surfaces: inferred.agents,
    html: trimmed(html),  // Store the app code
    template_id: selectedTemplate,
    created_at: now()
  }
  live.saveApp(manifest) → hq_app row
  live.saveAppHTML(id, html) → hq_app_html table (NEW)
  emit('app_created', manifest) → Portfolio
}
```

### On preview device switch:
```
const [device, setDevice] = useState('desktop')
frame.style.aspectRatio = DEVICES[device].ar
frame.style.borderRadius = DEVICES[device].radius
// (already in GameBuilder, reuse)
```

---

## 5. Mobile-First Responsive Details

### Breakpoint behavior:

**Mobile** (< 640px):
- Single-column: header → template carousel (snappy scroll) → paste area (full width) → form cards → preview (below, full width)
- Form fields stack vertically
- Device preview fills viewport width
- Pill buttons wrap (audience, circle_types)

**Tablet** (640–1024px):
- Two-column: Left (workflow 45%) | Right (preview 55%)
- Form fields in 2-column grid where sensible
- Template carousel scrollable

**Desktop** (> 1024px):
- Three-column: Sidebar (rail) | Main (workflow 30%) | Preview (70%)
- Form in 2-column grid (Identity / Reach side-by-side)
- Template carousel full width
- Preview takes right 2/3

### Touch targets (mobile):
- Pill buttons: 36px height (from current 20px)
- "Change template" button: 44px
- Textarea: Full width - 12px padding, 240px+ height
- Device picker buttons: 44px (from DEVICES, currently 32px)

### Spacing:
- Mobile: 12px sides, 16px gaps
- Tablet: 16px sides, 16px gaps
- Desktop: 24px sides, 20px gaps

---

## 6. Comparison: GameBuilder vs. App Builder

| Aspect | GameBuilder | AppBuilder |
|---|---|---|
| **Artifact** | Self-contained HTML (game) | Self-contained HTML (app) |
| **SDK** | CircleGame (score/currency/leaderboard) | CircleApp (auth/data/agents) |
| **Entry** | New/Edit form, pick category | **Template carousel**, pick starter |
| **Metadata** | Title, description, tags, age range (hand-typed) | **Auto-inferred** from code (metrics, agents) |
| **Catalog** | Game grid | **Template row** + app grid |
| **Publishing** | Direct to ArgantaLab | To KinetikCircle (Portfolio auto-sync) |
| **Device preview** | Desktop/Tablet/iPhone (shared) | Desktop/Tablet/iPhone (shared) |

**Biggest difference**: App Builder infers its manifest, GameBuilder requires hand-entry.

---

## 7. Modular Template Architecture (for scalability)

### Template source: data structure

```typescript
interface AppTemplate {
  id: string              // 'plan-studio', 'habit-tracker', etc.
  name: string            // "Plan Studio"
  emoji: string           // "📅"
  description: string     // "Weekly meal planner + grocery sync"
  prompt: string          // The Circle App SDK starter + LLM prompt
  defaultManifest: {
    category: string      // "planning"
    audience: string[]    // ["parents", "kids"]
    circle_types: string[] // ["family"]
    suggested_metrics: string[]  // ["meal_planned", "recipe_cooked"]
    suggested_agents: string[]   // ["planner", "chef"]
  }
  preview_html?: string   // Optional: a demo version to preview in the right panel
  created_at: string
}
```

### Storage options:
1. **Hardcoded in TypeScript** (current plan): Quick to start, easy to edit
2. **Supabase table** `app_templates` (future): Allow operators to create custom templates from HQ

### How to add a new template later:

**Option A: Hardcoded (immediate)**
```typescript
// featuredTemplates.ts (NEW)
export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'plan-studio',
    name: 'Plan Studio',
    emoji: '📅',
    description: 'Weekly meal planner + grocery sync',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}...`,
    defaultManifest: { ... }
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    emoji: '✅',
    ...
  },
  // Add new template here — copy paste, done
]
```

**Option B: Supabase-backed (future)**
```typescript
// live.ts
live.listAppTemplates() → fetch from hq_app_template
```

Either way, the UI doesn't change. Templates are just data.

---

## 8. Next: Circle App SDK Spine

The **spine that all apps reuse** — a separate spec doc. But here's the shape:

```typescript
interface CircleApp {
  // Auth & context
  init(): Promise<{id, name, avatar, role, circle}>
  circle: {id, type, members, created_at}
  
  // Data (per-app entity)
  db: {
    list(query?): Promise<records[]>
    save(record): Promise<record>
    remove(id): Promise<bool>
    on(event, fn): unsubscribe
  }
  
  // Agents
  agent(surface: 'reminder'|'planner'|..., params): Promise<result>
  
  // Events
  emit(event, data): void  // writes to hq_event
  on(event, fn): void      // realtime
}
```

Every app gets this spine injected; the mock version uses localStorage, the real version uses Supabase + RLS.

---

## 9. Accessibility & Usability Notes

### Form labels
- All inputs labeled (no placeholder-only fields)
- Inference badges explain what "auto-detected" means

### Validation
- Name required (before publish)
- HTML must include CircleApp SDK
- Metrics/agents auto-filled, editable (not required)

### Keyboard navigation
- Tab through form fields
- Enter to publish
- Escape to discard (confirm first)

### Visual feedback
- Inference badge (🔍) indicates auto-detected vs. hand-entered
- Publish button color changes (pending → saved → live)
- Success banner dismisses auto after 3s or on tap "Return"

---

## 10. File Structure (for implementation)

```
apps/hq/src/
├── surfaces/
│   ├── AppBuilder.tsx              (REFACTOR: add TemplateCarousel, InferencePanel)
│   └── Builder.tsx                 (exists: tabs for GameBuilder/AppBuilder)
├── data/
│   ├── live.ts                     (ADD: listTemplates, saveApp, saveAppHTML)
│   ├── appTemplates.ts             (NEW: APP_TEMPLATES array)
│   └── appSDK.ts                   (NEW: Circle App SDK spec + mock)
├── components/
│   ├── AppBuilder/
│   │   ├── TemplateCarousel.tsx    (NEW)
│   │   ├── InferencePanel.tsx      (NEW)
│   │   ├── ManifestForm.tsx        (NEW)
│   │   └── DevicePreview.tsx       (REUSE from GameBuilder)
│   └── (existing components)
└── lib/
    └── parseSDK.ts                 (NEW: parseSDKCalls, inferMetrics, inferAgents)
```

---

## Summary: UI/UX Design Locked

- **Screen 1**: Catalog with template carousel row + registered apps grid
- **Screen 2**: Build screen (left: 3-step workflow, right: device preview)
  - Step 1: Pick template (carousel)
  - Step 2: Paste HTML + "Copy Starter Prompt"
  - Step 3: Auto-filled manifest (metrics/agents inferred, editable)
- **Preview**: Live in device frames, mocked SDK until publish
- **Success**: Brief confirmation, "appears in Portfolio"
- **Mobile-first**: Single-column stacked, tablet/desktop expand to side-by-side
- **Reusable**: GameBuilder patterns (device frames, textarea, publish flow)
- **Scalable**: Templates are data (hardcoded → later Supabase-backed)
- **Modular**: Any new app snaps in via a template definition

**Next**: Flesh out the Circle App SDK spec (the spine all apps share).
