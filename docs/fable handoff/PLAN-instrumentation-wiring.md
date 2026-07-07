# PLAN-instrumentation-wiring.md
### For Sonnet 4.6, executed with the ArgantaLab repo mounted. Written from RECON.md (July 7, 2026).
### Goal: move all 15 blind nodes from `placeholder` → `partial`/`live`. Scorecard: `coverage.pct` 78% → 90%+ (re-pull `ceo_brief` after each batch).

---

## STEP 0 — DISCOVER CONVENTIONS (do first, everything depends on it)

The repo was NOT readable when this plan was written. Before wiring anything:

1. Find an existing **live** signal's write path — good candidates: whatever fires `kin.calendar` "Events added", `arganta.quests` "Quest completes", or `learn.drill` accuracy (all live/green in the graph).
2. Record: Supabase table name, event schema (name, payload shape, user/family id fields, timestamp, session id), client helper used (SDK call? direct insert? edge function?), and how Circle HQ ingests it into node provenance.
3. Write the answer into this file under this step. **Every event below must copy that convention exactly** — no new tables or shapes unless none exists.
4. Confirm which app hosts each surface (ArgantaLab app, KinetikCircle app, landing site) and locate the owning component per event.

## STEP 1 — WIRE APP EVENTS (batch by lever, verify per batch)

Order: efficiency (weakest lever) → breadth funnel → depth → money. Per event: implement → fire manually in dev → confirm row lands in Supabase → confirm node provenance moves off placeholder.

### Batch A — efficiency (activation)
| Node | Event | Fire condition | Double-fire guard | Silent-failure check |
|---|---|---|---|---|
| `sig.dead_end_quit` | `dead_end_quit` | Session ends on a screen with no next action available | One per session end, debounce on visibility/unload | Unload handlers are lossy — use `sendBeacon`/queued flush, not plain fetch |
| `sig.calendar_open_no_add` | `calendar_open_no_add` | Calendar opened, session ends with no event added | Evaluate once at session end, not per open | Requires session-scoped state; don't fire if an add happened in ANY tab |
| `arganta.home` | `home_view` (+ dwell ms) | Home tab mounted | Dedupe re-mounts within same session | Dwell must stop counting when backgrounded |

### Batch B — breadth (top-of-funnel, currently totally dark)
| Node | Event | Fire condition | Guard / note |
|---|---|---|---|
| `land.home` | `waitlist_joined` | Waitlist form success response | Fire on server confirm, not button click |
| `land.products` | `product_view` | Product section/page viewed | Include which product in payload |
| `land.pitch` | `deck_view` | Deck opened | Include deck id |
| `sig.deck_no_waitlist` | `deck_no_waitlist` | Deck viewed AND no waitlist join in same session | Derived at session end — consider computing server-side from the two events above instead of a third client event (simpler, can't disagree with its inputs) |
| `ship.discover` | `discover_install_attributed` | Play/install started from Discover surface | Attribution param must survive navigation |
| `sig.broken_share_link` | `share_link_broken` | Share-link open 404s / fails to resolve | Must fire from the FAILURE path — the page that renders the error, plus server log fallback (client may never load) |

### Batch C — depth + money
| Node | Event | Fire condition | Guard / note |
|---|---|---|---|
| `sig.build_abandoned` | `build_abandoned` | Build started, not published within N sessions/minutes | Define N explicitly (suggest: 2 sessions or 48h). Server-side sweep job, not client event — client can't see "never came back" |
| `sig.paywall_bounce` | `paywall_bounce` | Paywall shown, dismissed/left without purchase | One per paywall impression; don't fire if purchase completes later in session |
| `sig.ugc_flagged` | `ugc_flagged` | Moderation flag raised on any UGC surface (Build/Fame/Moments) | Fire from the moderation path server-side; include surface + reason |

## STEP 2 — LEGAL REGISTERS (different work type — data, not events)

`legal.ip` and `legal.risk` are registers. Wiring = create the table + seed real content:
- `legal.ip`: list actual IP assets (repo, brand names Arganta/Kinetik/Circle HQ, character designs, domain names). Even 5 real rows moves it off placeholder honestly.
- `legal.risk`: open holds/risks — seed from what's already known (UGC review gating monetization is an answered consult; COPPA/child-data exposure is inherent to the product). Zero invented entries.
- `app.landing` (container): verify it derives from land.* children after Batch B; if not, one rollup rule in the Bridge server.

## STEP 3 — ADVERSARIAL VERIFICATION (gate before "done")

For every wired signal, a reviewer pass answers in writing:
1. Fires on the right condition? (trace the actual code path)
2. Can it double-fire? (remount, refresh, back-button, two tabs)
3. Can it fail silently? (offline, unload, adblock, error paths)
4. Matches the Step 0 convention exactly?
5. Provenance actually moved in the graph? (re-pull `office_report` — the ONLY accepted proof)

Also verify Tier-3 live signals didn't regress (sensor plan §4: don't break Learn subtabs, Calendar, Moments etc. while touching shared plumbing).

## ACCEPTANCE CRITERIA

- All 14 INSTRUMENT verdicts' target nodes ≥ `partial`; `coverage.pct` ≥ 90.
- Zero new event tables/shapes that duplicate an existing convention.
- Each event has a one-line "verified by" note (who fired it, row id seen).
- Anything not finished is listed in PLAN-followup.md, not marked done.

## EXPLICIT NON-GOALS
- No FIX-class guardrail work (invite flow, difficulty mismatch etc.) — separate effort.
- No Phase-2 funnel modeling until these signals have real history (days, not hours).
- No production data migrations or deletions without stopping to flag.
