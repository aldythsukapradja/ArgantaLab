// ─────────────────────────────────────────────────────────────────────────
// B1 · Artifact storage contract  (Opus, contract-freeze)
// The founder-scoped store: hq_artifact (current state) + artifact_version
// (immutable history, run_id lineage into agent_runs). Frozen column lists +
// camelCase↔snake_case row mapping — the SAME anti-drift discipline as C1's
// thread.js. B3 writes migration_hq_artifacts.sql; a test asserts the row
// mappers produce exactly these columns so the migration can't diverge.
//
// DECISION (ADR-0005): NOT an extension of hq_app. hq_app is Circle-
// distribution-shaped (product/circle_types/metrics/economy_hooks/ratings/
// featured, no versioning, no website kind). Founder artifacts are private-
// first + versioned + validation-lineaged; "export to Circle" is a later step
// that COPIES an hq_artifact into hq_app, not a shared table.
// ─────────────────────────────────────────────────────────────────────────

export const ARTIFACT_COLUMNS = Object.freeze([
  'id', 'kind', 'title', 'description', 'current_html', 'current_version',
  'template_id', 'brand_kit_id', 'status', 'visibility', 'created_by', 'created_at', 'updated_at',
]);

export const VERSION_COLUMNS = Object.freeze([
  'id', 'artifact_id', 'version_number', 'html', 'instruction', 'template_id',
  'component_ids', 'provider', 'model', 'cost_usd', 'validation', 'run_id', 'created_at',
]);

export function artifactToRow(a) {
  return {
    id: a.id, kind: a.kind, title: a.title ?? null, description: a.description ?? null,
    current_html: a.html ?? null, current_version: a.currentVersion ?? 1,
    template_id: a.templateId ?? null, brand_kit_id: a.brandKitId ?? null,
    status: a.status ?? 'draft', visibility: a.visibility ?? 'private',
    created_by: a.createdBy ?? null,
    created_at: a.createdAt ?? new Date().toISOString(), updated_at: a.updatedAt ?? new Date().toISOString(),
  };
}
export function artifactFromRow(r) {
  return {
    id: r.id, kind: r.kind, title: r.title ?? '', description: r.description ?? '',
    html: r.current_html ?? '', currentVersion: r.current_version ?? 1,
    templateId: r.template_id ?? null, brandKitId: r.brand_kit_id ?? null,
    status: r.status ?? 'draft', visibility: r.visibility ?? 'private',
    createdBy: r.created_by ?? '', createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function versionToRow(v) {
  return {
    id: v.id, artifact_id: v.artifactId, version_number: v.versionNumber,
    html: v.html ?? null, instruction: v.instruction ?? null, template_id: v.templateId ?? null,
    component_ids: v.componentIds ?? [], provider: v.provider ?? null, model: v.model ?? null,
    cost_usd: v.costUsd ?? 0, validation: v.validation ?? null, run_id: v.runId ?? null,
    created_at: v.createdAt ?? new Date().toISOString(),
  };
}
export function versionFromRow(r) {
  return {
    id: r.id, artifactId: r.artifact_id, versionNumber: r.version_number,
    html: r.html ?? '', instruction: r.instruction ?? null, templateId: r.template_id ?? null,
    componentIds: r.component_ids ?? [], provider: r.provider ?? null, model: r.model ?? null,
    costUsd: r.cost_usd ?? 0, validation: r.validation ?? null, runId: r.run_id ?? null,
    createdAt: r.created_at,
  };
}
