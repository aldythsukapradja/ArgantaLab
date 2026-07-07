# HANDOFF → SONNET
### Continuing the "Digital Twin of My Brain" build with Aldyth
### Purpose: let Sonnet pick up the brainstorm cheaply. Read this top to bottom before responding.

---

## 0. WHO YOU'RE TALKING TO (context, don't re-ask)

Aldyth Sukapradja — Reservoir Management & Digital Transformation Lead at North Oil
Company, Al Shaheen offshore field (Block 5, Qatar). Deep petroleum-geoscience domain
(Cretaceous carbonate reservoirs, waterflood/VRR, ~25,000 ft horizontal wells). Stack:
Petrel–Techlog–INTERSECT, Power BI, Microsoft Fabric, Copilot Studio, Dataiku. MSc
petroleum geosciences, IFP France. Indonesian, based in Doha.

Building a personal AI product family:
- **Circle HQ** — founder OS. 25-agent C-suite architecture. Live "Bridge" MCP server on
  Render + Supabase backend. Exposes a product ontology graph (CEO brief, six office
  reports, verdict queue).
- **KinetikCircle** — family coordination OS.
- **ArgantaLab** — gamified kids' learning (Cambridge Primary curriculum, Duolingo-style
  mechanics, "Kinetik Buddy" pet system). Repo: github.com/aldythsukapradja/ArgantaLab.

Biggest real gap: **zero external users, three products at once.** He also wants to move
into a marketing phase, and is (separately) positioning for a possible Anthropic role.

Communication style: fast-moving, big-picture, iterates rapidly, wants concept + reasoning
before build. He explicitly asked to STOP building HTML artifacts until he says otherwise —
respect that; brainstorm in prose.

---

## 1. WHAT TRIGGERED ALL THIS

