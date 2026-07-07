# LashiraBloom — Gameplay Concept (v2)

Status: CONCEPT for review — no build yet. Updated 2026-07-07.
Grounded in FarmVille mechanics research (see §12 sources).

This supersedes the earlier chat concept. It covers the farm economy, real-time
crops + health bars, tap-to-farm, animal care, Kin deployment, stamina, live
animals, and the peer-mount fix — with multiplayer-sync notes throughout (this
is a shared circle farm).

---

## 0. Headline change — protect the son's Diamonds (unblock testing)

**Problem:** the tester (kid) won't play because spending 💎 Diamonds on seeds
feels like *losing his hard-earned learning currency.* Diamonds come from
finishing learning rings — they're precious and should never drain in a game.

**Fix — the farm gets its OWN currency, identical for kids and adults:**
- **🪙 Coins** (working name "Blooms") are the farm's money. Earned only by
  selling produce / animal goods; spent only on seeds, animals, upgrades.
- **💎 Diamonds are NEVER spent or reduced in the farm.** They may show as a
  read-only badge (your real balance) but the farm can't touch them.
- **Same rules for kids and adults** — one economy, no XP-vs-Diamond split. This
  "releases" the current kid/adult divergence.
- Philosophy intact: farming stays *flavor, not a learning shortcut* — Coins
  can't buy anything in the learning apps; they never convert to Diamonds.
- Starter grant: everyone begins with enough Coins to plant, so there's zero
  fear of "using up" anything real. (Old behavior — kids +1 XP on sell, adults
  Diamonds on sell, seeds cost Diamonds — is fully removed.)

Sync: Coins are per-farm shared state (part of the circle save), synced via the
same intents as everything else.

---

## 1. Real-time crops + hydration/health (replaces day-gated growth)

Today a crop advances one stage **per day when you sleep**. New per-plot model:
- `plantedAt` (timestamp) · `hydration` 0–100 · `health` 0–100 · `cropId`.
- **Growth = elapsed real time since `plantedAt`, but the clock only ticks while
  `hydration > 0`.** A dry crop *pauses* — watering matters.
- **Hydration decays** over real time; watering refills to 100.
- **Wilt:** hydration at 0 too long → `health` falls. Watering recovers it.
- **Ready** at 100% growth → harvest.
- Visual stages (sprout → young → mature → ripe) driven by growth %, so the
  reskinned crop art (pumpkin/carrot/turnip stage art) shows at ripe.

Why it fits: crops grow **while the kid is away learning/at school**, so they
return to tend + harvest — a healthy return loop, not a chore.

## 2. Crop health bar

Slim bar floating above each growing plot:
- **Fill = growth %** (to ripe). **Color = state:** green (growing+hydrated) →
  blue tint (just watered) → amber (thirsty, growth paused) → red (wilting).
- 💧 pip shows hydration level. Ripe crops **pulse/glow** ("harvest me").

## 3. Tap-to-farm — water / till / harvest happen IN the farm area

Move the *doing* of farming onto the plots themselves (FarmVille one-tap),
instead of walk-to-tile + press a button:
- Tap **untilled** → till · tap **tilled** → plant selected seed · tap
  **growing** → water · tap **ripe** → harvest.
- The farmer **auto-walks to the plot and performs the contextual action** — no
  manual tool switching. Keeps the avatar meaningful with FarmVille's feel.
- The current walk + controller still works for moving around; tap is the
  farm-action shortcut.

## 4. Restyle the action cluster like Kingdom

The bottom-right cluster is reworked to match **Kingdom Heroes' action cluster**
look (the skill-circle / attack-circle styling already partly shared):
- Because water/till/harvest are now **tap-on-farm**, the cluster is no longer
  three tool orbs. It becomes: **seed picker** (which crop to plant), **Sleep**
  (recharge), **Mount** toggle, and the **animal-action** affordance (§5).
- Same glass orbs + arc layout + slot badges as Kingdom, so it reads as one
  family of UI across the two games.

## 5. Animal care — tap cow / sheep / chicken for actions + goods

Animals become interactive like FarmVille livestock:
- Tap an animal → small radial action menu (Kingdom-style): **Feed**, **Pet**,
  and **Collect** when a good is ready.
- **Feed** (costs a bit of feed/stamina) → after a real-time timer the animal
  produces a good.
- **Pet** → raises affection (affects yield/among-family flavor), small stamina.
- **Goods:** cow → 🥛 Milk · sheep → 🧶 Wool · chicken → 🥚 Egg. Collect → adds to
  produce, sells for Coins.
- A tiny **ready indicator** (icon bob над the animal) shows a good is waiting,
  matching the crop "harvest me" cue.

