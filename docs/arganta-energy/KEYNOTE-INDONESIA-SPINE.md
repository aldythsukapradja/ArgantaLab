# Indonesia's Geological Legacy — Spine & Scenario (v1.2)

> **SUPERSEDED — history only.** The deck that shipped is nine scenes on the
> v1.0 handoff scenario, dark throughout. See
> [KEYNOTE-INDONESIA-AS-BUILT.md](./KEYNOTE-INDONESIA-AS-BUILT.md). Do not read
> this file as a spec.

> **v1.2 correction.** v1.1 demoted two of the original ten scenes — *Three
> Stages* to an appendix and *Beyond One Person* to a single spoken question —
> and with them lost **Momentum** and **Collaboration** from the emotional arc.
> That was wrong. Herman Darman is an *advisor*: "what would you actually do?"
> and "who does this with you?" are not questions to defer, they are the two
> questions his role exists to answer. A deck that reaches the ask with no plan
> and no ecosystem reads as a complaint, not an initiative. Both are restored
> below, tuned for him rather than reverted to generic form.


**For:** Herman Darman — exploration geologist, editor of *An Outline of the
Geology of Indonesia*, ~20 years Shell, advisor to Pertamina.
**Format:** 12 scenes, ~18 minutes, designed to be **interrupted**.
**Status:** scenario only, no build. GSAP approved as the timeline engine.

---

## 0. What changes because it is Herman Darman

Three consequences, and they rewrite the deck:

**1. Do not teach him Indonesian geology.** He wrote the reference synthesis. Any
slide that explains the Kutei Basin to him is a slide that loses him. Instead:
show him **the machine's view of his geology — and where it is blank.**

**2. His book is the hero artifact, not the villain.** *An Outline of the Geology
of Indonesia* is exactly the synthesis this initiative wants to preserve. The
problem is that it is a document: a human can read it, a successor can inherit
the PDF, but **no system can reason over it.** That is the entire pitch, and it
is respectful rather than dismissive — we are not replacing the synthesis, we are
asking how to make it computable and inheritable.

**3. He is an advisor, so the ask is real.** "I need guidance, not approval" is
perfectly pitched for him. The three questions must be ones **only he can
answer** — not rhetorical.

**The one thing he has never seen:** a measurement of how much of Indonesia's
geological reasoning is missing from the machine-readable record. Nobody has put
that number on a screen. We can.

---

## 1. The spine

| # | Scene | Emotion | Duration | Punchline | Wow effect | Backed by |
|---|---|---|---|---|---|---|
| 1 | **Where it begins** | Wonder | 1:30 | *"Everything we know about Indonesia's subsurface began as someone's reasoning."* | Earth from dark; camera flies to the archipelago; 13 real province polygons ignite one by one | 13/13 polygons, true bbox |
| 2 | **One basin, one career** | Recognition | 1:30 | *"Handil. Tunu. Peciko. Sisi-Nubi. I worked two of them. You know all of them."* | A single well trajectory becomes the Mahakam story; the career path and the basin's history are the same line | Real Kutei field list + years |
| 3 | **What the machine knows** | Curiosity | 1:30 | *"This is Kutei Basin as a computer sees it."* | The chain assembles: Province → TPS → AU → 20 fields, each node a real record | Kutei 3817 full chain |
| 4 | **What the machine does not know** | **Recognition → unease** | 2:00 | *"Source rock: blank. For the Mahakam."* | The same chain, now showing its holes — the field list survives, the reasoning does not | `source_rock_formation` empty; 1 AU with no volumes |
| 5 | **The measurement** | Urgency | 2:00 | *"Zero of forty-six. Not one basin cycle in Indonesia has a source we can cite."* | Three counters resolve; Alberta 1,096 · North Sea 445 · **Indonesia 79** | Full audit §4 |
| 6 | **The book problem** | **Respect → ache** | 1:30 | *"The synthesis exists. It just cannot be computed."* | His own book appears as an object; a reader can open it, a machine cannot enter it | — (staged, reverent) |
| 7 | **Why this is possible now** | Credibility | 1:00 | *"OSDU gave us the grammar. The open record gave us the corpus."* | Three enabling layers stack into place | OSDU R3 M27, 17,302 records |
| 8 | **Sovereign geological knowledge** | Inspiration | 1:30 | *"A nation should not only own its resources. It should own the understanding of them."* | Broken links reconnect; **dark → light as narrative** | — (staged) |
| 9 | **One common language** | Clarity | 2:00 | *"Plate to well, one unbroken chain — for every basin, not just one."* | Single continuous camera: Plate → Province → Basin → … → Well, using the real Kutei chain | ATLAS spine |
| 10 | **One possible implementation** | Confidence | 1:30 | *"The technology is not the vision. It is one way to make the vision usable."* | Real Exploration canvas frames; ArgantaEnergy named once, small, late | Live app captures |
| 11 | **Three stages** | **Momentum** | 2:00 | *"Not a system to be delivered. A capability that compounds."* | Three worlds — blue → gold → white — each answering a measured gap, each with a 12-month deliverable | Gaps from §5 audit |
| 12 | **What could go wrong** | **Trust** | 1:30 | *"Three ways this fails. I would rather name them than discover them."* | Three honest failure modes surface and are answered | — |
| 13 | **Beyond one person** | **Collaboration** | 1:30 | *"Could this become an Indonesian Geological Legacy Initiative?"* | Ecosystem assembles around a shared framework — **and one node is left empty** | — |
| 14 | **The ask** | Reflection | 2:00 | *"Future generations should inherit more than data. They should inherit the way Indonesia understands its geology."* | Stillness; Indonesia glows; three questions, one at a time; fade with no logo | — |

