# Game Builder & App Builder — KinetikCircle Data Integration
**Date**: 2026-06-23  
**Model**: Sonnet 4.6  
**Status**: Design spec — builders fully connected to live circle data

---

## Vision

Currently: Builders are isolated. You build a game/app, publish it globally.

**Future**: Builders are **circle-aware**. You:
- See your circles (family, class, friends)
- Preview your game/app with real circle members
- Choose which circles to publish to
- Games/apps know who's playing them (circle context)

---

## What Exists (from schema.sql)

```
circles
├─ id, owner_id, name, kind (family|kids|class|friends), emoji
└─ members via circle_members

circle_members
├─ circle_id, member_id, member_kind (parent|child), role (admin|member)
└─ joined_at

profiles
├─ id (auth.user)
├─ display_name, photo_url, avatar
├─ username (for kids)
├─ friend_code, guardian_id
└─ linked to circles as a member

games (existing)
├─ visibility: 'private' | 'circle' | 'public'
└─ (can already be scoped to circles, just not wired in builders yet)
```

**Insight**: The infrastructure exists. Builders just need to **consume** it.

---

## Architecture: Three Data Layers

### Layer 1: Current User Context (in both builders)
```typescript
interface CurrentUser {
  id: string              // auth.uid()
  name: string
  avatar: string
  role: 'parent' | 'child' | 'operator'
}
```

**Already available** via Supabase auth.

### Layer 2: User's Circles (NEW — load on builder mount)
```typescript
interface Circle {
  id: string              // uuid
  name: string            // "The Smiths", "Mr. Johnson's Class"
  kind: 'family' | 'kids' | 'class' | 'friends'
  emoji: string
  owner_id: string        // who created it
  member_count: number
  members: Member[]
}

interface Member {
  id: string              // profile id or child profile id
  name: string
  avatar: string
  kind: 'parent' | 'child'
  role: 'admin' | 'member'
}
```

**Load via**: `live.listUserCircles()` — RLS query returns circles owned by current user.

### Layer 3: Preview Context (NEW — inject into device preview)
```typescript
interface PreviewContext {
  user: CurrentUser       // who's previewing (the operator/parent)
  circle?: Circle         // which circle they're previewing for
  audience: {
    count: number         // how many will see this
    members: Member[]     // names + avatars of who will see it
  }
}
```

**Used in**: Device preview iframe. Shown in a "This will be visible to X members" panel.

---

## GameBuilder Integration

### New UI Element: Circle Selector (in BuildView header)

**Current**:
```
[← Catalog] New Game              [Publish]
```

**New**:
```
[← Catalog] New Game    [Circle: All families ▼]    [Publish]
```

Dropdown shows:
```
Publish to:
  ⭕ All families (public)           ← visibility: 'public'
  👥 The Smiths (my family)         ← visibility: 'circle', circle_id: xxx
  👥 Summer Camp 2025               ← visibility: 'circle', circle_id: yyy
```

### Step 3 (Metadata) Enhancement

**Current form**:
```
Title: [______]
Category: [dropdown]
Description: [_______]
Tags: [________]
Age range: [6] to [12]
```

**New form** (add publish target):
```
Title: [______]
Category: [dropdown]
Description: [_______]
Tags: [________]
Age range: [6] to [12]

PUBLISH TO:
[✓] Public (all ArgantaLab kids)
[ ] The Smiths (3 members: Sarah, Leo, Mom)
[ ] Summer Camp 2025 (12 members)

Visibility: [public] ← auto-set based on checkboxes
```

### Device Preview Update

**Show in right panel** (above preview frame):
```
┌─────────────────────────────────────┐
│ Preview: "New Game"                 │
│ Audience: Public (visible to all)   │
│                                     │
│ [Desktop] [Tablet] [iPhone]         │
│                                     │
│ ┌───────────────────────────────┐  │
│ │  (game preview here)          │  │
│ │                               │  │
│ └───────────────────────────────┘  │
│                                     │
│ [Open in new tab ↗]                 │
└─────────────────────────────────────┘
```

