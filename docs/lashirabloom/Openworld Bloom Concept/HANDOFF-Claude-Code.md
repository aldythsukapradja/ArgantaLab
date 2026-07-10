# Handoff to Claude Code - LashiraBloom Openworld Foundation

Date: 2026-07-10

## Current goal

LashiraBloom is moving from a single HQ farm map into a hub-and-realms openworld. The current HQ basemap remains the command center. Five hotspots on that map teleport the player into five world maps where the same real Kingdom character can wander.

No dummy player data should be introduced. Character identity and account data come from the existing Supabase/Kingdom integration.

## What has been built

### 1. Worldmap assets renamed

Folder:

`apps/lashira/web/public/farm-art/Worldmap/`

Current files:

- `lashira-keep.png`
- `bloomwall-pass.png`
- `hearthrush-kitchen.png`
- `fountain-festival.png`
- `emberring-arena.png`

These replaced the original `Gemini_Generated_Image_*.png` names. Lashira Keep has not been regenerated yet; the user said to skip regeneration for now and will regenerate maps later.

### 2. Portal/worldmap registry

File:

`apps/lashira/web/src/game/world-map-registry.js`

Defines:

- `OPENWORLD_GAME_ID = 'builtin:openworld'`
- `WORLD_MAPS`
- `WORLD_PORTALS`
- `worldMapById(id)`
- `worldAssetUrl(map)`

Canonical portal IDs:

- `lashira_keep`
- `bloomwall_pass`
- `hearthrush_kitchen`
- `fountain_festival`
- `emberring_arena`

Canonical HQ hotspot coordinates:

| Portal | HQ hotspot |
|---|---|
| `lashira_keep` | `x27-32, y21-26` |
| `bloomwall_pass` | `x28-31, y32-33` |
| `hearthrush_kitchen` | `x29-30, y16-17` |
| `fountain_festival` | `x14-16, y26-29` |
| `emberring_arena` | `x47-48, y37-39` |

### 3. Openworld save wrapper

File:

`apps/lashira/web/src/game/openworld-save.js`

Uses existing generic game-state RPC wrappers from `farm-save.js` with:

- `gameId: builtin:openworld`
- `slot: default`

Saved shape:

```js
{
  currentRealmId,
  hqTile,
  hqFacing,
  realmPositionsById,
  updatedAt
}
```

Important: openworld position is personal player state, not shared circle farm state.

### 4. Reusable realm room

File:

`apps/lashira/web/src/game/RealmMapRoom.jsx`

This is a reusable canvas room for all five maps. It:

- Loads the selected worldmap image.
- Loads real player character resources via the same hero/compositor path as the farm.
- Falls back to the default farmer if a hero is unavailable.
- Supports keyboard movement with WASD / arrows.
- Supports pointer-drag movement.
- Saves realm position to Supabase through `saveOpenworldState`.
- Has a bottom-right action shell themed by the active realm.
- Has a return-to-HQ action.

Current collision model is intentionally simple: walkable inside map borders. Add per-map collision masks later after final art approval.

### 5. App routing

File:

`apps/lashira/web/src/App.jsx`

App now tracks:

- `worldScope`
- `hqSpawn`

Flow:

1. Player starts in `FarmRoom`.
2. Tapping a `realm` hotspot calls `onPortalTravel`.
3. App renders `RealmMapRoom`.
4. Returning from the realm restores `FarmRoom` near the portal.

App also attempts to restore `currentRealmId` from `builtin:openworld` on load, so a player can resume inside a realm.

### 6. HQ hotspot integration

File:

`apps/lashira/web/src/game/farm-map.js`

`HOTSPOTS` now starts with:

```js
...WORLD_PORTALS.map((p) => ({ kind: 'realm', id: p.id, portal: p, rect: p.hqHotspot }))
```

These are intentionally before older castle/shop/dungeon hotspots so portal transfer wins when rectangles overlap.

### 7. FarmRoom portal handling

File:

`apps/lashira/web/src/game/FarmRoom.jsx`

`FarmRoom` accepts:

- `onPortalTravel`
- `initialTile`
- `initialFacing`

When a tapped hotspot has `kind === 'realm'`, it calls:

```js
onPortalTravel?.(hs.id, {
  hqTile: [...g.player.tile],
  hqFacing: g.player.facing,
  portal: hs.portal
});
```

### 8. World transfer glow

File:

`apps/lashira/web/src/game/FarmRoom.jsx`

Added `drawWorldPortalGlows(ctx, now)`.

The five world-transfer hotspots now pulse with a canvas glow. This is intentionally not a bitmap overlay, so it should not create square sprite artifacts.

### 9. Pixel-art artifact fix

Two fixes were made:

1. The old basemap red-dot patcher was removed from `buildFarmMap()` in `farm-map.js`.
   - That patcher cloned square chunks of pixels over the basemap.
   - On the new clean basemap, those clones created visible square artifacts.

2. Harvest node sprites were restored in `FarmRoom.jsx`.
   - The user explicitly wants to keep tree/ore/stump pixel art.
   - The issue was the square patcher, not the tree sprite itself.

### 10. Farm field visual polish

File:

`apps/lashira/web/src/game/FarmRoom.jsx`

The large per-frame procedural farm tile layer was removed. The generated basemap now owns the farm soil visuals. Live crops, growth bars, and ready badges still draw on top.

Reason: the generated field art is much more beautiful than the flat procedural brown grid.

## Verification already run

Command:

```powershell
npm.cmd run build
```

Status: passes.

Dev server used:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5185
```

URL:

`http://127.0.0.1:5185/`

## Known caveats

- `basemap.png` is currently modified in the working tree and appears to be `1152x928`.
- `basemap_v4.png` is `1394x1128`.
- `basemap_v5.png` is untracked.
- The generated realm maps are `1152x928`.
- Realm collision is border-only for now.
- The bottom-right realm controller is functional shell UI, not final polished game-specific controls.
- Portal transfer currently happens by tapping hotspot rectangles. A formal launch modal can be added later.
- Some older local farm features still exist under the same FarmRoom, including crop/animal/combat systems.

## Current git status context

There are existing unrelated/untracked files in the worktree. Do not reset or revert user changes.

Important changed/added files from this openworld pass:

- `apps/lashira/web/src/App.jsx`
- `apps/lashira/web/src/game/FarmRoom.jsx`
- `apps/lashira/web/src/game/RealmMapRoom.jsx`
- `apps/lashira/web/src/game/farm-map.js`
- `apps/lashira/web/src/game/openworld-save.js`
- `apps/lashira/web/src/game/world-map-registry.js`
- `apps/lashira/web/src/styles.css`
- `apps/lashira/web/public/farm-art/Worldmap/*`

## Suggested next steps

1. Smoke-test the five portal transfers manually.
2. Confirm the farm field looks better with the basemap-owned soil.
3. Add a portal launch modal instead of instant transfer.
4. Add per-realm collision masks or polygon/block maps after final art approval.
5. Add worldmap return markers inside each realm.
6. Replace text/symbol temporary controller buttons with the shared icon system.
7. Regenerate `lashira-keep.png` without baked labels when the user is ready.
8. Add tests around registry integrity:
   - every portal has a map file
   - every portal has HQ hotspot and return spawn
   - every map id round-trips through `worldMapById`

## Core rule to preserve

Do not create separate game implementations for each map. Keep the architecture:

`WORLD_MAPS registry -> shared RealmMapRoom -> shared character renderer -> shared DB save -> shared HUD/controller shell`

That is the scalability spine for future LashiraBloom game modes.
