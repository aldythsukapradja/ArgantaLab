// B3 · Single-File Builder persistence — thin wrapper over migration_hq_artifacts.sql's
// RPCs, translated through @arganta/builder's frozen row-mapping contract
// (schema.js artifactToRow/artifactFromRow/versionToRow/versionFromRow) so
// this file can't silently drift from what B1 froze. Mirrors lib/core/thread.ts's
// shape (same C2 ↔ C3 split, one batch later).
import { artifactFromRow, versionFromRow } from '@arganta/builder'
import { supabase, cloudEnabled } from '../lib/supabase'
import type { GenerateResult, ArtifactKind } from './generate'

export interface StoredArtifact {
  id: string; kind: ArtifactKind; title: string; description: string
  html: string; currentVersion: number; templateId: string | null; brandKitId: string | null
  status: string; visibility: string; createdBy: string; createdAt: string; updatedAt: string
}

export interface StoredVersion {
  id: string; artifactId: string; versionNumber: number; html: string; instruction: string | null
  templateId: string | null; componentIds: string[]; provider: string | null; model: string | null
  costUsd: number; validation: unknown; runId: string | null; createdAt: string
}

export interface Publication {
  slug: string; artifactId: string; kind: ArtifactKind
  versionNumber: number; isLive: boolean; publishedAt: string
}

// B5 (ADR-0006) — the public runtime lives at build.arganta.app, served by a
// Cloudflare Worker (workers/build-artifact-runtime/), NOT this app. This
// constant is just for building the URL to show the founder after publish.
export const PUBLIC_ARTIFACT_BASE = 'https://build.arganta.app'
const KIND_PATH: Record<ArtifactKind, string> = { application: 'a', website: 'w', game: 'g' }
export function publicArtifactUrl(kind: ArtifactKind, slug: string): string {
  return `${PUBLIC_ARTIFACT_BASE}/${KIND_PATH[kind] ?? 'w'}/${slug}`
}

/** Persists a freshly generated artifact as a new draft + its version 1.
 * Returns null (never throws) if cloud is unavailable — the caller already
 * has the generated HTML in hand and can still show it, just unsaved. */
export async function createArtifact(o: {
  kind: ArtifactKind; title: string; g: GenerateResult
  description?: string; templateId?: string; brandKitId?: string
}): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_create', {
    p_kind: o.kind, p_title: o.title, p_html: o.g.html,
    p_description: o.description ?? null, p_template_id: o.templateId ?? null, p_brand_kit_id: o.brandKitId ?? null,
    p_visibility: 'private',
    p_provider: o.g.provider, p_model: o.g.model, p_cost_usd: o.g.costUsd,
    p_validation: o.g.validation, p_run_id: o.g.runId,
  })
  if (error) { console.warn('[hq_artifact_create]', error.message); return null }
  return data as string
}

export async function saveVersion(o: {
  artifactId: string; g: GenerateResult; instruction?: string; componentIds?: string[]
}): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_save_version', {
    p_artifact_id: o.artifactId, p_html: o.g.html,
    p_instruction: o.instruction ?? null, p_template_id: null, p_component_ids: o.componentIds ?? [],
    p_provider: o.g.provider, p_model: o.g.model, p_cost_usd: o.g.costUsd,
    p_validation: o.g.validation, p_run_id: o.g.runId,
  })
  if (error) { console.warn('[hq_artifact_save_version]', error.message); return null }
  return data as string
}

/** Manual checkpoint: snapshot the artifact's CURRENT html as a new version
 * (no revision, no new generation — e.g. after a hand-edit in the Builder UI). */
export async function saveCurrentAsVersion(artifactId: string): Promise<string | null> {
  const artifact = await getArtifact(artifactId)
  if (!artifact) return null
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_save_version', {
    p_artifact_id: artifactId, p_html: artifact.html,
    p_instruction: null, p_template_id: artifact.templateId, p_component_ids: [],
    p_provider: null, p_model: null, p_cost_usd: 0, p_validation: null, p_run_id: null,
  })
  if (error) { console.warn('[hq_artifact_save_version]', error.message); return null }
  return data as string
}

export async function restoreVersion(artifactId: string, versionNumber: number): Promise<boolean> {
  if (!cloudEnabled) return false
  const { error } = await supabase.rpc('hq_artifact_restore_version', { p_artifact_id: artifactId, p_version_number: versionNumber })
  if (error) { console.warn('[hq_artifact_restore_version]', error.message); return false }
  return true
}

export async function getArtifact(id: string): Promise<StoredArtifact | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_get', { p_id: id })
  if (error) { console.warn('[hq_artifact_get]', error.message); return null }
  const row = (data || [])[0]
  return row ? (artifactFromRow(row) as StoredArtifact) : null
}

export async function listRecentArtifacts(limit = 50): Promise<StoredArtifact[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('hq_artifacts_recent', { p_limit: limit })
  if (error) { console.warn('[hq_artifacts_recent]', error.message); return [] }
  return (data || []).map((r: any) => artifactFromRow(r) as StoredArtifact)
}

export async function listVersions(artifactId: string): Promise<StoredVersion[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('hq_artifact_versions', { p_artifact_id: artifactId })
  if (error) { console.warn('[hq_artifact_versions]', error.message); return [] }
  return (data || []).map((r: any) => versionFromRow(r) as StoredVersion)
}

// ── B5 publishing (ADR-0006) — assigns/reuses a slug, pins a version,
// flips hq_artifact.status/visibility. Returns the slug (not the full URL —
// callers build the URL via publicArtifactUrl, which needs `kind`). ────────
export async function publishArtifact(artifactId: string, versionNumber?: number): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_publish', { p_artifact_id: artifactId, p_version_number: versionNumber ?? null })
  if (error) { console.warn('[hq_artifact_publish]', error.message); return null }
  return data as string
}

/** Instant, reversible takedown — never deletes the artifact or its history. */
export async function unpublishArtifact(artifactId: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { error } = await supabase.rpc('hq_artifact_unpublish', { p_artifact_id: artifactId })
  if (error) { console.warn('[hq_artifact_unpublish]', error.message); return false }
  return true
}

export async function getPublication(artifactId: string): Promise<Publication | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('hq_artifact_publication', { p_artifact_id: artifactId })
  if (error) { console.warn('[hq_artifact_publication]', error.message); return null }
  const row = (data || [])[0]
  if (!row) return null
  return { slug: row.slug, artifactId: row.artifact_id, kind: row.kind, versionNumber: row.version_number, isLive: row.is_live, publishedAt: row.published_at }
}
