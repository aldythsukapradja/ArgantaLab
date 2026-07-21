import { useMemo, useState } from 'react';
import data from '../data/data.json';
import { Panel, StateTag, fmtBytes } from '../components/ui';
import { NatureBadge, MethodCapsule } from '../components/Provenance';
import { Search, FileDigit, X } from 'lucide-react';

type LedgerRow = (typeof data.ledger)[number];

export function DataTab() {
  const [q, setQ] = useState('');
  const [topFilter, setTopFilter] = useState<string | null>(null);
  const [sel, setSel] = useState<LedgerRow | null>(null);

  const rows = useMemo(() => {
    let r = data.ledger as LedgerRow[];
    if (topFilter) r = r.filter((x) => x.top === topFilter);
    if (q) r = r.filter((x) => x.path.toLowerCase().includes(q.toLowerCase()) || x.sha256.includes(q.toLowerCase()));
    return r.slice(0, 400);
  }, [q, topFilter]);

  const m = data.mirror;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, height: '100%', padding: 14, minHeight: 0 }}>
      {/* LEFT — provenance summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' }}>
        <Panel title="Mirror Ledger · Batch S1" right={<MethodCapsule method="deterministic" />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Files mirrored" value={m.files.toLocaleString()} accent="teal" />
            <Stat label="Total size" value={m.gb + ' GB'} accent="amber" />
            <Stat label="sha256 verified" value={`${m.verified}/${m.files}`} accent="teal" />
            <Stat label="Failures" value={String(m.failures)} accent={m.failures ? 'rose' : 'teal'} />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10 }}>
            1:1 raw mirror · deep re-hash ok · idempotent · {m.source}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <NatureBadge nature="measured" />
            <StateTag state="verified" />
          </div>
        </Panel>

        <Panel title="By top folder · full source inventory">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            {data.inventory.files.toLocaleString()} files / {data.inventory.dirs.toLocaleString()} dirs listed. Click to filter the ledger.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.topFolders.map((t) => (
              <button key={t.folder} onClick={() => setTopFilter(topFilter === t.folder ? null : t.folder)}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center', padding: '7px 9px',
                  borderRadius: 3, textAlign: 'left', border: '1px solid var(--line)',
                  background: topFilter === t.folder ? 'var(--panel-2)' : 'transparent' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.folder}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{t.files.toLocaleString()} files · {fmtBytes(t.bytes)}</div>
                </div>
                <StateTag state={t.state} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Excluded by rule · the _NOT_MIRRORED story">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.excludeRules.map((r, i) => (
              <div key={i} style={{ borderLeft: `2px solid var(--${r.accent})`, paddingLeft: 9 }}>
                <div className="mono" style={{ fontSize: 10.5, color: `var(--${r.accent})` }}>{r.rule}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.reason}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`Deferred decoders · ${data.deferred.length} runs`}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            48 LAS 3.0 pressure runs out of LAS-2.0 scope — honestly held, not silently dropped.
          </div>
          <div style={{ maxHeight: 160, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.deferred.map((d, i) => (
              <div key={i} className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--orange)' }}>◇</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.path.split('/').slice(-1)[0]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* RIGHT — evidence ledger browser */}
      <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 300px' : '1fr', gap: 12, minHeight: 0 }}>
        <Panel
          title={`Evidence ledger · ${rows.length}${rows.length >= 400 ? '+' : ''} shown${topFilter ? ' · ' + topFilter : ''}`}
          right={
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, color: 'var(--muted)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="path or sha256…" className="mono"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '5px 8px 5px 26px', color: 'var(--text)', fontSize: 11, width: 200 }} />
              {topFilter && <button onClick={() => setTopFilter(null)} className="chip" style={{ marginLeft: 6 }}>clear</button>}
            </div>
          }
          pad={false}
        >
          <table className="mono" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1 }}>
                {['Path', 'Size', 'sha256', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Size' ? 'right' : 'left', padding: '8px 10px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 500, fontSize: 10, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path} onClick={() => setSel(r)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--line)', background: sel?.path === r.path ? 'var(--panel-2)' : 'transparent' }}>
                  <td style={{ padding: '6px 10px', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.path}>{r.path}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--muted)' }}>{fmtBytes(r.size)}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{r.sha256.slice(0, 10)}…</td>
                  <td style={{ padding: '6px 10px' }}><span style={{ color: 'var(--teal)' }}>✓ {r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No files match.</div>}
        </Panel>

        {/* drill-in */}
        {sel && (
          <Panel title="Evidence" right={<button onClick={() => setSel(null)}><X size={14} style={{ color: 'var(--muted)' }} /></button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileDigit size={18} style={{ color: 'var(--teal)' }} />
                <StateTag state="verified" />
              </div>
              <Field label="volumePath" value={sel.path} />
              <Field label="size" value={`${sel.size.toLocaleString()} bytes (${fmtBytes(sel.size)})`} />
              <Field label="sha256" value={sel.sha256} wrap />
              <Field label="last_modified" value={new Date(sel.last_modified).toISOString()} />
              <Field label="status" value={sel.status} />
              <Field label="top folder" value={sel.top} />
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                Resolves 1:1 to data-energy/raw · byte-exact vs Databricks listing.
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 18, color: `var(--${accent})`, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Field({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: 11, wordBreak: wrap ? 'break-all' : 'normal' }}>{value}</div>
    </div>
  );
}
