import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { mergeVault } from '../../knowledge/vault';
import { buildEntityIndex } from '../../knowledge/tag';
import { extractDoc, buildCandidates, detectKind } from '../../knowledge/extract';
import type { ExtractedDoc, ExtractionCandidate, VaultNote } from '../../knowledge/types';
import { Panel } from '../../components/ui';
import { Markdown } from '../md';
import { UploadCloud, FileText, Play, Check, X, CircleDot, Loader2 } from 'lucide-react';

type FileState = 'queued' | 'extracting' | 'done' | 'error';
interface QItem { id: string; file: File; kind: string; state: FileState; doc?: ExtractedDoc }
interface LogEntry { t: string; msg: string }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

export function Extraction() {
  const { userNotes, addUserNote } = useStore();
  const notes = useMemo(() => mergeVault(userNotes), [userNotes]);
  const idx = useMemo(() => buildEntityIndex(notes), [notes]);

  const [queue, setQueue] = useState<QItem[]>([]);
  const [cands, setCands] = useState<ExtractionCandidate[]>([]);
  const [selCand, setSelCand] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stage, setStage] = useState<'idle' | 'extract' | 'review' | 'compile'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => setLog((l) => [{ t: new Date().toLocaleTimeString(), msg }, ...l].slice(0, 40));

  function enqueue(files: FileList | File[]) {
    const items: QItem[] = [...files].map((f) => ({ id: 'q-' + Math.random().toString(36).slice(2, 8), file: f, kind: detectKind(f.name), state: 'queued' }));
    setQueue((q) => [...q, ...items]);
    addLog(`Queued ${items.length} file(s): ${items.map((i) => i.file.name).join(', ')}`);
  }

  async function runExtract() {
    setStage('extract');
    for (const item of queue.filter((q) => q.state === 'queued')) {
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'extracting' } : x)));
      addLog(`Extracting ${item.file.name} (${item.kind})…`);
      try {
        const doc = await extractDoc(item.file);
        const c = buildCandidates(doc, idx);
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'done', doc } : x)));
        setCands((prev) => [...prev.filter((p) => p.docId !== doc.docId), ...c]);
        addLog(`✓ ${item.file.name} → ${doc.blocks.length} blocks, ${c.length} candidates · sha256 ${doc.sha256.slice(0, 12)}…`);
      } catch (err) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'error' } : x)));
        addLog(`✗ ${item.file.name}: ${(err as Error).message}`);
      }
    }
    setStage('review');
  }

  function decide(cand: ExtractionCandidate, accept: boolean) {
    setStage('compile');
    if (accept) {
      const doc = queue.find((q) => q.doc?.docId === cand.docId)?.doc;
      const note = candidateToNote(cand, doc);
      if (note) { addUserNote(note); addLog(`ACCEPTED → ${note.title} (${note.id}) written to vault user layer`); }
    } else {
      addLog(`REJECTED → ${cand.title} (kept as record, excluded from vault)`);
    }
    setCands((cs) => cs.map((c) => (c.candId === cand.candId ? { ...c, status: accept ? 'accepted' : 'rejected', reviewedAt: new Date().toISOString() } : c)));
    setTimeout(() => setStage('review'), 400);
  }

  const byDoc = useMemo(() => {
    const map: Record<string, ExtractionCandidate[]> = {};
    for (const c of cands) (map[c.docId] ??= []).push(c);
    return map;
  }, [cands]);
  const selected = cands.find((c) => c.candId === selCand) ?? null;
  const docName = (docId: string) => queue.find((q) => q.doc?.docId === docId)?.file.name ?? docId;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 12, height: '100%', padding: 14, minHeight: 0 }}>
      {/* LEFT — source queue */}
      <Panel title="Source queue" pad={false}>
        <div style={{ padding: 10 }}>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); enqueue(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            style={{ border: '1px dashed var(--line)', borderRadius: 6, padding: '18px 12px', textAlign: 'center', cursor: 'pointer', background: 'var(--panel-2)' }}>
            <UploadCloud size={22} style={{ color: 'var(--teal)' }} />
            <div style={{ fontSize: 11.5, marginTop: 6 }}>Drop files or click</div>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 3 }}>pdf · xlsx · csv · docx · pptx · txt</div>
            <input ref={inputRef} type="file" multiple hidden accept=".pdf,.xlsx,.xls,.csv,.docx,.pptx,.txt,.md"
              onChange={(e) => { if (e.target.files) enqueue(e.target.files); e.target.value = ''; }} />
          </div>
          <button onClick={runExtract} disabled={!queue.some((q) => q.state === 'queued')}
            style={{ width: '100%', marginTop: 10, padding: '8px', borderRadius: 5, border: '1px solid var(--teal)', color: 'var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, opacity: queue.some((q) => q.state === 'queued') ? 1 : 0.4 }}>
            <Play size={14} /> Extract batch
          </button>
        </div>
        <div style={{ padding: '0 10px 10px' }}>
          {queue.map((q) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 4, background: 'var(--panel-2)', marginBottom: 4 }}>
              <FileText size={13} style={{ color: 'var(--violet)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.file.name}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{q.kind} · {(q.file.size / 1024).toFixed(0)} KB</div>
              </div>
              <StatePip state={q.state} />
            </div>
          ))}
          {queue.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px' }}>No sources queued.</div>}
        </div>
      </Panel>

      {/* CENTER — flow line + candidate cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <FlowLine stage={stage} counts={{ files: queue.length, cands: cands.length, accepted: cands.filter((c) => c.status === 'accepted').length }} />
        <Panel title={`Candidates · ${cands.length}`} pad={false} style={{ flex: 1 }}>
          <div style={{ padding: 10 }}>
            {Object.keys(byDoc).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 10 }}>Run an extraction to see proposed candidates. Nothing enters the vault without an explicit accept.</div>}
            {Object.entries(byDoc).map(([docId, list]) => (
              <div key={docId} style={{ marginBottom: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{docName(docId)}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {list.map((c) => (
                    <button key={c.candId} onClick={() => setSelCand(c.candId)}
                      style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 5, border: '1px solid ' + (selCand === c.candId ? 'var(--teal)' : 'var(--line)'),
                        background: 'var(--panel-2)', opacity: c.status === 'rejected' ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="chip mono" style={{ padding: '0 6px', fontSize: 9, color: kindColor(c.kind), borderColor: kindColor(c.kind) }}>{c.kind}</span>
                        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <StatusChip status={c.status} />
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>
                        {c.locator}{c.matchedEntities.length ? ` · ${c.matchedEntities.filter((e) => e.noteId).length}/${c.matchedEntities.length} entities resolved` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* RIGHT — inspector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <Panel title="Inspector" style={{ flex: 1 }}>
          {!selected && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Select a candidate to review its preview, matched entities and evidence, then accept or reject.</div>}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="chip mono" style={{ color: kindColor(selected.kind), borderColor: kindColor(selected.kind) }}>{selected.kind}</span>
                <span className="chip mono">{selected.locator}</span>
                <StatusChip status={selected.status} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.title}</div>
              {selected.matchedEntities.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Matched entities</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selected.matchedEntities.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                        <span className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.entity}</span>
                        <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5,
                          color: e.how === 'exact' ? 'var(--teal)' : e.how === 'alias' ? 'var(--amber)' : 'var(--rose)',
                          borderColor: e.how === 'exact' ? 'var(--teal)' : e.how === 'alias' ? 'var(--amber)' : 'var(--rose)' }}>{e.how}</span>
                        <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5, color: e.noteId ? 'var(--teal)' : 'var(--muted)' }}>{e.noteId ? 'linked' : 'orphan'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>Preview</div>
                <div style={{ maxHeight: 220, overflow: 'auto', fontSize: 11.5 }}>
                  <Markdown body={selected.body_md ?? (selected.claim ? `${selected.claim.predicate} → ${selected.claim.object}` : '')} notes={notes} />
                </div>
              </div>
              {selected.status === 'proposed' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => decide(selected, true)} style={{ flex: 1, padding: '8px', borderRadius: 5, border: '1px solid var(--teal)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}><Check size={14} /> Accept</button>
                  <button onClick={() => decide(selected, false)} style={{ flex: 1, padding: '8px', borderRadius: 5, border: '1px solid var(--rose)', color: 'var(--rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}><X size={14} /> Reject</button>
                </div>
              )}
              {selected.status !== 'proposed' && <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>reviewed {selected.reviewedAt?.slice(11, 19)}</div>}
            </div>
          )}
        </Panel>
        <Panel title="Batch log" style={{ maxHeight: 190 }}>
          {log.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Studio activity appears here.</div>}
          {log.map((l, i) => <div key={i} className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginBottom: 3 }}><span style={{ color: 'var(--teal)' }}>{l.t}</span> {l.msg}</div>)}
        </Panel>
      </div>
    </div>
  );
}

function candidateToNote(c: ExtractionCandidate, doc?: ExtractedDoc): VaultNote | null {
  if (!doc) return null;
  const evidence = `upload:${doc.sha256}#${c.locator}`;
  const wikilinks = c.matchedEntities.filter((e) => e.noteId).map((e) => `[[${e.entity}]]`);
  const body =
    (c.body_md ?? '') + '\n\n' +
    (wikilinks.length ? `**Linked entities:** ${wikilinks.join(', ')}\n\n` : '') +
    `_Extracted from ${doc.fileName} · ${c.locator} · sha256 ${doc.sha256.slice(0, 16)}…_`;
  return {
    id: `kb-extracted-${slug(doc.fileName + '-' + c.candId)}`,
    title: c.title,
    type: 'extracted',
    folder: '05 Documents',
    body_md: body,
    tags: ['extracted', doc.kind],
    version: 1,
    gen: 'extract',
    links: [],
    backlinks: [],
    explicitLinks: c.matchedEntities.filter((e) => e.noteId).map((e) => e.noteId!) as string[],
    evidence: [evidence],
    dataNature: 'reported',
    claims: c.claim ? [c.claim] : undefined,
  };
}

function FlowLine({ stage, counts }: { stage: string; counts: { files: number; cands: number; accepted: number } }) {
  const steps = [
    { id: 'source', label: 'Source', v: counts.files },
    { id: 'extract', label: 'Extract', v: counts.cands },
    { id: 'review', label: 'Review', v: counts.cands - counts.accepted },
    { id: 'compile', label: 'Compile', v: counts.accepted },
  ];
  const order = ['idle', 'extract', 'review', 'compile'];
  const activeIdx = Math.max(0, order.indexOf(stage));
  return (
    <div className="panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => {
        const on = i <= activeIdx || stage !== 'idle';
        return (
          <div key={s.id} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 20, display: 'grid', placeItems: 'center',
                border: '1px solid ' + (on ? 'var(--teal)' : 'var(--line)'), color: on ? 'var(--teal)' : 'var(--muted)', fontSize: 11 }} className="mono">{s.v}</div>
              <div>
                <div style={{ fontSize: 11.5, color: on ? 'var(--text)' : 'var(--muted)' }}>{s.label}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--line)', minWidth: 16 }} />}
          </div>
        );
      })}
    </div>
  );
}

function StatePip({ state }: { state: FileState }) {
  if (state === 'extracting') return <Loader2 size={13} className="pulse" style={{ color: 'var(--amber)' }} />;
  if (state === 'done') return <Check size={13} style={{ color: 'var(--teal)' }} />;
  if (state === 'error') return <X size={13} style={{ color: 'var(--rose)' }} />;
  return <CircleDot size={13} style={{ color: 'var(--muted)' }} />;
}
function StatusChip({ status }: { status: string }) {
  const c = status === 'accepted' ? 'var(--teal)' : status === 'rejected' ? 'var(--rose)' : 'var(--muted)';
  return <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5, color: c, borderColor: c }}>{status}</span>;
}
function kindColor(k: string) { return k === 'note' ? 'var(--violet)' : k === 'table' ? 'var(--amber)' : 'var(--blue)'; }
