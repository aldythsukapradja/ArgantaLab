import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data-energy', 'raw', 'anp');
fs.mkdirSync(outDir, { recursive: true });

const layers = {
  fields: 'BD_ANP:CAMPOS_PRODUCAO_SIRGAS',
  blocks: 'BD_ANP:BLOCOS_EXPLORATORIOS_SIRGAS',
};
const endpoint = 'https://gishub.anp.gov.br/geoserver/BD_ANP/ows';
const results = {};

for (const [name, typeName] of Object.entries(layers)) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    service: 'WFS', version: '1.0.0', request: 'GetFeature',
    typeName, outputFormat: 'application/json', maxFeatures: '40000',
  }).toString();
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ArgantaEnergy-OSDU/1.0 (+https://energy.arganta.app)',
      Referer: 'https://www.gov.br/anp/',
    },
  });
  if (!response.ok) throw new Error(`ANP ${name}: HTTP ${response.status}`);
  const geojson = await response.json();
  if (geojson.type !== 'FeatureCollection') throw new Error(`ANP ${name}: expected FeatureCollection`);
  fs.writeFileSync(path.join(outDir, `${name}.geojson`), JSON.stringify(geojson));
  results[name] = { typeName, url: url.toString(), features: geojson.features.length };
}

fs.writeFileSync(path.join(outDir, 'source.json'), JSON.stringify({
  authority: 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP)',
  sourcePage: 'https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/dados-tecnicos/shapefile-de-dados',
  fetchedAt: new Date().toISOString(),
  crs: 'SIRGAS 2000',
  licence: 'Brazilian federal open-data publication; source attribution retained',
  layers: results,
}, null, 2));

console.log(`ANP: ${results.fields.features} fields, ${results.blocks.features} blocks`);
