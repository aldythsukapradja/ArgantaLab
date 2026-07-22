# Higgsfield — Run It End to End (Quickstart)

The one page. Everything else is detail: `TRIAL-RUNBOOK` · `AUTONOMOUS-RUN` · `TRIAL-RUN-QUEUE` · `DESIGN-COHERENCE` · `PIXELLAB-RUN` · `HIGGSFIELD-PUNCHLIST`.

> **Model:** 24h UNLIMITED, relaxed mode (1 image + 1 video at a time). It's throughput-bound, not credit-bound. Target ≈ 100 videos + 80 posts + reserve, all $0.

---

## You do 3 things (~5 min total) — everything else is me
1. **Activate the trial** — say **"open the trial"**, I pop the widget, you enter the card (+3D Secure). $0 today. *(I can't enter payment — the one thing only you can do.)*
2. **Launch** — say **"start the autonomous run"**. That's the whole start. *(Tools are already pre-authorized in `.claude/settings.local.json`, so the loop never stops to ask.)*
3. **Cancel the renewal** — do this yourself right after activating (Manage Account → Subscription → Cancel renewal). Per Higgsfield's terms you **keep the full unlimited trial and are never charged**. I'm deliberately locked out of your billing, so this stays with you — do it early so there's zero $49 risk.

Then just **keep the session/host online** (passive). That's it.

*Optional, separate, anytime (own billing):* say **"start the pixel avatar run"** → dedicated PixelLab (Sonnet) agent for ArgantaLab avatars.

## Who runs what
- **Opus** seeds the queue + anchors (Phase A, ~30 min, correctness-critical), then hands off.
- **Sonnet** drives the 24h loop + the PixelLab avatars (cheap, reliable, capable enough for fallbacks/curation).
- **Opus** stays free for design decisions between phases.

## I do everything else (unattended)
- **Phase A anchors first:** brand/reactor/energy Elements + train 5 Souls → gate → every later asset references them (coherence by construction).
- **Two lanes non-stop:** 1 video + 1 image always cooking, ~6-min poll loop, until the queue drains.
- **Download + log:** every asset → `higgsfield-assets/<track>/`; ledger updated; `FINAL-REPORT.md` at the end.
- **Reads brand facts from `@arganta/brand`, writes assets back to it** → HQ Brand Studio and the run never drift (WF1 endorsed house).

## Keep it alive
The loop runs while the Claude Code session/host is online. If it sleeps, it **pauses and resumes from `queue.json`** when back — nothing lost. More awake hours = more videos (the bottleneck lane).

## Next morning (3 steps)
1. Read **`higgsfield-assets/FINAL-REPORT.md`** — counts, cost-equivalent, per-track.
2. Skim the library in **`higgsfield-assets/`**.
3. Say **"curate winners into HQ"** → I copy the picks into the HQ consumer paths (Brand Studio registry, Influencer Studio, reactor, apps) per `HIGGSFIELD-PUNCHLIST.md` §4b.

---

## Trigger phrases (the whole control surface)
| Say this | Does |
|---|---|
| `open the trial` | Pops the activation widget |
| `start the autonomous run` | Runs the full Higgsfield night |
| `start the pixel avatar run` | Separate PixelLab avatar agent |
| `pause the run` / `resume the run` | Stop/continue the loop (state saved) |
| `status` | Current counts + what's in-flight |
| `curate winners into HQ` | Copies picks into HQ paths |

That's it — 4 actions from you, one phrase to launch.
