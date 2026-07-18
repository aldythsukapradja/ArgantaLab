# Opus Handoff — Agent Track (post-AS audit, 2026-07-18)

**Decision: ONE Opus stream, end-to-end.** Audited for a Sonnet split: the remaining work is
either judgment-heavy (office grounding in the governance path, mission-feed protocol) or
small enough that a second session's cold-start eats the saving (~15–20% at best, against a
real risk of improvisation in `consult_office`). Not worth it. Opus runs batches **H → G**
below in order, one commit train each, `tsc && vite build` clean at every seam.

## Fable audit of what's already shipped (context, don't redo)

| Verified working | Evidence |
|---|---|
| Character Forge display fix (`.charforge`/`.cf-*`) | grid computes `250px 488px 330px`, stage renders |
| `data/agentFabric.ts` shared registry | Architecture Agents view + Agent Studio both show the same 25 cards/probes; a registry rename propagated to both from one edit |
| Renames/swap (Agent Studio→Studio group, Pixel Forge→Forge group) | rail, mobile nav, palette, intents, seed, labels — ids unchanged |
| Agent Studio 5 tabs, full-bleed | `agents` added to Shell's `full` list; `.ags` = viewport height; probes real (Bridge/ComfyUI); Author test pane runs the real Sense→Compute→Match→Generate; fake $2.20 deleted; old Agents.tsx (Council/Orchestration theater) deleted |

## Audit findings — the honest gaps (these ARE the handoff)

- **F1** Missions tab is a stub: it shows bridge connection state but never lists missions,
  even when connected. No feed subscription, no approval chips.
- **F2** Author tab doesn't persist: fields are `defaultValue` (uncontrolled) — edits vanish
  on tab switch. Honestly labeled, but functionally read-only.
- **F3** Tokenomics is shallow: provider bar list only — no tier (Sovereign/Sponsored/
  Economy/Frontier) breakdown, no by-task split, no trend; session runs read once at mount.
- **F4** Probes fire once on Studio mount — no refresh interval or manual refresh; a bridge
  started mid-session stays "offline" until surface remount.
- **F5** Mobile: inspector rail is `display:none` under 980px — content unreachable; spec
  called for a bottom sheet.
- **F6** CTO/GC/CAPO offices still personas (`GROUNDED_OFFICES = {operations, treasury}`) —
  the C-level gap, unchanged.
