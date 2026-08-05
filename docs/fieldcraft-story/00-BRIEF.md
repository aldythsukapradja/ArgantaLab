# Fieldcraft Story Deck — Brainstorm Brief

**Paste this file first.** It gives you everything you need about the product, the
audience and the constraints. The other two files are the material:

| File | What it holds |
|---|---|
| `00-BRIEF.md` | *(this file)* Context, constraints, and exactly what I want back |
| `01-STORY-SPINE.md` | The current 3-act, ~42-slide story outline |
| `02-APP-INVENTORY.md` | The real software components and data that already exist |

You have no access to the codebase. `02-APP-INVENTORY.md` is the authoritative
list of what can appear on a slide. **Do not invent visuals that are not on it** —
if you want something new, mark it clearly as `NEW BUILD` so the cost is visible.

---

## 1. What the product is

**ArgantaEnergy** is a web application covering the full oil & gas asset
lifecycle. It has five workspaces:

| Workspace | What it does |
|---|---|
| Exploration | Basins, plays, prospects, risk, prospect-level volumes |
| Field Development | Petrophysics, static model, volumetrics, simulation, economics |
| Well Delivery | Well design, trajectory, casing, completion |
| Drilling | Rig sequencing and schedule |
| Reservoir Management | Surveillance, forecasting, patterns, opportunities |

Every workspace runs on the **Volve dataset** — a real North Sea oil field
(Norwegian block 15/9, Viking Graben) that Equinor released publicly in 2018.
Discovered 1993, produced 2008–2016, then abandoned. It is the only complete,
public, full-lifecycle field dataset in the industry.

The app also has **five AI lifecycle agents**, one per workspace.

---

## 2. What we are building

A **5-day training course** on the full lifecycle, taught on Volve, using the
app itself as the laboratory. It ships in three tiers:

| Tier | Covers | Depth |
|---|---|---|
| **1-day** | Exploration · Field Development · Reservoir Management | Wide, shallow — one decision each |
| **3-day** | Same three | One full day each |
| **5-day** | + Well Delivery · Drilling | Five domains, full depth |

**We are designing the 1-day course first.** It must be sellable on its own, and
its content must survive into the 3- and 5-day without rework.

A concept shell already exists in the app: three lifecycle cards, each with
shortcuts into that lifecycle's presentation, knowledge dossier, workspace, and
agent. **This brainstorm is about the presentation.**

---

## 3. The creative direction — non-negotiable

> **Tell it as a story, forward in time, about one field. Never let the room
> realise it is training.**

No objectives slide. No agenda. No "by the end of today you will…". The room
walks in to a satellite view of the North Sea and spends the day watching one
field be imagined, found, built, produced, watered out and abandoned.

Opening line is Wallace Pratt's: **"Oil is first found in the minds of men."**
The whole day proves it.

Three acts:

| Act | Chapter | Arc |
|---|---|---|
| I | Exploration | Rifting → source → trap → risk → discovery → appraisal |
| II | Field Development | Logs → petrophysics → correlation → structure → static model → uncertainty → simulation → forecast → economics |
| III | Reservoir Management | First oil → pressure decline → gas breakout → water injection → VRR → water breakthrough → diagnostics → decline → economic limit → abandonment |

Each act ends with a **memorable takeaway** and a **wow moment**.

Each act contains one **AI agent interlude** showing manual physics/geoscience
alongside what an agent adds — and, critically, what only a human can do.

---

## 4. Hard constraints — please respect these

| # | Constraint | Why |
|---|---|---|
| C1 | **The slides ARE the app.** A slide is an existing app component rendered full-bleed, read-only, with at most ONE live interaction. | Cheapest possible build. It's also the product demo. |
| C2 | **No hardcoded numbers.** Every figure on a slide must bind to the same record the workspace reads. | The course teaches provenance. A deck with typed numbers that drift would teach the opposite. |
| C3 | **No bullet-list slides.** Reference content goes in the facilitator guide and learner workbook, never on screen. | The current legacy deck failed exactly this way — 20 dense slides/day nobody read. |
| C4 | **Title is a claim, not a topic.** "Presence is not effectiveness", never "Petroleum System Elements". | Already the strongest feature of the existing material. |
| C5 | **Every slide ends in a question to the room**, with the expected wrong answer noted for the facilitator. | Difference between a talk and a class. |
| C6 | **One page, no scroll.** Slides render in a fixed canvas that densifies rather than scrolls or clips. | House rule across this app. |
| C7 | **The agent interlude always comes AFTER the hand-work**, never before. | The point only lands once the room knows what it cost to do manually. |

