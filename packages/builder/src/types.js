// ─────────────────────────────────────────────────────────────────────────
// B1 · Single-File Builder — core type ontology  (Opus, contract-freeze)
// The canonical vocabulary the whole builder shares: what an artifact IS, its
// modes, statuses, visibility, and the website/app archetypes. Frozen here so
// the kernel (generate/revise/validate/version/publish), the tool specs, the
// C2-style migration, and B4a's portable blocks all speak ONE vocabulary.
// See docs/arganta-core/Single-File-Builder.md and docs/adr/0005-*.
// ─────────────────────────────────────────────────────────────────────────

/** An artifact is either an interactive app or a presentation-focused site.
 * One HTML file either way (the v1 scope). */
export const ARTIFACT_KINDS = Object.freeze(['application', 'website']);
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

/**
 * Classify a request as application or website from its natural language.
 * Deterministic heuristic (docs strategy §12): "manage / do a task" → app;
 * "present / show information" → website. Honest default is `website` for a
 * purely ambiguous request (the cheaper, lower-risk artifact — a presentation
 * page with no state). A caller (Arganta Core / the Builder UI) can always
 * override by naming the kind explicitly.
 * @returns {{kind:'application'|'website', reason:string}}
 */
export function classifyArtifactKind(request = '') {
  const s = String(request).toLowerCase();
  const appSignals = ['dashboard', 'tracker', 'track', 'crm', 'planner', 'plan ', 'calculator', 'calculate', 'manage', 'workflow', 'form', 'app ', 'tool', 'admin', 'inventory', 'kanban', 'todo', 'to-do', 'log ', 'entry', 'database'];
  const siteSignals = ['landing', 'website', 'homepage', 'home page', 'portfolio', 'company site', 'product page', 'marketing', 'microsite', 'brochure', 'profile page', 'about page', 'event page', 'campaign'];
  const appHit = appSignals.some((k) => s.includes(k));
  const siteHit = siteSignals.some((k) => s.includes(k));
  if (appHit && !siteHit) return { kind: 'application', reason: 'task/state language' };
  if (siteHit && !appHit) return { kind: 'website', reason: 'presentation language' };
  if (appHit && siteHit) return { kind: 'application', reason: 'mixed — app wins (has state)' };
  return { kind: 'website', reason: 'ambiguous — default to the lower-risk presentation artifact' };
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
