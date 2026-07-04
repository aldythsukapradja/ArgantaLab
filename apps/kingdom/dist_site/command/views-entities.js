// Views: Monster Codex, Items & Drops, Skills, Asset Vault.
window.Views = window.Views || {};

(function () {
  const { esc, fmt, asset, spriteImg, lightbox } = UI;
  const S = () => Store.S;

  // ---------------- Monsters ----------------
  Views.monsters = function (root, params) {
    if (params[0]) return monsterDetail(root, params[0]);
    const s = S();
    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Monster Codex</h1>
          <p>${fmt(s.raw.monsters.length)} monsters with animated 2-frame sprites, experience and loot.</p>
        </div>
        <div class="toolbar">
          <input id="monQ" placeholder="Search monsters…" style="width:280px">
          <select id="monSort">
            <option value="name">Sort: name</option>
            <option value="exp">Sort: experience ↓</option>
            <option value="drops">Sort: drop rows ↓</option>
          </select>
          <div class="spacer"></div><span class="count" id="monCount"></span>
        </div>
      </div>
      <div class="egrid" id="monGrid"></div>
      <div class="pager"><button class="btn small" id="monMore">Show more</button></div>`;

    let shown = 60;
    function draw() {
      const q = root.querySelector('#monQ').value.trim().toLowerCase();
      const sort = root.querySelector('#monSort').value;
      let rows = s.raw.monsters.filter((m) => !q || m.name.toLowerCase().includes(q));
      if (sort === 'exp') rows = rows.slice().sort((a, b) => (b.defaultExperience || 0) - (a.defaultExperience || 0));
      else if (sort === 'drops') rows = rows.slice().sort((a, b) => (b.dropIds || []).length - (a.dropIds || []).length);
      else rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
      root.querySelector('#monCount').textContent = `${fmt(rows.length)} monsters`;
      root.querySelector('#monGrid').innerHTML = rows
        .slice(0, shown)
        .map(
          (m) => `
        <button class="ecard" data-id="${esc(m.id)}">
          <div class="thumb">${spriteImg(m.images)}</div>
          <div>
            <b>${esc(m.name)}</b>
            <small>${fmt(m.defaultExperience)} exp · ${(m.appearanceIds || []).length} maps · ${(m.dropIds || []).length} drops</small>
          </div>
        </button>`
        )
        .join('');
      root.querySelector('#monMore').style.display = rows.length > shown ? '' : 'none';
      root.querySelectorAll('#monGrid .ecard').forEach((c) =>
        c.addEventListener('click', () => (location.hash = '#/monsters/' + c.dataset.id))
      );
    }
    root.querySelector('#monQ').addEventListener('input', () => { shown = 60; draw(); });
    root.querySelector('#monSort').addEventListener('change', draw);
    root.querySelector('#monMore').addEventListener('click', () => { shown += 60; draw(); });
    draw();
  };

  function monsterDetail(root, id) {
    const s = S();
    const m = s.monsters[id];
    if (!m) { root.innerHTML = '<div class="empty">Monster not found.</div>'; return; }
    const apps = (s.appearancesByMonster[id] || []).slice().sort((a, b) => (a.experience || 0) - (b.experience || 0));
    const drops = s.dropsByMonster[id] || [];
    const byItem = {};
    for (const d of drops) (byItem[d.itemId] ||= []).push(d);

    root.innerHTML = `
      <a class="backlink" href="#/monsters">← Monster Codex</a>
      <div class="detail">
        <div class="detail-side">
          <div class="hero-sprite">${spriteImg(m.images)}</div>
          <div class="hero-sprite client-hero" id="mobHero" title="Real client sprite" hidden></div>
          <div class="panel">
            <h2>${esc(m.name)}</h2>
            <dl class="kv">
              <dt>Experience</dt><dd>${fmt(m.defaultExperience)}</dd>
              <dt>Exp variants</dt><dd>${(m.experienceValues || []).map(fmt).join(', ') || '—'}</dd>
              <dt>Appears on</dt><dd>${apps.length} maps</dd>
              <dt>Drop rows</dt><dd>${fmt(drops.length)}</dd>
              <dt>Tags</dt><dd class="chip-line">${(m.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</dd>
            </dl>
          </div>
        </div>
        <div>
          <div class="panel" style="margin-bottom:12px">
            <h2>Appearances <small>per-map exp + spawn tuning</small></h2>
            <div style="overflow:auto;max-height:330px">
            <table class="tbl">
              <thead><tr><th>Map</th><th class="num">Exp</th><th class="num">Drops</th><th>Spawn count</th></tr></thead>
              <tbody>${apps
                .map((a) => {
                  const map = s.maps[a.mapId];
                  return `
                <tr>
                  <td>${map ? `<a href="#/world/${esc(a.mapId)}">${esc(map.name || a.mapId)}</a>` : esc(a.mapName || a.mapId)}
                      <span class="chip" style="margin-left:6px">${esc(a.version || '')}</span></td>
                  <td class="num">${fmt(a.experience)}</td>
                  <td class="num">${(a.dropIds || []).length}</td>
                  <td><div class="spawn-edit"><input type="number" min="0" max="30"
                    value="${Store.spawnCount(a.id)}" class="${Store.isOverridden(a.id) ? 'overridden' : ''}"
                    data-app="${esc(a.id)}"></div></td>
                </tr>`;
                })
                .join('')}</tbody>
            </table>
            </div>
          </div>
          <div class="panel">
            <h2>Loot <small>${Object.keys(byItem).length} distinct items · ${fmt(drops.length)} rows</small></h2>
            <table class="tbl">
              <thead><tr><th></th><th>Item</th><th>Rarity</th><th class="num">Maps</th></tr></thead>
              <tbody>${Object.entries(byItem)
                .map(([itemId, rows]) => {
                  const it = s.items[itemId];
                  const rare = rows.some((r) => r.type === 'rare');
                  return `
                <tr class="row-link" onclick="location.hash='#/items/${esc(itemId)}'">
                  <td><img src="${esc(asset(it?.images?.[0] || rows[0].itemImageUrl))}" loading="lazy"></td>
                  <td><b>${esc(it?.name || rows[0].itemNameRaw)}</b></td>
                  <td>${rare ? '<span class="chip rare">rare</span>' : '<span class="chip">normal</span>'}</td>
                  <td class="num">${[...new Set(rows.map((r) => r.mapId))].length}</td>
                </tr>`;
                })
                .join('') || '<tr><td colspan="4" class="empty">No recorded drops.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>`;

    root.querySelectorAll('.spawn-edit input').forEach((inp) => {
      inp.addEventListener('change', () => {
        Store.setSpawnOverride(inp.dataset.app, inp.value);
        inp.classList.toggle('overridden', Store.isOverridden(inp.dataset.app));
      });
    });

    // Real client sprite (animated, correct palette) when a link exists.
    (async () => {
      try {
        const links = await ClientArt.monsterLinks();
        const link = links.find((l) => l.monsterId === id && l.status !== 'rejected');
        if (!link) return;
        const mobsArr = await ClientArt.mobs();
        const mob = mobsArr[link.mobId];
        const hero = root.querySelector('#mobHero');
        if (!mob || !hero) return;
        const c = await ClientArt.creatureCanvas(mob, {
          paletteId: link.paletteId ?? null, animName: 'walk_down', scale: 2,
        });
        if (c) {
          hero.hidden = false;
          hero.innerHTML = `<small class="chip">client mob #${link.mobId}</small>`;
          hero.prepend(c);
        }
      } catch { /* client library not built yet */ }
    })();
  }

  // ---------------- Items ----------------
  Views.items = function (root, params) {
    if (params[0]) return itemDetail(root, params[0]);
    const s = S();
    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Items &amp; Drops</h1>
          <p>${fmt(s.raw.items.length)} items · ${fmt(s.raw.drops.length)} drop rows · ${fmt(s.raw['shop-inventory'].length)} shop rows.</p>
        </div>
        <div class="toolbar">
          <input id="itemQ" placeholder="Search items…" style="width:280px">
          <select id="itemFilter">
            <option value="">All items</option>
            <option value="dropped">Dropped by monsters</option>
            <option value="sold">Sold in shops</option>
            <option value="skill">Skill requirement</option>
          </select>
          <div class="spacer"></div><span class="count" id="itemCount"></span>
        </div>
      </div>
      <div class="egrid" id="itemGrid"></div>
      <div class="pager"><button class="btn small" id="itemMore">Show more</button></div>`;

    let shown = 72;
    function draw() {
      const q = root.querySelector('#itemQ').value.trim().toLowerCase();
      const f = root.querySelector('#itemFilter').value;
      let rows = s.raw.items.filter((it) => !q || it.name.toLowerCase().includes(q));
      if (f === 'dropped') rows = rows.filter((it) => (s.dropsByItem[it.id] || []).length);
      if (f === 'sold') rows = rows.filter((it) => (s.shopsByItem[it.id] || []).length);
      if (f === 'skill') rows = rows.filter((it) => (s.reqsByItem[it.id] || []).length);
      rows.sort((a, b) => a.name.localeCompare(b.name));
      root.querySelector('#itemCount').textContent = `${fmt(rows.length)} items`;
      root.querySelector('#itemGrid').innerHTML = rows
        .slice(0, shown)
        .map(
          (it) => `
        <button class="ecard" data-id="${esc(it.id)}">
          <div class="thumb"><img src="${esc(asset(it.images?.[0]))}" loading="lazy"></div>
          <div>
            <b>${esc(it.name)}</b>
            <small>${(s.dropsByItem[it.id] || []).length} drops · ${(s.shopsByItem[it.id] || []).length} shops · ${(s.reqsByItem[it.id] || []).length} skill reqs</small>
          </div>
        </button>`
        )
        .join('');
      root.querySelector('#itemMore').style.display = rows.length > shown ? '' : 'none';
      root.querySelectorAll('#itemGrid .ecard').forEach((c) =>
        c.addEventListener('click', () => (location.hash = '#/items/' + c.dataset.id))
      );
    }
    root.querySelector('#itemQ').addEventListener('input', () => { shown = 72; draw(); });
    root.querySelector('#itemFilter').addEventListener('change', draw);
    root.querySelector('#itemMore').addEventListener('click', () => { shown += 72; draw(); });
    draw();
  };

  function itemDetail(root, id) {
    const s = S();
    const it = s.items[id];
    if (!it) { root.innerHTML = '<div class="empty">Item not found.</div>'; return; }
    const drops = s.dropsByItem[id] || [];
    const shops = s.shopsByItem[id] || [];
    const reqs = s.reqsByItem[id] || [];
    const byMonster = {};
    for (const d of drops) (byMonster[d.monsterId] ||= []).push(d);

    root.innerHTML = `
      <a class="backlink" href="#/items">← Items</a>
      <div class="detail">
        <div class="detail-side">
          <div class="hero-sprite"><img src="${esc(asset(it.images?.[0]))}"></div>
          <div class="hero-sprite client-hero" id="itemHero" title="Real client icon" hidden></div>
          <div class="panel">
            <h2>${esc(it.name)}</h2>
            <dl class="kv">
              <dt>Dropped by</dt><dd>${Object.keys(byMonster).length} monsters</dd>
              <dt>Sold at</dt><dd>${shops.length} shops</dd>
              <dt>Needed by</dt><dd>${reqs.length} skill requirements</dd>
              <dt>Tags</dt><dd class="chip-line">${(it.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('') || '—'}</dd>
            </dl>
          </div>
        </div>
        <div>
          <div class="panel" style="margin-bottom:12px">
            <h2>Farming sources <small>which monster, which map, what rarity</small></h2>
            <div style="overflow:auto;max-height:320px">
            <table class="tbl">
              <thead><tr><th></th><th>Monster</th><th>Map</th><th>Rarity</th></tr></thead>
              <tbody>${drops
                .map((d) => {
                  const m = s.monsters[d.monsterId];
                  return `
                <tr>
                  <td>${m ? spriteImg(m.images) : ''}</td>
                  <td><a href="#/monsters/${esc(d.monsterId)}">${esc(d.monsterName)}</a></td>
                  <td><a href="#/world/${esc(d.mapId)}">${esc(d.mapName)}</a></td>
                  <td>${d.type === 'rare' ? '<span class="chip rare">rare</span>' : '<span class="chip">normal</span>'}</td>
                </tr>`;
                })
                .join('') || '<tr><td colspan="4" class="empty">Not dropped by any recorded monster.</td></tr>'}</tbody>
            </table>
            </div>
          </div>
          <div class="grid2">
            <div class="panel">
              <h2>Shops <small>${shops.length}</small></h2>
              ${shops.length ? `<table class="tbl"><tbody>${shops
                .map(
                  (r) => `
                <tr class="row-link" onclick="location.hash='#/world/${esc(r.shopMapId)}'">
                  <td>${esc(r.shopMapName)}</td><td class="num">${fmt(r.price)} coins</td>
                </tr>`
                )
                .join('')}</tbody></table>` : '<div class="empty">Not sold anywhere.</div>'}
            </div>
            <div class="panel">
              <h2>Skill requirements <small>${reqs.length}</small></h2>
              ${reqs.length ? `<table class="tbl"><tbody>${reqs
                .map(
                  (r) => `
                <tr class="row-link" onclick="location.hash='#/skills/${esc(r.path.toLowerCase())}'">
                  <td>${esc(r.skillName)} <span class="chip">${esc(r.path)}</span></td>
                  <td class="num">×${fmt(r.quantity)}</td>
                </tr>`
                )
                .join('')}</tbody></table>` : '<div class="empty">Not required by any skill.</div>'}
            </div>
          </div>
        </div>
      </div>`;

    // Real client icon (recovered palette) when a link exists.
    (async () => {
      try {
        const links = await ClientArt.itemLinks();
        const link = links.find((l) => l.itemId === id && l.status !== 'rejected');
        if (!link) return;
        const hero = root.querySelector('#itemHero');
        const c = await ClientArt.iconCanvas(link.iconIndex, {
          paletteId: link.paletteId ?? null, scale: 2,
        });
        if (c && hero) {
          hero.hidden = false;
          hero.innerHTML = `<small class="chip">client icon #${link.iconIndex}${link.paletteRecovered ? ' · recovered palette' : ''}</small>`;
          hero.prepend(c);
        }
      } catch { /* client library not built yet */ }
    })();
  }

  // ---------------- Skills ----------------
  Views.skills = function (root, params) {
    const s = S();
    const paths = ['Warrior', 'Mage', 'Poet', 'Rogue'];
    const active = paths.find((p) => p.toLowerCase() === (params[0] || '').toLowerCase()) || 'Warrior';
    const list = s.skillsByPath[active] || [];

    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Skills</h1>
          <p>${fmt(s.raw.skills.length)} spells across four paths, requirement chains resolved to farmable items.</p>
        </div>
        <div class="path-tabs">${paths
          .map(
            (p) =>
              `<button class="path-tab ${p === active ? 'active' : ''}" data-p="${p}">${p} <small>(${(s.skillsByPath[p] || []).length})</small></button>`
          )
          .join('')}</div>
      </div>
      <div class="skill-grid">${list
        .map(
          (sk) => `
        <div class="skill-card">
          <div class="skill-head">
            <img src="${esc(asset(sk.spellImageUrl))}" loading="lazy">
            <div>
              <b>${esc(sk.name)}</b>
              <small>lv ${esc(sk.levelOrRank || '?')} · ${esc(sk.spellType || 'spell')} · ${fmt(sk.manaCost)} mana${
                sk.aethersSeconds ? ` · ${sk.aethersSeconds}s aether` : ''
              }</small>
            </div>
          </div>
          <p>${esc(sk.shortDescription || sk.description || '')}</p>
          <div class="chip-line">${(s.reqsBySkill[sk.id] || [])
            .map((r) => {
              const img = r.imageUrl ? `<img src="${esc(asset(r.imageUrl))}" loading="lazy">` : '';
              const chip = `${img}${esc(r.quantity ? r.quantity + '× ' : '')}${esc(r.itemNameRaw || r.rawText)}`;
              return r.itemId && s.items[r.itemId]
                ? `<a class="chip" href="#/items/${esc(r.itemId)}">${chip}</a>`
                : `<span class="chip">${chip}</span>`;
            })
            .join('')}</div>
        </div>`
        )
        .join('')}</div>`;

    root.querySelectorAll('.path-tab').forEach((t) =>
      t.addEventListener('click', () => (location.hash = '#/skills/' + t.dataset.p.toLowerCase()))
    );
  };

  // ---------------- Assets ----------------
  Views.assets = function (root) {
    const s = S();
    const kinds = [...new Set(s.raw.assets.map((a) => a.kind))].sort();
    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Asset Vault</h1>
          <p>${fmt(s.raw.assets.length)} mirrored images — maps, monsters, items, spells, gear.</p>
        </div>
        <div class="toolbar">
          <input id="assetQ" placeholder="Search filenames…" style="width:260px">
          <select id="assetKind"><option value="">All kinds</option>${kinds
            .map((k) => `<option value="${esc(k)}">${esc(k)}</option>`)
            .join('')}</select>
          <div class="spacer"></div><span class="count" id="assetCount"></span>
        </div>
      </div>
      <div class="asset-grid" id="assetGrid"></div>
      <div class="pager"><button class="btn small" id="assetMore">Show more</button></div>`;

    let shown = 120;
    function draw() {
      const q = root.querySelector('#assetQ').value.trim().toLowerCase();
      const kind = root.querySelector('#assetKind').value;
      const rows = s.raw.assets.filter(
        (a) =>
          a.storageMode === 'local_mirror' &&
          a.localPath &&
          (!kind || a.kind === kind) &&
          (!q || a.filename.toLowerCase().includes(q))
      );
      root.querySelector('#assetCount').textContent = `${fmt(rows.length)} assets`;
      root.querySelector('#assetGrid').innerHTML = rows
        .slice(0, shown)
        .map(
          (a) => `
        <button class="asset-cell" data-src="${esc(asset(a.localPath))}" data-name="${esc(a.filename)}">
          <img src="${esc(asset(a.localPath))}" loading="lazy">
          <small>${esc(a.filename)}</small>
        </button>`
        )
        .join('');
      root.querySelector('#assetMore').style.display = rows.length > shown ? '' : 'none';
      root.querySelectorAll('.asset-cell').forEach((c) =>
        c.addEventListener('click', () => lightbox(c.dataset.src, c.dataset.name))
      );
    }
    root.querySelector('#assetQ').addEventListener('input', () => { shown = 120; draw(); });
    root.querySelector('#assetKind').addEventListener('change', () => { shown = 120; draw(); });
    root.querySelector('#assetMore').addEventListener('click', () => { shown += 120; draw(); });
    draw();
  };
})();
