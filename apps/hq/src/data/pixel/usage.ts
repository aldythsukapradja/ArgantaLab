// Usage sites — the render-key coverage x-ray over the other Arganta apps.
// Seeded from real keys in apps/web (openworld/kin.ts uses a `render` sprite key;
// evolutions.ts notes tier-2/3 sprites swap in "with zero engine change"). In a
// follow-up a build script walks apps/web/src/data/** and regenerates this file;
// for now it's a hand-seeded snapshot so the coverage view renders honestly.
import type { UsageSite } from './types'

export const USAGE: UsageSite[] = [
  { id: 'web.openworld.kin.render.ember_pup', app: 'argantalab', surface: 'Openworld · Kin', key: 'kin.ember_pup', resolvedAssetId: 'asset.char.ember_pup', state: 'wired', sourceFile: 'apps/web/src/data/openworld/kin.ts' },
  { id: 'web.openworld.kin.render.slime', app: 'argantalab', surface: 'Openworld · Kin', key: 'kin.slime', state: 'placeholder', sourceFile: 'apps/web/src/data/openworld/kin.ts' },
  { id: 'web.openworld.kin.render.frostling', app: 'argantalab', surface: 'Openworld · Kin', key: 'kin.frostling', state: 'placeholder', sourceFile: 'apps/web/src/data/openworld/kin.ts' },
  { id: 'web.kinquest.evolution.ember_pup_t2', app: 'argantalab', surface: 'KinQuest · Evolutions', key: 'kin.ember_pup.t2', state: 'placeholder', sourceFile: 'apps/web/src/data/kinquest/evolutions.ts' },
  { id: 'web.openworld.mount.emberfox', app: 'argantalab', surface: 'Openworld · Mounts', key: 'mount.emberfox', resolvedAssetId: 'asset.mount.emberfox', state: 'wired', sourceFile: 'apps/web/public/assets/mounts/emberfox.png' },
  { id: 'web.openworld.mount.crystaldrake', app: 'argantalab', surface: 'Openworld · Mounts', key: 'mount.crystaldrake', resolvedAssetId: 'asset.mount.crystaldrake', state: 'wired', sourceFile: 'apps/web/public/assets/mounts/crystaldrake.png' },
  { id: 'web.openworld.mount.griffin', app: 'argantalab', surface: 'Openworld · Mounts', key: 'mount.griffin', state: 'placeholder', sourceFile: 'apps/web/src/components/openworld/MountSprite.tsx' },
  { id: 'web.avatar.buddy_1', app: 'argantalab', surface: 'Avatar · Buddy', key: 'avatar.buddy_1', resolvedAssetId: 'asset.avatar.buddy_1', state: 'wired', sourceFile: 'apps/web/src/components/avatar/Buddy.tsx' },
  { id: 'web.shop.style.hat_03', app: 'argantalab', surface: 'Shop · Style', key: 'shop.hat_03', state: 'missing', sourceFile: 'apps/web/src/components/shop/StyleShop.tsx' },
  { id: 'web.games.modal.icon_pack', app: 'argantalab', surface: 'Games · Modal', key: 'games.icon_pack', state: 'placeholder', sourceFile: 'apps/web/src/components/games/GameModal.tsx' },
]
