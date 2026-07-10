# LashiraBloom Shared Game Shell Component Strategy

Status: design strategy only, no build. Created 2026-07-10.

Companions:

- [`portal-hotspot-plan.md`](./portal-hotspot-plan.md)
- [`roadmap-and-build-plan.md`](./roadmap-and-build-plan.md)
- [`architecture-spine-and-world-builder-design.md`](./architecture-spine-and-world-builder-design.md)

## 1. Goal

Every LashiraBloom realm must use the same game shell.

If the HUD is polished once, all games inherit the polish:

- Kingdom hub
- Lashira Keep
- Bloomwall Pass
- Hearthrush Kitchen
- Fountain Festival
- Emberring Arena
- Future event/prototype realms

Only the realm-specific action buttons, icons, and labels should change.

## 2. Four-corner shell

| Corner | Component | Fixed across all games | Realm-specific changes |
|---|---|---|---|
| Top left | `CharacterStatusPanel` | Character avatar/name, HP, MP, Wood, Ore, Bloom, Diamonds | Optional small realm score badge |
| Top right | `SettingsMenuButton` / `GameMenuSheet` | Settings/menu entry, audio, exit realm, help, controls, debug if operator | Realm help text, restart/forfeit labels |
| Bottom left | `LocationInfoPanel` | Current place, realm name, portal/zone, status, coordinates/debug in dev | Objective hint, wave/order/round state |
| Bottom right | `ActionControllerShell` | Shared controller layout, movement/action slots, cooldown rings, disabled states | Icons, actions, button count, hotkeys, labels |

Hard rule:

> No realm should create its own HUD corner components. It can only provide data/actions to the shared shell.

## 3. Component contract

### 3.1 `CharacterStatusPanel`

Always shown at top left.

Displays:

- character portrait / sprite icon
- name
- level/path
- HP bar
- MP bar
- Wood
- Ore
- Bloom
- Diamond

Notes:

- Diamonds stay visible because skins are central identity, but gameplay does not spend Diamonds.
- Kids can see Diamonds, but game actions never grant them Diamonds or Character XP.
- Currency order should remain fixed across every realm.

### 3.2 `SettingsMenuButton`

Always shown at top right.

For now it can stay simple, but it must be shared:

- settings
- audio
- controls
- exit realm / return to Kingdom
- help
- operator/debug overlay toggle when allowed

The visual can be ugly today. The important decision is that it is one component.

### 3.3 `LocationInfoPanel`

Always shown at bottom left.

Displays:

- current realm / zone name
- current portal or room
- short objective
- live state: wave, order queue, round, event, safe zone
- optional dev coordinates

Examples:

- `Lashira Keep · Castle District`
- `Bloomwall Pass · Wave 3/10`
- `Hearthrush Kitchen · 4 orders waiting`
- `Fountain Festival · Garden Puzzle`
- `Emberring Arena · Friendly Duel`

### 3.4 `ActionControllerShell`

Always shown at bottom right.

The shell is shared. Realms only provide actions:

```ts
GameAction = {
  id,
  label,
  icon,
  hotkey,
  cooldownMs,
  disabledReason,
  kind: "primary" | "skill" | "tool" | "utility",
}
```

Examples:

| Realm | Actions inside shared shell |
|---|---|
| Kingdom hub | interact, mount, bag, emote |
| Lashira Keep | build, upgrade, inspect, decorate |
| Bloomwall Pass | place tower, hero skill, repair, start wave |
| Hearthrush Kitchen | prep, cook, serve, clean |
| Fountain Festival | swap/merge, booster, claim, event task |
| Emberring Arena | strike, skill 1, skill 2, dodge/interact |

## 4. Shared shell data interface

Conceptual API:

```ts
GameShellState = {
  character: CharacterStatus,
  resources: {
    wood,
    ore,
    bloom,
    diamonds,
  },
  location: {
    realmId,
    realmName,
    zoneName,
    objective,
    debugTile?,
  },
  settings: {
    canExit,
    canRestart,
    debugAllowed,
  },
  actions: GameAction[],
}
```

Every realm runtime provides this state. The UI shell renders it.

## 5. Portal icon design strategy

Each player-facing portal should have a fancy icon that appears:

- on the map marker
- in the launch modal
- in Circle HQ World Builder
- in analytics/realm tables

| # | Portal | Icon concept | Shape language | Color |
|---|---|---|---|---|
| 1 | Lashira Keep | castle crest with small crown | shield / keep silhouette | royal indigo |
| 2 | Bloomwall Pass | gate with sprout shield | arched gate / leaf shield | emerald green |
| 3 | Hearthrush Kitchen | flame over serving cloche | hearth flame / plate | amber gold |
| 4 | Fountain Festival | fountain ring with sparkles | water ring / festival star | rose magenta |
| 5 | Emberring Arena | ember circle with crossed practice blades | ring / spark / crossed icons | warm red |

Resource zone icons:

| Letter | Zone | Icon concept | Color |
|---|---|---|---|
| A | Sunseed Farm | sun over seed row | lime |
| B | Meadowkin Pastures | animal hoof / meadow fence | green |
| C | Ironroot + Crystalvein | tree root + crystal pick | cyan |
| D | Moonwell Dock | moon hook / fish ripple | blue |
| E | Petalbloom Garden | flower petal swirl | violet |

## 6. Ground-truth portal and zone table

This table is the design ground truth for map markers, launch modals, HQ World Builder, and implementation.

| Marker | Type | ID | Display name | Hotspot rect | Return spawn | Pillar / Function |
|---|---|---|---|---|---|---|
| 1 | Portal | `lashira_keep` | Lashira Keep | `x27-32, y21-26` | `x30, y25` | City / stronghold |
| 2 | Portal | `bloomwall_pass` | Bloomwall Pass | `x28-31, y32-33` | `x30, y33` | Defense / adventure |
| 3 | Portal | `hearthrush_kitchen` | Hearthrush Kitchen | `x29-30, y16-17` | `x30, y18` | Cooking / service |
| 4 | Portal | `fountain_festival` | Fountain Festival | `x14-16, y26-29` | `x15, y29` | Puzzle / seasonal events |
| 5 | Portal | `emberring_arena` | Emberring Arena | `x47-48, y37-39` | `x48, y38` | Social competition |
| A | Resource zone | `sunseed_farm` | Sunseed Farm | `x7-26, y6-15` | `x16, y16` | Food / crops |
| B | Resource zone | `meadowkin_pastures` | Meadowkin Pastures | `x35-55, y4-15` | `x45, y16` | Animals / food |
| C | Resource zone | `ironroot_crystalvein` | Ironroot + Crystalvein | `x38-57, y18-30` | `x48, y24` | Wood / stone / ore |
| D | Resource zone | `moonwell_dock` | Moonwell Dock | `x12-15, y37-38` | `x13, y38` | Fish / food |
| E | Resource zone | `petalbloom_garden` | Petalbloom Garden | `x3-9, y20-26` | `x7, y24` | Garden / event resource |

## 7. Build strategy

Today's goal:

1. Current basemap remains playable.
2. Character wanders on top.
3. All 1-5 portal hotspots use the same launch modal.
4. All A-E resource zones show the same location panel behavior.
5. All HUD corners come from shared shell components.

Do not build a different HUD for each game.
