import type { CatalogueBundle, EntityInstance } from '../atlas/types.ts';
import { governanceFor, OSDU_KIND_BY_ENTITY } from './kinds.ts';
import type { DataClass, OsduManifest, OsduRecord } from './types.ts';

const safe = (value: string) => value.trim().toLowerCase()
  .replace(/^atlas:/, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

export function osduId(kind: string, nativeId: string): string {
  const match = kind.match(/:(?:master-data|work-product-component|dataset)--([^:]+):/);
  const group = kind.includes('work-product-component--') ? 'work-product-component'
    : kind.includes('dataset--') ? 'dataset'
    : 'master-data';
  return `arganta:${group}--${match?.[1] ?? 'Record'}:${safe(nativeId)}`;
}

export function entityToOsdu(
  entity: EntityInstance,
  dataClass: DataClass = 'public',
): OsduRecord {
  const mapping = OSDU_KIND_BY_ENTITY[entity.type];
  if (!mapping) throw new Error(`No OSDU mapping for ATLAS entity type "${entity.type}"`);
  const governance = governanceFor(dataClass);
  return {
    id: osduId(mapping.kind, entity.id),
    kind: mapping.kind,
    acl: governance.acl,
    legal: governance.legal,
    ancestry: { parents: entity.parentId ? [safe(entity.parentId)] : [] },
    tags: {
      'arganta:dataClass': dataClass,
      'arganta:dataNature': entity.provenance?.dataNature ?? 'reference',
      'arganta:source': entity.provenance?.source ?? 'Arganta',
      'arganta:atlasId': entity.id,
      'arganta:osduAlignment': mapping.alignment,
    },
    data: {
      Name: entity.name,
      ...(entity.attrs ?? {}),
      ExtensionProperties: {
        ...(entity.refs ?? {}),
        AtlasEntityType: entity.type,
        AtlasRecordId: entity.id,
      },
    },
  };
}

export function bundleToOsduManifest(
  bundle: CatalogueBundle,
  dataClass: DataClass = 'public',
): OsduManifest {
  const manifest: OsduManifest = {
    kind: 'osdu:wks:Manifest:1.0.0',
    ReferenceData: [],
    MasterData: [],
    Data: { Datasets: [], WorkProductComponents: [], WorkProducts: [] },
  };
  for (const entity of bundle.instances) {
    const mapping = OSDU_KIND_BY_ENTITY[entity.type];
    const record = entityToOsdu(entity, dataClass);
    if (mapping.recordCategory === 'WorkProductComponent') {
      manifest.Data.WorkProductComponents.push(record);
    } else {
      manifest[mapping.recordCategory].push(record);
    }
  }
  const governance = governanceFor(dataClass);
  for (const [index, fact] of bundle.facts.entries()) {
    manifest.Data.WorkProductComponents.push({
      id: osduId('arganta:wks:work-product-component--QuantityObservation:1.0.0', `${bundle.id}-${index}`),
      kind: 'arganta:wks:work-product-component--QuantityObservation:1.0.0',
      acl: governance.acl,
      legal: governance.legal,
      ancestry: { parents: [safe(fact.entityId)] },
      tags: {
        'arganta:dataClass': dataClass,
        'arganta:dataNature': fact.provenance.dataNature,
        'arganta:source': fact.provenance.source,
      },
      data: { Metric: fact.metric, Value: fact.value, Unit: fact.unit, Dimensions: fact.dims ?? {} },
    });
  }
  return manifest;
}
