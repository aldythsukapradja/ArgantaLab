// cosmo/ExtractionStudio.tsx — Knowledge → Extraction Studio.
//
// Turns unstructured documents into REVIEWED vault knowledge. Two source lanes:
//
//   Workspace   already ingested through Data QC. Their digest ALREADY holds the
//               extracted blocks and tagged candidates, so this lane costs one
//               IndexedDB read — no re-upload, no re-parse. This is the Data QC →
//               Knowledge link.
//   Upload      ad-hoc files, extracted here and now via knowledge/extract.ts.
//
// Deterministic-first: parsing and entity tagging are parsers and rules, never an
// LLM. Nothing reaches the vault without an explicit human Accept — and the
// verdict is written to knowledge/review.ts so it survives a remount.
//
// Reference-implementation bugs deliberately NOT ported (see the founder's studio):
// entity counts that are always zero, a rebuild() that deletes every entity note on
// the first Accept, and entity filenames that collide across documents.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud, FileText, Play, Check, X, Loader2, Database,
  Link2, ChevronRight, Inbox, RefreshCw,
} from 'lucide-react';
import { useStore } from '../store';
import { mergeVault } from '../knowledge/vault';
import { buildEntityIndex } from '../knowledge/tag';
import { extractDoc, buildCandidates, detectKind } from '../knowledge/extract';
import type { ExtractedDoc, ExtractionCandidate, VaultNote } from '../knowledge/types';
import {
  applyReviews, loadReviews, recordReview, tally, type ReviewLedger,
} from '../knowledge/review';
import { getAsset, getBlob, listAllAssets, putAsset, putBlob } from '../dataqc/db';
import { readRecord } from '../dataqc/readDigest';
import { digestRecord } from '../dataqc/digest';
import { Markdown } from '../tabs/md';
import './extraction-studio.css';

type SourceOrigin = 'workspace' | 'upload';
type FileState = 'queued' | 'extracting' | 'done' | 'error';

interface Source {
  id: string;
  name: string;
  kind: string;
  origin: SourceOrigin;
  state: FileState;
  bytes: number;
  file?: File;                 // upload lane only
  doc?: ExtractedDoc;
  error?: string;
  /** workspace lane: the field this delivery belongs to */
  fieldId?: string;
  /** workspace lane: extraction was page-capped during bundle load */
  truncated?: boolean;
  /** workspace lane: where the original bytes live (IndexedDB key or public URL) */
  blobKey?: string;
  /** the real filename WITH its extension — detectKind() parses the extension, so
   *  re-extraction must not be handed the human-readable display label */
  fileName?: string;
}

interface DocPayload { doc: ExtractedDoc; candidates: ExtractionCandidate[] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const KBs = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(2)} MB`);

/** An accepted candidate becomes a vault note anchored to its source bytes.
 *  `upload:<sha256>#<locator>` is the evidence id — the note can always be traced
 *  back to the exact page of the exact file it came from. */
export function candidateToNote(c: ExtractionCandidate, doc: ExtractedDoc): VaultNote {
  const evidence = `upload:${doc.sha256}#${c.locator}`;
  const linked = c.matchedEntities.filter((e) => e.noteId);
  const body =
    (c.body_md ?? '') + '\n\n' +
    (linked.length ? `**Linked entities:** ${linked.map((e) => `[[${e.entity}]]`).join(', ')}\n\n` : '') +
    `_Extracted from ${doc.fileName} · ${c.locator} · sha256 ${doc.sha256.slice(0, 16)}…_`;
  return {
    // docId is part of the id, so the same title in two documents cannot collide
    id: `kb-extracted-${slug(doc.fileName)}-${c.candId}`,
    title: c.title,
    type: 'extracted',
    folder: '05 Documents',
    body_md: body,
    tags: ['extracted', doc.kind],
    version: 1,
    gen: 'extract',
    links: [],
    backlinks: [],
    explicitLinks: linked.map((e) => e.noteId!),
    evidence: [evidence],
    dataNature: 'reported',
    claims: c.claim ? [c.claim] : undefined,
  };
}

