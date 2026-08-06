# ArgantaEnergy — repo map

Orientation for anyone (human or agent) asked to review or extend `apps/energy`.
Every count here was read from the data, not remembered.

If you only read one other file, read `apps/energy/CLAUDE.md` — it holds the
rules that make this app trustworthy, and they are not inferable from the code.

---

## What this app is

A petroleum geoscience workspace over a real world catalogue, with an agent that
answers questions about it. The distinguishing property is not the coverage —
it is that **the app refuses rather than estimates.** Absences are answers.

---

## Where the data lives

`public/agent/` — the gazetteer the agent resolves against.

| kind | count |
|---|---|
| region / country | 9 / 120 |
| basin | 179 |
| petroleum system | 211 |
| assessment unit | 339 |
| basin cycle | 630 |
| formation | 618 |
| field | 7,787 |
| well / wellbore | 27 / 3,882 |
| company | 267 |
| **total** | **14,069** (2,400 core + 11,669 tail) |

`public/kb/master-kb-spine.json` — the knowledge spine. Notable tables:
`psEvent` 1,484 · `psElement` 1,544 · `figureRegistry` 557 · `figureLinks` 935 ·
`basinCycle` 630 · `psElementCandidate` 774 · `psProcessEvidence` 515.

`public/wb/` — the Volve well bundle, 83 files: `logs-*.json` (digested curves),
`traj-*.json` (directional surveys), `drill-*.json`, plus `index.json`, which is
the roster. 24 wells carry logs, 25 carry trajectories.

`public/world/provinces.geojson` — 179 province outlines, 296 KB. Small enough
to load in a chat, which is why the in-chat map is SVG and not MapLibre.

`public/osdu/` — cockpit spatial layers (points, polygons, search, dossiers).
`public/basin-figures/` — public-domain figures. `basin-figures-restricted/` is
rights-held and must never be rendered; `isShowable()` is the gate.

Raw Volve source data is **local-only and gitignored** (~2 GB). Anything that
needs it cannot run in CI or on a clean checkout — the build scripts under
`scripts/build-*.mjs` turn it into the committed JSON above.

---

## The agent (`src/agent/`)

Seven layers, one direction of travel. See `CLAUDE.md` for the rules.

- `gazetteer.ts` — load + index (name keys, trigrams, phonetic, parent/child)
- `resolve.ts` — five rungs: exact → alias → lexical → fuzzy → phonetic
- `grammar.ts` — utterance → `Intent`
- **`capabilities.ts`** — **28 capabilities. Start here.** Each is one grammar
  rule, one tool, one card, one probe. Its header lists which surfaces actually
  hold content — trust that over folder names.
- `plan.ts` → `dialogue.ts` → `useAgent.ts` (the single React seam)

Supporting: `guard.ts` (grounding), `trace.ts` (what really happened),
`summary.ts` (closing line), `workflows.ts` (chains + assisted planning),
`report.ts` (typesets a run to one HTML file), `tools.ts`/`runtime.ts` (language
tier), `useAgentCockpit.ts` (dev-only live state + steering).

**The command bus** — `scope` · `view` · `map` · `clear` — is the only way
anything changes the app. Everything routes through it.

---

## The chat surface (`src/cosmo/`)

`CosmoShell.tsx` owns `nav`. `CosmoChat.tsx` is the chat. `ChatArtifact.tsx`
mounts real content *inside* answers — basin figures (searchable), well
trajectory, well logs, petroleum-system events, tectonostratigraphy, basin map.

`AgentTrace.tsx` renders the receipt; `AgentWelcome.tsx` is computed live from
the gazetteer so its figures cannot go stale.

---

## The verticals (`src/tabs/`)

`exploration` · `fielddev` (46 files) · `drilling` · `reservoir` ·
`welldelivery` · `knowledge`.

**Many suite tabs render blueprints, not built viewers.** The list of surfaces
that genuinely hold content is at the top of `capabilities.ts` and is kept
honest because routing is tested. Do not assume a folder implies a working
screen.

---

## Tests

`npm run test:agent` — 12 files, ~545 assertions:
`agent-bus · crosswalk · gazetteer · capabilities · resolve · grammar ·
dialogue · trace · summary · coverage · workflows · agent-worker`

`npm test` — 65 files, the whole app.

Truth-locks, not unit tests: they assert things about the data. Plain Node, no
browser, no framework.

---

## Reviewing this app well

Ask **scoped** questions. "Review my app" produces a confident partial read;
"read `capabilities.ts` and tell me where a probe could lie" produces something
useful.

Good places to look for real problems:

- **Probes that infer.** A probe must read `node.has` only.
- **Numbers without sources.** Every `CardFact` needs a `source` or a `note`.
- **Derived rendered as measured.** Hatching, not tinting.
- **Invented UI.** Hardcoded counts, fake progress, model names that do not
  correspond to what runs. Three separate instances have been removed.
- **Key-name drift.** `has.traj` vs `has.trajectory` silently rendered nothing.

While the dev server runs, `.agent/live-state.json` says what is on screen, and
writing `.agent/commands.json` navigates it. Read the code, drive the app to the
surface in question, then judge.