**When a circle is selected** (in preview mode):
```
┌─────────────────────────────────────┐
│ Preview: "New Game"                 │
│ Audience: The Smiths (3 members)    │ ← Shows selected circle
│ 👤 Sarah  👤 Leo  👤 Mom            │ ← Member avatars
│                                     │
│ [Desktop] [Tablet] [iPhone]         │
│ ...                                 │
```

### SDK Injection into Preview (Game)

Currently: Mock `CircleGame` SDK is injected. User is `guest_xxx`.

**New**: When previewing, inject **real context**:
```javascript
// circleGamePreview.js (injected into iframe)
window.CircleGame = {
  user: {
    id: 'user_abc123',
    name: 'Sarah',
    avatar: 'https://...',
    diamonds: 500,
    xp: 150,
    level: 3,
    circle_id: 'circle_xyz'  // NEW
  },
  circle: {  // NEW
    id: 'circle_xyz',
    name: 'The Smiths',
    kind: 'family',
    members: [
      { id: 'user_abc123', name: 'Sarah', avatar: '...', role: 'member' },
      { id: 'user_def456', name: 'Leo', avatar: '...', role: 'member' },
      { id: 'user_ghi789', name: 'Mom', avatar: '...', role: 'admin' }
    ]
  },
  
  // ... rest of SDK (getLeaderboard scoped to circle, etc.)
}
```

Games can now use:
```javascript
const circle = await CircleGame.circle;
console.log(`Playing in ${circle.name} with ${circle.members.length} others`);

// Leaderboard is now circle-only (not global)
const top10 = await CircleGame.getLeaderboard(10);
// Returns only high scores from circle members
```

---

## AppBuilder Integration

### Same Pattern: Circle Selector

**New in Step 3** (Confirm Details):
```
App Builder Step 3

REACH & CONTRACTS:
[Publish to circles]
  [✓] Public (all KinetikCircle circles)
  [✓] The Smiths (3 members: Sarah, Leo, Mom)  ← can select multiple
  [ ] Summer Camp 2025
  [ ] My Friends

Target audience: families, classes, groups
Audience roles: parents, kids, educators
```

Apps can choose **which circles** to deploy to, and see live member counts.

### Circle App SDK Preview (App)

```javascript
// circleAppPreview.js (injected into iframe)
window.CircleApp = {
  user: {
    id: 'user_abc123',
    name: 'Sarah',
    role: 'member',  // in the circle
    circle_id: 'circle_xyz'
  },
  circle: {
    id: 'circle_xyz',
    name: 'The Smiths',
    type: 'family',
    members: [
      { id: 'user_abc123', name: 'Sarah', role: 'member', avatar: '...' },
      { id: 'user_def456', name: 'Leo', role: 'member', avatar: '...' },
      { id: 'user_ghi789', name: 'Mom', role: 'admin', avatar: '...' }
    ]
  },
  
  // db is now scoped to this circle's data (RLS enforced)
  db: {
    list: async () => { /* circle-scoped records */ },
    save: async (record) => { /* circle-scoped save */ },
    // ...
  }
}
```

Apps can render with real circle context:
```javascript
const members = CircleApp.circle.members;
const greeting = `Welcome to ${CircleApp.circle.name}!`;
// Show list of circle members in UI
```

---

## Data Model: Publishing Targets

### Publishing a Game

**Before** (current):
```typescript
await live.publishGame({
  id, title, html, userId, ...
  // visibility is hardcoded 'public'
})

// Result: game visible to all kids globally
```

**After** (new):
```typescript
await live.publishGame({
  id, title, html, userId, ...
  visibility: 'circle',           // NEW
  circle_ids: ['circle_xyz'],     // NEW: publish to specific circles
})

// Result: game visible only to members of these circles
// + visible publicly on ArgantaLab Discover
```

