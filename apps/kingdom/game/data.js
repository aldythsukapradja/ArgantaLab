// Kingdom data loader — fetches the normalized core JSON layer plus optional
// overrides, and builds the indexes the game engine needs.
window.KingdomData = (function () {
  const CORE = '../data/core/';
  const OVERRIDES = '../data/overrides/';

  async function fetchJson(url, optional = false) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (optional) return null;
      throw err;
    }
  }

  const db = {
    maps: {},
    hotspots: {},
    monsters: {},
    appearances: {},
    appearancesByMap: {},
    hotspotsByMap: {},
    overrides: { spawns: {} },
    summary: null
  };

  async function load() {
    const [maps, hotspots, monsters, appearances, summary, spawnOverrides] = await Promise.all([
      fetchJson(CORE + 'maps.json'),
      fetchJson(CORE + 'hotspots.json'),
      fetchJson(CORE + 'monsters.json'),
      fetchJson(CORE + 'appearances.json'),
      fetchJson(CORE + 'summary.json'),
      fetchJson(OVERRIDES + 'spawns.json', true)
    ]);

    for (const m of maps) db.maps[m.id] = m;
    for (const h of hotspots) {
      db.hotspots[h.id] = h;
      (db.hotspotsByMap[h.mapId] ||= []).push(h);
    }
    for (const m of monsters) db.monsters[m.id] = m;
    for (const a of appearances) {
      db.appearances[a.id] = a;
      (db.appearancesByMap[a.mapId] ||= []).push(a);
    }
    db.summary = summary;
    if (spawnOverrides) db.overrides.spawns = spawnOverrides;

    // Local-tuning layer: command center writes spawn edits to localStorage under
    // this key; the game picks them up over the file-based overrides.
    try {
      const local = JSON.parse(localStorage.getItem('kingdom_overrides_spawns') || 'null');
      if (local) db.overrides.spawns = { ...db.overrides.spawns, ...local };
    } catch (err) {
      console.warn('bad local spawn overrides', err);
    }
    return db;
  }

  function walkableTargets(mapId) {
    return (db.hotspotsByMap[mapId] || []).filter(
      (h) =>
        h.targetMapId &&
        db.maps[h.targetMapId] &&
        db.maps[h.targetMapId].mapImage &&
        db.maps[h.targetMapId].mapImage.localPath &&
        Array.isArray(h.coords) &&
        h.coords.length === 4
    );
  }

  // Where to place the player after arriving on `mapId` from `fromMapId`:
  // centre of the hotspot that points back, else map centre.
  function arrivalPoint(mapId, fromMapId) {
    const map = db.maps[mapId];
    const back = (db.hotspotsByMap[mapId] || []).find(
      (h) => h.targetMapId === fromMapId && Array.isArray(h.coords) && h.coords.length === 4
    );
    if (back) {
      return {
        x: (back.coords[0] + back.coords[2]) / 2,
        y: (back.coords[1] + back.coords[3]) / 2
      };
    }
    const w = map?.mapImage?.width || 400;
    const h = map?.mapImage?.height || 400;
    return { x: w / 2, y: h / 2 };
  }

  // Spawn plan for a map: appearances × per-monster count (override-aware).
  function spawnPlan(mapId) {
    const apps = db.appearancesByMap[mapId] || [];
    const plan = [];
    for (const app of apps) {
      const monster = db.monsters[app.monsterId];
      if (!monster || !monster.images || !monster.images.length) continue;
      const ov = db.overrides.spawns[app.id];
      const count = ov && Number.isFinite(ov.count) ? ov.count : 2;
      plan.push({ appearance: app, monster, count });
    }
    return plan;
  }

  return { load, db, walkableTargets, arrivalPoint, spawnPlan };
})();