Sync: feed/pet/collect are per-animal intents (like plot intents); goods-ready
is derived from `fedAt` timestamp so all family members see the same state.

## 6. Stamina — day is ONLY for stamina

- **Every action costs stamina** — till, plant, water, harvest, feed, pet.
- **Sleep restores stamina to full.** The day counter still ticks for season
  flavor but **no longer advances crops or animals at all.** Sleeping = recharge.
- Out of stamina → rest (sleep) to continue.

## 7. Kin deployment — per-character selector + sync

Extends the current "max 6 Kins" rule into a real loadout the player controls:
- **Kin panel gets a selector:** the player picks **which of their acquired Kins
  (up to 6) are "deployed"** onto the farm. Deployed Kins appear + do their task
  (water/harvest helpers); undeployed stay in the roster.
- Stored **per user** (personal slot, keyed by profile id) — each family member
  has their OWN loadout; the Settings "Active Kin n/6" card reflects it.
- **Synced:** deployed Kins are owner-simulated (already the model), so each
  member's chosen Kins show on the shared farm with owner tags. Changing your
  loadout broadcasts so peers add/remove your Kins live.

## 8. FIX — peer mounts render the real skin (currently broken)

**Bug:** a remote player's mount renders as a broken placeholder (see the white
blob under a peer). The LOCAL player's mount uses the real Kingdom mount art
(`drawKingdomMount` from their hero resources), but PEER mounts fall back to
`drawMountPlaceholder`.

**Fix:** load each peer's mount resources from their broadcast `heroSpec` (same
`loadPlayerResources` path used for their character), cache per peer, and render
peer mounts through the real Kingdom mount compositor — so everyone's mount looks
correct. Fallback to the placeholder only while the peer's resources are still
loading or unavailable.

## 9. Individual animal animation

The reskinned cow/sheep/chicken are single static PNGs sliding around. Make each
**individually alive** with no new art:
- Per-animal **procedural motion:** bob + squash-stretch while walking,
  facing-flip toward movement, idle nibble pause — each with its **own phase
  offset** so they never move in lockstep. Chicken hops; cow/sheep waddle.
- Upgrade path: PixelLab 2–4 frame walk cycles per animal later (sheet has one
  pose each, so real frames need generation).
- Purely local visual on top of the host's broadcast positions — no extra sync.

## 10. Multiplayer sync summary

All new state is **derived from timestamps + small intents**, which is exactly
what the current engine syncs well:
- Crops: `plant{plantedAt}`, `water{wateredAt}`, `harvest` intents; growth/health
  computed locally → identical on every client, no per-tick streaming.
- Animals: `feed{fedAt}`, `pet`, `collect` intents; goods-ready derived.
- Coins: shared farm state in the circle save.
- Kin loadout: per-user, broadcast on change (owner-simulated render).
- Peer mount + animal animation: local visual only.

## 11. Migration / compatibility

- Old crops (`growth`/day fields) → convert on load: map current growth to a %
  and set a synthetic `plantedAt`, hydration 100. No farm lost.
- Old currency: seed any legacy Diamond-spend behavior removed; grant starter
  Coins; Diamonds untouched.

## 12. Open decisions (need your calls before build)

1. **Currency name** — "Coins" 🪙 or a themed name ("Blooms"/"Petals")?
2. **Grow times** — engagement (minutes) vs return-loop (hours) vs per-crop mix?
3. **Wither** — do neglected crops ever **die**, or only **pause + wilt** and
   never die? (Lean gentle-never-die for kids.)
4. **Hydration decay** — how often must they water (e.g. every ~30 real min)?
5. **Animal good timers** — how long after feeding until milk/wool/egg is ready?
6. **Stamina cost per action** and starting/max stamina.

## 13. Suggested build order (each harness/preview-verified, revertable)

1. **Economy swap** (Coins, protect Diamonds, unify kids/adults) — unblocks the
   son immediately; small + isolated.
2. **Peer mount fix** — quick, self-contained bug fix.
3. **Kin loadout selector + sync** — builds on existing max-6/owner model.
4. **Real-time crop model + health bar + tap-to-farm.**
5. **Animal actions + goods.**
6. **Living-animal procedural animation.**
7. **Kingdom-style action-cluster restyle.**

## Sources (FarmVille research)
- Wither — FarmVille Wiki: https://farmville.fandom.com/wiki/Wither
- How do I water crops? — FarmVille 2: https://zyngasupport.helpshift.com/hc/en/10-farmville-2/faq/117-how-do-i-water-crops/
- Crop — FarmVille 2 Country Escape Wiki: https://farmvillecountryescape.fandom.com/wiki/Crop
- Withered crops — gamepressure: https://www.gamepressure.com/farmville/withered-crops/z228dd
