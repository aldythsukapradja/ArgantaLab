# F3 · Question Map — 72 natural parent questions

**Purpose:** the router's ground truth, the starter-card source, and O7's battle-test script.
Columns: question (as a parent actually says it) → intent → tier → component (F2 id) →
data → refine chips. Tier 0 routes everything; **T1** = cheapest capable answers it;
**T2** = silent escalation allowed for planning/long-form only. Phrasings feed the family
chart registry's `terms` vocabulary (F2).

## A · Calendar & the week (the daily habit)
| # | Question | Component | Data | Chips |
|---|---|---|---|---|
| 1 | What's on today? | `day.agenda` | kinetik_events + routines | Tomorrow · This week |
| 2 | What's happening this week? | `week.strip` | same | Next week · Just weekends |
| 3 | What's on tomorrow? | `day.agenda` | same | Rest of week |
| 4 | Do we have anything this weekend? | `week.strip` (Sat–Sun) | same | Add something? *(v1.1)* |
| 5 | When is [kid]'s swim/practice? | `day.agenda` filtered | events | This month |
| 6 | What's our busiest day this week? | `chart.family:busiest-day` | events/day calc §C1 | This month |
| 7 | When are we all free? | `answer.text` + `week.strip` | free-time calc §C2 | Evenings only |
| 8 | What routines are due today? | `day.agenda` (routines) | kinetik_routines | This week |
| 9 | Did we miss anything yesterday? | `answer.text` | events past + routines | This week |
| 10 | What's coming up next month? | `week.strip` ×4 | events | Just birthdays |
| 11 | When is the next school holiday? | `answer.text` | events (holiday tag) | Plan a trip → T2 |
| 12 | Remind me what Saturdays look like | `chart.family:showing-up` | events heatmap | |

## B · Kids' learning (the heart)
| # | Question | Component | Data | Chips |
|---|---|---|---|---|
| 13 | How is [kid] doing? | `kid.progress` | rings + item_attempts | This month · Compare kids |
| 14 | How are the kids doing this week? | `kid.compare` | same | Each kid |
| 15 | Is [kid] keeping the streak? | `kid.progress` (streak) | streak calc §C3 | All streaks |
| 16 | What is [kid] best at? | `answer.text` + `chart.family:activity-mix` | favourites calc §C4 | Weakest too |
| 17 | Where is [kid] struggling? | `answer.text` | weakness calc §C5 | How to help → T2 |
| 18 | How much did [kid] practice today? | `kid.progress` | item_attempts (NOT diamond_ledger) | This week |
| 19 | Which kid practiced most this week? | `kid.compare` | item_attempts | Last week |
| 20 | Show practice over the last month | `chart.family:practice-week` | item_attempts/day | Per kid |
| 21 | When does [kid] usually practice? | `chart.family:showing-up` | attempts heatmap | |
| 22 | How many diamonds does [kid] have? | `answer.text` | diamond_ledger balance | Where from? |
| 23 | Where did the diamonds go? | `chart.family:spend-by-category` (diamond variant) | diamond_ledger | |
| 24 | Is [kid] improving? | `answer.text` + `chart.family:practice-week` | trend calc §C6 | Per subject |
| 25 | What should [kid] work on next? | `answer.text` | weakness calc → T2 phrasing | Make it fun → story |
| 26 | Did anyone practice today? | `kid.compare` | item_attempts today | |

## C · Meals & groceries
27 What's for dinner? → `meals.week` (today tile) · 28 What are we eating this week? →
`meals.week` · 29 What's in the grocery basket? → `answer.text` list (grocery_basket) ·
30 When's the next grocery run? → `answer.text` (grocery_run) · 31 Give me a recipe for X →
`recipe.card` (kinetik_recipe first, T1 generation fallback, labeled "not from your book") ·
32 What can I cook with what we have? → T2 + `recipe.card` · 33 Ideas for [kid]'s lunchbox →
T1 `answer.text` · 34 Plan next week's dinners → T2 + `meals.week` draft *(read-only draft;
saving is v1.1)*

