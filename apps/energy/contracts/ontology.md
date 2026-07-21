# ArgantaEnergy — Column Dictionary (Ontology) M1
Version 1.0.0 · 2026-07-21 · **LOCKED** · companion to `schema.md`. Types: TEXT, NUM, DATE, BOOL, TEXT(JSON), NUM[] (array). `★`=PK, `→T`=FK to table T, `DIM`=dimension attr. Units verbatim from source; no conversion.

## well (hub · 11 · role: measured/reported identity)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| well_name | TEXT | — | ★ | logical well identity (e.g. `15/9-19`, `15/9-F-1`) |
| field | TEXT | — | DIM | `Q0015 SLEIPNER` (production export: `VOLVE`) |
| company | TEXT | — | | operator (Equinor Norway) |
| crs | TEXT(JSON) | — | | `{geo_datum, map_zone, crs_label:'ED50 / UTM 31N', north_reference}` |
| is_exploration | BOOL | — | DIM | true = exploration well (15/9-19 family); false = development (F-series) |
| wellbores | TEXT[] | — | | child wellbore names (denormalized convenience) |

## wellbore (child dim · 24)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| wellbore_name | TEXT | — | ★ | e.g. `15/9-F-1 C` |
| well_name | TEXT | — | →well | parent well (FK01) |
| drilled_from | TEXT | — | →wellbore | sidetrack parent branch (FK02); null on mains |
| field | TEXT | — | DIM | field |
| surface_ew_m / surface_ns_m | NUM | m (UTM31N) | | surface easting/northing |
| surface_lat / surface_lon | TEXT | dms | | surface lat/long |
| bottom_hole_md_m / bottom_hole_tvd_m | NUM | m | | TD MD/TVD |
| kick_off_depth | TEXT | m | | KOP (sidetracks) |
| datum_name / kb_msl / water_depth | TEXT | m | | rig datum, KB above MSL, water depth |
| vertical_section_direction | TEXT | deg | | VS azimuth |
| master_source_kind | TEXT | — | | e.g. `NPD_standard_survey` |
| crs | TEXT(JSON) | — | | ED50/UTM31N |
| source_id | TEXT | — | →evidence | FK10 |
| dataNature | TEXT | — | | `reported` |

## production (fact · 15,634 daily / 526 monthly · dataNature reported · vols in Sm3 as sourced)
Key `(wellbore, date)`. Columns (verbatim NPD names → canonical):
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| source_well_bore_name (NPD_WELL_BORE_NAME) | TEXT | — | →wellbore | FK03 (alias-normalized) |
| well_bore_code / npd_well_bore_code | TEXT | — | | NPD codes |
| date (DATEPRD) | DATE | — | ★ | production date |
| on_stream_hrs | NUM | hr | | ON_STREAM_HRS |
| avg_downhole_pressure / _temperature | NUM | bar / °C | | downhole gauges |
| avg_dp_tubing / avg_annulus_press | NUM | bar | | tubing ΔP, annulus P |
| avg_choke_size_p / avg_choke_uom / dp_choke_size | NUM/TEXT | % / — | | choke |
| avg_whp_p / avg_wht_p | NUM | bar / °C | | wellhead P/T |
| bore_oil_vol / bore_gas_vol / bore_wat_vol / bore_wi_vol | NUM | Sm3 | | oil/gas/water produced, water injected (null when N/A) |
| flow_kind (FLOW_KIND) | TEXT | — | DIM | `production` / `injection` |
| well_type (WELL_TYPE) | TEXT | — | DIM | OP/WI/GI etc. |
| field / facility | TEXT | — | DIM | VOLVE / MÆRSK INSPIRER |
| source_id | TEXT | — | →evidence | FK10 |

## log_sample (fact · 223 runs · measured · long-format)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| well | TEXT | — | →wellbore | FK04 (underscore alias) |
| run / folder / format | TEXT | — | | run id, log-type folder (04.COMPOSITE…), LAS/DLIS |
| index_curve | TEXT | m | | depth mnemonic |
| curves | TEXT[] | — | | curve mnemonics (canonical aliases: DTC→DT, RDEP→RT — explicit) |
| md | NUM[] | m | | depth index array (aligned to values) |
| values | NUM[][] | (per curve) | | index-aligned sample matrix; null_sentinel from header → null |
| null_sentinel | NUM | — | | LAS NULL (e.g. -999.25) |
| depth_unit | TEXT | m | | depth unit |
| source_id | TEXT | — | →evidence | FK10 |
| dataNature | TEXT | — | | `measured` |

