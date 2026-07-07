// Crop catalog. `days` = waterings-then-sleeps to ripen. `color` drives the
// placeholder sprite's fruit. Data-driven so new crops = new rows (RPG-maker
// spine principle). `ring` marks a learning-gated seed (shown locked for kids).
// `growMs` = REAL-TIME to ripen (from planting, while kept watered). Testing =
// engagement-first: minutes, cheapest ~1 min, most expensive capped at 5 min.
// Growth is decoupled from the day cycle (day = stamina only now).
export const CROPS = {
  turnip: { id: 'turnip', name: 'Turnip', emoji: '🥬', season: 'spring', days: 3, growMs: 60000, seedCost: 20, sell: 40, color: 0xe0a3e8, ring: null },
  potato: { id: 'potato', name: 'Potato', emoji: '🥔', season: 'spring', days: 4, growMs: 120000, seedCost: 35, sell: 70, color: 0xd9b382, ring: null },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', season: 'spring', days: 4, growMs: 120000, seedCost: 30, sell: 65, color: 0xf08a3c, ring: null },
  strawberry: { id: 'strawberry', name: 'Strawberry', emoji: '🍓', season: 'spring', days: 5, growMs: 180000, seedCost: 60, sell: 130, color: 0xe4425a, ring: 'numeria' },
  corn: { id: 'corn', name: 'Corn', emoji: '🌽', season: 'summer', days: 6, growMs: 240000, seedCost: 70, sell: 160, color: 0xf2c94c, ring: 'wordveil' },
  pumpkin: { id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', season: 'fall', days: 6, growMs: 300000, seedCost: 80, sell: 200, color: 0xe07b2c, ring: 'life' },
};

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const DAYS_PER_SEASON = 14;

// One watering keeps a crop growing for this long, then it goes dry and PAUSES
// until re-watered — so watering is a real, repeated action without being harsh.
export const HYDRATION_MS = 120000; // 2 min

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
// Growth fraction 0..1 — pure function of timestamps so every client computes the
// SAME value (sync-free). FarmVille model: once planted, a crop grows continuously
// in real time until ripe — no watering gate (soil is always ready; pure tap-tap).
export function cropGrowthFrac(plot, now = Date.now()) {
  if (!plot?.cropId) return 0;
  const crop = CROPS[plot.cropId]; if (!crop) return 0;
  if (plot.plantedAt == null && plot.growth != null) return clamp01(plot.growth / crop.days); // legacy save
  return clamp01((now - plot.plantedAt) / crop.growMs);
}
// Kept only for legacy saves that still carry wateredAt; the live loop never
// waters now, so an un-watered planted crop reads as fully hydrated.
export function cropHydration(plot, now = Date.now()) {
  if (!plot?.cropId) return 0;
  if (plot.wateredAt == null) return 1;
  return clamp01(1 - (now - plot.wateredAt) / HYDRATION_MS);
}
export function cropIsRipe(plot, now = Date.now()) { return cropGrowthFrac(plot, now) >= 1; }
export function cropStageOf(frac) { return frac <= 0 ? 0 : frac >= 1 ? 3 : frac < 0.4 ? 1 : 2; }

// Withering (FarmVille loss-aversion): a ripe crop stays fresh for a grace window,
// then wilts and is lost. Grace = at least WITHER_GRACE_MS, and never less than the
// crop's own grow time, so slow crops give you longer to come back.
export const WITHER_GRACE_MS = 120000; // 2 min minimum fresh window after ripening
export function cropWitherAt(plot) {
  if (!plot?.cropId || plot.plantedAt == null) return Infinity;
  const crop = CROPS[plot.cropId]; if (!crop) return Infinity;
  return plot.plantedAt + crop.growMs + Math.max(WITHER_GRACE_MS, crop.growMs);
}
export function cropIsWithered(plot, now = Date.now()) {
  return !!plot?.cropId && plot.plantedAt != null && now >= cropWitherAt(plot);
}
// 1 = just ripened, 0 = about to wilt — drives the "harvest me before it's gone" bar.
export function cropFreshFrac(plot, now = Date.now()) {
  if (!cropIsRipe(plot, now)) return 1;
  const crop = CROPS[plot.cropId]; if (!crop) return 1;
  const ripeAt = plot.plantedAt + crop.growMs;
  const witherAt = cropWitherAt(plot);
  return clamp01(1 - (now - ripeAt) / (witherAt - ripeAt));
}

// Starter seeds available in the shop from day one (no learning gate).
export const STARTER_SEEDS = ['turnip', 'potato', 'carrot'];