**Emotional curve:** Wonder → Recognition → Curiosity → **Unease** → Urgency →
**Ache** → Credibility → Inspiration → Clarity → Confidence → **Momentum** →
**Trust** → **Collaboration** → Reflection.

The original ten beats all survive. The three additions are **Recognition**
(scenes 2–4), **Ache** (scene 6) and **Trust** (scene 12). Recognition earns the
right to say anything to an expert; Ache gives the word *inherit* a face before
the closing line spends it; Trust is what an advisor needs before he will attach
his name.

**Running time ~20 minutes.** If the meeting is short, cut scene 7 (*Why now*,
1:00) and compress 3+4 into one — never cut 11 or 13, which are the two scenes
that make this an initiative rather than an observation.

---

## 2. The scenario, beat by beat

### Scene 1 · Where it begins · *Wonder* · 1:30

Two seconds of black. Then stars, slowly. Earth resolves from the dark, blue
atmosphere rim catching the light. The camera begins to fall toward Southeast
Asia — not a cut, a descent.

Indonesia arrives. Thirteen province polygons ignite one at a time, west to east:
North Sumatra, Central Sumatra, South Sumatra, Northwest Java, East Java, Barito,
Kutei, Tarakan, Penyu-West Natuna, Banda Arc, Bintuni-Salawati, Arafura, Papuan.

> **Every one of those outlines is a real polygon from the corpus, lit in the real
> geographic position. Nothing here is drawn for effect.**

Title, late:

> **A Vision for Indonesia's Geological Legacy**

Spoken:
> *"Everything we know about Indonesia's subsurface began as someone's reasoning.
> Not as data — as reasoning. This is about what happens to that reasoning."*

---

### Scene 2 · One basin, one career · *Recognition* · 1:30

Earth dissolves. One glowing well trajectory descends — a real survey.

Field names arrive along the path, in discovery order, with their years:

```
1972  Badak          1974  Nilam         1975  Handil
1978  Tunu           1989  Sisi-Nubi     1991  Peciko
2002  Maha           2003  Gehem         2009  Jangkrik
2014  Merakes        2023  Geng North    2025  Konta
```

Spoken:
> *"This is the Mahakam. Fifty-three years of discovery, and it hasn't stopped —
> Geng North in 2023 came in as big as Badak did in 1972."*
>
> *"I worked Sisi-Nubi and Jumelai. You know every name on this list. That's the
> point — between us, this basin is well understood. The question is whether that
> understanding survives us."*

**Why this works:** credibility is *demonstrated* in nine seconds instead of
claimed across a CV slide. And it puts presenter and audience on the same side of
the table immediately.

---

### Scene 3 · What the machine knows · *Curiosity* · 1:30

The trajectory pulls back. The chain assembles, node by node:

```
Kutei Basin (USGS 3817)
   └── Oligocene-Miocene Composite      ← total petroleum system
         ├── Kutei Basin Turbidites          3,047 MMBBL · 41,709 BCF
         ├── Kutei Basin Deltaics              168 MMBBL ·  4,293 BCF
         └── Kutei Basin Fold and Thrust Belt
               └── 20 fields
```

Spoken, evenly:
> *"This is Kutei as a computer currently sees it. Real records, real links, real
> numbers. It knows the basin, the petroleum system, three assessment units and
> twenty fields."*

