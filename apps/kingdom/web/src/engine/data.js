// Data access for the client library (served at /data/client by the vite
// dev middleware). Framework-free; every loader is cached.

const jsonCache = new Map();
const imgCache = new Map();

export function loadJson(url) {
  if (!jsonCache.has(url)) {
    jsonCache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
        return r.json();
      })
    );
  }
  return jsonCache.get(url);
}

export function loadImage(url) {
  if (!imgCache.has(url)) {
    imgCache.set(
      url,
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error(`image ${url}`));
        im.src = url;
      })
    );
  }
  return imgCache.get(url);
}

// Optional absolute base (e.g. a Supabase Storage public bucket) for
// deployments where /data isn't served next to the app. Empty = same origin.
export const DATA_ROOT = import.meta.env.VITE_DATA_BASE || '';
export const dataUrl = (rel) => DATA_ROOT + rel;   // rel starts with /data/
const C = dataUrl('/data/client');

export const manifest = () => loadJson(`${C}/extractor-manifest.json`);
export const charParts = (cat) => loadJson(`${C}/char/${cat}/parts.json`);
export const charPalettes = (cat) => loadJson(`${C}/char/${cat}/palettes.json`);
export const mounts = () => loadJson(`${C}/mounts/parts.json`);
export const mountPalettes = () => loadJson(`${C}/mounts/palettes.json`);
export const monsters = () => loadJson(`${C}/monsters/parts.json`);
export const monsterPalettes = () => loadJson(`${C}/monsters/palettes.json`);
export const effects = () => loadJson(`${C}/effects/effects.json`);

export const sheetUrl = (cat, part) => `${C}/char/${cat}/${part.sheet}`;
export const idxSheetUrl = (cat, part) => `${C}/char/${cat}/${part.idx_sheet}`;
export const mountSheetUrl = (m) => `${C}/mounts/${m.sheet}`;
export const mountIdxUrl = (m) => `${C}/mounts/${m.idx_sheet}`;
export const monsterSheetUrl = (m) => `${C}/monsters/${m.sheet}`;
export const monsterIdxUrl = (m) => `${C}/monsters/${m.idx_sheet}`;
export const effectSheetUrl = (e) => `${C}/effects/${e.sheet}`;

// Motions indexed by name, layers by id — the two tables every render uses.
let motionIndexP = null;
export function motionTables() {
  if (!motionIndexP) {
    motionIndexP = manifest().then((m) => {
      const motionsByName = {};
      const motionsById = {};
      for (const mo of m.motions) {
        motionsByName[mo.name] = mo;
        motionsById[mo.id] = mo;
      }
      const layersById = {};
      for (const l of m.layers) layersById[l.layer_id] = l;
      return { motionsByName, motionsById, layersById, haircol: m.haircol };
    });
  }
  return motionIndexP;
}
