// Renderer-agnostic farm mechanics + state (no canvas, no Pixi). FarmRoom drives
// the render; this owns the rules and persistence. Kept from the verified v1
// engine so the whole loop (till/plant/water/grow/harvest/sell, livestock, Kin
// automation) is unchanged — only the renderer swapped to Kingdom's canvas-2D.
import { CROPS, SEASONS, DAYS_PER_SEASON, cropIsRipe } from '../data/crops.js';
import { killReward, killXp, pathMaxHp, pathMaxMp, pathOf, pathForWeapon, pathTitle, levelWithFloor, levelProgress, xpForLevel, weaponOf, armorOf, weaponAtk, armorDef, armorHp, monsterOf, REWARD_TUNING } from '@arganta/combat';
import { SPECIES, STARTER_LIVESTOCK, GOODS_MS, animalGoodReady } from '../data/livestock.js';
import { STARTER_KINS } from '../data/kins.js';
import { FIELD, tileKey } from './farm-map.js';
import { loadFarmState, saveFarmState, loadMemberFarmState } from './farm-save.js';
import { sfx } from '../audio/sfx.js';

// The FarmVille loop: 🌸 Bloom is the play currency — seeds/feed COST Bloom, and
// ANY in-game action (harvest, sell, defeat a monster, mine, chop) EARNS Bloom,
// so you reinvest and grow. Everyone (kids too) earns + spends Bloom freely.
// 🪵 Wood + 🪨 Stone are gathering MATERIALS (forest/mining — for upgrades later).
// 💎 Diamonds stay the separate learning/cosmetic currency the farm never touches.
// The operator gets everything free (see isOperator()).
export const STARTING_BLOOM = 120; // enough to plant the first few beds

// Max Kin a single user can deploy onto the farm at once (per-user loadout cap).
export const MAX_DEPLOYED_KINS = 6;

// Daily quests — reset each calendar day; the retention spine. goal = target count,
// bloom = claim reward. `mat` (optional) = a bonus material granted via the mech store.
export const QUEST_DEFS = [
  { id: 'harvest', icon: '🌾', label: 'Harvest crops', goal: 10, bloom: 120 },
  { id: 'defeat', icon: '⚔', label: 'Defeat monsters', goal: 8, bloom: 150, mat: { k: 'token', n: 1 } },
  { id: 'craft', icon: '⚒', label: 'Craft or upgrade', goal: 1, bloom: 100, mat: { k: 'gem', n: 1 } },
];
const todayKey = () => new Date().toISOString().slice(0, 10);
const yesterdayKey = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

const defaultSeeds = () => Object.fromEntries(Object.keys(CROPS).map((id) => [id, id === 'turnip' ? 3 : 0]));
const starterKinArt = {
  kin_sprig: { kinKey: 'kin:sproutling', render: 'sproutling', assetKey: 'kin.sproutling', color: '#a78bfa' },
  kin_pip: { kinKey: 'kin:pixelslime', render: 'pixelslime', assetKey: 'kin.pixelslime', color: '#22c55e' },
  kin_bramble: { kinKey: 'kin:storyfox', render: 'storyfox', assetKey: 'kin.storyfox', color: '#6366f1' },
};
const profileProgress = (profile) => ({
  diamonds: profile?.diamonds ?? 0,
  xp: profile?.xp ?? 0,
});

// Every DELIBERATE public action that mutates the farm or spends a resource.
// Neutered on the instance (own-property override, see the constructor) when
// viewerRole === 'visitor' — a belt-and-suspenders safety net alongside the UI
// simply never offering these actions in visit mode. save()/saveNow() are
// separately blocked via the existing `frozen` flag. setPath is deliberately
// EXCLUDED: it's an automatic background sync from the viewer's own equipped
// hero weapon (cosmetic HP/MP-curve display only, no farm mutation), not a
// player-initiated action.
const VISITOR_LOCKED_ACTIONS = [
  'setTool', 'setSeed', 'spendStamina', 'restoreStamina', 'claimQuest',
  'tapAt', 'harvestTile', 'removeCrop', 'plantAt', 'harvestAll', 'plantAll',
  'buySeed', 'sellAll', 'feedAnimal', 'petAnimal', 'collectAnimal', 'tapAnimal',
  'assignKin', 'setKinDeployed', 'sleep',
];
// Automatic/background housekeeping calls — silently no-op (no flash; nobody
// deliberately triggered these, so a toast would just be noise on page load).
const VISITOR_LOCKED_SILENT = ['sweepStalePlots'];

