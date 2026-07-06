export type LashiraArtStatus = 'wired' | 'placeholder' | 'needs-polish' | 'active' | 'published' | 'deprecated'

export interface LashiraArtItem {
  slotKey: string
  label: string
  category: string
  status: LashiraArtStatus
  expectedW?: number | null
  expectedH?: number | null
  renderer: string
  sourceFile?: string | null
  notes?: string | null
  imageData?: string | null
  builtin?: boolean
  updatedAt?: string | null
}

const cropSlots = ['turnip', 'potato', 'carrot', 'strawberry', 'corn', 'pumpkin'].flatMap(crop =>
  [0, 1, 2, 3].map(stage => ({
    slotKey: `lashira.crop.${crop}.stage${stage}`,
    label: `${crop[0].toUpperCase()}${crop.slice(1)} stage ${stage}`,
    category: 'crop',
    expectedW: 48,
    expectedH: 48,
    renderer: 'procedural',
    status: (stage === 3 ? 'needs-polish' : 'wired') as LashiraArtStatus,
    sourceFile: 'apps/lashira/web/src/game/farm-map.js',
    builtin: true,
  })),
)

export const REQUIRED_LASHIRA_ART: LashiraArtItem[] = [
  { slotKey: 'lashira.terrain.grass', label: 'Grass tile', category: 'terrain', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.terrain.path', label: 'Farm path tile', category: 'terrain', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.plot.soil.dry', label: 'Dry tilled soil', category: 'field', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.plot.soil.watered', label: 'Watered tilled soil', category: 'field', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.prop.tree', label: 'Border tree', category: 'prop', expectedW: 48, expectedH: 72, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.prop.fence', label: 'Field fence', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.prop.well', label: 'Stone well', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.prop.shipping_bin', label: 'Shipping bin', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.building.house', label: 'Farmhouse', category: 'building', expectedW: 144, expectedH: 144, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.building.barn', label: 'Barn', category: 'building', expectedW: 144, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.building.coop', label: 'Coop', category: 'building', expectedW: 96, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.building.shop', label: 'Sprout shop', category: 'building', expectedW: 96, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.animal.cow', label: 'Cow', category: 'animal', expectedW: 48, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.animal.sheep', label: 'Sheep', category: 'animal', expectedW: 44, expectedH: 38, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.animal.chicken', label: 'Chicken', category: 'animal', expectedW: 28, expectedH: 30, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.kin.sprig', label: 'Sprig Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.kin.pip', label: 'Pip Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.kin.bramble', label: 'Bramble Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.mount.placeholder', label: 'Fallback mount', category: 'mount', expectedW: 64, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  { slotKey: 'lashira.farmer.placeholder', label: 'Fallback farmer', category: 'character', expectedW: 32, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js', builtin: true },
  ...cropSlots,
]

export const blankLashiraArtItem = (): LashiraArtItem => ({
  slotKey: 'lashira.custom.',
  label: 'New Lashira art',
  category: 'custom',
  status: 'placeholder',
  expectedW: 48,
  expectedH: 48,
  renderer: 'asset',
  sourceFile: 'apps/lashira/web/src/game/farm-map.js',
  notes: '',
  imageData: null,
  builtin: false,
})

