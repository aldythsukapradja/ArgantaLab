// ─────────────────────────────────────────────────────────────────────────
// B1 · Single-File Builder — core type ontology  (Opus, contract-freeze)
// The canonical vocabulary the whole builder shares: what an artifact IS, its
// modes, statuses, visibility, and the website/app archetypes. Frozen here so
// the kernel (generate/revise/validate/version/publish), the tool specs, the
// C2-style migration, and B4a's portable blocks all speak ONE vocabulary.
// See docs/arganta-core/Single-File-Builder.md and docs/adr/0005-*.
// ─────────────────────────────────────────────────────────────────────────

/** An artifact is an interactive app, a presentation-focused site, or a
 * playable game. One HTML file in every case (the v1 scope). GB-1 added
 * 'game': it is NOT an application with a canvas — it has its own generation
 * policy (loop/input/score), its own validation rules, and its own SDK
 * (CircleGame vs CircleApp), so it earns a first-class kind. */
export const ARTIFACT_KINDS = Object.freeze(['application', 'website', 'game']);
export const isArtifactKind = (k) => ARTIFACT_KINDS.includes(k);

export const ARTIFACT_STATUS = Object.freeze(['draft', 'published', 'archived']);
export const isArtifactStatus = (s) => ARTIFACT_STATUS.includes(s);

/** private = founder-only (default); circle = exported into a KinetikCircle
 * catalog; public = served on the shared runtime (build.arganta.app). */
export const VISIBILITY = Object.freeze(['private', 'circle', 'public']);
export const isVisibility = (v) => VISIBILITY.includes(v);

/** Website archetypes (present information). */
export const WEBSITE_TYPES = Object.freeze([
  'landing', 'product', 'company', 'portfolio', 'event', 'campaign', 'docs', 'report', 'profile', 'custom',
]);
/** Application archetypes (manage information / complete tasks). */
export const APP_ARCHETYPES = Object.freeze([
  'dashboard', 'tracker', 'planner', 'calculator', 'crm', 'calendar', 'form', 'explorer', 'knowledge', 'organizer', 'chat', 'custom',
]);
/** Game genres (GB-1). Mirrors the categories the legacy Game Builder already
 * classified by (apps/hq/src/data/starterPrompt.ts PROMPT_CATEGORIES), so a
 * game generated here slots straight into the existing Analytics/Discover
 * taxonomy instead of inventing a second vocabulary. */
export const GAME_GENRES = Object.freeze([
  'arcade', 'puzzle', 'platformer', 'shooter', 'racing', 'tower', 'rpg', 'survival', 'farming', 'strategy', 'rhythm', 'custom',
]);

/**
 * Classify a request as game, application, or website from its natural
 * language. Deterministic heuristic (docs strategy §12): "play / win / score"
 * → game; "manage / do a task" → app; "present / show information" → website.
 * Honest default is `website` for a purely ambiguous request (the cheaper,
 * lower-risk artifact — a presentation page with no state). A caller (Arganta
 * Core / the Builder UI) can always override by naming the kind explicitly.
 *
 * Game is checked FIRST and wins outright: "a game to track your score" is a
 * game, not a tracker, and the play-signals are far more specific than the
 * generic app vocabulary they'd otherwise collide with.
 * @returns {{kind:'application'|'website'|'game', reason:string}}
 */
export function classifyArtifactKind(request = '') {
  const s = String(request).toLowerCase();
  const gameSignals = ['game', 'playable', 'platformer', 'shooter', 'arcade', 'puzzle game', 'rpg', 'roguelike', 'tower defense', 'racing', 'player', 'enemies', 'levels', 'high score', 'leaderboard', 'sprite', 'gameplay', 'boss', 'power-up', 'powerup'];
  const appSignals = ['dashboard', 'tracker', 'track', 'crm', 'planner', 'plan ', 'calculator', 'calculate', 'manage', 'workflow', 'form', 'app ', 'tool', 'admin', 'inventory', 'kanban', 'todo', 'to-do', 'log ', 'entry', 'database'];
  const siteSignals = ['landing', 'website', 'homepage', 'home page', 'portfolio', 'company site', 'product page', 'marketing', 'microsite', 'brochure', 'profile page', 'about page', 'event page', 'campaign'];
  if (gameSignals.some((k) => s.includes(k))) return { kind: 'game', reason: 'play/score language' };
  const appHit = appSignals.some((k) => s.includes(k));
  const siteHit = siteSignals.some((k) => s.includes(k));
  if (appHit && !siteHit) return { kind: 'application', reason: 'task/state language' };
  if (siteHit && !appHit) return { kind: 'website', reason: 'presentation language' };
  if (appHit && siteHit) return { kind: 'application', reason: 'mixed — app wins (has state)' };
  return { kind: 'website', reason: 'ambiguous — default to the lower-risk presentation artifact' };
}

/** Detect a game genre from a brief. Returns 'custom' when nothing matches —
 * never guesses a specific genre, since the genre drives the generation policy. */
export function classifyGameGenre(request = '') {
  const s = String(request).toLowerCase();
  const hints = {
    platformer: ['platformer', 'jump', 'side-scroll', 'sidescroll', 'mario'],
    shooter: ['shooter', 'shoot', 'fps', 'space invader', 'bullet'],
    racing: ['racing', 'race', 'driving', 'kart', 'lap'],
    tower: ['tower defense', 'tower', 'defend', 'wave'],
    rpg: ['rpg', 'role-playing', 'quest', 'dungeon', 'party'],
    survival: ['survival', 'survive', 'zombie', 'hunger'],
    farming: ['farm', 'harvest', 'crop', 'garden'],
    strategy: ['strategy', 'tactics', 'turn-based', 'civilization'],
    rhythm: ['rhythm', 'beat', 'music game', 'dance'],
    puzzle: ['puzzle', 'match-3', 'match 3', 'tetris', 'sudoku', 'block'],
    arcade: ['arcade', 'snake', 'pong', 'breakout', 'endless', 'flappy'],
  };
  for (const [genre, keys] of Object.entries(hints)) {
    if (keys.some((k) => s.includes(k))) return genre;
  }
  return 'custom';
}

/**
 * @typedef {Object} SingleFileArtifact  the one logical artifact shape (its
 *   founder-scoped storage is hq_artifact; its optional Circle distribution is
 *   a later copy into hq_app — see ADR-0005).
 * @property {string} id
 * @property {'application'|'website'} kind
 * @property {string} title
 * @property {string} description
 * @property {string} html                the current executable artifact — the primary output
 * @property {string|null} templateId
 * @property {string|null} brandKitId
 * @property {number} currentVersion
 * @property {'draft'|'published'|'archived'} status
 * @property {'private'|'circle'|'public'} visibility
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} ArtifactBuildContext  how a version was produced (metadata,
 *   stored per-version for provenance — never regenerated).
 * @property {string} brief
 * @property {'application'|'website'} kind
 * @property {string|null} websiteType
 * @property {string[]} componentIds
 * @property {boolean} useCircleSdk
 * @property {string|null} provider
 * @property {string|null} model
 * @property {number} costUsd
 * @property {object|null} validation      a ValidationResult (validate.js)
 * @property {string|null} runId           lineage into agent_runs
 */
export const noop = undefined; // keep this a value-module so `import * as` stays cheap