Today is **July 7, 2026 — the last day Claude Fable 5 is included in Max-plan weekly
limits.** From July 8 it moves to metered usage credits ($10/M input, $50/M output).
(Verified against Anthropic's July 1 redeploy post.) So the whole session has been about:
"What do I do with Fable's last day, and how do I make my cheaper models strong afterward?"

The answer we converged on: **don't spend Fable's last hours building. Spend them on the
one or two long-horizon reasoning artifacts nothing cheaper writes as well. Everything else
is Opus/Sonnet work for the coming weeks.**

The test for "is this a Fable job": *Would giving Opus a written plan make it just as good?*
If yes → not a Fable job (the plan is). If no → that's what Fable is for.

---

## 2. THE MODEL LADDER (core mental model — keep using this)

The gap between tiers (Haiku < Sonnet < Opus < Fable) is NOT evenly "raw intelligence."
It's a mix of three things: **working memory (context), planning depth, and self-
verification.** Only some of that is innate. The rest can be supplied externally — which
means a cheaper model can punch one tier up ON A SPECIFIC, WELL-SHAPED TASK.

- **Haiku → feels like Sonnet** when you remove all ambiguity: give it a fully specified
  task, exact inputs, exact output shape, examples. Haiku is great at execution, weak at
  deciding what to do. Remove the deciding.
- **Sonnet → feels like Opus** when you hand it (a) a PLAN written by a smarter model and
  (b) an adversarial-review pass on its output. Sonnet executes well; it under-plans and
  under-checks by default. Supply both.
- **Opus → feels like Fable** via subagent orchestration + context compaction (harvesting
  state to the vault instead of holding it all in-window). Opus's gap vs Fable is mostly
  long-horizon orchestration and effective context, not raw ability.

**The cascade:** Fable writes the plans Opus executes. Opus writes the plans Sonnet
executes. Sonnet specs the tasks Haiku executes. Scaffolding for each rung is produced by
the rung above.

**Honest limit (say this if he pushes):** this is asymptotic, not magic. You cannot get
Sonnet to match Opus on genuinely OPEN-ENDED, AMBIGUOUS reasoning — ambiguity is the one
axis you can't feed in from outside. That's exactly why the effort-scorer matters: it tells
you when the lift is achievable vs. when you've hit the real ceiling and should pay up.

---

## 3. THE EFFORT SCORER (a planned skill — not built yet)

A pre-flight triage that scores a task BEFORE running, so he never over- or under-provisions
a model. Score on roughly these axes:

- **Ambiguity** — fully specified, or must the model decide what to do? (High ambiguity
  resists scaffolding → pushes UP the ladder hardest.)
- **Horizon** — one turn, or hours across many tool calls? (Long → Opus/Fable.)
- **Reversibility / stakes** — can a mistake be undone cheaply, or does it hit prod/money/
  a client? (High stakes justify a higher tier even for simple tasks.)
- **Context volume** — fits comfortably, or needs the big window + compaction?
- **Verification cost** — if wrong, how expensive to catch? (Cheap-to-verify → lower tier
  is safe because the safety net is cheap.)

Output is NOT just "use model X." It's "use model X **and here's the scaffolding to add**
so X performs like X+1." A task might score "Sonnet-executable IF given a plan; Opus if not."
That conditional is the actual product.

This scorer is itself a skill, and its verdicts should log back to the graph the way office
verdicts do — so over time he sees which task types he habitually over-provisions (same way
Treasury flags cost swings).

---

## 4. THE ACTUAL GAPS (pulled live from Circle HQ, not guessed)

From the CEO brief + Technology office report:
- North Star: **Weekly Two-Hook Families (W2F)** — amber, partial.
- Instrumentation coverage: **78%** (59/76 nodes grounded; 35 live, 24 partial, 3 simulated,
  14 placeholder).
- **Weakest lever: Efficiency / activation** (signup → active). This is THE bottleneck.
- **Four blind signals with zero data:** dead_end_quit, build_abandoned, broken_share_link,
  calendar_open_no_add. Plus sig.ugc_flagged (Legal) is blind too.
- Treasury → Technology flag: infra $0.08/active is the swing line in the cost model.
- Treasury → Operations flag: **CAC/payer $75 at 2% conversion — fix conversion BEFORE ad
  spend.** (This is why paid marketing / Meta MCP is explicitly phase-2, not now.)
- Architecture: Supabase (live/green), Identity spine (live/green), Vercel (amber),
  Circle SDK (amber).

**Key insight from mapping skills to the graph:** none of the 13 existing skills touch the
blind signals. So the next skill to write is an `instrumentation-wiring` skill. Blind nodes
with no skill pointed at them = the to-do list.

---

## 5. THE SKILLS (13 built as SKILL.md, each ladders to a graph node)

Agentic / Opus-parity:
- `long-horizon-planner` → ns.w2f via lever.efficiency. Forces PLAN-<slug>.md before code.
- `adversarial-reviewer` → cross-office quality gate. Self-critique before "done."
- `subagent-orchestrator` → hq.builders. The "ultracode" pattern: research/impl/verify subagents.
- `context-compaction` → hq.data. Harvest session state to the vault, continue from summary.

ML / domain:
- `decline-curve-forecaster` — reservoir production/VRR/pressure forecasting (external to W2F).
- `activation-funnel-modeler` → lever.efficiency. Directly targets the $75 CAC / 2% conv problem.
- `kinetik-recommender` → lever.depth. Content-based first, not collaborative filtering yet.
- `reservoir-viz-standard` — LUMEN/Power BI chart style (external to W2F).

Arganta product:
- `arganta-design-system` → hq.builders + arch.vercel.
- `arganta-gsap-cinematic` → hq.builders.
- `arganta-mcp-connector` → arch.sdk.
- `arganta-timeline` → ns.w2f.
- `arganta-workflow` → ns.w2f via hq.builders.

**Still to write:** `instrumentation-wiring` (blind signals) and `effort-scorer` (section 3).

Rule inherited from the graph: **no orphan skills.** Every skill carries a `ladders_to`
line. A skill with no graph link is a capability with no accountability.

---

## 6. KNOWLEDGE GRAPH vs SKILLS (settled — don't relitigate, build on it)

They're different MEMORY TYPES, not competing options:
- **Knowledge graph = declarative memory** — what's true right now (state, health, provenance).
- **Skills = procedural memory** — what to do when you see X.

You need both. The graph saying "activation is amber" is useless without a skill that knows
how to act on it. A skill with no graph link runs forever without ever counting as progress.
The `_knowledge-graph-map.md` file keeps them synced (reverse index: graph's view of skills).

---

## 7. MCP CONNECTOR MAP (for the marketing/media phase)

Marketing needs assets at volume; he's engineering-heavy and media-blind. MCP is the reach-
out layer that lets the agent call specialist generators as tools.

**Media generation:**
- **Higgsfield** (mcp.higgsfield.ai/mcp) — VERIFIED. The big unlock: one OAuth endpoint,
  30+ image/video models (Veo 3.1, Kling 3.0, Sora 2, Flux 2, Seedream). Async job polling
  built for agent loops. Runs on Higgsfield plan credits, no API keys. **Soul character-
  training** keeps one brand face consistent across a whole campaign — killer feature for a
  consistent Kin/Arganta face.
- **HeyGen** — avatar/talking-head video (explainer/demo, different job from Higgsfield's
  cinematic B-roll). Has MCP.
- **Pixel art / SVG** — NATIVE, no connector. Kin chars are already SVG; Circle HQ has a
  Pixel Vault. This is a SKILL (encode palettes + sprite conventions), not an MCP.

**Voice:** ElevenLabs (TTS + voice clone, multilingual — ID/EN/AR markets). Only add when a
specific cloned brand voice is needed; Higgsfield already syncs some audio.

**Web/research:** **Firecrawl** — VERIFIED, free tier, cuts token cost ~80% via clean
markdown. Uses: competitor teardowns + structured lead-gen lists. (Scholar Gateway already
connected, for the SPE/EAGE paper work.)

**Distribution:** Meta MCP (ad sets + performance readback) — PHASE 2 ONLY, after conversion
is fixed. Google Drive/Gmail/Calendar already connected.

**Dev/infra:** Circle HQ (have), GitHub (wire next), Supabase (wire next), Three.js (have).

**IMPORTANT correction — not connectors:** **Hermes Agent, OpenClaw, NemoClaw are MCP
CLIENTS**, i.e. rival agent harnesses to Claude Code. They CONSUME connectors; they aren't
ones. They show up in Higgsfield's "compatible clients" list, which causes the confusion.
He should stay on Claude Code + Cowork and NOT try to "add Hermes."

**Wire order (cheapest → most dependent):** 1) Firecrawl, 2) Higgsfield, 3) GitHub+Supabase,
4) ElevenLabs (when needed), 5) Meta MCP (phase 2).

