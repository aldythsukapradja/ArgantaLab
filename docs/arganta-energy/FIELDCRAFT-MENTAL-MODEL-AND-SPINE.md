# The Volve Mission — Mental Model and Spine

The teaching architecture behind Fieldcraft's flagship course. This is the document to read
before editing any content, because every slide, exercise and question in the course is
positioned against the structure described here.

---

## 1. The one-sentence thesis

> **Volve is the instrument, not the subject.**

The course is not "here is a North Sea field." It is a repeatable method for converting
evidence of mixed quality into a decision that can be audited by someone who was not in the
room. Volve is used because it is real, publicly released, and has a *closed* lifecycle —
discovery through abandonment — so every claim can be checked and every handoff actually
happened.

A delegate who forgets the Hugin Formation but frames their next asset decision properly has
got full value. A delegate who can recite Volve's stratigraphy but still writes
recommendations with no stated decision has got none.

---

## 2. The spine — six beats, every day

Every one of the five days runs the same rhythm. This is the single most important thing in
the course, and it is deliberately repetitive: by Day 3 the delegates should be anticipating
the next beat.

| Beat | The question it answers | The failure it prevents |
|---|---|---|
| **FRAME** | What decision are we making, and what would change it? | Analysis that nobody can act on |
| **EVIDENCE** | What do we actually have, and what class of truth is it? | Confident conclusions built on laundered numbers |
| **METHOD** | What technique applies, and where is its boundary? | Using a valid tool outside its assumptions |
| **RANGE** | Which uncertainty can actually move the decision? | Averaging away the variable that decides |
| **DECIDE** | What is the call, and on what conditions? | A preference dressed as a decision |
| **HANDOFF** | What does the next stage inherit? | Consequence arriving unannounced |

Declared in code as `COURSE_SPINE` in [`syllabus/index.ts`](../../apps/energy/src/fieldcraft/syllabus/index.ts),
and enforced by `npm run test:syllabus`, which fails the build if any day is missing a beat.

### Why these six

They are ordered so that each beat makes the next one answerable. You cannot classify
evidence usefully until you know what decision it serves (FRAME before EVIDENCE). You cannot
choose a method until you know what evidence you hold (EVIDENCE before METHOD). You cannot
rank uncertainty until a method has produced a range (METHOD before RANGE). And a decision
made before RANGE is a guess with a number attached.

---

## 3. The chain — four gate cards, one evidence trail

The days are not five topics. They are one asset moving through its life, and each day hands
the next a **signed artifact**. The artifact is the course's unit of work.

```
DAY 1  DISCOVER    Exploration Gate Card      Progress / Study / Stop
   ↓                  inherited as the development basis
DAY 2  DESCRIBE     Development Case Card     Select / Rework / Reject
   ↓                  inherited as the candidate well
DAY 3  DELIVER      Well Gate Card            Approve / Condition / Hold
   ↓                  inherited as a producing unit
DAY 4  OPERATE      Reservoir Action Card     Act / Acquire Data / Monitor
   ↓                  all four inherited together
DAY 5  DECIDE       Integrated Field Decision  one option + its conditions
```

**The handoff is a contract: what is not on the card does not travel.** This is what makes
Day 5 possible and what makes weak work on Day 1 painful on Day 2 — by design. Delegates
inherit their own gaps.

Each card is also the **graded deliverable** for that day, and each maps to a Passport
artifact, so the learning record is the same object as the course output.

---

## 4. Three ideas that recur every single day

If the spine is the structure, these are the arguments. They appear on every day in
different technical clothing, which is what makes them stick.

### 4.1 Presence is not effectiveness
A source rock that is present but never expelled. A porous sand with no seal. A condition
written with no verification criterion. A monitoring report that never changed a decision.
**Existing and working are different tests**, and professionals routinely score the first
while believing they scored the second.

### 4.2 Every number carries a class of truth
Measured → reported → interpreted → derived → forecast → scenario. Truth class degrades
naturally as work proceeds; the failure is not the degradation, it is the **silence**. A
scenario volume quoted three meetings later as though it were reported is an error of the
same severity as a wrong calculation.

The class of a result is the **weakest class among its inputs**. This is why lineage is a
chain, not a citation.

### 4.3 Only decision-relevant uncertainty survives
The three-part filter, formalised on Day 5 but applied from Day 1:

- **Material** — large enough to move the measure the criteria are written against
- **Decision-relevant** — a plausible value changes which option wins
- **Actionable** — something can move it before the decision date

Two out of three makes a footnote, not a review item. And the corollary that delegates find
hardest: *the widest range on the board is usually not the one that decides.*

---

## 5. The day shape

Each day is 20 slides in a fixed teaching sequence. The `layout` field on every slide drives
both the visual treatment and the rhythm.

