# Tri-Brain Studio Map + Arganta Core Revamp

Extends: docs/arganta-core/Tri-Brain-Plan.md (capsule UI + bridge engines —
BUILT in working tree, uncommitted as of 2026-07-18) and
docs/media-center/Studio-Redesign-Spec.md (R1–R5).

## The doctrine — what each brain IS

| Brain | Nature | Runs | Cost | Personality in the UI |
|---|---|---|---|---|
| **Sovereign** | The HANDS — renders bytes, computes, remembers | Local: ComfyUI engines (image·music·video, verified), deterministic browser engines, Supabase data | $0 always | Arganta mark, `--acc`. Instant or honest-progress. Never talks — it produces. |
| **Claude** | The CREATIVE DIRECTOR — content, taste, orchestration | Bridge → Claude Agent SDK on your machine + MCP tools (content_draft, buffer, pixel briefs, media-gen) | Plan-covered | Sunburst, clay #D97757. Conversational; drafts, curates, publishes through gates. |
| **Codex** | The ENGINEER — changes the software itself | Bridge → Codex CLI sandbox (workspace-write, network off) | Plan-covered | OpenAI knot, teal #10A37F. Terse; diffs, tests, builds features. |

One sentence: **Sovereign makes the media, Claude makes the content, Codex
makes the tools.** Every studio exposes all three through the SAME two
controls: the SovereignChip (R1) and a **Brain seam** (the studio's copilot,
upgraded).

## The Brain seam (new shared component, replaces per-studio copilot chats)

Today each studio has its own bespoke bot (Post Copilot, Music Composer, Video
Director) wired to the flaky llm-proxy (`aiLive` is untrustworthy — see
builder-stage1 memory). The seam unifies them:

- Same panel chrome as today (slide-over on the stage), but with the tri-brain
  capsule row at its head — Sovereign · Claude · Codex.
- **Sovereign tab** = the deterministic composer that always works offline
  (localPost / localCompose / localStoryboard). Honest label: "offline draft".
- **Claude tab** = the SAME conversation, routed through the Bridge when
  connected (studio context injected: current doc/theme/timeline as the
  mission context), falling back to Sovereign when not. This replaces the
  llm-proxy dependency with the bridge you actually run.
- **Codex tab** = "studio missions": prompts that change the SOFTWARE, not the
  doc — pre-seeded with the studio's file map ("add a template", "new
  transition", "fix export"). Runs sandboxed; results arrive as a bridge
  mission with diff summary.
- The seam is ONE component (`BrainSeam.tsx`) with per-studio config
  (context provider fn + starter prompts per brain) — the BridgeConsole
  ENGINES-map pattern, one level up.

## Functionality map — every tab × three brains

| Tab | Sovereign (makes media / computes) | Claude (makes content) | Codex (makes tools) |
|---|---|---|---|
| **Post Studio** | z-image slide backgrounds + ARGANTA LoRA (O1); PNG compose/export; deterministic copy fallback | Copilot prompt→carousel; captions/polish; drafts inbox fulfilment; /post-batch; Buffer/Moment publishing runs | "add a 6th platform preset", "new sticker pack", template authoring |
| **Audio Studio** | ACE-Step songs (Generate scope); synth themes/SFX; recording; voice audition (browser TTS → comfy-TTS) | Composer chat (mood→theme; lyrics writing for ACE Custom mode); audio_draft briefs; naming/tagging feed items | "add a new instrument to the synth engine", "new SFX cue", scale/chord additions |
| **Video Studio** | Wan clips (Generate mode); timeline render/export; formant→registry voice | Director chat (brief→storyboard→scenes w/ generated bgs); caption/script writing; publish runs | "add a transition type", "new text animation", export preset work |
| **Pixel Studio** | ComfyUI pixel-LoRA one-offs; palette ops; vault queries | Fulfils Forge briefs via PixelLab MCP + pixel_vault_ingest; tags/classifies ingest; usage-gap triage ("wire these 3 missing keys") | "new facet", "sprite-sheet slicer", vault tooling |
| **Arganta Core** | Data conversations: RPCs, charts, valuation — the existing Sovereign chat | Full missions: cross-studio content ops ("draft next week's posts + a reel"), C-suite asks | Full repo missions: features, fixes, refactors |
| **Media Center** | Sovereign Rack: engines, queue, test renders | "generate this week's asset needs" batch missions | pipeline/tooling missions |
| **Cinema / Copilot control** | Voice registry playback (jarvis/lady); karaoke timing | Re-script scenes; re-record batches; command-phrase authoring | new scene actions / gesture commands |
| **Builder Forge** | deterministic app/game engines | brief→app chat (existing) | THE Codex home: real code missions on generated artifacts |