*Beat.* Let him think it looks complete. It does.

---

### Scene 4 · What the machine does not know · *Unease* · 2:00 — **the turn**

The same chain. Nothing moves. Then fields begin to grey out and empty labels
resolve where content should be.

```
Oligocene-Miocene Composite
   source rock ........................ (blank)
   generation history ................. (blank)
Kutei Basin Fold and Thrust Belt
   oil mean ........................... (blank)
   gas mean ........................... (blank)
Basin cycles ......................... 4 records, 0 with a citable source
```

Spoken, quieter:
> *"Source rock: blank. For the Mahakam."*
>
> *"You could tell me the answer without looking. Miocene deltaic coals and
> shales — you'd give me the maturity window too. But you are not in the database,
> and one day you will not be in the meeting."*

**This is the emotional hinge of the entire deck.** It is specific, it is true, it
is checkable, and it is about him without flattering him. He will either lean
forward here or the deck has failed — and if he starts correcting the record out
loud, that is not an interruption, that is the product working.

---

### Scene 5 · The measurement · *Urgency* · 2:00

Pull up and out to all thirteen basins. Counters resolve one at a time:

```
   46,105 MMBOE     assessed undiscovered resource
      126 years     of continuous discovery, 1899 → 2025
   0 of 46          basin cycles with a citable source
   2 of 13          basins with a classified tectonic setting
```

Then, slowly, the comparison:

```
Alberta Basin ............... 1,096 catalogued fields
North Sea Graben .............. 445
Indonesia, all 13 basins ....... 79
```

Spoken:
> *"Indonesia does not have fewer fields than Alberta. It has a thinner open
> record of them. That gap is not geology. It is bookkeeping — and bookkeeping is
> fixable."*

---

### Scene 6 · The book problem · *Ache* · 1:30

Everything else falls away. A single object: a book.

> *An Outline of the Geology of Indonesia*

Spoken, with respect and no flattery:
> *"The synthesis already exists. You wrote a great deal of it."*
>
> *"A student can read it and understand Indonesia. A machine cannot read it and
> understand anything. Every citation, every correlation, every judgement about
> why a play works — it is all in there, and none of it is reachable by a query."*
>
> *"Your successors will inherit the PDF. They will not inherit the reasoning."*

**Handle with care.** This must land as *your work deserves a better container*,
never as *your work is obsolete*. Deliver it slowly, and stop talking after it.

---

### Scene 7 · Why now · *Credibility* · 1:00

Three layers stack:

```
OSDU R3 (M27)     a shared grammar for subsurface records — 17,302 already loaded
Open assessments  USGS, national releases, public field registries
Compute           reasoning over structure is finally cheap
```

Spoken:
> *"None of this was possible ten years ago. The standard didn't exist, the open
> record was thinner, and nobody could afford to compute over it. That's why the
> window is now, and why it won't stay open indefinitely — the people who hold the
> reasoning are retiring faster than we are capturing it."*

---

### Scene 8 · Sovereign geological knowledge · *Inspiration* · 1:30

The broken links from scene 4 reconnect. Golden light spreads west to east.
**Dark mode becomes light mode as part of the story**, not as a control.

> *"A nation should not only own its natural resources.*
> *It should own the scientific understanding of those resources."*

No numbers on this slide. It is the emotional turn; a statistic would break it.

---

### Scene 9 · One common language · *Clarity* · 2:00

One unbroken camera movement, no cuts:

```
Plate → Province → Basin → Evolution → Stratigraphy →
Petroleum System → Play → Field → Well
```

Rendered with the **real Kutei chain**, so the framework on screen is the
framework in the database — Sunda Plate → Kutei → Oligocene-Miocene Composite →
Turbidites → Peciko → a well.

Spoken:
> *"One chain, plate to well. Not for one basin — for all thirteen, in the same
> shape, so they can finally be compared to each other and to the world."*

---

### Scene 10 · One possible implementation · *Confidence* · 1:30

The framework folds into a working screen. Real captures: the basin map, the
Magoon–Dow events chart, the field-size distribution.

ArgantaEnergy is named **once**, small, in the corner, and never again.

> *"The technology is not the vision. It is one way to make the vision usable.
> If someone builds a better one, the framework still stands."*

---

### Scene 11 · Three stages · *Momentum* · 2:00 — **restored**

Three worlds, one continuous camera: **blue → gold → white**. Each stage answers
a gap that scene 5 already measured, so the plan is a response to evidence rather
than a wish.

