// atlas/types.ts — the ATLAS master-metadata contract. One typed schema for all world
// petroleum data: a STRONG canonical spine (entity types) + a metric–dimension fact model,
// callable + updateable via atlas/spine.ts. Concept: docs/arganta-energy/WORLD-PETROLEUM-
// CATALOGUE-CONCEPT.md. Names align to OSDU (open, versioned); assessment tier from USGS;
// well tier from PPDM; resource maturity from SPE-PRMS; fact model from Wood Mackenzie.
// NOTHING here is field-specific — Volve is one INSTANCE (atlas/volve.ts).

/** The three axes that converge at Field + Well. */
export type Axis = 'geologic' | 'well' | 'commercial';

/** Provenance ladder (shared with the wb/KB model). */
export type DataNature = 'measured' | 'interpreted' | 'derived' | 'reference';
/** Access/governance class. Kept orthogonal to scientific DataNature. */
export type DataClass = 'public' | 'internal' | 'confidential' | 'restricted';

/** Attribute data types. */
export type DType = 'string' | 'number' | 'date' | 'bool' | 'enum' | 'geometry' | 'ref';

// ── SPE-PRMS resource maturity — TWO orthogonal axes, never merged ──
export type PrmsClass = 'prospective' | 'contingent' | 'reserves' | 'production' | 'unrecoverable';
/** low|best|high == 1|2|3 == P90|P50|P10 (reserves) / 1U|2U|3U / 1C|2C|3C. */
export type PrmsCategory = 'low' | 'best' | 'high';
export type ProductType = 'oil' | 'condensate' | 'ngl' | 'gas';

/** Relationship verbs across the graph (the spine is a graph, not a strict tree). */
export type EdgeKind =
  | 'located-in' | 'held-under' | 'operated-by' | 'penetrates'
  | 'matures-to' | 'sequenced-in' | 'contains' | 'produces';

/** One attribute on an entity type. `ref` names another entity-type id. */
export interface AttrDef {
  name: string; dtype: DType; unit?: string; required?: boolean;
  ref?: string; enumVals?: string[]; desc?: string;
}

/** A node in the canonical spine — an ENTITY TYPE (not an instance). */
export interface EntityType {
  id: string;            // canonical id, e.g. 'field'
  tier: number;          // spine ordering
  axis: Axis;
  name: string;          // display
  osdu?: string;         // OSDU master-data kind
  ktype: string;         // knowledge-base KType this maps to
  parent?: string;       // immediate canonical container (entity-type id)
  aligned: string[];     // standards aligned (USGS · IHS · PPDM · OSDU · WoodMac)
  keyAttrs: AttrDef[];   // defining attributes
  desc: string;
}

/** A relationship type between two entity types. */
export interface RelDef {
  id: string; from: string; to: string; kind: EdgeKind; cardinality: string; desc?: string;
}

/** Orthogonal fact dimensions (Wood Mackenzie pattern). All optional. */
export interface FactDims {
  prmsClass?: PrmsClass; prmsCategory?: PrmsCategory; productType?: ProductType;
  producedRemaining?: 'produced' | 'remaining'; liquidGas?: 'liquid' | 'gas';
  commercialTechnical?: 'commercial' | 'technical' | 'contingent';
  year?: number; priceDeck?: string; realNominal?: 'real' | 'nominal'; capexOpex?: 'capex' | 'opex';
}

export interface Provenance {
  dataNature: DataNature;
  source: string;
  licence?: string;
  dataClass?: DataClass;
}

/** One measured/estimated quantity — the atomic fact. */
export interface QuantityFact {
  entityId: string; metric: string; value: number; unit: string;
  dims?: FactDims; provenance: Provenance;
}

/** A concrete instance of an entity type (e.g. the Volve field). */
export interface EntityInstance {
  id: string;                 // atlas:{entity}:{authority}:{nativeId}
  type: string;               // entity-type id
  name: string;
  parentId?: string;          // spine parent instance id
  attrs?: Record<string, string | number | boolean | null>;
  refs?: Record<string, string>;   // cross-axis links (e.g. field→licence, well→reservoir)
  provenance?: Provenance;
}

/** A parsed canonical id. */
export interface AtlasId { entity: string; authority: string; nativeId: string }

/** A packaged catalogue instance (one field/asset threaded through the spine). */
export interface CatalogueBundle {
  id: string; label: string;
  instances: EntityInstance[];
  facts: QuantityFact[];
}

/** A source-native identifier retained alongside the canonical ATLAS id. */
export interface ExternalIdentifier {
  authority: string;
  id: string;
  release?: string;
}

/** Reviewed equivalence/containment between records from different authorities. */
export interface FieldIdentityLink {
  fromId: string;
  toId: string;
  relation: 'same-as' | 'contains' | 'part-of' | 'successor-of';
  confidence: number;
  method: 'authority-id' | 'reviewed-name-location' | 'manual';
  reviewed: boolean;
  note?: string;
}

/**
 * Field-level master record. GOGET and regulator catalogues populate this layer.
 * It deliberately stops at metadata: logs, grids, trajectories and time series
 * belong in linked DetailBundles.
 */
export interface FieldMasterRecord {
  id: string;
  name: string;
  unitType: 'field' | 'asset' | 'project' | 'phase' | 'pool' | 'block' | 'unknown';
  parentId?: string;
  countryArea?: string;
  region?: string;
  basin?: string;
  operator?: string;
  owners?: string[];
  status?: string;
  statusDetail?: string;
  fuelType?: string;
  productionType?: 'conventional' | 'unconventional' | 'unknown';
  shoreStatus?: 'onshore' | 'offshore' | 'unknown';
  discoveryYear?: number;
  fidYear?: number;
  startYear?: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: string;
  wikiUrl?: string;
  externalIds: ExternalIdentifier[];
  provenance: Provenance & { release?: string; sourceRow?: number };
}

/** A source-reported quantity; classifications and original units are never discarded. */
export interface FieldObservation {
  fieldId: string;
  metric: 'production' | 'reserves' | 'resources' | string;
  value: number;
  unit: string;
  year?: number;
  productType?: ProductType | 'hydrocarbons';
  classification?: string;
  originalValue?: number;
  originalUnit?: string;
  provenance: Provenance & { release?: string; sourceRow?: number };
}

/**
 * A field-specific technical package (Volve, regulator well data, partner data).
 * `fieldId` is the only required bridge to the master catalogue.
 */
export interface DetailBundle {
  id: string;
  label: string;
  fieldId: string;
  provider: string;
  licence?: string;
  domains: Array<'wells' | 'wellbores' | 'logs' | 'trajectories' | 'production'
    | 'pressure' | 'markers' | 'surfaces' | 'models' | 'documents'>;
  nativeRoot?: string;
  externalIds?: ExternalIdentifier[];
  /** OSDU governance class; internal packages never share a manifest with public data. */
  dataClass?: DataClass;
}