Rule of thumb baked into the UI copy: if the output is **bytes** it's
Sovereign, if it's **words/decisions/publishing** it's Claude, if it's a
**diff** it's Codex.

## Arganta Core revamp — Post Studio-grade polish

Post Studio's translation to a chat surface (benchmarks: ChatGPT/Claude apps —
but ours must feel like the SAME family as the studios):

- **Hero = the conversation** (already true). Polish: max-width 760px measure,
  message groups with 24px rhythm, sticky date/thread header, orb docks
  top-right small instead of floating over content.
- **Three-scope inspector** (the Post Studio move, NEW here): right rail /
  mobile bottom sheet with **Threads** (existing rail, moves in) ·
  **Context** (what this brain can see: for Sovereign the data sources; for
  Claude/Codex the cwd, model, permission mode, gated-actions list) ·
  **Missions** (live + past bridge missions with status chips, resumable).
- **Composer** (the one element users touch most — make it excellent):
  auto-grow textarea, brain capsule INSIDE the composer left edge (current
  brain mark + model pill, click = switch), attach chip (image→vision when
  supported), Enter/Shift-Enter, streaming stop button, offline state honest
  per brain (Sovereign always available; Claude/Codex show connect pill).
- **Feed cards**: keep Markdown/artifact/chart blocks; unify tool-call lines
  with BridgeConsole's style (one vocabulary for "the agent did a thing");
  completion capsule (model + mark) already good — keep.
- **Connect popup** (P1 of Tri-Brain plan — in working tree): keep; add the
  same dialog for Codex with its prerequisite note (`npm i -g @openai/codex`,
  `codex login`).
- **Mobile**: threads = left drawer (existing pattern ok), inspector = bottom
  sheet, composer sticky above keyboard, brain capsules stay visible in a
  compact 3-icon row.
- **Design tokens**: reuse post.css families (pills, sheets, capsule
  geometry); no new visual language. The chat should feel like Post Studio's
  sibling, not a different product.

## Build plan (T-track; assumes R1 SovereignChip ships first or alongside)

- **T0 — Land the working tree** (½ day, FIRST): the tri-brain UI + codex
  engine sit uncommitted. Verify against Tri-Brain-Plan acceptance (5 checks:
  no overlap, three capsules both mounts, Claude regression, Codex real
  mission, tsc+build clean incl. bridge), then commit+push. Nothing else
  builds on uncommitted code. (If the other session is still active on these
  files, coordinate — do not double-edit.)
- **T1 — Core polish pass** (1 day): inspector 3-scope rail (Threads/Context/
  Missions), composer upgrade, orb docking, feed rhythm, mobile sheet — pure
  UI on the existing conversation + bridge feeds.
- **T2 — BrainSeam component** (1 day): extract capsule row + per-brain panel
  shell from ArgantaCore/BridgeConsole into `surfaces/shared/BrainSeam.tsx`;
  studio context providers; Sovereign fallback wiring; mission-with-context
  message to the bridge (`context` field added to mission msg — server passes
  it into the prompt preamble).
- **T3 — Studio adoption** (1.5 days): replace Post Copilot, Music Composer,
  Video Director panels with BrainSeam (keep their deterministic engines as
  the Sovereign tab); add seam to Pixel (Forge rail's "ask Claude to fulfil"
  becomes the Claude tab); Codex starter prompts per studio (read-only file
  maps, no auto-run).
- **T4 — Map visibility** (½ day): a "Brains" popover from the SovereignChip
  showing this tab's tri-brain map row (the table above, per-surface) — the
  doctrine becomes discoverable in-product; Media Center gets the full map.

Ordering with the R-track: T0 → R1 → (R2/R3/R4 and T1/T2 can interleave) →
T3 after R2 lands for Audio. Every phase: 7-step DoD from the battle-test
spec + Claude-tab regression (the bridge is production for the founder — never
break connect/mission/approval).

## Battle-test deltas specific to this track

1. Bridge down + studio seam open → Claude tab shows connect pill, Sovereign
   tab still fully works; NEVER a dead composer.
2. Codex not installed → engine error surfaces as friendly dialog copy (P4
   already specs this), seam Codex tab shows install steps.
3. Mission context too large (a 30-slide doc) → context provider truncates
   with an honest "sent 12 of 30 slides" note.
4. Two studios open seams simultaneously → missions are per-studio-keyed;
   feeds never bleed (key={surface+engine}).
5. Approval prompt while user is in another tab → the Missions scope badge
   counts awaiting_approval; toast deep-links to it.
6. Sovereign-only mandate: brain capsules show NO cost UI; Codex/Claude are
   plan-auth (already local `codex login` / Claude plan) — still zero
   marginal-billing paths.