export class FarmLogic {
  // circleId (optional): when the game is embedded inside a KinetikCircle
  // circle, every member of that circle shares ONE farm save — keyed by the
  // circle, not the individual account. Falls back to a per-profile save
  // standalone (no circle context). Local-only for now (see the Tier-2 note in
  // memory: real cross-device shared farm needs the lashira_farm Supabase
  // tables + realtime sync — this is the "same device, same circle" tier).
  //
  // opts.visitOwnerId (optional): VISIT MODE — read-only view of another
  // circle member's PERSONAL farm (never the shared circle farm; that's
  // already open to everyone). Always circle-independent, loaded via the
  // server-gated load_member_farm_state() RPC, and this instance can never
  // mutate or persist (see VISITOR_LOCKED_METHODS + the `frozen` flag below).
  constructor(profile, circleId = null, opts = {}) {
    this.profile = profile;
    this.circleId = circleId;
    this.visitOwnerId = opts.visitOwnerId || null;
    this.visitOwnerName = opts.visitOwnerName || null; // for the HUD/banner — this.profile stays the VIEWER's own
    this.viewerRole = this.visitOwnerId ? 'visitor' : 'owner';
    this.listeners = new Set();
    this.toast = null;
    this.rewards = []; // transient reward pills (Diamonds/XP/produce) for the HUD
    this._rid = 0;
    // Class path (warrior/rogue/poet/mage) — drives HP/MP curves. Derived from the
    // hero's weapon by FarmRoom (setPath); defaults to warrior until the hero loads.
    this.path = pathForWeapon(profile?.weapon) || 'warrior';
    this.externalKins = [];
    this.externalKinsLoaded = false;
    // Kin loadout = which Kin ids this USER deploys onto the farm (max 6).
    // Per-user (NOT part of the shared circle save) so each member picks their
    // own squad; persisted to localStorage and mirrored to peers via presence.
    this.kinLoadoutKey = 'lashira_kinloadout_' + (profile?.id || 'guest');
    this.kinLoadout = this._loadKinLoadout();
    // Realtime sync hooks. Every LOCAL mutation emits a tiny granular intent
    // through intentSink (wired to the circle channel by FarmRoom); remote
    // intents arrive via applyIntent and are applied WITHOUT re-emitting.
    // `rev` is a monotonic mutation counter used to gate whole-state snapshots
    // (late joiners) and to reconcile cloud vs local saves — never wall clocks.
    this.intentSink = null;
    this.frozen = this.viewerRole === 'visitor'; // visitors never persist — see save()/saveNow() below
    this.saveKey = this.visitOwnerId
      ? null // a visited farm has no local cache of its own — nothing to fall back to
      : circleId
        ? 'lashirabloom_save_v2_circle_' + circleId
        : 'lashirabloom_save_v2_' + (profile?.id || 'guest');
    this.state = this._default();
    this.saveSource = 'initializing';
    this.ready = this._load();
    if (this.viewerRole === 'visitor') {
      // Own-property override shadows the prototype method for THIS instance
      // only — the owner's own FarmLogic is completely unaffected.
      for (const m of VISITOR_LOCKED_ACTIONS) {
        this[m] = () => { this.flash('👁 Visiting — only the owner can act here'); return null; };
      }
      for (const m of VISITOR_LOCKED_SILENT) this[m] = () => null;
    }
  }