**Games table** (extend):
```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS circle_ids uuid[]; -- null = public
```

**RLS policy** (extend):
```sql
-- User can see:
-- 1. Games with visibility='public', OR
-- 2. Games where user is in one of the circle_ids[]
CREATE POLICY "games_select_or_in_circle" ON games
  FOR SELECT USING (
    visibility = 'public'
    OR auth.uid() IN (
      SELECT member_id FROM circle_members 
      WHERE circle_id = ANY(games.circle_ids)
    )
  );
```

### Publishing an App

Same pattern. Apps can target multiple circles:
```typescript
await live.saveApp({
  id, name, product, ...
  visibility: 'circle',           // NEW
  circle_ids: ['circle_xyz', 'circle_abc'],  // NEW
})
```

---

## Data Fetching (new live.ts methods)

### For GameBuilder

```typescript
export const live = {
  // Get the current user's circles
  async listUserCircles(): Promise<Circle[]> {
    if (!cloudEnabled) return [];
    const { data, error } = await supabase
      .from('circles')
      .select('*, circle_members(member_id, member_kind, role, profiles(display_name, photo_url), child_profiles(display_name))')
      .eq('owner_id', (await supabase.auth.getUser()).user?.id)
    if (error) { console.warn('listUserCircles →', error.message); return [] }
    return data as Circle[];
  },
  
  // Get a single circle's members (for preview)
  async getCircle(circleId: string): Promise<Circle | null> {
    if (!cloudEnabled) return null;
    const { data, error } = await supabase
      .from('circles')
      .select('*, circle_members(member_id, member_kind, role, ...)')
      .eq('id', circleId)
      .single()
    if (error) return null;
    return data as Circle;
  },
  
  // Publish game to circle(s)
  async publishGame(game: GamePublishInput & { circle_ids?: string[] }): Promise<boolean> {
    // ... existing logic ...
    const { error } = await supabase
      .from('games')
      .upsert({
        // ... existing fields ...
        visibility: game.circle_ids && game.circle_ids.length > 0 ? 'circle' : 'public',
        circle_ids: game.circle_ids || null,
      })
    return !error;
  }
}
```

### For AppBuilder

Same methods + app-specific:
```typescript
async saveApp(app: AppManifest & { circle_ids?: string[] }): Promise<boolean> {
  // ... existing logic ...
  const { error } = await supabase
    .from('hq_app')
    .upsert({
      // ... existing fields ...
      visibility: app.circle_ids && app.circle_ids.length > 0 ? 'circle' : 'public',
      circle_ids: app.circle_ids || null,
    })
  return !error;
}
```

---

## UI/UX: The Full Integration

### GameBuilder — Catalog Screen (unchanged)
Games grid still shows all published games. Now you can filter:
```
Filter by: [All] [My families] [My circles]
```

### GameBuilder — Build Screen (enhanced)

**New header**:
```
[← Catalog] New Game    [Circle: The Smiths ▼]    [Publish]
```

**Step 3 (Metadata)** — adds:
```
PUBLISH TO:
[✓] Public (visible globally)
[✓] The Smiths (Sarah, Leo, Mom)
[ ] Summer Camp 2025
```

### Device Preview (enhanced)

**Shows audience**:
```
Audience: The Smiths (3 members)
👤 Sarah  👤 Leo  👤 Mom

[Device preview...]
```

**Preview SDK has real circle data** → games can render member-aware UI.

### Success Screen (enhanced)

**Before**:
```
✓ "New Game" is live in ArgantaLab's Discover
```

**After**:
```
✓ "New Game" is live

Published to:
  👥 The Smiths (3 members)
  👥 Summer Camp 2025 (12 members)
  🌍 Public (all ArgantaLab kids)

[Open in KinetikCircle ↗]
```

---

## Feature Rollout (MVP → Full)

