// Fountain Festival — Puzzle / Events (IMPL §3.3).
// Loop: small match-3 board with a target → swap to clear (juicy pops) → event
// tokens + a shared festival meter → the circle fills the meter toward a
// cosmetic. Board mode freezes walking; PRIMARY is a limited Booster.

const N = 6;                       // 6x6 board
const GEMS = ['🌸', '🍋', '💧', '⭐', '🍀'];
const rand = () => (Math.random() * GEMS.length) | 0;

export function createFestivalModule(api) {
  const s = {
    grid: Array.from({ length: N * N }, rand),
    sel: -1,
    boosters: 3, shuffles: 1,
    cleared: 0, target: 30, tokens: 0,
    busy: false,
  };
  // guarantee no pre-made matches at start
  while (findMatches(s.grid).size) collapse(s.grid, findMatches(s.grid));

  function adjacent(a, b) {
    const ra = (a / N) | 0, ca = a % N, rb = (b / N) | 0, cb = b % N;
    return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
  }

  function award(count) {
    s.cleared += count; s.tokens += count;
    api.grant({ tokens: count, score: count * 2 }, { source: 'match', meterGain: count >= 4 ? 1 : 0 });
    if (s.cleared >= s.target) { s.cleared = 0; s.target += 6; api.flash('Festival meter up! 🎉'); }
  }

  function resolve() {
    let matches = findMatches(s.grid);
    let total = 0;
    while (matches.size) {
      total += matches.size;
      collapse(s.grid, matches);
      matches = findMatches(s.grid);
    }
    if (total) award(total);
    api.bumpHud();
  }

  function tap(idx) {
    if (s.busy) return;
    if (s.sel < 0) { s.sel = idx; api.bumpHud(); return; }
    if (s.sel === idx) { s.sel = -1; api.bumpHud(); return; }
    if (!adjacent(s.sel, idx)) { s.sel = idx; api.bumpHud(); return; }
    const a = s.sel, b = idx; s.sel = -1;
    const g = s.grid; const tmp = g[a]; g[a] = g[b]; g[b] = tmp;
    if (findMatches(g).size) { resolve(); }
    else { const t2 = g[a]; g[a] = g[b]; g[b] = t2; api.flash('No match'); api.bumpHud(); }
  }

  function booster() {
    if (s.boosters <= 0) return;
    s.boosters--;
    const color = rand();
    const hits = [];
    s.grid.forEach((c, i) => { if (c === color) hits.push(i); });
    if (hits.length) { collapse(s.grid, new Set(hits)); award(hits.length); }
    else { resolve(); }
    api.flash(`Booster! cleared ${GEMS[color]}`);
    api.bumpHud();
  }

  function shuffle() {
    if (s.shuffles <= 0) return;
    s.shuffles--;
    for (let i = s.grid.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = s.grid[i]; s.grid[i] = s.grid[j]; s.grid[j] = t; }
    resolve();
    api.flash('Shuffled');
  }

  return {
    kind: 'festival', movement: false, _s: s,
    tap,
    tick() {},
    onAction(id) {
      if (id === 'primary') booster();
      else if (id === 'shuffle') shuffle();
      else if (id === 'hint') api.flash('Match 3+ of the same gem');
      else if (id === 'menu') api.exit();
    },
    controller() {
      return {
        primary: { id: 'primary', label: `Booster ${s.boosters}`, icon: '✨', kind: 'primary', disabledReason: s.boosters <= 0 ? 'No boosters left' : '' },
        ring: [
          { id: 'shuffle', label: 'Shuffle', icon: '🔀', kind: 'tool', disabledReason: s.shuffles <= 0 ? 'Used' : '' },
          { id: 'hint', label: 'Hint', icon: '💡', kind: 'utility' },
          { id: 'menu', label: 'Exit', icon: '↩', kind: 'utility' },
        ],
      };
    },
    hud() {
      const m = api.getMeter();
      return { objective: `Clear gems · ${s.cleared}/${s.target}`, meter: { value: m.value, max: 8, label: `Festival Lv ${(m.stage || 0) + 1} · ${s.tokens} tokens` } };
    },
    Overlay: FestivalOverlay,
    cleanup() {},
  };
}

// ---- match-3 core ----
function findMatches(grid) {
  const set = new Set();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N - 2; c++) {
      const i = r * N + c, v = grid[i];
      if (v != null && grid[i + 1] === v && grid[i + 2] === v) { set.add(i); set.add(i + 1); set.add(i + 2); }
    }
  }
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N - 2; r++) {
      const i = r * N + c, v = grid[i];
      if (v != null && grid[i + N] === v && grid[i + 2 * N] === v) { set.add(i); set.add(i + N); set.add(i + 2 * N); }
    }
  }
  return set;
}
function collapse(grid, cleared) {
  cleared.forEach((i) => { grid[i] = null; });
  for (let c = 0; c < N; c++) {
    let write = N - 1;
    for (let r = N - 1; r >= 0; r--) { const i = r * N + c; if (grid[i] != null) { grid[write * N + c] = grid[i]; if (write !== r) grid[r * N + c] = null; write--; } }
    for (let r = write; r >= 0; r--) grid[r * N + c] = rand();
  }
}

function FestivalOverlay({ mod }) {
  const s = mod?._s; if (!s) return null;
  return (
    <div className="festival-overlay">
      <div className="festival-board" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {s.grid.map((g, i) => (
          <button key={i} type="button" className={'fg-cell' + (s.sel === i ? ' sel' : '')} onClick={() => mod.tap(i)}>
            {GEMS[g] || ''}
          </button>
        ))}
      </div>
    </div>
  );
}