| | **DISCOVER** · blue | **UNIFY** · gold | **LEGACY** · white |
|---|---|---|---|
| **The measured gap** | 79 fields on the open record against Alberta's 1,096 | 0 of 46 basin cycles with a citable source | The reasoning lives in people who are retiring |
| **The work** | Listen. Collect. Measure. | Classify. Relate. Frame. | Transfer. Teach. Sustain. |
| **12-month deliverable** | One basin, completely inventoried — every field, every well, every report located and catalogued | That basin's framework **sourced**: cycles, source rock, charge timing, each with a citation | A published spec + one taught cohort who can extend it without me |
| **Output** | Shared **Understanding** | Shared **Framework** | Shared **Legacy** |

Spoken:
> *"This is not a system to be delivered. It is a capability that compounds — each
> stage only makes sense if the one before it actually happened."*
>
> *"And I would rather do one basin properly than thirteen badly. If the first
> basin cannot be finished defensibly in a year, the plan is wrong and we should
> know that early."*

**Why it matters for this room:** an advisor's instinct is to test the plan. Give
him something concrete enough to attack — a single basin, a year, a named
deliverable. Vague verbs ("Listen. Collect. Measure.") give him nothing to push
against, and a plan he cannot critique is a plan he cannot endorse.

---

### Scene 12 · What could go wrong · *Trust* · 1:30 — **new, and essential**

Three failure modes, stated plainly:

| Risk | Honest answer |
|---|---|
| **It becomes another database nobody maintains** | Then it fails. It only survives if it is the tool people already use to do their work — capture must be a by-product, never a chore |
| **The reasoning captured is wrong** | Provenance is built in. Every record carries whether it is sourced, derived, recalled or asserted. **Today, 626 of 630 basin cycles in the corpus are unverified — and the system says so on every screen** |
| **It stays one person's project** | Then it dies with the person. That is precisely why I am here rather than building quietly for another year |

Spoken:
> *"I would rather name these than have you find them."*

**Why this scene exists:** a Shell-trained geologist trusts the person who
volunteers the weaknesses. This is the slide that converts interest into
willingness to attach his name.

---

### Scene 13 · Beyond one person · *Collaboration* · 1:30 — **restored**

The prototype from scene 10 shrinks to a single point, then the ecosystem
assembles around it — not decoratively, but as named Indonesian institutions:

```
                    Universities · ITB, UGM, Trisakti
                              │
        IAGI ─────────┐       │       ┌───────── Pertamina
                      │       │       │
                 ┌────┴───────┴───────┴────┐
                 │  Shared Geological      │
                 │  Framework              │
                 └────┬───────┬───────┬────┘
                      │       │       │
     SKK Migas ───────┘       │       └─────── Publications & datasets
                              │
                          ???????
```

Connections pulse. The whole graph breathes. **And one node stays empty** — a
dashed outline with a question mark, sitting slightly apart.

Spoken:
> *"Could this become an Indonesian Geological Legacy Initiative rather than a
> personal project? The framework doesn't care who owns it. It only stops working
> if one person does."*
>
> *(indicating the empty node)*
> *"I genuinely don't know what goes here. That's one of the things I came to ask."*

**Why the empty node.** A complete network is a claim: *look at my coalition.* An
incomplete one is an invitation — and it hands him the pen. It also sets up scene
14's third question so that the ask has already begun visually before it is
spoken. This is the cheapest, highest-leverage effect in the deck.

---

### Scene 14 · The ask · *Reflection* · 2:00

Everything slows. Indonesia glows on a near-still globe.

Three questions, one at a time, each held in silence — tuned so that **only he
can answer them**:

> **1.** *Is the missing reasoning a real problem, or one I have invented from
> the outside?*
>
> **2.** *If one basin were done properly — completely, defensibly — which should
> it be? Kutei, because we both know it? Or one where being wrong is cheaper?*
>
> **3.** *Who has to be in the room for this to belong to Indonesia rather than
> to me?*

Then the last line, alone:

> **Future generations should inherit more than data.**
> **They should inherit the way Indonesia understands its geology.**

Fade to black. **No logo. No thank-you slide. No contact details.** The sentence
is the last thing in the room.

---

## 3. The three punchlines, tuned

