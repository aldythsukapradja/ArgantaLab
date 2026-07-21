import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { mergeVault, resolveEvidence } from '../../knowledge/vault';
import type { VaultNote } from '../../knowledge/types';
import { Panel } from '../../components/ui';
import { NatureBadge, type DataNature } from '../../components/Provenance';
import { Markdown } from '../md';
import { FileText, FolderOpen, Link2, ShieldCheck, ShieldAlert, Search, Sparkles } from 'lucide-react';

const TYPE_ACCENT: Record<string, string> = {
  field: 'var(--teal)', well: 'var(--blue)', wellbore: 'var(--blue)', surface: 'var(--orange)',
  datatable: 'var(--amber)', document: 'var(--violet)', concept: 'var(--muted)', decision: 'var(--rose)',
  archaeology: 'var(--muted)', qc: 'var(--amber)', extracted: 'var(--violet)',
};
const asNature = (n: string): DataNature => (['measured', 'reported', 'interpreted', 'derived'].includes(n) ? n : 'derived') as DataNature;

export function Explorer() {
  const { userNotes, selectedNoteId, openNote } = useStore();
  const notes = useMemo(() => mergeVault(userNotes), [userNotes]);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState<string>(selectedNoteId ?? notes[0]?.id ?? '');
  // follow cross-surface selection (graph/cosmo → openNote)
  const active = selectedNoteId && byId.has(selectedNoteId) ? selectedNoteId : activeId;
  const note = byId.get(active) ?? notes[0];

  const folders = useMemo(() => {
    const map: Record<string, VaultNote[]> = {};
    const ql = q.toLowerCase();
    for (const n of notes) {
      if (ql && !(n.title.toLowerCase().includes(ql) || n.tags.some((t) => t.toLowerCase().includes(ql)))) continue;
      (map[n.folder] ??= []).push(n);
    }
    return map;
  }, [notes, q]);

  function select(id: string) { setActiveId(id); useStore.setState({ selectedNoteId: id }); }

  const backlinks = note ? note.backlinks.map((id) => byId.get(id)).filter(Boolean) as VaultNote[] : [];
  const isExtracted = note?.gen === 'extract';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 288px', gap: 12, height: '100%', padding: 14, minHeight: 0 }}>
      {/* TREE */}
      <Panel title={`Vault · ${notes.length} notes`} pad={false}>
        <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '5px 8px' }}>
            <Search size={12} style={{ color: 'var(--muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / tags…"
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 11.5, outline: 'none' }} />
          </div>
        </div>
        <div style={{ padding: 6 }}>
          {Object.entries(folders).map(([folder, fnotes]) => (
            <div key={folder} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', color: 'var(--muted)' }}>
                <FolderOpen size={12} /><span className="mono" style={{ fontSize: 10, letterSpacing: '0.04em', flex: 1 }}>{folder}</span>
                <span className="chip mono" style={{ padding: '0 5px', fontSize: 9 }}>{fnotes.length}</span>
              </div>
              {fnotes.map((n) => (
                <button key={n.id} onClick={() => select(n.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 8px 6px 18px',
                    borderRadius: 3, background: active === n.id ? 'var(--panel-2)' : 'transparent',
                    borderLeft: active === n.id ? '2px solid var(--violet)' : '2px solid transparent' }}>
                  {n.gen === 'extract' ? <Sparkles size={12} style={{ color: 'var(--violet)', flexShrink: 0 }} /> : <FileText size={12} style={{ color: TYPE_ACCENT[n.type] ?? 'var(--muted)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.title}</span>
                  {n.evidence.length > 0
                    ? <ShieldCheck size={11} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                    : <ShieldAlert size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ))}
          {Object.keys(folders).length === 0 && <div style={{ padding: 12, fontSize: 11.5, color: 'var(--muted)' }}>No notes match “{q}”.</div>}
        </div>
      </Panel>

      {/* VIEWER */}
      <Panel title={note ? `${note.folder} / ${note.title}` : '—'}
        right={isExtracted ? <span className="chip" style={{ color: 'var(--violet)', borderColor: 'var(--violet)' }}><Sparkles size={11} /> extracted</span> : undefined}>
        {note ? <Markdown body={note.body_md} notes={notes} onOpenNote={openNote} /> : <div style={{ color: 'var(--muted)' }}>No note selected.</div>}
      </Panel>

      {/* CONTEXT: frontmatter · evidence · backlinks · claims */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' }}>
        <Panel title="Frontmatter">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="chip mono" style={{ color: TYPE_ACCENT[note?.type ?? ''] ?? 'var(--muted)', borderColor: 'var(--line)' }}>{note?.type}</span>
            <span className="chip mono">{note?.folder}</span>
            {note && <NatureBadge nature={asNature(note.dataNature)} />}
            <span className="chip mono">v{note?.version ?? 1}</span>
            {note?.gen && <span className="chip mono" title="generator provenance">{note.gen}</span>}
          </div>
        </Panel>

        <Panel title={`Evidence · ${note?.evidence.length ?? 0}`}>
          {(!note || note.evidence.length === 0) && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No evidence citation — treat as narrative / unverified.</div>}
          {note?.evidence.map((e, i) => <EvidenceRow key={i} sourceId={e} />)}
        </Panel>

        <Panel title={`Backlinks · ${backlinks.length}`}>
          {backlinks.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No notes reference this one.</div>}
          {backlinks.map((b) => (
            <button key={b.id} onClick={() => select(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 4px', fontSize: 11.5 }}>
              <Link2 size={12} style={{ color: 'var(--violet)' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
            </button>
          ))}
        </Panel>

        {note?.claims && note.claims.length > 0 && (
          <Panel title={`Claims · ${note.claims.length}`}>
            {note.claims.map((c, i) => (
              <div key={i} style={{ fontSize: 11.5, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="mono" style={{ color: 'var(--text)' }}>{c.predicate} → {c.object}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span className="chip mono" style={{ padding: '0 5px', fontSize: 9 }}>{c.confidence}</span>
                  {c.flag && <span className="chip mono" style={{ padding: '0 5px', fontSize: 9, color: 'var(--rose)', borderColor: 'var(--rose)' }}>{c.flag}</span>}
                  {c.evidence.length === 0 && <span className="chip mono" style={{ padding: '0 5px', fontSize: 9, color: 'var(--rose)', borderColor: 'var(--rose)' }}>UNSUPPORTED</span>}
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

function EvidenceRow({ sourceId }: { sourceId: string }) {
  const [open, setOpen] = useState(false);
  const resolved = sourceId.startsWith('upload:') ? { sha256: sourceId.split(':')[1]?.split('#')[0] ?? '', size: 0 } : resolveEvidence(sourceId);
  return (
    <button onClick={() => setOpen((v) => !v)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 4px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        {resolved ? <ShieldCheck size={11} style={{ color: 'var(--teal)', flexShrink: 0 }} /> : <ShieldAlert size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sourceId}</span>
      </div>
      {open && resolved && <div className="mono" style={{ fontSize: 9.5, color: 'var(--teal)', marginTop: 4, wordBreak: 'break-all' }}>sha256: {resolved.sha256}</div>}
      {open && !resolved && <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>not resolvable in mirror ledger</div>}
    </button>
  );
}
