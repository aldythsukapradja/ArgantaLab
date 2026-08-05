const fs = require('fs');
const XLSX = require('../../apps/energy/node_modules/xlsx');

const source = JSON.parse(fs.readFileSync('.codex/tmp-petsys/usgs-publications.json', 'utf8').replace(/^\uFEFF/, ''));
const wb = XLSX.readFile('docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx');
const provinces = XLSX.utils.sheet_to_json(wb.Sheets.Province, { defval: null }).filter((row) => row.province_id && row.code);
const currentCodes = new Set(provinces.map((row) => String(row.code).padStart(4, '0')));

const rows = source.features
  .map((feature) => feature.attributes)
  .filter((row) => row.PROVCODE != null && currentCodes.has(String(row.PROVCODE).padStart(4, '0')))
  .filter((row) => ['Conventional', 'Conventional and Continuous'].includes(row.PUBLICATION_MEETING_NAME))
  .map((row) => ({
    registry_id: `usgs-pub:${row.OBJECTID_1}`,
    province_code: String(row.PROVCODE).padStart(4, '0'),
    publication_id: row.PUB_ID == null ? null : String(row.PUB_ID),
    ip_number: row.IP_NUMBER,
    title: row.TITLE,
    authors: row.AUTHOR,
    publication_date: row.PUBLISHED_DATE ? new Date(row.PUBLISHED_DATE).toISOString().slice(0, 10) : null,
    series: row.SERIES_INFO,
    usgs_series: row.USGS_SERIES,
    url: row.URL ? String(row.URL).replace(/^http:/, 'https:') : null,
    abstract: row.ABSTRACT,
    keywords: row.KEYWORDS,
    resource_scope: row.PUBLICATION_MEETING_NAME,
    include_web: row.INCLUDE_WEB,
    source_service: 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/3',
  }));

const byProvince = new Map();
for (const row of rows) byProvince.set(row.province_code, [...(byProvince.get(row.province_code) ?? []), row]);
const summary = {
  current_provinces: currentCodes.size,
  matched_provinces: [...currentCodes].filter((code) => byProvince.has(code)).length,
  unmatched_provinces: [...currentCodes].filter((code) => !byProvince.has(code)),
  publication_links: rows.length,
  unique_publications: new Set(rows.map((row) => row.publication_id ?? row.url ?? row.title)).size,
};
fs.writeFileSync('.codex/tmp-petsys/usgs-publication-registry.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
