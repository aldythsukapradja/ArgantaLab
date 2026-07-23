export const OSDU_RELEASE = {
  release: 'M27 / v0.30.0',
  commit: '99f8fc88d8ad838b5738ac5ad92ac643538b5766',
};

const kindType = (kind) => kind.match(/--([^:]+):/)?.[1] ?? 'Record';
const clean = (value) => String(value).trim().toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

export const makeOsduId = (kind, nativeId) => {
  const category = kind.includes('work-product-component--')
    ? 'work-product-component'
    : kind.includes('dataset--') ? 'dataset' : 'master-data';
  return `arganta:${category}--${kindType(kind)}:${clean(nativeId)}`;
};

export const governance = (dataClass, countries = []) => ({
  acl: {
    owners: [`data.${dataClass}.owners@arganta`],
    viewers: [`data.${dataClass}.viewers@arganta`],
  },
  legal: {
    legaltags: [`arganta-${dataClass}`],
    otherRelevantDataCountries: countries,
    status: 'compliant',
  },
});

export function record({ kind, nativeId, name, source, licence, dataClass = 'public',
  data = {}, parents = [], countries = [], dataNature = 'reference', alignment = 'standard' }) {
  const gov = governance(dataClass, countries);
  return {
    id: makeOsduId(kind, nativeId),
    kind,
    ...gov,
    ancestry: { parents },
    tags: {
      'arganta:dataClass': dataClass,
      'arganta:dataNature': dataNature,
      'arganta:source': source,
      'arganta:sourceLicence': licence ?? '',
      'arganta:osduAlignment': alignment,
    },
    data: { Name: name, ...data },
  };
}

export const emptyManifest = () => ({
  kind: 'osdu:wks:Manifest:1.0.0',
  ReferenceData: [],
  MasterData: [],
  Data: { Datasets: [], WorkProductComponents: [], WorkProducts: [] },
});

export const recordCount = (manifest) => manifest.ReferenceData.length
  + manifest.MasterData.length + manifest.Data.Datasets.length
  + manifest.Data.WorkProductComponents.length + manifest.Data.WorkProducts.length;

export function validateManifest(manifest, expectedClass) {
  const errors = [];
  if (manifest.kind !== 'osdu:wks:Manifest:1.0.0') errors.push('invalid manifest kind');
  const records = [
    ...manifest.ReferenceData, ...manifest.MasterData, ...manifest.Data.Datasets,
    ...manifest.Data.WorkProductComponents, ...manifest.Data.WorkProducts,
  ];
  const ids = new Set();
  for (const r of records) {
    if (!/^[a-z0-9-]+:(?:master-data|work-product-component|dataset)--[^:]+:[^:]+$/i.test(r.id)) {
      errors.push(`${r.id || '<missing id>'}: invalid OSDU record id`);
    }
    if (!/^[a-z0-9-]+:wks:[^:]+:\d+\.\d+\.\d+$/i.test(r.kind)) errors.push(`${r.id}: invalid kind`);
    if (ids.has(r.id)) errors.push(`${r.id}: duplicate id`);
    ids.add(r.id);
    if (!r.acl?.owners?.length || !r.acl?.viewers?.length) errors.push(`${r.id}: missing ACL`);
    if (!r.legal?.legaltags?.length) errors.push(`${r.id}: missing LegalTag`);
    if (!r.data || typeof r.data !== 'object') errors.push(`${r.id}: missing data`);
    if (expectedClass && r.tags?.['arganta:dataClass'] !== expectedClass) {
      errors.push(`${r.id}: expected ${expectedClass} classification`);
    }
  }
  return { valid: errors.length === 0, errors, records: records.length };
}
