# Arganta Command Center — Strategy, Battle-Test & Opus Handoff

**Author:** Fable (strategy pass, 2026-07-18) · **Builder:** Opus · **Status:** DRAFT for founder sign-off
**Scope:** Rebuild the HQ `command` surface as a true operations cockpit — fleet, infrastructure, health, and launch control for everything local + cloud — with the current C-suite surface demoted to Legacy. Plus two battle-tested roadmaps: the Mac Mini always-on node, and the scale-up path beyond.

---

## 1. Vision (one paragraph)

One screen that answers, in five seconds and from any device: **is my company's machine alive?** Every brain (Sovereign · Claude Code · Codex), every local service (bridge, ComfyUI), every cloud organ (Vercel apps, Supabase, Cloudflare Workers, Buffer) — each a live tile with a green/amber/red truth, a "last seen" timestamp, and a **Start** button where starting is physically possible. It is the landing page of the Company group: the founder opens HQ and sees the state of the empire before anything else.

## 2. What exists today (grounded inventory)

| Piece | State | Where |
|---|---|---|
| `command` surface | C-suite offices & verdicts (Lobby/Office/Treasury/Cockpits, seeded data) | `apps/hq/src/surfaces/command/` |
| Arganta Bridge | Tri-brain (Claude engine + Codex engine), token WS on `127.0.0.1` + Tailscale IP `100.75.170.116`, port 7717 | `tools/arganta-bridge/` |
| Bridge auto-start | Startup-folder shortcut → guard-then-`npm start` launcher | `%LOCALAPPDATA%\ArgantaBridge\bridge-autostart.ps1` |
| One-click local start | `Start Arganta Local.lnk` (bridge + ComfyUI, port-guarded) | Desktop + same folder |
| ComfyUI | Comfy Desktop app, port 8188 | `C:\Program Files\Comfy Desktop\` |
| Mission persistence | `mission` table (Supabase), engine column migration pending | `supabase/migration_missions*.sql` |
| Cloud | Vercel (hq, landing, web, kinetik, lashira…), Supabase Pro, Cloudflare Workers (content worker, media), Buffer→IG | deployed |
| Health view | **none** — no unified status anywhere | — |

## 3. Battle-test findings (run before writing this plan)

**F1 — CRITICAL, verified live: the phone cannot reach the bridge today.**
Tested from a real `https://` page: `new WebSocket('ws://100.75.170.116:7717')` **throws immediately** — *"An insecure WebSocket connection may not be initiated from a page loaded over HTTPS."* Browsers exempt only loopback. So desktop HQ (same PC, `ws://127.0.0.1`) works, but the deployed HQ on the phone **cannot** open `ws://<tailscale-ip>`. The Tailscale mesh is fine; the missing piece is TLS.
**Fix (P0):** `tailscale serve --bg 7717` on the PC fronts the bridge with Tailscale's own valid HTTPS certs → `wss://<machine>.<tailnet>.ts.net`. No cert management, no public exposure (serve stays tailnet-only), and HQ just needs the `wss://` URL in the existing URL field. Also gives a stable MagicDNS name instead of a raw IP.

**F2 — "Trigger startup" has a physics boundary.** Software cannot power on a machine that is off. Honest capability tiers:
- **Tier A (buildable now):** PC on → start/stop *services* remotely (bridge becomes a tiny supervisor with a fixed allowlist: ComfyUI, self-restart). ✅ in scope.
- **Tier B (needs hardware on the LAN):** PC asleep → Wake-on-LAN magic packet must come from another always-on device on the same network. No such device exists today. ❌ out of scope until F5.
- **Tier C (PC off):** nothing can help. The UI must say "PC offline — last seen 09:12", never a wall of mystery reds.
The Mac Mini roadmap (§7) is what turns Tier B/C from impossible into solved — the strategy explicitly connects them.

**F3 — A browser cannot probe your infrastructure by itself.** CORS + private-network-access rules mean the deployed HQ page cannot fetch Vercel/Supabase health or hit LAN ports directly. Two-probe architecture required (§5): the **bridge `/health`** is the truth for local, a **Cloudflare Worker `/status`** is the truth for cloud, and a Supabase **heartbeat table** carries "last seen" across the gap so the phone still gets truth when the PC is off.

**F4 — A remote "start service" endpoint is an exec primitive.** It must be a fixed registry (id → exact command), never a free-form command channel; token-gated like missions; and destructive entries (stop/restart) should ride the existing approval-gate pattern. The bridge already has the right philosophy — reuse it.

**F5 — The current C-suite `command` surface has real content but seeded provenance.** Demoting to Legacy (Post Studio / Music Studio precedent: keep it one click away, never delete) is correct; its `HealthDot`/`SourceBadge`/provenance ideas should be *harvested* for the new cockpit tiles rather than rebuilt.

## 4. The Command Center (design)

