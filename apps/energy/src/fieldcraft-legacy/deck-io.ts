import { VOLVE_DAYS } from './catalog';
import {
  commitRevision, currentRevision, diffDecks, getDeck, getMaterialContent, slideId,
} from './content-store';
import { downloadText } from './materials';
import { getBundles, putBundle } from './officegen/opaque-store';
import { buildPptx } from './officegen/pptx-writer';
import { readPptx } from './officegen/pptx-reader';
import type { ChangeSummary, DeckDoc, SlideBlock } from './types';

/**
 * The seam between the content store and the Office file formats.
 *
 * Import never writes straight into history: it returns a *proposal* — the
 * document that would result, the diff against what is live, and any warnings —
 * so the trainer confirms before a revision is recorded. A deck built from a
 * revision that has since moved on is flagged rather than silently applied.
 */

export type ImportProposal = {
  materialId: string;
  doc: DeckDoc;
  summary: ChangeSummary;
  warnings: string[];
  /** Set when the .pptx was exported from a revision that is no longer current. */
  staleBase?: { base: string; current: string };
  /** Set when the file carries no Fieldcraft manifest at all. */
  foreign: boolean;
  /** Bundles captured from PowerPoint-only slides, pending commit. */
  pending: Array<{ ref: string; bundle: Parameters<typeof putBundle>[1] }>;
};

function dayFor(materialId: string) {
  return VOLVE_DAYS.find((d) => d.materials.some((m) => m.id === materialId));
}

export function deckFileName(materialId: string): string {
  const day = dayFor(materialId);
  const rev = currentRevision(materialId);
  const base = day ? `day-${day.number}-${day.verb.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : materialId;
  return `${base}-v${rev?.n ?? 1}.pptx`;
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export async function exportDeckPptx(materialId: string): Promise<void> {
  const deck = getDeck(materialId);
  const day = dayFor(materialId);
  if (!deck || !day) throw new Error(`No deck for material ${materialId}`);
  const rev = currentRevision(materialId);

  const refs = deck.slides.map((s) => s.opaqueRef).filter((r): r is string => !!r);
  const opaque = refs.length ? await getBundles(refs) : {};

  const zip = buildPptx({
    deck,
    opaque,
    accent: day.color,
    dayLabel: `Day ${day.number} · ${day.verb}`,
    manifest: {
      courseId: 'volve-mission',
      materialId,
      baseRevision: rev?.id ?? 'rev-1',
      exportedAt: Date.now(),
      title: day.materials.find((m) => m.id === materialId)?.title ?? materialId,
    },
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  });
  downloadBlob(deckFileName(materialId), blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Import ─────────────────────────────────────────────────────────────── */

/**
 * Parse a .pptx into a proposal. `expectedMaterialId` is the deck the trainer
 * was looking at when they chose the file; a manifest that disagrees is a
 * warning rather than an error, because dragging the wrong file in is an easy
 * and recoverable mistake.
 */
export async function proposeImport(file: File | Blob, expectedMaterialId: string): Promise<ImportProposal> {
  const result = await readPptx(await file.arrayBuffer());
  const warnings = [...result.warnings];

  const materialId = result.manifest.materialId ?? expectedMaterialId;
  if (result.foreign) {
    warnings.unshift('This file has no Fieldcraft identity, so slides are matched by position and treated as new.');
  } else if (materialId !== expectedMaterialId) {
    warnings.unshift(`This file was exported from a different material (${materialId}). Importing it here would replace the deck you are viewing.`);
  }

  const target = expectedMaterialId;
  const day = dayFor(target);
  const live = getDeck(target);
  const content = getMaterialContent(target);

  let staleBase: ImportProposal['staleBase'];
  const base = result.manifest.baseRevision;
  if (base && content && base !== content.current) {
    staleBase = { base, current: content.current };
  }

  // Resolve identity and bundle reference together, in one pass, so a slide's
  // opaqueRef can never drift from the id it was finally given. Foreign decks
  // carry no identity, so they fall back to position against the live deck
  // rather than inventing unrelated ids that would read as wholesale churn.
  const slides: SlideBlock[] = [];
  const pending: ImportProposal['pending'] = [];

  result.slides.forEach((r, i) => {
    const id = result.foreign ? (live?.slides[i]?.id ?? slideId(day?.number ?? 0, i)) : r.slide.id;
    const slide: SlideBlock = { ...r.slide, id };
    if (r.bundle) {
      slide.opaqueRef = `op:${target}:${id}`;
      pending.push({ ref: slide.opaqueRef, bundle: r.bundle });
    }
    slides.push(slide);
  });

  const doc: DeckDoc = { materialId: target, dayId: live?.dayId ?? day?.id ?? '', slides };
  return { materialId: target, doc, summary: diffDecks(live, doc), warnings, staleBase, foreign: result.foreign, pending };
}

/** Commit a reviewed proposal: bundles first, then the revision that needs them. */
export async function applyImport(proposal: ImportProposal, note?: string) {
  for (const p of proposal.pending) {
    try { await putBundle(p.ref, p.bundle); } catch { /* slide degrades to a label */ }
  }
  return commitRevision(proposal.materialId, proposal.doc, {
    source: 'pptx-import',
    at: Date.now(),
    note: note ?? `Imported from PowerPoint · ${summaryText(proposal.summary)}`,
  });
}

function summaryText(s: ChangeSummary): string {
  const bits: string[] = [];
  if (s.added) bits.push(`${s.added} added`);
  if (s.removed) bits.push(`${s.removed} removed`);
  if (s.edited) bits.push(`${s.edited} edited`);
  if (s.reordered) bits.push('reordered');
  return bits.join(' · ') || 'no changes';
}

/** Markdown fallback so a deck is readable without PowerPoint at all. */
export function exportDeckMarkdown(materialId: string) {
  const deck = getDeck(materialId);
  if (!deck) return;
  const lines: string[] = [];
  deck.slides.forEach((s, i) => {
    lines.push(`## Slide ${i + 1} · ${s.title ?? s.opaqueLabel ?? 'Untitled'}`, '');
    if (s.eyebrow) lines.push(`_${s.eyebrow}_`, '');
    if (s.body) lines.push(s.body, '');
    (s.bullets ?? []).forEach((b) => lines.push(`- ${b}`));
    if (s.bullets?.length) lines.push('');
    if (s.note) lines.push(`> ${s.note}`, '');
  });
  downloadText(deckFileName(materialId).replace(/\.pptx$/, '.md'), lines.join('\n'));
}
