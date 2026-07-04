# Kingdom Handoff - Current State (2026-07-04)

This handoff captures the practical state of `apps/kingdom` after the recent
deployment, composer, multiplayer, and account-sync work.

## Scope Covered

- GitHub -> Vercel deployment path for the Kingdom web app.
- Tracked client data/assets in the repo and build output.
- Composer skill-slot UI with effect picker and practice-ground testing.
- Buya Arena multiplayer movement/combat fixes.
- Monster spawn sync and owner-authoritative monster wandering.
- Per-account skill-slot persistence through Supabase appearance JSON.

## Current App Layout

- `apps/kingdom/web`
  - Active Vite React client.
- `apps/kingdom/web/src/App.jsx`
  - Switches between Composer and Buya Arena.
  - Hydrates account/profile/character from Supabase.
  - Debounced cloud save path for the composer loadout.
- `apps/kingdom/web/src/lab/CharacterLab.jsx`
  - Composer UI.
  - Now includes `spec.skills` in the saved/loadout state.
- `apps/kingdom/web/src/lab/PracticePad.jsx`
  - Mini test room inside the Composer.
  - Uses selected skill slots and supports one-click effect testing.
- `apps/kingdom/web/src/lab/SkillBrowser.jsx`
  - New grouped effect picker with a single selected autoplay preview.
- `apps/kingdom/web/src/room/TestRoom.jsx`
  - Buya Arena full-screen room.
  - Multiplayer presence, movement, PvP, monster spawning, skill buttons.
- `apps/kingdom/web/src/net/account.js`
  - Supabase auth + profile + character + debounced appearance save.
- `apps/kingdom/data`
  - Tracked asset/data bundle now deployed with the app.

## Deployment State

The current intended production path is simple:

- Push `apps/kingdom` including the tracked data bundle to GitHub.
- Import the repo into Vercel with root directory `apps/kingdom`.
- Vercel uses `apps/kingdom/vercel.json` to build `apps/kingdom/web`.
- The production build copies `apps/kingdom/data` into `web/dist/data`.
- The client loads assets from `/data/...` on the same deployment.

Required Vercel env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Supabase note:

- Supabase now labels the browser-safe key as `Publishable key`.
- That key is the right value for `VITE_SUPABASE_ANON_KEY`.
- Do not use the `service_role` key.

Reference:

- `apps/kingdom/web/DEPLOY.md`

## Multiplayer / Arena Work Completed

### 1. Canvas zoom / center bug

Bug:

- Pressing Space or clicking attack/skill buttons could knock the canvas
  focus/size logic into a bad state, causing a wild zoom/centering glitch.

Fix:

- HUD buttons keep the canvas focused.
- Canvas sizing now uses CSS size + DPR separately from the backing buffer.
- Camera draw logic uses viewport width/height instead of raw canvas pixels.
- Zero-size resize reads are ignored to avoid invalid camera math.

### 2. Turn-first movement

Bug:

- Pressing a direction moved a tile immediately instead of turning first.

Fix:

- Player now turns first when changing direction.
- Holding the same direction after a short threshold moves the tile.

### 3. No player overlap

Bug:

- Characters could overlap each other.

Fix:

- Local movement now checks remote players and monsters before stepping.

### 4. Monster spawn sync

Bug:

- Monsters spawned by one user were not visible to others.

Fix:

- Monster spawns are broadcast as shared room events.
- Spawn payloads include stable ids and reconstruction data.
- Other clients rebuild the same monster locally from the payload.

### 5. Monster movement sync

Bug:

- Every client ran independent random monster wandering, so the same monster
  drifted into different positions for different users.

Fix:

- The spawning player is now the AI owner for that monster.
- Only the AI owner runs random movement.
- The AI owner broadcasts `monster_move` events.
- Non-owner clients replay those moves instead of simulating their own.
- Basic `monster_state` sync was added for hit/death state propagation.

## Composer / Skill Work Completed

### 1. Skill slots in Composer

The Composer now has a `Skills` section with three slots that mirror Buya
Arena skill buttons `1/2/3`.

### 2. Skill effect picker

New behavior in `SkillBrowser.jsx`:

