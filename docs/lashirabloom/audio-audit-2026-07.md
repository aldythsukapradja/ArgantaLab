# Audio audit — HQ ↔ LashiraBloom integrity + the two backsound bugs

Status: **audit only, no fixes applied** (2026-07-10). Traces the generative-music path end to end
and pins the two reported bugs (sometimes-doesn't-start, overlapping-across-worlds) to specific code
with root causes. Fixes proposed but NOT built.

## 0. The path (what's shared, what's separate)
```
HQ Music Forge (MusicForge.tsx)                 Game (LashiraBloom)
  new MusicTransport(ctx,…) ── preview            ambient.js: new MusicTransport(ctx,…) ── the bed
  publishMusicLibrary(themes) ─┐                  bootMusic() → applyMusicThemes → ACTIVE_THEMES
                               ▼                  ambient.start() reads ACTIVE_THEMES[realm]
                       music_library (Supabase) ──► game boots it
       BOTH import the SAME engine: packages/audio/src/music.js (MusicTransport, MUSIC_THEMES, INSTRUMENTS)
```
**Integrity is fundamentally sound:** one engine, one theme model, realm IDs match on both sides
(`farm`, `bloomwall_pass`, `emberring_arena`, `fountain_festival`, `lashira_keep`,
`hearthrush_kitchen`), and every lookup has a `|| ACTIVE_THEMES.farm` fallback. The bugs are **not**
integrity mismatches — they're **transport-lifecycle** bugs in the shared engine + the game's
gesture wiring. Fixing the shared transport fixes HQ and the game at once.

---

## BUG 1 — "overlapping when I change multiple worlds"

### Root cause A (primary): the lookahead scheduler has no catch-up clamp
`packages/audio/src/music.js` → `MusicTransport._tick()` (~line 301):
```js
while (this._t < this.ctx.currentTime + 0.12) {   // schedule 120ms ahead
  this._scheduleStep(t); this._t += s16; this._step++; …
}
this._timer = setTimeout(() => this._tick(), 25);
```
The scheduler is driven by `setTimeout(25ms)`. **Changing worlds stalls the main thread** (mounting a
realm: canvas, image loads, game init, React reconcile) → `setTimeout` is starved for hundreds of ms
to seconds. Meanwhile `AudioContext.currentTime` keeps advancing (audio runs off-thread). When the
tick finally fires, `this._t` is far behind `currentTime`, so the `while` loop runs **many** iterations
in one go and schedules a **burst** of notes at timestamps that are now in the **past** — Web Audio
plays past-scheduled notes **immediately**, all at once → the overlapping cacophony. The same happens
returning from a backgrounded tab (there is **no `document.hidden` guard**).
- Example: a 2s stall at 82 BPM (`s16≈0.183s`) → ~11 notes dumped simultaneously.

### Root cause B (secondary): instant theme swap leaves long tails, no crossfade
`ambient.setRealm()` (ambient.js:48) → `transport.setTheme(theme)` swaps the theme **in place**; it
does **not** stop the currently-ringing notes. Sustained voices are long — `pad` = 4 beats, `harmony`
= 2 beats, `+` the shared reverb (~1.2s). So the old realm's pad/reverb rings ~3–4s **into** the new
theme. `duck(400ms)` is far too short to cover it, and there's no crossfade or hard-stop. Rapid
consecutive world changes layer fresh tails each time.

### Why it reads as "multiple worlds overlapping"
A + B compound: each world-change stall dumps a catch-up burst (A) **and** the previous theme's long
tails keep ringing (B). Do it a few times quickly and you hear several themes at once.

### Proposed fix (not built)
1. **Clamp the backlog** at the top of `_tick`: `if (this._t < this.ctx.currentTime) this._t = this.ctx.currentTime + 0.05` — drop past-due steps instead of dumping them. (Fixes the burst for both HQ + game.)
2. **Pause on hidden**: skip scheduling while `document.hidden`, re-seed `_t` on return.
3. **Realm change = clean handoff**, not in-place swap: on `setRealm`, ramp master to ~0 over ~250ms, then `transport.stop()` (its `master.disconnect()` silences ALL old tails instantly), rebuild + `setTheme(new)` + `start()`, ramp back up. A ~0.4s crossfade with a hard cut of the old graph.

---

## BUG 2 — "sometimes not starting at start"

### Root cause A (primary): audio only unlocks on a CANVAS pointerdown
`ambient.start()` / `sfx.arm()` are called **only** from the canvas `onPointerDown`
(FarmRoom.jsx:2345, RealmRoom.jsx:613). The **keydown** handlers (RealmRoom.jsx:590 `down`, and the
FarmRoom equivalent) do **not** arm audio. So a player whose first interaction is the **keyboard**
(WASD/arrow movement) — or a tap on a HUD button rather than the game canvas — never triggers the
autoplay unlock, and the bed stays silent until they happen to tap the canvas. That's the
"sometimes" (depends on first-gesture type).

### Root cause B: resume fragility + a stuck `running` flag
`start()` (ambient.js:37) creates the context suspended and calls `this.ctx.resume().catch(() => {})`
— failures are swallowed. The transport schedules relative to `ctx.currentTime + 0.08`; while the
context stays suspended the clock is frozen and nothing plays. If `resume()` doesn't complete,
`this.running` is already `true`, so **every subsequent `start()` early-returns** and the bed can
never recover without a Settings off/on toggle. No retry, no "did it actually start?" check.

### Root cause C (integrity gap): published theme lost if the player starts before boot resolves
`initMusic()` (net/musicLibrary.js) is fire-and-forget async; it mutates `ACTIVE_THEMES` when it
resolves. `ambient.start()` reads `ACTIVE_THEMES[realm]` **once** at start. If the player unlocks
audio **before** `initMusic` resolves, the transport holds the **default** theme, and `setRealm`
only re-reads on a realm **change** — so a freshly-published theme may not apply until the next realm
switch or a reload.

### Proposed fix (not built)
1. Arm audio from the **keydown** handler too (and ideally a one-time global `pointerdown`/`keydown`
   listener that arms once), so any first gesture unlocks the bed.
2. In `start()`, gate the transport start on `resume()` resolving (`await`/`.then`), and if the
   context is still suspended, retry on the next gesture instead of latching `running=true`.
3. Have `initMusic` (or a small subscription) call `ambient.refreshTheme()` after it applies, so a bed
   already playing the default swaps to the published theme without needing a realm change.

---

## Secondary findings (lower priority)
- **Two AudioContexts** (sfx.js + ambient.js) — harmless (browsers allow ~6) but wasteful; duck
  coordination works via `ambient.duck()` called from `sfx.play()`.
- **Node leak on rebuild**: `ambient.stop()` disconnects `master` but the `createMasterChain`
  comp/limiter/convolver nodes are orphaned (silent). Only matters on repeated enable/disable.
- **HQ has the same catch-up burst** (same transport) — tab-away/return in Music Forge would burst
  too; the `_tick` clamp fixes both surfaces at once.
- **`energy()` uses `_bar`** unbounded — fine (sin), noted only for completeness.

## Suggested fix order (when you say build)
1. `_tick` backlog clamp + hidden-guard in `packages/audio/src/music.js` — kills the overlap burst for HQ **and** game, smallest change, biggest win.
2. Clean realm-handoff crossfade in `ambient.js` (kills tail overlap).
3. Arm audio on keydown + resume-aware `start()` in `ambient.js`/`sfx.js` (kills the not-starting).
4. `refreshTheme` hook so late-published themes apply live (integrity polish).
