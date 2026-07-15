// ─────────────────────────────────────────────────────────────────────────
// C1 · Embedding & mount contract  (Opus, contract-freeze)
// Arganta Core is a MODULE, not a page — it may mount as its own HQ surface,
// as a slide-over panel, inline in another surface, or (later) embedded on a
// different property entirely. The founder requirement, frozen here so C4b
// can't quietly break it: on mobile the chat is FULL SCREEN and covers
// everything, including the bottom nav bar. Analog = ChatGPT / Claude chat.
// See docs/arganta-core/Arganta-Core-Concept.md.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How the Core is mounted.
 *   fullscreen — owns the whole viewport, above ALL app chrome (mobile default)
 *   panel      — slide-over drawer on the right (desktop secondary surface)
 *   inline     — embedded in a host layout, sized by its container
 */
export const MOUNT_MODES = Object.freeze({ FULLSCREEN: 'fullscreen', PANEL: 'panel', INLINE: 'inline' });

/** Breakpoint at/below which mobile rules apply (matches the app's mobile nav). */
export const MOBILE_MAX_WIDTH = 640;

/**
 * The stacking contract. Fullscreen Core MUST sit above the app's mobile nav
 * and any floating copilot, so it truly covers the page. C4b's CSS uses these
 * exact tokens — a test asserts the ordering so a later z-index tweak elsewhere
 * can't slip the nav back on top.
 */
export const Z_LAYERS = Object.freeze({ APP_NAV: 100, COPILOT: 500, CORE_FULLSCREEN: 1000 });

/**
 * Resolve the effective mount mode. On a mobile viewport the Core is ALWAYS
 * fullscreen regardless of what was requested — the founder rule. On desktop
 * the requested mode wins (default: inline as an HQ surface).
 */
export function resolveMountMode({ viewportWidth = 1280, requested = MOUNT_MODES.INLINE } = {}) {
  if (viewportWidth <= MOBILE_MAX_WIDTH) return MOUNT_MODES.FULLSCREEN;
  return Object.values(MOUNT_MODES).includes(requested) ? requested : MOUNT_MODES.INLINE;
}

/** True when the Core must cover app chrome (nav/copilot) entirely. */
export const coversAppChrome = (mode) => mode === MOUNT_MODES.FULLSCREEN;

/**
 * The prop contract C4b's <ArgantaCore /> component implements. Documented here
 * (not a React type — this package is framework-agnostic) so the component API
 * is a frozen boundary the moment anything embeds it elsewhere.
 *
 * @typedef {Object} ArgantaCoreProps
 * @property {string} [threadId]         resume a thread; omit to start fresh
 * @property {string} [mountMode]        MOUNT_MODES.* — overridden to fullscreen on mobile
 * @property {boolean} [embed]           true when hosted outside HQ (hides HQ-only chrome)
 * @property {number} [maxCostClass]     ceiling the composer's tier pill may reach (default 1 = Sponsored)
 * @property {string} [apiBase]          gateway base; defaults to the app's Supabase client
 * @property {(a:{assetId:string,kind:string})=>void} [onArtifact]  host hook when an artifact is produced
 * @property {()=>void} [onClose]        host hook for the fullscreen/panel close affordance
 */
export const ARGANTA_CORE_PROP_KEYS = Object.freeze(['threadId', 'mountMode', 'embed', 'maxCostClass', 'apiBase', 'onArtifact', 'onClose']);
