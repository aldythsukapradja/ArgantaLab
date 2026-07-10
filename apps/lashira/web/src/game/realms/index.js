// Realm module registry — maps a realm id to its habit-loop module factory.
// One host (RealmRoom) + five configs. Adding a realm = one entry here + one
// module file that implements the RealmModule interface (see util.js / any
// module for the shape).
import { createKitchenModule } from './kitchen.jsx';
import { createBloomwallModule } from './bloomwall.js';
import { createFestivalModule } from './festival.jsx';
import { createKeepModule } from './keep.js';
import { createArenaModule } from './arena.js';

const REGISTRY = {
  hearthrush_kitchen: createKitchenModule,
  bloomwall_pass: createBloomwallModule,
  fountain_festival: createFestivalModule,
  lashira_keep: createKeepModule,
  emberring_arena: createArenaModule,
};

// Fallback: a walk-only "explore" module so an unmapped realm still runs.
function createExploreModule(api) {
  return {
    kind: 'explore', movement: true,
    tick() {}, onTapWorld() {}, onAction(id) { if (id === 'menu') api.flash('Menu'); },
    controller: () => ({ primary: { id: 'look', label: 'Look', icon: '👁' }, ring: [{ id: 'menu', label: 'Menu', icon: '≡', kind: 'utility' }] }),
    hud: () => ({ objective: api.realm.name }),
    cleanup() {},
  };
}

export function getRealmModule(realmId) {
  return REGISTRY[realmId] || createExploreModule;
}
