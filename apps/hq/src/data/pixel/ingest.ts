// Ingest queue — PixelLab output waiting for a human/agent to name, tag, and
// promote-or-reject. Nothing reaches the canonical Library unreviewed (same
// discipline as the Command verdict queue). Seeded with a couple pending items.
import type { IngestItem } from './types'

export const INGEST: IngestItem[] = [
  { id: 'ingest.coin_gold_v2', suggestedName: 'Gold Coin v2', generatedVia: 'pixellab', styleRefId: 'ref.kenney.pixel-platformer.coin_gold', size: { w: 16, h: 16 }, swatch: ['#fbcb43', '#f89c1c', '#fff2d0'], suggestedTags: ['coin', 'pickup', 'currency'], status: 'pending' },
  { id: 'ingest.frost_pup', suggestedName: 'Frost Pup', generatedVia: 'pixellab', styleRefId: 'asset.char.ember_pup', size: { w: 32, h: 32 }, swatch: ['#6ee7f9', '#4cc9f0', '#ffffff', '#262b44'], suggestedTags: ['kin', 'pet', 'ice', 'companion'], status: 'pending' },
  { id: 'ingest.forest_bg', suggestedName: 'Forest Cutscene BG', generatedVia: 'pixellab', styleRefId: 'ref.oga.space_nebula_bg', size: { w: 320, h: 180 }, swatch: ['#265c42', '#3e8948', '#181425', '#ffcd75'], suggestedTags: ['forest', 'background', 'cinematic'], status: 'pending' },
]
