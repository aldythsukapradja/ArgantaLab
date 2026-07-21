// ArgantaEnergy — Knowledge contract (M3) · v1.0.0 · LOCKED (Fable design)
// The vault + extraction shapes every surface builds against. Changing these is a
// contract event: bump version, update generators + consumers together.

import type { DataNature } from '../model/schema-meta';

export type NoteType =
  | 'field' | 'well' | 'wellbore' | 'surface' | 'datatable' | 'document'
  | 'concept' | 'decision' | 'archaeology' | 'qc' | 'extracted';

export interface Claim {
  subject: string;             // note id or entity name
  predicate: string;           // e.g. 'has_top_at', 'produced_total', 'supports'
  object: string;              // value or note id
  evidence: string[];          // source_ids → evidence ledger (empty = UNSUPPORTED, must be flagged)
  confidence: 'documented' | 'derived' | 'preliminary' | 'provisional';
  flag?: 'conflict' | 'draft' | 'unsupported';
}

export interface VaultNote {
  id: string;                  // DETERMINISTIC: kb-<type>-<slug>. Regeneration is idempotent.
  title: string;               // unique per type; wikilink resolution is title-based for prose…
  type: NoteType;
  folder: string;              // 'NN Name' fixed zones
  body_md: string;             // markdown with [[wikilinks]]
  tags: string[];
  event_date?: string;         // valid time (bitemporal: when the fact holds)
  version: number;             // recorded revision
  gen?: string;                // provenance flag = generator stage id; stage strips+rebuilds its own output
  links: string[];             // computed forward links (note ids)
  backlinks: string[];         // computed (one-pass inversion)
  explicitLinks?: string[];    // …but MACHINE cross-refs link by ID here (title collisions can't break them)
  evidence: string[];          // source_ids (mirror-manifest volumePaths)
  dataNature: DataNature;
  claims?: Claim[];
}

export interface KnowledgeBase {
  version: string;
  generatedAt: string;
  folders: string[];
  notes: VaultNote[];
}

// ─── Extraction Studio contract (office docs → reviewed knowledge) ───────────
// Deterministic-first: parsing + tagging are rules/parsers, NEVER an LLM.
// Nothing enters the vault without passing the human review queue.

export type DocKind = 'pdf' | 'xlsx' | 'pptx' | 'docx' | 'csv' | 'txt' | 'image' | 'unknown';

export interface ExtractedBlock {
  kind: 'heading' | 'paragraph' | 'table' | 'kv' | 'image';
  text?: string;
  table?: { columns: string[]; rows: (string | number | null)[][] };
  locator: string;             // 'page 3' | 'sheet Prod!' | 'slide 7' — always present
}

export interface ExtractedDoc {
  docId: string;               // xd-<sha256(first 12)>
  fileName: string;
  kind: DocKind;
  sha256: string;              // content hash = the evidence anchor for user uploads
  bytes: number;
  extractedAt: string;
  blocks: ExtractedBlock[];
  meta: Record<string, string>; // title/author/created where the format provides them
}

// A candidate is ONE proposed knowledge item, tagged deterministically against the
// ontology (well names via normalizeWellbore, surfaces via the bridge, dates, numbers+units).
export interface ExtractionCandidate {
  candId: string;              // xc-<docId>-<n>
  docId: string;
  locator: string;
  kind: 'note' | 'claim' | 'table';
  title: string;
  body_md?: string;
  claim?: Claim;
  matchedEntities: { entity: string; noteId: string | null; how: 'exact' | 'alias' | 'fuzzy' }[];
  // fuzzy matches and null noteIds are exactly the orphan rule: propose, never auto-merge.
  status: 'proposed' | 'accepted' | 'rejected';
  reviewedAt?: string;
}

export interface ExtractionJob {
  jobId: string;
  docs: ExtractedDoc[];
  candidates: ExtractionCandidate[];
  createdAt: string;
}

// User-layer persistence: accepted candidates become VaultNotes with
// gen:'extract', dataNature:'reported' (document-derived), evidence:[`upload:${sha256}#${locator}`].
// Precedence when ids collide: user/extracted ▸ generated (the 3-layer rule).
export const KB_VERSION = '1.0.0';
