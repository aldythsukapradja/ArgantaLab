# S4 — Shared Pressure Kernel + PVT + Relperm Spec (truth-locked)
v1.0.0 · 2026-07-22 · Fable. Parent: M5-STATIC-DYNAMIC-MODELING-CONCEPT.md. **Locked numerics contract.** Reference impls in `scripts/test-sim.mjs` ARE the spec — ported 1:1 into `src/engine/sim/{pressure,pvt,relperm}.ts`; the PARITY block confirms the built engine reproduces them. 31/31 green (26 reference + 5 parity). Engine-only — no UI (the Simulation tab arrives in S5).

> The elliptic **pressure kernel is built once and shared** by both simulator twins: the FV black-oil sim (S5) and the streamline sim (S6) solve the SAME TPFA pressure equation, then branch only on transport. S4 delivers the kernel (single-phase incompressible + validation) and the PVT/rock-fluid property functions; S5 layers multiphase mobility weighting on top.

## Modules & signatures (`src/engine/sim/`)

### `pressure.ts`
```ts
halfTrans(k, A, d): number                       // k·A/d
faceTrans(kA, kB, A, dA, dB): number             // harmonic of the two half-trans
peacemanR0(dx, dy): number                        // 0.14·√(dx²+dy²)
peacemanR0Square(dx): number                      // 0.2·dx
wellIndex(k, h, r0, rw, skin=0): number           // 2πkh/(ln(r0/rw)+skin)
cg(apply, b, tol?, maxit?): Float64Array          // matrix-free conjugate gradient (SPD)
solvePressure(cfg): { p, wellRate, faceFluxX, faceFluxY }
  // cfg = { nx, ny, dx, dy, dz, k[nx*ny], mu, wells:[{i,j,mode:'bhp'|'rate',bhp?,rate?,WI?}] }
```
Locked conventions (each asserted):
- **TPFA:** `faceTrans` = harmonic combination of half-transmissibilities; homogeneous ⇒ `k·A/dx`; heterogeneous ⇒ dominated by the low-k block (harmonic).
- **Assembly:** conservation per cell `Σ_faces T/μ·(p_n−p_c) + wells = 0`; BHP well → diagonal `WI/μ` + rhs `WI/μ·pwf` (SPD, M-matrix); rate well → rhs source. Upstream mobility weighting is added in S5 (multiphase).
- **Solver:** matrix-free CG (SPD holds for incompressible + BHP wells); converges the 1D linear profile to <1e-4.
- **Validation identities:** 1D flux continuity (every interior face carries the injection rate), homogeneous ⇒ linear pressure, heterogeneous ⇒ larger Δp across the tight block, five-spot mass balance (producer ≈ −injector), injector cell is the pressure max, Peaceman WI + skin monotonicity.

### `pvt.ts`
```ts
VOLVE_PVT = { pb:213, rsb:160, bob:1.47, pi:330, co:1.2e-4, T:383 }  // deck-anchored
boUndersat(p, pb, bob, co): number   // Bob·exp(−co·(p−pb)); =Bob at Pb, ↓ above
rs(p, pb, rsb): number               // =Rsb above Pb (undersaturated), ↓ below
bg(p, T, Z): number                  // 0.003466·Z·T/p, inversely ∝ p
saturationState(p, pb): 'undersaturated' | 'saturated'
```
**Volve reality:** field stayed undersaturated its whole life (Pi 330 ≫ Pb 213) ⇒ no free gas in-reservoir ⇒ oil–water is the correct physics for S5. Rs constant at 160 above Pb. (This corrects the old wb `index.pvt.Rs`=148 → 160; update when wiring S5.)

### `relperm.ts`
```ts
COREY_DEFAULTS = { swc:0.15, sor:0.25, krwMax:0.4, kroMax:0.9, nw:3, no:2 }  // water-wet sand
coreyKr(sw, e): { krw, kro }           // Corey power-law, normalized Se
fracFlowW(sw, e, muw, muo): number     // (krw/μw)/(krw/μw+kro/μo), S-shaped
totalMobility(sw, e, muw, muo): number // krw/μw + kro/μo (pressure coupling, S5)
```
Locked: endpoints (`krw(Swc)=0`, `kro(Swc)=kroMax`, `kro(1−Sor)=0`, `krw(1−Sor)=krwMax`), monotonicity, fractional flow `fw(Swc)=0`, `fw(1−Sor)=1`, S-shaped. Pc neglected at screening (documented).

## Tests
`npm run test:sim` (or `npm test` for engine+geostat+sim = 36+33+31 = 100 assertions). Reference block (26) validates the analytic identities; PARITY block (5) activates once the engine modules exist and confirms `faceTrans`, `wellIndex`, `solvePressure` (1D), `coreyKr`, `boUndersat` are byte-identical.

## Next (S5 — FV black-oil, oil-water first)
Build `sim/fv.ts`: extend the pressure kernel to **two-phase (oil-water)** via upstream mobility weighting (`totalMobility` from relperm) in `faceTrans`, IMPES time-stepping with CFL sub-stepping (`dt ≤ PV/(q·df/dS)_max`), saturation update from `fracFlowW`. Validate against the **1D Buckley-Leverett/Welge analytic** and the **quarter five-spot** (add to test-sim). Then the "Simulation" tab (animated saturation front over the S2 GridModel) + `ForecastSource` toggle. S6 (streamline) reuses this same `solvePressure` for the flux field.
