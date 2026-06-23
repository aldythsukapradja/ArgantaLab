/**
 * App Builder Templates
 *
 * Each template pre-seeds:
 * - A starter prompt (LLM context)
 * - Default manifest values (audience, metrics, agents)
 * - A demo name & description
 *
 * To add a 10th template: just copy-paste and edit the fields.
 */

import { CIRCLE_APP_STARTER_PROMPT } from './circleAppPrompt'

export interface AppTemplate {
  id: string
  name: string
  emoji: string
  description: string
  category?: string
  prompt: string
  defaultManifest: {
    category: string
    audience: string[]
    circle_types: string[]
    suggested_metrics: string[]
    suggested_agents: string[]
  }
}

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'grocery',
    name: 'Grocery',
    emoji: '🛒',
    description: 'Shared shopping list + spending tracker',
    category: 'organization',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Grocery List App

Build a grocery shopping list app with:
- Add items (name, qty, category, priority)
- Assign shopper (who's buying)
- Check off items when bought
- Track spending by category
- Show spending history (last 4 weeks)
- Category filters (produce, dairy, pantry, household)

Data: items { name, qty, category, priority, assigned_to, status, cost, bought_at }
Events to emit: item_added, item_bought, list_cleared
Optional agent: budgeter (spending analysis)

Style: Clean list UI, simple checkboxes, color-coded by category.
Mobile-first: Single column, touch-friendly.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'grocery',
      audience: ['parents', 'kids'],
      circle_types: ['family'],
      suggested_metrics: ['item_added', 'item_bought', 'list_cleared'],
      suggested_agents: ['budgeter'],
    },
  },

  {
    id: 'matchday',
    name: 'Matchday',
    emoji: '🏸',
    description: 'Padel match scheduling + roster turnout',
    category: 'sports',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Matchday (Padel Match Scheduler)

Build a match scheduler for padel matches (americano format) with:
- Create match (date, time, court, capacity)
- Add players to match (in/out/maybe status)
- Show match roster with attendance
- Match history (past matches, who attended)
- Notifications reminder (2h before)

Data: match { date, time, court, capacity, status }
      attendee { match_id, player_id, status (in/out/maybe), checked_in_at }
Events to emit: match_created, match_joined, match_completed
Optional agent: reminder (match starting soon)

Style: Card-based match list, attendance toggle buttons, visual status.
Mobile-first: Tap to RSVP, see who's in/out instantly.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'sports',
      audience: ['teens', 'adults'],
      circle_types: ['friends', 'family'],
      suggested_metrics: ['match_created', 'match_joined', 'match_completed'],
      suggested_agents: ['reminder'],
    },
  },

  {
    id: 'cooking',
    name: 'Cooking',
    emoji: '🍳',
    description: 'Weekly meal plan + recipe sync',
    category: 'planning',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Cooking / Meal Planner

Build a meal planning app with:
- Weekly meal plan (pick recipes for each day)
- Recipe library (name, ingredients, steps, time, difficulty)
- Auto-export ingredients to a shopping list
- Assign cook (who's cooking tonight)
- Dietary tags (vegetarian, gluten-free, vegan, nut-free)
- Cooking schedule with prep time

Data: recipe { name, ingredients[], steps[], time_mins, difficulty, tags[] }
      meal_plan { date, meal_type (breakfast/lunch/dinner), recipe_id, assigned_cook }
Events to emit: meal_planned, recipe_cooked, ingredients_exported
Optional agent: chef (recipe suggestions based on available ingredients)

Style: Calendar week view, recipe cards with emoji, ingredient checkmarks.
Mobile-first: Swipe between days, tap to add recipe.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'planning',
      audience: ['parents', 'teens'],
      circle_types: ['family', 'class'],
      suggested_metrics: ['meal_planned', 'recipe_cooked', 'ingredients_exported'],
      suggested_agents: ['chef', 'planner'],
    },
  },

  {
    id: 'habits',
    name: 'Daily Habits',
    emoji: '✅',
    description: 'Habit + streak tracking with gamification',
    category: 'tracking',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Daily Habit Tracker

Build a habit tracking app with:
- Create habits (name, frequency daily/weekly, emoji, category)
- Log daily completion (tap to check off)
- Streak counter (🔥 X days)
- Best streak tracking
- Leaderboard (who has the longest streaks)
- Habit history (view past logs)
- Categories (health, learning, chores, social)

Data: habit { name, frequency, emoji, category }
      habit_log { habit_id, user_id, date, completed, notes }
      streak { habit_id, user_id, current_count, best_count, last_date }
Events to emit: habit_logged, streak_milestone (at 7, 30, 100 days)
Optional agent: coach (encouragement on milestones)

Style: Card-based habits, large streaks, celebration on milestone.
Mobile-first: One-tap logging, see streaks at a glance.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'tracking',
      audience: ['kids', 'teens', 'parents'],
      circle_types: ['family'],
      suggested_metrics: ['habit_logged', 'streak_milestone'],
      suggested_agents: ['coach', 'reminder'],
    },
  },

  {
    id: 'family-album',
    name: 'Family Album',
    emoji: '📸',
    description: 'Photo timeline + shared memories',
    category: 'social',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Family Photo Album

Build a shared photo album app with:
- Upload photos (with caption, date)
- Organize into albums (summer 2025, holidays, etc.)
- Add memories to photos (annotations, stories)
- Timeline view (chronological, searchable by date/tag)
- Reactions to memories (emoji)
- Who's in the photo (tag family members)

Data: album { name, theme, date_range, cover_photo_id }
      photo { url, caption, taken_at, uploaded_by, uploaded_at }
      memory { photo_id, author_id, text, created_at }
Events to emit: photo_added, album_created, memory_logged
Optional agent: summarizer (monthly photo recap)

Style: Grid photo view, modal for full photo + memories, memory cards.
Mobile-first: Vertical scroll, tap to add memory, emoji reactions.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'social',
      audience: ['parents', 'kids'],
      circle_types: ['family'],
      suggested_metrics: ['photo_added', 'album_created', 'memory_logged'],
      suggested_agents: ['summarizer'],
    },
  },

  {
    id: 'life-coaching',
    name: 'Life Coaching',
    emoji: '🎯',
    description: 'Goals + progress journal + encouragement',
    category: 'personal-growth',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Life Coaching / Goal Tracker

Build a goal-tracking app with:
- Set goals (title, category, deadline, description)
- Break into milestones (smaller steps toward goal)
- Progress journal (log updates, notes, mood)
- Encouragement from circle (parents/peers comment)
- Monthly reflection (review progress, celebrate wins)
- Goal categories (skill, health, learning, social)

Data: goal { title, category, deadline, status, description }
      milestone { goal_id, date, title, completed_at }
      progress_log { goal_id, logged_by, note, progress_pct, mood, logged_at }
      encouragement { goal_id, from_user, message, created_at }
Events to emit: goal_created, goal_completed, progress_logged, milestone_reached
Optional agent: coach (milestone suggestions, encouragement)

Style: Goal cards with progress bar, milestone checklist, journal entry form.
Mobile-first: Tap to log progress, see encouragement feed.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'personal-growth',
      audience: ['teens', 'parents', 'educators'],
      circle_types: ['family', 'class'],
      suggested_metrics: ['goal_created', 'goal_completed', 'progress_logged', 'milestone_reached'],
      suggested_agents: ['coach', 'planner'],
    },
  },

  {
    id: 'chatbot',
    name: 'Chatbot',
    emoji: '💬',
    description: 'Circle-aware AI assistant',
    category: 'ai',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Family Chatbot / AI Assistant

Build a circle-aware chatbot with:
- Chat threads (conversations with the AI)
- Topic routing (homework, life advice, general Q&A)
- Context awareness (knows circle name, members, circle type)
- Save & revisit conversations
- Pinned answers (reuse common Q&As)
- Feedback on responses (was this helpful?)

Data: chat_thread { circle_id, created_by, topic, created_at }
      chat_message { thread_id, author (user or 'assistant'), text, created_at }
      chat_feedback { message_id, was_helpful (yes/no), notes }
Events to emit: question_asked, topic_routed, feedback_logged
Agent: IS the agent surface (the app IS a chatbot)

Style: Message list (chat UI), input field, topic selector, feedback buttons.
Mobile-first: Vertical chat, tap to send, show feedback inline.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'ai',
      audience: ['kids', 'teens', 'parents', 'educators'],
      circle_types: ['family', 'class', 'friends'],
      suggested_metrics: ['question_asked', 'topic_routed', 'feedback_logged'],
      suggested_agents: [],
    },
  },

  {
    id: 'travel-prep',
    name: 'Travel Prep',
    emoji: '✈️',
    description: 'Trip planning + packing + budget',
    category: 'planning',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Travel Preparation Planner

Build a trip planning app with:
- Trip details (destination, dates, travelers, budget)
- Day-by-day itinerary (activities, times, who's going)
- Packing list (items, categories, assigned to who)
- Trip budget (track expenses, split costs)
- Important documents (links to boarding passes, confirmations)
- Checklist (what to do before leaving)

Data: trip { destination, date_start, date_end, travelers[], budget }
      itinerary { trip_id, date, time, activity, attendees[], notes }
      packing_item { trip_id, category, item, assigned_to, status }
      trip_expense { trip_id, item, cost, category, paid_by }
Events to emit: trip_created, trip_started, trip_completed, packing_item_packed
Optional agent: planner (itinerary suggestions), budgeter (spending analysis)

Style: Tab view (itinerary, packing, budget), checklist cards, expense tracker.
Mobile-first: Swipe between tabs, tap to pack items, add expenses inline.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'planning',
      audience: ['parents', 'teens'],
      circle_types: ['family'],
      suggested_metrics: ['trip_created', 'trip_started', 'trip_completed', 'packing_item_packed'],
      suggested_agents: ['planner', 'budgeter'],
    },
  },

  {
    id: 'family-budget',
    name: 'Family Budget',
    emoji: '💰',
    description: 'Household income/expenses + allowance',
    category: 'financial',
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Family Budget & Allowance Tracker

Build a budget tracking app with:
- Track income & expenses (date, category, amount, from/to who)
- Categorize spending (groceries, utilities, entertainment, etc.)
- Set monthly budgets per category
- Allowance tracking (weekly/monthly payments to kids)
- Savings goals (save for a bike, vacation, etc.)
- Monthly spending insights (pie chart, trends)
- Transaction approval flow (require approval for large spends)

Data: budget { category, limit_amount, year_month }
      transaction { date, category, amount, from_user, to_user, description, approved_by }
      allowance { child_id, frequency, amount, last_paid_date }
      savings_goal { created_by, name, target_amount, current_amount, deadline }
Events to emit: transaction_logged, allowance_paid, goal_reached, budget_alert
Optional agent: budgeter (spending analysis), accountant (financial tips)

Style: Dashboard with balance, pie chart of spending, transaction list, goals progress.
Mobile-first: Add transaction form, swipe through categories, see allowance balance.
Complete, polished, no TODOs.
`,
    defaultManifest: {
      category: 'financial',
      audience: ['parents', 'teens'],
      circle_types: ['family'],
      suggested_metrics: ['transaction_logged', 'allowance_paid', 'goal_reached', 'budget_alert'],
      suggested_agents: ['budgeter'],
    },
  },

  {
    id: 'blank',
    name: 'Blank',
    emoji: '➕',
    description: 'Start from scratch',
    category: undefined,
    prompt: `${CIRCLE_APP_STARTER_PROMPT}

TEMPLATE: Blank / Custom App

You're building a custom app from scratch. Use the Circle App SDK (documented above).

Describe what your app does:
1. What is the app's main purpose? (e.g., "Track who's home this week")
2. What data does it manage? (e.g., { date, member_id, location, notes })
3. What events should it emit? (e.g., location_updated, home_time_logged)
4. What circle agent surfaces does it use, if any? (e.g., reminder, planner)
5. What does the UI look like? (describe the main views and interactions)

Build a complete, single-file HTML app.
Use the Circle App SDK shown above.
Mobile-first, responsive design.
No TODOs, production-ready.
`,
    defaultManifest: {
      category: 'custom',
      audience: ['kids', 'teens', 'parents', 'educators'],
      circle_types: ['family', 'class', 'friends'],
      suggested_metrics: [],
      suggested_agents: [],
    },
  },
]

export function getTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find(t => t.id === id)
}
