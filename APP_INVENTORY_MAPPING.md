# App Inventory & Mapping for App Builder
**Date**: 2026-06-23
**Purpose**: Map 9 sample apps → KinetikCircle contexts → specific task-focused features
**Status**: Concept/inventory only — no build yet

---

## The Filter: "Specific task app, not a super app"
Each app solves **one clearly scoped problem** within a circle, not "all the ways a family uses a device." Think:
- ✅ **"Plan our padel matches"** (Matchday)
- ✅ **"Track who bought what groceries this week"** (Grocery)
- ❌ "Manage our entire family life" (too broad)

---

## 1. MATCHDAY — Padel Match Americano Scheduler

### The problem
A group of friends / teammates wants to organize **casual padel matches** in an "americano" format — no fixed teams, rotates everyone in. Who's in? When? What court?

### Audience & Circle Type
- **Audience**: teens, adults (14–50)
- **Circle type**: `friends` (core), `family` (if multi-gen group)
- **Agent surfaces**: reminder (match in 2h?), scheduler (find time with most availability)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Upcoming match** | date, court, time, capacity | Create + edit match; set recurrence |
| **Player roster** | player names, status (in/out/maybe) | Add player; toggle attendance |
| **Match history** | date, attendees, court, rating | View past matches; trending availability |
| **Court availability** | court list (name, location, cost) | Check court schedules (read-only external data?) |
| **Notifications** | match ID, trigger (2h before) | Remind attendees |

### Real-world analog
- **Spond** (sports team scheduling), **Doodle** (when2meet), **Team Snap** (sports rosters)
- Core: "Is everyone free Thursday 7pm?" + match history leaderboard (who shows up)

### Supabase entity
```
match {
  id, circle_id, name, date, time, court, capacity, 
  created_by, created_at, status
}
match_attendee {
  id, match_id, player_id, status (in/out/maybe), checked_in_at
}
```

### Emit events
- `match_created`, `match_joined`, `match_completed` → Portfolio counts "matches organized"

---

## 2. GROCERY — Shared Grocery List & Shopping Tracker

### The problem
A household (parents + kids) needs a **shared shopping list**. Who's buying? What's checked off? What did we actually spend?

### Audience & Circle Type
- **Audience**: parents, kids (8+)
- **Circle type**: `family` (core)
- **Agent surfaces**: budgeter (predict weekly spend), summarizer (what do we buy most?)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Add item** | name, qty, category, priority, cost (optional) | Type or voice → list |
| **Assign shopper** | item ID, assigned_to (parent/kid), status | Mark "Sarah is buying eggs" |
| **Check off** | item ID, bought_at (timestamp), actual_cost | Bought it → update budget |
| **Shopping history** | items, dates, costs, stores | See spending trends (last 4 weeks) |
| **Categories** | produce, dairy, pantry, household (filterable) | Organize + quick-add presets |

### Real-world analog
- **Bring!** (shared list), **Any.do** (shared tasks), **Splitwise** (split expenses)
- Core: "Who's buying what" + cost tracking so parents see spend

### Supabase entity
```
grocery_item {
  id, circle_id, name, qty, category, priority, 
  assigned_to, status (pending/bought), cost, 
  created_at, bought_at
}
grocery_history {
  id, item_id, cost, bought_by, bought_at
}
```

### Emit events
- `item_added`, `item_bought`, `list_cleared` → Portfolio counts "shopping events"

---

## 3. COOKING — Recipe + Meal Planner

### The problem
Family meal planner — **what's for dinner this week?** Who's cooking? What ingredients do we need?

### Audience & Circle Type
- **Audience**: parents, teens (12+)
- **Circle type**: `family` (core), `class` (if a cooking club)
- **Agent surfaces**: planner (suggest meals), chef (ingredient list from recipes)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Weekly meal plan** | day, meal type (breakfast/lunch/dinner), recipe_id | Drag-drop or quick-select recipes |
| **Recipe library** | name, ingredients (qty + unit), steps, time, difficulty | Add from template or URL |
| **Shopping integration** | recipe → extract ingredients → add to grocery list | One-tap "add all ingredients to shopping" |
| **Cooking schedule** | date, recipe, who's cooking, prep time | Assign cook; set kitchen timer reminder |
| **Dietary tags** | vegetarian, gluten-free, nut-free, vegan | Filter recipes |

