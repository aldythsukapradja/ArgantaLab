// Views: Overview, Data Model, raw Tables.
window.Views = window.Views || {};

(function () {
  const { esc, fmt, pagedTable } = UI;
  const S = () => Store.S;

  // ---------------- Overview ----------------
  Views.overview = function (root) {
    const s = S();
    const sum = s.raw.summary;
    const scrape = sum?.scrapeSummary?.coverage || {};
    const gaps = s.raw['data-gaps'];
    const overrideCount = Object.keys(s.overrides.spawns).length;

    const cardDefs = [
      ['Maps', s.raw.maps.length, 'c1'],
      ['Hotspots', s.raw.hotspots.length, 'c2'],
      ['Monsters', s.raw.monsters.length, 'c3'],
      ['Appearances', s.raw.appearances.length, 'c2'],
      ['Items', s.raw.items.length, 'c4'],
      ['Drop rows', s.raw.drops.length, 'c4'],
      ['Shop rows', s.raw['shop-inventory'].length, 'c5'],
      ['Skills', s.raw.skills.length, 'c5'],
      ['Skill reqs', s.raw['skill-requirements'].length, 'c5'],
      ['Assets', s.raw.assets.length, 'c3'],
      ['Data gaps', gaps.length, 'c6'],
      ['Spawn overrides', overrideCount, 'c6']
    ];

    root.innerHTML = `
      <div class="view-head">
        <h1>Command Overview</h1>
        <p>Source layer generated ${esc(sum?.generatedAt || '?')} · scraped from nexusatlas.com ·
        ${fmt(scrape.mapPagesScraped || 0)} pages crawled, ${fmt(scrape.fetchErrors || 0)} fetch errors</p>
      </div>
      <div class="cards">${cardDefs
        .map(
          ([label, value, c]) => `
        <div class="stat-card ${c}"><div class="stat-value">${fmt(value)}</div><div class="stat-label">${esc(label)}</div></div>`
        )
        .join('')}
      </div>
      <div class="grid2" style="margin-top:14px">
        <div class="panel">
          <h2>Scrape coverage <small>from MASTER_DATA_SUMMARY</small></h2>
          <table class="tbl">
            <tbody>
              <tr><td>Maps with monsters</td><td class="num">${fmt(scrape.mapsWithMonsters)}</td></tr>
              <tr><td>Maps with shop inventory</td><td class="num">${fmt(scrape.mapsWithInventory)}</td></tr>
              <tr><td>Requirement rows resolved via drops</td><td class="num">${fmt(sum?.scrapeSummary?.requirementCoverage?.drop || 0)}</td></tr>
              <tr><td>Requirement rows resolved via shops</td><td class="num">${fmt(sum?.scrapeSummary?.requirementCoverage?.shop || 0)}</td></tr>
              <tr><td>Requirement rows drop+shop</td><td class="num">${fmt(sum?.scrapeSummary?.requirementCoverage?.['drop+shop'] || 0)}</td></tr>
              <tr><td>Assets downloaded</td><td class="num">${fmt(sum?.scrapeSummary?.assets?.downloaded || 0)}</td></tr>
              <tr><td>Asset placeholders</td><td class="num">${fmt(sum?.scrapeSummary?.assets?.placeholders || 0)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <h2>Data gaps <small>${gaps.length} items with no farmable source</small></h2>
          <div style="overflow:auto;max-height:340px">
          <table class="tbl">
            <thead><tr><th>Requirement</th><th>Paths</th><th>Gap type</th></tr></thead>
            <tbody>${gaps
              .map(
                (g) => `
              <tr class="row-link" onclick="location.hash='#/items/${esc(g.itemId)}'">
                <td><b>${esc(g.requirementName)}</b></td>
                <td>${(g.paths || []).map((p) => `<span class="chip">${esc(p)}</span>`).join(' ')}</td>
                <td><span class="chip warn">${esc(g.gapType)}</span></td>
              </tr>`
              )
              .join('')}</tbody>
          </table>
          </div>
        </div>
      </div>`;
  };

  // ---------------- Data Model ----------------
  const MODEL = {
    nodes: [
      { id: 'maps', label: 'Maps', sub: 'world graph nodes', x: 80, y: 60, route: '#/world' },
      { id: 'hotspots', label: 'Hotspots', sub: 'pixel exits on map images', x: 80, y: 200, route: '#/tables/hotspots' },
      { id: 'edges', label: 'Edges', sub: 'map → map links', x: 80, y: 340, route: '#/tables/edges' },
      { id: 'appearances', label: 'Appearances', sub: 'monster ⟷ map join', x: 360, y: 130, route: '#/tables/appearances' },
      { id: 'monsters', label: 'Monsters', sub: '2-frame sprites + exp', x: 640, y: 60, route: '#/monsters' },
      { id: 'drops', label: 'Drops', sub: 'loot table rows', x: 640, y: 270, route: '#/tables/drops' },
      { id: 'items', label: 'Items', sub: 'icons + tags', x: 900, y: 170, route: '#/items' },
      { id: 'shop-inventory', label: 'Shop Inventory', sub: 'NPC shops + prices', x: 360, y: 420, route: '#/tables/shop-inventory' },
      { id: 'skills', label: 'Skills', sub: '4 paths · spells', x: 900, y: 420, route: '#/skills' },
      { id: 'skill-requirements', label: 'Skill Reqs', sub: 'spell → item costs', x: 640, y: 480, route: '#/tables/skill-requirements' },
      { id: 'assets', label: 'Assets', sub: 'image manifest', x: 80, y: 480, route: '#/assets' }
    ],
    edges: [
      ['hotspots', 'maps', 'belongs to'],
      ['edges', 'maps', 'from / to'],
      ['appearances', 'maps', 'on map'],
      ['appearances', 'monsters', 'of monster'],
      ['drops', 'monsters', 'dropped by'],
      ['drops', 'items', 'yields'],
      ['drops', 'appearances', 'scoped to'],
      ['shop-inventory', 'maps', 'sold at'],
      ['shop-inventory', 'items', 'sells'],
      ['skill-requirements', 'skills', 'for skill'],
      ['skill-requirements', 'items', 'needs item'],
      ['assets', 'maps', 'renders'],
      ['assets', 'monsters', 'renders']
    ]
  };

  Views.model = function (root) {
    const s = S();
    const counts = {
      maps: s.raw.maps.length, hotspots: s.raw.hotspots.length, edges: s.raw.edges.length,
      appearances: s.raw.appearances.length, monsters: s.raw.monsters.length, drops: s.raw.drops.length,
      items: s.raw.items.length, 'shop-inventory': s.raw['shop-inventory'].length,
      skills: s.raw.skills.length, 'skill-requirements': s.raw['skill-requirements'].length,
      assets: s.raw.assets.length
    };
    const NW = 190, NH = 62;
    const pos = Object.fromEntries(MODEL.nodes.map((n) => [n.id, n]));
    const center = (n) => ({ cx: n.x + NW / 2, cy: n.y + NH / 2 });

    const edgeSvg = MODEL.edges
      .map(([from, to, label]) => {
        const a = center(pos[from]);
        const b = center(pos[to]);
        const mx = (a.cx + b.cx) / 2;
        const my = (a.cy + b.cy) / 2 - 18;
        return `
          <path class="model-edge" d="M ${a.cx} ${a.cy} Q ${mx} ${my} ${b.cx} ${b.cy}"/>
          <text class="model-edge-label" x="${mx}" y="${my + 4}" text-anchor="middle">${esc(label)}</text>`;
      })
      .join('');

    const nodeSvg = MODEL.nodes
      .map(
        (n) => `
      <g class="model-node" data-route="${esc(n.route)}" transform="translate(${n.x},${n.y})">
        <rect width="${NW}" height="${NH}" rx="10"/>
        <text class="model-name" x="14" y="24">${esc(n.label)}</text>
        <text class="model-count" x="${NW - 14}" y="24" text-anchor="end">${fmt(counts[n.id])}</text>
        <text class="model-sub" x="14" y="44">${esc(n.sub)}</text>
      </g>`
      )
      .join('');

    root.innerHTML = `
      <div class="view-head">
        <h1>Data Model</h1>
        <p>The 11 core entities of the game database and how they join. Click a node to open its registry.</p>
      </div>
      <div class="model-wrap">
        <svg class="model-svg" viewBox="0 0 1140 580" preserveAspectRatio="xMidYMid meet">
          ${edgeSvg}
          ${nodeSvg}
        </svg>
      </div>`;
    root.querySelectorAll('.model-node').forEach((n) => {
      n.addEventListener('click', () => (location.hash = n.dataset.route));
    });
  };

  // ---------------- Raw tables ----------------
  const TABLE_SETS = [
    'maps', 'hotspots', 'edges', 'monsters', 'appearances', 'items', 'drops',
    'shop-inventory', 'skills', 'skill-requirements', 'assets', 'data-gaps', 'world-spine'
  ];

  Views.tables = function (root, params) {
    const s = S();
    const active = params[0] && TABLE_SETS.includes(params[0]) ? params[0] : 'drops';
    root.innerHTML = `
      <div class="view-sticky">
        <div class="view-head">
          <h1>Raw Tables</h1>
          <p>Direct paged view of every dataset in the core layer.</p>
        </div>
        <div class="toolbar">
          <select id="tableSelect">${TABLE_SETS.map(
            (t) => `<option value="${t}" ${t === active ? 'selected' : ''}>${t} (${fmt(s.raw[t].length)})</option>`
          ).join('')}</select>
          <input id="tableFilter" placeholder="Filter rows (substring match on JSON)…" style="width:320px">
          <div class="spacer"></div>
          <span class="count" id="tableCount"></span>
        </div>
      </div>
      <div class="panel" id="tableHost"></div>`;

    const host = root.querySelector('#tableHost');
    const countEl = root.querySelector('#tableCount');
    const filterEl = root.querySelector('#tableFilter');

    function draw() {
      const rows = s.raw[root.querySelector('#tableSelect').value];
      const q = filterEl.value.trim().toLowerCase();
      const filtered = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : rows;
      countEl.textContent = `${fmt(filtered.length)} rows`;
      pagedTable(host, filtered);
    }
    root.querySelector('#tableSelect').addEventListener('change', (e) => {
      location.hash = '#/tables/' + e.target.value;
    });
    let t;
    filterEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 250); });
    draw();
  };
})();