| Original | Tuned for this room | Why |
|---|---|---|
| *"Indonesia may be one of Earth's richest natural laboratories… we should measure it, not claim it."* | **"Thirteen basins. Every major tectonic setting. A hundred and twenty-six years of discovery, still running. That is measured, not claimed."** | He would immediately test "richest" and we cannot prove it. Diversity and span we can prove, so the claim becomes unarguable |
| *"A nation should not only own its natural resources. It should own the scientific understanding of those resources."* | **unchanged** | It is already the best line in the deck |
| *"Future generations should inherit more than data. They should inherit the way Indonesia understands its geology."* | **unchanged**, but delivered after scene 6 has given "inherit" a face | The book scene loads the word; the closing line spends it |

**The line the deck is actually built around** — scene 4:

> *"Source rock: blank. For the Mahakam.*
> *You could tell me the answer without looking. But you are not in the database,
> and one day you will not be in the meeting."*

---

## 4. Wow effects, ranked by cost-to-impact

| Effect | Scene | Impact | Cost | Verdict |
|---|---|---|---|---|
| **Blanks resolving in a chain that looked complete** | 4 | Highest | Low — typography + opacity | **Build first** |
| Counters landing on `0 of 46` | 5 | Very high | Low | Build first |
| The book, alone, in silence | 6 | Very high | Very low | Build first |
| Real field names in discovery order | 2 | High | Very low | Build first |
| Dark → light as the narrative turn | 8 | High | Medium — GSAP theme tween | Wave 2 |
| Continuous plate-to-well camera | 9 | High | High — the hard one | Wave 2 |
| Earth from dark, 13 polygons igniting | 1 | High | High | Wave 2 |
| Force-directed ecosystem | (cut) | Low | Medium | **Cut** — see §5 |

**The four highest-impact moments are the four cheapest.** A deck that is only
typography and real numbers already lands scenes 2, 4, 5 and 6 — which is the
entire argument. Everything WebGL is amplification.

---

## 5. Original ten → this fourteen

| Original | Becomes | Change |
|---|---|---|
| 1 · A Vision for Indonesia's Geological Legacy | **1 · Where it begins** | Kept. Title arrives later; polygons are real |
| 2 · Why I Am Here | **2 · One basin, one career** | **Compressed.** Seven career stages is a CV; two Mahakam names he knows is credibility |
| 3 · Why Indonesia Is Different | **5 · The measurement** | **Fused with 4** and made literal. "Richest" dropped — unprovable in this room |
| 4 · The Hidden Risk | **3 + 4 + 5** | **Expanded from one slide to three.** The metaphor becomes a specific blank field in a specific basin |
| 5 · Sovereign Geological Knowledge | **8 · Sovereign geological knowledge** | Kept whole. Best line in the deck |
| 6 · Our Common Geological Language | **9 · One common language** | Kept. Now runs on the real Kutei chain |
| 7 · One Possible Implementation | **10 · One possible implementation** | Kept |
| 8 · Three Stages | **11 · Three stages** | ⚠️ **v1.1 demoted this to an appendix — restored.** Now each stage answers a measured gap and carries a 12-month deliverable |
| 9 · Beyond One Person | **13 · Beyond one person** | ⚠️ **v1.1 folded this into a spoken line — restored.** Now a named-institution ecosystem with one empty node |
| 10 · The Ask | **14 · The ask** | Kept. Questions retuned so only he can answer them |
| — | **6 · The book problem** | New — gives *inherit* a face |
| — | **7 · Why now** | New — the window argument |
| — | **12 · What could go wrong** | New — converts interest into willingness to attach a name |

**Nothing from the original ten is cut.** Four scenes are added, one is
compressed, and the original's single "Hidden Risk" slide is expanded into the
three-scene sequence that carries the whole argument.

### The v1.1 mistake, named
Demoting *Three Stages* and *Beyond One Person* removed **Momentum** and
**Collaboration** from the arc. The stated reason — "an advisor doesn't want a
roadmap before agreeing the problem exists" — was only half true. He is an
advisor to Pertamina: *what would you actually do* and *who does this with you*
are the questions his role exists to answer. Withholding them doesn't create
focus, it creates a deck that diagnoses and then stops.

---

## 6. Delivery notes

- **Built to be interrupted.** He will interject during scenes 3–5. Every scene
  must survive being paused indefinitely — `idle()` loops forever, nothing
  auto-advances, ever.
- **Appendix scenes behind `A`**: three stages, full basin table, methodology,
  the data-gap register. Reachable in one keystroke, never in the main flow.
- **~18 minutes of deck for a 45-minute meeting.** The remaining time is the
  point of the meeting.
- **Presenter mode** shows the source and `n` for every figure on screen, so any
  challenge is answered with a file name and a record count rather than a promise.
