// ============================================================
//  CIRCLE GAME SDK  — spine that connects every game to the
//  Circle platform (auth, economy, leaderboard, save state).
//
//  MOCK: injected into the HQ builder preview iframe so games
//  work fully standalone. When deployed inside ArgantaLab or
//  KinetikCircle, the parent frame sends CIRCLE_SDK_INIT via
//  postMessage to swap in real Supabase credentials.
// ============================================================

export const CIRCLE_SDK_MOCK = `(function () {
  if (window.CircleGame) return;

  var _s = function (k, v) { try { localStorage.setItem('cg_' + k, JSON.stringify(v)); } catch(e){} };
  var _l = function (k, d) { try { return JSON.parse(localStorage.getItem('cg_' + k) || 'null') ?? d; } catch(e) { return d; } };
  var _log = function (msg, col) { console.log('%c[CircleGame] ' + msg, 'color:' + col + ';font-weight:600'); };

  window.CircleGame = {
    // ── Identity ────────────────────────────────────────────
    user: _l('user', {
      id: 'guest_' + Math.random().toString(36).slice(2, 9),
      name: 'Player',
      avatar: null,
      diamonds: 500,
      xp: 0,
      level: 1,
    }),

    // ── Boot ────────────────────────────────────────────────
    init: async function () {
      _log('SDK v1 ready (mock mode — real SDK loads inside Circle)', '#6366f1');
      this.emit('ready', { user: this.user });
      return this.user;
    },

    // ── Economy — Diamonds ──────────────────────────────────
    getDiamonds: async function () { return this.user.diamonds; },

    awardDiamonds: async function (amount, reason) {
      this.user.diamonds += amount;
      _s('user', this.user);
      _log('+' + amount + ' 💎  ' + (reason || ''), '#fbbf24');
      this.emit('diamonds_changed', { delta: amount, balance: this.user.diamonds });
      return { balance: this.user.diamonds };
    },

    spendDiamonds: async function (amount) {
      if (this.user.diamonds < amount) return { ok: false, balance: this.user.diamonds };
      this.user.diamonds -= amount;
      _s('user', this.user);
      _log('-' + amount + ' 💎 spent', '#f87171');
      this.emit('diamonds_changed', { delta: -amount, balance: this.user.diamonds });
      return { ok: true, balance: this.user.diamonds };
    },

    // ── Economy — XP & Levels ───────────────────────────────
    getXP: async function () { return { xp: this.user.xp, level: this.user.level }; },

    awardXP: async function (amount, reason) {
      this.user.xp += amount;
      var prev = this.user.level;
      this.user.level = Math.max(1, Math.floor(1 + Math.sqrt(this.user.xp / 100)));
      _s('user', this.user);
      _log('+' + amount + ' XP  level ' + this.user.level, '#10b981');
      if (this.user.level > prev) this.emit('level_up', { level: this.user.level });
      this.emit('xp_changed', { delta: amount, total: this.user.xp, level: this.user.level });
      return { xp: this.user.xp, level: this.user.level, leveledUp: this.user.level > prev };
    },

    // ── Leaderboard ─────────────────────────────────────────
    submitScore: async function (score, meta) {
      var board = _l('board', []);
      var entry = Object.assign({ id: this.user.id, name: this.user.name, score: score, at: Date.now() }, meta || {});
      var idx = board.findIndex(function(e){ return e.id === entry.id; });
      var isHigh = idx < 0 || score > board[idx].score;
      if (idx >= 0) { if (isHigh) board[idx] = entry; }
      else board.push(entry);
      board.sort(function(a,b){ return b.score - a.score; });
      _s('board', board.slice(0, 1000));
      var rank = board.findIndex(function(e){ return e.id === entry.id; }) + 1;
      if (isHigh) {
        _log('NEW HIGH SCORE: ' + score + ' (rank #' + rank + ')', '#a855f7');
        var bonus = Math.max(5, Math.floor(score / 100) * 2);
        await this.awardDiamonds(bonus, 'High Score Bonus');
        this.emit('high_score', { score: score, rank: rank, diamonds: bonus });
      }
      return { rank: rank, isHighScore: isHigh, entry: entry };
    },

    getLeaderboard: async function (limit) {
      var board = _l('board', []);
      return board.slice(0, limit || 10).map(function(e, i){ return Object.assign({}, e, { rank: i + 1 }); });
    },

    getMyRank: async function () {
      var board = _l('board', []);
      var uid = this.user.id;
      var idx = board.findIndex(function(e){ return e.id === uid; });
      return idx >= 0 ? { rank: idx + 1, score: board[idx].score } : null;
    },

    // ── Persist (per-game save slots) ───────────────────────
    saveState: async function (key, value) {
      _s('gs_' + key, value);
      return true;
    },

    loadState: async function (key) {
      return _l('gs_' + key, null);
    },

    // ── Unlockables / Shop ──────────────────────────────────
    getUnlocks: async function () { return _l('unlocks', []); },

    isUnlocked: async function (itemId) {
      return _l('unlocks', []).includes(itemId);
    },

    unlock: async function (itemId, diamondCost) {
      if (diamondCost > 0) {
        var res = await this.spendDiamonds(diamondCost);
        if (!res.ok) return { ok: false, reason: 'insufficient_diamonds', balance: res.balance };
      }
      var unlocks = _l('unlocks', []);
      if (!unlocks.includes(itemId)) { unlocks.push(itemId); _s('unlocks', unlocks); }
      _log('Unlocked: ' + itemId, '#6366f1');
      this.emit('unlock', { itemId: itemId });
      return { ok: true };
    },

    // ── Session Analytics ───────────────────────────────────
    startSession: async function () {
      this._t0 = Date.now();
      this._sid = Math.random().toString(36).slice(2);
      _log('Session started', '#6366f1');
      return this._sid;
    },

    endSession: async function (finalScore, completionPct) {
      var dur = Math.round((Date.now() - (this._t0 || Date.now())) / 1000);
      _log('Session ended — ' + dur + 's, score:' + finalScore + ', done:' + completionPct + '%', '#6366f1');
      this.emit('session_end', { duration: dur, score: finalScore, completion: completionPct });
      return { duration: dur, score: finalScore, completion: completionPct };
    },

    // ── Social / Profile ─────────────────────────────────────
    getProfile: async function () { return Object.assign({}, this.user); },

    setDisplayName: async function (name) {
      this.user.name = name;
      _s('user', this.user);
      return true;
    },

    // ── Event Bus ───────────────────────────────────────────
    _listeners: {},
    on: function (event, cb) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(cb);
    },
    off: function (event, cb) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(function(f){ return f !== cb; });
    },
    emit: function (event, data) {
      var fns = this._listeners[event] || [];
      fns.forEach(function(fn){ try { fn(data); } catch(e){} });
      try { window.parent.postMessage({ type: 'CIRCLE_GAME_EVENT', event: event, data: data }, '*'); } catch(e){}
    },
  };

  // Receive real credentials from parent frame (ArgantaLab / KinetikCircle)
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'CIRCLE_SDK_INIT') return;
    var p = e.data.payload || {};
    if (p.user) window.CircleGame.user = p.user;
    // In production: attach real Supabase client using p.url + p.anonKey + p.accessToken
    _log('Real credentials received from Circle host', '#10b981');
  });
})();`

