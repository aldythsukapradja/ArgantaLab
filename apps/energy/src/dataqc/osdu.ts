// dataqc/osdu.ts — stage 5: ingested client data becomes governed OSDU records.
// This is what makes an upload part of "master ArgantaEnergy": the same envelope,
// ACL/legal and id minting as the five existing lanes (GOGET · North Sea · ANP ·
// USGS · Volve). Client data is lane 6 — nothing bespoke.
//
// Client uploads default to dataClass 'confidential': a client's logs are not public
// data, and governanceFor() already enforces the sovereign lane.
import { osduId } from '../osdu/adapter.ts';
import { governanceFor } from '../osdu/kinds.ts';
import type { DataClass, OsduManifest, OsduRecord } from '../osdu/types.ts';
import type { AssetKind, IngestedAsset } from './types.ts';

/** Which OSDU kind an ingested file becomes. Datasets are the OSDU home for
 *  file-backed payloads; the interpretation WPCs point at them. */
const KIND_BY_ASSET: Record<AssetKind, string> = {
  log: 'osdu:wks:work-product-component--WellLog:1.2.0',
  trajectory: 'osdu:wks:work-product-component--WellboreTrajectory:1.1.0',
  picks: 'osdu:wks:work-product-component--WellboreMarkerSet:1.1.0',
  surface: 'arganta:wks:work-product-component--DepthSurface:1.0.0',
  production: 'arganta:wks:work-product-component--ProductionData:1.0.0',
  injection: 'arganta:wks:work-product-component--InjectionData:1.0.0',
  patterns: 'arganta:wks:work-product-component--InjectionPattern:1.0.0',
  document: 'osdu:wks:work-product-component--Document:1.0.0',
  image: 'osdu:wks:work-product-component--Document:1.0.0',
  unknown: 'osdu:wks:dataset--File.Generic:1.0.0',
};

/** Every ingested file also yields a Dataset record — the raw bytes are the evidence. */
const DATASET_KIND = 'osdu:wks:dataset--File.Generic:1.0.0';

export function assetToOsdu(
  asset: IngestedAsset,
  dataClass: DataClass = 'confidential',
): { wpc: OsduRecord; dataset: OsduRecord } {
  const governance = governanceFor(dataClass);
  const kind = KIND_BY_ASSET[asset.kind] ?? KIND_BY_ASSET.unknown;

  const tags: Record<string, string> = {
    'arganta:dataClass': dataClass,
    'arganta:dataNature': 'measured',          // client-delivered source data
    'arganta:source': `client-upload:${asset.fileName}`,
    'arganta:sha256': asset.sha256,
    'arganta:fieldId': asset.fieldId,
    'arganta:vertical': asset.vertical,
    'arganta:format': asset.format,
    'arganta:qcStatus': asset.qc.status,
  };

  // fieldId is a full OSDU id; use only its native segment when minting new ids
  const fieldSlug = asset.fieldId.split(':').pop() ?? asset.fieldId;
  const datasetId = osduId(DATASET_KIND, `${fieldSlug}-${asset.id}-file`);
  const dataset: OsduRecord = {
    id: datasetId,
    kind: DATASET_KIND,
    acl: governance.acl,
    legal: governance.legal,
    tags,
    data: {
      Name: asset.fileName,
      TotalSize: asset.bytes,
      EncodingFormatTypeID: asset.format,
      Checksum: asset.sha256,
      DatasetProperties: {
        FileSourceInfo: { FileSource: asset.blobKey, Name: asset.fileName },
      },
    },
  };

  const wpc: OsduRecord = {
    id: osduId(kind, `${fieldSlug}-${asset.id}`),
    kind,
    acl: governance.acl,
    legal: governance.legal,
    ancestry: { parents: [datasetId] },
    tags,
    data: {
      Name: asset.fileName,
      Description: `Client ${asset.kind} ingested via Data QC`,
      Datasets: [datasetId],
      ExtensionProperties: {
        ArgantaFieldId: asset.fieldId,
        ArgantaAssetId: asset.id,
        ArgantaQc: asset.qc.status,
        ArgantaQcExceptions: asset.qc.exceptions.length,
        ...asset.meta,
      },
    },
  };

  return { wpc, dataset };
}

/** Emit the client lane as a standard OSDU manifest — same shape as the five
 *  shipped lanes, so it validates with the existing scripts/validate-osdu.mjs. */
export function assetsToManifest(
  assets: IngestedAsset[],
  dataClass: DataClass = 'confidential',
): OsduManifest {
  const manifest: OsduManifest = {
    kind: 'osdu:wks:Manifest:1.0.0',
    ReferenceData: [],
    MasterData: [],
    Data: { Datasets: [], WorkProductComponents: [], WorkProducts: [] },
  };
  for (const asset of assets) {
    const { wpc, dataset } = assetToOsdu(asset, dataClass);
    manifest.Data.Datasets.push(dataset);
    manifest.Data.WorkProductComponents.push(wpc);
  }
  return manifest;
}

export const countRecords = (m: OsduManifest): number =>
  m.ReferenceData.length + m.MasterData.length
  + m.Data.Datasets.length + m.Data.WorkProductComponents.length + m.Data.WorkProducts.length;
