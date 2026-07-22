# V1 Workbench — Data Map (adaptVolve) & engine grounding
2026-07-22 · prep for V1 (Field Development mini-Petrel). Parallel-prepped while M3 UI built. Read-only survey of `data-energy/processed/`.

## Headline: the Volve data is REAL and INTERPRETED end-to-end — no synth needed
The GeaVision reference faked its demo with `synthLog`. We don't. Volve gives us, per well, Equinor's own **computed petrophysics** and **gridded structural surfaces**. This makes V1's Workbench genuinely grounded where the reference was synthetic — a core wedge point.

## 1. Petrophysics — already computed (LFP curves)
The `05.PETROPHYSICAL INTERPRETATION` / LFP log runs (84 CPI/composite runs across all 24 wellbores) carry Equinor's interpreted curves directly:

| Need | Curve (canonical) | Unit | Use in engine |
|---|---|---|---|
| Effective porosity | `LFP_PHIE` | v/v | volumetrics PHIE (measured/interpreted — no Archie needed) |
| Water saturation | `LFP_SWE` | v/v | Sw for HCPV |
| Shale volume | `LFP_VSH` / `LFP_VSHGR` | v/v | NTG cutoff |
| Total porosity | `LFP_PHIT` | v/v | — |
| Sand/net flag | `LFP_SAND`, `LFP_SANDC` | — | NTG directly |
| GR / RHOB / NPHI / RT | `LFP_GR`,`LFP_RHOB`,`LFP_NPHI`,`LFP_RT` | API/g·cm⁻³/v·v/ohm·m | 4-track log viewer |
| Matrix / fluid density | `LFP_RHOMA`(~2.65), `LFP_RHOFLE` | g/cm³ | Archie *recompute* mode defaults |
| Rw, GRmin/GRmax | `LFP_RW`,`LFP_GRMIN`,`LFP_GRMAX` | ohm·m / API | per-well Archie params (not hard-coded!) |
| Temp / pressure | `LFP_TEMP`,`LFP_PRESS` | °C / bar | reservoir conditions |

**Engine design consequence:** the Petro tab has TWO modes — (a) **use interpreted** (`LFP_PHIE`/`SWE`/`SAND`, `dataNature: interpreted`, the default — cite Equinor), (b) **recompute Archie** from GR/RHOB/RT with per-well `LFP_RW`/`GRMIN`/`GRMAX` as defaults (`dataNature: derived`, for teaching/what-if). The reference's single synthetic path becomes a real dual measured/derived path. Note: LFP curves are long lists of `{canonical,source,unit}` objects; the values matrix is index-aligned to `md` (3,905 samples in the sample well) — the engine reads the curve index then the value column.

## 2. Structure — real depth grids (not just picks)
`horizons/` holds 6 gridded depth surfaces as `[x, y, z]` point clouds (UTM31N, m), the real structural model:

| Surface | Points | Role |
|---|---|---|
| `Hugin_Fm_Top…adj2_2760` | 184,066 | **reservoir top** — GRV top |
| `Hugin_Fm_Base…adj_2999` | 186,756 | **reservoir base** — GRV base |
| `BCU…adjVolve` | 230,971 | Base Cretaceous Unconformity |
| `Ty_Fm_Top` | 241,541 | overburden |
| `SHETLAND_GP_Top` | 233,358 | overburden |
| `Seabed` | 516,254 | seabed |
bbox: x 431128–439273, y 6475410–6481865, **z 2707–3366 m TVDSS**. Hugin reservoir ≈ 2760–2999 m.

**Engine design consequence:** `engine.gridSurface` doesn't need to interpolate scattered picks for the reservoir — we already have Hugin Top & Base grids. `engine.grv` integrates directly between the two real surfaces (clip to a closure polygon or the OWC contact). The full clouds (~185k pts) stay in raw/processed; the app loads the `preview` (~4,000 pts, already decimated) for rendering and a moderate grid for volumetrics — cache, don't recompute per frame. Formation picks (`marker`, 409) remain for well-tie posts and cross-section correlation.

