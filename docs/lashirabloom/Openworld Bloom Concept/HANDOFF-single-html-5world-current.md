# Handoff - Single HTML 5-World Prototype

Status: built prototype. Last updated 2026-07-11.

This is the current handoff for the fully contained LashiraBloom 5-world prototype. Read this before older handoff docs because the prototype has moved from concept to a working single HTML file.

## What Exists Now

The current playable prototype is a single embedded HTML file:

`apps/lashira/web/public/lashira-5worlds-prototype.html`

The source of truth for regenerating that file is:

`apps/lashira/web/scripts/build-5world-prototype.mjs`

Run from `apps/lashira/web`:

```bash
node scripts/build-5world-prototype.mjs
```

Test through the local dev server, not `file://`:

```text
http://127.0.0.1:5186/lashira-5worlds-prototype.html
```

The file embeds:

- HQ basemap
- Lashira Keep map
- Bloomwall Pass map
- Hearthrush Kitchen map
- Fountain Festival map
- Emberring Arena map

There is no Supabase adapter, no external runtime import, and no live database in this prototype. State is in-memory only.

## Shared Shell

Every world currently uses the same four-corner shell:

| Corner | Current behavior |
|---|---|
| Top left | Lashira Hero, shared HP/MP, Wood, Ore, Bloom, Diamonds |
| Top right | Home/world select and menu |
| Bottom left | Location, objective, current status |
| Bottom right | Shared action controller; labels change per world |

Progression language should be **BLOOM**, not EXP. The top-left readout now says `BLOOM`, not `Lv`.

## Controls

| Input | Behavior |
|---|---|
| WASD / Arrow keys | Move hero |
| Pointer drag | Move direction on touch/mouse |
| Enter | Main action |
| Spacebar | Dash |
| Escape | Return to world select |
| Bottom-right main button | World-specific primary action |
| Bottom-right small buttons | Return, secondary action, status/tool, mount, emote |

Dash costs MP and has a short cooldown.

## Worlds

| World | Current prototype loop |
|---|---|
| Lashira Keep | Spend Wood to upgrade Keep/BLOOM rank and gain Bloom |
| Bloomwall Pass | Start defense waves and place tower markers |
| Hearthrush Kitchen | Complete visible order tickets through Ingredients -> Prep -> Cook -> Serve |
| Fountain Festival | Bloom Gambit chess board, plus Picture Bloom alternate mode via side arrows |
| Emberring Arena | Move, dash, and tag simple bots for score |

## Hearthrush Kitchen Details

Kitchen has the most recent gameplay work.

Current station flow:

1. `Ingredients`
2. `Prep`
3. `Cook`
4. `Serve`

Current order rotation:

| Order | Ingredient | Method | Destination |
|---|---|---|---|
| Garden Stew | carrots + herbs | slow pot | Table 1 |
| Bloom Omelet | egg + greens | pan sear | Table 2 |
| Moonberry Tart | berries + flour | oven bake | Table 3 |
| Sunrise Soup | pumpkin + spice | simmer | Counter Seat |

Kitchen map overlays:

- Station glow markers: Ingredients, Prep, Cook, Serve, Orders
- Order Ticket panel
- Customer/order bubble
- Kitchen Flow panel with next step and patience

Collision was added for major counters/walls/furniture. Station points were moved to reachable walkable edges after an invisible-border issue.

Important functions:

- `kitchenOrders()`
- `currentKitchenOrder()`
- `kitchenStepText()`
- `runKitchenAction()`
- `kitchenStations()`
- `kitchenObstacles()`
- `drawKitchenLayer()`
- `drawKitchenOrderTicket()`
- `drawKitchenCustomerBubble()`

## Fountain Festival Details

The old floating match-3 board was removed.

Current direction:

- `Bloom Gambit`: chess-like board embedded in the plaza
- `Picture Bloom`: alternate relaxing picture-board mode
- Side arrows beside the board switch/cycle picture mode
- Main action gives Bloom

Important functions:

- `toggleFestivalMode()`
- `cycleFestivalPicture(dir)`
- `drawFestivalBoard()`
- `drawBloomGambit()`
- `drawPictureBloom()`
- `hitFestivalArrow(clientX, clientY)`

## Known Limitations

This prototype is intentionally lightweight.

| Area | Limitation |
|---|---|
| Persistence | No save/load; refresh resets state |
| Database | No Supabase or live backend |
| Collision | Kitchen has basic rectangle collision only; other worlds are mostly open |
| Character | Hero is canvas-drawn placeholder, not final sprite sheet |
| Kitchen | Orders are fixed rotation, not timed customer spawn logic |
| Festival | Chess is prototype logic, not full legal chess |
| Mobile | Pointer movement works, but UI polish still needed |
| File size | HTML is large because maps are embedded as data URLs |

## Next Best Build Steps

1. Add a debug toggle to show kitchen collision rectangles and station radii.
2. Tune kitchen station coordinates visually after one full manual playtest.
3. Add real customer patience bars and failed-order consequences.
4. Add depth sorting masks for indoor maps so the hero appears behind tall counters/walls where appropriate.
5. Make Bloomwall Pass a real lane/tower loop with fixed tower pads.
6. Add portal/hotspot entry from HQ instead of only landing cards.
7. Replace procedural hero with a reusable character builder/sprite system.
8. Split the generator into clearer module sections once the prototype stabilizes.

## Safety Rules For Future Work

- Edit `build-5world-prototype.mjs`, then regenerate the HTML.
- Do not manually edit the generated HTML unless it is a one-off emergency.
- Keep the single HTML self-contained.
- Do not add Supabase or external imports to this prototype unless the user changes the direction.
- Test through `http://127.0.0.1:5186/...`, not `file://`, because browser automation and some browser policies behave differently on local files.
- Keep rewards cosmetic/progression-only: Diamonds are for skins, Bloom is progression, no pay-to-win.