### Real-world analog
- **Mealime**, **Paprika**, **Yummly** (recipe apps), **Plan to Eat**
- Core: "What's for dinner?" + auto-sync with grocery list

### Supabase entity
```
recipe {
  id, circle_id, name, ingredients (json), steps (json), 
  time_mins, difficulty, tags (json), source_url
}
meal_plan {
  id, circle_id, date, meal_type, recipe_id, assigned_cook
}
```

### Emit events
- `meal_planned`, `recipe_cooked` → Portfolio counts "meals prepped"

---

## 4. CHATBOT — Family AI Assistant

### The problem
A **circle-aware AI sidekick** — answers questions, helps with homework, gives life tips in the context of your circle/family.

### Audience & Circle Type
- **Audience**: kids (8+), teens, parents
- **Circle type**: `family`, `class`, `friends`
- **Agent surface**: IS the agent surface (multi-topic chatbot)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Conversation threads** | user, circle_id, messages (Q&A), timestamp | Chat with the bot; see history |
| **Context awareness** | circle members, circle type, circle data | Bot knows "you're a family of 4" |
| **Topics** | homework, life advice, general Q&A | Route to specialized prompts |
| **Pinned answers** | question, answer, pinned_by | Reuse answers to common questions |
| **Feedback** | message_id, was_helpful (yes/no) | Improve bot over time |

### Real-world analog
- **ChatGPT**, **Claude** (direct chat), **Socratic** (homework help), **Replika** (conversational)
- Core: "Ask the family AI a question" + remember circle context

### Supabase entity
```
chat_thread {
  id, circle_id, created_by, topic, created_at
}
chat_message {
  id, thread_id, author (user or assistant), text, created_at
}
chat_feedback {
  message_id, was_helpful, notes
}
```

### Emit events
- `question_asked`, `homework_answered` → Portfolio counts "interactions"

---

## 5. LIFE COACHING — Goals & Reflection Journal

### The problem
Kids/teens set **personal goals** (learn guitar, read a book, run a 5K), track progress, get nudges. Parents/coaches see & encourage.

### Audience & Circle Type
- **Audience**: teens (12+), parents, educators
- **Circle type**: `family`, `class`
- **Agent surfaces**: coach (suggest milestones), summarizer (monthly reflection)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Goal** | title, category (skill, health, learning), deadline, status | Create; set milestone dates |
| **Progress log** | date, note, progress_pct, mood | Journal an update; track momentum |
| **Milestones** | goal_id, date, description | Break goal into smaller wins |
| **Encouragement** | from_user, to_user, message, date | Parent/peer comment: "You got this!" |
| **Monthly digest** | goal_id, progress_this_month, reflection | Reflect on the month |

### Real-world analog
- **Habitica** (goals + gamification), **Stickk** (commitment), **Journaly** (reflection), **Coach's Eye** (feedback)
- Core: "Track my goal" + "get encouragement from people who care"

### Supabase entity
```
goal {
  id, circle_id, created_by, title, category, deadline, status
}
progress_log {
  id, goal_id, logged_by, note, progress_pct, mood, logged_at
}
milestone {
  id, goal_id, date, title, completed_at
}
encouragement {
  id, goal_id, from_user_id, message, created_at
}
```

### Emit events
- `goal_created`, `goal_completed`, `progress_logged` → Portfolio counts "goals tracked"

---

## 6. DAILY HABIT TRACKER — Habit & Routine Building

### The problem
Kids/families **build positive habits** (brush teeth, read, exercise, drink water). Streak tracking. Parent visibility. Gamified.

### Audience & Circle Type
- **Audience**: kids (6+), teens, parents
- **Circle type**: `family` (core)
- **Agent surfaces**: reminder (time to log habit), coach (celebrate streaks)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Habit** | name, frequency (daily/weekly), category (health, learning, chore), icon | Create a habit to build |
| **Logging** | habit_id, date, completed (yes/no), notes | Check off: "Did I do it today?" |
| **Streaks** | habit_id, current_streak, best_streak, last_done | Visual: 🔥 23-day streak |
| **Leaderboard** | user, longest_streak, habits_active | See family/class streaks |
| **Rewards** | habit_id, reward_on_streak_N (e.g., @30 days) | Optional: unlock a small reward |

