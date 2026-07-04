// Kingdom Command store — loads the core JSON layer once and exposes indexes.
window.Store = (function () {
  const CORE = '../data/core/';
  const FILES = [
    'maps', 'regions', 'cave-systems', 'hotspots', 'edges', 'monsters', 'appearances',
    'items', 'drops', 'shop-inventory', 'skills', 'skill-requirements', 'data-gaps',
    'assets', 'world-spine', 'summary'
  ];

  // Human labels + icons for the mapType taxonomy baked into the scrape
  // (see map-hierarchy.json's classificationLegend). "Others" per general_area_or_poi.
  const THEME_META = {
    main_17_map: { label: 'Main Regions', icon: '🏰' },
    cave_hub: { label: 'Cave Systems', icon: '🕳' },
    cave_room: { label: 'Cave Rooms', icon: '🕳' },
    shop_or_service: { label: 'Shops & Services', icon: '🛒' },
    guild_or_path_hall: { label: 'Guild / Path Halls', icon: '⚔' },
    clan_or_subpath_area: { label: 'Clan / Subpath Areas', icon: '🛡' },
    route_connector: { label: 'Route Connectors', icon: '🧭' },
    resource_or_hunting_area: { label: 'Resource / Hunting', icon: '🌾' },
    event_or_combat_instance: { label: 'Event / Combat', icon: '🏟' },
    quest_area: { label: 'Quest Areas', icon: '❗' },
    general_area_or_poi: { label: 'Others', icon: '📍' },
    legacy_root_alias: { label: 'Legacy Pages', icon: '🗂' },
    world_landing: { label: 'World', icon: '🌍' }
  };

  const S = {
    raw: {},          // filename -> parsed rows
    maps: {}, monsters: {}, items: {}, skills: {}, appearances: {},
    hotspotsByMap: {}, appearancesByMap: {}, appearancesByMonster: {},
    dropsByMonster: {}, dropsByItem: {}, shopsByItem: {}, shopsByMap: {},
    reqsBySkill: {}, reqsByItem: {}, skillsByPath: {},
    regionOfMap: {}, caveSystemByHub: {}, roomToHub: {},
    theme: THEME_META,
    overrides: { spawns: {} },
    loaded: false
  };

  const OVERRIDE_KEY = 'kingdom_overrides_spawns';

  async function load() {
    const results = await Promise.all(
      FILES.map((f) =>
        fetch(CORE + f + '.json').then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${f}.json (${r.status})`);
          return r.json();
        })
      )
    );
    FILES.forEach((f, i) => (S.raw[f] = results[i]));

    for (const m of S.raw.maps) S.maps[m.id] = m;
    for (const m of S.raw.monsters) S.monsters[m.id] = m;
    for (const it of S.raw.items) S.items[it.id] = it;
    for (const sk of S.raw.skills) {
      S.skills[sk.id] = sk;
      (S.skillsByPath[sk.path] ||= []).push(sk);
    }
    for (const h of S.raw.hotspots) (S.hotspotsByMap[h.mapId] ||= []).push(h);
    for (const a of S.raw.appearances) {
      S.appearances[a.id] = a;
      (S.appearancesByMap[a.mapId] ||= []).push(a);
      (S.appearancesByMonster[a.monsterId] ||= []).push(a);
    }
    for (const d of S.raw.drops) {
      (S.dropsByMonster[d.monsterId] ||= []).push(d);
      (S.dropsByItem[d.itemId] ||= []).push(d);
    }
    for (const s of S.raw['shop-inventory']) {
      (S.shopsByItem[s.itemId] ||= []).push(s);
      (S.shopsByMap[s.shopMapId] ||= []).push(s);
    }
    for (const r of S.raw['skill-requirements']) {
      (S.reqsBySkill[r.skillId] ||= []).push(r);
      if (r.itemId) (S.reqsByItem[r.itemId] ||= []).push(r);
    }
    for (const list of Object.values(S.skillsByPath)) {
      list.sort((a, b) => (a.levelNumber || 0) - (b.levelNumber || 0) || a.name.localeCompare(b.name));
    }

    for (const region of S.raw.regions) {
      for (const mapId of region.mapIds) S.regionOfMap[mapId] = region;
    }
    for (const sys of S.raw['cave-systems']) {
      S.caveSystemByHub[sys.hubMapId] = sys;
      for (const roomId of sys.roomMapIds) if (!S.roomToHub[roomId]) S.roomToHub[roomId] = sys.hubMapId;
    }

    try {
      S.overrides.spawns = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}');
    } catch { S.overrides.spawns = {}; }

    S.loaded = true;
    return S;
  }

  function setSpawnOverride(appearanceId, count) {
    if (count === null || count === '' || Number(count) === 2) {
      delete S.overrides.spawns[appearanceId];
    } else {
      S.overrides.spawns[appearanceId] = { count: Math.max(0, Math.min(30, Number(count) || 0)) };
    }
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(S.overrides.spawns));
  }
  function spawnCount(appearanceId) {
    const ov = S.overrides.spawns[appearanceId];
    return ov && Number.isFinite(ov.count) ? ov.count : 2;
  }
  function isOverridden(appearanceId) {
    return !!S.overrides.spawns[appearanceId];
  }
  function exportOverrides() {
    const blob = new Blob([JSON.stringify(S.overrides.spawns, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spawns.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Global search across the four main registries.
  function search(q, limit = 14) {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out = [];
    const push = (kind, id, name, sub, img) => out.push({ kind, id, name, sub, img });
    for (const m of S.raw.monsters) {
      if (m.name.toLowerCase().includes(needle))
        push('monster', m.id, m.name, `${Number(m.defaultExperience || 0).toLocaleString()} exp`, m.images?.[0]);
      if (out.length > 60) break;
    }
    for (const it of S.raw.items) {
      if (it.name.toLowerCase().includes(needle))
        push('item', it.id, it.name, `${(S.dropsByItem[it.id] || []).length} drop rows`, it.images?.[0]);
      if (out.length > 90) break;
    }
    for (const m of S.raw.maps) {
      if ((m.name || '').toLowerCase().includes(needle))
        push('map', m.id, m.name, `${m.version || ''} · ${m.mapType || m.kind || ''}`, null);
      if (out.length > 120) break;
    }
    for (const sk of S.raw.skills) {
      if (sk.name.toLowerCase().includes(needle))
        push('skill', sk.id, sk.name, `${sk.path} · lv ${sk.levelOrRank}`, sk.spellImageUrl);
      if (out.length > 140) break;
    }
    const rank = (r) => (r.name.toLowerCase().startsWith(needle) ? 0 : 1);
    out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
  }

  return { S, load, search, setSpawnOverride, spawnCount, isOverridden, exportOverrides };
})();
