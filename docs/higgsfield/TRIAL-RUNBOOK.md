# Higgsfield 1-Day Trial — Step-by-Step Runbook

Companion to `HIGGSFIELD-PUNCHLIST.md`. The trial = **24h UNLIMITED**, relaxed mode (1 image + 1 video at a time). Goal: **~525–1,000 generations ≈ 4,000–5,000 cr-equivalent at $0.**

**Legend:** 👤 = YOU (founder, manual action) · 🤖 = CLAUDE (I drive via the MCP)

> **AUTONOMOUS MODE.** This run is driven unattended by Claude Code — see `AUTONOMOUS-RUN.md` (the driver/loop) + `TRIAL-RUN-QUEUE.md` (all prompts). Your job shrinks to **4 one-time actions**: activate the trial, pre-approve the tools, keep the session online, cancel renewal. I do every prompt, generation, poll, download, retry, and log.

---

## Why 3,000+ and not 1,130
1,130 cr = one polished variation of each named deliverable. The trial is free + unlimited, so you make **3–4 variations of everything + a reserve library** and keep the winners. Over-generation is the point — the scarce resource is the **video lane** (1 clip at a time, ~5–8 min), never credits.

---

## PHASE 0 — PREP (before activating · ~1–2h · $0)
Do NOT start the clock until this is done. Prep is the whole game.
- [ ] 👤 Confirm reference material: 5 influencer sheets ✅ · any reactor/energy look refs · real product screenshots for the films · brand colors (already in `docs/arganta-design-system/Design-Language.md`).
- [ ] 🤖 Build **`TRIAL-RUN-QUEUE`** — every video + image prompt pre-written and ordered (both lanes). *(ask me to generate this)*
- [x] ✅ **Tools pre-authorized** — done in `.claude/settings.local.json` (`mcp__e1a94d30…__*` + `Bash(curl:*)` + `mcp__pixellab__*` allowed; deploy/publish/secrets/`cancel_trial_auto_renewal` denied). The loop never stalls on a prompt; billing tools stay out of my reach.
- ℹ️ **Model plan (locked):** Opus seeds queue + anchors (Phase A) → **Sonnet** drives the 24h loop and the PixelLab avatars. See `AUTONOMOUS-RUN.md` → Model assignment.
- [ ] 👤 Pick your 24h window and plan ~12–16 active hours (you don't need to stare at it, but be reachable to approve + pick winners).
- [ ] 👤 Have a valid card ready (required to start; $0 charged today).

## PHASE 1 — ACTIVATE (T-0 · ~5 min)
- [ ] 🤖 I open the trial widget.
- [ ] 👤 Complete card + 3D Secure to start the trial.
- [ ] 👤 **IMMEDIATELY set a phone reminder: "Cancel Higgsfield renewal" for July 23, ~07:30** (before the 08:19 auto-charge).
- [ ] 🤖 Confirm unlimited is live, then **start the video lane on the reactor splash** — second 1.

## PHASE 2 — RUN (Hr 0–22 · autonomous loop)
- [ ] 🤖 I run the self-scheduled driver loop (`AUTONOMOUS-RUN.md`): 1 video + 1 image in-flight at all times, poll every ~6 min, download completions, retry failures, log the ledger — all unattended from `queue.json`.
- [ ] 👤 **Keep the Claude Code session/host online** — that's the only thing the loop needs from you during the 24h. If it sleeps, the loop pauses and resumes from state when back (nothing lost).
- [ ] 👤 *(optional)* glance at the library and flag any variation you love; I keep all of them regardless.

**Milestones:**
| By hour | Done |
|---|---|
| Hr 0 | 5 Souls training started · reactor splash/outro rendering |
| Hr 4 | Reactor variants + all 3D meshes complete |
| Hr 10 | Film b-roll + influencer reels complete |
| Hr 16 | Ambient loops + hero films complete |
| Hr 22 | Reserve library + variations complete |

## PHASE 3 — FINISH (Hr 22–24)
- [ ] 🤖 Reframe masters → 9:16 / 1:1 / 16:9; upscale final winners → 4K.
- [ ] 🤖 **Download EVERYTHING** to the repo — nothing stranded on Higgsfield when the day ends.
- [ ] 🤖 Update the audit ledger with final counts.

## PHASE 4 — CANCEL (before 08:19 Jul 23 · 👤 only)
- [ ] 👤 Manage Account → Subscription → **Cancel renewal** → confirm on screen.
- [ ] Result: $0 ever charged · you keep unlimited until the trial ends · account then reverts to free. *(I cannot do this for you — it's your account/billing.)*

## PHASE 5 — POST-TRIAL (my work · $0 · off the clock 🤖)
- [ ] Wire assets into the live reactor (`apps/hq/src/reactor`), interactive 3D web, app components, website.
- [ ] Confirm the 5 Souls persisted → all future images cost 0.12 cr.
- [ ] Ship the `higgsfield-tracker.html` + Command Center MCP subtab.

---

## The 3 things ONLY you can do
1. **Activate + card** (Phase 1) and **Cancel renewal** (Phase 4).
2. **Winner-selection** judgment during the run.
3. **Keep the session reachable** so the lanes don't stall.

Everything else — every prompt, every generation, every download — I drive.
