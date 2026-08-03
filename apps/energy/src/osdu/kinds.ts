import type { DataClass, OsduGovernance } from './types.ts';

export const OSDU_DATA_DEFINITIONS = {
  release: 'M27 / v0.30.0',
  commit: '99f8fc88d8ad838b5738ac5ad92ac643538b5766',
} as const;

export interface OsduKindMapping {
  kind: string;
  recordCategory: 'ReferenceData' | 'MasterData' | 'WorkProductComponent';
  alignment: 'standard' | 'extension';
  note?: string;
}

/**
 * Canonical persistence mapping for every concept exposed by the 18-node navigation projection.
 * `arganta:wks:*` kinds are OSDU-compatible extension schemas used only where
 * the official data definitions do not contain an equivalent business object.
 */
export const OSDU_KIND_BY_ENTITY: Record<string, OsduKindMapping> = {
  world: { kind: 'osdu:wks:master-data--GeoPoliticalEntity:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  region: { kind: 'osdu:wks:master-data--GeoPoliticalEntity:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  country: { kind: 'osdu:wks:master-data--GeoPoliticalEntity:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  basin: { kind: 'osdu:wks:master-data--Basin:1.2.0', recordCategory: 'MasterData', alignment: 'standard' },
  'petroleum-system': { kind: 'arganta:wks:master-data--PetroleumSystem:1.0.0', recordCategory: 'MasterData', alignment: 'extension', note: 'USGS TPS extension' },
  'assessment-unit': { kind: 'arganta:wks:master-data--AssessmentUnit:1.0.0', recordCategory: 'MasterData', alignment: 'extension', note: 'USGS assessment-unit extension' },
  play: { kind: 'osdu:wks:master-data--Play:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  prospect: { kind: 'osdu:wks:master-data--Prospect:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  field: { kind: 'osdu:wks:master-data--Field:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  reservoir: { kind: 'osdu:wks:master-data--Reservoir:2.0.0', recordCategory: 'MasterData', alignment: 'standard' },
  well: { kind: 'osdu:wks:master-data--Well:1.4.0', recordCategory: 'MasterData', alignment: 'standard' },
  wellbore: { kind: 'osdu:wks:master-data--Wellbore:1.5.1', recordCategory: 'MasterData', alignment: 'standard' },
  'wellbore-segment': { kind: 'arganta:wks:master-data--WellboreSegment:1.0.0', recordCategory: 'MasterData', alignment: 'extension' },
  'contact-interval': { kind: 'osdu:wks:work-product-component--WellboreIntervalSet:1.3.1', recordCategory: 'WorkProductComponent', alignment: 'standard' },
  completion: { kind: 'arganta:wks:master-data--Completion:1.0.0', recordCategory: 'MasterData', alignment: 'extension', note: 'Business completion; interval/opening data remains in official well schemas' },
  company: { kind: 'osdu:wks:master-data--Organisation:1.2.0', recordCategory: 'MasterData', alignment: 'standard' },
  licence: { kind: 'osdu:wks:master-data--Agreement:1.1.0', recordCategory: 'MasterData', alignment: 'standard' },
  asset: { kind: 'arganta:wks:master-data--CommercialAsset:1.0.0', recordCategory: 'MasterData', alignment: 'extension' },
};

const DOMAIN = 'arganta';

export function governanceFor(dataClass: DataClass, countries: string[] = []): OsduGovernance {
  return {
    dataClass,
    acl: {
      owners: [`data.${dataClass}.owners@${DOMAIN}`],
      viewers: [`data.${dataClass}.viewers@${DOMAIN}`],
    },
    legal: {
      legaltags: [`${DOMAIN}-${dataClass}`],
      otherRelevantDataCountries: countries,
      status: 'compliant',
    },
  };
}