## D · Money (calm, never judgy)
35 How's the budget this month? → `budget.pulse` (vault_budget/expense) · 36 What did we
spend on groceries? → `budget.pulse` filtered · 37 Biggest expense this month? →
`answer.text` · 38 What subscriptions are we paying for? → `answer.text` list (vault_sub) ·
39 Spend by category → `chart.family:spend-by-category` · 40 Are we over budget? →
`budget.pulse` · 41 How much did the trip cost? → `trip.card` (trip_expense)

## E · Trips & memories
42 When's our next trip? → `trip.card` · 43 What's planned for [trip]? → `trip.card`
activities · 44 What should we pack? → `answer.text` (pack_item) + T1 suggestions ·
45 Show me recent moments → `moment.card` · 46 What did we do last weekend? →
`moment.card` + events recap · 47 Plan a day out this weekend → T2 · 48 Ideas for
[kid]'s birthday → T2

## F · Stories & fun (the wow for kids-via-parents)
49 Tell a bedtime story → `story.card` (T1) — chips: Shorter · Scarier · About dragons ·
50 A story with [kid] as the hero → `story.card` (uses kid name only, no other PII in
prompt) · 51 A story to teach [kid] about sharing → `story.card` · 52 A joke for the
breakfast table → `answer.text` · 53 A riddle for the car → `answer.text` ·
54 Quiz us about animals → `answer.text` (5 Q&A) · 55 Continue last night's story →
`story.card` (thread memory)

## G · Everyday help (generic T1 — the ChatGPT floor)
56 Write a note to the teacher → T1 text · 57 Translate this for grandma → T1 ·
58 Explain [topic] so a 7-year-old gets it → T1 · 59 Help me word a tricky message → T1 ·
60 What's a good screen-time rule? → T1 (advice framing, no citations theater) ·
61 Settle a debate: … → T1 · 62 Summarize this school letter (pasted) → T1

## H · The Pulse & meta
63 *(Pulse tap)* today+streak+next-thing composite → `day.agenda`+`kid.progress` ·
64 What can you do? → `answer.text` capability tour + starter cards re-shown (F4 §4) ·
65 Is my data private? → `answer.text` (F4 §8) · 66 Delete this chat → drawer action ·
67–72 held for v1.1 write-actions (add event, add grocery item, set reminder, save meal
plan, share to Moments, invite partner) — **router must recognize these and answer with
the honest not-yet card (F4 §5), never pretend.**

## Calculations (specified against real schema)
- **C1 busiest day:** count(kinetik_events where circle + date in range, group by weekday) +
  routine instances; tie → earliest weekday. Label answer "by number of things on".
- **C2 free time:** invert C1's event blocks over waking hours (07–21) shared by all
  members; report largest common gaps ≥2h. v1: whole-family only.
- **C3 streak:** consecutive days ending today with ≥1 `item_attempts` row for that kid
  (cloud rings `todayWorldXp` for today's partial). Timezone = circle tz. **Attempts,
  not diamonds** — a spend/gift day must not fake a practice day.
- **C4 favourite:** world/subject with max attempts over 30d; report share ("mostly math —
  6 of every 10 practices").
- **C5 weakness:** lowest correct-rate among worlds with ≥20 attempts/30d (floor avoids
  crowning a 1-attempt "weakness"); phrase as opportunity, never failure (F4 §3).
- **C6 improving:** correct-rate this 14d vs prior 14d, same world; ±3pts = "steady".

**Battle-test protocol (O7):** run all 72 verbatim + 2 paraphrases each (216 turns) against
the live router; log component-selection accuracy (target ≥95%, misses → picker not wrong
card), tier distribution (T2 ≤10% of turns), cost/turn, p50 latency. Fix top 5 failures,
rerun. The map is frozen after that run.
