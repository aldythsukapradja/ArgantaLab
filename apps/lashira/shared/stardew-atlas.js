export const STARDW_ASSET_BASE = '/assets/stardew/';

export const STARDW_SHEETS = {
  outdoorsFall: { id: 'outdoors_fall', file: 'outdoors_fall.png', title: 'Outdoors (Fall)', dimensions: '656x1664' },
  farmBuildings: { id: 'farm_buildings', file: 'farm_buildings.png', title: 'Farm Buildings', dimensions: '919x412' },
  crops: { id: 'crops', file: 'crops.png', title: 'Crops', dimensions: '256x832' },
  grass: { id: 'grass', file: 'grass.png', title: 'Grass', dimensions: '66x240' },
  mines: { id: 'mines', file: 'mines.png', title: 'Mines', dimensions: '384x482' },
};

export const STARDW_LOCAL_SHEETS = Object.entries(STARDW_SHEETS).map(([key, sheet]) => ({ key, ...sheet }));

export function sheetUrl(sheetKey) {
  const sheet = STARDW_SHEETS[sheetKey];
  return sheet ? STARDW_ASSET_BASE + sheet.file : '';
}

export function sheetForMaterialId(id) {
  return STARDW_LOCAL_SHEETS.find((sheet) => sheet.id === id) || null;
}

export async function loadStardewSheets(keys = Object.keys(STARDW_SHEETS)) {
  const loaded = {};
  await Promise.all(keys.map((key) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { loaded[key] = img; resolve(); };
    img.onerror = () => reject(new Error(`Could not load Stardew sheet: ${sheetUrl(key)}`));
    img.src = sheetUrl(key);
  })));
  return loaded;
}

export const STARDW_FRAMES = {
  terrain: {
    grass: { sheet: 'outdoorsFall', x: 52, y: 100, w: 8, h: 8, tile: 8 },
    meadow: { sheet: 'outdoorsFall', x: 16, y: 100, w: 8, h: 8, tile: 8 },
    dirt: { sheet: 'outdoorsFall', x: 52, y: 116, w: 8, h: 8, tile: 8 },
    path: { sheet: 'outdoorsFall', x: 52, y: 116, w: 8, h: 8, tile: 8 },
    cobble: { sheet: 'outdoorsFall', x: 36, y: 292, w: 8, h: 8, tile: 8 },
    water: { sheet: 'outdoorsFall', x: 72, y: 840, w: 8, h: 8, tile: 8 },
    shore: { sheet: 'outdoorsFall', x: 52, y: 100, w: 8, h: 8, tile: 8 },
    mineFloor: { sheet: 'outdoorsFall', x: 36, y: 292, w: 8, h: 8, tile: 8 },
    rock: { sheet: 'outdoorsFall', x: 36, y: 292, w: 8, h: 8, tile: 8 },
    tilled: { sheet: 'outdoorsFall', x: 116, y: 292, w: 8, h: 8, tile: 8 },
  },
  props: {
    treeOrange: { sheet: 'outdoorsFall', x: 0, y: 0, w: 48, h: 90 },
    treeRed: { sheet: 'outdoorsFall', x: 150, y: 0, w: 92, h: 104 },
    pine: { sheet: 'outdoorsFall', x: 108, y: 0, w: 44, h: 86 },
    stump: { sheet: 'outdoorsFall', x: 356, y: 432, w: 78, h: 110 },
    fence: { sheet: 'outdoorsFall', x: 55, y: 200, w: 112, h: 36 },
    sign: { sheet: 'outdoorsFall', x: 56, y: 166, w: 56, h: 38 },
    mailbox: { sheet: 'outdoorsFall', x: 262, y: 70, w: 34, h: 32 },
    bus: { sheet: 'outdoorsFall', x: 0, y: 626, w: 110, h: 78 },
    obeliskPurple: { sheet: 'farmBuildings', x: 586, y: 0, w: 82, h: 128 },
    obeliskBlue: { sheet: 'farmBuildings', x: 685, y: 0, w: 82, h: 128 },
  },
  buildings: {
    barn: { sheet: 'farmBuildings', x: 110, y: 0, w: 124, h: 112 },
    coop: { sheet: 'farmBuildings', x: 0, y: 112, w: 96, h: 118 },
    shed: { sheet: 'farmBuildings', x: 104, y: 118, w: 110, h: 112 },
    farmhouse: { sheet: 'farmBuildings', x: 0, y: 238, w: 136, h: 124 },
    farmhouseWide: { sheet: 'farmBuildings', x: 140, y: 230, w: 152, h: 138 },
    greenhouse: { sheet: 'farmBuildings', x: 466, y: 200, w: 116, h: 190 },
    well: { sheet: 'farmBuildings', x: 528, y: 0, w: 62, h: 84 },
    silo: { sheet: 'farmBuildings', x: 356, y: 0, w: 66, h: 116 },
    shippingBin: { sheet: 'farmBuildings', x: 646, y: 272, w: 34, h: 42 },
    tower: { sheet: 'outdoorsFall', x: 0, y: 410, w: 112, h: 190 },
    blueHouse: { sheet: 'outdoorsFall', x: 130, y: 412, w: 152, h: 172 },
    cabin: { sheet: 'outdoorsFall', x: 122, y: 610, w: 138, h: 128 },
    mineEntrance: { sheet: 'outdoorsFall', x: 0, y: 292, w: 82, h: 114 },
  },
};

const CROP_STAGE_X = [0, 32, 64, 96];
const CROP_STAGE_H = [16, 18, 24, 28];
const CROP_ROWS = {
  turnip: 0,
  potato: 32,
  carrot: 64,
  strawberry: 96,
  corn: 224,
  pumpkin: 330,
};

export function stardewCropFrame(cropId, stage) {
  const clamped = Math.max(0, Math.min(3, stage | 0));
  return {
    sheet: 'crops',
    x: CROP_STAGE_X[clamped],
    y: CROP_ROWS[cropId] ?? 0,
    w: clamped === 3 ? 32 : 24,
    h: CROP_STAGE_H[clamped],
  };
}

export function imageForFrame(sheets, frame) {
  return sheets?.[frame?.sheet] || null;
}

export function drawStardewFrame(ctx, sheets, frame, dx, dy, dw = frame?.w, dh = frame?.h) {
  const img = imageForFrame(sheets, frame);
  if (!img || !frame) return false;
  ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  return true;
}

export function drawStardewTile(ctx, sheets, frame, dx, dy, size, vx = 0, vy = 0) {
  const img = imageForFrame(sheets, frame);
  if (!img || !frame) return false;
  const unit = frame.tile || 16;
  const cols = Math.max(1, Math.floor(frame.w / unit));
  const rows = Math.max(1, Math.floor(frame.h / unit));
  const count = cols * rows;
  const index = Math.abs((vx * 29 + vy * 47 + vx * vy * 7) % count);
  const sx = frame.x + (index % cols) * unit;
  const sy = frame.y + Math.floor(index / cols) * unit;
  ctx.drawImage(img, sx, sy, unit, unit, Math.round(dx), Math.round(dy), Math.round(size) + 1, Math.round(size) + 1);
  return true;
}