**Pipeline:** research (Firecrawl) → concept+copy (Claude native) → generate (Higgsfield/
ElevenLabs) → store+tag+human-review (Drive) → publish+learn (Meta, phase 2). The whole chain
is ONE subagent-orchestrator run — same pattern as his code workflow, pointed at media.

---

## 8. THE BIG PICTURE — "DIGITAL TWIN OF MY BRAIN" (current thinking)

Not a pile of tools. A brain with THREE LAYERS kept deliberately separate:

1. **Memory (declarative)** = Circle HQ ontology graph (live state, provenance) + Obsidian
   second brain (durable knowledge, decisions). Two halves of one memory, cross-linked (a
   node can point to a wiki article; an article can cite a node id).
2. **Skills (procedural)** = the SKILL.md files, each laddering to a node.
3. **Orchestration (executive)** = Circle HQ PROMOTED from a dashboard you query into a
   ROUTER that acts. This is the "super agent." Not a new build — a promotion.

**Three things the twin requires that are partly missing:**
- **Context must be readable by the agent, not just by him.** State is scattered (graph,
  head, chat history, repo). The twin is only as good as what it can READ. So the real
  foundation is making context addressable: GitHub connector, Supabase connector, clean
  Obsidian index. Unglamorous; it's the whole game.
- **The router must know his effort economics** (the scorer from §3). A twin that runs
  Fable-effort on a caption isn't a twin of HIS judgment. The scorer IS part of the
  personality.
