# ArgantaEnergy Cockpit — Spatial Intelligence Handoff

Version 2.0 · 2026-07-23 · implementation handoff

This document is the current source of truth for the ArgantaEnergy Cockpit.
It supersedes the original single-HTML concept brief where the two conflict.

## 1. Product statement

ArgantaEnergy is a spatial operating system for upstream petroleum decisions.
The Cockpit is its map-first front door: a user can move from the global
petroleum system to a country, basin, field, well or evidence workspace without
leaving the same governed context.

Volve remains the public end-to-end proof, not the product boundary. The global
catalogue must visibly demonstrate that any operator's portfolio can be
recognized and connected to the same lifecycle intelligence.

## 2. Experience contract

- The map or globe owns the first viewport.
- Search is grounded in the OSDU catalogue; it is not a hard-coded place list.
- 2D and 3D use the same WGS84 spatial records and stable feature IDs.
- Global views summarize density. Regional views group fields. Close views
  reveal individual fields and evidence.
- Every popup communicates both exploration and production context when the
  source provides it.
- Missing values are shown as `Not reported`; they are never rendered as zero.
- Every quantity preserves source, release, year, classification and original
  unit.
- Five lifecycle agents sit around the map as launch points: Exploration, Field
  Development, Well Delivery, Reservoir Management and Drilling.
- Both light and dark themes are first-class. Motion respects reduced-motion.
- Desktop is information-rich. Mobile defaults to clusters and a bottom sheet.

## 3. Rendering architecture

### 3D

Use CesiumJS for the production globe:

- WGS84 globe and correct antimeridian behavior;
- satellite/open imagery provider abstraction;
- petroleum-province and assessment-unit boundaries;
- GPU point collections for global field locations;
- clustering at global and regional distance;
- GPU primitives for oil/gas reserve columns;
- feature picking, camera flights and level-of-detail control.

### 2D

Use Leaflet for proven map navigation with a synchronized deck.gl overlay:

- Satellite basemap;
- Open Map basemap;
- GPU heatmap, grid/bin and cluster visualizations;
- field symbols and field polygons;
- USGS opportunity and OSDU coverage overlays.

### Mesh

Use D3 Geo Equal Earth as the lightweight analytical map:

- graticule;
- petroleum-province mesh;
- field density;
- no photographic basemap;
- antimeridian-clipped geometry;
- canvas rendering with capped DPR.

### Sovereign deployment

Provider URLs are configuration, never embedded business logic. The local
concept may use Esri imagery and OpenStreetMap tiles. Production must support a
contracted provider or operator-hosted raster/vector tiles without changing the
Cockpit component API.

## 4. Spatial quality gates

All runtime geometry is WGS84/EPSG:4326 at rest. Renderers perform their own
projection.

The build must:

1. validate longitude and latitude ranges;
2. split geometries that cross ±180 degrees;
3. reject any post-normalization segment with a longitude jump above 180
   degrees;
4. preserve holes and multipart polygons;
5. retain stable OSDU/USGS IDs through simplification;
6. generate viewport-appropriate simplifications without modifying the source;
7. test point-in-polygon selection on both sides of the antimeridian.

Known source defects currently requiring normalization:

| USGS code | Province | Maximum raw longitude jump |
|---|---|---:|
| 0002 | Eurasia Basin | 257.932° |
| 1261 | Long Strait | 359.816° |
| 0001 | Lomonosov–Makarov | 355.187° |
| 1258 | North Chukchi–Wrangel Foreland Basin | 350.394° |

These raw rings cause the visible Russia-to-US straight lines in planar maps.
They must be repaired in the spatial build, not hidden with styling.

## 5. Current governed spatial inventory

| Source | Ready records | Cockpit geometry |
|---|---:|---|
| GOGET March 2026 | 8,032 | 7,391 field points |
| North Sea regulators | 7,519 | 3,855 wellbore points · 360 field polygons |
| Brazil ANP | 948 | 428 field polygons · 415 agreement polygons |
| USGS World Assessment | 698 | 179 provinces · 340 assessment units |
| Volve | 105 | technical detail records; spatial normalization pending |

Generated cockpit geometry currently contains 11,246 points and 1,203
polygons. The correlated field inventory contains 8,179 spatial fields, of
which 5,460 intersect a USGS petroleum province.

Planned sources: US BOEM, Australia NOPIMS, Canadian regulator open data and
operator-private OSDU partitions.

