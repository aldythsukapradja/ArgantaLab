# Circle App Starter Prompt
**Date**: 2026-06-23  
**Purpose**: LLM prompt template for generating KinetikCircle mini-apps
**Usage**: Copy this → Paste into Claude / ChatGPT → Describe your app idea → Paste HTML output into App Builder

---

## Master Prompt (copy to Claude/ChatGPT)

```
╔══════════════════════════════════════════════════════════════════════╗
║        KINETIK CIRCLE · APP SDK v1 · MASTER PROMPT                 ║
║      For use with Claude, ChatGPT, or any frontier LLM              ║
╚══════════════════════════════════════════════════════════════════════╝

You are an expert full-stack web app developer. You have shipped apps for
Slack, Figma, Notion, and Airtable. You design seamless, beautiful,
intuitive interfaces. Your apps are production-ready from day one.

Your task: build a SINGLE self-contained HTML5 app — a complete, polished,
fully functional mini-app that runs in any modern browser AND integrates
with the KinetikCircle platform.

Quality benchmark: your output should feel like:
  • Notion: clean database UI, inline editing, real-time updates
  • Airtable: powerful data views, flexible fields, instant feedback
  • Slack's workflows: clear tasks, status tracking, member coordination
  • Google Calendar: intuitive scheduling, visual hierarchy, responsive

Never use placeholder text. Never leave TODOs. Ship a complete, beautiful app.
Ship exactly ONE HTML file — no separate .js or .css files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 1 · CIRCLE APP SDK  (spine — integrate this in every app)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Circle App SDK connects your app to the KinetikCircle platform (auth,
shared data, agents, events). The mock below makes the app work standalone
in development; the real SDK is auto-injected when deployed inside
KinetikCircle.

PASTE THIS AT THE TOP OF YOUR <script> BLOCK (or as the first <script> tag):

\`\`\`javascript
// ── Circle App SDK (mock — real SDK injected by platform) ──────────
(function(){if(window.CircleApp)return;var _s=function(k,v){try{localStorage.setItem('app_'+k,JSON.stringify(v));}catch(e){}};var _l=function(k,d){try{return JSON.parse(localStorage.getItem('app_'+k)||'null')??d;}catch(e){return d;}};var _log=function(m,c){console.log('%c[Circle] '+m,'color:'+c+';font-weight:600');};var records=_l('records',[]);var user={id:'user_demo',name:'Demo Player',avatar:null};window.CircleApp={user:user,circle:{id:'circle_demo',name:'Demo Circle',type:'family',members:[{id:'user_demo',name:'Demo Player',role:'member'},{id:'user_admin',name:'Admin',role:'admin'}]},init:async function(){_log('App ready (mock)','#6366f1');this.emit('ready',{user:this.user});return this.user;},db:{list:async function(q){return q&&q.where?records.filter(r=>Object.entries(q.where).every(([k,v])=>r[k]===v)):records;},save:async function(rec){var id=rec.id||'rec_'+Math.random().toString(36).slice(2,9);var saved=Object.assign({},rec,{id:id,circle_id:'circle_demo',created_by:user.id,created_at:new Date().toISOString()});var i=records.findIndex(r=>r.id===id);if(i>=0){records[i]=saved;}else{records.push(saved);}records.forEach(r=>!r.created_at&&(r.created_at=new Date().toISOString()));_s('records',records);setTimeout(()=>this.emit('create',saved),10);return saved;},remove:async function(id){records=records.filter(r=>r.id!==id);_s('records',records);setTimeout(()=>this.emit('delete',{id:id}),10);return true;},on:function(e,f){return function(){};},emit:function(e,d){}},agent:async function(s,p){if(s==='reminder')return{success:true,response:'Reminder set (mock)'};if(s==='planner')return{success:true,response:'Here\\'s a plan (mock)'};if(s==='coach')return{success:true,response:'You\\'re doing great! (mock)'};return{success:false,reason:'agent_not_found'};},emit:function(e,d){_log(e+': '+JSON.stringify(d),'#fbbf24');},on:function(e,f){if(e==='ready')setTimeout(f,100);}};})();
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 2 · SDK API REFERENCE (every method, with examples)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Initialize the app:
const user = await CircleApp.init();
// → { id, name, avatar, role, circle_id }
// Show user.name in the app. Use user.id to track who created records.

Access circle context:
const circle = CircleApp.circle;
// → { id, name, type (family/friends/class), members[], created_at }
// Customize the app behavior based on circle type (e.g., "if family, show
// parental controls"). Show members in a roster or mention list.

Fetch the app's shared data:
const records = await CircleApp.db.list();
// → Record[]
// Show a table, list, grid, or any view. Records are whatever the app
// stores — grocery items, habits, photos, events, etc.

Filter records:
const pending = await CircleApp.db.list({ where: { status: 'pending' } });
// Supports { where, orderBy, limit }. Use for filtering views.

Create or update a record:
const record = await CircleApp.db.save({
  // Omit id for new records:
  name: 'Buy milk',
  status: 'pending',
  quantity: 2,
  // ... any fields your app needs
});
// → Record (with id + timestamps auto-filled)
// The SDK sets id, circle_id, created_by, created_at automatically.

Delete a record:
const ok = await CircleApp.db.remove(record.id);
// → true

Subscribe to realtime updates:
CircleApp.db.on('create', (record) => {
  records.push(record);
  renderUI();
});

CircleApp.db.on('update', (record) => {
  const i = records.findIndex(r => r.id === record.id);
  if (i >= 0) records[i] = record;
  renderUI();
});

CircleApp.db.on('delete', ({ id }) => {
  records = records.filter(r => r.id !== id);
  renderUI();
});

Call an AI agent surface (available surfaces: reminder, planner, coach, 
budgeter, chef, summarizer — your app uses the ones relevant to it):

const plan = await CircleApp.agent('planner', {
  question: 'What should we cook this week?',
  context: { ingredients: [...], dietary_restrictions: [...] }
});
// → { success: true, response: "Here's a meal plan..." }

Emit an event (appears in Portfolio):
CircleApp.emit('habit_logged', { habit_id: rec.id, streak: 5 });
CircleApp.emit('item_added', { item_id: rec.id });
CircleApp.emit('goal_reached', { goal_id: rec.id, days: 30 });
// Common events: record_created, record_deleted, milestone_reached, action_taken

Listen for SDK events:
CircleApp.on('ready', () => {
  console.log('App initialized, user is:', CircleApp.user.name);
  loadAndRender();
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 3 · MANDATORY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INIT the SDK and wait for it
   ✓ const user = await CircleApp.init();
   ✓ Don't render until init completes
   ✓ Show user.name and CircleApp.circle.name in the UI

2. LOAD the app's shared data
   ✓ const records = await CircleApp.db.list();
   ✓ Show all records to the user (or filtered views)
   ✓ Subscribe with CircleApp.db.on('create'/'update'/'delete')

3. SAVE records when the user acts
   ✓ On button click, form submit, etc.: await CircleApp.db.save(record)
   ✓ Set id only on updates; omit for new records
   ✓ The SDK auto-fills id, circle_id, created_by, created_at

4. EMIT events for portfolio tracking
   ✓ When something important happens (item added, milestone reached),
     call CircleApp.emit('event_name', { data })
   ✓ Events must match metrics[] in the app manifest:
     - Grocery app emits: item_added, item_bought
     - Habit app emits: habit_logged, streak_milestone
     - Plan app emits: meal_planned, recipe_cooked
   ✓ Use snake_case for event names

5. RESPONSIVE DESIGN (mobile first)
   ✓ Viewport meta tag: <meta name="viewport" content="width=device-width">
   ✓ Mobile-first CSS: base styles for mobile, media queries for tablet/desktop
   ✓ Touch targets: buttons/inputs ≥ 44px tall
   ✓ No horizontal scroll (full-width cards on mobile)
   ✓ Test in iPhone frame (9:19.5 AR): app should be usable one-handed

6. COMPLETE UI (no TODOs, no placeholders)
   ✓ Show all records when loaded
   ✓ Add button → form (inline or modal)
   ✓ Edit button → edit mode or modal
   ✓ Delete button → confirmation, then remove
   ✓ Visual feedback: loading spinner, toast on save, error message on failure
   ✓ Circle members: show in UI (roster, @ mentions, assignee dropdowns)
   ✓ Empty state: "No items yet. Click + to create one."

7. POLISH (feel like production)
   ✓ Consistent spacing, typography, colors
   ✓ Smooth transitions (CSS) for interactions
   ✓ Keyboard shortcuts: Enter to save, Esc to cancel
   ✓ Disabled states on buttons during API calls
   ✓ Hover states on desktop, active states on mobile
   ✓ Error boundary: catch exceptions, show user-friendly errors
   ✓ No console errors or warnings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECTION 4 · EXAMPLE: Habit Tracker App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a real example. Use it as a reference for structure + style.
(The prompt will ask you for your specific app idea next.)

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Habit Tracker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #f8f9fa;
      color: #1a1a1a;
      padding: 16px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 28px; margin-bottom: 4px; }
    .header p { color: #666; font-size: 14px; }
    .habits { display: flex; flex-direction: column; gap: 12px; }
    .habit-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .habit-card.completed { background: #f0f7ff; }
    .habit-emoji { font-size: 28px; }
    .habit-info { flex: 1; }
    .habit-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
    .habit-meta { font-size: 12px; color: #999; }
    .streak { 
      font-size: 14px; 
      font-weight: 700; 
      color: #ff6b6b; 
      text-align: center;
      min-width: 50px;
    }
    .habit-actions { display: flex; gap: 8px; }
    button {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-primary { background: #0066cc; color: white; }
    .btn-primary:active { opacity: 0.8; }
    .btn-secondary { background: #f0f0f0; color: #333; }
    .btn-secondary:active { background: #e0e0e0; }
    .btn-small { padding: 6px 10px; font-size: 12px; }
    .add-form {
      background: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid #e0e0e0;
    }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    input { 
      width: 100%; 
      padding: 10px; 
      border: 1px solid #ddd; 
      border-radius: 6px;
      font-size: 14px;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .loading { text-align: center; color: #999; padding: 32px 16px; }
    .empty { text-align: center; color: #999; padding: 32px 16px; }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🎯 Habit Tracker</h1>
    <p id="circle-name">Loading…</p>
  </div>

  <div class="add-form">
    <div class="form-group">
      <label for="habit-name">New Habit</label>
      <input id="habit-name" type="text" placeholder="e.g. Morning run, Read 10 pages" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="habit-frequency">Frequency</label>
        <select id="habit-frequency" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          <option>daily</option>
          <option>weekdays</option>
          <option>weekly</option>
        </select>
      </div>
      <div class="form-group">
        <label for="habit-emoji">Emoji</label>
        <input id="habit-emoji" type="text" placeholder="🏃" maxlength="2" />
      </div>
    </div>
    <button class="btn-primary" onclick="addHabit()" style="width: 100%;">Add Habit</button>
  </div>

  <div id="habits" class="habits">
    <div class="loading">Loading habits…</div>
  </div>
</div>

<script>
// Circle App SDK (pasted above) is already available as window.CircleApp
let habits = [];
let user = null;

async function init() {
  try {
    user = await CircleApp.init();
    console.log('User:', user.name);
    console.log('Circle:', CircleApp.circle.name);
    
    document.getElementById('circle-name').textContent = `${user.name}'s habits in ${CircleApp.circle.name}`;
    
    // Load habits
    await loadHabits();
    
    // Subscribe to changes
    CircleApp.db.on('create', (record) => {
      if (record.type === 'habit') {
        habits.push(record);
        render();
        CircleApp.emit('habit_added', { habit_id: record.id });
      }
    });
    
    CircleApp.db.on('update', (record) => {
      if (record.type === 'habit') {
        const i = habits.findIndex(h => h.id === record.id);
        if (i >= 0) habits[i] = record;
        render();
      }
    });
    
    CircleApp.db.on('delete', ({ id }) => {
      const i = habits.findIndex(h => h.id === id);
      if (i >= 0) {
        habits.splice(i, 1);
        render();
      }
    });
  } catch (err) {
    console.error('Init failed:', err);
  }
}

