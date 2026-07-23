/** OSDU R3 storage/manifest contracts used by the ingestion boundary. */
export type DataClass = 'public' | 'internal' | 'confidential' | 'restricted';

export interface OsduAcl {
  owners: string[];
  viewers: string[];
}

export interface OsduLegal {
  legaltags: string[];
  otherRelevantDataCountries: string[];
  status?: 'compliant' | 'uncompliant';
}

export interface OsduRecord<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  kind: string;
  acl: OsduAcl;
  legal: OsduLegal;
  data: T;
  ancestry?: { parents: string[] };
  tags?: Record<string, string>;
  meta?: Array<Record<string, unknown>>;
}

export interface OsduManifest {
  kind: 'osdu:wks:Manifest:1.0.0';
  ReferenceData: OsduRecord[];
  MasterData: OsduRecord[];
  Data: {
    Datasets: OsduRecord[];
    WorkProductComponents: OsduRecord[];
    WorkProducts: OsduRecord[];
  };
}

export interface OsduGovernance {
  dataClass: DataClass;
  acl: OsduAcl;
  legal: OsduLegal;
}

export interface OsduPipelineIndex {
  standard: 'OSDU R3';
  dataDefinitions: { release: string; commit: string };
  generatedAt: string;
  manifests: Array<{
    source: string;
    dataClass: DataClass;
    path: string;
    records: number;
    status: 'ready' | 'awaiting-source';
  }>;
}
