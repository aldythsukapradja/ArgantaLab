// Views: Char Vault, Mounts, Effects, Audit & Links — the client-art tabs.
window.Views = window.Views || {};

(function () {
  const { esc, fmt, asset } = UI;
  const S = () => Store.S;

  const CHAR_CATS = [
    'body', 'coat', 'hair', 'helmet', 'face', 'sword', 'spear', 'bow', 'fan',
    'shield', 'shoes', 'mantle', 'neck', 'emotion', 'facedec', 'hairdec', 'arrow',
  ];
  const PREVIEW_ANIMS = [
    'NormalStandBySouth', 'NormalWalkSouth', 'NormalWalkEast', 'NormalWalkNorth',
    'SwingSouth', 'PierceSouth', 'ShootSouth', 'GetSouth', 'SpellSouth',
    'RidingSouth', 'Victory', 'Dance',
  ];

  // ---------------- Char Vault ----------------
  Views.charvault = function (root, params) {
    const cat = CHAR_CATS.includes(params[0]) ? params[0] : 'body';
    if (params[1] != null) return partDetail(root, cat, Number(params[1]));

    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Char Vault</h1>
          <p>Every paper-doll part extracted from the real client — animated with its own motion data.</p>
        </div>
        <div class="path-tabs" id="catTabs">${CHAR_CATS
          .map((c) => `<button class="path-tab ${c === cat ? 'active' : ''}" data-c="${c}">${c}</button>`)
          .join('')}</div>
        <div class="toolbar">
          <label><input type="checkbox" id="vaultWalk"> walk animation</label>
          <div class="spacer"></div><span class="count" id="vaultCount">loading…</span>
        </div>
      </div>
      <div class="vault-grid" id="vaultGrid"><div class="empty">Loading ${esc(cat)}…</div></div>
      <div class="pager"><button class="btn small" id="vaultMore">Show more</button></div>`;

    root.querySelectorAll('#catTabs .path-tab').forEach((t) =>
      t.addEventListener('click', () => (location.hash = '#/charvault/' + t.dataset.c))
    );

    let shown = 36;
    let parts = [];
    async function draw() {
      const grid = root.querySelector('#vaultGrid');
      const walk = root.querySelector('#vaultWalk').checked;
      root.querySelector('#vaultCount').textContent = `${fmt(parts.length)} ${cat} parts`;
      grid.innerHTML = '';
      const slice = parts.slice(0, shown);
      for (const part of slice) {
        const card = document.createElement('button');
        card.className = 'vault-card';
        card.innerHTML = `<div class="vthumb"></div>
          <small>#${part.id} · pal ${part.palette_id} · ${part.frame_count}f</small>`;
        card.addEventListener('click', () => (location.hash = `#/charvault/${cat}/${part.id}`));
        grid.appendChild(card);
        ClientArt.partCanvas(cat, part, {
          animName: walk ? 'NormalWalkSouth' : 'NormalStandBySouth', scale: 1,
        }).then((c) => { if (c) card.querySelector('.vthumb').appendChild(c); });
      }
      root.querySelector('#vaultMore').style.display = parts.length > shown ? '' : 'none';
    }
    ClientArt.charParts(cat).then((p) => { parts = p; draw(); })
      .catch(() => { root.querySelector('#vaultGrid').innerHTML = '<div class="empty">data/client not built — run scripts/build-client.mjs</div>'; });
    root.querySelector('#vaultWalk').addEventListener('change', draw);
    root.querySelector('#vaultMore').addEventListener('click', () => { shown += 36; draw(); });
  };

  async function partDetail(root, cat, id) {
    root.innerHTML = `<a class="backlink" href="#/charvault/${esc(cat)}">← ${esc(cat)} vault</a><div class="empty">Loading…</div>`;
    const parts = await ClientArt.charParts(cat);
    const part = parts.find((p) => p.id === id);
    if (!part) { root.innerHTML = '<div class="empty">Part not found.</div>'; return; }
    const palettes = await ClientArt.charPalettes(cat).catch(() => []);
    const animNames = Object.keys(part.animations || {});

    root.innerHTML = `
      <a class="backlink" href="#/charvault/${esc(cat)}">← ${esc(cat)} vault</a>
      <div class="detail">
        <div class="detail-side">
          <div class="hero-sprite" id="partHero"></div>
          <div class="panel">
            <h2>${esc(cat)} #${part.id}</h2>
            <dl class="kv">
              <dt>Frames</dt><dd>${part.frame_count} (global ${part.frame_index}…)</dd>
              <dt>Palette</dt><dd>#${part.palette_id} of ${palettes.length}</dd>
              <dt>Animations</dt><dd>${animNames.length} motions</dd>
              <dt>Sheet</dt><dd><a href="${esc('../data/client/char/' + cat + '/' + part.sheet)}" target="_blank">${esc(part.sheet)}</a></dd>
            </dl>
            <div class="chip-line" id="palRow" style="max-height:120px;overflow:auto"></div>
          </div>
        </div>
        <div>
          <div class="panel" style="margin-bottom:12px">
            <h2>Motions <small>click to preview</small></h2>
            <div class="chip-line" id="animRow">${PREVIEW_ANIMS
              .filter((a) => part.animations?.[a]?.length)
              .concat(animNames.filter((a) => !PREVIEW_ANIMS.includes(a)).slice(0, 20))
              .map((a) => `<button class="chip" data-anim="${esc(a)}">${esc(a)}</button>`)
              .join('')}</div>
          </div>
          <div class="panel">
            <h2>Full sheet</h2>
            <img src="${esc('../data/client/char/' + cat + '/' + part.sheet)}" style="max-width:100%;image-rendering:pixelated;background:#222">
          </div>
        </div>
      </div>`;

    let curAnim = 'NormalStandBySouth';
    let curPal = null;
    async function refresh() {
      const hero = root.querySelector('#partHero');
      hero.innerHTML = '';
      const c = await ClientArt.partCanvas(cat, part, { animName: curAnim, scale: 3, paletteId: curPal });
      if (c) hero.appendChild(c);
    }
    root.querySelectorAll('#animRow .chip').forEach((b) =>
      b.addEventListener('click', () => { curAnim = b.dataset.anim; refresh(); })
    );
    // palette swatches (dyes)
    const palRow = root.querySelector('#palRow');
    palRow.innerHTML = palettes
      .map((p, i) => {
        const probe = p[80] || p[128] || [0, 0, 0];
        return `<button class="swatch ${i === part.palette_id ? 'active' : ''}" title="palette ${i}"
          data-pal="${i}" style="background:rgb(${probe[0]},${probe[1]},${probe[2]})"></button>`;
      })
      .join('');
    palRow.querySelectorAll('.swatch').forEach((sw) =>
      sw.addEventListener('click', () => { curPal = Number(sw.dataset.pal); refresh(); })
    );
    refresh();
  }

  // ---------------- Mounts ----------------
  Views.mounts = async function (root) {
    root.innerHTML = `
      <div class="view-sticky"><div class="view-head">
        <h1>Mounts</h1><p>The 53 rideable creatures from RIDINGS.DNA — real stand/walk animations.</p>
      </div></div>
      <div class="vault-grid" id="mountGrid"><div class="empty">Loading…</div></div>`;
    const mounts = await ClientArt.mounts().catch(() => null);
    if (!mounts) { root.querySelector('#mountGrid').innerHTML = '<div class="empty">data/client not built.</div>'; return; }
    const grid = root.querySelector('#mountGrid');
    grid.innerHTML = '';
    for (const m of mounts) {
      const card = document.createElement('div');
      card.className = 'vault-card';
      card.innerHTML = `<div class="vthumb"></div><small>mount #${m.id} · pal ${m.palette_id}</small>`;
      grid.appendChild(card);
      ClientArt.creatureCanvas(m, { folder: 'mounts', animName: 'walk_down', scale: 1 })
        .then((c) => { if (c) card.querySelector('.vthumb').appendChild(c); });
    }
  };

  // ---------------- Effects ----------------
  Views.effects = async function (root) {
    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Spell Effects</h1>
          <p>648 client effect animations with authentic per-frame timing and translucency.</p>
        </div>
        <div class="toolbar">
          <input id="fxFrom" type="number" min="0" max="647" value="0" style="width:90px"> start id
          <div class="spacer"></div><span class="count" id="fxCount"></span>
        </div>
      </div>
      <div class="vault-grid" id="fxGrid"><div class="empty">Loading…</div></div>
      <div class="pager"><button class="btn small" id="fxMore">Show more</button></div>`;
    const effects = await ClientArt.effects().catch(() => null);
    if (!effects) { root.querySelector('#fxGrid').innerHTML = '<div class="empty">data/client not built.</div>'; return; }
    const withArt = effects.filter((e) => e.sheet && e.animation?.length);
    root.querySelector('#fxCount').textContent = `${fmt(withArt.length)} effects with frames`;
    let shown = 24;
    let from = 0;
    function draw() {
      const grid = root.querySelector('#fxGrid');
      grid.innerHTML = '';
      const rows = withArt.filter((e) => e.id >= from).slice(0, shown);
      for (const eff of rows) {
        const card = document.createElement('div');
        card.className = 'vault-card fx';
        card.innerHTML = `<div class="vthumb"></div>
          <small>efx #${eff.id} · ${eff.animation.length} steps · ${eff.animation.some((a) => a.alpha != null) ? 'translucent' : 'opaque'}</small>`;
        grid.appendChild(card);
        ClientArt.effectCanvas(eff, { scale: 1 }).then((c) => {
          if (c) card.querySelector('.vthumb').appendChild(c);
        });
      }
      root.querySelector('#fxMore').style.display = rows.length >= shown ? '' : 'none';
    }
    root.querySelector('#fxFrom').addEventListener('change', (e) => { from = Number(e.target.value) || 0; shown = 24; draw(); });
    root.querySelector('#fxMore').addEventListener('click', () => { shown += 24; draw(); });
    draw();
  };

  // ---------------- Audit & Links ----------------
  const REVIEW_KEY = 'kingdom_link_review';
  function loadReview() {
    try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}'); } catch { return {}; }
  }
  function saveReview(r) { localStorage.setItem(REVIEW_KEY, JSON.stringify(r)); }

  Views.audit = async function (root) {
    root.innerHTML = `
      <div class="view-sticky"><div class="view-head">
        <h1>Audit &amp; Links</h1>
        <p>Scoreboard from scripts/audit.mjs + human review of auto-matched links.</p>
      </div>
      <div class="toolbar">
        <select id="linkKind"><option value="monsters">Monster links</option><option value="items">Item links</option></select>
        <select id="linkFilter"><option value="">All</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select>
        <button class="btn small" id="exportReview">Export reviewed links</button>
        <div class="spacer"></div><span class="count" id="linkCount"></span>
      </div></div>
      <div id="auditBoard" class="panel" style="margin-bottom:12px"><div class="empty">Loading audit…</div></div>
      <div id="linkList"></div>
      <div class="pager"><button class="btn small" id="linkMore">Show more</button></div>`;

    // scoreboard
    fetch('../data/derived/audit.json').then((r) => (r.ok ? r.json() : null), () => null).then((a) => {
      const el = root.querySelector('#auditBoard');
      if (!a) { el.innerHTML = '<div class="empty">Run node scripts/audit.mjs first.</div>'; return; }
      el.innerHTML = `<h2>Scoreboard <small>${esc(a.generated)}</small></h2>
        <div class="stat-row">
          <div class="stat"><b>${a.monsters.linked}/${a.monsters.scraped}</b><small>monsters linked</small></div>
          <div class="stat"><b>${fmt(a.monsters.clientMobOrphans)}</b><small>mob casting pool</small></div>
          <div class="stat"><b>${a.items.linked}/${a.items.scraped}</b><small>items linked</small></div>
          <div class="stat"><b>${a.items.palettesRecovered}</b><small>palettes recovered</small></div>
          <div class="stat"><b>${fmt(a.items.clientIconOrphans)}</b><small>icon casting pool</small></div>
          <div class="stat"><b>${a.monsters.withoutXp.length}</b><small>monsters w/o XP</small></div>
          <div class="stat"><b>${a.skills.linkedToEffects}/${a.skills.scraped}</b><small>skills→effects</small></div>
        </div>`;
    });

    const s = S();
    const review = loadReview();
    let shown = 30;
    async function draw() {
      const kind = root.querySelector('#linkKind').value;
      const filter = root.querySelector('#linkFilter').value;
      const list = root.querySelector('#linkList');
      const links = kind === 'monsters' ? await ClientArt.monsterLinks() : await ClientArt.itemLinks();
      const rows = links.filter((l) => {
        const key = kind + ':' + (l.monsterId || l.itemId);
        const st = review[key] || 'pending';
        return !filter || st === filter;
      });
      root.querySelector('#linkCount').textContent = `${fmt(rows.length)} links`;
      list.innerHTML = '';
      for (const l of rows.slice(0, shown)) {
        const key = kind + ':' + (l.monsterId || l.itemId);
        const st = review[key] || 'pending';
        const row = document.createElement('div');
        row.className = 'link-row panel';
        if (kind === 'monsters') {
          const mon = s.monsters[l.monsterId];
          row.innerHTML = `
            <div class="link-imgs">
              <div class="link-img"><small>scraped</small>${mon?.images?.[0] ? `<img src="${esc(asset(mon.images[0]))}">` : ''}</div>
              <div class="link-img client" data-mob="${l.mobId}" data-pal="${l.paletteId ?? ''}"><small>client</small></div>
            </div>
            <div class="link-info">
              <b>${esc(mon?.name || l.monsterId)}</b>
              <small>mob #${l.mobId} · pal ${l.paletteId ?? '—'} · iou ${l.score} · mse ${l.colorMse ?? '—'}</small>
            </div>
            <div class="link-actions" data-key="${esc(key)}">
              <button class="btn small ok ${st === 'confirmed' ? 'active' : ''}" data-st="confirmed">✓</button>
              <button class="btn small bad ${st === 'rejected' ? 'active' : ''}" data-st="rejected">✕</button>
              <span class="chip ${st}">${st}</span>
            </div>`;
        } else {
          const it = s.items[l.itemId];
          row.innerHTML = `
            <div class="link-imgs">
              <div class="link-img"><small>scraped</small>${it?.images?.[0] ? `<img src="${esc(asset(it.images[0]))}">` : ''}</div>
              <div class="link-img client" data-icon="${l.iconIndex}" data-pal="${l.paletteId ?? ''}"><small>client</small></div>
            </div>
            <div class="link-info">
              <b>${esc(it?.name || l.itemId)}</b>
              <small>icon #${l.iconIndex} · pal ${l.paletteId}${l.paletteRecovered ? ' (recovered)' : ''} · score ${l.score}</small>
            </div>
            <div class="link-actions" data-key="${esc(key)}">
              <button class="btn small ok ${st === 'confirmed' ? 'active' : ''}" data-st="confirmed">✓</button>
              <button class="btn small bad ${st === 'rejected' ? 'active' : ''}" data-st="rejected">✕</button>
              <span class="chip ${st}">${st}</span>
            </div>`;
        }
        list.appendChild(row);
      }
      // hydrate client previews
      const mobsP = kind === 'monsters' ? ClientArt.mobs() : null;
      list.querySelectorAll('.link-img.client').forEach(async (el) => {
        if (el.dataset.mob != null) {
          const mobs = await mobsP;
          const mob = mobs[Number(el.dataset.mob)];
          const c = await ClientArt.creatureCanvas(mob, {
            paletteId: el.dataset.pal === '' ? null : Number(el.dataset.pal), scale: 1,
          });
          if (c) el.appendChild(c);
        } else if (el.dataset.icon != null) {
          const c = await ClientArt.iconCanvas(Number(el.dataset.icon), {
            paletteId: el.dataset.pal === '' ? null : Number(el.dataset.pal), scale: 2,
          });
          if (c) el.appendChild(c);
        }
      });
      list.querySelectorAll('.link-actions').forEach((act) => {
        act.querySelectorAll('button').forEach((b) =>
          b.addEventListener('click', () => {
            const key = act.dataset.key;
            review[key] = review[key] === b.dataset.st ? undefined : b.dataset.st;
            if (!review[key]) delete review[key];
            saveReview(review);
            draw();
          })
        );
      });
      root.querySelector('#linkMore').style.display = rows.length > shown ? '' : 'none';
    }
    root.querySelector('#linkKind').addEventListener('change', () => { shown = 30; draw(); });
    root.querySelector('#linkFilter').addEventListener('change', () => { shown = 30; draw(); });
    root.querySelector('#linkMore').addEventListener('click', () => { shown += 30; draw(); });
    root.querySelector('#exportReview').addEventListener('click', async () => {
      // merge review states into the auto link files and download
      for (const kind of ['monsters', 'items']) {
        const links = kind === 'monsters' ? await ClientArt.monsterLinks() : await ClientArt.itemLinks();
        const out = links.map((l) => {
          const key = kind + ':' + (l.monsterId || l.itemId);
          return review[key] ? { ...l, status: review[key] } : l;
        });
        const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (kind === 'monsters' ? 'monster' : 'item') + '-links.json';
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
    draw();
  };
})();

// ---------------- Character Lab (embedded React app) ----------------
(function () {
  window.Views = window.Views || {};
  Views.lab = function (root) {
    // Local dev (ANY localhost port — 8321 dedicated server, 5599 repo
    // server, etc.): the React app runs on its own Vite dev server at :8322.
    // Deployed: both are one static site (scripts/build-deploy.mjs), so the
    // app sits at the relative path /lab/ instead. (Serving Kingdom Command
    // from a non-8322 port and pointing the iframe at /lab/ 404s locally.)
    const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const labUrl = isLocalDev ? 'http://localhost:8322/' : '/lab/';
    root.innerHTML = `
      <div class="lab-embed">
        <iframe src="${labUrl}" title="Character Lab"></iframe>
        <div class="lab-embed-note">${
          isLocalDev
            ? `Standalone: <a href="${labUrl}" target="_blank">localhost:8322</a> — run the <code>kingdom-web</code> dev server if this frame is empty.`
            : `Standalone: <a href="${labUrl}" target="_blank">${labUrl}</a>`
        }</div>
      </div>`;
  };
})();