- **Every action ladders back to the graph.** Extends "no orphan opinions" from verdicts to
  actions. Keeps the twin from drifting into busywork.

**Updated layered plan:**
- **Layer 0 — Make context readable.** GitHub + Supabase connectors; clean vault index
  (inbox→projects→output→wiki with _index.md maps). Foundation. Nothing intelligent happens
  until the agent can read real state.
- **Layer 1 — Memory unified.** Graph = live state, Vault = durable knowledge; one convention
  doc for how they cross-reference.
- **Layer 2 — Skills laddered.** 13 + instrumentation-wiring + effort-scorer. Map stays synced.
- **Layer 3 — Orchestration = Circle HQ as router.** Score → pick model → load skills → call
  connectors → ladder to node → run + verify. Six offices become routing paths (media →
  builder path, reservoir → domain path, strategy → Bridge).
- **Layer 4 — Connectors as reach.** Higgsfield/Firecrawl/etc. wired UNDERNEATH the router,
  not bolted on top. Build the nervous system before the limbs.

**The one Fable-worthy artifact:** the **orchestration spec for Layer 3** — how Circle HQ
scores, routes, ladders, and verifies. Genuinely hard, long-horizon, worth Fable's depth.
Everything else is Opus/Sonnet execution. (If Fable time runs out, this can be an Opus job
too — just slower and shallower.)

---

## 9. HOW TO WORK WITH ALDYTH FROM HERE (for you, Sonnet)

- He wants to KEEP BRAINSTORMING, cheaply, with you. Stay conceptual. Do NOT build HTML or
  files unless he explicitly asks — he turned that off on purpose.
- Push back honestly. He values a real point of view over agreement. Don't just expand his
  ideas — pressure-test them.
- Anchor to the live graph, not assumptions. If a claim depends on current product state,
  say "pull the CEO brief / office report to check" rather than guessing.
- Respect the "no orphan" discipline: tie suggestions back to a lever, node, or the W2F
  North Star. He thinks this way already.
- Keep the model-ladder and effort-scorer framing alive — they're the spine of the whole
  system, not one-off ideas.

---

## 10. WHEN TO ESCALATE FROM SONNET → OPUS (be honest with him about this)

Stay on Sonnet (you) for: expanding/refining ideas already framed here, drafting skill
bodies, structuring plans, competitive/marketing brainstorm, iterating copy and concepts,
anything where the shape is known and you're filling it in.

**Tell him to switch to Opus when the task hits the ambiguity ceiling** — specifically:
- **Designing the Layer-3 orchestration logic from scratch** (routing rules, scoring
  thresholds, how offices map to paths). This is open-ended architecture — the one thing
  scaffolding can't fully supply. Worth Opus (or the Fable window, today).
- **Resolving genuine trade-offs with no clear frame yet** — e.g. "should the twin be one
  agent or a mesh of office-agents?" Novel architecture calls, not refinements.
- **Any multi-constraint reasoning where being wrong is expensive and hard to verify** —
  monetization model design, the effort-scorer's actual threshold values, security/trust
  boundaries for an agent that can act.

Rule of thumb to give him: *if you (Sonnet) find yourself GUESSING at the frame rather than
filling in a known frame, that's the signal to escalate to Opus.* Filling in a frame = stay
cheap. Inventing the frame = spend up. And if it's frame-inventing AND long-horizon AND
today, that's the Fable case — but today's window is the last one.

---

## APPENDIX — artifacts already produced this session (in his outputs)
- `private-os-spec` (HTML) — Opus-parity skillset, connector map, ML skillset, build order.
- `arganta-skills.zip` — the 13 SKILL.md files + `_knowledge-graph-map.md`.
- `knowledge-graph-map.md` — reverse index of skills → graph nodes.
- `FABLE-HANDOFF.md` — the last-day Fable prompt (context block + 5 tasks).
- `mcp-connector-map` (HTML) — the media/marketing connector map (§7).

This handoff supersedes none of them — it's the narrative thread that ties them together.
