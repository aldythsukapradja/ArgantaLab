// Kingdom Command bootstrap: hash router + global search.
(function () {
  const viewEl = document.getElementById('view');
  const crumbEl = document.getElementById('crumb');

  const ROUTES = {
    overview: { title: 'Overview', fn: () => Views.overview },
    lab: { title: 'Character Lab', fn: () => Views.lab },
    model: { title: 'Data Model', fn: () => Views.model },
    world: { title: 'World Explorer', fn: () => Views.world },
    monsters: { title: 'Monster Codex', fn: () => Views.monsters },
    items: { title: 'Items & Drops', fn: () => Views.items },
    skills: { title: 'Skills', fn: () => Views.skills },
    assets: { title: 'Asset Vault', fn: () => Views.assets },
    charvault: { title: 'Char Vault', fn: () => Views.charvault },
    mounts: { title: 'Mounts', fn: () => Views.mounts },
    effects: { title: 'Spell Effects', fn: () => Views.effects },
    audit: { title: 'Audit & Links', fn: () => Views.audit },
    tables: { title: 'Raw Tables', fn: () => Views.tables }
  };

  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || 'overview';
    const [name, ...params] = hash.split('/');
    const r = ROUTES[name] || ROUTES.overview;
    document.querySelectorAll('.nav-btn, .mobilebar a').forEach((b) =>
      b.classList.toggle('active', b.dataset.route === (ROUTES[name] ? name : 'overview'))
    );
    crumbEl.innerHTML = `Kingdom Command&nbsp;&nbsp;/&nbsp;&nbsp;<b>${r.title}</b>${
      params[0] ? `&nbsp;&nbsp;/&nbsp;&nbsp;${UI.esc(decodeURIComponent(params[0]))}` : ''
    }`;
    viewEl.scrollTop = 0;
    r.fn()(viewEl, params.map(decodeURIComponent));
  }

  // ---- global search ----
  const searchEl = document.getElementById('globalSearch');
  const resultsEl = document.getElementById('searchResults');
  const ROUTE_BY_KIND = { monster: 'monsters', item: 'items', map: 'world', skill: 'skills' };

  function renderResults() {
    const hits = Store.search(searchEl.value);
    if (!hits.length) {
      resultsEl.hidden = true;
      return;
    }
    resultsEl.innerHTML = hits
      .map(
        (h, i) => `
      <button class="sr-row" data-i="${i}">
        <span class="sr-kind">${h.kind}</span>
        ${h.img ? `<img src="${UI.esc(UI.asset(h.img))}" loading="lazy">` : '<span style="width:26px"></span>'}
        <b>${UI.esc(h.name)}</b>
        <small>${UI.esc(h.sub || '')}</small>
      </button>`
      )
      .join('');
    resultsEl.hidden = false;
    resultsEl.querySelectorAll('.sr-row').forEach((row) => {
      row.addEventListener('click', () => {
        const h = hits[Number(row.dataset.i)];
        const base = ROUTE_BY_KIND[h.kind];
        location.hash = h.kind === 'skill'
          ? `#/skills/${(Store.S.skills[h.id]?.path || 'warrior').toLowerCase()}`
          : `#/${base}/${h.id}`;
        resultsEl.hidden = true;
        searchEl.value = '';
      });
    });
  }
  let t;
  searchEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderResults, 180); });
  searchEl.addEventListener('focus', renderResults);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) resultsEl.hidden = true;
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchEl.focus();
    }
  });

  document.getElementById('exportOverrides').addEventListener('click', Store.exportOverrides);

  // ---- theme: light by default, dark as opt-in ----
  const THEME_KEY = 'kingdom_theme';
  function applyTheme(mode) {
    document.body.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(THEME_KEY, mode);
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  document.getElementById('themeToggle').addEventListener('click', () => {
    applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
  });

  // ---- collapsible main sidebar ----
  const SIDEBAR_KEY = 'kingdom_sidebar_hidden';
  function applySidebar(hidden) {
    document.body.classList.toggle('sidebar-hidden', hidden);
    localStorage.setItem(SIDEBAR_KEY, hidden ? '1' : '0');
  }
  applySidebar(localStorage.getItem(SIDEBAR_KEY) === '1');
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    applySidebar(!document.body.classList.contains('sidebar-hidden'));
    window.dispatchEvent(new Event('resize')); // let the map viewer re-fit
  });

  viewEl.innerHTML = '<div class="empty">Loading game database…</div>';
  Store.load()
    .then(() => {
      const sum = Store.S.raw.summary;
      document.getElementById('dataStamp').textContent =
        'core layer · ' + (sum?.generatedAt || '').slice(0, 16).replace('T', ' ');
      window.addEventListener('hashchange', route);
      route();
    })
    .catch((err) => {
      viewEl.innerHTML = `<div class="empty">Failed to load data layer: ${UI.esc(err.message)}.<br>
        Run <code>node scripts/build-data.mjs</code> in apps/kingdom first.</div>`;
      console.error(err);
    });
})();
