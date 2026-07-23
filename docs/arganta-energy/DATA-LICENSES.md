# ArgantaEnergy — Open Data Sources & Licences

Attribution + licence register for every external open dataset ingested into the app.
Every source here was verified live (July 2026) against its actual endpoint before use.
**Read this before shipping any surface that renders third-party open data.**

> Scope of the first ingestion (P0–P2): North Sea **reference geometry + headers** only —
> block / quadrant / licence / field boundaries and names, discoveries, and wellbore
> headers. These are core open-government data. We do **not** ingest reports, well logs,
> core photos, or seismic from these regulators (those can carry third-party-rights
> limitations — see NLOD caveat below). Subsurface detail continues to come from the
> Equinor Volve set we already use.

---

## 1. Norwegian Offshore Directorate — Sokkeldirektoratet (Sodir, formerly NPD)

- **What we take**: quadrants, blocks, production-licence areas, field outlines + names,
  discoveries, wellbore headers (Norwegian sector), plus field/wellbore attributes.
- **Endpoints**
  - FactMaps (geometry): `https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsWGS84/FeatureServer/{layer}/query?f=geojson`
    (layers: 803 quadrants · 802 blocks · 612–617 licences · 502 fields · 504 discoveries · 201 wellbores)
  - FactPages (attributes, CSV): `https://factpages.sodir.no/public?/Factpages/external/Tableview/{report}&rs:Command=Render&rs:Format=CSV&IpAddress=1.1.1.1&CultureCode=en`
- **Licence**: **Norwegian Licence for Open Government Data (NLOD 2.0)** — SPDX `NLOD-2.0` — <https://data.norge.no/nlod/en/2.0>
- **Required attribution** (verbatim form):
  > Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the Norwegian Offshore Directorate (Sokkeldirektoratet).
  If the data is modified, we must clearly indicate that changes were made.
- **Caveat**: NLOD carves out third-party-rights material — *reports, core images and logs*
  may have use limitations. Our scope (boundaries, headers, field/discovery/licence records,
  stratigraphy tops) is core open data and clear to use. Do **not** extend ingestion to
  document/log/core-photo assets without re-checking.

## 2. UK North Sea Transition Authority (NSTA, formerly OGA)

- **What we take**: UKCS quadrants, licence blocks, offshore petroleum licences,
  field determinations (outlines + names), wellbore bottom-holes (UK sector).
- **Endpoints** (ArcGIS Online, org `OZMfUznmLTnWccBc`):
  `https://services-eu1.arcgis.com/OZMfUznmLTnWccBc/arcgis/rest/services/{Service}/FeatureServer/0/query?f=geojson`
  - `UKCS_quadrants_(WGS84)` · `UKCS offshore petroleum licence blocks WGS84` ·
    `UKCS offshore petroleum licences WGS84` · `Petroleum_field_determinations_(WGS84)` ·
    `UKCS offshore petroleum wells bottom holes WGS84`
- **Licence**: **NSTA Open User Licence** (⚠️ *not* plain OGL v3) —
  <https://www.nstauthority.co.uk/footer/access-to-information/>
- **Required attribution**: credit **"North Sea Transition Authority"**.
- **⚠️ Open action before public release**: confirm the exact NSTA Open User Licence
  attribution wording + redistribution terms (the User Agreement is a PDF behind a JS page;
  not machine-readable at ingest time). Email `GIS@nstauthority.co.uk` if unclear. Do not
  assume full OGL-v3 reuse rights.

## 3. EMODnet (seabed bathymetry + cross-sector activity) — *deferred to a later phase*

- **What we would take**: bathymetry DTM 2024 (~115 m) for the seabed hero; cross-sector
  active-licence polygons.
- **Endpoints**: `https://emodnet.ec.europa.eu/en/bathymetry` (WMS/WFS/WCS) ·
  Human Activities OGC `https://ows.emodnet-humanactivities.eu/wms` and `/wfs`
- **Licence**: free reuse with mandatory citation —
  > EMODnet Digital Bathymetry (DTM 2024). EMODnet Bathymetry Consortium. <https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1>

## 4. Equinor Volve dataset — *already in use (subsurface)*

- **Licence**: **Equinor Open Data Licence** (based on CC BY 4.0; **may not be sold**; covers
  all data whether or not copyright applies). <https://www.equinor.com/energy/volve-data-sharing>
- **Required attribution**: credit **"Equinor and the Volve license partners"**, link the
  terms, include a copyright notice. Do not sell the data; do not misrepresent it.

---

## Standardisation notes (see `src/nsr/`)

- **CRS**: ingest the **WGS84 (EPSG:4326)** service variants and store lon/lat. The app's
  existing `wb` well map is **ED50 / UTM 31N** — overlaying NSR boundaries on it needs a
  reprojection step (`proj4`, EPSG:4326 → ED50/UTM 31N). Every NSR record keeps its native
  datum so provenance is never lost.
- **Sector discriminator**: UK "211/29-" and Norway "15/9-" share the `quadrant/block-well`
  shape but are independent numbering namespaces — the canonical schema keys every record by
  `sector` (`NO` | `UK`) + native regulator id (`NPDID*` for NO, `OBJECTID`/ref for UK).
- **Volve anchor** (verified live from Sodir): field `VOLVE`, NPDID **3420717**, operator
  Equinor Energy AS, discovered **1993**, discovery well **15/9-19 SR**, block **15/9**,
  licences **046** + **046 BS**.