- **F7** Registry CRUD: agentFabric is static data; Author edits have no write path (fine
  for now — persistence design lands with G2, don't invent tables early).

## Batch H — Agent Studio hardening (F1–F5) · `apps/hq/src/surfaces/agent/AgentStudio.tsx` + `agent.css`

1. **H1 · Missions feed (F1).** Use `BridgeClient` from `src/lib/bridge/client.ts` (the
   exact client BridgeConsole uses — do NOT hand-roll a socket). When bridge probe =
   connected: connect read-only, render mission list from streamed OutEvents
   (`status | tool | message | awaiting_approval | artifact | done | error`) with status
   chips + engine mark (ClaudeMark/OpenAIMark). `awaiting_approval` renders an amber chip
   deep-linking to Arganta Core (`go('core')` via `useHQ`) — approval STAYS in Core, no
   parallel approval UI. Keep the honest empty when no missions. Read BridgeConsole.tsx
   first and mirror its event handling; if the client can't attach without consuming the
   console's session, show "mission feed requires an active Core session" honestly instead
   of forcing it — do not destabilize BridgeConsole (it is production for the founder).
2. **H2 · Author persistence (F2).** Controlled fields + localStorage overlay
   (`hq_agent_overrides_v1`: `{[agentId]: {mission?, inputs?, model?}}`). Merge overlay over
   `AGENTS` at render in Author + Roster; "edited" badge + per-agent Reset. No Supabase.
3. **H3 · Tokenomics depth (F3).** Add: runs-by-tier bars (costClass 0–3, tier names +
   colors from agentFabric `AGENT_COLORS`/rack TIER_META), cost-by-provider ($, only when
   costUsd > 0 exists), 14-day daily run sparkline from `created_at`. Reuse the existing
   `.ags-bars` pattern; d3 chartkit only if trivially applicable. Every figure stays
   measured-or-absent.
4. **H4 · Probe refresh (F4).** 60s interval + manual refresh button on the probe chips;
   clear interval on unmount; re-probe also when Missions tab is opened.
5. **H5 · Mobile sheet (F5).** Under 980px the inspector renders as a bottom sheet (reuse
   the pattern from Post Studio's `.pbx` sheets in `surfaces/broadcast/post.css`) instead of
   `display:none`.

Acceptance H: with the bridge running, a mission started in Core appears in Missions with
live status; an Author edit survives tab switches and reload and shows in Roster; Tokenomics
shows tier + provider + trend from real rows (or honest empty); probe chips flip within 60s
of starting/stopping ComfyUI; on a 390px viewport every tab's content is reachable.

## Batch G — C-Level grounding (F6) · `apps/hq/src/lib/core/tools.ts` + `src/data/agents.ts`

Read `docs/agent-os-v2-c-level-revamp.md` §3 (CL-1..CL-4) first. Pattern to follow is the
existing operations/treasury path in `runConsultOffice` — deterministic Sense→Compute→Match,
LLM only at Generate, honest degrade at every step. THE RULE: if anything here is ambiguous,
STOP and kick back to Fable — do not improvise in this file.

1. **G1 · `techSense()`** (new, in `src/data/agents.ts` or a sibling `officeSense.ts`):
   `probeComfy()` + `probeBridge()` from `data/agentFabric` + `agent_runs_recent`/
   `agent_runs_capo` RPC aggregates (gateway failure rate = share of runs where
   actualProvider='mock' but requested≠mock; SCR; fallback count) + `schemaInsights`.
   Match rules → signals: bridge offline, ComfyUI engine missing, gateway failure > 20%,
   SCR < 50%. Add `'technology'` to `GROUNDED_OFFICES`; wire the office branch exactly like
   operations (facts string → `governedOfficeChat`, dataClass 'internal' — probe/ledger
   facts are not confidential; offline → deterministic template, no LLM call).
2. **G2 · `capoSense()`**: `agent_runs` cost by provider + tier + 30d totals, run counts,
   SCR trend; roster size from `AGENTS`. Kills the static roster-only answer; `'roster'`
   moves from static branch to grounded branch (keep the org-shape sentence, add the
   measured economics). Any remaining "$2.20" or fictional model-label string in
   `agentGenerate`'s `agents`/`focus`/`economy` templates: replace with measured values or
   drop the line.
3. **G3 · honest badges sweep (CL-8 remnant).** Grep `Sonnet 4.6|Haiku 4.5|\$2\.20` across
   `src/` — every remaining hit either becomes ledger-derived, clearly marked "planned
   model", or is deleted. `MODEL_META` labels in the roster are the design intent (planned
   floor) — relabel the UI copy to say "model floor", don't fake it as runtime truth.
4. **G4 · Agent Studio reads the grounding.** Author tab's `GROUNDED` set imports the real
   `GROUNDED_OFFICES` (export it from tools.ts) instead of its local copy — one more
   drift-pair closed.

Acceptance G: `consult_office {office:'technology'}` with bridge off + ComfyUI on returns a
report naming the bridge offline and citing the measured gateway-failure/SCR numbers (not
persona vibes); `{office:'roster'}` cites real 30d cost by provider; no fictional model/cost
string survives `grep`; Author badges match tools.ts truth automatically.

## Not in this handoff (Fable holds)

O3 (scorecard cockpit, wedge C1–C3, BrainSeam) — after H+G land and the founder tests.
Verdicts migration (CL-6) — needs a Fable schema pass first.