## 6. GOGET is the global field context layer

GOGET is not a dot dataset. It is the global catalogue spine used to frame both
exploration and production questions.

Current coverage:

| Attribute | Coverage |
|---|---:|
| Field/unit records | 8,032 |
| Spatial locations | 7,391 · 92.0% |
| Exact locations | 6,191 |
| Approximate locations | 1,201 |
| Fuel type | 8,032 · 100% |
| Status | 7,812 · 97.3% |
| Operator | 6,717 · 83.6% |
| Production type | 5,471 · 68.1% |
| Discovery year | 5,387 · 67.1% |
| Basin | 2,461 · 30.6% |
| FID year | 724 · 9.0% |
| Production-start year | 2,528 · 31.5% |
| Fields with reserve observations | 4,542 |
| Fields with production observations | 6,285 |

Portfolio composition:

- 5,132 oil-and-gas fields;
- 1,469 oil fields;
- 1,370 gas fields;
- 61 gas-and-condensate fields;
- 5,354 onshore;
- 2,222 offshore;
- 456 unknown shore status;
- 6,751 operating;
- 493 discovered;
- 268 in development;
- 245 mothballed.

Observation inventory:

- 7,491 reserve observations;
- 12,165 production observations;
- reserve products include oil, gas, condensate, NGL and reported combined
  hydrocarbons;
- production products include oil, gas, condensate, NGL, associated gas and
  dry/non-associated gas;
- converted reserve units are million bbl, million m³ and million boe;
- converted production units are million bbl/y, million m³/y and million boe/y;
- source reserve classifications are heterogeneous and must remain visible.

## 7. GOGET field popup

The field popup is a compact lifecycle dossier, not a generic map tooltip.
It opens as a side card on desktop and a bottom sheet on mobile.

### Header

- field/unit name;
- stable GOGET/OSDU ID;
- country and subnational region;
- operating status;
- oil/gas/mixed product badge;
- onshore/offshore badge;
- exact/approximate location-quality badge;
- source release and evidence indicator.

### Primary facts

- operator;
- owners and parents when reported;
- conventional/unconventional/mixed production type;
- basin and block;
- project/parent unit;
- local-script/alternate name;
- GOGET/GEM evidence link.

### Exploration context

- discovery year;
- basin and block;
- field status: exploration, discovered or in development;
- resource/reserve classification;
- in-place, contingent or prospective quantity when that is what the source
  reports;
- fuel/product mix;
- location accuracy;
- USGS province and assessment-unit intersection;
- nearby analogue count and basin field density.

Do not call every reported quantity a reserve. `STOIIP`, `GIIP`, contingent
resources, prospective resources, EUR and remaining reserves must retain their
source classification.

### Development context

- FID year;
- production-start year;
- status and status-detail;
- shore status;
- conventional/unconventional;
- operator and ownership;
- project hierarchy;
- years from discovery to FID and FID to first production when both endpoints
  exist.

### Production context

- latest reported oil production;
- latest reported gas production;
- condensate/NGL where present;
- reporting year;
- original and converted units;
- product mix;
- latest production source row;
- a compact product-split bar;
- a lifecycle timeline: discovery → FID → first production → latest report.

The March 2026 source exposes the most recent reported observations, not a
complete time series. The UI must label this `Latest reported`, never imply a
history that is not present.

### Reserve/resource context

- oil;
- gas;
- condensate;
- NGL;
- source classification;
- data year;
- original value/unit;
- converted value/unit;
- normalized MMBOE used by the map;
- completeness/confidence state.

### Actions

- `Open evidence`
- `Ask Exploration`
- `Ask Field Development`
- `Compare analogues`
- `Open field workspace`

Only show an action when its destination can accept the selected OSDU field ID.

## 8. Popup information hierarchy

The first glance must answer:

1. What is it?
2. Where is it?
3. What lifecycle state is it in?
4. What does it produce?
5. What is the latest reported production?
6. What reserves/resources are reported and under what classification?
7. How trustworthy and current is this record?
8. What can the user do next?

Recommended desktop structure:

```text
FIELD · OPERATING · OFFSHORE · EXACT
Field name
Country · Basin                         GOGET

OIL  latest production    GAS latest production
OIL  reported reserves    GAS reported reserves

Discovery ── FID ── First production ── Latest report

Operator · Production type · Block · Owners
USGS province · Nearby fields · Location confidence

[Ask Exploration] [Open evidence] [Field workspace]
```

