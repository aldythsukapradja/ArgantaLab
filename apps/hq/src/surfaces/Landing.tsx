import { useEffect, useState } from 'react'
import { Mic, LayoutGrid } from 'lucide-react'
import { useHQ } from '../shell/store'
import { live, cloudEnabled } from '../data/live'
import type { GrowthOverview, EconomyData } from '../data/types'
import './landing.css'

// ── The CEO Orb landing — an immersive Jarvis cockpit ────────────────────────
// A giant radar orb whose CORE is a knowledge-graph node cluster (= the Vault).
// Data floats around it as ambient panels; the pulse-mic opens the CEO agent.
// Blue "cockpit" palette by design (theme-independent); the light HQ system takes
// over the moment you jump into a tab. Lite (CSS/SVG) orb — 60fps, no WebGL.
// Every number is live from the operator RPCs; honest "—" when there's no signal.

const NUM = (v: number | null | undefined) => (v == null ? '—' : Intl.NumberFormat('en', { notation: 'compact' }).format(v))

/** Sparkline points from the north-star series; a flat baseline when offline (never a fake trend). */
function spark(pts?: { value: number }[]): string {
  if (!pts || pts.length < 2) return '2,11 146,11'
  const vals = pts.map(p => p.value)
  const max = Math.max(...vals), min = Math.min(...vals)
  const span = max - min || 1
  const n = vals.length
  return vals.map((v, i) => `${((i / (n - 1)) * 146 + 2).toFixed(0)},${(20 - ((v - min) / span) * 17).toFixed(0)}`).join(' ')
}

// Knowledge-graph core — a fixed representative sample (the real Vault size shows as a count, not geometry).
const GRAPH_EDGES =
  'M160 160L158 150M160 160L180 160M160 160L150 176M160 160L138 166' +
  'M158 150L160 118M158 150L150 138M158 150L132 126M180 160L186 146M180 160L208 158M180 160L202 174' +
  'M150 176L168 208M150 176L170 186M150 176L138 204M186 146L194 130M186 146L150 138' +
  'M138 166L114 150M138 166L118 180M138 166L128 146M150 138L132 126M150 138L160 118' +
  'M170 186L198 192M170 186L168 208M202 174L208 158M202 174L198 192M118 180L114 150' +
  'M114 150L128 146M132 126L128 146M194 130L208 158M198 192L168 208M138 204L118 180'
const GRAPH_DIM: [number, number][] = [
  [194, 130], [198, 192], [168, 208], [138, 204], [118, 180], [132, 126],
  [150, 176], [180, 160], [138, 166], [150, 138], [170, 186], [202, 174], [128, 146],
]
const GRAPH_BRIGHT: [number, number, number][] = [
  [160, 118, 2.2], [208, 158, 2.6], [114, 150, 2.9], [186, 146, 0], [158, 150, 0],
]

