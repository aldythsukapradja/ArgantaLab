# Circle App SDK Specification
**Date**: 2026-06-23  
**Model**: Opus 4.8  
**Purpose**: The reusable spine for all KinetikCircle mini-apps
**Status**: Specification (implementation follows design)

---

## Overview

The **Circle App SDK** is to apps what the **Circle Game SDK** is to games — a JavaScript library baked into every app that provides:

1. **Auth** — Current user + circle context (who am I, which circle, who else is here?)
2. **Data** — CRUD on the app's own entity, RLS-scoped to the circle
3. **Agents** — Call in-app AI surfaces (reminders, planners, budgeters, etc.)
4. **Events** — Emit to `hq_event` so Portfolio / Pulse track activity
5. **Realtime** — Subscribe to changes in the circle's data

All apps share **the same SDK**. The SDK adapts:
- **Dev mode** (in Game Builder's device preview): Mock localStorage, fake user
- **Real mode** (deployed in KinetikCircle): Real Supabase auth, real RLS, real agents

---

## 1. Core API

### `CircleApp.init()`

Initialize the app. Call once on boot. Returns the current user.

```javascript
const user = await CircleApp.init();
// {
//   id: "user_abc123",
//   name: "Sarah",
//   avatar: "https://...",
//   role: "member",           // 'member' | 'admin' | 'parent'
//   circle_id: "circle_xyz",
//   email: "sarah@example.com"
// }

// In dev (mock): user is a fake "Demo Player", circle_id is hardcoded
// In prod (real): user comes from Supabase auth, circle from JWT claim
```

**Error cases**:
- Not signed in → returns `null` (caller shows a "sign in" state)
- Circle context missing → returns user with `circle_id: null` (app loads in context-less mode for testing)

---

### `CircleApp.circle`

The current circle's metadata. Set during `init()`.

```javascript
const circle = CircleApp.circle;
// {
//   id: "circle_xyz",
//   name: "The Smiths",
//   type: "family",           // 'family' | 'friends' | 'class' | 'team'
//   members: [
//     { id: "user_abc123", name: "Sarah", role: "member", avatar: "..." },
//     { id: "user_def456", name: "Parent", role: "admin", avatar: "..." }
//   ],
//   created_at: "2025-01-15T10:00:00Z",
//   settings: { notifications_enabled: true, ... }
// }
```

**In dev**: Hardcoded circle with 2–3 members for testing.
**In prod**: Real circle from Supabase.

---

### `CircleApp.db` — Data CRUD

Every app has its own data namespace. Apps read/write their own entity, scoped by circle.

#### `CircleApp.db.list(query?)`
Fetch records for this app + circle.

```javascript
// List all records
const records = await CircleApp.db.list();

// List with filter
const records = await CircleApp.db.list({
  where: { status: 'pending' },
  orderBy: 'created_at',
  limit: 100
});
```

Returns: `Promise<Record[]>`

**Record shape** (app-defined):
```javascript
{
  id: "rec_abc123",
  circle_id: "circle_xyz",      // Auto-set by SDK
  app_id: "habit-tracker",        // Auto-set by SDK
  created_by: "user_abc123",      // Auto-set by SDK
  created_at: "2025-01-20T...",   // Auto-set by SDK
  
  // App-specific fields:
  name: "Morning run",
  frequency: "daily",
  category: "health",
  ...
}
```

---

#### `CircleApp.db.save(record)`
Create or update a record.

```javascript
const result = await CircleApp.db.save({
  id: "rec_abc123",  // Omit for new records
  name: "Brush teeth",
  frequency: "daily",
  category: "health"
});

// Returns the saved record with id + timestamps auto-filled
// {
//   id: "rec_abc123",
//   circle_id: "circle_xyz",
//   app_id: "habit-tracker",
//   created_by: "user_abc123",
//   created_at: "2025-01-20T...",
//   updated_at: "2025-01-20T...",
//   name: "Brush teeth",
//   frequency: "daily",
//   category: "health"
// }
```

**Validation**:
- `id` is optional (auto-UUID for new)
- `circle_id`, `app_id`, `created_by` are **ignored from input** (SDK enforces)
- Fields are stored as JSON (app sends anything, no schema validation)

**Permissions** (RLS enforced):
- Member can write their own records
- Member can read circle's records
- Admin can write/delete any record in circle
- **No cross-circle access**

---

#### `CircleApp.db.remove(id)`
Delete a record.

```javascript
const ok = await CircleApp.db.remove('rec_abc123');
// true on success, false if not found / not authorized
```

---

#### `CircleApp.db.on(eventType, callback)`
Subscribe to realtime changes in the circle's data.

```javascript
// Subscribe to create events
const unsub = CircleApp.db.on('create', (record) => {
  console.log('New record:', record);
  updateUI();
});

// Subscribe to update events
CircleApp.db.on('update', (record) => {
  console.log('Updated:', record);
  updateUI();
});

// Subscribe to delete events
CircleApp.db.on('delete', ({ id }) => {
  console.log('Deleted:', id);
  updateUI();
});

// Unsubscribe
unsub();
```

**In dev**: Fires after save() / remove() (instant, mocked)
**In prod**: Fires via Supabase Realtime (true realtime, ~100ms)

---

### `CircleApp.agent(surface, params)`

Call an agent surface (AI-powered action).

```javascript
// Ask the planner agent
const plan = await CircleApp.agent('planner', {
  question: 'What should we cook for dinner given these ingredients?',
  context: { ingredients: ['chicken', 'rice', 'soy sauce'] }
});
// { success: true, response: "Stir-fried chicken with rice..." }

// Ask the budgeter agent
const summary = await CircleApp.agent('budgeter', {
  query: 'What did we spend on groceries this month?',
  data: transactions
});
// { success: true, response: "You spent $247 on groceries..." }

// Ask the coach agent
const encouragement = await CircleApp.agent('coach', {
  topic: 'habit_streak',
  streak_days: 30
});
// { success: true, response: "Amazing! 30 days of consistency..." }

// Error: agent surface not registered
// { success: false, reason: 'surface_not_found' }
```

**Params**: Always an object. Shape is agent-specific.
**Returns**: `Promise<{ success: bool, response?: string, error?: string }>`

**In dev**: Returns canned responses (hardcoded for each agent).
**In prod**: Routes to a Supabase Edge Function → Claude API → response.

---

### `CircleApp.emit(event, data?)`

Emit an event to the platform. These write to `hq_event` and appear in Portfolio / Pulse.

```javascript
// Emit an event (fire-and-forget)
CircleApp.emit('habit_logged', {
  habit_id: 'rec_abc123',
  streak: 5
});

// Event reaches hq_event table:
// {
//   id: <auto-uuid>,
//   circle_id: "circle_xyz",
//   app_id: "habit-tracker",
//   event: "habit_logged",
//   data: { habit_id: "rec_abc123", streak: 5 },
//   timestamp: "2025-01-20T..."
// }

// These events appear in Portfolio as:
// "habit_tracker" app now has a "habit_logged" event
// (Portfolio aggregates)
```

**Common events** (app-defined, but consistent):
- `record_created` — new record added
- `record_deleted` — record removed
- `milestone_reached` — streak hit, goal completed, etc.
- `action_taken` — user did something (checklist item, purchase, etc.)

**In dev**: Logged to console.
**In prod**: Writes to `hq_event` table (RLS: user can write, operators can read all).

---

### `CircleApp.on(event, callback)`

Subscribe to SDK events (not data events — see `db.on()` for data).

```javascript
// On successful init
CircleApp.on('ready', () => {
  console.log('SDK ready, user is:', CircleApp.user);
  renderApp();
});

// On user changes (e.g., logged out in another tab)
CircleApp.on('user_changed', (user) => {
  console.log('User changed:', user);
  refreshUI();
});

// On agent result (if you await agent())
// (not needed, agent() already awaits)
```

---

## 2. Typical App Lifecycle

### Load (dev mode)
```javascript
// 1. Init SDK
const user = await CircleApp.init();
console.log('Logged in as:', user.name);
console.log('Circle:', CircleApp.circle.name);

// 2. Fetch data
const records = await CircleApp.db.list();
renderList(records);

// 3. Subscribe to changes
CircleApp.db.on('create', (record) => {
  records.push(record);
  renderList(records);
});

// 4. Start listening for events
CircleApp.on('ready', () => console.log('App is live'));
```

### User action (create record)
```javascript
// User types "Buy milk" + hits enter
const record = await CircleApp.db.save({
  name: 'Buy milk',
  status: 'pending',
  added_by: user.id
});

// (db.on('create') fires immediately in dev, shows the new record)

// Emit to portfolio
CircleApp.emit('item_added', { item_id: record.id });
```

### Publish (deploy to KinetikCircle)
```javascript
// Same code runs, but:
// - init() talks to real Supabase auth
// - db.list() reads from real Supabase + RLS
// - db.on() subscribes via real Supabase Realtime
// - emit() writes to real hq_event table
// - agent() routes to real Edge Function
```

**No code changes needed** — the SDK auto-adapts.

---

## 3. Data Storage (Supabase)

### Single shared entity table: `app_record`

All apps share one table. Scoped by `(app_id, circle_id)`.

```sql
CREATE TABLE app_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id),
  app_id text NOT NULL,           -- 'habit-tracker', 'grocery', etc.
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Flexible JSON payload
  data jsonb NOT NULL DEFAULT '{}',
  
  -- For efficient queries
  status text,                     -- optional: pending, done, etc.
  priority int,                    -- optional: 1, 2, 3
  category text,                   -- optional: app-defined categories
  
  UNIQUE(id),
  INDEX (circle_id, app_id),
  INDEX (circle_id, app_id, status)
);
```

**RLS policy**:
```sql
-- Members can read all records in their circle
CREATE POLICY "read_circle_records" ON app_record
  FOR SELECT USING (circle_id = current_user_circle_id());

-- Members can write their own records
CREATE POLICY "create_own_records" ON app_record
  FOR INSERT WITH CHECK (
    circle_id = current_user_circle_id() 
    AND created_by = auth.uid()
  );

-- Members can update their own records
CREATE POLICY "update_own_records" ON app_record
  FOR UPDATE USING (
    circle_id = current_user_circle_id() 
    AND (created_by = auth.uid() OR is_circle_admin())
  );

-- Admins can delete any record in their circle
CREATE POLICY "admin_delete" ON app_record
  FOR DELETE USING (
    circle_id = current_user_circle_id() 
    AND is_circle_admin()
  );
```

---

### Events table: `hq_event`

(Already exists, SDK writes to it)

```sql
CREATE TABLE hq_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id),
  app_id text NOT NULL,
  event text NOT NULL,             -- 'habit_logged', 'item_added', etc.
  data jsonb,
  created_at timestamptz DEFAULT now()
);
```

**RLS**:
- Users can write events for their circle
- Operators can read all events (Portfolio queries them)

---

### Agents: Edge Functions or APIs

**For now** (dev/beta): Hardcoded responses in the mock SDK.

**For production**: Supabase Edge Function that:
```
POST /agents/{surface}
  {
    "context": { circle_id, user_id, app_id },
    "params": { question, data, ... }
  }
  
Returns:
  { success: true, response: "..." }
```

The function calls Claude API with the context + the question. Results cached per surface/context (optional).

---

## 4. Mock SDK (for dev in Game Builder)

When an app runs in the device preview during Game Builder, it gets a **mock Circle App SDK**:

```javascript
// circleAppMock.js (injected into the app iframe)
(function() {
  if (window.CircleApp) return;
  
  let records = JSON.parse(localStorage.getItem('app_records') || '[]');
  let user = { id: 'user_demo', name: 'Demo Player', circle_id: 'circle_demo' };
  
  window.CircleApp = {
    circle: {
      id: 'circle_demo',
      name: 'Demo Family',
      type: 'family',
      members: [
        { id: 'user_demo', name: 'Demo Player', role: 'member' },
        { id: 'user_parent', name: 'Parent', role: 'admin' }
      ]
    },
    
    init: async function() {
      console.log('[Circle App] SDK ready (mock)');
      return user;
    },
    
    db: {
      list: async function(query) {
        return records.filter(r => !query || ...matches query);
      },
      
      save: async function(record) {
        const id = record.id || crypto.randomUUID();
        const saved = {
          ...record,
          id,
          circle_id: 'circle_demo',
          created_by: user.id,
          created_at: new Date().toISOString()
        };
        records.push(saved);
        localStorage.setItem('app_records', JSON.stringify(records));
        this.emit('create', saved);  // Immediate local emit
        return saved;
      },
      
      remove: async function(id) {
        records = records.filter(r => r.id !== id);
        localStorage.setItem('app_records', JSON.stringify(records));
        this.emit('delete', { id });
        return true;
      },
      
      on: function(eventType, callback) {
        // Naive: no real events, but callbacks are stored
        // App can call db.on() and it will work
        return () => {};  // Unsubscribe (no-op in mock)
      }
    },
    
    agent: async function(surface, params) {
      // Return canned responses
      if (surface === 'reminder') {
        return { success: true, response: 'Reminder set (mock)' };
      }
      if (surface === 'planner') {
        return { success: true, response: 'Here\'s a plan: ...' };
      }
      return { success: false, reason: 'surface_not_found' };
    },
    
    emit: function(event, data) {
      console.log('[Circle App Event]', event, data);
    },
    
    on: function(event, callback) {
      // Naive: store, call on init
      if (event === 'ready') {
        setTimeout(() => callback(), 100);
      }
    }
  };
})();
```

This mock runs in the iframe during preview. When the app is published to KinetikCircle, the real SDK is injected and the code runs unchanged.

---

## 5. Implementation Roadmap

### Phase 1: Circle App SDK Core (minimal)
- [ ] SDK init + circle context
- [ ] db.list() / save() / remove()
- [ ] emit() to hq_event
- [ ] Mock SDK for dev preview

### Phase 2: Realtime & Agents
- [ ] db.on() with Supabase Realtime
- [ ] agent() routing to Edge Function
- [ ] Canned agent responses

### Phase 3: RLS & Security
- [ ] RLS policies on app_record
- [ ] Circle isolation (no cross-circle reads)
- [ ] Admin vs. member role checks

### Phase 4: Advanced
- [ ] Batch operations (db.saveMany)
- [ ] Transactions (db.transaction)
- [ ] Historical snapshots (audit log)
- [ ] Custom indexes for app queries

---

## 6. How to Use the SDK in an App

### Example: Habit Tracker App

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width">
  <title>Habit Tracker</title>
</head>
<body>
<div id="app"></div>

<script>
// 1. SDK is injected by the platform (or mock in dev)
// window.CircleApp is already available

let user, habits = [];

async function init() {
  user = await CircleApp.init();
  console.log('User:', user.name, 'Circle:', CircleApp.circle.name);
  
  // Fetch habits
  habits = await CircleApp.db.list({ where: { type: 'habit' } });
  render();
  
  // Subscribe to changes
  CircleApp.db.on('create', (record) => {
    habits.push(record);
    render();
    CircleApp.emit('habit_added', { habit_id: record.id });
  });
  
  CircleApp.db.on('update', (record) => {
    const i = habits.findIndex(h => h.id === record.id);
    if (i >= 0) habits[i] = record;
    render();
  });
}

async function addHabit(name, frequency) {
  const habit = await CircleApp.db.save({
    type: 'habit',
    name,
    frequency,
    created_by: user.id
  });
  // db.on('create') will trigger render
}

async function logToday(habitId) {
  const habit = habits.find(h => h.id === habitId);
  const logs = habit.logs || [];
  logs.push(new Date().toISOString());
  
  await CircleApp.db.save({
    ...habit,
    logs
  });
  
  // Check for streak milestone
  if (logs.length === 7) {
    CircleApp.emit('streak_milestone', { habit_id: habitId, days: 7 });
  }
}

function render() {
  const html = habits.map(h => `
    <div>
      <h3>${h.name}</h3>
      <p>${h.frequency} · ${(h.logs || []).length} logged</p>
      <button onclick="logToday('${h.id}')">Log Today</button>
    </div>
  `).join('');
  
  document.getElementById('app').innerHTML = html;
}

// Start
init();
</script>
</body>
</html>
```

---

## 7. Security & RLS Philosophy

### Design principle: **Circle isolation, role-aware**

- A member can only see/modify their circle's data
- Admins can manage any member's records
- Operators (HQ) can query events for analytics
- **No API key in client** — auth is via Supabase session (postMessage from parent)

### RLS ensures:
- A member of Circle A cannot read Circle B's data, even with an API key
- A member cannot update another member's records (unless admin)
- Cross-app isolation: Habit Tracker can't read Grocery app's data (schema-separated or filtered)

---

## 8. Next Steps

1. **Implement Phase 1** (Core SDK + mock)
2. **Build first app template** (Grocery or Habits) using this SDK
3. **Test in Game Builder** device preview
4. **Document agent surfaces** (reminder, planner, budgeter, coach, etc.)
5. **Add Phases 2–3** (realtime, agents, RLS)

**This spec is locked.** Implementation begins after design review.
