# S1 — Geostat + Grid Engine Spec (truth-locked)
v1.0.0 · 2026-07-22 · Fable. Parent: M5-STATIC-DYNAMIC-MODELING-CONCEPT.md. **This is the locked numerics contract.** The reference implementations in `scripts/test-geostat.mjs` ARE the spec — Opus ports them 1:1 into `src/engine/{geostat,grid3d,perm}.ts`; the PARITY block (guarded by `existsSync`) then confirms the built engine reproduces every reference number. 30/30 reference assertions green.

> Rule: **do not re-derive.** Port the reference functions verbatim (same formulas, constants, conventions), export the signatures below, and make `npm run test:geostat` pass its parity block. Then wire the S2 "Grid & Property Model" tab on top.

## Modules & signatures (port to `src/engine/`)

### `geostat.ts`
```ts
type VarioModel = 'spherical' | 'exponential' | 'gaussian';
interface Vario { model: VarioModel; nugget: number; sill: number; range: number } // sill = TOTAL sill
interface Pt { x: number; y: number; v: number }   // conditioning datum (v = value or 0/1 indicator)

variogram(h: number, p: Vario): number             // γ(0)=0; γ(h>0)→nugget as h→0+
cov(h: number, p: Vario): number                    // C(0)=sill; C(h>0)=sill−γ(h)
ordinaryKrige(data: Pt[], target: {x,y}, p: Vario): { est; variance; wsum }   // Σλ=1
simpleKrige(data: Pt[], target: {x,y}, p: Vario, mean: number): { est; variance }
buildNscore(values: number[]): { ns: number[]; table: {v,ns}[] }   // rank→qnorm((r+0.5)/n)
backNscore(nsVal: number, table): number            // piecewise-linear, clamped to data range
sgs(cond: Pt[], targets: {x,y}[], p: Vario, seed: number): number[]   // back-transformed
sis(cond: {x,y,f}[], targets: {x,y}[], p: Vario, seed: number, globalP?: number): (0|1)[]
```
Locked conventions (each has a passing assertion):
- **Variogram:** spherical `nugget + c·(1.5(h/r) − 0.5(h/r)³)`, reaches sill exactly at `h=r`; exponential/gaussian use the **3·h/r practical-range** form (≈95 % of sill at `h=r`). `c = sill − nugget`.
- **Covariance:** `C(0)=sill` (full), `C(h>0)=sill−γ(h)`. Nugget lives ONLY on the diagonal discontinuity ⇒ **kriging honors data exactly** (GSLIB convention) even with a nugget.
- **Kriging:** ordinary → weights sum to 1, exact at data points, constant field → constant. Simple → known mean, variance ≥0 and =0 at data. Dense Gaussian-elimination solve (small K).
- **Search neighborhood:** nearest **K=16** conditioning data per estimate (keeps kriging O(K³), not O(n³), as the simulated set grows). Part of the algorithm, not an optimization to add later.
- **Normal score:** rank → `qnorm((rank+0.5)/n)` (Acklam inverse-CDF); round-trip exact at data; transformed data ~ N(0,1).
- **SGS:** normal-score the conditioning data → random path (seeded shuffle) → **simple kriging (mean 0)** in NS space for {est, var} → draw `est + √var·gauss(rng)` → append → back-transform. Colocated targets reproduce data; seeded-reproducible; ensemble mean far from data → global mean (unbiased).
- **SIS (2-facies):** **simple INDICATOR kriging with the target proportion `gp` as the known mean** (NOT ordinary — ordinary lets the local mean float and drifts NTG). `prob = clamp(SK est, 0, 1)`; draw SAND if `rng() < prob`. Honors global NTG (0.70 → 0.703); reproduces conditioning; binary; seeded-reproducible.

### `grid3d.ts`
```ts
layerThickness(topZ, baseZ, nz): number             // proportional: (baseZ−topZ)/nz
bulkVol(dx, dy, thk): number                        // dx·dy·thk (vertical pillars)
hcpv(cells: {active,bulkVol,ntg,phi,sw}[]): number  // Σ active bulkVol·ntg·φ·(1−Sw)
// + buildGridModel(surfaces, picks, layering) → GridModel (M5 §2.1) — Opus assembles
```
**Reconciliation identity (the S2 gate):** for a uniform property cube, `hcpv == STOIIP·Bo` exactly; the built GridModel's HCPV must match the deterministic Volumetrics STOIIP within **±5 %**. Inactive cells excluded.

### `perm.ts`
```ts
phiToK(phi, a=30, b=-1): number   // log10(k_mD)=a·φ+b — strictly monotone ↑, k>0
permKv(kh, kvkh=0.1): number      // kv = kh·kvkh
```
Deterministic φ→k transform (screening); replace `a,b` with a core-cloud fit when core is available. Perm is the bridge static→dynamic (feeds the M5 pressure kernel).

## Test targets (already locked in `scripts/test-geostat.mjs`)
Run `npm run test:geostat` (or `npm test` for engine+geostat). 30 assertions: variogram shape (6) · kriging identities (6) · normal-score (2) · SGS (6) · SIS (5) · grid3d/HCPV (4) · perm (2), plus a PARITY block that activates once `src/engine/geostat.ts` exists and asserts `variogram`, `ordinaryKrige` exactness, and byte-identical `sgs` for the same seed.

## What Opus builds in S1 (impl only — numerics are locked)
1. `src/engine/geostat.ts`, `grid3d.ts`, `perm.ts` — port the reference fns, export the signatures above, DOM-free, pure TS.
2. Make the `test-geostat.mjs` PARITY block green (same seed → identical SGS/SIS; kriging exact; variogram identical).
3. `tsc` clean, existing `test:engine` still 36/36. Commit to **main**.

S2 (next) consumes these to build the "Grid & Property Model" tab (SIS facies + SGS porosity cube, 2D map + cross-section, HCPV-reconciliation banner). Do NOT start the simulator (S4+) until the static cube reconciles.