### Real-world analog
- **Habitica** (gamified habits), **Streaks** (iOS app), **Done** (habit logger), **1Doc365** (daily reflections)
- Core: "Did I do my habit?" + Streaks + see how the family is doing

### Supabase entity
```
habit {
  id, circle_id, created_by, name, frequency, category, icon
}
habit_log {
  id, habit_id, user_id, date, completed, notes
}
streak {
  habit_id, user_id, current_count, best_count, last_date
}
```

### Emit events
- `habit_logged`, `streak_milestone` (e.g., @7, @30 days) → Portfolio counts "habits tracked"

---

## 7. FAMILY ALBUM — Photo & Memory Sharing

### The problem
A circle-owned **photo gallery** — moments from family outings, holidays, everyday life. Parents upload; kids browse & reminisce. Annotate with memories.

### Audience & Circle Type
- **Audience**: parents, kids (all ages)
- **Circle type**: `family` (core)
- **Agent surfaces**: summarizer (this month's memories), reminiscer (memories from X years ago)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Photo upload** | image (URL), date, caption, uploaded_by | Mom uploads photo from birthday party |
| **Albums** | name, date_range, theme (e.g., "Summer 2025"), cover | Organize by event/season |
| **Memories** | photo_id, date, text, reactions (emoji) | "This is grandma's first time at the beach!" |
| **Timeline view** | chronological, searchable by date/tag | Browse "what we did in June" |
| **Sharing** | circle_id, visibility (circle-only, shareable link) | Send album to grandparents via link |

### Real-world analog
- **Google Photos**, **Artstudio Pro**, **Shared Albums** (Apple), **Notchmeister** (family memories)
- Core: "Our photo timeline" + annotate with memories + timeline search

### Supabase entity
```
album {
  id, circle_id, name, theme, created_at, updated_at
}
photo {
  id, album_id, url, caption, taken_at, uploaded_by, uploaded_at
}
memory {
  id, photo_id, author_id, text, created_at
}
```

### Emit events
- `photo_added`, `album_created`, `memory_logged` → Portfolio counts "moments shared"

---

## 8. TRAVEL PREPARATION — Trip Planning & Packing List

### The problem
Family trip coming up — **what do we pack?** Who's responsible for what? Budget? Itinerary?

### Audience & Circle Type
- **Audience**: parents, teens (10+)
- **Circle type**: `family`
- **Agent surfaces**: planner (itinerary suggestions), budgeter (trip cost)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Trip details** | destination, dates, travelers, budget | Create trip; invite family |
| **Itinerary** | date, time, activity, who's going, notes | Day-by-day plan; link to tickets/reservations |
| **Packing list** | category (clothes, docs, electronics, toiletries), assigned_to | "Sarah: bring passport"; "Leo: pack sleeping bag" |
| **Budget** | item, cost, category (hotel, food, activities), paid_by | Track expenses; split later |
| **Documents** | type (passport, boarding pass, hotel confirmation), link | Upload/link PDFs |

### Real-world analog
- **Wanderlog**, **TripAdvisor**, **Splitwise** (budgets), **Google Trips** (now Maps), **Packpoint** (packing)
- Core: "What do we do? What do we pack? What does it cost?"

### Supabase entity
```
trip {
  id, circle_id, destination, date_start, date_end, budget
}
itinerary {
  id, trip_id, date, time, activity, attendees (json), notes
}
packing_item {
  id, trip_id, category, item, assigned_to, status
}
trip_expense {
  id, trip_id, item, cost, category, paid_by
}
```

### Emit events
- `trip_created`, `trip_started`, `trip_completed` → Portfolio counts "trips planned"

---

## 9. FAMILY BUDGETING — Income + Expenses + Allowance

### The problem
Parents manage **household budget + kids' allowances**. Who earned what? What was spent? Teach financial responsibility.

### Audience & Circle Type
- **Audience**: parents, teens (10+)
- **Circle type**: `family`
- **Agent surfaces**: budgeter (spending analysis), accountant (tax/savings alerts)

### Specific task-focused features
| Feature | Data | Task |
|---|---|---|
| **Income & expenses** | date, category (groceries, utilities, entertainment), amount, from_to | Log spending; categorize |
| **Allowance** | child, frequency (weekly/monthly), amount, earned_vs_given | Track what kids earn vs. pocket money |
| **Savings goal** | name, target_amount, current_amount | "Save for a bike" |
| **Spending insights** | category, total_this_month, budget_limit, alerts | "You've spent 80% of your grocery budget" |
| **Transactions** | date, description, amount, category, approved_by | Audit trail; require approval for large spends |

### Real-world analog
- **YNAB** (You Need A Budget), **Mint** (now Copilot), **Chime** (family accounts), **Teen credit cards** (Greenlight, Current)
- Core: "What did we spend?" + "What's the kid's allowance?" + alerts

### Supabase entity
```
budget {
  id, circle_id, category, limit_amount, year_month
}
transaction {
  id, circle_id, date, category, amount, from_user, to_user, description, approved_by
}
allowance {
  id, circle_id, child_id, frequency, amount, last_paid_date
}
savings_goal {
  id, circle_id, created_by, name, target_amount, current_amount, deadline
}
```

### Emit events
- `transaction_logged`, `allowance_paid`, `goal_reached` → Portfolio counts "financial events"

---

## Mapping Summary Table

| App | Core Task | Audience | Circle Type | Entity Count | Emit Events | Real-world Analog |
|---|---|---|---|---|---|---|
| **Matchday** | Schedule padel matches | Teens/adults | friends, family | 2 | match_created, match_joined | Spond, Doodle, TeamSnap |
| **Grocery** | Shared shopping list + spending | Parents, kids | family | 2 | item_added, item_bought | Bring!, Any.do, Splitwise |
| **Cooking** | Meal plan + recipe sync | Parents, teens | family, class | 2 | meal_planned, recipe_cooked | Mealime, Paprika, Plan to Eat |
| **Chatbot** | Circle-aware AI Q&A | Kids, teens, parents | family, class, friends | 3 | question_asked, homework_answered | ChatGPT, Socratic, Replika |
| **Life Coaching** | Goal tracking + progress journal | Teens, parents, educators | family, class | 4 | goal_created, goal_completed, progress_logged | Habitica, Stickk, Coach's Eye |
| **Daily Habits** | Habit + streak tracking | Kids, teens, parents | family | 3 | habit_logged, streak_milestone | Habitica, Streaks, Done |
| **Family Album** | Photo timeline + memory sharing | Parents, kids (all ages) | family | 3 | photo_added, album_created, memory_logged | Google Photos, Apple Shared Albums |
| **Travel Prep** | Trip planning + packing + budget | Parents, teens | family | 4 | trip_created, trip_started, trip_completed | Wanderlog, Packpoint, Splitwise |
| **Family Budget** | Household budget + allowance | Parents, teens | family | 4 | transaction_logged, allowance_paid, goal_reached | YNAB, Mint, Greenlight |

---

## Scope Assessment: Are These "Specific Task Apps"?

| App | Scope | Why It Works |
|---|---|---|
| Matchday | ✅ Tight | "Schedule one type of activity" + roster |
| Grocery | ✅ Tight | "Shared list" + "track what you bought" — two linked tasks |
| Cooking | ✅ Tight | "Meal plan for the week" + "export to grocery list" |
| Chatbot | ✅ Tight | "Ask the family AI" — one task, one feature set |
| Life Coaching | ⚠️ Medium | Three tasks (set goal, log progress, get feedback), but all toward one outcome |
| Daily Habits | ✅ Tight | "Build a habit" + "track streaks" — focused |
| Family Album | ✅ Tight | "Share photos" + "add memories" — photo-centric |
| Travel Prep | ⚠️ Medium | Four sub-tasks (itinerary, packing, budget, docs), but all serve one trip |
| Family Budget | ⚠️ Medium | Income, expenses, allowance, savings — three related but distinct sub-tasks |

**Tightest scope**: Matchday, Grocery, Cooking, Chatbot, Daily Habits, Family Album

**Medium complexity but still focused**: Life Coaching, Travel Prep, Family Budget (can be simplified later if needed)

---

## Next Step (When We Design)

Pick **2–3 apps to design first** (recommend starting with Tight scope):
1. **Grocery** or **Matchday** — familiar forms (list, roster), low schema complexity
2. **Daily Habits** — visual streak gamification, good for onboarding
3. **Family Album** — image-first, memory-centric, different UX pattern

Then build the **Circle App SDK** + **App Starter Prompt** in parallel, so all 9 apps can reuse the same spine.

