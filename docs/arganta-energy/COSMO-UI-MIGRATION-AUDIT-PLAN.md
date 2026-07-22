# ArgantaEnergy → COSMO UI/UX — Total Migration Audit & Plan
v1.0.0 · 2026-07-22 · Fable. Audit of the current ArgantaEnergy shell against the **COSMO_Final** reference design system, and a staged plan to **totally migrate the UI/UX** to it. We migrate the **visual language + information architecture + component library**; we keep **ArgantaEnergy/GeaVision identity and every built engine** (Field Development tabs, sim, analog, review — all intact). Reference is the founder's own RMO-Cosmo material; we adopt the *design system*, not RMO names/data (per the standing read-only-identity rule).

## 0 · Verdict
The current shell is a **dark-first "engineering control room"** (near-black `#071014`, mono-heavy, dense, tactical). COSMO is a **light-first, SaaS-grade enterprise operating environment** (soft `#f5f7fa`, Inter-led, generous radii/shadows, a teal-anchored accent system, animated cockpit, a polished 3-pane Cosmonaut). COSMO is **more legible, more modern, more "product," and richer in components** — it is the right target. The migration is large but mostly mechanical: a **token swap + shell rebuild + component port**, because our viewers already read CSS variables (so they re-theme largely for free) and our Cosmonaut is already a 3-pane concept. The real work is IA discipline (COSMO's 4-level information architecture) and QA'ing the built canvases under a light theme they were never tuned for.

## 1 · Side-by-side audit
| Dimension | Current ArgantaEnergy | COSMO_Final (target) | Action |
|---|---|---|---|
| **Identity** | dark reactor / control-room, mono | light-first SaaS, Inter + mono accents, teal | **Flip to COSMO**; dark becomes the *alt* theme |
| **Base tokens** | `--bg #071014`, `--text #e5eef0`, 5 accents | `--bg #f5f7fa`, `--ink #0f172a`, teal `#0FB5A6` + 9 accents, 2 shadows, radii 9–16px | **Replace token file** |
| **Type** | mono-heavy, 13px | Inter 300–900 + JetBrains Mono, 13px, tighter tracking | Adopt Inter scale |
| **Layout** | flexbox: Drawer + ContextBar + main + MobileBar | CSS grid `236px / 1fr` × `54px / 1fr / 26px` (sidebar·topbar·content·footer) | **Rebuild shell to the grid** |
| **Nav model** | 4 zones (command/vertical/intelligence/foundation) + orb; ContextBar subtabs | sidebar nav w/ status pills + sovereign tier bar; topbar breadcrumbs; tab bar; page headers | **Adopt 4-level IA** (§3) |
| **Cards** | panels, mono chips | `.panel` `.metric` (colour edge + big num + dataNature badge) `.chip` `.ph` dashed placeholders | **Port component library** |
| **Workspace** | per-tab bespoke | `.ws` canvas+inspector, toolbar segmented, evidence badge, CRS, scalebar | **Standardise** on `.ws` |
| **Cockpit** | Stub | aurora hero, 5-KPI grid, lifecycle lanes, live agent rows | **Build** (Core cockpit) |
| **Data Map** | SchemaTab (canvas) | D3 org-chart, draggable node cards, count badges, legend | **Upgrade** to COSMO org-chart |
| **Docs/Reports** | — | Word-like doc, page thumbnails rail, artifact state | **New** (Artifact Studio) |
| **Cosmonaut** | orb + overlay (concept) | orb + **3-pane canvas** (history/stream/artifact), model selector w/ tier weights, usage strip, thinking trace, artifact device presets (16:9/4:3/tablet/phone), 80% modal | **Migrate to full 3-pane** |
| **Responsive** | 5-item mobile bar, sheet | desktop/slide-over/mobile states, panel negotiation, aspect presets | Adopt the responsive contract (§7) |
| **Stack** | React+TS+Vite+zustand, Lucide, modular | React UMD + htm + Lucide + marked + D3, single file | Keep our stack; port the *design* only |

## 2 · What COSMO wins on (why migrate) & what we preserve
**COSMO wins:** legibility (light, air, hierarchy), a coherent tokenized accent system, the **dataNature badges as first-class** (`nat-meas`/`nat-interp`/`nat-der`), the polished 3-pane Cosmonaut with a model-tier selector, the cockpit/lifecycle mental model, and a far larger, consistent component vocabulary.
**Preserve from current (do NOT lose):** every Field Development engine & tab (Grid Model, Simulation, Streamlines, Volumetrics, Uncertainty, Forecast, Field Review with the analog/blind-test panel), the real WebGL 3D, the 158-assertion truth-lock, the evidence/`dataNature` discipline, and ArgantaEnergy/GeaVision naming.

## 3 · Information-architecture migration (the discipline layer, from the lessons report)
Adopt the **strict 4-level IA** — only one dominant surface per level:
1. **Global** — field · lifecycle · search (⌘K) · notifications · user · active scope (the sidebar + topbar).
2. **Workspace** — the vertical + its current workflow (Field Development → subtab).
3. **Canvas** — map / log / chart / 3D / graph / document (the `.ws-canvas`).
4. **Context** — evidence · properties · provenance · agent trace · actions (the `.insp` inspector).
Drawers *supplement*, never become a second app. Every analytical view **declares method · source · units · status** (evidence badge + CRS + scalebar). No blank error states — degraded/partial states are first-class ("no evidence", "stale", "conflict", "model unavailable").

## 4 · Design-token migration (U0 — the foundation)
Replace `theme.css` with the COSMO token set, **light as default**, dark as the alt (inverts current polarity):
- `--bg #f5f7fa · --panel #fff · --panel2 #fbfcfe · --panel3 #f1f5f9 · --ink #0f172a · --ink2 #475569 · --ink3 #94a3b8 · --line #e2e8f0` + teal `#0FB5A6` (`--teal-soft`, `--teal-ink`) + blue/cyan/green/purple/amber/red/violet/orange, two shadows, `--mono`/`--sans`, `--sbw 236px`; `html.dark{…}` for the dark alt.
- **Token-name bridge:** our components use `--text/--muted/--panel-2/--sel`; COSMO uses `--ink/--ink2/--ink3/--panel2`. Add **alias vars** (`--text:var(--ink)`, `--muted:var(--ink2)`, `--panel-2:var(--panel2)`) so the ~30 built viewers re-theme without edits, then migrate names opportunistically.
- Fonts: load Inter + JetBrains Mono (self-host, not CDN — CSP/offline).

## 5 · Component-library migration (U2)
Port the COSMO CSS component set into our styles (verbatim classes, our tokens): `.panel`/`.panel-hd`/`.metric`(+`.edge`)/`.chip`/`.ph` · `.nat-meas`/`.nat-interp`/`.nat-der` (map to our `dataNature`) · `.ws`/`.ws-canvas`/`.ws-toolbar`/`.seg`/`.insp`(+`.kv`,`.tree`) · `.evbadge`/`.crs`/`.scalebar` · `.pagehd`(+`.pico`) · `.cockpit`/`.ck-hero`(aurora)/`.ck-kpis`/`.lifelane`/`.lane` · `.tabs`/`.tab` · sidebar `.navitem`(+`.st-LIVE/BETA/PLANNED`,`.vdot`)/`.sov` tier bar · topbar `.crumbs`/`.tbadge`/`.ibtn`/`.newbtn`/`.avatar` · footer. Wrap each as a small React component in `components/ui.tsx` so tabs consume them, not raw class strings.

## 6 · Cosmonaut migration (U5)
Migrate the orb + overlay to COSMO's **3-pane `.cosmo-canvas`**: `.cc-top` header · `.cc-left` (sessions/artifacts/library tabs) · `.cc-mid` stream (`.msg` user/assistant bubbles, `.think` collapsible reasoning trace, `.art-chip`) · `.cc-right` artifact viewer (device presets `.cc-dev` 16:9/4:3/tablet/phone, `.art-modal` 80%) · `.cc-composer` unified input (`.cc-shell`, `.cc-tray`, `.cc-mdl` model selector with `.cc-weight` tier dots + `.cc-usage` strip). This directly serves the **agentic-trace requirement** (intent→plan→routing→evidence→calculation→validation→artifact) — wire the trace to real engine runs when the agent lands; canned until then, clearly labelled "prototype response."

## 7 · Responsive contract (U6)
- Desktop ≥1440: canvas-first, one docked context panel, others overlay.
- 1024–1439: canvas-first, drawers overlay.
- Tablet: one panel at a time, persistent breadcrumb + scope.
- Phone: bottom nav only, full-screen transitions, artifact & chat as separate routes.
- **Preserve selection/scroll/zoom/camera/filters/draft across every transition.**

## 8 · The risk that needs real QA: light-first canvases
Our Field Dev viewers (Map, Grid Model 2D/3D, Simulation, Streamlines, cross-sections, charts) were tuned against the **dark** palette. They read `cssVar()`, so they re-theme automatically — **but colour choices baked for dark backgrounds (front colours, ramps, the WebGL cube lighting/clear colour, streamline alpha) will need a light-mode pass.** Budget explicit QA per canvas: colormaps, contrast, the r3f scene background/lights, and the `withAlpha()` overlays. This is the single biggest hidden-work item.

## 9 · Risks & mitigations
- **Polarity flip (dark→light default)** breaks baked contrasts → alias tokens + per-canvas QA (§8); keep dark as a first-class alt so nothing is lost.
- **IA regression** (COSMO is dense; the report itself flags "too many nav surfaces") → enforce the 4-level rule; one dominant surface per level.
- **Scope creep** (cockpit, Data Map org-chart, Artifact Studio, DE universe are aspirational) → migrate the *shell + built tabs* first (U0–U3); treat new surfaces as later phases.
- **Single-file → modular**: don't copy COSMO's global-state/single-file shape; keep our modular TS + zustand; port only CSS + markup patterns.
- **Fonts/CDN**: self-host Inter/Lucide/marked/D3 (CSP, offline, our existing rule).

## 10 · Staged roadmap (U-series)
| Phase | Ships | Gate |
|---|---|---|
| **U0 · Tokens** | COSMO token set (light default + dark alt) + alias bridge + self-hosted fonts | app renders in COSMO palette; built tabs re-theme; both themes AA |
| **U1 · Shell** | grid shell: sidebar (nav pills + sovereign bar) · topbar (crumbs/badges/new/avatar) · tab bar · footer · orb | navigation parity with today, COSMO look |
| **U2 · Components** | `ui.tsx` port (panel/metric/chip/ph/ws/insp/pagehd + dataNature badges) | tabs recomposed on the new components |
| **U3 · Field Dev re-skin + light QA** | every Field Dev tab on `.ws` canvas+inspector; per-canvas light-mode QA (§8) | all viewers legible + correct in light & dark |
| **U4 · Cockpit + IA** | Core cockpit (aurora hero, KPIs, lifecycle lanes) + 4-level IA enforcement | one dominant surface per level; no blank states |
| **U5 · Cosmonaut 3-pane** | full `.cosmo-canvas` (stream/artifact/model-tier/trace) | agentic-trace shell, labelled prototype where canned |
| **U6 · Responsive** | desktop/tablet/phone contract + state preservation | no squeezed center; state survives transitions |
| **U7 · New surfaces** | Data Map org-chart · Artifact Studio (doc/report + state machine) · DE universe | as separately-versioned modules |
| **U8 · QA hardening** | visual-regression + a11y + theme snapshots + evidence-badge audit | every analytical view declares method/source/units/status |

**Recommended first cut: U0 → U3.** Tokens + shell + components + the Field Dev re-skin (with the light-mode canvas QA) *is* the "total migration" of everything already built — it makes ArgantaEnergy look and feel like COSMO end-to-end. U4–U7 add the aspirational COSMO surfaces on top.

## 11 · Acceptance
Migration is "done" when: the whole app renders in the COSMO design language (light default, dark alt, both AA); every built Field Dev engine/tab works unchanged and is legible in both themes; navigation follows the 4-level IA; the Cosmonaut is the 3-pane canvas; every analytical view shows method·source·units·status with `dataNature` badges; no blank error states; and the 158-assertion truth-lock + build stay green throughout (UI migration must not touch engine numerics).