---

## 5. Known risks — do not paper over these

| Risk | Detail |
|---|---|
| **3 of 5 agents are BETA** | Field Development and Reservoir Management agents are LIVE. Exploration, Well Delivery and Drilling are BETA. Act I's agent moment is therefore the least safe demo. |
| **The chat layer is scripted, not an LLM** | The in-app agent narration is deterministic. Great for reliability on stage; it means an unscripted "ask it anything" moment is not currently possible without new work. |
| **Abandonment economics are unsourced** | Act III lands on "it stopped being economic in 2016". The argument shape is sound; specific opex/price figures need a citable source or should be replaced by a live breakeven calculator the room drives. |
| **Headline STOIIP is a trap** | The commonly quoted Volve STOIIP figure is an upper bound. Act I explicitly teaches not to quote numbers like this without their evidence class — so the deck must not do it either. |

---

## 6. What I want back from you

Brainstorm freely, then give me **a build-ready prototype spec**. Specifically:

### 6.1 Critique first
- Where does the story sag? Which slides are doing no work?
- Is 42 slides right for a day, or is the pacing wrong?
- Which act is weakest, and what would fix it?
- What is the single best moment in the day, and is it in the right place?

### 6.2 Then improve the spine
- Better punchline titles — sharper, more surprising, still true
- Slides to cut, merge, or add
- The transitions between acts (these are currently weak)
- The cold open and the closing beat

### 6.3 Then specify the prototype
Give me, for **Act I only** (the reference chapter I'll build first):

| For each slide | Fields |
|---|---|
| `id` | stable kebab-case slug |
| `archetype` | one of: `statement` · `diagram` · `live` · `split` · `artifact` · `verdict` |
| `title` | the punchline, as a claim |
| `subtitle` | one line, optional |
| `visual` | which component from `02-APP-INVENTORY.md`, or `NEW BUILD: <description>` |
| `interaction` | the single allowed live interaction, or `none` |
| `bindings` | which data values must be read live rather than typed |
| `say` | 2–4 sentences the facilitator actually says |
| `ask` | the question to the room |
| `expect` | the wrong answer to expect, and how to use it |
| `seconds` | target time on slide |

Return that as a **JSON array** I can drop straight into a TypeScript module,
plus a short prose rationale for anything you changed from the current spine.

### 6.4 And separately
- The three act takeaways, rewritten to be more memorable
- The three wow moments, with a note on what could go wrong live
- Anything in `02-APP-INVENTORY.md` that is under-used and shouldn't be

---

## 7. Audience assumption

Assume a **mixed room**: petrotechnical staff (geologists, petrophysicists,
reservoir engineers) alongside commercial and management people. The story has
to work for both — technical enough that a reservoir engineer doesn't switch
off, human enough that a finance lead follows every beat.

If you think that assumption is wrong or should be split into two variants, say so.

---

## 8. Glossary — so you use the terms correctly

| Term | Meaning |
|---|---|
| **Volve** | The field. Norwegian block 15/9, Viking Graben, North Sea. |
| **Hugin Formation** | The reservoir sandstone. Middle Jurassic, shallow/marginal marine. |
| **Viking Graben** | The rift basin. A "graben" is a down-dropped block of crust. |
| **STOIIP** | Stock Tank Oil Initially In Place — volume before recovery factor. |
| **GRV / NTG / φ / Sₒ / Bₒ** | Gross rock volume, net-to-gross, porosity, oil saturation, formation volume factor. The volumetric chain. |
| **GCoS / GCF** | Geological Chance of Success / chance factors — the five dependent risk elements, multiplied. |
| **P90 / P50 / P10** | Low / median / high of a conditional volume distribution. Never blend with chance. |
| **WCT** | Water cut — fraction of water in produced liquid. |
| **GOR** | Gas–oil ratio. Rises when reservoir pressure drops below bubble point. |
| **Pb / bubble point** | Pressure below which dissolved gas comes out of solution. |
| **VRR** | Voidage Replacement Ratio — volume injected ÷ volume produced. Target ≈ 1.0. |
| **Chan plot** | Diagnostic separating water coning vs channelling vs multilayer. |
| **Arps decline** | The standard decline-curve model (b-factor sets the shape). |
| **Economic limit** | The day the next barrel costs more than it sells for. |
| **FDP** | Field Development Plan. |
| **OSDU** | Open Subsurface Data Universe — the industry data standard the app uses as its system of record. |

---

**Now read `01-STORY-SPINE.md` and `02-APP-INVENTORY.md`.**