export function Landing({ who = 'Operator' }: { who?: string }) {
  const { openPalette, toggleAgent } = useHQ()
  const [g, setG] = useState<GrowthOverview | null>(null)
  const [e, setE] = useState<EconomyData | null>(null)
  const first = who.split(/[\s@]/)[0]

  useEffect(() => {
    let alive = true
    live.growthOverview().then(r => { if (alive) setG(r) })
    live.economy().then(r => { if (alive) setE(r) })
    return () => { alive = false }
  }, [])

  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const wau = g?.wau ?? null
  const wow = g?.wowPct ?? null
  const cov = e?.coverage ?? null

  return (
    <div className="ceo">
      <span className="ceo-brk tl" /><span className="ceo-brk tr" /><span className="ceo-brk bl" /><span className="ceo-brk br" />

      <div className="ceo-top">
        <span>◆ CIRCLE HQ</span>
        <button className="ceo-menu" onClick={openPalette} title="Menu (⌘K)"><LayoutGrid size={12} /> MENU</button>
        <span className="ceo-on">CEO AGENT {cloudEnabled ? '●' : '○'}</span>
      </div>

      <div className="ceo-greet">{greet}, {first}</div>

      <div className="ceo-center">
        <div className="ceo-orb">
          <svg viewBox="0 0 320 320" role="img" aria-label="CEO agent knowledge-graph orb">
            <defs>
              <radialGradient id="ceoBrainGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#45c8ff" stopOpacity=".28" /><stop offset="100%" stopColor="#45c8ff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g fill="none" stroke="#4a86ff" strokeLinecap="round">
              <circle cx="160" cy="160" r="150" strokeOpacity=".1" strokeDasharray="2 9" />
              <g className="ceo-spinA"><circle cx="160" cy="160" r="130" strokeWidth="1.3" strokeOpacity=".34" strokeDasharray="80 250" /><circle cx="160" cy="30" r="2.4" fill="#45c8ff" stroke="none" /></g>
              <g className="ceo-spinC" stroke="#3d7fd6"><circle cx="160" cy="160" r="112" strokeWidth="1" strokeOpacity=".5" strokeDasharray="3 10" /></g>
              <g className="ceo-spinB" strokeOpacity=".5"><circle cx="160" cy="160" r="94" strokeWidth="1.3" /><path d="M160 54v10M160 256v10M54 160h10M256 160h10M88 88l7 7M225 225l-7-7M232 88l-7 7M88 232l7-7" strokeWidth="1.2" /></g>
              <g className="ceo-spinD" stroke="#45c8ff" strokeOpacity=".55"><circle cx="160" cy="160" r="76" strokeWidth="1.4" strokeDasharray="1.5 6" /></g>
            </g>
            <g className="ceo-sweep"><path d="M160 160 L160 66 A94 94 0 0 1 224 94 Z" fill="#45c8ff" opacity=".07" /></g>

            {/* knowledge-graph core */}
            <circle cx="160" cy="160" r="62" fill="url(#ceoBrainGlow)" />
            <g className="ceo-brain">
              <path className="ceo-edges" d={GRAPH_EDGES} stroke="#5aa0ff" strokeWidth="1" strokeOpacity=".5" fill="none" />
              <g fill="#4a86ff">
                {GRAPH_DIM.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 6 ? 1.9 : 1.7} />)}
              </g>
              <g fill="#7fe8ff">
                {GRAPH_BRIGHT.map(([x, y, dur], i) => (
                  <circle key={i} cx={x} cy={y} r="2.3">
                    {dur > 0 && <animate attributeName="r" values="2.3;3.4;2.3" dur={`${dur}s`} repeatCount="indefinite" />}
                  </circle>
                ))}
              </g>
              <circle className="ceo-hub" cx="160" cy="160" r="4.5" fill="#eaf7ff">
                <animate attributeName="r" values="4.5;5.6;4.5" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </div>
      </div>

      {/* floating ambient panels */}
      <div className="ceo-pnl p1"><div className="ceo-ph"><b />World</div>
        <svg viewBox="0 0 148 56"><g fill="none" stroke="#45c8ff" strokeWidth="1"><circle cx="28" cy="29" r="18" /><path d="M10 29h36M28 11c4 3.4 5.5 7.5 5.5 12s-1.5 8.6-5.5 12c-4-3.4-5.5-7.5-5.5-12s1.5-8.6 5.5-12z" strokeOpacity=".55" /></g><path d="M32 38q26 -28 76 -13" fill="none" stroke="#4fe6c8" strokeWidth="1.3" /><circle cx="32" cy="38" r="2" fill="#4fe6c8" /><circle cx="108" cy="25" r="2.4" fill="#4fe6c8"><animate attributeName="r" values="2.4;3.6;2.4" dur="1.6s" repeatCount="indefinite" /></circle></svg>
      </div>

      <div className="ceo-pnl p2"><div className="ceo-ph"><b />Agents · thinking</div>
        <svg viewBox="0 0 148 44"><line x1="14" y1="17" x2="124" y2="17" stroke="#4a86ff" strokeOpacity=".4" /><g fill="#153060" stroke="#4a86ff"><circle cx="14" cy="17" r="4" /><circle cx="50" cy="17" r="4" /><circle cx="88" cy="17" r="4" /><circle cx="124" cy="17" r="4" /></g><circle cy="17" r="3" fill="#45c8ff"><animate attributeName="cx" values="14;124;14" dur="2.4s" repeatCount="indefinite" /></circle><g fill="#7fa8dd" fontSize="7" fontFamily="monospace" textAnchor="middle"><text x="14" y="37">S</text><text x="50" y="37">C</text><text x="88" y="37">M</text><text x="124" y="37">G</text></g></svg>
      </div>

      <div className="ceo-pnl p3"><div className="ceo-ph"><b />North Star</div>
        <div className="ceo-nsv">{NUM(wau)}{wow != null && <em className={wow < 0 ? 'dn' : ''}>{wow < 0 ? '▼' : '▲'}</em>}</div>
        <svg viewBox="0 0 148 22" style={{ marginTop: 4 }}><polyline points={spark(g?.northStar)} fill="none" stroke="#45c8ff" strokeWidth="1.6" /></svg>
        <div className="ceo-nsl">WEEKLY ENGAGED</div>
      </div>

      <div className="ceo-pnl p4"><div className="ceo-ph"><b />Economy</div>
        <svg viewBox="0 0 128 60"><path d="M17 52a45 45 0 0 1 90 0" fill="none" stroke="#153060" strokeWidth="7" strokeLinecap="round" />{cov != null && <path d="M17 52a45 45 0 0 1 90 0" fill="none" stroke="#4fe6c8" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(0, Math.min(100, cov))} 100`} />}</svg>
        <div className="ceo-gv">{cov != null ? cov + '%' : '—'}</div>
        <div className="ceo-nsl" style={{ textAlign: 'center', marginTop: -2 }}>SINK COVERAGE</div>
      </div>

      <button className="ceo-mic" onClick={() => toggleAgent()} aria-label="Talk to the CEO agent">
        <span className="ceo-ring" /><span className="ceo-ring r2" />
        <Mic size={26} color="#fff" strokeWidth={1.7} />
      </button>
      {!cloudEnabled && <div className="ceo-foot">OFFLINE PREVIEW · SIGN IN FOR LIVE DATA</div>}
    </div>
  )
}
