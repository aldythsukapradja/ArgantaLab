# ArgantaEnergy — how to work in this codebase

Read this before changing anything in `apps/energy`. It is short on purpose.

The rules below are not style preferences. They are the reason a petroleum
engineer can trust a number on screen, and every one of them was written after
something went wrong. An agent that "tidies up" a guard here makes the app worse
in a way that is invisible until someone plans a well on a figure nobody
measured.

---

## The one rule everything else serves

**No number appears without a source, and no absence is disguised.**

If the data is not there, the app says so and says what *is* there. It never
estimates, never interpolates to fill a gap, never renders a plausible default.
"Volve is the only field with well logs — Badak has field records and a USGS
assessment, no logs" is the product. A blank viewer is a bug; a *reasoned* blank
is a feature.

## What that means in practice

**`probe` reads `node.has` and nothing else.** `node.has` is written by the build
from real file contents. A capability whose probe returns false is never planned
— it reports a reasoned absence via `absence`. Do not make a probe cleverer, do
not let it infer, do not let it fall back to a related flag.

**The grounding guard is not optional.** Prose from a language model is checked
against the card: any numeral not on the card or in the user's own words causes
the *entire utterance* to be discarded (`agent/guard.ts`). `agent/summary.ts`,
which is our own code, is held to the exact same gate — deliberately. Counts it
works out for itself are spelled as words so they cannot trip it. If you add
prose anywhere near a figure, route it through that guard.

**Derived is not measured, and must not look measured.** Rule-derived
petroleum-system events are hatched, not merely tinted. Interpreted basin cycles
are hatched. A weaker claim must not render as the same kind of statement as a
stronger one, and the count of derived items is stated in words next to the
chart.

**Never invent telemetry, model names, or progress.** A usage strip with
hardcoded percentages shipped here once, and a model picker naming models that
did not exist. Both were removed. If you cannot measure it, do not draw it. The
"thinking…" narration a chat UI usually shows was refused for the same reason:
the model picks a tool and nothing else, so narrating deliberation would be
fabrication dressed as reassurance.

**Timing tells the truth.** Sub-millisecond work reports "instant", not a padded
number. A pause added for legibility is named `paceMs` and documented as buying
nothing computationally.

---

## Architecture, in one pass

**`src/agent/` — seven layers, one direction.**

```
gazetteer.ts    14,069 places, core + tail, loaded once
resolve.ts      five rungs: exact → alias → lexical → fuzzy → phonetic
grammar.ts      utterance → Intent (verb, capability, entity)
capabilities.ts THE PRODUCT SURFACE. 28 capabilities; each = one grammar rule,
                one tool, one card. Adding one adds language and routing free.
plan.ts         Intent + node → commands + card
dialogue.ts     the turn machine: focus, ladder, pending question
useAgent.ts     the ONE React seam; dispatches commands onto the store bus
```

Plus: `trace.ts` (what actually happened), `summary.ts` (the closing line),
`workflows.ts` (chains of capabilities), `report.ts` (typesets a run),
`tools.ts`/`runtime.ts` (the language tier), `guard.ts` (grounding).

**The command bus is the only way anything changes the app.** Four operations —
`scope`, `view`, `map`, `clear`. The deterministic agent, the language tier, and
the dev-only agent cockpit all go through it. That is what bounds what an agent
can do: exactly what a user could do by clicking, and nothing else. Do not add a
fifth operation without a very good reason, and never bypass the bus.

**Two tiers, one implementation.** The language tier (Cloudflare Worker → groq
or Workers AI) only ever *picks a tool*. That tool call is converted to the same
`Intent` the grammar produces and runs through the same `runIntent`. So the
model can never do something a user could not type, and the two tiers cannot
drift. On any failure — or after 20 s — it falls back to the deterministic
grammar rather than showing the model's words.

**Verticals** live in `src/tabs/` (exploration, fielddev, drilling, reservoir,
welldelivery). Many *suite* tabs render blueprints, not built viewers. The
surfaces that actually hold content are listed at the top of `capabilities.ts` —
trust that list over the folder names.

---

## Testing

`npm run test:agent` — 12 files, ~545 assertions, the agent stack.
`npm test` — 65 files, everything.

These are **truth-locks**, not unit tests: they assert things about the *data*,
not just the code. `test-coverage.mjs` drives all 28 capabilities end to end;
`test-summary.mjs` proves no summary can carry an ungrounded number;
`test-workflows.mjs` proves a chain is deterministic and that a step is dropped
only when its own probe refuses.

They run in plain Node (native TS stripping), so they exercise the layer that
*decides* rather than the one that paints. If you change behaviour and no test
fails, the test is missing — add it.

---

## Working here

**Verify against the data, not your memory.** Before claiming a field, flag, or
count exists, check it. Several bugs here came from a plausible key name:
`has.traj` vs `has.trajectory` silently produced nothing at all.

**Check the committed tree, not your working tree.** A build can pass locally and
fail on a clean checkout because your tree has an uncommitted file the commit
depends on. This has happened. `git checkout` the commit and typecheck *that*.

**Other sessions edit this repo concurrently.** Files change under you. If
something breaks and heals between two reads, someone is typing in it — do not
"fix" their in-flight work.

**The browser pane must be sized before you trust layout numbers.** A hidden
pane reports a 1 px viewport and every `getBoundingClientRect()` is garbage.
Call `resize_window` first. This has cost time twice.

---

## Dev-only agent cockpit

`.agent/live-state.json` — what is on screen right now (nav, scope, breadcrumb).
`.agent/commands.json` — write `AgentCommand[]` here; the app polls and drains it.

Both are dev-only, loopback-only, gitignored. See `vite-plugin-agent-cockpit.ts`.
Reading the state file beats a screenshot: the app *knows* which well is
selected, so it says so rather than making you infer it from pixels.
