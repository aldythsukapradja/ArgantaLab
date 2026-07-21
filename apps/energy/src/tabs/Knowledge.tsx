import { useMemo, useState } from 'react';
import knowledge from '../data/knowledge.json';
import { Panel } from '../components/ui';
import { Markdown } from './md';
import { FileText, FolderOpen, Link2, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Note {
  path: string; folder: string; title: string; body: string;
  backlinks: string[]; hasEvidence: boolean; evidenceCount: number;
  kind: string; referencedBy?: string[];
}

export function Knowledge() {
  const notes = knowledge.notes as unknown as Note[];
  const folders = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const n of notes) (map[n.folder] ??= []).push(n);
    return map;
  }, [notes]);
  const [active, setActive] = useState<string>(notes[0]?.path ?? '');
  const note = notes.find((n) => n.path === active) ?? notes[0];

  const backlinks = note ? notes.filter((n) => note.referencedBy?.includes(n.path)) : [];
  const outbound = note ? notes.filter((n) => n.path !== note.path && (note.backlinks.includes(n.title) || note.body.includes(n.path.split('/').pop()!))) : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: 12, height: '100%', padding: 14, minHeight: 0 }}>
      {/* EXPLORER */}
      <Panel title={`Vault · ${notes.length} notes`} pad={false}>
        <div style={{ padding: 6 }}>
          {Object.entries(folders).map(([folder, fnotes]) => (
            <div key={folder} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', color: 'var(--muted)' }}>
                <FolderOpen size={12} /><span className="mono" style={{ fontSize: 10, letterSpacing: '0.04em' }}>{folder}</span>
              </div>
              {fnotes.map((n) => (
                <button key={n.path} onClick={() => setActive(n.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 8px 6px 18px',
                    borderRadius: 3, background: active === n.path ? 'var(--panel-2)' : 'transparent',
                    borderLeft: active === n.path ? '2px solid var(--violet)' : '2px solid transparent' }}>
                  <FileText size={12} style={{ color: n.kind === 'qc' ? 'var(--amber)' : 'var(--violet)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.title}</span>
                  {n.hasEvidence
                    ? <ShieldCheck size={11} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                    : <ShieldAlert size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      {/* VIEWER */}
      <Panel
        title={note?.path}
        right={note?.hasEvidence
          ? <span className="chip" style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}><ShieldCheck size={11} /> {note.evidenceCount} evidence refs</span>
          : <span className="chip" style={{ color: 'var(--muted)' }}><ShieldAlert size={11} /> unverified</span>}
      >
        {note ? <Markdown body={note.body} /> : <div style={{ color: 'var(--muted)' }}>No note selected.</div>}
      </Panel>

      {/* BACKLINKS + EVIDENCE CONTEXT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' }}>
        <Panel title="Evidence context">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Kind" value={note?.kind === 'qc' ? 'QC refinery product' : 'Vault note'} />
            <Row label="Folder" value={note?.folder ?? '—'} />
            <Row label="Evidence links" value={String(note?.evidenceCount ?? 0)} accent={note?.hasEvidence ? 'teal' : 'muted'} />
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {note?.hasEvidence
                ? <div style={{ fontSize: 11.5, color: 'var(--teal)' }}>Cites source_id / sha256 / manifest evidence — claims are grounded.</div>
                : <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No explicit evidence citation found — treat as narrative / unverified.</div>}
            </div>
          </div>
        </Panel>

        <Panel title={`Backlinks · ${backlinks.length}`}>
          {backlinks.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No notes reference this one yet.</div>}
          {backlinks.map((b) => (
            <button key={b.path} onClick={() => setActive(b.path)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 4px', fontSize: 11.5 }}>
              <Link2 size={12} style={{ color: 'var(--violet)' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
            </button>
          ))}
        </Panel>

        <Panel title={`Outbound references · ${outbound.length}`}>
          {outbound.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No outbound references.</div>}
          {outbound.map((b) => (
            <button key={b.path} onClick={() => setActive(b.path)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 4px', fontSize: 11.5 }}>
              <Link2 size={12} style={{ color: 'var(--blue)' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
            </button>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, accent = 'text' }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
      <span className="eyebrow">{label}</span>
      <span className="mono" style={{ color: `var(--${accent})`, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