### Phase 1 (MVP): Preview with circle context
- ✅ Load user's circles on builder mount
- ✅ Inject real circle data into preview (game/app sees real members)
- ✅ Show "Audience" panel in device preview
- ✅ Games/apps can use `CircleGame.circle` / `CircleApp.circle`
- ❌ No circle targeting yet (everything still published public)

### Phase 2: Circle targeting
- ✅ Add circle_ids[] to games & apps tables
- ✅ Extend publish flow to select circles
- ✅ Update RLS to enforce circle visibility
- ✅ Show "Published to" in success screen
- ✅ Catalog filters by circle

### Phase 3: Advanced
- ✅ Circle analytics (how many in each circle played/used the app)
- ✅ Per-circle leaderboards
- ✅ Circle-specific content (different levels for different ages)
- ✅ Operator can create & manage "featured within circles"

---

## Implementation Checklist (Phase 1 MVP)

### live.ts (NEW methods)
- [ ] `listUserCircles(): Promise<Circle[]>`
- [ ] `getCircle(id: string): Promise<Circle | null>`

### GameBuilder.tsx (REFACTOR)
- [ ] Load circles on mount: `useEffect(() => live.listUserCircles())`
- [ ] Pass circles to BuildView
- [ ] Add circle selector to header
- [ ] Render "Audience" panel in device preview
- [ ] Inject real circle data into preview iframe

### AppBuilder.tsx (REFACTOR)
- [ ] Same as GameBuilder

### Preview SDK (NEW/ENHANCE)
- [ ] Create `circleGamePreview.js` with real user + circle data
- [ ] Create `circleAppPreview.js` with real user + circle data
- [ ] Inject into iframes based on selected circle

### Schema (Phase 2)
- [ ] `ALTER TABLE games ADD COLUMN circle_ids uuid[];`
- [ ] `ALTER TABLE hq_app ADD COLUMN circle_ids uuid[];`
- [ ] Update RLS policies

---

## Benefits

### For Operators/Parents
- ✅ Preview games/apps with real circle members before publishing
- ✅ Publish to specific circles (family, class, friend group)
- ✅ See who will see what
- ✅ Games/apps are now **family-scoped**, not just global

### For Game/App Developers
- ✅ Access circle context: `CircleGame.circle` / `CircleApp.circle`
- ✅ Render member-aware UI (show circle members, greet by name, etc.)
- ✅ Leaderboards are circle-scoped, not global
- ✅ Can customize behavior per circle (e.g., harder levels for teens)

### For Kids
- ✅ Play/use games/apps scoped to their circles
- ✅ Leaderboards are with friends/classmates, not anonymous globals
- ✅ Safer, more relevant content

### For the Platform
- ✅ Builders are now **context-aware**, not isolated
- ✅ Games/apps can leverage social graph (circles)
- ✅ Portfolio can show per-circle engagement
- ✅ Path to multi-user, collaborative games/apps

---

## Example: Matchday Game with Circle Integration

```javascript
async function init() {
  const user = await CircleGame.init();
  const circle = CircleGame.circle;
  
  // Show circle info
  document.getElementById('header').textContent = 
    `${user.name}'s matches in ${circle.name}`;
  
  // Load matches (scoped to circle)
  const matches = await CircleGame.loadMatches();
  
  // Show member avatars in match roster
  circle.members.forEach(member => {
    const row = createMemberRow(member.name, member.avatar);
    matchRoster.appendChild(row);
  });
  
  // Circle-scoped leaderboard
  const top10 = await CircleGame.getLeaderboard(10);  // only circle members
  top10.forEach((player, i) => {
    leaderboard.appendChild(createRankRow(i+1, player.name, player.score));
  });
}
```

---

## This Transforms the Builder

**From**: "Build in isolation, publish globally"

**To**: "Build with your circle's context, publish to the people who matter"

That's the shift. The builders become **community-aware**, not just creation tools.