## pressure (fact · 48 runs · measured · LAS 3.0 MDT/RFT)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| well / source_well | TEXT | — | →wellbore | FK05 |
| run / test | TEXT | — | | run id, test type |
| index_kind / index_mnemonic | TEXT | time/depth | | TIME.S usually |
| curves | TEXT[] | — | | ~58 curves (FPWD pretest; BAR/DEGC) |
| data / preview / full_ref | NUM[][]/TEXT | — | | full matrix or ref to `full/` file |
| null_value / delimiter / n_rows / n_curves / ragged_rows_dropped | NUM/TEXT | — | | parse metadata |
| source_id | TEXT | — | →evidence | FK10 |

## trajectory (detail · 29 definitive surveys · 3,332 stations · measured)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| wellbore / nameWell | TEXT | — | →wellbore | FK06 (NO-prefix/S alias) |
| chosen_source_file / chosen_trajectory_name / chosen_uid | TEXT | — | | provenance of the DEFINITIVE pick (plans excluded) |
| classification | TEXT | — | | definitive/final |
| original_angle_unit / md_unit / azi_ref | TEXT | dega/m | | source units preserved |
| station_count / md_min / md_max | NUM | m | | survey extent |
| stations | TEXT(JSON)[] | — | | `[{i, md, tvd, incl, azi, dispNs, dispEw, type}]` |
| dataNature | TEXT | — | | `measured` |

## marker (detail · 409 · interpreted · formation tops)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| source_well | TEXT | — | →wellbore | FK07 (35 wells incl. regional; 300/409 ORPHAN, carried verbatim) |
| well_id / wellbore_id | TEXT | — | | resolved id or **null** (no forced merge) |
| surface | TEXT | — | →surface | FK08 (16 formations) |
| obs / qlf | NUM/TEXT | — | | observation # (re-entries), qualifier |
| md / tvd / tvdss / twt | NUM | m / ms | | pick depths (mostly md) |
| dip / azi | NUM | deg | | structural dip/azimuth |
| easting / northing | NUM | m | | pick location |
| interpreter | TEXT | — | | e.g. STAT |
| source_id | TEXT | — | →evidence | FK10 |

## horizon (gis · 6 · interpreted · field-level depth surfaces)
| Col | Type | Unit | Key | Description |
|---|---|---|---|---|
| name | TEXT | — | ★ / →surface | horizon/surface name (FK09 fuzzy) |
| kind | TEXT | — | | `depth_horizon` |
| points_count / n_columns | NUM | — | | grid size (Σ 1.59M pts) |
| column_stats / bbox | TEXT(JSON) | m | | per-column stats, bounding box (UTM31N) |
| preview / preview_points | NUM[][] | — | | decimated grid (full stays in raw) |
| source_id | TEXT | — | →evidence | FK10 |

## surface (bridge · 16)
| Col | Type | Key | Description |
|---|---|---|---|
| surface_name | TEXT | ★ | formation/interval (Hugin Fm. VOLVE Top/Base, Draupne, Heather, Ty, Skagerrak, Sleipner, Shetland Gp, Hod, Ekofisk, Nordland Gp, Hordaland Gp, Utsira, Smith Bank, Seabed) |
| age / category / chrono_order | TEXT/NUM | DIM | stratigraphic ordering (youngest→oldest) — bridge owns option order |
| reservoir_flag | BOOL | DIM | Hugin/Skagerrak = reservoir |

## evidence (evidence · 1,002)
| Col | Type | Key | Description |
|---|---|---|---|
| volumePath | TEXT | ★ | Databricks volume path (1:1 mirror) |
| sha256 | TEXT | | integrity hash recorded at download |
| size / last_modified / retrievedAt | NUM/DATE | | byte size, source mtime, fetch time |
