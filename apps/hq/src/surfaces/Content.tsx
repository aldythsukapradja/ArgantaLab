import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Layers, Boxes, Target, Lightbulb, Gauge } from 'lucide-react'
import { live } from '../data/live'
import type { ContentMatrix } from '../data/types'
import {
  analyzeMatrix, MASTERY_TARGET, BENCHMARKS,
  type CellScore, type Verdict, type Insight,
} from '../data/richness'
import { Kpi } from '../components/Kpi'
import { Empty, Loading } from '../components/Empty'
import { compact } from '../lib/format'

const BAND: Record<Verdict, { bg: string; fg: string; label: string }> = {
  empty:    { bg: 'var(--bg3)',     fg: 'var(--tx3)',  label: 'Empty' },
  bare:     { bg: 'var(--bad-bg)',  fg: 'var(--bad)',  label: 'Bare' },
  thin:     { bg: 'var(--warn-bg)', fg: 'var(--warn)', label: 'Developing' },
  adequate: { bg: 'var(--tl-bg)',   fg: 'var(--tl)',   label: 'Adequate' },
  rich:     { bg: 'var(--ok-bg)',   fg: 'var(--ok)',   label: 'Rich' },
}
const TONE: Record<Insight['severity'], 'warn' | 'tl' | 'ok'> = {
  high: 'warn', med: 'warn', low: 'tl', ok: 'ok',
}

export function Content() {
  const [m, setM] = useState<ContentMatrix | null | undefined>(undefined)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { live.contentMatrix().then((d) => setM(d)) }, [])

  const a = useMemo(() => (m ? analyzeMatrix(m) : null), [m])

  if (m === undefined) return <Wrap><Loading label="Mapping content coverage…" /></Wrap>
  if (m === null || !a) return (
    <Wrap>
      <Empty title="Content matrix needs a live connection">
        Every cell is a real aggregate over <span className="src">items</span> via
        <span className="src">hq_content_matrix()</span>. Connect Supabase and sign in as operator —
        no placeholder coverage is ever shown.
      </Empty>
    </Wrap>
  )

  const { totals } = m
  const accessPct = totals.authored > 0 ? Math.round((totals.live / totals.authored) * 100) : null
  const explorerLive = a.stageLive.find((s) => s.stage.key === 'explorer')?.live ?? 0
  const explorerPct = totals.live > 0 ? Math.round((explorerLive / totals.live) * 100) : null
  const numLive = a.worldLive.get('NUM') ?? 0
  const ttrs = BENCHMARKS.find((b) => b.id === 'ttrs')!
  const selScore = sel ? a.byKey.get(sel) ?? null : null

  return (
    <Wrap>
      <div className="kpi-grid">
        <Kpi label="Authored → live" value={`${compact(totals.authored)} → ${compact(totals.live)}`}
          icon={<Boxes size={13} />} accent={accessPct !== null && accessPct >= 90 ? 'ok' : 'bad'}
          sub={accessPct === null ? undefined : <>{100 - accessPct}% not live</>} />
        <Kpi label="Mastery-ready cells" value={`${a.masteryReady} / ${a.cellsTotal}`}
          icon={<Target size={13} />} accent={a.masteryReady / a.cellsTotal >= 0.5 ? 'ok' : 'warn'}
          sub={<>≥{MASTERY_TARGET} live items</>} />
        <Kpi label="Explorer concentration" value={explorerPct === null ? '—' : explorerPct + '%'}
          icon={<Layers size={13} />} accent={explorerPct !== null && explorerPct > 45 ? 'warn' : 'ok'}
          sub="ages 8–11 share" />
        <Kpi label="Maths vs TTRS" value={numLive > 0 ? Math.round((numLive / ttrs.target) * 100) + '%' : '—'}
          icon={<Gauge size={13} />} accent="warn" sub={<>{compact(numLive)} of {ttrs.target} facts</>} />
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Coverage matrix</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Live items per world × age stage · click a cell to drill</div>
          </div>
          <Legend />
        </div>
        <Heatmap matrix={m} byKey={a.byKey} sel={sel} onSel={setSel} />
      </div>

      {selScore && <CellDetail s={selScore} matrix={m} onClose={() => setSel(null)} />}

      {a.insights.map((ins, idx) => (
        <div key={idx} className={'insight ' + TONE[ins.severity]}>
          <Lightbulb size={15} />
          <div>
            <b>{ins.headline}.</b> {ins.driver} <span style={{ opacity: 0.85 }}>→ {ins.action}</span>
          </div>
        </div>
      ))}

      <div className="insight tl" style={{ alignItems: 'center' }}>
        <BookOpen size={15} />
        <div>Benchmarks: <b>{BENCHMARKS.map((b) => b.label).join(' · ')}</b>. Richness blends depth (40%), variety, difficulty curve & access. Swap a richer benchmark set or LLM scoring behind <span className="src">richness.ts</span> with zero UI change.</div>
      </div>
    </Wrap>
  )
}

