// The seed catalogue — a curated starter set that spans T0 / T1 / T2 from day
// one, so the tier machinery, facets, and agent queries are exercised by real
// data immediately. Adapters (sync) append to this shape; nothing here is
// generated at runtime. Every item carries its provenance (source + license →
// tier) and its curated metadata. `verified: true` = a human confirmed the tags.
import type { VaultItem, License, Animation } from './types'
import { tierForLicense } from './vocab'

const FETCHED = '2026-07-03'

// LPC canonical 6-animation set (64×64, 4-directional) — reused across bases.
const LPC_ANIMS: Animation[] = [
  { name: 'idle', frames: 1, fps: 1, directions: 4, loop: true },
  { name: 'walk', frames: 9, fps: 8, directions: 4, loop: true },
  { name: 'cast', frames: 7, fps: 8, directions: 4, loop: false },
  { name: 'thrust', frames: 8, fps: 10, directions: 4, loop: false },
  { name: 'shoot', frames: 13, fps: 10, directions: 4, loop: false },
  { name: 'slash', frames: 6, fps: 12, directions: 4, loop: false },
  { name: 'hurt', frames: 6, fps: 10, directions: 1, loop: false },
]

interface Seed {
  id: string; name: string
  source: string; sourceId: string; pack?: string; url: string; author?: string; license: License
  domain: string[]; kind: string; isCharacter?: boolean; characterType?: string
  theme: string[]; style?: string; groupId?: string; tags: string[]; verified?: boolean
  w: number; h: number; perspective?: string; swatch?: string[]; thumbUrl?: string
  animations?: Animation[]
  status?: VaultItem['status']
}

function mk(s: Seed): VaultItem {
  return {
    id: s.id, name: s.name,
    source: { name: s.source, sourceId: s.sourceId, pack: s.pack, url: s.url, author: s.author, license: s.license, tier: tierForLicense(s.license), fetchedAt: FETCHED },
    curated: {
      domain: s.domain, kind: s.kind, isCharacter: s.isCharacter ?? (s.kind === 'character' || s.kind === 'creature'),
      characterType: s.characterType, theme: s.theme, style: s.style, groupId: s.groupId,
      tags: s.tags, verified: s.verified ?? false,
    },
    form: { size: { w: s.w, h: s.h }, perspective: s.perspective, colorCount: s.swatch?.length, swatch: s.swatch, thumbUrl: s.thumbUrl },
    animations: s.animations ?? [],
    relationships: {},
    status: s.status,
  }
}

