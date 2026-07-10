# DESIGN — Unified Settings "Command Sheet" (one settings for all 6 worlds)

Status: **design concept only, NO build.** Written 2026-07-10 (Opus). Deliverable
for a Sonnet build pass. Pixel-precise so it can be built without re-deriving.

Companion mockup: an interactive HTML Artifact reproduces this design with the
REAL game tokens (frosted "Liquid Glass"). Treat the mockup as the visual target
and this doc as the spec of record. Where they ever disagree, this doc wins on
behaviour, the mockup wins on pixels.

Sibling docs (the porting agent's ground truth — DO NOT contradict them):
- `shared-game-shell-component-strategy.md` — the four-corner shell. This design
  IS the state-of-the-art version of that doc's top-right `GameMenuSheet`
  (§2/§3.2), which it explicitly left "ugly today, one component tomorrow."
- `architecture-spine-and-world-builder-design.md`, `roadmap-and-build-plan.md`.

---

## 0. The ask, restated

- ONE settings panel that serves **all 6 worlds**: the Kingdom hub / main farm
  (`FarmRoom`) + the 5 realms (Lashira Keep, Bloomwall Pass, Hearthrush Kitchen,
  Fountain Festival, Emberring Arena, all via `RealmRoom`/`RealmShell`).
- "Settings for **everything**" — comprehensive; nothing cut or hidden away.
- "All information there, but **not confusing**" — organised, findable, calm.
- "Fancy, **state-of-the-art**, pixel-perfect."
- Detailed enough that Sonnet can build it directly.

## 1. Why today's Settings reads as "ugly" (audit)

Current: `apps/lashira/web/src/ui/Hud.jsx` lines ~302–515, a 420px floating card
with **12 flat `.set-card` blocks in ONE long vertical scroll** (the user's 3
screenshots are all the same panel, scrolled). Concrete faults:

1. **No hierarchy.** 12 equal-weight cards, no grouping — "Sound" is 8 cards down
   from the top; finding anything is a scroll-hunt.
2. **Dead space & filler cards.** The `Path · Title · Lv` line is a whole card for
   one line of text. The Wallet card just re-prints numbers already on the HUD.
3. **Three different control idioms, none consistent.** A custom pill toggle
   (`.dev-toggle` — text "ON/OFF" + a dot), raw native `<input type=range>`
   (browser-default thumb), plain bordered `.emote-fav-chip`s sitting right next
   to fully art-directed `.skin-swatch`es. Nothing reads as one system.
4. **Leaked diagnostics.** The raw `ch:CLOSEDX · ws:open · peers:1 · heard:0s…`
   debug string renders inline for **every** player, not just operators.
5. **Realms have NO settings at all.** `RealmShell` top-right is a single ↩
   button. So "one settings for 6 worlds" is a genuine gap, not just a reskin —
   5 of the 6 worlds have nothing to redesign yet.

## 2. Design principles (the rubric every decision is checked against)

- **P1 — Categories, not a scroll.** Group ~20 settings into 5 stable
  categories reachable in ONE tap. Never make the player scroll past Kin to
  reach Sound.
- **P2 — One control kit.** Every setting uses exactly one of 8 canonical
  controls (§6), styled identically everywhere. A toggle looks the same in
  Sound as in Operator tools.
- **P3 — Shared shell, injected content.** The sheet chrome (frame, tabs,
  header, footer) is world-agnostic and built ONCE. Each world feeds it a
  normalized data object (§8). Farm-only and realm-only content are *injected
  sections*, never forked layouts. This is what makes it "one settings for 6."
- **P4 — Native to each world without a redesign.** The current world's accent
  color (`--world`) themes the active tab, focus rings, and footer — so the
  same shell feels at home in the green Bloomwall and the red Arena, with zero
  per-world layout work.
- **P5 — Calm surface, deep on demand.** The default view is airy (iOS grouped
  inset lists). Power/rare content (diagnostics, dev tools, raw values) sits
  behind disclosures. "All information there" ≠ "all information at once."
- **P6 — Liquid Glass, not flat.** Match the game's existing Apple-iOS-26
  "Liquid Glass" language already in `styles.css .room-full` (`--glass-*`,
  superellipse corners, `--spring`). This is NOT a claude.ai-flat surface.

## 3. Information architecture — 5 tabs, every setting mapped

Five stable tabs. A realm may **inject sections** into a tab (never add tabs),
except it may optionally contribute ONE realm-context group that surfaces at the
top of the most relevant tab. Icons are emoji today (swap for `GameIcon`/Tabler
later — the shell doesn't care).

### Tab 1 — HERO 👤 ("who I am") — universal
- **Identity card** — the live `UnitCard` (crest · name · path+title · Lv · rank ·
  XP bar · HP/MP bars). Read-only here; a "Open character sheet →" row deep-links
  to the existing "Me" `CharacterPage` for equipment/skills (no duplication).
- **Wallet group** — 4 equal pills (🪵 wood · 🪨 ore/stone · 🌸 bloom · 💎
  diamonds) reusing the `.unit-wallet` pill style just added to `UnitCard`
  (9px, HP/MP-matched). One-line economy explainer. Tap a pill → Shop.
- **Active Kin group** *(farm-only, injected)* — up to 6 Kin chips, `n/6`. Empty
  state: "No Kin on the farm yet."
- Operator badge (⚡ OPERATOR) shown inline in the header if `operator`.

### Tab 2 — CIRCLE 👥 ("my world & who's here") — universal
- **Live now group** — a row "🟢 N live · names" → opens the who's-online popup
  (existing `LivePopup`); a row "💾 save: cloud/local"; an operator-only
  **▸ Diagnostics** disclosure that reveals the `ch:… ws:… peers:…` line (no
  longer leaked to players).
- **Your circles group** — the switcher list (active row w/ radio dot + "Active"
  badge; other circles w/ "Switch"; Personal-farm row). Inline switch-confirm.
- **Location group** *(realm-aware)* — current place, e.g. "🏰 Lashira Keep ·
  Castle District" (mirrors `LocationInfoPanel` copy). On the farm: current zone.

### Tab 3 — PLAY 🎮 ("how it controls") — universal + injected
- **This world group** *(realm-injected, top)* — the realm's contextual actions
  as full-width action rows: Bloomwall → "Restart run", "Forfeit"; Arena →
  "Forfeit duel", "View rank board"; Kitchen → "End shift"; Keep → (none).
  Farm → "😴 Sleep (refill stamina)". Fed from `play.worldActions: GameAction[]`.
- **Controls group** — Movement **speed** slider (universal, 1–3×); Camera
  **zoom** slider *(farm-only, injected)* (0.1–3×, default 0.5× mobile / 1×
  desktop per the recent change).
- **Action skin group** — the swatch grid (shared `SKIN_LIST` from
  `@arganta/combat`), each swatch = 3 real orbs + name + blurb.
- **Favorite emotes group** — chip grid (shared `EMOTES`), pick up to 4, `n/4`.
  Restyled to swatch-quality (see §6.7).

### Tab 4 — SOUND 🔊 ("audio") — universal
- **Effects group** — SFX toggle + volume slider.
- **Music & ambience group** — ambience toggle + volume slider.
- Footnote when HQ audio is applied: "Cues tuned in Circle HQ · Music Builder"
  (reads `initAudioLibrary()` result — the concurrent audio-pipeline work).

### Tab 5 — SYSTEM ⚙ ("app & account") — universal
- **How to play group** — a compact controls reference (drag to move · tap to
  interact · long-press for the tile menu · the action orb), collapsible.
- **Operator group** *(gated: `operator` only)* — Dev map-overlay toggle (farm)
  + room for future dev tools. Amber-tinted, clearly separated.
- **Account group** *(standalone only — hidden when embedded)* — "🚪 Sign out"
  (danger-tinted).
- **About** — app version, tiny credits line.

### Persistent footer (sticky, realms only)
A single world-colored primary button: **"↩ Exit to Kingdom"** (or the realm's
`hqReturn` label). Always one tap, in every realm, without hunting a tab. On the
farm there is no footer (nothing to exit to). This replaces `RealmShell`'s lone
↩ corner button — the gear now opens the full sheet; Exit lives in its footer.

### Coverage check — every existing setting has a home
| Today's section | New location |
|---|---|
| Developer mode | System → Operator |
| Circle sync (pills) | Circle → Live now |
| Circle sync (debug string) | Circle → Live now → ▸ Diagnostics (operator) |
| Your circles | Circle → Your circles |
| Path/Title/Lv line | Hero → identity card (folded in) |
| Wallet | Hero → Wallet |
| Active Kin | Hero → Active Kin (farm) |
| Action skin | Play → Action skin |
| Favorite emotes | Play → Favorite emotes |
| Sound | Sound (whole tab) |
| Rest / Sleep | Play → This world (farm) |
| Camera & movement | Play → Controls |
| Account / Sign out | System → Account |
| *(new)* Exit realm | Footer (realms) |
| *(new)* How to play | System → How to play |

---

## 4. The container — "Command Sheet" shell (responsive, one component)

A large frosted sheet, NOT the current small card. Structure:

```
.cmd-backdrop                          (fixed, scrim + blur, click-outside closes)
  .cmd-sheet                           (the glass panel, spring-pops in)
    .cmd-head                          (world chip · operator badge · ✕)     — full width
    .cmd-body                          (flex: row ≥560px / column <560px)
      .cmd-rail                        (tabs: column ≥560px / horizontal strip <560px)
      .cmd-pane                        (active tab's groups; the only scroll region)
    .cmd-foot                          (sticky; realm Exit button — realms only)
```

### 4.1 Responsive layout (ONE breakpoint at 560px — keep it simple for Sonnet)

**Desktop / tablet (≥560px):** centered sheet. `.cmd-body` is a row: a 76px
left **icon rail** (vertical tab column) beside the scrolling pane. Sheet
`width: min(720px, 94vw)`, `max-height: 88vh`.

**Mobile (<560px):** the sheet becomes a **bottom sheet** filling most of the
screen (`inset: 8px; max-height: calc(100dvh - 16px)`), slides up. `.cmd-body`
is a column: the rail collapses to a **horizontal segmented tab strip** across
the top of the pane (icon over label, `overflow-x:auto` so a 6th injected tab
scrolls). Content fills below.

Do this with `flex-direction` swaps in a `@media (max-width:559px)` block — NOT
two separate component trees. Same JSX, CSS reflows it.

### 4.2 Exact frame measurements

- `.cmd-sheet`: `background: var(--glass-bg-thick)`; `backdrop-filter:
  var(--glass-thick)`; `border-radius: 28px; corner-shape: superellipse(1.8)`;
  `box-shadow: var(--glass-rim), var(--glass-shadow-lg)`; `border: none`;
  `color: var(--text-strong)`. Animate in with the existing `settings-pop` +
  backdrop `backdrop-fade`. (Mobile bottom-sheet: `border-radius: 24px 24px 0 0`
  and a slide-up-from-bottom variant of the keyframe.)
- `.cmd-backdrop`: `position: fixed; inset:0; z-index:50; background:
  rgba(8,11,20,.5); backdrop-filter: blur(6px)`. (Reuse `.browser-backdrop`.)
- `.cmd-head`: height 56px; padding `0 16px`; flex row, space-between; a 1px
  hairline underline in `color-mix(in srgb, var(--world) 40%, transparent)`.
- `.cmd-foot`: sticky bottom; padding `12px 16px calc(12px + safe-area)`;
  `backdrop-filter: var(--glass-regular)`; top hairline.

### 4.3 The world accent (`--world`)
The sheet root sets `style={{ '--world': world.color }}`. Palette from
`world-map-registry.js`: farm/hub `#8b5cf6` (purple), Keep `#7c6cff`, Bloomwall
`#2ca64e`, Kitchen `#f6a42c`, Festival `#e53770`, Arena `#da2a31`. `--world`
drives: active tab pill, focus rings, footer button, group-caption color, slider
fill, toggle-on (Sound/Play) — so ONE shell feels native everywhere.

---

## 5. The tab rail (navigation)

### 5.1 Desktop vertical rail (`.cmd-rail`, ≥560px)
- Width 76px; padding `10px 8px`; `display:flex; flex-direction:column; gap:4px`.
- Each `.cmd-tab`: full width; `display:flex; flex-direction:column;
  align-items:center; gap:5px; padding:10px 0; border-radius:14px;` cursor
  pointer; transition `background .15s, color .15s`.
  - Icon 22px; label 10px/800, letter-spacing .02em.
  - Inactive: `color: var(--muted)`; hover `background: rgba(255,255,255,.5)`.
  - Active: `color: var(--world); background: color-mix(in srgb, var(--world)
    14%, #fff)` + a 3px left accent bar (`box-shadow: inset 3px 0 0 var(--world)`
    or an absolutely-positioned bar). Add a subtle scale/pop on activate.

### 5.2 Mobile top strip (<560px)
Same `.cmd-tab` buttons, but the rail is `flex-direction:row; overflow-x:auto;
gap:4px; padding:8px 10px;` with a bottom hairline. Active pill same fill; the
3px accent bar moves to the **bottom** edge (`box-shadow: inset 0 -3px 0
var(--world)`). `scroll-snap-type: x proximity` for a nice feel; hide the
scrollbar. Min tab width 62px so 5 fit ~375px and a 6th scrolls.

---

## 5.5 Icon system — reuse the two icon tiers the game already has, don't add a third

Audited the codebase: LashiraBloom already has two real icon systems. This
sheet uses BOTH, adds nothing new stylistically.

- **`apps/lashira/web/src/components/HudIcons.jsx`** — small hand-authored
  24×24 glyphs (`fill`/`stroke="currentColor"`, tints with the row/world
  color), used for compact HUD text (`IconHeart`, `IconMana`, `IconHand`,
  `IconMount`, `IconSpark`, `IconFriends`, `IconSwords`). **8 new icons were
  added to this file in the exact same style** for every settings-row concept
  that previously would've been a colorful pictorial emoji (inconsistent
  across OS/browser — the file's own stated reason for existing):
  `IconGear`, `IconSpeaker`, `IconMusic`, `IconSpeed`, `IconZoom`,
  `IconWrench`, `IconPin`, `IconDoor`. Each takes an optional `size` prop
  (default 18). **Import these directly** — don't re-derive paths.
- **`GameIcon` (`@arganta/combat`, vendored game-icons.net, CC BY 3.0)** — the
  bigger 30–44px skill/action-orb icons. The Action Skin swatches (§6.6) must
  render the REAL per-skin icon keys already wired in `packages/combat/src/
  skins.js` `CLUSTER_SKINS[id].icons` (`attack`/`single`/`heal`/`area`/`mount`
  — a swatch shows `attack`+`single`+`heal` in its 3 orbs), not placeholder
  glyphs. E.g. Brass Legion's attack orb is `lorc__crossed-swords`.

**What stays emoji, deliberately:** wallet/resource glyphs (🪵🪨🌸💎), world/
kin colors, and other flavor emoji already established everywhere else in the
game (Shop, Panels, UnitCard) — changing those ONLY inside Settings would be
inconsistent, not sharper. The line: emoji for game-flavor content that's
emoji everywhere already; `HudIcons`/`GameIcon` SVG for functional UI chrome
(toggles, nav, controls) where crispness and cross-platform consistency
actually matter, and doesn't already have an established emoji identity.

The companion mockup (`settings-command-sheet.html`) renders all of the above
with the real path data, so it's pixel-accurate to what importing these
components will actually produce.

---

## 6. The control kit — 8 canonical controls (build these ONCE, pixel-precise)

Everything in every tab is one of these. This is the heart of "not confusing":
consistent controls. All use `--spring` for press/toggle motion and honor
`prefers-reduced-motion`.

### 6.0 The group + row primitives (the skeleton everything sits in)
- `.cmd-group`: an iOS inset-list section.
  - `.cmd-cap` (caption): 11px/800 uppercase, letter-spacing .06em, `color:
    var(--world)` (falls back to `#6a4df5`), margin `0 0 6px 4px`.
  - `.cmd-list` (the rounded container): `background: rgba(255,255,255,.60);
    border-radius: 16px; overflow:hidden;` holds rows; rows divided by a 1px
    inset hairline `rgba(20,26,40,.07)` (not on the last row).
  - Group vertical gap: 14px.
- `.cmd-row`: the atomic list row. `min-height:52px; display:flex;
  align-items:center; gap:12px; padding:8px 14px;`
  - Left: optional 22px icon + a text stack (`.cmd-row-label` 13.5px/700 +
    optional `.cmd-row-sub` 11px/500 `var(--muted)`).
  - Right: the control (toggle / value / chevron / stepper), pushed with
    `margin-left:auto`.
  - Whole-row-tappable variant (`.cmd-row.tappable`): press scale .985, hover
    bg `rgba(255,255,255,.4)`, trailing `›` chevron.

### 6.1 Toggle (`.cmd-toggle`) — replaces `.dev-toggle`
iOS switch. Track `52×32`, `border-radius:999px`. Knob `28px` white circle,
`box-shadow:0 1px 3px rgba(0,0,0,.35)`. Off: track `rgba(120,128,150,.28)`, knob
left. On: track `var(--world)` (or `--green #5ec27a` for Sound), knob
`translateX(20px)`. Transition `transform .22s var(--spring), background .2s`.
Whole track is the button; no "ON/OFF" text (the position IS the state).

### 6.2 Slider (`.cmd-slider`) — replaces native range
Custom, cross-browser, pixel-perfect. Layered: a styled track + fill + thumb,
with a transparent native `<input type=range>` on top for interaction/a11y.
- Track: height 6px, `border-radius:999px`, `background: rgba(20,26,40,.14)`,
  `box-shadow: inset 0 1px 2px rgba(0,0,0,.25)`.
- Fill: `background: linear-gradient(90deg, color-mix(in srgb, var(--world)
  70%, #fff), var(--world));` width = value%.
- Thumb: 20px white circle, `border:2px solid var(--world)`, `box-shadow:0 2px
  6px -1px rgba(0,0,0,.4)`; centered on the fill end.
- Value: a right-aligned `.cmd-val` pill (12.5px/800 tabular) — e.g. "0.5×",
  "80%". Optionally a bubble above the thumb during drag (nice-to-have).
- Row form: `[icon] label ……… [track+fill+thumb, flex:1] [value]`.

### 6.3 Segmented (`.cmd-seg`) — 2–4 exclusive options
Pill container `background: rgba(20,26,40,.06); border-radius:999px; padding:3px;
display:flex;`. Each option `flex:1; padding:6px 10px; border-radius:999px;
font:12px/800; text-align:center;`. Selected: `background:#fff; color:var(--world);
box-shadow: var(--glass-rim), 0 1px 3px rgba(0,0,0,.12)` sliding via `--spring`.
(Use for e.g. a future "Graphics: Low/High", or replace a toggle where a labeled
choice is clearer.)

### 6.4 Value stepper (`.cmd-step`) — bounded integers
`[−]  value  [+]` — two 26px round glass buttons flanking a tabular value.
For counts if ever needed (not used by current settings; provided for parity).

### 6.5 List row with trailing action (`.cmd-listrow`)
For the circle switcher + Kin. Left: a 14px radio dot (`.cmd-dot`, filled
`radial-gradient(var(--world), var(--pink))` when active; dashed for Personal) +
name stack (name 13.5px/700 + sub 11px/500 muted). Right: an "Active" badge
(`.cmd-badge`, world-tinted pill) OR a "Switch" ghost button. Inline confirm
(`.cmd-confirm`) drops below the tapped row (dashed world border, Cancel/Switch).

### 6.6 Swatch grid (`.cmd-swatch`) — action skins
Keep the strong existing `.skin-swatch` treatment (it's the ONE good control
today). Grid `repeat(auto-fill, minmax(104px, 1fr)); gap:8px`. Each swatch:
column, the 3 real orbs (reuse `.skin-orbs .so.atk/.sk` with `GameIcon`), name
12px/800, blurb 10px muted. Selected: `border:2px solid var(--world);
background: color-mix(var(--world) 12%, #fff)`. Hover lift `translateY(-2px)`.

### 6.7 Chip grid (`.cmd-chip`) — favorite emotes (UPGRADED)
Today's `.emote-fav-chip`s are plain and clash with the swatches beside them.
Upgrade to a small square tile: `56×56`, column, the emote **emoji at 22px** over
its **name at 9px**, `border-radius:14px; background: rgba(255,255,255,.55)`.
Selected: `border:2px solid var(--world)` + a tiny `✓` corner badge. Disabled
(when 4 already picked): `opacity:.4`. This makes emotes read as siblings of the
skin swatches — one visual family.

### 6.8 Action button (`.cmd-action`) — Sleep / Sign out / Exit / realm actions
Full-width, 44px, `border-radius:14px; font:13px/800;`. Three intents:
- **neutral** (default): glass — `background: rgba(255,255,255,.6);
  border:1px solid rgba(0,0,0,.06)`.
- **primary** (Exit footer, realm start-type actions): `background: var(--world);
  color:#fff` (auto-contrast via `color-mix` if the world is light, e.g. amber
  Kitchen → dark text).
- **danger** (Sign out, Forfeit): `color:#b3261e; background: rgba(179,38,30,.08);
  border:1px solid rgba(179,38,30,.25)`.
Leading emoji/icon + label. Press scale .98.

### 6.9 Disclosure (`.cmd-disc`) — progressive detail
A `.cmd-row` whose trailing control is a `▸`/`▾` chevron; expands a nested block
(diagnostics, how-to-play). Height animates; chevron rotates 90° on open. Used
to keep P5 (calm surface) — rare/technical content is one tap away, not inline.

---

## 7. Per-tab wireframes (ASCII + the exact groups/controls)

Widths shown ~ mobile (360px pane). `[T]`=toggle `[S]`=slider `[›]`=chevron
`(pill)`=value.

### HERO
```
┌ HERO ─────────────────────────────────────┐
│  ┌───────────────────────────────────────┐ │  ← identity card = live UnitCard
│  │ ✦  Keyla            🛡 Warden · Lv 44  │ │     (crest,name,path,title,level,
│  │ ADVENTURER   ✨ 480/1,193              │ │      rank, XP, HP/MP bars). Reused
│  │ ❤ 4,463/4,463      💧 890/890          │ │      component, NOT re-drawn.
│  └───────────────────────────────────────┘ │
│  WALLET                                     │  cmd-cap (world color)
│  ┌───────────────────────────────────────┐ │
│  │ 🪵 5   🪨 11   🌸 14.6K   💎 3.2K       │ │  4 equal .unit-wallet pills, 9px
│  └───────────────────────────────────────┘ │  tap → Shop
│  🌸 runs the farm · 🪵🪨 upgrades · 💎 learning
│                                             │
│  ACTIVE KIN  6/6                (farm only) │
│  ┌───────────────────────────────────────┐ │
│  │ ●Novabear ●Tenturtle ●Storyfox …       │ │  6 kin chips
│  └───────────────────────────────────────┘ │
│  ┌───────────────────────────────────────┐ │
│  │ 🎭 Open character sheet             ›  │ │  cmd-row.tappable → CharacterPage
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### CIRCLE
```
┌ CIRCLE ────────────────────────────────────┐
│  LIVE NOW                                   │
│  ┌───────────────────────────────────────┐ │
│  │ 🟢 1 live · aldhyt sukapradja       ›  │ │  row → LivePopup
│  │ ▸ Diagnostics                (operator)│ │  disclosure → ch:… ws:… peers:…
│  └───────────────────────────────────────┘ │
│  YOUR CIRCLES  4                            │
│  ┌───────────────────────────────────────┐ │
│  │ ● Aldyth's Family · 4 members  [Active]│ │  cmd-listrow, active
│  │ ○ Djaelanis · 11 members       [Switch]│ │
│  │ ○ Keluarga Cerah Ceria · 9 mm  [Switch]│ │
│  │ ○ Tutors · 6 members           [Switch]│ │
│  │ ⌂ Personal farm · just you     [Switch]│ │  dashed dot
│  └───────────────────────────────────────┘ │
│  LOCATION                                   │
│  ┌───────────────────────────────────────┐ │
│  │ 📍 Kingdom hub · Home farm             │ │  realm: "🏰 Lashira Keep · Castle"
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### PLAY
```
┌ PLAY ──────────────────────────────────────┐
│  THIS WORLD                    (injected)   │
│  ┌───────────────────────────────────────┐ │  farm → [😴 Sleep]
│  │ [ 😴  Sleep — refill stamina        ] │ │  Bloomwall → [Restart run][Forfeit]
│  └───────────────────────────────────────┘ │  Arena → [Forfeit duel][View rank]
│  CONTROLS                                   │
│  ┌───────────────────────────────────────┐ │
│  │ 🏃 Speed   ●──────────────  (1.4×)     │ │  cmd-slider, universal
│  │ 🔍 Zoom    ●────────        (0.5×)     │ │  farm only
│  └───────────────────────────────────────┘ │
│  ACTION SKIN  Brass Legion                  │
│  ┌───────────────────────────────────────┐ │
│  │ [orbs]Brass  [orbs]Frost  [orbs]Obsid │ │  cmd-swatch grid
│  └───────────────────────────────────────┘ │
│  FAVORITE EMOTES  4/4                        │
│  ┌───────────────────────────────────────┐ │
│  │ 🎉Victory 😊Smile 😢Cry … (tiles)      │ │  cmd-chip grid (upgraded)
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### SOUND
```
┌ SOUND ─────────────────────────────────────┐
│  EFFECTS                                    │
│  ┌───────────────────────────────────────┐ │
│  │ 🔊 Sound effects                   [T] │ │  cmd-toggle
│  │ 🎚 Volume   ●──────────────  (80%)     │ │  cmd-slider (disabled if muted)
│  └───────────────────────────────────────┘ │
│  MUSIC & AMBIENCE                           │
│  ┌───────────────────────────────────────┐ │
│  │ 🎵 Ambience & music                [T] │ │
│  │ 🎚 Volume   ●────           (20%)      │ │
│  └───────────────────────────────────────┘ │
│  ♪ Cues tuned in Circle HQ · Music Builder │  footnote (only if HQ audio applied)
└─────────────────────────────────────────────┘
```

### SYSTEM
```
┌ SYSTEM ────────────────────────────────────┐
│  HOW TO PLAY                                │
│  ┌───────────────────────────────────────┐ │
│  │ ▸ Controls & tips                      │ │  disclosure → drag/tap/long-press/orb
│  └───────────────────────────────────────┘ │
│  OPERATOR  ⚡                    (gated)     │
│  ┌───────────────────────────────────────┐ │  amber-tinted list
│  │ 🗺 Map overlay (walk/no-walk)      [T] │ │
│  └───────────────────────────────────────┘ │
│  ACCOUNT                    (standalone)    │
│  ┌───────────────────────────────────────┐ │
│  │ [ 🚪  Sign out ]            (danger)   │ │  cmd-action danger
│  └───────────────────────────────────────┘ │
│  LashiraBloom · v1.x                        │  about line, 11px muted
└─────────────────────────────────────────────┘
   ─────────────────────────────────────────
   [ ↩  Exit to Kingdom ]   (footer, realm)     cmd-action primary, world color
```

---

## 8. The shared data contract (so all 6 worlds feed ONE component)

This is the crux of P3 and the porting agent's `GameShellState`. The sheet is
pure presentation; each world builds this object. Farm-only / realm-only fields
are just `null` where they don't apply — the sheet renders/omits accordingly.

```ts
// <SettingsSheet {...props} /> — the ONE component, in ui/SettingsSheet.jsx
SettingsSheetProps = {
  world: { id, name, color, kind: 'farm' | 'realm' },

  hero: {
    card: UnitCardShape,                         // feeds the existing UnitCard
    wallet: { wood, ore, bloom, diamonds },      // Infinity → "∞"
    kins: Kin[] | null,                          // null in realms
    operator: boolean,
    onOpenCharacter: () => void,                 // → CharacterPage
    onWalletTap: () => void,                     // → Shop
  },

  circle: {
    live: { count, names: string[] },
    syncDebug: {…} | null,                       // operator-only diagnostics
    circles: Circle[], activeCircleId,
    onSelectCircle: (id|null) => void,
    onOpenLive: () => void,                       // → LivePopup
    locationLabel: string,                        // "Kingdom hub · Home farm"
  },

  play: {
    worldActions: GameAction[],                  // "This world" group (injected)
    speed: { value, min:1, max:3, step:0.1, onChange },
    zoom:  { value, min:0.1, max:3, step:0.1, onChange } | null,  // farm only
    skin:  { list: Skin[], activeId, onPick },   // @arganta/combat SKIN_LIST
    emotes:{ all: string[], favorites: string[], max:4, onSet }, // EMOTES
  },

  sound: {
    sfx:   { muted, volume, onToggleMuted, onVolume },
    music: { enabled, volume, onToggleEnabled, onVolume },
    hqTuned: boolean,                            // show "tuned in HQ" footnote
  },

  system: {
    dev: { overlayOn, onToggleOverlay } | null,  // null unless operator + farm
    account: { onSignOut } | null,               // null when embedded
    version: string,
  },

  onExit: (() => void) | null,                   // realm footer; null on farm
  onClose: () => void,
}

GameAction = { id, label, icon, kind:'primary'|'skill'|'tool'|'utility',
               intent?: 'neutral'|'primary'|'danger', cooldownMs?, disabledReason? }
```

- **`FarmRoom`** builds this with `kins`, `zoom`, `dev`, `worldActions:[Sleep]`,
  `onExit:null`.
- **`RealmRoom`/`RealmShell`** build it with `kins:null`, `zoom:null`, `dev:null`,
  `worldActions:[realm's restart/forfeit/…]`, `onExit:returnToHub`. The gear in
  `RealmShell`'s top-right opens `<SettingsSheet>` instead of firing exit
  directly; exit moves to the sheet footer.
- Universal sections (Circle switcher, Sound, Skin, Emotes, Speed, Account,
  How-to-play) render from the SAME props for all 6 — build once, inherited
  everywhere (P3, and exactly the porting doc's §1 "polish once, all inherit").

### 8.1 Extension point for future realms/tabs
Because tabs render from a `TABS` array of `{id, icon, label, render(props)}` and
realm content arrives via `worldActions` + nullable fields, a NEW realm needs
zero shell changes — it just fills the contract. A realm that genuinely needs its
own tab (e.g., a future "Guild" surface) can pass an optional
`extraTabs: TabDef[]` that the rail appends after System (the mobile strip already
scrolls for a 6th). Keep this door open but don't build speculative tabs now.

---

## 9. Visual system — exact tokens & type scale

All from the existing `.room-full` Liquid-Glass block; do not invent new hexes.

- **Surfaces:** sheet `--glass-bg-thick`; group list `rgba(255,255,255,.60)`;
  row hover `rgba(255,255,255,.4)`; blur `--glass-thick` (sheet) /
  `--glass-regular` (footer).
- **Text:** primary `#141a28`; label `#263048`; muted `var(--muted) #6b6f8c`;
  caption `var(--world)`; on-world-fill `#fff` (auto-dark on light worlds).
- **Lines:** hairline `rgba(20,26,40,.07)`; head/foot rule `color-mix(--world 40%,
  transparent)`.
- **Radii:** sheet 28 (superellipse 1.8); group 16; row/action/swatch 14;
  pills/toggle/slider 999.
- **Shadows:** `--glass-rim`, `--glass-shadow`, `--glass-shadow-lg`.
- **Motion:** `--spring` for pops/toggles/segments; `.15–.22s`. Backdrop
  `backdrop-fade .2s`. Tab-switch: content cross-fade + 12px slide `.22s`.
  All wrapped in `@media (prefers-reduced-motion: reduce)` fallbacks.

**Type scale (px / weight):**
- World name (head): 15/800 · Operator badge 11/800
- Group caption: 11/800 uppercase, ls .06em
- Row label: 13.5/700 · Row sub: 11/500
- Control value pill: 12.5/800 tabular · Wallet/HP-MP text: 9/800 tabular
- Swatch name 12/800 · blurb 10/500 · emote name 9/700
- Action button 13/800 · About line 11/500

**Font:** `--font-apple` (already on `.room-full`). Numbers tabular
(`font-variant-numeric: tabular-nums`) so values don't jitter.

---

## 10. Interaction & edge cases

- **Open/close:** gear opens; ✕, click-scrim, and Esc close. Remember last-open
  tab per session (not persisted) so re-opening returns you where you were.
- **Tab switch:** instant; only the pane cross-fades. Rail active state animates.
- **Slider live-apply:** zoom/speed/volume apply on `input` (live), like today —
  no Save button anywhere; settings are immediate (P: game settings are live).
- **Muted state:** SFX volume slider disabled + dimmed when muted (existing).
- **Operator gating:** Operator group + Diagnostics disclosure only mount when
  `operator` — never leaked to kids/players (fixes audit #4).
- **Embedded vs standalone:** Account group hidden when embedded (host owns
  auth); everything else identical.
- **Realm with no worldActions:** the "This world" group simply doesn't render.
- **Visitor mode (farm):** hide Rest/Sleep + farm actions (viewer can't act);
  keep Sound/Play-skin/Circle/Sound (their own device prefs). Follow existing
  `snap.viewerRole==='visitor'` gating.
- **Small height (landscape phone):** sheet `max-height` + internal pane scroll;
  head/foot stay pinned, only `.cmd-pane` scrolls (nested-scroll is fine here —
  it's a modal, not inline content).
- **A11y:** `role="dialog" aria-modal="true"`, focus-trap, labelled tabs
  (`role="tab"`/`tablist"`/`tabpanel"`), toggles are real `<button
  role="switch" aria-checked>`, sliders keep the native `<input type=range>`
  underlay for keyboard + SR. 44px min tap targets.

---

## 11. Build plan for Sonnet (phased, each phase shippable)

**Phase A — extract + shell (no behaviour change).** Create
`ui/SettingsSheet.jsx` + a `settings-sheet.css` block. Build `.cmd-*` frame,
rail (both layouts via the 560px media query), 5 empty tabs, header, footer.
Wire `FarmRoom` to render `<SettingsSheet>` with the §8 props built from today's
`snap`/handlers. Delete the old inline `.settings`/`.set-card` JSX from `Hud.jsx`.
Verify the farm still exposes every setting, now grouped.

**Phase B — the control kit.** Implement the 8 controls (§6) as small components
(`Toggle`, `Slider`, `Segmented`, `ListRow`, `Swatch`, `Chip`, `ActionButton`,
`Disclosure`) + the `Group`/`Row` primitives. Re-point each tab's content at
them. This is where "pixel-perfect" lands — match the mockup.

**Phase C — realm adoption.** Point `RealmShell`'s gear at `<SettingsSheet>`;
build the realm-side §8 props in `RealmRoom` (kins/zoom/dev null; worldActions
from the realm module's controller; `onExit`). Add a `settings()` hook to the
`RealmModule` interface so each realm can supply its "This world" actions
(Bloomwall restart/forfeit, Arena forfeit/rank, etc.). Now all 6 share it.

**Phase D — polish.** Tab cross-fade, reduced-motion, focus-trap, remember-tab,
the optional drag-thumb value bubble, the HQ-audio footnote wiring.

**Reconcile with the porting agent BEFORE Phase C** — they own
`shared-game-shell-component-strategy.md` and are actively touching
`RealmShell.jsx`. `<SettingsSheet>` should be *the* thing their
`SettingsMenuButton`/`GameMenuSheet` opens; align the prop names with their
`GameShellState` so there's one contract, not two. Phases A–B are farm-local and
safe to build without them; C is the handshake.

---

## 12. What this delivers against the ask
- **One settings, 6 worlds** — a single `<SettingsSheet>` fed by one normalized
  contract; realms inject sections, never fork (P3).
- **Everything, findable** — every current + missing setting mapped to 5 one-tap
  tabs (§3 coverage table); rare/technical behind disclosures (P5).
- **Not confusing** — one control kit (§6), grouped inset lists, calm surface.
- **State-of-the-art & pixel-perfect** — Liquid-Glass tokens, iOS grouped lists,
  responsive rail↔strip, world-accented, spring motion; measurements in §4/§6/§9
  and the companion mockup.
```