function Heatmap({ matrix, byKey, sel, onSel }: {
  matrix: ContentMatrix
  byKey: Map<string, CellScore>
  sel: string | null
  onSel: (k: string | null) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${matrix.stages.length}, 1fr)`, gap: 4 }}>
      <div />
      {matrix.stages.map((s) => (
        <div key={s.key} style={{ textAlign: 'center', paddingBottom: 4 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{s.label}</div>
          <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{s.minAge}–{s.maxAge}</div>
        </div>
      ))}
      {matrix.worlds.map((w) => (
        <Row key={w.key}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{w.name}</div>
            <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{w.key}</div>
          </div>
          {matrix.stages.map((s) => {
            const k = w.key + '|' + s.key
            const sc = byKey.get(k)
            const live = sc?.live ?? 0
            const band = BAND[sc?.verdict ?? 'empty']
            const on = sel === k
            return (
              <button key={k} onClick={() => onSel(on ? null : k)} title={`${w.name} · ${s.label}: ${live} live`}
                style={{
                  background: band.bg, color: band.fg, border: on ? '2px solid var(--acc)' : '1px solid transparent',
                  borderRadius: 8, padding: '14px 0', textAlign: 'center', fontWeight: 600, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {live}
              </button>
            )
          })}
        </Row>
      ))}
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>
}

function CellDetail({ s, matrix, onClose }: { s: CellScore; matrix: ContentMatrix; onClose: () => void }) {
  const world = matrix.worlds.find((w) => w.key === s.world)
  const stage = matrix.stages.find((st) => st.key === s.stage)
  const cell = matrix.cells.find((c) => c.world === s.world && c.stage === s.stage)
  const band = BAND[s.verdict]
  const bars: { label: string; v: number }[] = [
    { label: 'Depth', v: s.depth }, { label: 'Variety', v: s.variety },
    { label: 'Curve', v: s.curve }, { label: 'Access', v: s.access },
  ]
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ background: band.bg, color: band.fg }}>{band.label}</span>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{world?.name} · {stage?.label} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({stage?.minAge}–{stage?.maxAge})</span></div>
        </div>
        <button className="pill pill-mut" onClick={onClose} style={{ cursor: 'pointer', border: 'none' }}>Close</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Live', s.live], ['Authored', s.authored],
          ['Skills', cell?.skills ?? 0], ['Interactions', cell?.interactions ?? 0],
          ['Difficulty rungs', cell?.rungs ?? 0], ['Richness', s.score + '/100'],
        ].map(([l, v]) => (
          <div key={l as string} style={{ background: 'var(--bg2)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--tx2)' }}>{l as string}</div>
            <div style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{typeof v === 'number' ? compact(v) : v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map((b) => (
          <div key={b.label} className="row" style={{ gap: 10 }}>
            <div style={{ width: 64, fontSize: 11.5, color: 'var(--tx2)' }}>{b.label}</div>
            <div style={{ flex: 1, height: 7, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(b.v * 100)}%`, height: '100%', background: 'var(--acc)', borderRadius: 99 }} />
            </div>
            <div style={{ width: 34, textAlign: 'right', fontSize: 11.5, fontWeight: 600 }}>{Math.round(b.v * 100)}%</div>
          </div>
        ))}
      </div>
      {s.live < MASTERY_TARGET && (
        <div className="src" style={{ marginTop: 12, display: 'inline-block' }}>
          needs {MASTERY_TARGET - s.live} more live items to reach mastery depth
        </div>
      )}
    </div>
  )
}

function Legend() {
  return (
    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
      {(['bare', 'thin', 'adequate', 'rich'] as Verdict[]).map((v) => (
        <span key={v} className="row" style={{ gap: 5, fontSize: 10.5, color: 'var(--tx2)' }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: BAND[v].bg }} />{BAND[v].label}
        </span>
      ))}
    </div>
  )
}

function Wrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Content</div>
        <div className="sub">Curriculum richness per age stage — depth, variety & access, benchmarked</div>
      </div>
      {children}
    </div>
  )
}
