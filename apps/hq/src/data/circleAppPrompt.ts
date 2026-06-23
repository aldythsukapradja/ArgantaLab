/**
 * Circle App Starter Prompt
 *
 * Copy-paste this into Claude/ChatGPT to generate a KinetikCircle app.
 * The templates in appTemplates.ts append their specific instructions to this.
 */

export const CIRCLE_APP_STARTER_PROMPT = `╔══════════════════════════════════════════════════════════════════════╗
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
(function(){if(window.CircleApp)return;var _s=function(k,v){try{localStorage.setItem('app_'+k,JSON.stringify(v));}catch(e){}};var _l=function(k,d){try{return JSON.parse(localStorage.getItem('app_'+k)||'null')??d;}catch(e){return d;}};var _log=function(m,c){console.log('%c[Circle App] '+m,'color:'+c+';font-weight:600');};var records=_l('records',[]);var user={id:'user_demo',name:'Demo Player',avatar:null,role:'member',circle_id:'circle_demo'};window.CircleApp={user:user,circle:{id:'circle_demo',name:'Demo Circle',type:'family',members:[{id:'user_demo',name:'Demo Player',avatar:null,kind:'child',role:'member'},{id:'user_admin',name:'Admin',avatar:null,kind:'parent',role:'admin'}]},init:async function(){_log('App ready (mock)','#6366f1');this.emit('ready',{user:this.user});return this.user;},db:{list:async function(q){var result=records;if(q&&q.where){result=result.filter(r=>Object.entries(q.where).every(([k,v])=>r[k]===v));}if(q&&q.limit){result=result.slice(0,q.limit);}return result;},save:async function(rec){var id=rec.id||'rec_'+Math.random().toString(36).slice(2,9);var saved=Object.assign({},rec,{id:id,circle_id:this.circle.id,created_by:user.id,created_at:new Date().toISOString()});var i=records.findIndex(r=>r.id===id);if(i>=0){records[i]=saved;}else{records.push(saved);}_s('records',records);setTimeout(()=>{if(this.emit)this.emit('create',saved);},10);return saved;},remove:async function(id){records=records.filter(r=>r.id!==id);_s('records',records);setTimeout(()=>{if(this.emit)this.emit('delete',{id:id});},10);return true;},on:function(e,f){return function(){};},emit:function(e,d){}},agent:async function(s,p){if(s==='reminder')return{success:true,response:'Reminder set (mock)'};if(s==='planner')return{success:true,response:'Here\\'s a plan (mock)'};if(s==='coach')return{success:true,response:'You\\'re doing great! (mock)'};if(s==='budgeter')return{success:true,response:'Budget summary (mock)'};if(s==='chef')return{success:true,response:'Recipe suggestion (mock)'};if(s==='summarizer')return{success:true,response:'Summary (mock)'};return{success:false,reason:'agent_not_found'};},emit:function(e,d){_log(e+': '+JSON.stringify(d),'#fbbf24');},on:function(e,f){if(e==='ready')setTimeout(f,100);}};})();
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
// → { id, name, type (family/class/friends), members[], created_at }
// Customize the app behavior based on circle type. Show members in a roster or mention list.

Fetch the app's shared data:
const records = await CircleApp.db.list();
// → Record[]
// Show a table, list, grid, or any view. Records are whatever the app stores.

Filter records:
const pending = await CircleApp.db.list({ where: { status: 'pending' } });
// Supports { where, orderBy, limit }. Use for filtering views.

Create or update a record:
const record = await CircleApp.db.save({
  // Omit id for new records:
  name: 'Task name',
  status: 'pending',
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

Call an AI agent surface:
const result = await CircleApp.agent('planner', {
  question: 'What should we cook this week?',
  context: { ingredients: [...] }
});
// → { success: true, response: "Here's a meal plan..." }

Emit an event (appears in Portfolio):
CircleApp.emit('task_added', { task_id: rec.id });
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

Ready to build? Describe your app idea using the template instructions above.
I will generate a complete, single-file HTML app with the Circle App SDK baked in.
`
