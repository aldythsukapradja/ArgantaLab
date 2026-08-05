# Fieldcraft Story Deck — Current Spine

The working outline. **This is the thing to critique and improve**, not a
finished artefact. Roughly 42 slides across three acts, 60–90 seconds each.

Day shape:

| Block | Duration |
|---|---|
| Act I · Exploration (story) | ~50 min |
| → Mission 1 · hands-on in the Exploration workspace | 60 min |
| Act II · Field Development (story) | ~60 min |
| → Mission 2 · hands-on in the Field Development workspace | 75 min |
| Act III · Reservoir Management (story) | ~55 min |
| → Mission 3 · hands-on in the Reservoir Management workspace | 60 min |
| Epilogue · The Agent | 30 min |

The story deck is the spine of the day. Missions are the interludes, not the
other way round.

---

# ACT I — EXPLORATION
### *"Oil is first found in the minds of men"*

| # | Punchline title | Visual (existing component) | Key figure / data |
|---|---|---|---|
| 1 | Everything you're about to see happened 3 km below this water | Cockpit map, satellite theme, globe → North Sea → block 15/9 | Live fly-to over 17k field records |
| 2 | The name is the geology: a "graben" is a piece of crust that fell | `BasinPlateGallery` — rift schematic | Viking Graben cross-section |
| 3 | 150 million years ago this was a desert that tore itself apart | `basin-plates` through geologic time (`geo-time.ts`) | Jurassic rifting sequence |
| 4 | The kitchen: rock that was once plankton, buried until it cooked | `BasinCharts` — petroleum-system events chart | Source maturity window |
| 5 | Presence is not effectiveness | `DepositionalSchematic` — element chain, deleted link by link | Source · Reservoir · Seal · Trap · Timing |
| 6 | Salt moved. The trap existed before the oil arrived. That order matters. | Structure + timing overlay | Trap-vs-charge timing |
| 7 | Nobody has ever seen oil in the ground. Everything here is inference. | Basin Dossier (`KnowledgeBank`), live | Truth classes on real records |
| 8 | Basin → play → lead → prospect is a ladder of work, not of certainty | `PlaysProspects` | Maturity ladder |
| 9 | Five numbers multiplied. The weakest one owns the answer. | `Risk` — chance-factor editor | GCF → GCoS |
| 10 | Chance and volume are two axes. Blend them and the decision dies. | `Volumetrics` (exploration) | P90/P50/P10, risked mean |
| 11 | The big ones are always found first | `CreamingCurve`, scrubbable | North Sea discovery history |
| 12 | In 1993 somebody signed a piece of paper, and a rig went to 15/9 | Cockpit well dossier | Discovery well record (bound) |
| 13 | Appraisal is buying information — and only information that changes a decision | `Wells` + `Interpretation` | Appraisal wells, what moved |

### 🤖 Agent interlude — placed after slide 11

| Human does | Agent does | Only human can |
|---|---|---|
| Reads the basin, judges analogue relevance | Assembles the evidence pack, classifies every number, finds analogues | Decide whether the analogue *is* an analogue |
| Assigns the five chance factors | Shows which factor the evidence actually supports; flags double-counting | Own the consequence of being wrong |
| Runs the volumetric case | Re-runs against every source record, reports disagreements | Say "we stop" |

Demo beat: the Exploration Agent builds the pack in ~90 seconds, then **declares
a gap it cannot evidence**. Line: *"It just told you what it doesn't know. When
did a consultant last do that?"*

⚠️ Risk: the Exploration agent is BETA. This is the least safe demo in the day.

### 🏆 Act I takeaway *(rewrite me)*

> **The rock was always there. What changed was what someone believed about it —
> and belief, unlike rock, can be audited.**

### ✨ Act I wow moment
Run the creaming curve backwards and let the room watch a whole basin's
discovery history collapse into a shape that was predictable decades early.

---

# ACT II — FIELD DEVELOPMENT
### *"From a picture to a machine"*

| # | Punchline title | Visual (existing component) | Key figure / data |
|---|---|---|---|
| 1 | You found it. Now prove somebody should spend a billion dollars. | `FieldDossier` | The FDP question |
| 2 | A log is not a picture of rock. It's an electrical argument about rock. | `LogsView` on real Volve LAS | GR · RHOB · NPHI · RT |
| 3 | Four curves become one number, and every step is a choice | `Petrophysics` | Vsh → PHIE → Sw → net pay |
| 4 | Move the cutoff five units and watch the field change size | `Petrophysics`, cutoff live | Net pay sensitivity |
| 5 | One well is an anecdote. Correlation is where a field is born. | `CorrelationView` | Well-to-well Hugin correlation |
| 6 | Two wells, one surface, infinite guesses in between | `XSection` + `Structural` | Horizons, faults |
| 7 | The contact is the most valuable line in the field, and nobody has seen it | `Map3D` / `contact-contour` | OWC, GRV |
| 8 | A million cells, each one a guess with a number attached | `GridModelView` / `GridCube3D` | Static grid, property population |
| 9 | STOIIP is five uncertain numbers multiplied together | `GridVolume` | GRV × NTG × φ × Sₒ ÷ Bₒ |
| 10 | The headline number is an upper bound wearing a suit | `Uncertainty` — tornado | P10/P50/P90 spread, top driver |
| 11 | Volume is not production. Now make it flow. | `SimulationView` / `SimDrape` | Dynamic model, pressure field |
| 12 | Every well is a bet on a part of the field you cannot see | `WellCountPanel` + `well-paths` | Well count vs recovery |
| 13 | A plateau is a promise. A decline is a fact. | `Forecast` (field dev) | Plateau → decline profile |
| 14 | The reservoir doesn't decide. The oil price does. | `Economics` | NPV, breakeven, price deck |