// TypeScript type for the SDK (consumed inside games)
export const CIRCLE_SDK_TYPES = `
interface CircleUser {
  id: string;
  name: string;
  avatar: string | null;
  diamonds: number;
  xp: number;
  level: number;
}

interface CircleLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  at: number;
  [key: string]: unknown;
}

interface CircleGame {
  user: CircleUser;
  init(): Promise<CircleUser>;
  getDiamonds(): Promise<number>;
  awardDiamonds(amount: number, reason?: string): Promise<{ balance: number }>;
  spendDiamonds(amount: number): Promise<{ ok: boolean; balance: number }>;
  getXP(): Promise<{ xp: number; level: number }>;
  awardXP(amount: number, reason?: string): Promise<{ xp: number; level: number; leveledUp: boolean }>;
  submitScore(score: number, metadata?: Record<string, unknown>): Promise<{ rank: number; isHighScore: boolean }>;
  getLeaderboard(limit?: number): Promise<CircleLeaderboardEntry[]>;
  getMyRank(): Promise<{ rank: number; score: number } | null>;
  saveState(key: string, value: unknown): Promise<boolean>;
  loadState(key: string): Promise<unknown>;
  getUnlocks(): Promise<string[]>;
  isUnlocked(itemId: string): Promise<boolean>;
  unlock(itemId: string, diamondCost?: number): Promise<{ ok: boolean; reason?: string }>;
  startSession(): Promise<string>;
  endSession(finalScore: number, completionPct: number): Promise<{ duration: number }>;
  getProfile(): Promise<CircleUser>;
  setDisplayName(name: string): Promise<boolean>;
  on(event: string, cb: (data: unknown) => void): void;
  off(event: string, cb: (data: unknown) => void): void;
  emit(event: string, data?: unknown): void;
}

declare global {
  interface Window { CircleGame: CircleGame; }
}
`