Long secondary metadata belongs in a `More evidence` disclosure, not in the
first viewport.

## 9. Scale-aware map behavior

### Global

- heatmap weighted by field count, reserves or latest production;
- country/basin aggregate labels;
- no thousands of independent DOM markers;
- clicking a hot area moves to the regional cluster view.

### Regional

- proportional clusters;
- abbreviated count label;
- cluster ring split by oil/gas/mixed composition;
- popup summary: fields, operating share, reported reserves, latest production,
  leading operators and data completeness;
- clicking a cluster expands or zooms.

### Field

- premium fuel-aware field glyph;
- selection halo;
- status encoded by outline, not color alone;
- approximate locations use a dashed uncertainty ring;
- polygon-backed fields use their geometry; point-only fields use a marker;
- popup uses the lifecycle dossier in §7.

### Heatmap

- default weight: field count;
- optional weights: normalized remaining reserves, latest production, USGS
  opportunity;
- stable domains and visible legend;
- density is recalculated by scale;
- heatmap fades into clusters, then individual fields.

## 10. 3D GOGET visualization

Every spatial GOGET field is eligible for the globe.

At global distance:

- aggregate by country or basin;
- render a small number of reserve towers;
- preserve smooth camera interaction.

At regional distance:

- cluster fields in screen space;
- show composition rings and aggregate values.

At field distance:

- show the individual field;
- stack green oil below red gas;
- add condensate/NGL as a neutral amber cap when material;
- column footprint represents selection/aggregate scope, not the raw reserve;
- column height uses normalized MMBOE;
- tooltip preserves raw product units and classification;
- fields without comparable reserves remain neutral location beacons.

Use logarithmic or percentile-clamped height scaling. A few giant fields must
not flatten the rest of the world. The legend must state the scale.

Recommended colors:

- oil `#19d37e`;
- gas `#ff5d73`;
- condensate/NGL `#f6b94b`;
- no comparable reserve data `#8ba4ad`;
- selected halo `#e8fffc`.

Green/red must be reinforced with stack position, labels and icons for
color-vision accessibility.

## 11. OSDU-grounded search

Generate `cockpit-search.json` during the OSDU build. Index:

- field and project names;
- local-script and alternate names;
- native and OSDU IDs;
- country and subnational region;
- basin and block;
- operator and owners;
- fuel type;
- status;
- well and wellbore name;
- USGS province and assessment unit;
- coordinates or polygon centroid;
- source and release.

Results are grouped by entity type. Each result shows name, type, parent context,
source and an optional lifecycle/status chip.

Selecting a result:

1. switches to a compatible map mode;
2. flies to the geometry;
3. highlights it;
4. opens the correct dossier;
5. preserves the OSDU ID for downstream agent/workspace actions.

Search must support prefixes, punctuation-insensitive matching and common
aliases. Country-only results should summarize contained fields rather than
pretend to be a field.

## 12. Visual language

- map-first, calm and precise;
- teal is the system accent, not the only data color;
- use mono micro-labels for provenance, IDs, units and years;
- panels use controlled translucency without obscuring the map;
- one selected feature receives the strongest glow;
- heatmaps use perceptually ordered ramps;
- clusters use restrained bloom and tabular counts;
- popups are dense but scannable;
- every visualization includes an honest legend;
- no fabricated satellite detail or invented field statistics.

## 13. Performance budgets

- initial Cockpit shell remains interactive before heavy spatial chunks load;
- spatial libraries load only when their view is selected;
- desktop target: 45–60 FPS during pan/orbit;
- mobile floor: 30 FPS;
- cap DPR at 2;
- aggregate or cull primitives outside the current level of detail;
- do not create one React or DOM component per field;
- use binary/GPU-friendly buffers for global point and column layers;
- pause animation when the document is hidden;
- dispose WebGL resources on view changes.

## 14. Acceptance criteria

- no antimeridian line crosses the map;
- all 7,391 spatial GOGET fields can be located;
- mapped records expose their real GOGET context;
- reserve columns appear only where comparable observations exist;
- raw units, classification, year and source are visible;
- search can find a field, basin, country, well, province or assessment unit;
- search selection flies to and opens the correct record;
- global heatmap, clusters and field view transition by scale;
- 2D and 3D selection resolve to the same stable field ID;
- missing data is explicit;
- light, dark, desktop and mobile QA pass;
- provider attribution remains visible;
- production can replace public basemaps with sovereign providers.