## 3. adaptVolve(processed + MODEL) → engine state (the V1 seam)
```
state.meta      = { field:'Volve', crs:'ED50/UTM31N', datum:'TVDSS', units:'m/Sm3' }
state.wells     = wellbores.json → { name(canonical), well, x:surface_ew_m, y:surface_ns_m,
                                     td_md, td_tvd, role(from production flow_kinds), cls:'reported' }
state.tops      = markers (309 field picks) → { well, surface, md, tvdss, cls:'interpreted' }
state.surfaces  = horizons Hugin Top/Base (+BCU) → { name, grid:preview[x,y,z], cls:'interpreted' }
state.logs      = log-samples LFP per well → { curves map, md[], values[][], cls:'measured/interpreted' }
state.production= production.json daily/monthly → per-well time series (Sm3, no conversion), cls:'reported'
state.contacts  = [ OWC ] ← from published ground-truth (research pending) OR derived from Sw logs, cls:'interpreted'/'scenario'
state.props     = per-well zoneAverages(LFP_PHIE, LFP_SWE, LFP_SAND over Hugin interval), cls:'interpreted'
```
Only `contacts` and `Bo`/`RF` need external constants (from the ground-truth research now running) — everything else is in the mirror. Sidetrack lineage via `drilled_from`; identity via `normalizeWellbore` (schema-meta).

## 4. Engine port priority (V1)
1. `makeView` affine + canvas plumbing (foundation for every viewer).
2. **Structural**: load Hugin Top/Base grids → contour map (d3-contour) + `contactPolygon` for closure.
3. **Logs**: videx-wellog track viewer on real LFP GR/RHOB/NPHI/RT + PHIE/SWE/VSH.
4. **Volumetrics**: `grv` between Hugin Top/Base grids × NTG(LFP_SAND) × PHIE(LFP_PHIE) × (1−Sw(LFP_SWE)) / Bo → STOIIP; **validate against published Volve STOIIP** (research pending — this is the credibility check).
5. **Property maps** (well `props` → gridded), **Uncertainty** (Monte-Carlo on the param ranges), **Forecast** (Arps + material balance vs the 15,634-row production history — real history-match!), **Economics**, **Deck/Report**.

## 4b. Reservoir constants & validation targets (published ground truth — cite provenance)
From the ground-truth research (see sources below). Tag each in-app: **[OFFICIAL]** Equinor/Sodir · **[PEER]** SPE/journal on the released dataset · **[COMMUNITY]** thesis/textbook. **No single Equinor-FDP headline STOIIP exists** — field STOIIP is model-based [PEER], so badge it `interpreted`, never `measured`.

| Constant | Default | Prov | Engine use |
|---|---|---|---|
| STOIIP (full field) | **≈ 22 MMSm³** (~138 MMstb) | [PEER] jestec | **volumetrics validation target** |
| Porosity φ (Hugin avg) | 0.225 | [PEER] | volumetrics default (else per-well LFP_PHIE) |
| Net-to-gross | 0.90 | [PEER]/[COMMUNITY] | NTG default (else LFP_SAND) |
| Water saturation Sw | 0.20 (Swc 0.20) | [PEER] | HCPV default (else LFP_SWE) |
| Matrix density ρ_ma | 2.65 g/cc | textbook | Archie recompute |
| Archie a / m / n | 1 / 2 / 2 | [COMMUNITY] | Archie recompute (no Volve-specific override published) |
| **Oil FVF Bo (datum)** | **≈ 1.47 rm³/Sm³** (live oil, undersaturated) — NOT 1.18 (dead-oil, overstates STOIIP ~25%) | **[DECK]** PVTO region 1 | STOIIP divisor — extracted from VOLVE_2016.PRT |
| Rs (solution GOR, datum) | **148 Sm³/Sm³** (main field; 19A area ~121) | [DECK] RSVD | PVT |
| Oil gravity | 30° API; oil density 882 kg/m³, water 1101.3 | [DECK] DENSITY | PVT |
| Pi / Pb | **337 bara / 256 bara** (undersaturated, Pi≫Pb → **no gas cap**) | [DECK] EQUIL | conditions |
| Reservoir T | 110 °C · datum **3060 mTVDSS** · ROCK cf 2.0e-5/bar @329 bara | [DECK] | conditions |
| Salinity | 151,200 ppm | [PEER] | Rw derivation (~0.02–0.03 Ω·m @110°C) |
| OWC (main structure) | **3,200 mTVDSS** (deck EQUIL; other compartments 2,700–3,025 — field is 29-fault) | **[DECK]** EQUIL | contact for GRV clip |
| GOC | none (undersaturated) | [PEER] | — |
| Recovery factor | 46–54% achieved | [PEER] | forecast sanity |
| Cum oil produced | **~63 MMbbl** (Feb 2008–Sep 2016, ~8.5 yr) | [OFFICIAL] | production reconciliation |
| Peak oil | ~56,000 bopd (~9,000 Sm³/d, Feb 2009) | [OFFICIAL] | forecast anchor |
| Injectors | **I-F-4** (Apr 2008), **I-F-5** (Aug 2008); VRR≈1 | [PEER] | injector benchmark; P-F-5 producer→injector |
| MBAL tank check (F-12) | STOIP 19.6 MMSm³ | [PEER] Metsebo | **tank/decline model validation** |