| # | Layout | Purpose |
|---|---|---|
| 1 | `divider` | Opens the day, names what was inherited |
| 2 | `objective` | Performance verbs the delegate is graded on |
| 3–9 | `framework` / `concept` / `example` | FRAME, EVIDENCE and METHOD beats, each concept followed by a worked example on real data |
| 10 | `exercise` | Exercise 1 brief |
| 11 | `debrief` | What good looked like, and the failure modes |
| 12–15 | `framework` / `concept` / `example` | METHOD and RANGE beats |
| 16 | `exercise` | Exercise 2 brief |
| 17 | `debrief` | What good looked like |
| 18 | `framework` | DECIDE — the gate call and its evidential burden |
| 19 | `summary` | The day on one page, spine made explicit |
| 20 | `bridge` | HANDOFF — what tomorrow inherits |

**Action titles throughout.** Every title is an assertion that states the finding, never a
label. "Presence is not effectiveness", not "Petroleum system elements". Enforced by the
syllabus test, which fails any title under four words.

**Every slide carries a real facilitator note** — what to say, what to demonstrate live in
the app, what question to put to the room, and which misconception to pre-empt. These are
the instructor's script, not a summary of the slide.

---

## 6. The labs are the real product

Ten exercises, two per day, fifty graded steps. Each step:

- runs in a **named module of the real ArgantaEnergy workspace**, not a simulation
- states exactly what the learner does
- states the **evidence they must capture**, which is what gets graded

The full workflow is exercised — Day 2 alone walks logs → correlation → petrophysics →
structural → volumetrics → uncertainty → simulation → forecast → economics → review, which
is the legacy Petrel-style workbench in its entirety.

The syllabus test asserts every `module` id against the actual registries, so an exercise can
never point at a tool that does not exist. It also asserts each lab touches **at least three
modules**, so no exercise degenerates into a single-screen click-through.

> **Design note.** Field Development deep-links directly to the module (it exposes a drive
> hook). The other verticals surface the target module in the mission HUD instead, because
> their shells use three different internal tab systems and were being actively edited in
> parallel. The learner is never left guessing where to go either way.

---

## 7. Assessment and the competition

Two separate systems, deliberately not confused with each other:

**The individual Fieldcraft Passport** rests on the individual exam (90 questions: 4×10 daily
checks + a 50-question final, 80% pass) and the mission evidence that person captured. This
is the credential.

**The team leaderboard** is scored on the published rubric — 40 workflow / 20 evidence /
20 decision / 20 quiz-and-team, out of 100 per day. It is a **teaching device** and never
contributes to certification. The board deliberately shows the rubric breakdown per day
rather than only a total, because teams argue with a single number but learn from seeing
they lost points on *evidence* rather than on *workflow*.

This separation is stated to the room on Day 5 and is enforced in the product copy.

---

## 8. Where things live

| What | Where |
|---|---|
| Slides + exercises, per day | `src/fieldcraft/syllabus/day1..day5.ts` |
| Spine declaration, mission assembly | `src/fieldcraft/syllabus/index.ts` |
| Day metadata, schedule, materials | `src/fieldcraft/catalog.ts` |
| Question bank (90) | `src/fieldcraft/questions.ts` |
| Editable content + revision history | `src/fieldcraft/content-store.ts` |
| PowerPoint / Word round trip | `src/fieldcraft/officegen/` |
| Leaderboard | `src/fieldcraft/Leaderboard.tsx` |

**Content is compiled, never re-typed.** The facilitator guide is assembled from the day's run
of show, the slide notes, the mission steps and the live answer key. Edit a slide and the
guide that quotes it follows. This is the same provenance doctrine the course itself teaches,
applied to the course's own artifacts.

### Validation

```bash
npm run test:fieldcraft
```

Runs three suites: the question bank (blueprint counts, answer-position spread), the PPTX
package (11 structural invariants), and the syllabus (spine completeness, action titles,
module existence, workflow breadth, apostrophe trap).

---

## 9. Editing rules

1. **Never break the spine.** If you add or remove slides, every day must still contain all
   nine layouts. The test enforces this.
2. **Titles assert, never label.** If the title could head a textbook chapter, rewrite it.
3. **No apostrophes in content strings.** Content is embedded in single-quoted TypeScript;
   the test catches this, but write "does not" from the start.
4. **Every exercise step needs a real module id and gradable evidence.**
5. **Do not add a technical topic without attaching it to a decision.** If a concept cannot
   change one of the five gate calls, it belongs in a reference pack, not in the course.
6. **Illustrative numbers must be labelled illustrative.** Volve is public but not everything
   about it is; the course must never assert data it does not have.