export const CATALOGUE: VaultItem[] = [
  // ── Kenney · T0 / CC0 · Pixel Platformer ──────────────────────────────────
  mk({ id: 'ref.kenney.pixel-platformer.coin_gold', name: 'Gold Coin', source: 'kenney', sourceId: 'pixel-platformer/coin', pack: 'Pixel Platformer', url: 'https://kenney.nl/assets/pixel-platformer', license: 'CC0', domain: ['platformer', 'rpg'], kind: 'item', theme: ['fantasy', 'cute'], style: 'retro-8bit', groupId: 'kenney-pixel-platformer', tags: ['coin', 'pickup', 'currency', 'reward'], w: 18, h: 18, perspective: 'side', swatch: ['#fbcb43', '#f89c1c', '#fff2d0'], verified: true }),
  mk({ id: 'ref.kenney.pixel-platformer.player_idle', name: 'Platformer Player', source: 'kenney', sourceId: 'pixel-platformer/player', pack: 'Pixel Platformer', url: 'https://kenney.nl/assets/pixel-platformer', license: 'CC0', domain: ['platformer'], kind: 'character', characterType: 'hero', theme: ['cute', 'modern'], style: 'retro-8bit', groupId: 'kenney-pixel-platformer', tags: ['player', 'hero', 'green'], w: 18, h: 18, perspective: 'side', swatch: ['#63c74d', '#3e8948', '#ffffff', '#262b44'], animations: [{ name: 'idle', frames: 2, fps: 4, directions: 1, loop: true }, { name: 'walk', frames: 2, fps: 8, directions: 1, loop: true }, { name: 'jump', frames: 1, fps: 1, directions: 1, loop: false }], verified: true }),
  mk({ id: 'ref.kenney.pixel-platformer.slime_green', name: 'Green Slime', source: 'kenney', sourceId: 'pixel-platformer/slime', pack: 'Pixel Platformer', url: 'https://kenney.nl/assets/pixel-platformer', license: 'CC0', domain: ['platformer', 'rpg'], kind: 'creature', characterType: 'enemy', theme: ['fantasy', 'cute'], style: 'retro-8bit', groupId: 'kenney-pixel-platformer', tags: ['slime', 'enemy', 'blob'], w: 18, h: 18, perspective: 'side', swatch: ['#63c74d', '#3e8948', '#262b44'], animations: [{ name: 'idle', frames: 2, fps: 3, directions: 1, loop: true }], verified: true }),
  mk({ id: 'ref.kenney.pixel-platformer.heart', name: 'Heart', source: 'kenney', sourceId: 'pixel-platformer/heart', pack: 'Pixel Platformer', url: 'https://kenney.nl/assets/pixel-platformer', license: 'CC0', domain: ['platformer', 'ui'], kind: 'icon', theme: ['cute'], style: 'retro-8bit', groupId: 'kenney-pixel-platformer', tags: ['heart', 'health', 'life', 'hud'], w: 18, h: 18, swatch: ['#e43b44', '#ff6b6b'], verified: true }),

  // ── Kenney · T0 / CC0 · Roguelike/RPG ─────────────────────────────────────
  mk({ id: 'ref.kenney.roguelike-rpg.knight', name: 'Knight', source: 'kenney', sourceId: 'roguelike-rpg/knight', pack: 'Roguelike/RPG', url: 'https://kenney.nl/assets/roguelike-rpg-pack', license: 'CC0', domain: ['rpg', 'roguelike', 'topdown'], kind: 'character', characterType: 'hero', theme: ['fantasy', 'medieval'], style: '16bit', groupId: 'hero-party-4', tags: ['knight', 'warrior', 'armor', 'hero'], w: 16, h: 16, perspective: 'top-down', swatch: ['#9badb7', '#5a6988', '#d9a066', '#262b44'], animations: [{ name: 'walk', frames: 4, fps: 8, directions: 4, loop: true }], verified: true }),
  mk({ id: 'ref.kenney.roguelike-rpg.skeleton', name: 'Skeleton Warrior', source: 'kenney', sourceId: 'roguelike-rpg/skeleton', pack: 'Roguelike/RPG', url: 'https://kenney.nl/assets/roguelike-rpg-pack', license: 'CC0', domain: ['rpg', 'roguelike'], kind: 'creature', characterType: 'enemy', theme: ['fantasy', 'horror', 'dungeon'], style: '16bit', tags: ['skeleton', 'undead', 'enemy'], w: 16, h: 16, perspective: 'top-down', swatch: ['#ebede9', '#9badb7', '#262b44'], animations: [{ name: 'walk', frames: 4, fps: 8, directions: 4, loop: true }], verified: true }),
  mk({ id: 'ref.kenney.roguelike-rpg.potion_red', name: 'Red Potion', source: 'kenney', sourceId: 'roguelike-rpg/potion', pack: 'Roguelike/RPG', url: 'https://kenney.nl/assets/roguelike-rpg-pack', license: 'CC0', domain: ['rpg', 'roguelike'], kind: 'item', theme: ['fantasy'], style: '16bit', tags: ['potion', 'health', 'consumable'], w: 16, h: 16, swatch: ['#e43b44', '#a22633', '#ffffff'], verified: true }),
  mk({ id: 'ref.kenney.roguelike-rpg.chest', name: 'Treasure Chest', source: 'kenney', sourceId: 'roguelike-rpg/chest', pack: 'Roguelike/RPG', url: 'https://kenney.nl/assets/roguelike-rpg-pack', license: 'CC0', domain: ['rpg', 'roguelike'], kind: 'prop', theme: ['fantasy', 'dungeon'], style: '16bit', tags: ['chest', 'loot', 'treasure', 'container'], w: 16, h: 16, swatch: ['#d9a066', '#8f563b', '#fbcb43'], verified: true }),
  mk({ id: 'ref.kenney.roguelike-dungeon.wall', name: 'Dungeon Wall Tile', source: 'kenney', sourceId: 'roguelike-dungeon/wall', pack: 'Roguelike Dungeon', url: 'https://kenney.nl/assets/roguelike-modern-city', license: 'CC0', domain: ['rpg', 'roguelike', 'tileset'], kind: 'tile', theme: ['dungeon', 'fantasy'], style: '16bit', tags: ['wall', 'dungeon', 'tileset', 'stone'], w: 16, h: 16, perspective: 'top-down', swatch: ['#5a6988', '#3a4466', '#262b44'], verified: true }),

  // ── Kenney · T0 / CC0 · UI Pack (Pixel Adventure) ─────────────────────────
  mk({ id: 'ref.kenney.ui-pixel.button_play', name: 'Play Button', source: 'kenney', sourceId: 'ui-pixel/button-play', pack: 'UI Pack · Pixel Adventure', url: 'https://kenney.nl/assets/ui-pack-adventure', license: 'CC0', domain: ['ui'], kind: 'ui-element', theme: ['modern'], style: 'retro-8bit', groupId: 'kenney-ui-pixel', tags: ['button', 'play', 'menu', 'hud'], w: 48, h: 16, swatch: ['#63c74d', '#3e8948', '#ffffff'], verified: true }),
  mk({ id: 'ref.kenney.ui-pixel.panel', name: 'Pixel Panel', source: 'kenney', sourceId: 'ui-pixel/panel', pack: 'UI Pack · Pixel Adventure', url: 'https://kenney.nl/assets/ui-pack-adventure', license: 'CC0', domain: ['ui'], kind: 'ui-element', theme: ['modern'], style: 'retro-8bit', groupId: 'kenney-ui-pixel', tags: ['panel', 'frame', 'window', 'nineslice'], w: 64, h: 64, swatch: ['#b86f50', '#733e39', '#fbcb43'], verified: true }),

  // ── OpenGameArt · T0 / CC0 ────────────────────────────────────────────────
  mk({ id: 'ref.oga.denzi.overworld_tiles', name: 'DENZI Overworld Tiles', source: 'opengameart', sourceId: 'oga/denzi-overworld', url: 'https://opengameart.org/content/denzis-public-domain-art', author: 'DENZI', license: 'CC0', domain: ['rpg', 'topdown', 'tileset'], kind: 'tileset', theme: ['fantasy', 'nature'], style: '16bit', tags: ['overworld', 'tileset', 'grass', 'water', 'map'], w: 16, h: 16, perspective: 'top-down', swatch: ['#63c74d', '#2ce8f5', '#8f563b', '#265c42'], verified: true }),
  mk({ id: 'ref.oga.space_nebula_bg', name: 'Space Nebula Background', source: 'opengameart', sourceId: 'oga/space-nebula', url: 'https://opengameart.org/content/cc0-resources', license: 'CC0', domain: ['cinematic', 'shmup', 'marketing'], kind: 'background', theme: ['space', 'sci-fi'], style: 'modern-hd-pixel', groupId: 'cutscene-space', tags: ['nebula', 'stars', 'background', 'parallax', 'cinematic'], w: 320, h: 180, swatch: ['#181425', '#3b5dc9', '#b55088', '#ffcd75'], verified: true }),

  // ── OpenGameArt · T1 / CC-BY / OGA-BY ─────────────────────────────────────
  mk({ id: 'ref.oga.orthogonal_fantasy_32x', name: 'Orthogonal Fantasy 32x RPG', source: 'opengameart', sourceId: 'oga/orthogonal-fantasy-32x', url: 'https://opengameart.org/content/orthogonal-fantasy-32x-rpg-graphics-cc0-or-cc-by', author: 'various', license: 'CC-BY-4.0', domain: ['rpg', 'tileset'], kind: 'tileset', theme: ['fantasy', 'medieval', 'nature'], style: '16bit', tags: ['rpg', 'tileset', 'orthogonal', 'town', 'overworld'], w: 32, h: 32, perspective: 'top-down', swatch: ['#265c42', '#63c74d', '#8f563b', '#c0cbdc'], verified: true }),
  mk({ id: 'ref.oga.fantasy_hero_by', name: 'Fantasy Hero (attribution)', source: 'opengameart', sourceId: 'oga/fantasy-hero', url: 'https://opengameart.org/content/good-cc0-art', author: 'community', license: 'OGA-BY-4.0', domain: ['rpg', 'cinematic'], kind: 'character', characterType: 'hero', theme: ['fantasy'], style: '16bit', groupId: 'hero-party-4', tags: ['hero', 'adventurer', 'sword'], w: 32, h: 32, perspective: 'side', swatch: ['#3e8948', '#d9a066', '#c0cbdc', '#262b44'], animations: [{ name: 'idle', frames: 4, fps: 6, directions: 1, loop: true }, { name: 'attack', frames: 4, fps: 12, directions: 1, loop: false }], verified: true }),

  // ── LPC · T1 / CC-BY-SA · the canonical animated bases ────────────────────
  mk({ id: 'ref.lpc.base_male', name: 'LPC Male Base', source: 'lpc', sourceId: 'lpc/base-male', url: 'https://opengameart.org/content/lpc-character-bases', author: 'LPC contributors', license: 'CC-BY-SA-3.0', domain: ['rpg', 'animation'], kind: 'character', characterType: 'hero', theme: ['fantasy', 'medieval'], style: '16bit', groupId: 'lpc-base', tags: ['lpc', 'base', 'character', 'modular', 'animated'], w: 64, h: 64, perspective: 'top-down', swatch: ['#d9a066', '#8f563b', '#c0cbdc', '#262b44'], animations: LPC_ANIMS, verified: true }),
  mk({ id: 'ref.lpc.base_female', name: 'LPC Female Base', source: 'lpc', sourceId: 'lpc/base-female', url: 'https://opengameart.org/content/lpc-character-bases', author: 'LPC contributors', license: 'CC-BY-SA-3.0', domain: ['rpg', 'animation'], kind: 'character', characterType: 'hero', theme: ['fantasy', 'medieval'], style: '16bit', groupId: 'lpc-base', tags: ['lpc', 'base', 'character', 'modular', 'animated'], w: 64, h: 64, perspective: 'top-down', swatch: ['#d9a066', '#8f563b', '#e8b796', '#262b44'], animations: LPC_ANIMS, verified: true }),
  mk({ id: 'ref.lpc.skeleton', name: 'LPC Skeleton', source: 'lpc', sourceId: 'lpc/skeleton', url: 'https://opengameart.org/content/lpc-character-bases', author: 'LPC contributors', license: 'GPL-3.0', domain: ['rpg', 'animation'], kind: 'creature', characterType: 'enemy', theme: ['fantasy', 'horror', 'dungeon'], style: '16bit', groupId: 'lpc-base', tags: ['lpc', 'skeleton', 'undead', 'animated'], w: 64, h: 64, perspective: 'top-down', swatch: ['#ebede9', '#c0cbdc', '#262b44'], animations: LPC_ANIMS, verified: true }),

  // ── PixelLab · T0 / CC0 · your own generations (published to Library) ─────
  mk({ id: 'asset.char.ember_pup', name: 'Ember Pup', source: 'pixellab', sourceId: 'gen/ember-pup', url: 'https://pixellab.ai', license: 'CC0', domain: ['rpg', 'avatar', 'world'], kind: 'creature', characterType: 'companion', theme: ['fantasy', 'cute'], style: '16bit', groupId: 'kin-family-ember', tags: ['kin', 'pet', 'fire', 'companion', 'arganta'], w: 32, h: 32, perspective: 'side', swatch: ['#ff6b35', '#f7931e', '#ffcd75', '#262b44'], animations: [{ name: 'idle', frames: 4, fps: 6, directions: 1, loop: true }, { name: 'walk', frames: 6, fps: 10, directions: 4, loop: true }, { name: 'bounce', frames: 4, fps: 8, directions: 1, loop: true }], status: 'published', verified: true }),
  mk({ id: 'asset.avatar.buddy_1', name: 'Buddy Avatar', source: 'pixellab', sourceId: 'gen/buddy-1', url: 'https://pixellab.ai', license: 'CC0', domain: ['avatar', 'ui'], kind: 'portrait', theme: ['cute', 'modern'], style: 'modern-hd-pixel', tags: ['avatar', 'buddy', 'profile', 'arganta'], w: 48, h: 48, perspective: 'portrait', swatch: ['#4cc9f0', '#4361ee', '#ffd6a5'], status: 'published', verified: true }),

  // ── PixelLab mounts · T0 / owned · REAL art (128×128, in the repo) ────────
  ...(([
    ['arganterion', 'Arganterion', ['fantasy'], 'side'],
    ['crystaldrake', 'Crystal Drake', ['fantasy'], 'side'],
    ['emberfox', 'Ember Fox', ['fantasy', 'cute'], 'side'],
    ['frostelk', 'Frost Elk', ['seasonal-winter', 'nature'], 'side'],
    ['meadowpony', 'Meadow Pony', ['cute', 'nature'], 'side'],
    ['sandstrider', 'Sand Strider', ['nature'], 'side'],
    ['shadowpanther', 'Shadow Panther', ['horror'], 'side'],
    ['stormfin', 'Storm Fin', ['underwater'], 'side'],
    ['thunderram', 'Thunder Ram', ['nature'], 'side'],
    ['updrift', 'Updrift', ['fantasy', 'nature'], 'side'],
  ] as [string, string, string[], string][]).map(([slug, name, theme, persp]) => mk({
    id: `asset.mount.${slug}`, name, source: 'pixellab', sourceId: `gen/mount-${slug}`, url: 'https://pixellab.ai', license: 'CC0',
    domain: ['world', 'rpg', 'avatar'], kind: 'creature', characterType: 'mount', theme, style: 'modern-hd-pixel',
    groupId: 'arganta-mounts', tags: ['mount', 'rideable', 'arganta', slug], w: 128, h: 128, perspective: persp,
    thumbUrl: `/pixel/mounts/${slug}.png`, animations: [{ name: 'idle', frames: 1, fps: 1, directions: 1, loop: true }], status: 'published', verified: true,
  }))),

  // ── Kenney CC0 packs · T0 · REAL art (already in the repo) ─────────────────
  mk({ id: 'ref.kenney.tiny-town.tilemap', name: 'Tiny Town (tilemap)', source: 'kenney', sourceId: 'tiny-town/tilemap', pack: 'Tiny Town', url: 'https://kenney.nl/assets/tiny-town', author: 'Kenney', license: 'CC0', domain: ['rpg', 'topdown', 'tileset'], kind: 'tileset', theme: ['nature', 'cute', 'medieval'], style: '16bit', groupId: 'kenney-tiny-town', tags: ['town', 'village', 'tileset', 'overworld', 'buildings'], w: 16, h: 16, perspective: 'top-down', thumbUrl: '/pixel/kenney/tinytown.png', swatch: ['#63c74d', '#8f563b', '#d9a066', '#4cc9f0'], verified: true }),
  mk({ id: 'ref.kenney.roguelike.sheet', name: 'Roguelike (spritesheet)', source: 'kenney', sourceId: 'roguelike/sheet', pack: 'Roguelike', url: 'https://kenney.nl/assets/roguelike-rpg-pack', author: 'Kenney', license: 'CC0', domain: ['rpg', 'roguelike', 'tileset'], kind: 'tileset', theme: ['fantasy', 'dungeon', 'medieval'], style: '16bit', groupId: 'kenney-roguelike', tags: ['roguelike', 'rpg', 'spritesheet', 'characters', 'items'], w: 16, h: 16, perspective: 'top-down', thumbUrl: '/pixel/kenney/roguelike.png', swatch: ['#5a6988', '#d9a066', '#63c74d', '#262b44'], verified: true }),

  // ── T2 / Proprietary · catalogued ONLY so the vault recognises + warns ─────
  mk({ id: 'ref.spriters.mario_smb1', name: 'Mario (SMB1)', source: 'spriters-resource', sourceId: 'spriters/mario-smb1', url: 'https://www.spriters-resource.com', author: 'Nintendo', license: 'Proprietary', domain: ['platformer'], kind: 'character', characterType: 'hero', theme: ['modern'], style: 'retro-8bit', tags: ['mario', 'nintendo', 'ripped', 'do-not-use'], w: 16, h: 16, perspective: 'side', swatch: ['#e43b44', '#4361ee', '#ffd6a5'], verified: true }),
  mk({ id: 'ref.spriters.pokemon_gen1', name: 'Gen-1 Pokémon Sprite', source: 'spriters-resource', sourceId: 'spriters/pokemon-gen1', url: 'https://www.spriters-resource.com', author: 'Nintendo / Game Freak', license: 'Proprietary', domain: ['rpg'], kind: 'creature', characterType: 'monster', theme: ['fantasy'], style: 'gameboy', tags: ['pokemon', 'nintendo', 'ripped', 'do-not-use'], w: 56, h: 56, perspective: 'front-facing', swatch: ['#8bac0f', '#306230', '#0f380f'], verified: true }),
]

export const catalogueById = (id: string): VaultItem | undefined => CATALOGUE.find(i => i.id === id)