- Effects are grouped by id bands.
- Only the selected effect is previewed.
- The right preview panel autoplays that selected effect only.
- Hover no longer previews other effects.

### 3. Practice ground skill test

The practice ground now:

- Uses the selected three skill slots.
- Casts skill 1 with `Space`.
- Casts skill slots `1/2/3` via keyboard.
- Lets the Composer `test` button fire the chosen effect immediately.
- When a skill is selected in the picker, that selected effect is also tested
  once in the practice ground.

## Account / Persistence State

Skill slots are now stored inside `spec.skills`.

This matters because:

- `App.jsx` already debounced-saves the full `spec`.
- `account.js` already writes `appearance_json: { spec }`.
- No new table or migration was needed for skill-slot persistence.

Current flow:

1. User changes appearance or skills in Composer.
2. `CharacterLab.jsx` emits a `spec` that includes `skills`.
3. `App.jsx` calls `saveLoadout(characterId, spec)`.
4. `account.js` upserts `appearance_json.spec`.
5. On login/account switch, `fetchMyCharacter()` hydrates `cloudSpec`.
6. Composer and Buya Arena both read the same skill slots from `spec.skills`.

Result:

- Skill slots follow the logged-in account/character.
- Buya Arena skill buttons populate from the saved Composer slots.

## Key Files Changed In This Pass

- `apps/kingdom/data/.gitignore`
- `apps/kingdom/vercel.json`
- `apps/kingdom/web/DEPLOY.md`
- `apps/kingdom/web/vite.config.js`
- `apps/kingdom/web/src/styles.css`
- `apps/kingdom/web/src/App.jsx`
- `apps/kingdom/web/src/net/account.js`
- `apps/kingdom/web/src/lab/CharacterLab.jsx`
- `apps/kingdom/web/src/lab/PracticePad.jsx`
- `apps/kingdom/web/src/lab/SkillBrowser.jsx`
- `apps/kingdom/web/src/room/TestRoom.jsx`

## Build / Verification Status

The web build has been run repeatedly after the recent changes and passed.

Typical command:

```powershell
cd C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\apps\kingdom\web
npm run build
```

Build note:

- Vite emits a harmless warning about `palettes.js` being both statically and
  dynamically imported.
- The asset copy step after build can take a bit because the tracked data
  bundle is large.

## Known Limitations

### 1. Monster AI ownership is still client-authoritative

- If the player who spawned a monster leaves, that monster loses its AI owner.
- Long term, this should move to a room host election or server authority.

### 2. Late joiners do not get old spawned monsters

- Current monster spawns are broadcast events, not room snapshots.
- A client joining after earlier spawns may miss those existing monsters.
- Long term, active room entities should come from a shared room snapshot or
  persisted room state.

### 3. PvP and combat are still MP-0 quality

- Victim validates incoming attack damage.
- This is fine for testing but not secure for production-grade PvP.

### 4. Data bundle is large

- Current local data footprint is roughly 953 MB and about 14.7k files.
- This keeps deployment simple but can slow clone/build/deploy time.

## Recommended Next Steps

1. Complete a fresh Vercel deploy with the correct Supabase env vars.
2. Smoke test account switching to confirm `spec.skills` follows the account.
3. Smoke test two-browser arena behavior:
   - movement
   - PvP hit/respawn
   - monster spawn visibility
   - monster movement sync
4. If multiplayer is continuing next, add room snapshot/state sync for active
   monsters so late joiners see the same room state.

## Quick Manual Smoke Test

1. Log into account A.
2. Open Composer and change skill slots 1/2/3.
3. Wait until the account bar shows `synced`.
4. Open Buya Arena and confirm the skill buttons match.
5. Log out and log into account B.
6. Confirm account B shows its own skill slots.
7. Return to account A and confirm A's saved slots come back.

## Notes For The Next Person

- The current working tree may contain uncommitted changes related to these
  updates. Review before committing.
- The most important integration contract now is:

```text
Composer state -> spec.skills -> Supabase appearance_json.spec
-> cloudSpec on login -> Buya Arena skill buttons
```

- If that contract is preserved, the Composer and Arena stay aligned.
