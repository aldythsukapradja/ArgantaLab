# Higgsfield Trial — Autonomous Run (Claude Code driver)

How Claude Code drives the 24h unlimited trial **unattended**, filling both lanes until the queue is empty. Companion to `TRIAL-RUN-QUEUE.md` (the content) and `TRIAL-RUNBOOK.md` (the human steps).

---

## The engine in one picture
```
  queue.json (all prompts + status)
        │
   ┌────▼─────────────────────────────────────────┐
   │  DRIVER LOOP  (self-scheduled every ~6 min)   │
   │  1. poll in-flight jobs (job_display)         │
   │  2. completed → curl asset to repo, log ledger│
   │  3. failed → retry once, else mark failed     │
   │  4. refill lanes: keep 1 video + 1 image in-  │
   │     flight (3D shares video lane)             │
   │  5. fire opportunistic audio/soul if idle     │
   │  6. save state → ScheduleWakeup(next) OR stop │
   └───────────────────────────────────────────────┘
```
The loop is driven by **ScheduleWakeup (dynamic /loop)** — each wake re-invokes the driver with the queue state intact. It runs until `queue.json` has no `queued` items, then emits a final report.

## State file — `higgsfield-assets/_state/queue.json`
```json
{
  "items": [
    { "id": "VB1-01", "lane": "video", "model": "kling3_0",
      "prompt": "…", "refs": ["media_id"], "variation": 1,
      "status": "queued", "job_id": null, "out": "higgsfield-assets/reactor/splash-v1.mp4",
      "batch": "VB1", "campaign_core": true }
  ],
  "concurrency": { "video": 1, "image": 1 },
  "updated": "…"
}
```
Statuses: `queued → inflight → done | failed`. `campaign_core: true` = must-finish-first items (front-loaded).

## Per-iteration algorithm (what I run each wake)
1. **Reconcile:** for every `inflight` item, `job_display(job_id)`. If `completed` → `curl` the `rawUrl` into `out`, set `done`, append a row to the ledger in the punchlist. If `failed`/errored → retry once (re-fire), else `failed` + log.
2. **Refill video lane:** if 0 videos `inflight` and any `queued` video/3D remains → fire the **highest-priority** one (`campaign_core` first, then batch order). 3D counts as a video-lane slot.
3. **Refill image lane:** if 0 images `inflight` and any `queued` image remains → fire the next.
4. **Opportunistic:** if a `soul`/`audio` item is ready and its lane is free, fire it (fast, separate).
5. **Persist + schedule:** save `queue.json`; if work remains → `ScheduleWakeup(~360s)`; else → stop + write `FINAL-REPORT.md`.

## Coherence gate — Phase A before Phase B (CRITICAL)
The driver runs **anchors first** so every later asset references them (see `DESIGN-COHERENCE.md`):
1. Generate master brand-world + reactor + energy + persona-bootstrap frames.
2. Create the **Brand / Reactor / Energy Elements** (`show_reference_elements`) + **train 5 Souls** (`show_characters`); store their IDs in `queue.json`.
3. **Gate:** no Phase-B item fires until its required anchor ID exists. The driver skips (leaves `queued`) any item whose anchor isn't ready yet, and picks it up once the anchor lands.
4. Every Phase-B prompt is auto-rewritten to embed its anchor `<<<element_id>>>` + the STYLE suffix. → this is what makes all visuals "talk to each other."

## Lane rules (relaxed mode = 1 image + 1 video)
- Exactly **1 video in-flight** and **1 image in-flight** at any time. Never fire a 2nd of the same lane.
- Video is the bottleneck → it always leads; `campaign_core` video first.
- Poll cadence ~6 min ≈ typical video completion, so the video lane is refilled the moment it frees.

## Downloads (nothing stranded)
Every completed asset is `curl`-ed immediately into `higgsfield-assets/<track>/<batch>/…` in the repo. Winners for the website/apps get curated later; the raw library stays in `higgsfield-assets/`.