**Placement:** `command` surface keeps its id and Company-group slot but becomes the cockpit; current C-suite screens move behind a `Legacy` button (same pattern as Post Studio v1). The cockpit becomes the Company group's default landing.

**Layout — four zones (desktop: 2×2-ish grid; mobile: stacked):**

1. **FLEET (top-left) — the brains.** Three cards: Sovereign · Claude Code · Codex, each with brand mark, live socket state, model in use, last mission + cost, and a "New mission" jump straight into the right BridgeConsole engine. Direct links, not descriptions.
2. **INFRASTRUCTURE (top-right) — the organs.** Tile grid, one per system: Bridge, ComfyUI, Vercel (per-app deploy state), Supabase (ping + DB size), Cloudflare Workers, Buffer channel. Each tile: status dot (live/degraded/offline/unknown), latency, "last seen", provenance badge (measured vs heartbeat-stale — harvest `SourceBadge`). Click → inspector drawer with recent history.
3. **LAUNCH (bottom-left) — the ignition.** The remote version of `Start Arganta Local`: per-service Start buttons (Tier A registry via bridge), "Start everything" macro, and an honest offline state ("PC offline since… — power on required" with the Mac Mini note once it exists).
4. **PULSE (bottom-right) — the ledger.** Last 10 missions (from the `mission` table) across engines, spend roll-up, and cloud deploy events. This is where the cockpit proves it's real data, not decoration.

**Tone:** same HQ design language (theme tokens, capsules, mono tickers). No new design system. The wow is *truth density*, not chrome.

## 5. Architecture (two probes + heartbeat)

```
phone/desktop HQ (https, Vercel)
   │
   ├── wss://<machine>.ts.net  ──►  BRIDGE (PC / later Mac Mini)
   │     /health  → local truth: bridge, ComfyUI:8188, engines, versions
   │     /launch  → registry-only service starts (token + gate)
   │     missions → existing WS protocol (unchanged)
   │
   ├── https://status.<worker>.workers.dev ──►  STATUS WORKER (Cloudflare)
   │     probes Vercel deploy API, Supabase ping, Workers self, Buffer
   │     cron: reads bridge heartbeat row → alerts when stale (later)
   │
   └── Supabase `heartbeat` table
         bridge upserts every 60s {node:'laptop', services:{...}, at}
         HQ reads it when the wss socket can't connect → "last seen 09:12"
```

Design rules: HQ never talks to raw LAN ports; every number carries its source (live probe vs heartbeat vs unknown); one `useOpsStatus()` store polls both probes and merges.

## 6. Opus build handoff (phases, files, acceptance)

**P0 — Make the phone path real (unblocks everything).**
- Founder runs once, guided: `tailscale serve --bg 7717` (+ note the `wss://…ts.net` URL).
- Bridge: accept proxied upgrades (serve forwards to localhost — verify token still parses behind proxy headers).
- HQ: URL field placeholder/help updated to the `wss://` form.
- ✅ Accept: phone on cellular+Tailscale runs a Claude mission from deployed HQ end-to-end.

**P1 — Bridge grows `/health` + heartbeat.**
- `GET /health` (same token, plain https via serve): `{node, services:{bridge, comfy:{port:8188}}, engines:{claude:auth'd, codex:bin-found}, versions, at}`.
- 60s upsert into Supabase `heartbeat` (new migration; service-role write like `mission`).
- ✅ Accept: curl over tailnet returns JSON; row visible in Supabase; kill ComfyUI → `comfy:false` within 60s.

**P2 — Status Worker (cloud truth).**
- New CF Worker `arganta-status`: parallel probes (Vercel API w/ token, Supabase `select 1`, Buffer profile, self), 30s edge cache, CORS for HQ origins only.
- ✅ Accept: single JSON endpoint; per-target ms; degrades per-target (one failure ≠ all red).

**P3 — The cockpit surface.**
- `surfaces/command/CommandCenter.tsx` + `ops/` store (`useOpsStatus`): zones per §4; old C-suite → `Legacy` button (keep files, add route flag). Harvest `HealthDot`/`SourceBadge`.
- ✅ Accept: all tiles truthful in three scenarios — everything up / ComfyUI down / PC fully off (heartbeat-stale path shows last-seen, not red noise).

**P4 — LAUNCH (Tier A remote start).**
- Bridge `POST /launch {service}` against a fixed registry `{comfy: 'C:\\Program Files\\Comfy Desktop\\Comfy Desktop.exe'}`; port-guard before spawn; approval-gate stop/restart actions.
- ✅ Accept: from the phone, with ComfyUI closed: tap Start → tile flips green ≤ 60s. Free-form commands impossible by construction.

**Sequencing note:** P0 is half an hour and removes the biggest lie in the current system (a connect UI that can't connect from the device it's for). Ship it first, alone.

