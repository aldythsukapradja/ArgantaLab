import { useEffect, useState } from 'react'
import { Database, Table2, Network, RefreshCw, Sparkles } from 'lucide-react'
import { live, cloudEnabled } from '../data/live'
import type { SchemaModel as Model, Ontology } from '../data/types'
import { buildOntology } from '../data/ontology'
import { useHQ } from '../shell/store'
import { SchemaModel } from '../components/SchemaModel'
import { Empty, Loading } from '../components/Empty'
import { ago } from '../lib/format'

export function Data() {
  const { dataTab, setDataTab } = useHQ()
  const [model, setModel] = useState<Model | null | undefined>(undefined)

  const loadModel = () => { setModel(undefined); live.schemaModel().then((m) => setModel(m)) }
  useEffect(() => { loadModel() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread">
        <div>
          <div className="h1">Data model</div>
          <div className="sub">
            Introspected live from Postgres — add a table in Supabase and it appears here.
            {model && <> · {model.tables.length} tables · synced {ago(model.generatedAt)}</>}
          </div>
        </div>
        <span className={'pill ' + (cloudEnabled ? 'pill-ok' : 'pill-mut')}>
          <span style={{ width: 6, height: 6, borderRadius: 9, background: 'currentColor' }} />
          {cloudEnabled ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg">
          <button className={dataTab === 'schema' ? 'on' : ''} onClick={() => setDataTab('schema')}><Database size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Schema</button>
          <button className={dataTab === 'tables' ? 'on' : ''} onClick={() => setDataTab('tables')}><Table2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Tables</button>
          <button className={dataTab === 'ontology' ? 'on' : ''} onClick={() => setDataTab('ontology')}><Network size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Ontology</button>
        </div>
      </div>

      {model === undefined && <Loading label="Introspecting schema…" />}
      {model === null && <NotConnected />}
      {model && dataTab === 'schema' && <SchemaModel model={model} onRefresh={loadModel} />}
      {model && dataTab === 'tables' && <TablesView model={model} />}
      {model && dataTab === 'ontology' && <OntologyView model={model} />}
    </div>
  )
}

function NotConnected() {
  return (
    <Empty title="No live connection">
      The schema model loads from the <span className="src">hq_schema_model()</span> RPC. Add your Supabase
      URL + anon key to <span className="src">apps/hq/.env.local</span>, run the Circle HQ section of{' '}
      <span className="src">supabase/schema.sql</span>, and sign in as an operator.
    </Empty>
  )
}

function TablesView({ model }: { model: Model }) {
  const names = model.tables.map((t) => t.name)
  const [table, setTable] = useState(names.includes('item_attempts') ? 'item_attempts' : names[0])
  const [rows, setRows] = useState<Record<string, unknown>[] | null | undefined>(undefined)

  useEffect(() => { setRows(undefined); live.tablePreview(table, 25).then((r) => setRows(r)) }, [table])

  const cols = rows && rows.length ? Object.keys(rows[0]) : model.tables.find((t) => t.name === table)?.columns.map((c) => c.name) || []

  return (
    <div className="tbl-wrap">
      <div className="tbl-bar">
        <select className="tbl-sel" value={table} onChange={(e) => setTable(e.target.value)}>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: 'var(--tx3)', marginLeft: 'auto' }}>
          {rows === undefined ? 'loading…' : rows ? `${rows.length} live rows` : 'no rows'} · operator preview
        </span>
      </div>
      {rows === undefined ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 22 }} />)}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div style={{ padding: 28 }}><Empty icon={<Table2 />} title="No rows yet">This table is empty in your database. Rows appear here as soon as they're written.</Empty></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{cols.map((c) => {
                  const v = r[c]
                  const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
                  const mono = /id$|_at$|key$/.test(c)
                  return <td key={c} className={mono ? 'cell-mono' : ''} title={s}>{s}</td>
                })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OntologyView({ model }: { model: Model }) {
  const [onto, setOnto] = useState<Ontology | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    live.latestOntology().then((o) => setOnto(o ?? buildOntology(model)))
  }, [model])

  const regenerate = async () => {
    setBusy(true)
    const fresh = buildOntology(model)
    await live.saveOntology(fresh)
    setOnto(fresh)
    setBusy(false)
  }

  if (onto === undefined) return <Loading label="Loading ontology snapshot…" />
  const o = onto!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="insight tl">
        <Sparkles size={15} />
        <div>
          <b>Semantic layer for agents.</b> Each schema column mapped to a business concept.
          Snapshot-based — regenerate to refresh{o.generatedBy ? ` (${o.generatedBy}${o.generatedAt ? `, ${ago(o.generatedAt)}` : ''})` : ''}. LLM enrichment plugs in behind the same snapshot.
        </div>
        <button className="chip" style={{ marginLeft: 'auto', alignSelf: 'center' }} onClick={regenerate} disabled={busy}>
          <RefreshCw size={13} /> {busy ? 'Saving…' : 'Regenerate'}
        </button>
      </div>

      {o.domains.map((d) => (
        <div key={d.domain}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{d.domain}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            {d.concepts.map((c) => (
              <div key={c.source} className="card" style={{ padding: '11px 13px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--acc-text)', textTransform: 'capitalize' }}>{c.concept}</div>
                <div className="src" style={{ display: 'inline-block', margin: '4px 0' }}>{c.source}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{c.description}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