  _default() {
    return {
      rev: 0,
      day: 1, season: 0,
      // Diamonds is the ONE currency (no separate farm currency). Local mutable
      // copies seeded from the real profile so selling/buying feels instant;
      // NOT yet synced back to Supabase — that's a follow-up RPC, same honest
      // scaffolding pattern as the rest of this build.
      // 🌸 Bloom = play currency (all in-game actions earn it). 🪵🪨 = gathering
      // materials (0 until you chop/mine). 💎 Diamonds = learning/cosmetic (farm
      // never touches them).
      bloom: STARTING_BLOOM,
      wood: 0,
      stone: 0,
      diamonds: this.profile?.diamonds ?? 0,
      xp: this.profile?.xp ?? 0,
      stamina: 40, maxStamina: 40,
      tool: 'hoe', selectedSeed: 'turnip',
      seeds: defaultSeeds(),
      produce: {},
      plots: {},
      livestock: STARTER_LIVESTOCK.map((a) => ({ ...a })),
      kins: STARTER_KINS.map((k) => ({ ...k })),
      kinTasks: {},
      // combat gear — the power axis beyond level. Crafted up at the Forge.
      weaponTier: 1,
      armorTier: 1,
      // daily quests + login streak (retention).
      quests: { date: todayKey(), harvest: 0, defeat: 0, craft: 0, claimed: {} },
      streak: { last: null, count: 0 },
    };
  }
  // Load BOTH the cloud save and the local fallback and keep the most advanced
  // one (highest rev, then furthest calendar). This heals the split-brain where
  // one failed cloud write left real progress stranded in localStorage while the
  // cloud (and therefore every other device) stayed behind — if the local copy
  // wins, it is pushed back to the cloud immediately.
  async _load() {
    if (this.viewerRole === 'visitor') return this._loadVisit();
    let cloud = null;
    let cloudOk = false;
    try {
      const loaded = await loadFarmState({ profile: this.profile, circleId: this.circleId });
      cloud = loaded?.data || null;
      cloudOk = true;
      this.saveSource = loaded?.source || 'fresh';
    } catch (err) {
      console.warn('[farm] cloud load failed, trying local fallback:', err?.message || err);
      this.saveSource = 'local-fallback-after-cloud-error';
    }
    let local = null;
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) local = JSON.parse(raw);
    } catch { /* corrupt local — ignore */ }

    const revOf = (d) => Number(d?.rev) || 0;
    const absOf = (d) => (Number(d?.season) || 0) * DAYS_PER_SEASON + (Number(d?.day) || 1);
    let winner = cloud;
    let fromLocal = false;
    if (local && (!cloud || revOf(local) > revOf(cloud) || (revOf(local) === revOf(cloud) && absOf(local) > absOf(cloud)))) {
      winner = local;
      fromLocal = true;
    }
    if (winner) {
      const base = this._default();
      this.state = {
        ...base,
        ...winner,
        ...profileProgress(this.profile),
        seeds: { ...base.seeds, ...(winner.seeds || {}) },
        produce: { ...base.produce, ...(winner.produce || {}) },
        plots: { ...base.plots, ...(winner.plots || {}) },
        livestock: winner.livestock || base.livestock,
        kins: winner.kins || base.kins,
        kinTasks: { ...base.kinTasks, ...(winner.kinTasks || {}) },
      };
    }
    if (fromLocal && cloudOk) {
      this.saveSource = 'local-ahead-reconciling';
      this.saveNow(); // push the stranded local progress up so every device converges
    }
  }
  // VISIT MODE: one-shot read-only load of another member's personal farm via
  // the server-gated load_member_farm_state() RPC. No local fallback (nothing
  // to fall back to for a farm that isn't yours), no reconcile-and-push-back —
  // this instance never writes. Keeps the OWNER's diamonds/xp/etc as saved
  // (deliberately skips profileProgress(this.profile), which would overlay the
  // VIEWER's own numbers onto someone else's farm).
  async _loadVisit() {
    try {
      const loaded = await loadMemberFarmState({ ownerId: this.visitOwnerId });
      const data = loaded?.data || null;
      this.saveSource = data ? 'visit-cloud' : 'visit-cloud-empty';
      if (data) {
        const base = this._default();
        this.state = {
          ...base,
          ...data,
          seeds: { ...base.seeds, ...(data.seeds || {}) },
          produce: { ...base.produce, ...(data.produce || {}) },
          plots: { ...base.plots, ...(data.plots || {}) },
          livestock: data.livestock || base.livestock,
          kins: data.kins || base.kins,
          kinTasks: { ...base.kinTasks, ...(data.kinTasks || {}) },
        };
      }
    } catch (err) {
      console.warn('[farm] visit load failed:', err?.message || err);
      this.saveSource = 'visit-error';
    }
  }
  _bump() { this.state.rev = (Number(this.state.rev) || 0) + 1; }
  _intent(obj) { try { this.intentSink?.(obj); } catch { /* sync is best-effort */ } }
  _absDay(d = this.state) { return (Number(d?.season) || 0) * DAYS_PER_SEASON + (Number(d?.day) || 1); }
  freeze() { this.frozen = true; clearTimeout(this._saveTimer); }
  // Marks a calendar change so EVERY circle member's UI shows the same New Day
  // splash — the sleeper, peers receiving the day intent, and late joiners
  // adopting a further-along snapshot.
  _dayEvent() {
    this.dayEvent = { day: this.state.day, season: SEASONS[this.state.season], at: Date.now() };
  }

  // Whole-state adoption — ONLY for late-joiner snapshots. The CALENDAR is the
  // primary freshness signal (two windows with divergent histories can carry
  // incomparable rev counters — e.g. many Day-1 actions vs few Day-4 actions —
  // so day-first ordering is what actually converges them); rev only breaks
  // same-day ties. Personal fields (tool, seed selection, stamina, diamonds/xp)
  // always stay local.
  applySnapshot(data, rev = 0) {
    if (!data || typeof data !== 'object') return false;
    const remoteRev = Number(rev) || 0;
    const localRev = Number(this.state.rev) || 0;
    const remoteAbs = this._absDay(data);
    const localAbs = this._absDay(this.state);
    const remoteFresher = remoteAbs > localAbs || (remoteAbs === localAbs && remoteRev > localRev);
    if (!remoteFresher) return false;
    const base = this._default();
    const local = this.state;
    const dayChanged = remoteAbs !== localAbs;
    this.state = {
      ...base,
      ...local,
      ...data,
      day: data.day, season: data.season,
      rev: Math.max(remoteRev, localRev),
      ...profileProgress(this.profile),
      tool: local.tool,
      selectedSeed: local.selectedSeed,
      stamina: local.stamina,
      maxStamina: local.maxStamina,
      bloom: local.bloom ?? base.bloom, // per-player wallet — never adopted from a peer
      wood: local.wood ?? base.wood,
      stone: local.stone ?? base.stone,
      weaponTier: local.weaponTier ?? base.weaponTier, // personal gear — never from a peer
      armorTier: local.armorTier ?? base.armorTier,
      quests: local.quests ?? base.quests, // personal daily progress
      streak: local.streak ?? base.streak,
      seeds: { ...base.seeds, ...(data.seeds || {}) },
      produce: { ...base.produce, ...(data.produce || {}) },
      plots: { ...base.plots, ...(data.plots || {}) },
      livestock: data.livestock || local.livestock || base.livestock,
      kins: data.kins || local.kins || base.kins,
      kinTasks: { ...base.kinTasks, ...(data.kinTasks || {}) },
    };
    if (dayChanged) this._dayEvent();
    this.save();
    this.emit();
    return true;
  }

  // Apply a peer's granular change. Field-level, so concurrent actions on
  // different plots/animals can never wipe each other out (the failure mode of
  // whole-state last-writer-wins). Never re-emits an intent.
  applyIntent(intent) {
    if (!intent || typeof intent !== 'object') return;
    const st = this.state;
    switch (intent.t) {
      case 'plot': {
        if (!intent.key || !intent.plot) return;
        st.plots[intent.key] = { ...intent.plot };
        break;
      }
      case 'stock': {
        // Absolute per-key counts (merge), or full replace after a sell-all.
        if (intent.seedsReplace) st.seeds = { ...intent.seedsReplace };
        else if (intent.seeds) st.seeds = { ...st.seeds, ...intent.seeds };
        if (intent.produceReplace) st.produce = { ...intent.produceReplace };
        else if (intent.produce) st.produce = { ...st.produce, ...intent.produce };
        break;
      }
      case 'livestock': {
        if (Array.isArray(intent.livestock)) st.livestock = intent.livestock.map((a) => ({ ...a }));
        break;
      }
      case 'kin-task': {
        if (!intent.kinId) return;
        st.kinTasks = { ...(st.kinTasks || {}), [intent.kinId]: intent.task ?? null };
        const k = st.kins.find((x) => x.id === intent.kinId);
        if (k) k.task = intent.task ?? null;
        break;
      }
      case 'day': {
        // Monotonic by construction — only ever adopt a FURTHER calendar.
        if (this._absDay(intent) <= this._absDay(st)) return;
        st.day = intent.day; st.season = intent.season;
        if (intent.plots) st.plots = { ...intent.plots };
        if (Array.isArray(intent.livestock)) st.livestock = intent.livestock.map((a) => ({ ...a }));
        st.stamina = pathMaxMp(this.path || 'warrior', this._level()); // wake up with the level+path MP pool
        this._dayEvent(); // every circle member sees the same New Day splash
        break;
      }
      default: return;
    }
    this._bump();
    this.save();
    this.emit();
  }
  serialize() {
    return {
      rev: Number(this.state.rev) || 0,
      day: this.state.day,
      season: this.state.season,
      bloom: this.state.bloom,
      wood: this.state.wood,
      stone: this.state.stone,
      diamonds: this.state.diamonds,
      xp: this.state.xp,
      stamina: this.state.stamina,
      maxStamina: this.state.maxStamina,
      tool: this.state.tool,
      selectedSeed: this.state.selectedSeed,
      seeds: { ...this.state.seeds },
      produce: { ...this.state.produce },
      plots: { ...this.state.plots },
      livestock: this.state.livestock.map((a) => ({ ...a })),
      kins: this.state.kins.map((k) => ({ ...k })),
      kinTasks: { ...(this.state.kinTasks || {}) },
    };
  }
  setExternalKins(kins) {
    this.externalKins = Array.isArray(kins) ? kins.map((k) => ({ ...k })) : [];
    this.externalKinsLoaded = true;
    this.emit();
  }
  // Full Kin roster available to this user (external circle roster if loaded,
  // else the starter squad), with per-Kin task merged in. NOT filtered by loadout.
  kinRoster() {
    let list;
    if (this.externalKinsLoaded) {
      const tasks = this.state.kinTasks || {};
      list = this.externalKins.map((k) => ({
        ...k,
        task: Object.prototype.hasOwnProperty.call(tasks, k.id) ? tasks[k.id] : (k.task ?? null),
      }));
    } else {
      list = this.state.kins.map((k) => ({ ...(starterKinArt[k.id] || {}), ...k, ...(k.render ? {} : starterKinArt[k.id] || {}) }));
    }
    const deployed = this._deployedIds(list);
    return list.map((k) => ({ ...k, deployed: deployed.has(k.id) }));
  }
  // The Kins actually deployed onto the farm (max MAX_DEPLOYED_KINS). Drives the
  // renderer, snapshots, and the Settings "Active Kin" card.
  activeKins() {
    const list = this.kinRoster();
    return list.filter((k) => k.deployed);
  }
  // Resolve the effective deployed-id set. If the user has never chosen a loadout
  // (null), auto-deploy the first MAX_DEPLOYED_KINS so the farm is never empty.
  _deployedIds(list) {
    const ids = list.map((k) => k.id);
    if (!Array.isArray(this.kinLoadout)) return new Set(ids.slice(0, MAX_DEPLOYED_KINS));
    const chosen = this.kinLoadout.filter((id) => ids.includes(id)).slice(0, MAX_DEPLOYED_KINS);
    return new Set(chosen);
  }
  _loadKinLoadout() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(this.kinLoadoutKey);
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr : null;
    } catch { return null; }
  }
  _saveKinLoadout() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this.kinLoadoutKey, JSON.stringify(this.kinLoadout || []));
    } catch {}
  }
  // Toggle whether a Kin is deployed. Enforces the MAX_DEPLOYED_KINS cap (adding
  // past the cap is a no-op with a toast). Persists per-user + re-emits so the
  // renderer redeploys and presence rebroadcasts this user's owner-simulated Kins.
  setKinDeployed(kinId, on) {
    const roster = this.externalKinsLoaded ? this.externalKins : this.state.kins;
    if (!roster.some((k) => k.id === kinId)) return;
    // Materialize the current effective loadout so the first toggle is explicit.
    const current = Array.from(this._deployedIds(roster.map((k) => ({ id: k.id }))));
    let next;
    if (on) {
      if (current.includes(kinId)) return;
      if (current.length >= MAX_DEPLOYED_KINS) { this.flash(`Only ${MAX_DEPLOYED_KINS} Kin can be deployed`); return; }
      next = [...current, kinId];
    } else {
      if (!current.includes(kinId)) return;
      next = current.filter((id) => id !== kinId);
    }
    this.kinLoadout = next;
    this._saveKinLoadout();
    this.emit();
  }
  save() {
    if (this.frozen) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flushSave(), 200);
  }
  saveNow() {
    if (this.frozen) return;
    clearTimeout(this._saveTimer);
    return this.flushSave();
  }
  async flushSave() {
    if (this.frozen) return;
    clearTimeout(this._saveTimer);
    const payload = this.serialize();
    try {
      const res = await saveFarmState({ profile: this.profile, circleId: this.circleId, data: payload });
      this.saveSource = res?.source || this.saveSource;
    } catch (err) {
      console.warn('[farm] cloud save failed, keeping a local fallback:', err?.message || err);
      try { localStorage.setItem(this.saveKey, JSON.stringify(payload)); } catch { /* quota */ }
      this.saveSource = 'local-fallback-after-cloud-error';
    }
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  snapshot() {
    const st = this.state;
    const operator = this.isOperator();
    const level = this._level();
    // HP + MP scale with level AND path (warrior tanky … mage caster).
    const path = this.path || 'warrior';
    const maxMp = pathMaxMp(path, level);
    const wTier = st.weaponTier || 1, aTier = st.armorTier || 1;
    // armor adds a flat HP bonus on top of the path/level pool.
    const maxHp = pathMaxHp(path, level) + armorHp(aTier);
    return {
      day: st.day, season: SEASONS[st.season],
      stamina: operator ? maxMp : Math.min(st.stamina, maxMp), maxStamina: maxMp,
      maxHp, path, pathName: pathOf(path).name, pathIcon: pathOf(path).icon,
      title: pathTitle(path, level), // level title shown in the card (replaces the class word)
      xpPct: Math.round(levelProgress(st.xp) * 100),
      // EXP readout: how far into THIS level, and how much this level needs.
      xpCur: Math.max(0, (Number(st.xp) || 0) - xpForLevel(level)),
      xpReq: level >= 99 ? 0 : (xpForLevel(level + 1) - xpForLevel(level)),
      operator,
      tool: st.tool, selectedSeed: st.selectedSeed,
      seeds: { ...st.seeds }, produce: { ...st.produce },
      livestock: st.livestock.map((a) => ({ ...a })),
      kins: this.activeKins(),
      kinRoster: this.kinRoster(),
      maxKins: MAX_DEPLOYED_KINS,
      bloom: operator ? Infinity : (st.bloom ?? STARTING_BLOOM),
      wood: operator ? Infinity : (st.wood ?? 0),
      stone: operator ? Infinity : (st.stone ?? 0),
      // combat gear — drives ATK (damage) and DEF (mitigation).
      weaponTier: wTier, armorTier: aTier,
      weaponName: weaponOf(wTier).name, armorName: armorOf(aTier).name,
      atk: weaponAtk(wTier), def: armorDef(aTier),
      // daily quests (progress vs QUEST_DEFS goals) + login streak.
      quests: { ...(st.quests || { harvest: 0, defeat: 0, craft: 0, claimed: {} }) },
      streak: st.streak?.count || 0,
      diamonds: st.diamonds,
      xp: st.xp,
      level,
      role: this.profile?.role ?? 'user',
      // Whose farm is this: the visited OWNER's name while visiting, else you.
      name: (this.viewerRole === 'visitor' ? this.visitOwnerName : null) ?? this.profile?.displayName ?? 'Farmer',
      guest: !!this.profile?.guest,
      saveSource: this.saveSource,
      toast: this.toast,
      rewards: this.rewards || [],
      dayEvent: this.dayEvent || null,
      viewerRole: this.viewerRole, // 'owner' | 'visitor' — gates the controller/actions in the UI
      visitOwnerName: this.visitOwnerName,
    };
  }
  flash(msg) { this.toast = msg; this.emit(); clearTimeout(this._tt); this._tt = setTimeout(() => { this.toast = null; this.emit(); }, 1600); }

  inField(tx, ty) { return tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1; }

  setTool(tool) { this.state.tool = tool; this.emit(); }
  setSeed(id) {
    const crop = CROPS[id];
    if (!crop) return;
    this.state.selectedSeed = id;
    this.state.tool = 'seed';
    const owned = this.state.seeds[id] || 0;
    this.flash(owned > 0 ? crop.emoji + ' ' + crop.name + ' selected' : crop.emoji + ' ' + crop.name + ' selected — buy seeds at the Shop');
    this.save();
    this.emit();
  }
  isOperator() { return !!this.profile?.operator; }
  _spend(n) {
    if (this.isOperator()) return true; // operator: unlimited stamina
    if (this.state.stamina < n) { this.flash('Too tired — sleep to restore energy'); return false; }
    this.state.stamina -= n; return true;
  }
  // Battle: skills spend the farm's stamina (chosen over a separate mana pool).
  spendStamina(n) { if (!this._spend(n)) return false; this.save(); this.emit(); return true; }
  isKid() { return this.profile?.role === 'kid'; }
  // Operator (admin) is level 99. Everyone else climbs the shared exponential XP
  // ladder, but NEVER below their account level — so an existing level-50 hero can
  // never regress when the curve changes (the son-protection guarantee).
  _level() {
    if (this.isOperator()) return 99;
    const floor = Number(this.profile?.level) || 1;
    return levelWithFloor(this.state.xp, floor);
  }
  setPath(pathId) { if (pathId && pathOf(pathId)) { this.path = pathId; this.emit(); } }
  // A transient reward pill for the HUD (Diamonds/XP/produce). Auto-expires.
  pushReward(r) {
    this.rewards = [...(this.rewards || []), { id: ++this._rid, at: Date.now(), ...r }].slice(-4);
    this.emit();
    clearTimeout(this._rewardTimer);
    this._rewardTimer = setTimeout(() => { this.rewards = (this.rewards || []).filter((x) => Date.now() - x.at < 1900); this.emit(); }, 2000);
  }
  // Credit 🌸 Bloom (the play currency) + a reward pill. Any in-game action that
  // earns Bloom routes through here.
  earnBloom(n, label = 'Bloom') {
    if (!(n > 0)) return;
    this.state.bloom = (this.state.bloom ?? 0) + n;
    this.pushReward({ icon: '🌸', amount: '+' + n, label, tone: 'bloom' });
  }
  // ---- DAILY QUESTS + login streak ----
  // Roll the day if the calendar date changed: reset progress/claims, bump streak.
  _ensureDaily() {
    if (!this.state.quests) this.state.quests = { date: todayKey(), harvest: 0, defeat: 0, craft: 0, claimed: {} };
    if (!this.state.streak) this.state.streak = { last: null, count: 0 };
    const t = todayKey(), q = this.state.quests, s = this.state.streak;
    if (q.date !== t) { q.date = t; q.harvest = 0; q.defeat = 0; q.craft = 0; q.claimed = {}; }
    if (s.last !== t) { s.count = (s.last === yesterdayKey()) ? (s.count || 0) + 1 : 1; s.last = t; }
  }
  // Mutate a counter WITHOUT save/emit (callers that already save wrap this).
  _bumpQuest(key, n = 1) { this._ensureDaily(); this.state.quests[key] = (this.state.quests[key] || 0) + n; }
  // Standalone craft tick (called by the mech store after a craft/upgrade/refine).
  questCraftTick() { this._bumpQuest('craft'); this.save(); this.emit(); }
  // Claim a completed, unclaimed quest → Bloom + (optional) a bonus material the
  // caller grants via the mech store. Returns the mat descriptor or null.
  claimQuest(id) {
    this._ensureDaily();
    const def = QUEST_DEFS.find((d) => d.id === id); if (!def) return null;
    const q = this.state.quests;
    if (q.claimed[id] || (q[id] || 0) < def.goal) return null;
    q.claimed[id] = true;
    this.earnBloom(def.bloom, 'Quest · ' + def.label);
    sfx.play('quest');
    this.save(); this.emit();
    return def.mat || null;
  }

  // Restore stamina/MP (clamped to the level+path pool) — used by cooked potions.
  restoreStamina(n) {
    const max = pathMaxMp(this.path || 'warrior', this._level());
    this.state.stamina = Math.min(max, (Number(this.state.stamina) || 0) + (Number(n) || 0));
    this.save(); this.emit();
  }
  // Battle: a monster kill earns 🌸 Bloom for EVERYONE (kids too). ADULTS also gain
  // XP; kids never gain play-XP (they level only by real learning).
  rewardKill(kind = 'a monster') {
    const L = this._level();
    // Per-monster reward from the bestiary; fall back to the level curve for an
    // unknown kind (e.g. a legacy 'a monster' string).
    const mob = monsterOf(kind);
    const known = mob && mob.id === kind;
    // Global reward multipliers from the tuning pipeline (HQ-tunable).
    const bloom = Math.round((known ? mob.bloom : killReward(L)) * (REWARD_TUNING.bloomMul ?? 1));
    this.earnBloom(bloom, 'Bloom · ' + (known ? mob.name : 'monster'));
    if (!this.isKid()) {
      const x = Math.round((known ? mob.xp : killXp(L)) * (REWARD_TUNING.xpMul ?? 1));
      this.state.xp = (Number(this.state.xp) || 0) + x;
      this.pushReward({ icon: '⭐', amount: '+' + x, label: 'XP', tone: 'violet' });
    }
    this._bumpQuest('defeat');
    this.save(); this.emit();
  }

  // CONTEXTUAL tap on a soil tile (FarmVille one-tap). The whole field is soil
  // already — no tilling, no watering. Ripe → harvest; empty → plant; otherwise
  // (still growing) do nothing. This is what the tap-to-farm handler calls.
  tapAt(tx, ty) {
    const p = this.state.plots[tileKey(tx, ty)];
    // Sickle selected → remove whatever's planted here (or a no-op hint).
    if (this.state.tool === 'sickle') {
      if (p?.cropId) return this.removeCrop(tx, ty);
      this.flash('🌾 Nothing to cut here'); return null;
    }
    if (p?.cropId && cropIsRipe(p)) return this._harvest(tx, ty);
    if (!p?.cropId) return this._plant(tx, ty);
    // growing crop — leave it; give a hint so the tap isn't silent
    this.flash(CROPS[p.cropId]?.emoji + ' still growing');
    return null;
  }

  // Harvest a ripe crop → the crop becomes an ITEM in your 🎒 Bag (produce), NOT
  // instant cash. You sell the bag for 🌸 Bloom later (Shop / Sell all). The plant
  // then REGROWS (all crops re-harvest) — the ripen timer resets so the same bed
  // keeps producing until you sickle it. Returns { crop, emoji, tx, ty } for the
  // harvest-juice pop (the floating +🥬 IS the feedback).
  _harvest(tx, ty) {
    const key = tileKey(tx, ty); const st = this.state; const p = st.plots[key];
    if (!p?.cropId || !cropIsRipe(p)) return null;
    const crop = CROPS[p.cropId];
    st.produce[crop.id] = (st.produce[crop.id] || 0) + 1; // → the bag
    if (crop.regrow) {
      // Reset so it takes `regrow` ms to ripen again from now (backdate plantedAt).
      p.plantedAt = Date.now() - Math.max(0, crop.growMs - crop.regrow);
      p.wateredAt = null; p.grown = 0; p.growth = 0;
    } else {
      // Single-harvest crop — clear it (keep the plot record so it reads as tilled).
      p.cropId = null; p.plantedAt = null; p.wateredAt = null; p.grown = 0; p.growth = 0;
    }
    this._bumpQuest('harvest');
    this._bump();
    this._intent({ t: 'plot', key, plot: { ...p } });
    this._intent({ t: 'stock', produce: { [crop.id]: st.produce[crop.id] } });
    sfx.play('harvest');
    this.save(); this.emit();
    return { crop, emoji: crop.emoji, tx, ty };
  }
  // Harvest a specific tile regardless of the selected tool (used by the fan-out
  // "Harvest" button, which must not be hijacked by the sickle tool).
  harvestTile(tx, ty) { return this._harvest(tx, ty); }
  // Sickle: remove a plant from a tile entirely (growing, ripe, or regrowing) — no
  // produce, frees the tile to replant. Reuses the crop-clearing path.
  removeCrop(tx, ty) {
    const key = tileKey(tx, ty); const st = this.state; const p = st.plots[key];
    if (!p?.cropId) { this.flash('Nothing planted here'); return null; }
    const crop = CROPS[p.cropId];
    p.cropId = null; p.plantedAt = null; p.wateredAt = null; p.grown = 0; p.growth = 0;
    this._bump();
    this._intent({ t: 'plot', key, plot: { ...p } });
    sfx.play('sickle');
    this.flash('🌾 ' + (crop?.name || 'Crop') + ' removed'); this.save(); this.emit();
    return { removed: crop, tx, ty };
  }
  // Public plant used by the tile fan-out: optionally switch the selected seed
  // first (crop selection on the tile), then plant it here.
  plantAt(tx, ty, seedId = null) {
    if (seedId && CROPS[seedId]) this.state.selectedSeed = seedId;
    return this._plant(tx, ty);
  }
  _plant(tx, ty) {
    const key = tileKey(tx, ty); const st = this.state;
    if (!this.inField(tx, ty)) { this.flash('Plant inside the field'); return; }
    const p = st.plots[key];
    if (p?.cropId) { this.flash('Already planted here'); return; }
    const id = st.selectedSeed;
    if ((st.seeds[id] || 0) <= 0) { this.flash('No ' + CROPS[id].name + ' seeds — buy some'); return; }
    const now = Date.now();
    st.seeds[id] -= 1;
    // Soil is always ready: plant straight onto the tile; growth starts immediately.
    st.plots[key] = { tilled: true, cropId: id, plantedAt: now, wateredAt: null, grown: 0, growth: 0 };
    this._bump();
    this._intent({ t: 'plot', key, plot: { ...st.plots[key] } });
    this._intent({ t: 'stock', seeds: { [id]: st.seeds[id] } });
    sfx.play('plant');
    this.flash('Planted ' + CROPS[id].name + ' ' + CROPS[id].emoji); this.save(); this.emit();
  }

  // HOUSEKEEPING: delete any plot record sitting OUTSIDE the field (e.g. after a
  // field resize), and clear legacy/stuck crops with no real-time plantedAt (they
  // could never grow). Ripe crops no longer expire — they wait for you (and now
  // regrow after harvest), so this no longer clears anything time-based.
  // Called on load + on a periodic tick from FarmRoom. Returns count touched.
  sweepStalePlots() {
    const st = this.state; let n = 0;
    for (const key of Object.keys(st.plots)) {
      const [tx, ty] = key.split(',').map(Number);
      const p = st.plots[key];
      if (!p) { delete st.plots[key]; continue; }
      if (!this.inField(tx, ty)) { delete st.plots[key]; n++; continue; } // orphaned by resize
      if (p.cropId && p.plantedAt == null) {
        p.cropId = null; p.wateredAt = null; p.grown = 0; p.growth = 0;
        this._intent({ t: 'plot', key, plot: { ...p } }); n++;
      }
    }
    if (n) { this._bump(); this.save(); this.emit(); }
    return n;
  }
  // Harvest EVERY ripe crop in one tap (FarmVille speed). Returns the harvested
  // tiles so the renderer can pop juice at each.
  harvestAll() {
    const st = this.state; const got = [];
    for (const [key, p] of Object.entries(st.plots)) {
      if (p?.cropId && cropIsRipe(p)) {
        const [tx, ty] = key.split(',').map(Number);
        const r = this._harvest(tx, ty);
        if (r) got.push({ crop: r.crop, emoji: r.emoji, tx, ty });
      }
    }
    if (!got.length) { this.flash('Nothing ripe to harvest'); return { harvested: [] }; }
    this.flash('🎒 Harvested ' + got.length + ' — sell at the Shop');
    return { harvested: got };
  }
  // Plant the selected seed on EVERY empty soil tile until seeds run out.
  plantAll() {
    const st = this.state; const id = st.selectedSeed; const now = Date.now();
    let planted = 0;
    for (let ty = FIELD.y0; ty <= FIELD.y1 && (st.seeds[id] || 0) > 0; ty++) {
      for (let tx = FIELD.x0; tx <= FIELD.x1; tx++) {
        if ((st.seeds[id] || 0) <= 0) break;
        const key = tileKey(tx, ty); const p = st.plots[key];
        if (p?.cropId) continue;
        st.seeds[id] -= 1;
        st.plots[key] = { tilled: true, cropId: id, plantedAt: now, wateredAt: null, grown: 0, growth: 0 };
        this._intent({ t: 'plot', key, plot: { ...st.plots[key] } });
        planted++;
      }
    }
    if (!planted) { this.flash((st.seeds[id] || 0) <= 0 ? 'No ' + CROPS[id].name + ' seeds' : 'No empty soil'); return; }
    this._bump();
    this._intent({ t: 'stock', seeds: { [id]: st.seeds[id] } });
    this.flash('Planted ' + planted + '× ' + CROPS[id].emoji); this.save(); this.emit();
  }

  // Seeds cost 🥇 Gold — the spend half of the FarmVille loop (sell for more, buy
  // more, reinvest). Everyone pays Gold; the operator is free.
  buySeed(id, qty = 1) {
    const crop = CROPS[id];
    if (!crop) return;
    const cost = this.isOperator() ? 0 : crop.seedCost * qty;
    if ((this.state.bloom ?? 0) < cost) { this.flash('Not enough 🌸 Bloom — harvest some crops'); return; }
    this.state.bloom = (this.state.bloom ?? 0) - cost;
    this.state.seeds[id] = (this.state.seeds[id] || 0) + qty;
    this.state.selectedSeed = id;
    this.state.tool = 'seed';
    this._bump();
    this._intent({ t: 'stock', seeds: { [id]: this.state.seeds[id] } });
    sfx.play('buy');
    this.flash('Bought ' + qty + '× ' + crop.emoji + ' ' + crop.name + (cost ? ' · −🌸' + cost : ''));
    this.save(); this.emit();
  }
  // Selling produce earns 🥇 Gold — for EVERYONE (kids too; Gold is the play
  // currency, not the learning one). Only the produce-clearing syncs to the
  // circle; Gold is per-player for now (shared-pool = a later sync pass).
  sellAll() {
    let gain = 0, any = false;
    const items = [];
    for (const [id, n] of Object.entries(this.state.produce)) {
      if (n <= 0) continue; any = true;
      const info = this._produceInfo(id);
      gain += info.sell * n;
      items.push(info.icon + '×' + n);
    }
    if (!any) { this.flash('Nothing to sell'); return; }
    this.state.produce = {};
    this._bump();
    this._intent({ t: 'stock', produceReplace: {} });
    this.earnBloom(gain, 'Sold produce');
    sfx.play('sell');
    this.save(); this.emit();
  }
  _animalSell(pid) { for (const sp of Object.values(SPECIES)) if (sp.produce === pid) return sp.sell; return 10; }
  _produceInfo(pid) {
    const crop = CROPS[pid];
    if (crop) return { id: pid, name: crop.name, icon: crop.emoji, sell: crop.sell };
    for (const sp of Object.values(SPECIES)) {
      if (sp.produce === pid) return { id: pid, name: sp.produceName, icon: sp.produceEmoji, sell: sp.sell };
    }
    return { id: pid, name: pid, icon: '📦', sell: 10 };
  }

  _syncLivestock() { this._intent({ t: 'livestock', livestock: this.state.livestock.map((x) => ({ ...x })) }); }

  // CONTEXTUAL tap on an animal: collect a ready good → else feed → else pet.
  tapAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a) return;
    if (animalGoodReady(a)) return this.collectAnimal(id);
    if (!a.fedAt) return this.feedAnimal(id);
    return this.petAnimal(id);
  }
  feedAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a) return;
    if (a.fedAt) { this.flash(a.name + ' is already fed'); return; }
    a.fedAt = Date.now();
    this._bump(); this._syncLivestock();
    const sp = SPECIES[a.species];
    this.flash('Fed ' + a.name + ' — ' + sp.produceEmoji + ' soon'); this.save(); this.emit();
  }
  petAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a) return;
    a.affection = Math.min(100, (a.affection || 0) + 5);
    this._bump(); this._syncLivestock();
    this.flash('❤ ' + a.name + ' (' + a.affection + ')'); this.save(); this.emit();
  }
  collectAnimal(id) {
    const a = this.state.livestock.find((x) => x.id === id);
    if (!a || !animalGoodReady(a)) return;
    const sp = SPECIES[a.species];
    a.fedAt = null; // needs feeding again for the next good
    const pid = sp.produce;
    this.state.produce[pid] = (this.state.produce[pid] || 0) + 1; // → the bag (sell later)
    this._bump(); this._syncLivestock();
    this._intent({ t: 'stock', produce: { [pid]: this.state.produce[pid] } });
    this.pushReward({ icon: sp.produceEmoji, amount: '+1', label: sp.produceName, tone: 'bloom' });
    sfx.play('collect');
    this.save(); this.emit();
  }
  assignKin(id, task) {
    if (this.externalKins?.some((x) => x.id === id)) {
      this.state.kinTasks = { ...(this.state.kinTasks || {}), [id]: task };
      this._bump();
      this._intent({ t: 'kin-task', kinId: id, task });
      this.save(); this.emit(); return;
    }
    const k = this.state.kins.find((x) => x.id === id);
    if (k) {
      k.task = task;
      this._bump();
      this._intent({ t: 'kin-task', kinId: id, task });
      this.save(); this.emit();
    }
  }

  // Sleep = RECHARGE ONLY now. Crops grow in real time (not per-day) so sleeping
  // no longer advances them; it just refills stamina and ticks the day counter
  // for season flavor. Animal goods likewise moved to real-time (feed timers).
  sleep() {
    const st = this.state;
    st.day += 1;
    if (st.day > DAYS_PER_SEASON) { st.day = 1; st.season = (st.season + 1) % SEASONS.length; }
    st.stamina = pathMaxMp(this.path || 'warrior', this._level()); // refill to the level+path MP pool
    this._bump();
    // Broadcast the day tick (calendar flavor) — carries no crop growth anymore.
    this._intent({ t: 'day', day: st.day, season: st.season });
    this._dayEvent();
    sfx.play('sleep');
    this.saveNow(); this.emit();
  }
}