Populate `adaptVolve` §3 with: `state.contacts=[{kind:'OWC', tvdss:3120, cls:'interpreted'}]`, `state.props` defaults above (overridden per-well by LFP zone averages), `state.pvt={Bo, Rs:114, Pi:330, Pb:273, T:110}`.

## 4c. STOIIP reference spread (three published anchors — surface all three, never hide the gap)
Our screening volumetric (blanket deck-OWC 3200 over the unfaulted mapped closure) is a deliberate **upper bound**:
- **Screening (blanket OWC, unfaulted) ≈ 142 MMSm³** — the workbench default; captures the whole connected structure incl. water legs.
- **Per-well/faulted volumetric analogue 67.6 MMSm³** [PEER Metsebo].
- **Faulted dynamic model ≈ 22 MMSm³** [PEER] — the realistic in-place; the deck's own FIPNUM OOIP.
The ~6× screening→dynamic spread = fault compartmentalization + per-compartment contacts (2700–3200 m). The V1c Volumetrics viewer exposes OWC + fault-polygon scope so the user drives the number down toward the dynamic value — the spread IS the teaching, shown not hidden. The TIGHT truth gate is cum-oil (below), not STOIIP.

## 5. Validation hooks (Fable-worthy at build time) — all in test-engine.mjs (14/14 pass)
- **cum-oil reconciles ~63 MMbbl (10.04 MMSm³)** — the tight published gate; validates the production decode exactly.
- STOIIP screening = 142 MMSm³ **parity** with the wb build (same grids/params/formula) + a gross-error gate (40–220); NOT gated against a field number (method-dependent).
- Bo deck-sourced (1.47, live-oil) not the dead-oil 1.18; OWC deck 3200.
- TVD ≤ MD on all 1593 definitive trajectory stations; PERT/percentile/Arps/NPV analytic identities.
- **Cum oil from production.json must reconcile with ~63 MMbbl** (~10 MMSm³) produced — a direct measured check on the production sum.
- Tank/decline forecast for F-12 should approach STOIP≈19.6 MMSm³ with Pi 330→ over life (Metsebo MBAL analogue).
- Hugin top/base grid z in 2760–2999 m; OWC 3120 sits below base in the main compartment (consistent).
- Computed STOIIP must land near published Volve figures (research pending) — if off by >2×, the grid/param mapping is wrong.
- Cumulative oil from `production.json` (Σ ~ ? Sm3) must reconcile with published ~63 MMbbl produced.
- Hugin top/base grid z-range must sit in 2760–2999 m (sanity: it does).
- Every derived volume/forecast badged `derived`/`scenario`; interpreted PHIE/SWE badged `interpreted` with Equinor citation; nothing synthetic.

> Next: fold the ground-truth research (STOIIP, Bo, OWC, Archie constants) into §3 contacts/props defaults, then V1 engine port. The engine numerics remain a Fable-verify gate.

## Sources (ground truth)
- [OFFICIAL] Sodir/norskpetroleum Volve field: https://www.norskpetroleum.no/en/facts/field/volve/
- [OFFICIAL] Equinor data sharing: https://www.equinor.com/energy/volve-data-sharing
- [PEER] jestec 2022 (STOIIP, contacts Table 3, Pi/Pb/T, GOR, injectors, RF): https://jestec.taylors.edu.my/Vol%2017%20Issue%204%20August%202022/17_4_22.pdf
- [PEER] Metsebo 2021 JENR (F-12 volumetric vs MBAL, φ/Sw/API/salinity/GOR): https://medwinpublishers.com/JENR/comparison-study-between-different-methods-used-in-the-estimation-of-reserves-in-well-f-12-of-volve-field.pdf
- [PEER] MDPI Appl. Sci. 2024 (NTG, porosity, rock physics): https://www.mdpi.com/2076-3417/14/4/1345
- [COMMUNITY] Runnable Eclipse deck (PVT/Bo curve source): https://github.com/f0nzie/volve_eclipse_reservoir
