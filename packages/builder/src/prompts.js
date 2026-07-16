// ─────────────────────────────────────────────────────────────────────────
// B1 · Generation prompt contract  (Opus, contract-freeze)
// The generalized "Arganta Single-File Builder" contract — circleAppPrompt's
// single-file discipline (apps/hq/src/data/circleAppPrompt.ts) lifted OUT of
// its KinetikCircle assumption. Circle integration is now OPTIONAL, and the
// contract serves BOTH application and website modes. buildGenerationPrompt()
// assembles the system message from the parts the kernel selects (mode,
// template, components, brand, current HTML for a revision). Pure — no engines,
// no network. B2 feeds its output to llm-proxy.
// ─────────────────────────────────────────────────────────────────────────

/** The non-negotiable rules every generated artifact must satisfy — these
 * mirror what validate.js deterministically enforces, so the model is told
 * exactly what will be checked. Kept in sync with validate.js by intent. */
export const CONTRACT_RULES = [
  'Return ONE complete HTML document and nothing else — no Markdown, no code fences, no explanation.',
  'Inline all CSS and JavaScript. Ship exactly one file.',
  'Responsive on mobile, tablet, and desktop (mobile-first, viewport meta, touch targets ≥ 44px).',
  'Only load external resources from: cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, fonts.googleapis.com, fonts.gstatic.com. Prefer inline.',
  'Never include API keys, tokens, passwords, or any credential.',
  'No eval() or new Function(). No access to the parent/top window. No auto-redirects.',
  'On a revision, preserve all unrelated existing functionality.',
  'Accessible: labelled controls, keyboard support, real empty/loading/error states.',
  'The artifact must run inside a sandboxed iframe. Do not navigate or modify the parent window.',
  'No TODOs, no placeholder text, no lorem ipsum. Complete and production-quality. End with </html>.',
];

const APP_POLICY = `MODE: APPLICATION — an interactive tool with state.
Include: forms, CRUD, lists/cards/tables/charts as needed, persistence (localStorage if no platform),
loading + empty + error states, keyboard shortcuts (Enter to save, Esc to cancel).`;

const WEBSITE_POLICY = `MODE: WEBSITE — a presentation-focused page.
Include: clear content hierarchy, responsive navigation, hero, content sections, calls to action,
SEO meta (title + description), footer. Keep application state minimal.`;

// GB-1 · The game contract. Deliberately prescriptive about the things that
// make a generated game actually PLAYABLE rather than a pretty static canvas —
// these are the same properties validate.js checks for kind:'game', so the
// model is told exactly what the gate will look for.
const GAME_POLICY = `MODE: GAME — a complete, playable browser game.
Include:
- A <canvas> (or a deliberate DOM-grid for board/puzzle games) sized responsively, and a real
  requestAnimationFrame game loop with delta-time movement (never frame-rate-dependent physics).
- Working input on BOTH desktop and touch: keyboard (arrows/WASD + space) AND touch/pointer controls.
  A game that needs a keyboard is broken on a phone — provide on-screen controls when relevant.
- Real game state: a start state, a play state, a lose/win state, and a restart path that fully resets.
- Score (or an equivalent objective) shown on screen, and difficulty that develops as play continues.
- Self-contained art: draw with canvas primitives, CSS, emoji, or inline SVG. No external image files.
- Sound is optional; if present it must be WebAudio-synthesized and start muted or after a user gesture
  (browsers block autoplay).
Do not ship a demo or a tech sketch: it must be winnable/losable and fun on the first try.`;

/**
 * Assemble the generation system prompt.
 * @param {object} o
 * @param {'application'|'website'|'game'} o.kind
 * @param {string} o.brief
 * @param {string} [o.templatePrompt]   template-specific instructions (from appTemplates or a website archetype)
 * @param {string} [o.genre]            game genre (games only — drives the genre brief)
 * @param {string[]} [o.componentHints] short descriptions of the selected portable blocks to assemble from
 * @param {string} [o.brandHint]        brand direction (palette/type summary)
 * @param {boolean} [o.useCircleSdk]    include the Circle SDK contract (App SDK for apps, Game SDK for games)
 * @param {string} [o.currentHtml]      present ⇒ this is a REVISION, not a fresh build
 * @param {string} [o.instruction]      the revision instruction (with currentHtml)
 * @returns {{role:string, content:string}[]}  messages ready for llm-proxy
 */
export function buildGenerationPrompt(o) {
  const rules = CONTRACT_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const policy = o.kind === 'game' ? GAME_POLICY : o.kind === 'application' ? APP_POLICY : WEBSITE_POLICY;
  const parts = [
    'You are the Arganta Single-File Builder. You produce one complete, production-quality HTML document.',
    policy,
    `RULES:\n${rules}`,
  ];
  if (o.templatePrompt) parts.push(`TEMPLATE:\n${o.templatePrompt}`);
  if (o.kind === 'game' && o.genre && o.genre !== 'custom') parts.push(`GENRE: ${o.genre} — honour that genre's core loop and player expectations.`);
  // Blocks are page furniture (nav/hero/table/form/…) — real help for an app or
  // a site, actively wrong for a canvas game. Never hint them for kind:'game'.
  if (o.kind !== 'game' && o.componentHints?.length) parts.push(`ASSEMBLE FROM THESE BLOCKS (adapt, don't just paste):\n- ${o.componentHints.join('\n- ')}`);
  if (o.brandHint) parts.push(`BRAND:\n${o.brandHint}`);
  if (o.useCircleSdk && o.kind === 'application') parts.push('PLATFORM: integrate the Circle App SDK (init, db.list/save/remove, on(), emit()). Mock works standalone; real SDK is injected on deploy.');
  if (o.useCircleSdk && o.kind === 'game') parts.push('PLATFORM: integrate the Circle Game SDK — call CircleGame.ready() on load and CircleGame.submitScore(score) on game over. Guard every call (typeof CircleGame !== "undefined") so the game still runs standalone; the real SDK is injected on deploy.');

  const system = { role: 'system', content: parts.join('\n\n') };
  if (o.currentHtml) {
    return [
      system,
      { role: 'user', content: `Here is the current artifact:\n\n${o.currentHtml}` },
      { role: 'user', content: `Revise it: ${o.instruction || o.brief}\n\nReturn the COMPLETE updated HTML document, preserving everything unrelated to this change.` },
    ];
  }
  return [system, { role: 'user', content: o.brief }];
}