### 🤖 Agent interlude — placed after slide 10

| Human does | Agent does | Only human can |
|---|---|---|
| Picks cutoffs, tops, contacts | Re-runs the whole chain for every plausible cutoff, shows sensitivity | Defend one specific pick |
| Builds one static case | Builds the case *and* its lineage — every cell traces to a log | Accept the model as fit for purpose |
| Reads the tornado | Ranks which uncertainty is worth paying to reduce, and prices the data | Sign the capital request |

Demo beat: ask the agent *"which single measurement would most change this FDP?"*
It answers from the tornado, not from opinion.

### 🏆 Act II takeaway *(rewrite me)*

> **A model is not a picture of the reservoir. It is a machine for making one
> decision — and every model is wrong somewhere you haven't looked.**

### ✨ Act II wow moment
Change one petrophysical cutoff on stage; STOIIP, well count, NPV and the
investment decision all move together, live, in under ten seconds.

---

# ACT III — RESERVOIR MANAGEMENT
### *"The field starts talking back"*

| # | Punchline title | Visual (existing component) | Key figure / data |
|---|---|---|---|
| 1 | 2008. First oil. For a while, everything is easy. | `Production` — timeline starts | Dry oil, zero water cut |
| 2 | A reservoir is a balloon, and you just opened the valve | `Pressure` | Pressure decline vs depletion |
| 3 | Cross the bubble point and the oil starts leaving gas behind | `Pressure` + GOR track | Pb, GOR rise |
| 4 | Free gas is the most expensive mistake in reservoir management | `Production` — GOR | Gas coning, lost energy |
| 5 | So you push water in. Not to make oil — to keep the pressure. | `InjectionVrr` | Injection start |
| 6 | Put back what you take out, or the field decides for you | `VrrPanel` | VRR ≈ 1.0, voidage balance |
| 7 | A water injector earns exactly as much as a producer. It just never gets credit. | `Patterns` | Injector–producer pairs |
| 8 | Then, one day, the well produces water | `Production` — WCT curve | Water breakthrough |
| 9 | Coning, channelling or layering — three problems, three answers, one curve | Chan plot · `SurveillanceDossier` | Water-path classification |
| 10 | The well is telling you which one. You just have to know the language. | `WellTests` + `WellReviewCards` | Well test vs history |
| 11 | Without injection, decline is exponential. With it, you buy years. | `Forecast` — Arps | b-factor, decline scenarios |
| 12 | Reserves are not what's there. Reserves are what's there **and** economic. | `Opportunities` + recovery factor | RF, remaining vs recoverable |
| 13 | Every field has a day where the next barrel costs more than it sells for | `Economics` — economic limit | Opex vs revenue crossover |
| 14 | In 2016 that day arrived. The rock still had oil in it. | Production tail → cessation | Shutdown, abandonment |
| 15 | Volve didn't die of geology | Full timeline 1993 → 2008 → 2016 → 2018 | Complete lifecycle on one axis |

### 🤖 Agent interlude — placed after slide 9

| Human does | Agent does | Only human can |
|---|---|---|
| Spots the water-cut rise | Detects the deviation against forecast the week it starts, not the quarter | Judge whether it's worth intervening |
| Classifies the water path | Runs Chan on every well every day, ranked by confidence | Overrule it when well history says otherwise |
| Proposes a workover | Prices the intervention against remaining reserves | Commit the rig |

Demo beat: the RM Agent flags the water-cut deviation **and names which
diagnostic it used**. Then show a well where it got the classification wrong,
and make the room catch it.

### 🏆 Act III takeaway *(rewrite me)*

> **Volve didn't die of geology. It died of arithmetic. Oil left in the ground
> isn't a technical failure — it's a price, an opex number, and a date.**

### ✨ Act III wow moment
Final slide puts 1993 → 2008 → 2016 → 2018 on one axis and asks: *"At which
point could a different decision have changed the ending?"* Then reveal that the
only reason the question can be asked is that the data was released — and
they've spent the day inside it.

---

## Known weak points — please attack these

1. **Act transitions are undesigned.** Act I ends on appraisal, Act II opens on
   "you found it". That's a hard cut, not a transition. Same between II and III.
2. **The cold open may be too slow.** Three slides of geology before anything
   happens. Does the room stay?
3. **Act II slides 5–8 are a march.** Correlation → structure → contact → grid
   is technically correct and dramatically flat.
4. **Act III has 15 slides, Act I has 13.** Probably both wrong. Pacing unchecked.
5. **The epilogue is undefined.** After Act III the agent gets 30 minutes and
   there's no script for it.
6. **No emotional low point.** Good stories have one. Currently the day declines
   gently from discovery to abandonment with no single gut-punch.
7. **Nothing personal.** No people in the story. Volve was drilled, built and
   shut down by humans making calls under uncertainty, and none of them appear.
