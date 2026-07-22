# V1b + V1c — Field Development workbench completion

2026-07-22 · Opus. Parent specs: docs/arganta-energy/V1BC-SPEC.md (incl. "Founder specifics 2026-07-22"), V1-SPEC §3–4, V1A-POLISH-SPEC (premium/interactive bar). Numerics truth = apps/energy/scripts/test-engine.mjs.

## What shipped
Completed the 7 remaining fielddev subtabs (Petrophysics, Structural, Property · Volumetrics, Uncertainty, Forecast, Economics), all live-routed in `FieldDev.tsx`, registry flipped to `live`. V1a Map/Logs/Correlation untouched.

## Engine (new pure-TS modules in src/engine/, ported 1:1 from test-engine)
- `petro.ts` — vsh (Larionov tertiary/older/linear), phit, phie, sw (Archie), netFlag, zoneAverages (net-weighted).
- `upscale.ts` — upscaleMean (continuous), netFraction (SAND), majority (facies), upscaleWell (Hugin-interval block).
- `volumetrics.ts` — grvClosure (crest flood-fill) / grvPolygon (point-in-poly) / grvWell (drainage ∩ closure); stoiip, giip (Bg 0.0040), solutionGas (STOIIP·Rs); BBL 6.2898, SCF 35.3147.
- `mc.ts` — mulberry32, gauss, gamma (Marsaglia–Tsang), beta, samplePert (λ=4), sampleTri, percentile, monteCarlo (oil P90=pct10/P50/P10), pearson, tornado.
- `dca.ts` — arps, arpsCum (trapezoid), fitArps (log-linear on decline), eur.
- `econ.ts` — cashflow, npv (mid-year `1/(1+r)^(y+0.5)`), payback, irr-lite, ECON_DEFAULTS (Fable-set: $70/bbl, $6/Mscf, $14/bbl+$45MM/yr, $1.2B/$80MM, 10%, $150MM aband, 78% tax).
- Shared: `propsStore.ts` (zustand, Petrophysics→Property/Volumetrics), `fdData.ts` (resilient loader; aliases the `19 BT2`→`19-b-bt2` / `19 SR`→`19-s-sr` wb log-slug quirks).

## Parity gate
Extended test-engine.mjs with a PARITY block (Node 24 native TS strip → `import` the built engine). Asserts engine == reference for RNG sequence, samplePert draw, percentile, grvClosure GRV, **STOIIP 142.3** (engine==ref==wb `validation.stoiip.stoiipMMSm3`), GIIP inverse-Bg (52.31 BSm³), solutionGas, arpsCum, NPV, upscaling, ECON_DEFAULTS. **36/36 pass** (was 23/23).

## Data reality folded in
- OWC = **3200 m** (deck main structure), Bo 1.47, Rs 148 — from wb index; the V1BC-SPEC prose's stale 68.4/3120 numbers were superseded by test-engine + index.json.
- Only the 15/9-19 exploration wells carry LFP curves (PHIE/SWE/VSH/SAND) + Hugin picks → Petrophysics zone averages + full upscaling; producers have raw logs (+SAND on F-12). Handled gracefully.
- Pick TVDSS stored negative-down → negated for honest mistie posting.

## Verified (browser, DOM + settled-2D screenshots)
- **Petrophysics** — 19 A: interp/derived zone table NTG 0.919/0.939, PHIE 0.203/0.222, SW 0.182/0.180 (recompute within ~0.02 of interpreted); LFP-seeded params; 11 sliders; writes props store.
- **Structural** — QC (11,691 filled, 29.2 km²), OWC editor→scenario, closure 9,745 cells, honest mistie (19 A −83, F-11 T2 +312), upscaling (19 A φe 0.191 / 92% / SAND).
- **Property** — porosity IDW + facies + HCPV; **STOIIP(grid) 142.3 = det 142.3, Δ 0.0%** (reconciles ±5% via background-regularized IDW).
- **Volumetrics** — closure STOIIP **142.3 MMSm³** (895 MMbbl), GIIP gas **52.31 BSm³** scenario, solution gas 21.07 BSm³; validation banner 142 vs 67.6 vs ≈22 (compartmentalization).
- **Uncertainty** — 10k seed 20260722, P90 54.2 ≤ P50 67.7 ≤ P10 83.6; **reproducible** (identical P50 after remount); tornado sorted |r| (GRV 0.57 → PHIE 0.47 → RF 0.41…, Sw/Bo negative); editable PERT/tri rows.
- **Forecast** — F-12 Arps (qi 166.4k, Di 3.6%/mo, EUR 8.04 MMSm³); offset P90–P10 envelope; MBAL 19.6; injectors I-F-4/I-F-5; screening label.
- **Economics** — NPV@10% $1435MM, payback 1.6yr, cum 63 MMbbl; 78% tax toggle → NPV −$133MM (interactive); "not investment advice".

## Status
tsc strict clean · `vite build` green · test-engine 36/36 green · no console errors from fielddev components (only stale pre-restart StatusBar/ContextBar HMR artifacts remain, files not in tree).

## Gotchas
- **Canvas `fillStyle` does NOT support `color-mix()`** (only DOM CSS does) — it silently renders black. Caught the Hugin band rendering black; replaced every canvas color-mix with `withAlpha(cssVar(...), a)` across Petrophysics/Uncertainty/Economics/Forecast.
- Screenshot tool wedges on the Volumetrics 2D canvas (heavy per-render closure) — verified it via DOM only, per SOP.
