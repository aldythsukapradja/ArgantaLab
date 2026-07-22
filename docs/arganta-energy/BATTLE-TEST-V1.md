# V1 Field Development — 20-Task Geologist Battle-Test (V1 exit gate)
2026-07-22 · Fable. The workbench passes V1 only when a geologist/engineer can complete all 20 on real Volve data, each producing a truthful, provenance-tagged result. Run at V1c completion; record PASS/FAIL + evidence per task.

Convention: each task states the ACTION and the EXPECTED honest OUTCOME (including where the app must show uncertainty/limits, not a false-precise answer).

## Map & structure (V1a)
1. **Load the Hugin Fm Top structural map** → filled depth map with contours labelled in mTVDSS, range ~2726–3393 m; hillshade legible; scale bar + hover z-readout work.
2. **Draw a polygon** over the crest and **measure** a distance → polygon persists (reload-stable, `user` badge); measured length matches the scale bar.
3. **Switch 2D→3D** → isometric surface renders with vertical-exaggeration slider; label explicitly says "isometric projection" (not a claimed true-3D engine).
4. **Toggle well layer + labels** → all 24 wells post at correct UTM locations coloured by role (producer/injector/both/none); F-series vs 15/9-19 exploration distinguishable.
5. **Draw a section line through F-12 and F-14** → X-section pane opens: Hugin Top/Base sampled along the line, both wells hung within tolerance, picks posted, OWC fill at 3120; **drag an endpoint** → section updates live.
6. **Place a planned horizontal well** via the Well Designer (target Hugin Top, 800 m lateral) → generated planned trajectory renders **dashed with a `scenario` badge**, never mixed into the real well set; appears in the X-section.

## Logs & petrophysics (V1a/V1b)
7. **Open logs for 15/9-F-11 B** → GR/RHOB/NPHI/RT/DT tracks on standard O&G scales (GR 0–150, NPHI reversed 0.45→−0.15, RHOB 1.95–2.95, RT log 0.2–2000); GR shading fill renders.
8. **Toggle vertical↔horizontal** log orientation → tracks re-lay-out correctly; hover crosshair reads all curves at the depth.
9. **Open the 2D crossplot** (NPHI–RHOB), colour by GR, **lasso a cluster** → the selected depth interval highlights on the tracks; standard lithology lines overlay.
10. **Open the 3D crossplot** (GR/RHOB/NPHI) and **rotate** → point cloud orbits; labelled a projection.
11. **View interpreted PHIE/SWE** (LFP) for a well → badged `interpreted` with Equinor provenance; **switch to Archie recompute** → derived PHIE/SW overlay appears, badged `derived`, with a visible interpreted-vs-derived residual column (not hidden).
12. **Read the Hugin zone averages** for F-12 (picks-bounded) → NTG/PHIE/SW near field defaults (φ~0.22, Sw~0.20, NTG~0.9); values feed Property/Volumetrics.

## Correlation & well ties (V1a/V1b)
13. **Correlate F-1 C, F-5, F-12, F-14** side-by-side → GR tracks hung on MSL; pick markers connected across wells with per-surface colours.
14. **Flatten on Hugin Fm Top** → datum shifts so all Hugin Top picks align; structural relief reads correctly relative to the flattened marker.
15. **Check the structural mistie table** → per-well `pickTvdss − gridSample` residuals shown honestly (some non-zero); no silent auto-adjustment.

## Volumetrics, uncertainty, forecast, economics (V1c)
16. **Run field-closure STOIIP** (deterministic) → ≈68 MMSm³, with the validation banner explaining it reproduces the published volumetric analogue (67.6) and the ~3× gap to the ≈22 faulted dynamic model = compartmentalization.
17. **Run STOIIP on a drawn polygon** around one fault block → smaller, sensible number; scope clearly labelled.
18. **Run Monte-Carlo uncertainty** (10k) → P90<P50<P10 (oil convention), histogram+CDF+tornado render; **reload and re-run** → identical P50 (fixed-seed reproducibility).
19. **Forecast F-12** → real monthly history plotted, Arps fit overlaid to economic limit, EUR shown; the F-12 material-balance tank check (~19.6 MMSm³ STOIP) displayed as reconciliation; labelled `forecast`, "not full-physics sim".
20. **Run Economics** on the F-12 forecast → NPV/payback/cashflow chart respond to price/opex/capex/discount inputs; numbers match the engine (NPV mid-year discount); all `scenario`.

## Cross-cutting assertions (must hold throughout)
- Every displayed number carries a dataNature badge; nothing computed is shown as measured.
- No console errors; both themes usable; mobile at least single-column usable.
- Planned wells / drawn shapes / scenarios never contaminate the real data layers.
- The interpreted-vs-derived and volumetric-vs-dynamic gaps are always **surfaced**, never smoothed over — this honesty IS the wedge.

## Scoring
20/20 = V1 exit. Any FAIL blocks exit; record the specific task, the observed vs expected, and the fix. Capture desktop + mobile screenshots of tasks 1, 5, 9, 16, 18, 19.
