# Circle HQ — COMMAND Build Audit Trail

> Living checklist for the **Command** tab (org lobby + six offices) built on one product ontology.
> Golden rule: *deterministic first, LLM-ready. Every number shows its source. Nothing fake renders as real.*
> Status: ☐ not started · ◐ designed (planned, unbuilt) · ☑ built & passing
> Provenance: 🟢 live · 🟡 partial · 🌱 live-seeded→simulated · ⚙️ simulated · 🔴 placeholder

---

## 0. Locked decisions

| Decision | Locked value |
|---|---|
| Scope | Full build P0–P5 |
| Placement | **Command** = its own rail group **between Analytics and Build** (not the spec's top-of-rail default) |
| Command tab shape | 1 tab → sub-tab bar: **Lobby + Bridge + Operations + Technology + Treasury + Legal + The Guild** |
| Office rename | **Roster → The Guild** (Guildmaster); internal `id:'roster'` kept stable |
| Currency | Diamonds only (Argon folded into diamonds) |
| Revenue | **Simulated**; subscription is the real-money stream; paying parent gets **10k 💎/mo** perk (a mint, not cash) |
| Cases | Low / Mid / High kept as-is — **Low stays structurally unprofitable** (honest failure case) |
| Discount | Folded into **annual (2 months free ~17%)** + **seasonal** (Eid/Christmas/Summer/Back-to-school); no $0.99 intro |
| Popup style | **Right-side drawer on desktop; full-page + X on mobile** |
| Agent tab | **Command = single source of truth** (operating view). Build-group Agent Builder → **authoring-only** (create/edit agents; persists to `agent_def`) |
| Profitability | A **shared constraint** every chief obeys via `sig.unit_economics` + LADDERS_TO teeth |

---

## 1. The 61 surfaces → office ownership (coverage check)

Every product surface is owned by exactly one office. **Operations** owns the bulk (all `app/tab/subtab/component`); **Technology** owns `event/signal/metric/architecture`; **Treasury** owns economy/ledger/revenue; **Legal** owns UGC/consent risk; **Bridge** owns northstar/command. **The Guild** owns the *agent org* (not the 61 product surfaces).

### ArgantaLab (`app.arganta`)
| Surface | Owner · lever | Prov. |
|---|---|---|
| `arganta.home` | ops · efficiency | 🔴 |
| `kinworld` | ops · depth | 🟡 |
| `quests` | ops · frequency | 🟢 |
| `fame` | ops · frequency | 🟢 |
| `sig.impossible_score` | technology · guardrail | 🟡 |
| `learn.hub` | ops · efficiency | 🟡 |
| `learn.num/wrd/won/log/wld/lif` (6 worlds) | ops · depth | 🟢 |
| `learn.journey/drill/item/worldhub` | ops · depth | 🟢 |
| `sig.item_overexposed` | technology · guardrail | 🟡 |
| `sig.difficulty_mismatch` | technology · guardrail | 🟡 |
| `sig.dead_end_quit` | technology · guardrail | 🔴 |
| `sig.streak_broken` | technology · guardrail | 🟡 |
| `build.wizard/lab/pitch` | ops · depth | 🟡 |
| `sig.build_abandoned/build_error` | technology · guardrail | 🔴 |
| `ship.discover` | ops · breadth | 🔴 |
| `ship.library/gamestore` | ops · breadth | 🟡 |
| `sig.broken_share_link` | technology · guardrail | 🔴 |
| `you.profile/pulse` | ops · frequency | 🟡 |
| `you.avatar/shop/mount` | treasury · revenue | 🟢 (💎) / 🔴 (real $) |
| `sig.paywall_bounce` | treasury · guardrail | 🔴 |

### KinetikCircle (`app.kinetik`)
| Surface | Owner · lever | Prov. |
|---|---|---|
| `kin.today/calendar` | ops · frequency | 🟢 |
| `sig.calendar_open_no_add` | technology · guardrail | 🔴 |
| `kin.moments` | ops · depth→expansion | 🟢 |
| `sig.ugc_flagged` | **legal** · guardrail | 🔴 |
| `kin.apps` (hub) | ops · depth | 🟢 |
| `kin.travel/padel/kitchen/vault` | ops · depth | 🟢 |
| `kin.me` | ops | 🟡 |
| `kin.circles/connections/friends` | ops · breadth | 🟢 |
| `sig.invite_never_accepted` | ops · breadth guardrail | 🟡 |

### Circle HQ (`app.hq`)
| Surface | Owner | Prov. |
|---|---|---|
| `hq.command/bridge/operations/technology/treasury/legal/roster` | self (each office) | 🟢/🔴 |
| `hq.portfolio/analytics/growth/data.*/agents/content/broadcast` | existing surfaces | 🟢 |
| `hq.monetization` | treasury | ⚙️ |
| `hq.build.game/app/learn/agent/content` | technology | 🟡 |
| `arch.supabase/vercel/spine/sdk`, `scale.model` | technology | ⚙️/config |
| `ledger.actual` | treasury | 🟢 |
| `treasury.growthlab` | treasury | ⚙️ |

### Landing (`app.landing`)
| Surface | Owner · lever | Prov. |
|---|---|---|
| `land.home/products/about/pitch` | ops/brand · breadth | 🔴 |
| `land.deck.editorial/general/onepager` | ops/brand | 🔴 |
| `sig.deck_no_waitlist` | ops · guardrail | 🔴 |

**Coverage result: ✅ every surface + guardrail signal has exactly one owning office.** The Guild owns agents (a separate node kind), correctly not part of the 61.

---

## 2. Data gap map (provenance by domain)

| Domain | Real source | Prov. |
|---|---|---|
| Learning engagement | `learn_event`, `item_attempts` | 🟢 |
| Mastery & rings | `world_progress`, `skill_mastery`, `kid_today_rings()`, `kid_world_rings()`, `node_progress` | 🟢 |
| Diamond economy | `diamond_ledger`, `hq_economy()` | 🟢 |
| Family / identity / invites | `circles`, `circle_members`, `guardianships`, `circle_invites`, `friendships`, `hq_family_stats()` | 🟢 |
| Kinetik calendar + social | `kinetik_events/routines/moments/post/reaction/broadcast`, `hq_kinetik_stats()` | 🟢 |
| Creation & play | `games`, `hq_app`, `artifact_telemetry`, `artifact_analytics` | 🟡 |
| **North Star (W2F)** | derivable: `learn_event` × `kinetik_*` × `guardianships` | 🟡→🟢 |
| Household D30/D90 | `hq_retention()` (learner-based; needs household regroup) | 🟡 |
| k-factor | `circle_invites`, `friendships` | 🟡→🟢 |
| **Per-surface feature views** | `hq_event` sink exists but **nothing writes/reads it** | 🔴 (#1 gap) |
| Real revenue | none (`monetization.ts` is a forecast) | ⚙️ |
| Landing / share-attribution / agent-ops / legal | none | 🔴 |

**Reuse decision:** the spec's proposed `product_event` = **don't build it; activate the existing `hq_event`** (already has `product/app_id/type/tab_id/feature_id/person_ref/circle_ref/payload`).

**SQL to write (prioritized):**
- P0: `w2f_weekly()` (the North Star), `curr_states()`, `k_factor()`, household D30/D90.
- P1: emit into `hq_event` from all 3 apps; `surface_health()`; derivable signals (`item_overexposed`, `difficulty_mismatch`, `streak_broken`, `invite_never_accepted`).
- P2: `agent_def`, `agent_sla`, `agent_cost`; `subscription`/`argon_purchase` (revenue); `share_click`/`install_attributed`; `waitlist`; `ip_asset`/`risk_hold`/`ugc_flag`.

---

## 3. Treasury simulated model (results)

**Discount ladder** (annual −17%, seasonal −40%×3mo) → blended ARPU ≈ list − ~7%.
**Cost stack:** fixed **$63/mo** (Supabase 25 + Vercel 20 + misc 15 + agents 3) · processing **15%** · **$0.08/active** infra · **$0.002/registered** · CAC **$1.50/active** (→ $19–75/payer) · discount rate **15%/yr**.

| | Low | Mid | High |
|---|---|---|---|
| Conv / eff-ARPU | 2% / $4.62 | 4% / $6.48 | 8% / $9.26 |
| Unit econ / active | **−$0.005 ❌** | +$0.137 | +$0.547 |
| Steady break-even | **never** | ~462 families | ~115 families |
| First cash-positive | not in 24mo | month 18 | month 2 |
| 24-mo NPV | **−$8.7k** | −$6.4k | **+$106k** |

**Baseline for positive cashflow:** `conversion × effective-ARPU > ~$0.10 / active family` (must beat the $0.08 infra load). The **$0.08/active infra number is the decider** — it's the swing assumption.

**Chiefs share the constraint:** Treasury emits `sig.unit_economics`; any verdict touching cost/revenue must declare impact + `LADDERS_TO` cashflow or the engine rejects it. CTO owns infra load, Ops owns CAC, Guild owns agent OpEx, Legal owns revenue-at-risk.

**Growth-Lab integration:** the CFO chart unifies the Growth Lab demand engine (retention/virality → family curve) with the Treasury money engine (→ cashflow/NPV). One connected chain; demand sliders live-seed from `hq_retention`/`circle_invites`.

---

## 4. Agent reconciliation (Command = single source of truth)

6 offices = 6 chiefs; the existing 27-agent roster becomes the org chart beneath them. Legacy `tier` → `office` ownership.

| Office | Absorbs |
|---|---|
| Bridge (CEO) | CEO Agent (orchestrator) |
| Operations (COO) | COO, CPO, VP ArgantaLab, VP KinetikCircle, VP Growth + all their PMs/specialists, Retention/Acquisition Analysts, Content Creator, Brand, Demo (18) |
| Technology (CTO) | CTO, Data Architect, QA/Red Team, Release Manager |
| Treasury (CFO) | CFO, Investor Relations |
| Legal (GC) | GC, Security & Privacy |
| The Guild | *(net-new meta-office; content = today's Token Economics + Roster + Pipeline)* |

**Sub-tab disposition:** Roster→Guild · Orchestration→Bridge · Token Economics→Guild (ROI board) · Council→Lobby (Consults/Resolve) · Data Map→Technology (graph-driven) · Pipeline→Guild. **Removed:** the `tier` taxonomy, string-substring reader matching. **Build-group Agent Builder** kept as **authoring-only**.

---

## 5. Per-chief audit trail

### Format (7 blocks each)
`① IDENTITY · ② NORTH STAR · ③ DATA AUDIT · ④ AGENT CHAT · ⑤ INTEGRATION · ⑥ BATTLE TESTS · ⑦ BUILD PHASE`

### Global battle tests (all offices)
- ☐ **G1 Honesty** — every metric has a source badge; placeholder/simulated never prints bare.
- ☐ **G2 Ladder teeth** — every verdict carries `LADDERS_TO` or is rejected.
- ☐ **G3 Data-driven** — adding a `seed.ts` node appears in its office with zero component edits.
- ☐ **G4 Drill spine** — CEO brief → chief headline → surface → missing event in ≤3 taps.
- ☐ **G5 Reconciliation** — agents render under office ownership, not `tier`.

---

### ▸ TREASURY — CFO  *(④ complete)*
- **① IDENTITY** `treasury` · CFO · slice: **③ Payment (stage.pay) + money lens on all levers**
- **② NORTH STAR** ladders to `stage.pay`; metric **contribution/active vs infra load** · 🌱
- **③ DATA AUDIT** economy 🟢 · family base 🟢 · revenue/NPV ⚙️ · demand seed 🟡→🌱
- **④ AGENT CHAT** ◐
  - Auto-brief: *"unit economics positive at Mid (~462 break-even, cash-positive m18); Low underwater — infra is the swing."*
  - Chips: 💰 Cash-positive? · 📊 P&L · 💎 Economy · 🔻 Biggest drag · 📈 Model a change · 🗓️ Runway & NPV
  - Visuals: cashflow verdict card · **unified Growth-Lab⨯Treasury fan** (families / cashflow views) · unit-econ gauge · P&L strip · constraint-broadcast cards
  - Sliders: 4 inline (parent D30, conv, infra, price) + full 15-board in drawer/mobile-fullpage
  - Drill: cashflow → cost line → infra → active families → **hand off to CTO**; revenue → plan → region → cohort
- **⑤ INTEGRATION** emits `sig.unit_economics`; consults CTO (infra) + Ops (CAC); verdict **MONETIZE**
- **⑥ BATTLE TESTS** ☐ T1 parent-D30 drag moves families AND cashflow · ☐ T2 Low renders negative · ☐ T3 demand sliders live-seed (🌱) · ☐ T4 simulated $ badged ⚙️ · ☐ T5 MONETIZE needs LADDERS_TO
- **⑦ BUILD PHASE** data ◐P3 · model ◐P4 · chat ◐P4/P5 · constraint edges ◐P2

### ▸ TECHNOLOGY — CTO  *(④ complete)*
- **① IDENTITY** `technology` · CTO · slice: **efficiency lever (activation) + instrumentation coverage**
- **② NORTH STAR** metric **coverage % → 80%** · 🟡
- **③ DATA AUDIT** `hq_event` sink 🔴 (#1 gap) · `artifact_telemetry` 🟡 · `hq_schema_model` 🟢 · derivable signals 🟡
- **④ AGENT CHAT** ◐
  - Auto-brief: *"coverage X%→80% — Y surfaces blind (the backlog); activation Z%; infra $0.08/active = N% of Treasury's deficit."*
  - Chips: 📡 What are we blind on? · ⚡ Activation funnel · 🩺 Signal health · 💸 Infra cost impact · 🏗️ Architecture & scale · 🔌 Wire this event
  - Visuals: **coverage x-ray** (grey map) · activation funnel · signal board · infra decomposition (→ break-even delta) · architecture map · schema/reliability card
  - Drill: coverage x-ray → blind surface → the `hq_event` type + reader RPC → INSTRUMENT ticket; signal → world/skill → learn_event → hand to Ops; infra → media line → surfaces → cut → break-even → CFO
- **⑤ INTEGRATION** receives `sig.unit_economics` → returns infra cut plan; emits coverage/grey-map; owns guardrails (difficulty_mismatch→Ops, impossible_score→anti-cheat, ugc→Legal); verdicts **FIX/INSTRUMENT/INNOVATE**
- **⑥ BATTLE TESTS** ☐ T1 every 🔴 → INSTRUMENT verdict (derived) · ☐ T2 blind surface names exact hq_event type + RPC · ☐ T3 infra cut = same break-even as CFO · ☐ T4 coverage live-computed · ☐ T5 red guardrail returns blast-radius · ☐ T6 INSTRUMENT needs LADDERS_TO
- **⑦ BUILD PHASE** coverage ◐P3 · chat ◐P5

### ▸ OPERATIONS — COO  *(④ complete)*
- **① IDENTITY** `operations` · COO · slice: **depth+frequency levers · stages learn/parentlock/kinetiklock/expansion (the two retention hooks).** Largest office (18 agents).
- **② NORTH STAR** metric **CURR** (New/Current/At-risk/Dormant) · 🟡
- **③ DATA AUDIT** learning/kinetik/rings/family 🟢 · per-surface feature views 🔴 · CURR 🟡 (`curr_states()`)
- **④ AGENT CHAT** ◐
  - Auto-brief: *"CURR — New A/Current B/At-risk C/Dormant D; hooks [both firing / kid-only / parent-only]; weakest stage [x]."*
  - Chips: 🔁 CURR state · 🪝 Two-hook health · 📚 Content depth map · 📅 Family utility pulse · 🧭 Value ladder · ✂️ Cut / deepen?
  - Visuals: **CURR state machine** (transitions) · **two-hook decomposition** (kid/parent/both) · content depth heat (CohortHeat) · value-ladder strip (5 stages + leak) · **surface verdict grid** (INVEST/POLISH/CUT) · family utility line
  - Drill: CURR → At-risk → which hook went cold → the surface (world/calendar) → guardrail (streak_broken/calendar_open_no_add) → hand to CTO if blind; content heat → cold world → items → learn_event accuracy → POLISH/DEEPEN
- **⑤ INTEGRATION** receives CFO CAC consult + CTO guardrails; owns value-stage spine (blast-radius); verdicts **DEEPEN/PRUNE/RETAIN/POLISH/CUT**
- **⑥ BATTLE TESTS** ☐ T1 CURR sums to total active · ☐ T2 two-hook matches Bridge's W2F (one source) · ☐ T3 red guardrail on stage.learn flags downstream (blastRadius) · ☐ T4 surface grid uses deriveVerdict + LADDERS_TO · ☐ T5 largest roster renders under Ops (G5) · ☐ T6 cold world traces to real learn_event
- **⑦ BUILD PHASE** surfaces ◐P1 · CURR ◐P3 · chat ◐P5

### ▸ BRIDGE — CEO  *(④ pending)*
- **① IDENTITY** `bridge` · CEO · human: you · slice: **the whole W2F (synthesizer)**
- **② NORTH STAR** metric **Weekly Two-Hook Families** · 🟡→🟢 (`w2f_weekly()`)
- **③ DATA AUDIT** W2F 🟡 · resolve queue 🔴
- **④ AGENT CHAT** ◐ *design pending* — roll-up = 6 chief headlines stacked + "who needs me"
- **⑤ INTEGRATION** receives all chief headlines + `sig.unit_economics`; verdicts **STRATEGY/RESOLVE**
- **⑥ BATTLE TESTS** ☐ brief = concatenation of 6 chief headlines · ☐ RESOLVE ordering Trust>NorthStar>Retention>Money
- **⑦ BUILD PHASE** W2F ◐P3 · chat ◐P5

### ▸ LEGAL — GC  *(④ pending)*
- **① IDENTITY** `legal` · GC · slice: **Trust guardrail across the whole ladder**
- **② NORTH STAR** metric **open holds → 0** · 🔴
- **③ DATA AUDIT** consent scaffold 🟡 · IP/risk/UGC 🔴
- **④ AGENT CHAT** ◐ *design pending*
- **⑤ INTEGRATION** emits revenue-at-risk on HOLD → CFO; verdicts **FLAG/HOLD**
- **⑥ BATTLE TESTS** ☐ HOLD shows $ frozen · ☐ trust ranks above money in RESOLVE
- **⑦ BUILD PHASE** tables ◐P2 · chat ◐P5

### ▸ THE GUILD — Guildmaster  *(④ pending)*
- **① IDENTITY** `roster` (id stable) · The Guild · slice: **the agent workforce running all offices + ROI**
- **② NORTH STAR** metric **lowest-ROI agent** · 🔴
- **③ DATA AUDIT** roster static 🔴 (→`agent_def`) · token/ROI 🔴 (`agent_sla`,`agent_cost`) · live-lit status 🟢
- **④ AGENT CHAT** ◐ *design pending* — absorbs Roster/Pipeline/Token-Economics
- **⑤ INTEGRATION** OpEx delta → CFO; verdicts **IMPROVE/REPLACE**
- **⑥ BATTLE TESTS** ☐ authored agent persists & appears (G5) · ☐ null ROI renders placeholder, not fake
- **⑦ BUILD PHASE** roster reconcile ◐P1 · tables ◐P2 · chat ◐P5

---

## 6. Build phases (each ends RUNNABLE)

- **P0** Skeleton & routing — SurfaceId, Rail group (between Analytics/Build), empty Command + Office shells.
- **P1** Graph model + seed (all placeholder) — `data/graph/{types,seed,agents,engine}.ts`; offices render owned subgraph; agent roster reconciled to offices.
- **P2** Engine + verdicts + RCA — rollup, weakestLever, rootCause, deriveVerdict, validateVerdict, blastRadius, pendingConsults; `sig.unit_economics` constraint edges.
- **P3** Supabase — activate `hq_event`; `w2f_weekly()`, `curr_states()`, `k_factor()`, `surface_health()`; flip metrics live.
- **P4** Office cockpits — Treasury (Growth-Lab⨯Treasury model + drawers), Technology (coverage x-ray + arch), Operations (CURR + content depth), Legal, Guild.
- **P5** LLM layer — office-aware agent chat behind the deterministic seam; quarantined edges; CEO roll-up.

## 7. Open items / next
- ◐ Map block ④ for **Bridge, Legal, The Guild** (Operations, CTO, CFO done).
- ☐ Confirm the **$0.08/active infra** number (decides Low viability).
- ☐ Persist SQL for P0 read-side RPCs.