export function ExtractionStudio() {
  const { userNotes, addUserNote } = useStore();
  const notes = useMemo(() => mergeVault(userNotes), [userNotes]);
  const idx = useMemo(() => buildEntityIndex(notes), [notes]);

  const [sources, setSources] = useState<Source[]>([]);
  const [cands, setCands] = useState<ExtractionCandidate[]>([]);
  const [ledger, setLedger] = useState<ReviewLedger>(() => loadReviews());
  const [selCand, setSelCand] = useState<string | null>(null);
  const [selDoc, setSelDoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingWs, setLoadingWs] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── workspace lane: documents already ingested by Data QC ──────────────────
  // Their digest holds {doc, candidates}; reading it is the whole extraction.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const all = await listAllAssets();
        const docs = all.filter((a) => a.kind === 'document');
        if (dead) return;
        const loaded: Source[] = [];
        const allCands: ExtractionCandidate[] = [];
        for (const a of docs) {
          const payload = await readRecord<DocPayload>(a);
          if (dead) return;
          if (!payload?.doc) continue;
          loaded.push({
            id: a.id,
            name: String(a.meta.title ?? a.fileName),
            kind: payload.doc.kind,
            origin: 'workspace',
            state: 'done',
            bytes: a.bytes,
            doc: payload.doc,
            fieldId: a.fieldId,
            truncated: payload.doc.blocks.some((b) => b.locator.startsWith('pages ')),
            blobKey: a.blobKey,
            fileName: a.fileName,
          });
          allCands.push(...(payload.candidates ?? []));
        }
        if (dead) return;
        setSources((s) => [...loaded, ...s.filter((x) => x.origin === 'upload')]);
        setCands((c) => [...allCands, ...c.filter((x) => !allCands.some((n) => n.candId === x.candId))]);
      } catch { /* Studio still works as an upload-only surface */ }
      finally { if (!dead) setLoadingWs(false); }
    })();
    return () => { dead = true; };
  }, []);

  // decisions from earlier sessions replay onto whatever is on screen now
  const reviewed = useMemo(() => applyReviews(cands, ledger), [cands, ledger]);
  const counts = useMemo(() => tally(reviewed), [reviewed]);

  const enqueue = useCallback((files: FileList | File[]) => {
    const items: Source[] = [...files].map((f) => ({
      id: `up-${f.name}-${f.size}`,
      name: f.name, kind: detectKind(f.name), origin: 'upload' as const,
      state: 'queued' as const, bytes: f.size, file: f,
    }));
    setSources((s) => [...s, ...items.filter((i) => !s.some((x) => x.id === i.id))]);
  }, []);

  const runExtract = useCallback(async () => {
    setBusy(true);
    const queued = sources.filter((s) => s.state === 'queued' && s.file);
    for (const item of queued) {
      setSources((s) => s.map((x) => (x.id === item.id ? { ...x, state: 'extracting' } : x)));
      try {
        const doc = await extractDoc(item.file!);
        const c = buildCandidates(doc, idx);
        setSources((s) => s.map((x) => (x.id === item.id ? { ...x, state: 'done', doc } : x)));
        setCands((prev) => [...prev.filter((p) => p.docId !== doc.docId), ...c]);
      } catch (err) {
        setSources((s) => s.map((x) => (x.id === item.id ? { ...x, state: 'error', error: (err as Error).message } : x)));
      }
    }
    setBusy(false);
  }, [sources, idx]);

  // Workspace documents carry whatever page budget the bundle loader used, so a
  // long report arrives truncated. Re-reading the ORIGINAL bytes uncapped fixes
  // that, and because docId is sha256-derived the candidate ids are unchanged —
  // verdicts already recorded still apply. The fuller digest is written back so
  // the cap is paid off once, not every session.
  const reExtract = useCallback(async (src: Source) => {
    if (!src.blobKey) return;
    setSources((s) => s.map((x) => (x.id === src.id ? { ...x, state: 'extracting' } : x)));
    try {
      const stored = await getBlob(src.blobKey);
      const blob = stored ?? await fetch(src.blobKey).then((r) => (r.ok ? r.blob() : null));
      if (!blob) throw new Error('original bytes unavailable');
      const doc = await extractDoc(new File([blob], src.fileName ?? src.name));   // uncapped
      const cands = buildCandidates(doc, idx);

      const asset = await getAsset(src.id);
      if (asset?.digestKey) {
        const r = digestRecord('document', { doc, candidates: cands }, {});
        const bytes = new Uint8Array(r.compressed.length);
        bytes.set(r.compressed);
        await putBlob(asset.digestKey, new Blob([bytes.buffer], { type: 'application/gzip' }));
        await putAsset({
          ...asset,
          compressedBytes: r.compressedBytes,
          meta: { ...asset.meta, pages: doc.blocks.length, candidates: cands.length },
        });
      }
      setSources((s) => s.map((x) => (x.id === src.id ? { ...x, state: 'done', doc, kind: doc.kind, truncated: false } : x)));
      setCands((prev) => [...prev.filter((p) => p.docId !== doc.docId), ...cands]);
    } catch (err) {
      setSources((s) => s.map((x) => (x.id === src.id ? { ...x, state: 'error', error: (err as Error).message } : x)));
    }
  }, [idx]);

  const decide = useCallback((cand: ExtractionCandidate, accept: boolean) => {
    const at = new Date().toISOString();
    if (accept) {
      const doc = sources.find((s) => s.doc?.docId === cand.docId)?.doc;
      // no doc = no evidence anchor; refuse rather than write an unanchored note
      if (!doc) return;
      addUserNote(candidateToNote(cand, doc));
    }
    setLedger((l) => recordReview(l, cand.candId, accept ? 'accepted' : 'rejected', at));
  }, [sources, addUserNote]);

  const byDoc = useMemo(() => {
    const map = new Map<string, ExtractionCandidate[]>();
    for (const c of reviewed) {
      const list = map.get(c.docId);
      if (list) list.push(c); else map.set(c.docId, [c]);
    }
    return map;
  }, [reviewed]);

  const docIdOf = (s: Source) => s.doc?.docId ?? null;
  const visibleDocs = selDoc ? sources.filter((s) => docIdOf(s) === selDoc) : sources;
  const selected = reviewed.find((c) => c.candId === selCand) ?? null;
  const selectedDoc = selected ? sources.find((s) => s.doc?.docId === selected.docId)?.doc : undefined;
  const workspaceCount = sources.filter((s) => s.origin === 'workspace').length;

  return (
    <div className="xs">
      <div className="xs-flow">
        {[
          { k: 'src', label: 'Sources', v: sources.length, hint: `${workspaceCount} from workspace` },
          { k: 'cand', label: 'Candidates', v: counts.total, hint: 'deterministically tagged' },
          { k: 'pending', label: 'Pending review', v: counts.pending, hint: 'awaiting a human verdict' },
          { k: 'acc', label: 'In vault', v: counts.accepted, hint: `${counts.rejected} rejected` },
        ].map((s) => (
          <div key={s.k} className={'xs-flow-step' + (s.v > 0 ? ' on' : '')}>
            <span className="xs-flow-v">{s.v}</span>
            <span className="xs-flow-l">{s.label}</span>
            <span className="xs-flow-h">{s.hint}</span>
          </div>
        ))}
      </div>

      <div className="xs-body">
        {/* ── sources ── */}
        <aside className="xs-sources">
          <div
            className="xs-drop"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); enqueue(e.dataTransfer.files); }}
          >
            <UploadCloud size={16} />
            <b>Drop documents</b>
            <span>pdf · docx · pptx · xlsx · csv · txt</span>
            <input
              ref={inputRef} type="file" multiple hidden
              accept=".pdf,.xlsx,.xls,.csv,.docx,.pptx,.txt,.md"
              onChange={(e) => { if (e.target.files) enqueue(e.target.files); e.target.value = ''; }}
            />
          </div>
          {sources.some((s) => s.state === 'queued') && (
            <button className="xs-run" disabled={busy} onClick={() => void runExtract()}>
              {busy ? <Loader2 size={13} className="xs-spin" /> : <Play size={13} />} Extract queued
            </button>
          )}

          <div className="xs-lane">
            <Database size={11} /> Workspace · {workspaceCount}
            <em>already ingested via Data QC</em>
          </div>
          {loadingWs && <div className="xs-muted">Reading ingested documents…</div>}
          {!loadingWs && workspaceCount === 0 && (
            <div className="xs-muted">No documents ingested yet. Load a delivery in a workspace Data QC tab, or drop files above.</div>
          )}
          {sources.filter((s) => s.origin === 'workspace').map((s) => (
            <SourceRow key={s.id} s={s} active={selDoc === docIdOf(s)}
              n={byDoc.get(docIdOf(s) ?? '')?.length ?? 0}
              onClick={() => setSelDoc(selDoc === docIdOf(s) ? null : docIdOf(s))}
              onReExtract={s.blobKey ? () => void reExtract(s) : undefined} />
          ))}

          {sources.some((s) => s.origin === 'upload') && (
            <>
              <div className="xs-lane"><Inbox size={11} /> Uploaded</div>
              {sources.filter((s) => s.origin === 'upload').map((s) => (
                <SourceRow key={s.id} s={s} active={selDoc === docIdOf(s)}
                  n={byDoc.get(docIdOf(s) ?? '')?.length ?? 0}
                  onClick={() => docIdOf(s) && setSelDoc(selDoc === docIdOf(s) ? null : docIdOf(s))} />
              ))}
            </>
          )}
        </aside>

        {/* ── candidates ── */}
        <div className="xs-cands">
          {counts.total === 0 && !loadingWs && (
            <div className="xs-muted xs-pad">
              No candidates yet. Nothing enters the vault without an explicit accept.
            </div>
          )}
          {visibleDocs.filter((s) => s.doc).map((s) => {
            const list = byDoc.get(s.doc!.docId) ?? [];
            if (!list.length) return null;
            return (
              <div key={s.id} className="xs-group">
                <div className="xs-group-h">
                  <FileText size={11} /> {s.name}
                  <i>{list.length} candidate{list.length === 1 ? '' : 's'}</i>
                </div>
                {list.map((c) => (
                  <button
                    key={c.candId}
                    className={'xs-cand' + (selCand === c.candId ? ' sel' : '') + ` st-${c.status}`}
                    onClick={() => setSelCand(c.candId)}
                  >
                    <span className={`xs-kind k-${c.kind}`}>{c.kind}</span>
                    <span className="xs-cand-t">{c.title}</span>
                    <span className="xs-cand-loc">{c.locator}</span>
                    {c.matchedEntities.length > 0 && (
                      <span className="xs-cand-ent">
                        <Link2 size={9} />{c.matchedEntities.filter((e) => e.noteId).length}/{c.matchedEntities.length}
                      </span>
                    )}
                    <span className={`xs-status s-${c.status}`}>{c.status}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* ── inspector ── */}
        <aside className="xs-inspect">
          {!selected && (
            <div className="xs-muted">Select a candidate to review its text, matched entities and evidence anchor, then accept or reject.</div>
          )}
          {selected && (
            <>
              <div className="xs-i-head">
                <span className={`xs-kind k-${selected.kind}`}>{selected.kind}</span>
                <span className={`xs-status s-${selected.status}`}>{selected.status}</span>
              </div>
              <h4 className="xs-i-title">{selected.title}</h4>
              <div className="xs-kv"><span>locator</span><span>{selected.locator}</span></div>
              {selectedDoc && (
                <div className="xs-kv"><span>evidence</span><span title={`upload:${selectedDoc.sha256}#${selected.locator}`}>sha256 {selectedDoc.sha256.slice(0, 12)}…</span></div>
              )}

              {selected.matchedEntities.length > 0 && (
                <>
                  <div className="xs-h">Matched entities</div>
                  {selected.matchedEntities.map((e, i) => (
                    <div key={i} className="xs-ent">
                      <span className="xs-ent-n">{e.entity}</span>
                      <span className={`xs-how h-${e.how}`}>{e.how}</span>
                      <span className={'xs-link' + (e.noteId ? ' on' : '')}>{e.noteId ? 'linked' : 'orphan'}</span>
                    </div>
                  ))}
                </>
              )}

              <div className="xs-h">Preview</div>
              <div className="xs-prev">
                <Markdown
                  body={selected.body_md ?? (selected.claim ? `${selected.claim.predicate} → ${selected.claim.object}` : '')}
                  notes={notes}
                />
              </div>

              {selected.status === 'proposed' ? (
                <div className="xs-actions">
                  <button className="xs-acc" onClick={() => decide(selected, true)} disabled={!selectedDoc}>
                    <Check size={13} /> Accept
                  </button>
                  <button className="xs-rej" onClick={() => decide(selected, false)}>
                    <X size={13} /> Reject
                  </button>
                </div>
              ) : (
                <div className="xs-reviewed">
                  reviewed {selected.reviewedAt?.slice(0, 19).replace('T', ' ')}
                  <button onClick={() => setLedger((l) => { const n = { ...l }; delete n[selected.candId]; try { localStorage.setItem('ae_kb_review', JSON.stringify(n)); } catch { /* ignore */ } return n; })}>
                    reopen
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function SourceRow({ s, n, active, onClick, onReExtract }: {
  s: Source; n: number; active: boolean; onClick: () => void; onReExtract?: () => void;
}) {
  return (
    <div className={'xs-src' + (active ? ' on' : '')} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}>
      <span className="xs-src-ic">
        {s.state === 'extracting' ? <Loader2 size={12} className="xs-spin" />
          : s.state === 'error' ? <X size={12} />
          : <FileText size={12} />}
      </span>
      <span className="xs-src-main">
        <span className="xs-src-n">{s.name}</span>
        <span className="xs-src-m">
          {s.kind} · {KBs(s.bytes)}
          {n > 0 && ` · ${n} candidates`}
          {s.truncated && ' · page-capped'}
        </span>
      </span>
      {s.state === 'queued' && <span className="xs-q">queued</span>}
      {s.error && <span className="xs-err" title={s.error}>error</span>}
      {onReExtract && s.state !== 'extracting' && (
        <button className={'xs-refetch' + (s.truncated ? ' urgent' : '')}
          title={s.truncated
            ? `Only the first pages were read. Re-read ${s.name} in full.`
            : `Re-read ${s.name} from its original bytes and re-tag it.`}
          onClick={(e) => { e.stopPropagation(); onReExtract(); }}>
          <RefreshCw size={11} />
        </button>
      )}
      {n > 0 && <ChevronRight size={12} />}
    </div>
  );
}