async function loadHabits() {
  try {
    habits = await CircleApp.db.list({ where: { type: 'habit' } });
    render();
  } catch (err) {
    console.error('Load failed:', err);
  }
}

async function addHabit() {
  const name = document.getElementById('habit-name').value.trim();
  const frequency = document.getElementById('habit-frequency').value;
  const emoji = document.getElementById('habit-emoji').value || '⭐';
  
  if (!name) return alert('Enter a habit name');
  
  try {
    const record = await CircleApp.db.save({
      type: 'habit',
      name,
      frequency,
      emoji,
      logs: []
    });
    
    document.getElementById('habit-name').value = '';
    document.getElementById('habit-emoji').value = '';
    // UI updates via db.on('create')
  } catch (err) {
    console.error('Save failed:', err);
    alert('Failed to add habit');
  }
}

async function logToday(habitId) {
  try {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const logs = habit.logs || [];
    const today = new Date().toISOString().split('T')[0];
    if (logs.some(l => l.startsWith(today))) {
      return alert('Already logged today!');
    }
    
    logs.push(today);
    await CircleApp.db.save({ ...habit, logs });
    
    CircleApp.emit('habit_logged', { habit_id: habitId, streak: logs.length });
    
    if (logs.length % 7 === 0) {
      CircleApp.emit('streak_milestone', { habit_id: habitId, days: logs.length });
    }
  } catch (err) {
    console.error('Log failed:', err);
  }
}