## Curate into HQ (post-run, on "curate winners into HQ")
The run only STAGES to `higgsfield-assets/`. A separate curate step copies the picks into the HQ consumer paths per the integration map in `HIGGSFIELD-PUNCHLIST.md` §4b — brand assets → `packages/brand/brands/<brandId>/assets/`, influencer → `apps/hq/public/influencer/`, reactor → `apps/hq/public/reactor/`, etc. Because the run reads brand facts from `@arganta/brand` and writes back to the same registry, HQ Brand Studio and the automated flow stay consistent by construction (WF1 endorsed-house IDs).

## Autonomy honesty — what it needs from you (once)
Fully autonomous ≠ zero setup. Before I can run unattended:
1. 👤 **Activate the trial** (card + 3D Secure) — I cannot enter payment details.
2. 👤 **Pre-approve** the MCP + Bash(curl) tools ("always allow") so no permission prompt stalls the loop.
3. 👤 **Keep the Claude Code session/host online** — the scheduled wakeups only fire while the runtime is alive. If the machine sleeps or the app closes, the loop pauses until it's back (it resumes from `queue.json`, nothing lost).
4. 👤 **Cancel renewal** before 08:19 Jul 23 (billing = your account).

What I do NOT need you for: prompts, generations, polling, downloads, retries, logging, ordering — all autonomous.

## Winner selection without a human
Since it's unattended, I **keep every variation** (disk is free), organised by batch, and auto-curate a "picks" set using a simple rule (first successful variation of each hero item → upscaled). You review the full library at the end and swap picks if you disagree. No generation is thrown away.

## Failure handling
- Job error / timeout → 1 automatic retry, then `failed` + logged (loop continues, never blocks).
- Provider/model rejection → fall back to the batch's alt model (e.g. `kling3_0` → `seedance_2_0`).
- Rate/queue stall → the ~6 min cadence self-throttles; if a job is stuck >20 min, mark `failed` and move on.

## Verified by dry-run (2026-07-22) — 2 real images, full loop
The machinery is proven: seed → fire → **retry-on-connector-fail → success** → poll → curl-to-disk → refill (1-in-flight held) → drain → final report. Hardening findings baked in:
- **Actual cost can exceed `get_cost`** (dry-run billed 2.25/img vs 1.5 preflight). Budget with a ~1.5× margin; treat preflight as a floor, not a number.
- **Connector flakiness is real** (~1 in 4 calls failed transiently). The 1-retry + alt-model fallback is not optional — it's load-bearing.
- **Server may remap the model** (`nano_banana_2` → `nano_banana_flash`). Log the ACTUAL returned model in the ledger, not the requested one.
- **Never read assets into context** — `curl` to disk only; spot-check ≤1 per batch. (Kept the dry run token-lean.)

## Resume
The loop is stateless between wakes except for `queue.json`. Killed or paused → relaunch the driver; it reads state and continues from exactly where it stopped.

## Model assignment (locked)
- **Phase A — seed `queue.json`, create anchor Elements, train 5 Souls: OPUS.** Correctness-critical — a bad anchor poisons every downstream asset. ~30 min.
- **Steady-state 24h loop: SONNET subagent.** Mechanical orchestration + the light-judgment moments (model fallbacks, expanding template batches into prompts, failure triage, auto-curating winners, coherence spot-checks). Cheap and reliable over ~200 wakeups.
- **PixelLab avatar run: SONNET** (its own dedicated agent).
- **Fable:** only for throwaway bulk sub-batches, never the driver (it would fumble the "is this on-brand / which fallback" calls).
- **Opus stays on tap** for between-phase design calls (WF2 ground token, re-architecture) — never the loop.

Launch shape: Opus does the Phase-A seed, then spawns the loop as a **Sonnet** subagent that self-schedules until the queue drains.

## Tools & billing (full-autonomy setup)
- **Generation tools pre-authorized** in `.claude/settings.local.json` (`mcp__e1a94d30…__*` + `Bash(curl:*)` + `mcp__pixellab__*`) → the loop never stalls on a permission prompt.
- **Denied on purpose:** deploy/publish/website-secrets/contest, and **`cancel_trial_auto_renewal`** — I'm deliberately locked out of your billing. Cancelling the renewal stays a human action.

## Start command (after activation)
You say **"start the autonomous run"** → I: seed `queue.json` from `TRIAL-RUN-QUEUE.md`, confirm unlimited is live, fire the first video (reactor splash) + first image (persona bootstrap), and begin the self-scheduled loop.
