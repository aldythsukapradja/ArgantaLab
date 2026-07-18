# Tri-Brain Plan — Sovereign · Claude · Codex

**Status:** SHIPPED end-to-end (2026-07-18). All of P1–P4 built + verified. One follow-up: run `supabase/migration_missions_engine.sql` (persistence works without it meanwhile — see P4).
**Owner surfaces:** `apps/hq/src/surfaces/core/` (UI) + `tools/arganta-bridge/` (local agent server).
**Date:** 2026-07-18

## What the founder asked for

1. **Connect-bar overlap (desktop/inline):** the "Connect to your Claude Code bridge" bar still collides with the floating Core/Claude-Code/Preview capsule. Replace the bar with a **popup**.
2. **Codex as a third brain.** The brain toggle becomes three capsules: **Sovereign — Claude — Codex**, each with a proper logo.
3. Everything already shipped stays: Markdown replies, deduped done-card, completion capsule naming the model, per-brain model picker.

## Current state (read before coding)

- `ArgantaCore.tsx` — `brain: 'core' | 'claude-code'` state, duplicated in the inline component AND `FullscreenCore`. Toggle markup also duplicated (uses `.core-brain-toggle`, `ClaudeMark` on the Claude tab).
- `BridgeConsole.tsx` — the whole Claude Code chat. Connect UI is `.bridge-connect-bar` rendered at the top of `.core-convo` (this is what overlaps the absolute-positioned `.core-center-actions` capsule in inline mode). Has URL + token inputs (URL was added for Tailscale). localStorage keys `hq_bridge_token`, `hq_bridge_model`, `hq_bridge_url`.
- `lib/bridge/client.ts` — `BridgeClient`, WS to `ws://127.0.0.1:7717/?token=…`. Mission msg: `{ type:'mission', missionId, prompt, cwd, model }`.
- `tools/arganta-bridge/src/server.ts` — drives `@anthropic-ai/claude-agent-sdk` `query()`, normalizes SDK messages → `OutEvent` feed (`status | tool | message | awaiting_approval | artifact | done | error`), gated tools pause via `canUseTool` + `classify()` from `permissions.ts`, missions persisted via `persist.ts`.
- `ClaudeMark.tsx` — Claude sunburst (#D97757). `ArgantaMark` (gradient A tile) lives inline in `ArgantaCore.tsx`.

## P1 — Connect popup (UI only, small)

Replace the top bar with a modal so it can never collide with the capsule.

- New `BridgeConnectDialog` (can live inside `BridgeConsole.tsx`): centered card over a scrim, `position:absolute; inset:0` **within `.core-convo`** (not a document portal — the panel/fullscreen mounts must keep working). z-index above `.core-center-actions` (which is z-5).
- Contents: status dot + copy, URL input (`ws://127.0.0.1:7717` placeholder / Tailscale hint), token input, Connect button — same fields as today, stacked vertically, ~360px wide.
- Trigger rules:
  - Disconnected + feed empty → show the dialog automatically (it IS the empty state).
  - Disconnected mid-session (socket drops) → keep the chat visible; show a slim "reconnect" pill under the composer status row that reopens the dialog. Never auto-cover a feed the founder is reading.
  - Connected → dialog never renders.
- Delete `.bridge-connect-bar` styles; add `.bridge-connect-dialog` + `.bridge-connect-scrim` to `bridge.css`. Keep the `@media (max-width:980px)` wrap behavior by making the dialog fields full-width.
- Composer placeholder while disconnected stays "Connect to the bridge first".

Acceptance: in inline (desktop) mode with the capsule visible, nothing overlaps; Esc / scrim-click closes the dialog when a reconnect pill exists (but not when it's the mandatory empty state).

## P2 — Three brain capsules with logos (UI only)

- Brain type becomes `'sovereign' | 'claude' | 'codex'`. Migrate the old `'core'` value silently (it's component state, not persisted — just rename).
- **De-duplicate the toggle**: extract one `BrainToggle({ brain, onChange })` component used by both inline and fullscreen (the markup is currently copy-pasted twice in `ArgantaCore.tsx`).
- Capsules, in order, each `display:inline-flex; gap:5px`:
  - **Sovereign** — the Arganta mark. Extract `ArgantaMark` to its own file with a `size` prop and render a 12px version in the tab. Active bg stays `var(--acc)`.
  - **Claude** — existing `ClaudeMark`. Active bg `#D97757` (already styled as `.core-brain-tab-cc`).
  - **Codex** — new `OpenAIMark` component alongside `ClaudeMark.tsx`: simplified OpenAI hexagonal-knot glyph, inline SVG, no external asset (follow the ProviderLogo "recognizable-by-colour, not pixel-exact" rule). Colour `#10A37F` (OpenAI teal) on inactive, white on active; active bg `#10A37F`.
- Generalize the tab CSS: replace `.core-brain-tab-cc` with `.core-brain-tab[data-brain]` or three modifier classes; each brand tab keeps its brand bg when active.
- Routing in both mounts:
  - `sovereign` → `<Conversation …/>` (unchanged)
  - `claude` → `<BridgeConsole engine="claude" />`
  - `codex` → `<BridgeConsole engine="codex" />`

## P3 — Parameterize BridgeConsole per engine (UI)

One console, two engines — do NOT copy the file.

- New prop `engine: 'claude' | 'codex'` with a small config map in `BridgeConsole.tsx`:
  ```ts
  const ENGINES = {
    claude: {
      name: 'Claude Code', Mark: ClaudeMark, accent: '#D97757',
      models: [ {id:'',label:'Default',…}, {id:'opus',…}, {id:'sonnet',…}, {id:'haiku',…} ],
      lsPrefix: 'hq_bridge',          // keeps existing keys working
      capsulePrefix: 'Claude',
    },
    codex: {
      name: 'Codex', Mark: OpenAIMark, accent: '#10A37F',
      models: [ {id:'',label:'Default',sub:"Codex's default model"},
                {id:'gpt-5.1-codex-max',label:'Codex Max',sub:'Most capable'},
                {id:'gpt-5.1-codex',label:'Codex',sub:'Balanced'},
                {id:'gpt-5.1-codex-mini',label:'Codex Mini',sub:'Fastest'} ],
      // ⚠ verify current Codex model ids at build time (`codex exec --help` / docs)
      lsPrefix: 'hq_bridge_codex',
      capsulePrefix: '',              // labels already say "Codex …"
    },
  }
  ```
- Per-engine localStorage: token/url/model under the engine's prefix (Claude's existing keys unchanged; both engines share one bridge, so default the Codex token/url to the Claude values when unset).
- Mission start sends `engine` to the bridge: `startMission(prompt, { model, engine })` → client adds `engine` to the mission message (defaults to `'claude'` server-side for back-compat).
- Model pill, picker note, empty-state copy, completion capsule all read from the engine config. Completion capsule shows `<Mark/> + label` (e.g. `Codex Max`), same `.bf-model-capsule` style.
- Each engine keeps its own feed: keep component state keyed by mounting (`<BridgeConsole key={engine} …/>`) so switching capsules doesn't bleed one engine's feed into the other.

## P4 — Codex engine in the bridge (server; the real work)

Extend `tools/arganta-bridge` — same port, same token, same OutEvent feed.

- **Refactor:** split `runMission` into an engine interface:
  ```ts
  interface MissionEngine {
    run(args: { prompt, missionId, cwd, model,
                send:(ev:OutEvent)=>void,
                gate:(tool:string,input:unknown,label:string)=>Promise<boolean> }): Promise<void>
  }
  ```
  Current Claude SDK path becomes `engines/claude.ts` (behavior identical). Mission message `engine?: 'claude' | 'codex'` selects the engine, default `'claude'`.
- **`engines/codex.ts` — prefer the Codex SDK** (`@openai/codex-sdk`, TypeScript): start a thread, `thread.run(prompt)`, map streamed items → OutEvents (`agent_message`→`message`, `command_execution`/`file_change`→`tool`, turn completion→`done` with token usage; Codex reports usage, not USD — send `costUsd: undefined` and let the capsule show model only; **never fabricate a dollar figure**).
  - Fallback if the SDK fights back: spawn `codex exec --json <prompt>` and parse the JSONL event stream — same normalization.
- **Approvals:** v1 runs Codex with its sandbox at `workspace-write` and network off — no interactive approval protocol wired yet. Gated-action parity with `permissions.ts` (deploy/push/migrations/spend pause for approval) is honest-scope-cut: state in the UI note that Codex v1 sandbox-blocks instead of asking. Wire Codex's approval callback in a v2 once the SDK's approval hook is verified.
- **Config:** `.env` gains nothing secret for ChatGPT-plan auth (`codex login` on the machine is the auth); support `CODEX_MODEL` default. README: prerequisite `npm i -g @openai/codex` + `codex login`, plus a "Codex not installed" error path → OutEvent `error` with a friendly message the dialog can show.
- **Persistence:** `persist.ts` mission records gain `engine` so the pending missions table can tell brains apart.

## Sequencing & risk

- P1, P2, P3 are pure UI and can ship together in one pass (P3 has a tiny client.ts change; server ignores unknown `engine` field safely).
- P4 is isolated to the bridge; UI works before it lands (Codex missions just error with "engine not available — update the bridge" until then).
- Risks: Codex SDK event shape (verify against installed version, don't trust memory), model id churn (check at build time), no USD cost from Codex (capsule shows model only), approval parity deferred (documented above).

## Acceptance (whole feature)

1. Desktop inline: no element ever sits under the floating capsule; connect flow is a popup.
2. Three capsules — Sovereign (Arganta mark) / Claude (sunburst, clay) / Codex (OpenAI knot, teal) — in inline AND fullscreen, active state in brand colour.
3. Claude tab: everything works exactly as today (regression check: connect, mission, approval, Markdown, dedupe, completion capsule).
4. Codex tab: connects to the same bridge, runs a real mission via Codex CLI/SDK, streams tool lines + Markdown reply, completion capsule shows the Codex model with the OpenAI mark.
5. `tsc` + `vite build` clean; typecheck the bridge too (`tools/arganta-bridge`).