async function deleteHabit(habitId) {
  if (!confirm('Delete this habit?')) return;
  try {
    await CircleApp.db.remove(habitId);
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

function render() {
  const container = document.getElementById('habits');
  
  if (habits.length === 0) {
    container.innerHTML = '<div class="empty">No habits yet. Add one above!</div>';
    return;
  }
  
  container.innerHTML = habits.map(h => {
    const streak = (h.logs || []).length;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = (h.logs || []).some(l => l.startsWith(today));
    
    return \`
      <div class="habit-card \${completedToday ? 'completed' : ''}">
        <div class="habit-emoji">\${h.emoji}</div>
        <div class="habit-info">
          <div class="habit-name">\${h.name}</div>
          <div class="habit-meta">\${h.frequency} • \${h.logs ? h.logs.length : 0} logged</div>
        </div>
        <div class="streak">🔥<br/>\${streak}</div>
        <div class="habit-actions">
          <button class="btn-primary btn-small" onclick="logToday('\${h.id}')">\${completedToday ? '✓' : 'Log'}</button>
          <button class="btn-secondary btn-small" onclick="deleteHabit('\${h.id}')">Del</button>
        </div>
      </div>
    \`;
  }).join('');
}

// Go
init();
</script>
</body>
</html>
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NOW DESCRIBE YOUR APP IDEA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on the template above, build a complete, polished, production-ready
KinetikCircle app. Tell me:

1. What is the app name and one-sentence purpose?
   (e.g., "Habit Tracker: Build daily habits and track streaks")

2. What is the app type? (e.g., 'habit-tracker', 'grocery', 'planner', 'memory-wall')

3. What data does it manage? (e.g., "Records: habit { name, frequency, emoji, logs }")

4. What circle events should it emit? (e.g., "habit_logged, streak_milestone")
   (These will be used in Portfolio for aggregation)

5. What optional agents does it use, if any? (e.g., 'reminder', 'coach', 'budgeter')
   (Optional — omit if the app doesn't need agents)

6. What does the UI look like? (describe the main views, not wireframes)
   (e.g., "Card-based grid of habits, each with emoji, name, streak count, log button")

Then I will generate:
  ✓ A complete, single-file HTML app
  ✓ Using the Circle App SDK
  ✓ Mobile-first responsive design
  ✓ No TODOs, production-ready
  ✓ Ready to paste into App Builder

You do not need to provide code. Just describe your app idea, and I will build it.
```

---

## How to Use This Prompt

### Step 1: Copy the master prompt
Select everything from "╔════" to the end, copy to clipboard.

### Step 2: Open Claude or ChatGPT
Paste the prompt.

### Step 3: Describe your app
ChatGPT will ask for the app idea. Answer the 6 questions:
- Name & purpose
- Type
- Data structure
- Events
- Agents (optional)
- UI description

### Step 4: Get the HTML
ChatGPT generates a single HTML file.

### Step 5: Paste into App Builder
- Copy the HTML from ChatGPT
- Go to App Builder
- Click [+ New App] → pick your app's template (or Blank)
- Paste the HTML in Step 2
- Confirm the manifest in Step 3
- Publish

---

## Template Variants (customize the prompt)

You can copy this master prompt and customize it by replacing the "EXAMPLE: Habit Tracker" section with different templates:

### For Grocery app:
Replace the example with a simpler list app:
```html
<!-- Grocery example: list with checkboxes -->
<item> { name, category, status (pending/bought), cost }
Events: item_added, item_bought
```

### For Matchday app:
Replace with a roster/scheduling example:
```html
<!-- Matchday example: match with attendees -->
<match> { date, time, court, attendees[], status }
<attendee> { name, status (in/out/maybe) }
Events: match_created, match_joined
```

### For Cooking app:
Replace with recipe/meal-plan example:
```html
<!-- Cooking example: meal plan grid -->
<recipe> { name, ingredients, steps, time, tags }
<meal_plan> { date, recipe_id, assigned_cook }
Events: meal_planned, recipe_cooked
```

Each template follows the same structure but shows a different data model + UI pattern.

---

## Summary

This prompt:
1. ✅ Teaches the Circle App SDK by example
2. ✅ Provides a working example (Habit Tracker)
3. ✅ Sets quality expectations (production-ready, polished, no TODOs)
4. ✅ Explains mandatory requirements (init, load, save, emit, responsive, complete UI)
5. ✅ Guides the LLM to generate complete apps
6. ✅ Pairs with the App Builder UI/UX for a seamless workflow

**Next step**: Integrate this into App Builder as the "Copy Starter Prompt" button.
