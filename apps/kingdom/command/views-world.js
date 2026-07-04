// View: World Explorer — map browser with hotspot overlays, monster + drop inspector.
window.Views = window.Views || {};

(function () {
  const { esc, fmt, asset, spriteImg } = UI;
  const S = () => Store.S;
  const DEFAULT_MAP = 'map.00.world';

  // Icons for world-map pins, keyed by the hotspot's `type` field (region/city/kingdom/…).
  const PIN_ICONS = {
    region: '⛰', city: '🏙', kingdom: '🏰', island: '🏝', shore: '🌊',
    crossroads: '🧭', encampment: '⛺', training_city: '🎓', legacy_region: '🗂'
  };

  // Persist browse state across the router's full re-render on every map selection,
  // so the tree does NOT collapse / jump to top when you pick a map.
  const worldUi = { mode: 'region', openKeys: new Set(), scroll: 0 };

  Views.world = function (root, params) {
    const s = S();
    const mapId = params[0] && s.maps[params[0]] ? params[0] : DEFAULT_MAP;
    const map = s.maps[mapId];

    // Auto-expand the branch that contains the selected map (union into openKeys).
    ancestorKeys(mapId).forEach((k) => worldUi.openKeys.add(k));

    root.innerHTML = `
      <div class="world" id="worldRoot">
        <div class="panel left-drawer" id="leftDrawer">
          <div class="panel-heading-row">
            <h2>Maps <small id="mapCount"></small></h2>
          </div>
          <div class="toolbar" style="margin:0 0 8px">
            <input id="mapSearch" placeholder="Search 866 maps…" style="width:100%">
          </div>
          <div class="mode-tabs" id="modeTabs">
            <button class="mode-tab ${worldUi.mode === 'region' ? 'active' : ''}" data-mode="region">By Region</button>
            <button class="mode-tab ${worldUi.mode === 'theme' ? 'active' : ''}" data-mode="theme">By Theme</button>
          </div>
          <div class="map-list" id="mapList"></div>
        </div>
        <div class="panel">
          <h2 id="stageTitle"></h2>
          <div class="toolbar" style="margin:0 0 8px">
            <button class="btn small" id="zoomOut">−</button>
            <button class="btn small" id="zoomIn">+</button>
            <button class="btn small" id="zoomFit">⤢ Fit</button>
            <span class="count" id="zoomLabel"></span>
            <div class="spacer"></div>
            <a class="btn small" id="playHere" href="#">▶ Walk here in client</a>
          </div>
          <div class="map-stage-wrap" id="stageWrap"><div class="map-stage" id="stage"></div></div>
        </div>
        <div class="panel inspector" id="inspector"></div>
      </div>`;

    const listEl = root.querySelector('#mapList');
    const searchEl = root.querySelector('#mapSearch');

    // ---- helpers ----
    function openAttr(key) {
      return worldUi.openKeys.has(key) ? 'open' : '';
    }

    function mapRow(m) {
      if (!m) return '';
      const region = s.regionOfMap[m.id];
      return `
        <button class="map-row ${m.id === mapId ? 'active' : ''}" data-id="${esc(m.id)}">
          <b>${esc(m.name || m.id)}</b>
          <small>${esc(m.version || '')}${region && worldUi.mode === 'theme' ? ' · ' + esc(region.label) : ''} · ${(s.appearancesByMap[m.id] || []).length} monsters</small>
        </button>`;
    }

    function group(key, icon, title, bodyHtml, count, cls = '') {
      if (!bodyHtml) return '';
      return `
        <details class="tree-group ${cls}" data-key="${esc(key)}" ${openAttr(key)}>
          <summary>${icon} ${esc(title)} <span class="tcount">${fmt(count)}</span></summary>
          <div class="tree-body">${bodyHtml}</div>
        </details>`;
    }

    function caveSystemNode(hubId) {
      const hub = s.maps[hubId];
      if (!hub) return '';
      const sys = s.caveSystemByHub[hubId];
      const rooms = (sys?.roomMapIds || [])
        .map((id) => s.maps[id])
        .filter((m) => m && m.id !== hubId && m.mapImage?.localPath);
      return group('cave:' + hubId, '🕳', hub.name || hub.id,
        mapRow(hub) + rooms.map(mapRow).join(''), rooms.length, 'cave-group');
    }

    function drawRegionMode() {
      const regions = s.raw.regions.slice().sort((a, b) => a.label.localeCompare(b.label));
      root.querySelector('#mapCount').textContent = fmt(s.raw.maps.length);
      listEl.innerHTML = `
        <div class="tree-body" style="padding:0 0 6px;border:0;margin:0">${mapRow(s.maps[DEFAULT_MAP])}</div>
        ${regions
          .map((region) => {
            const rootMap = s.maps[region.rootMapId];
            const memberIds = new Set(region.mapIds.filter((id) => id !== region.rootMapId));
            const memberMaps = [...memberIds].map((id) => s.maps[id]).filter((m) => m && m.mapImage?.localPath);
            const byType = {};
            for (const m of memberMaps) (byType[m.mapType || 'general_area_or_poi'] ||= []).push(m);
            const cavesInRegion = s.raw['cave-systems'].filter((sys) => memberIds.has(sys.hubMapId));
            const caveRoomIds = new Set(cavesInRegion.flatMap((sys) => sys.roomMapIds));
            const total = memberMaps.length + 1;

            const cavesHtml = cavesInRegion.length
              ? group('region-caves:' + region.id, '🕳', 'Cave Systems',
                  cavesInRegion.map((sys) => caveSystemNode(sys.hubMapId)).join(''), cavesInRegion.length)
              : '';
            const typeHtml = Object.entries(byType)
              .filter(([type]) => type !== 'main_17_map' && type !== 'legacy_root_alias' && type !== 'cave_hub')
              .map(([type, list]) => {
                const filtered = type === 'cave_room' ? list.filter((m) => !caveRoomIds.has(m.id)) : list;
                if (!filtered.length) return '';
                const meta = s.theme[type] || { label: type, icon: '📍' };
                return group('region-theme:' + region.id + ':' + type, meta.icon, meta.label,
                  filtered.map(mapRow).join(''), filtered.length);
              })
              .join('');

            return group('region:' + region.id, '🏰', region.label,
              (rootMap ? mapRow(rootMap) : '') + cavesHtml + typeHtml, total, 'region-group');
          })
          .join('')}`;
      afterDraw();
    }

    function drawThemeMode() {
      const byType = {};
      for (const m of s.raw.maps) {
        if (!m.mapImage?.localPath) continue;
        (byType[m.mapType || 'general_area_or_poi'] ||= []).push(m);
      }
      root.querySelector('#mapCount').textContent = fmt(s.raw.maps.length);
      const order = [
        'world_landing', 'main_17_map', 'cave_hub', 'shop_or_service', 'guild_or_path_hall',
        'clan_or_subpath_area', 'route_connector', 'resource_or_hunting_area',
        'event_or_combat_instance', 'quest_area', 'cave_room', 'general_area_or_poi', 'legacy_root_alias'
      ];
      listEl.innerHTML = order
        .map((type) => {
          const list = (byType[type] || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          if (!list.length) return '';
          const meta = s.theme[type] || { label: type, icon: '📍' };
          if (type === 'cave_hub') {
            return group('theme-caves', '🕳', 'Cave Systems',
              list.map((m) => caveSystemNode(m.id)).join(''), list.length);
          }
          return group('theme:' + type, meta.icon, meta.label, list.map(mapRow).join(''), list.length);
        })
        .join('');
      afterDraw();
    }

    function drawSearch(q) {
      const rows = s.raw.maps
        .filter((m) => m.mapImage?.localPath)
        .filter((m) => (m.name || '').toLowerCase().includes(q))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, 300);
      root.querySelector('#mapCount').textContent = fmt(rows.length);
      listEl.innerHTML = `<div class="tree-body" style="border:0;margin:0;padding:0">${
        rows.map(mapRow).join('') || '<div class="empty">No matches.</div>'
      }</div>`;
      afterDraw();
    }

    // Wire rows + persist open-group and scroll state after every list build.
    function afterDraw() {
      listEl.querySelectorAll('.map-row').forEach((b) => {
        b.addEventListener('click', () => (location.hash = '#/world/' + b.dataset.id));
      });
      listEl.querySelectorAll('details[data-key]').forEach((d) => {
        d.addEventListener('toggle', () => {
          if (d.open) worldUi.openKeys.add(d.dataset.key);
          else worldUi.openKeys.delete(d.dataset.key);
        });
      });
      listEl.scrollTop = worldUi.scroll;
    }
    listEl.addEventListener('scroll', () => { worldUi.scroll = listEl.scrollTop; });

    function draw() {
      const q = searchEl.value.trim().toLowerCase();
      if (q) return drawSearch(q);
      if (worldUi.mode === 'region') return drawRegionMode();
      drawThemeMode();
    }
    searchEl.addEventListener('input', () => { worldUi.scroll = 0; draw(); });
    root.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        worldUi.mode = tab.dataset.mode;
        worldUi.scroll = 0;
        root.querySelectorAll('.mode-tab').forEach((t) => t.classList.toggle('active', t === tab));
        draw();
      });
    });
    draw();

    // ---- center: stage ----
    if (!map) return;
    const stage = root.querySelector('#stage');
    const img = map.mapImage;
    root.querySelector('#stageTitle').innerHTML = `${esc(map.name || map.id)} <small>${esc(map.version || '')} · ${
      img ? `${img.width}×${img.height}px` : 'no image'
    }</small>`;
    root.querySelector('#playHere').href = `../game/index.html?map=${encodeURIComponent(map.id)}`;

    const hotspots = (s.hotspotsByMap[map.id] || []).filter(
      (h) => Array.isArray(h.coords) && h.coords.length === 4
    );

    if (img?.localPath) {
      stage.innerHTML = `<img class="mapbg" src="${esc(asset(img.localPath))}" width="${img.width}" height="${img.height}">`;
      const isWorldMap = map.id === DEFAULT_MAP;
      for (const h of hotspots) {
        const [x1, y1, x2, y2] = h.coords;
        const target = h.targetMapId && s.maps[h.targetMapId]?.mapImage?.localPath ? h.targetMapId : null;
        const zone = isWorldMap
          ? UI.el(`
            <button class="hotzone pin ${target ? '' : 'dead'}"
              style="left:${(x1 + x2) / 2}px;top:${(y1 + y2) / 2}px">
              <span class="pin-dot">${PIN_ICONS[h.type] || '📍'}</span>
              <span class="tip">${esc(h.label || h.title || '')}${target ? ' →' : ''}</span>
            </button>`)
          : UI.el(`
            <button class="hotzone ${target ? '' : 'dead'}"
              style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${y2 - y1}px">
              <span class="tip">${esc(h.label || h.title || '')}${target ? ' →' : ''}</span>
            </button>`);
        if (target) zone.addEventListener('click', () => (location.hash = '#/world/' + target));
        stage.appendChild(zone);
      }
      setupMapViewer(root, stage, img);
    } else {
      stage.innerHTML = `<div class="empty">No mirrored image for this map.</div>`;
    }

    // ---- right: inspector ----
    const apps = (s.appearancesByMap[map.id] || []).slice().sort((a, b) => (a.experience || 0) - (b.experience || 0));
    const exits = hotspots.filter((h) => h.targetMapId && s.maps[h.targetMapId]);
    const shopRows = s.shopsByMap[map.id] || [];
    const region = s.regionOfMap[map.id];

    root.querySelector('#inspector').innerHTML = `
      <section>
        <h3>${esc(map.name || map.id)}</h3>
        <dl class="kv">
          <dt>Version</dt><dd>${esc(map.version || '—')}</dd>
          <dt>Type</dt><dd>${esc((s.theme[map.mapType] || {}).label || map.mapType || map.kind || '—')}</dd>
          ${region ? `<dt>Region</dt><dd><a href="#/world/${esc(region.rootMapId || '')}">${esc(region.label)}</a></dd>` : ''}
          ${map.stats?.shops ? `<dt>Shops</dt><dd>${esc(map.stats.shops)}</dd>` : ''}
          ${map.stats?.rooms ? `<dt>Rooms</dt><dd>${esc(map.stats.rooms)}</dd>` : ''}
          <dt>Source</dt><dd><a href="${esc(map.source?.pageUrl || '#')}" target="_blank" rel="noopener">nexusatlas page ↗</a></dd>
        </dl>
        ${map.content?.description ? `<p style="color:var(--muted);font-size:12px;line-height:1.5;margin:8px 0 0">${esc(map.content.description)}</p>` : ''}
      </section>
      <section>
        <h3>Monsters &amp; drops <small>${apps.length} on this map</small></h3>
        ${apps.length ? apps.map((a) => monRow(s, a)).join('') : '<div class="empty">No monsters recorded on this map.</div>'}
      </section>
      <section>
        <h3>Exits <small>${exits.length}</small></h3>
        ${exits.length ? exits
          .map(
            (h) => `
          <div class="exit-row">
            <span>${esc(h.label || h.title || h.id)}</span>
            <a class="to" href="#/world/${esc(h.targetMapId)}">${esc(s.maps[h.targetMapId]?.name || h.targetMapId)} →</a>
          </div>`
          )
          .join('') : '<div class="empty">No resolved exits.</div>'}
      </section>
      ${shopRows.length ? `
      <section>
        <h3>Shop inventory <small>${shopRows.length} rows</small></h3>
        <table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Price</th></tr></thead>
        <tbody>${shopRows
          .map(
            (r) => `
          <tr class="row-link" onclick="location.hash='#/items/${esc(r.itemId)}'">
            <td><img src="${esc(asset(r.itemImageUrl))}" loading="lazy"></td>
            <td>${esc(r.itemNameRaw)}</td>
            <td class="num">${fmt(r.price)}</td>
          </tr>`
          )
          .join('')}</tbody></table>
      </section>` : ''}`;

    root.querySelectorAll('[data-monster]').forEach((b) => {
      b.addEventListener('click', () => (location.hash = '#/monsters/' + b.dataset.monster));
    });
    root.querySelectorAll('.drop-icons img[data-item]').forEach((im) => {
      im.addEventListener('click', () => (location.hash = '#/items/' + im.dataset.item));
    });
  };

  // A monster row in the inspector: sprite | name+exp | drop item icons (+N overflow).
  function monRow(s, a) {
    const m = s.monsters[a.monsterId];
    if (!m) return '';
    const drops = (s.dropsByMonster[a.monsterId] || []).filter((d) => d.mapId === a.mapId);
    const seen = new Set();
    const unique = [];
    for (const d of drops) {
      if (!seen.has(d.itemId)) { seen.add(d.itemId); unique.push(d); }
    }
    const MAX = 4;
    const icons = unique.slice(0, MAX).map((d) => {
      const it = s.items[d.itemId];
      const src = asset(it?.images?.[0] || d.itemImageUrl);
      return `<img src="${esc(src)}" title="${esc(it?.name || d.itemNameRaw)}" data-item="${esc(d.itemId)}" loading="lazy">`;
    }).join('');
    const more = unique.length > MAX ? `<span class="more">+${unique.length - MAX}</span>` : '';
    const dropCell = unique.length ? `<div class="drop-icons">${icons}${more}</div>` : '<span class="none">—</span>';
    return `
      <div class="mon-row">
        ${spriteImg(m.images)}
        <div>
          <b data-monster="${esc(m.id)}">${esc(m.name)}</b>
          <small>${fmt(a.experience)} exp</small>
        </div>
        ${dropCell}
      </div>`;
  }

  // Keys of the tree groups that contain `mapId`, so its branch auto-expands.
  function ancestorKeys(mapId) {
    const s = S();
    const keys = [];
    const region = s.regionOfMap[mapId];
    const type = s.maps[mapId]?.mapType || 'general_area_or_poi';
    const hub = s.roomToHub[mapId] || (s.caveSystemByHub[mapId] ? mapId : null);
    if (region) {
      keys.push('region:' + region.id);
      if (hub) {
        keys.push('region-caves:' + region.id, 'cave:' + hub);
      } else if (type !== 'main_17_map') {
        keys.push('region-theme:' + region.id + ':' + type);
      }
    }
    // theme mode
    if (hub) keys.push('theme-caves', 'cave:' + hub);
    else keys.push('theme:' + type);
    return keys;
  }

  // Fit-to-container map viewer: no native scroll, just zoom (buttons + wheel) and drag-to-pan.
  function setupMapViewer(root, stage, img) {
    const wrap = root.querySelector('#stageWrap');
    const zoomLabel = root.querySelector('#zoomLabel');
    const MIN_SCALE = 0.08;
    const MAX_SCALE = 6;
    let scale = 1;
    let panX = 0;
    let panY = 0;

    function fitScale() {
      const ww = wrap.clientWidth || 1;
      const wh = wrap.clientHeight || 1;
      return Math.min(ww / img.width, wh / img.height, 2.5);
    }
    function clamp() {
      const ww = wrap.clientWidth;
      const wh = wrap.clientHeight;
      const iw = img.width * scale;
      const ih = img.height * scale;
      const overlap = 80;
      panX = Math.max(Math.min(0, ww - iw) - overlap, Math.min(Math.max(0, ww - iw) + overlap, panX));
      panY = Math.max(Math.min(0, wh - ih) - overlap, Math.min(Math.max(0, wh - ih) + overlap, panY));
    }
    function apply() {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }
    function fit() {
      scale = fitScale();
      panX = (wrap.clientWidth - img.width * scale) / 2;
      panY = (wrap.clientHeight - img.height * scale) / 2;
      apply();
    }
    function zoomAt(cx, cy, factor) {
      const imgX = (cx - panX) / scale;
      const imgY = (cy - panY) / scale;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
      panX = cx - imgX * scale;
      panY = cy - imgY * scale;
      clamp();
      apply();
    }

    root.querySelector('#zoomIn').onclick = () => zoomAt(wrap.clientWidth / 2, wrap.clientHeight / 2, 1.3);
    root.querySelector('#zoomOut').onclick = () => zoomAt(wrap.clientWidth / 2, wrap.clientHeight / 2, 1 / 1.3);
    root.querySelector('#zoomFit').onclick = fit;

    wrap.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = wrap.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false }
    );

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.hotzone')) return; // let the hotzone button handle its own click
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        wrap.classList.add('dragging');
      }
      if (!moved) return;
      panX = startPanX + dx;
      panY = startPanY + dy;
      clamp();
      apply();
    });
    function endDrag() {
      dragging = false;
      wrap.classList.remove('dragging');
    }
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
  }
})();