## 7. Roadmap A — Mac Mini as the always-on node (battle-tested)

**The idea:** buy a Mac Mini to replace "all the local stuff."
**Verdict: right instinct, wrong scope — buy it as the *control plane*, keep GPU work elsewhere.**

What survives battle-testing:
- ✅ **Perfect always-on node:** silent, ~4–10W idle, runs 24/7 happily. Bridge, Claude Code CLI, Codex CLI, Tailscale, heartbeats, schedulers, light Node services — all first-class on macOS (launchd replaces the Startup folder; `tailscale serve` identical).
- ✅ **Solves F2 Tiers B/C:** the Mini becomes the always-on LAN device that can Wake-on-LAN the gaming laptop for GPU jobs, and the cockpit's "Start" button finally works even when the laptop was off.
- ⚠️ **It does NOT replace the 3070 Ti:** Apple-Silicon MPS runs SD but slower for SDXL-class work; many ComfyUI custom nodes are CUDA-only; **LoRA training (the Soul ID pipeline) is effectively CUDA-bound**. "Replacement for all local stuff" would silently kill the sovereign-media plan.
- ✅ **Correct target architecture:** **Mini = brain-server** (bridge, engines, health, automation) · **laptop = on-demand GPU worker** (woken by the Mini, sleeps otherwise) · **fal.ai = burst/premium media** (already the declared strategy).

**Spec guidance:** M4 Mini 16GB is enough for the control plane; choose 24–32GB only if local LLM inference on the Mini is desired later. Wired Ethernet (reliable WoL + serve).
**Migration checklist (half a day):** install Tailscale + Claude Code + Codex + Node on the Mini → clone repo → copy bridge `.env` → `launchd` plist for the bridge → `tailscale serve` → repoint HQ's saved `wss://` URL (name changes from laptop to Mini) → heartbeat `node:'mini'`. The cockpit then shows two nodes, which is exactly what the INFRASTRUCTURE zone was designed for.

## 8. Roadmap B — Scale-up (battle-tested)

**The idea:** "after a million users, having a cloud server will be better."
**Verdict: inverted — you are already on cloud; a self-managed server at 1M users would be a step backward.** Vercel + Supabase + Cloudflare *is* cloud infrastructure that scales elastically; "a cloud server" (a VM you administer) reintroduces patching, scaling, and 3-a.m. ops for one founder. The real ladder:

- **Stage 0 — now → ~50k MAU:** current stack untouched. Do the boring wins: indexes, RLS query audits, edge caching. *Trigger to move: none — measure.*
- **Stage 1 — ~50–250k MAU:** Supabase compute upgrade + read replica; move hot read paths (leaderboards, feeds) behind Cloudflare Workers + KV/queues; per-app Vercel analytics on p95. *Triggers: DB CPU sustained >60%, p95 >500ms, connection-pool saturation.*
- **Stage 2 — ~250k–1M MAU:** extract the 1–2 proven-hot services (e.g. game sync, media pipeline) to dedicated runtimes (Fly/Render/Modal for GPU); Postgres partitioning; media entirely on GPU cloud (fal/Modal) — never on founder hardware. *Triggers: egress bill dominates, replica lag, queue depth.*
- **Stage 3 — 1M+ MAU:** only now consider dedicated clusters/k8s — and only for the services whose bills prove it. Hire before you migrate; infra follows revenue.
- **Invariant at every stage:** the bridge/Command-Center/founder-ops plane serves **one operator** — it never scales with users and stays on the Mini forever. Don't conflate the two planes; that conflation is the only real trap in the original idea.

**Improvement over the original framing:** replace the "1M users" cliff with *measured triggers* (each stage above names them). User-count is a vanity threshold; bills, p95, and saturation are decision thresholds.

## 9. Self-check log (what was verified vs assumed)

- ✅ Verified live: https→`ws://` non-loopback throws (browser-pane test, exact error captured) → F1/P0.
- ✅ Verified: current `command` surface = C-suite files listed in §2; nav slot in `MobileNav.tsx` MGROUPS.
- ✅ Verified: bridge dual-listener up (127.0.0.1 + 100.75.170.116), auto-start guard/start paths both exercised; ComfyUI = Comfy Desktop on :8188 (process CLI captured).
- ⚠️ Assumed (Opus must verify): `tailscale serve` behavior on Windows with WS upgrades (documented-supported; smoke it in P0); Vercel API token scopes for the status Worker; Supabase heartbeat table RLS mirroring `mission`.
- ⚠️ Known debt feeding this plan: `migration_missions_engine.sql` not yet applied; Codex CLI presence on the machine unconfirmed (`codex` ENOENT handling exists).

---
*Fable → Opus: build P0 first and alone; it converts yesterday's phone feature from "demoed" to "true." Then P1–P4 in order — each phase is independently shippable and the cockpit only ever renders truths it can prove.*
