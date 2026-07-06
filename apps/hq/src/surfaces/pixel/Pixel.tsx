import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { Browser } from './Browser'
import { UsageView, PalettesView, IngestView } from './views'
import { LashiraBloomArt } from './LashiraBloomArt'
import { useVault } from './useVault'
import { vaultFacets, ingestQueue, listPalettes, TIERS } from '../../data/pixel/engine'
import type { Tier } from '../../data/pixel/types'

type Seg = 'library' | 'usage' | 'ingest' | 'references' | 'palettes' | 'lashira'

export function Pixel() {
  const [seg, setSeg] = useState<Seg>('references')
  const vault = useVault()
  const all = vaultFacets({ includeUnverified: true }, vault.items)
  const tierCounts = Object.fromEntries((all.facets.tier ?? []).map(f => [f.value, f.count])) as Record<Tier, number>
  const pending = ingestQueue().length
  const palettes = listPalettes(vault.palettes, vault.items).length

  const TABS: { id: Seg; label: string; badge?: number }[] = [
    { id: 'references', label: 'References' },
    { id: 'ingest', label: 'Ingest', badge: pending },
    { id: 'library', label: 'Library' },
    { id: 'lashira', label: 'LashiraBloom' },
    { id: 'usage', label: 'Usage' },
    { id: 'palettes', label: 'Palettes', badge: palettes },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1"><span className="row" style={{ gap: 8 }}><Boxes size={20} /> Pixel Vault</span></div>
          <div className="sub row" style={{ gap: 8 }}>
            The source-of-truth pixel-art catalogue — license-tiered, faceted, and queryable by agents
            <span className="pill" style={{ fontSize: 9.5, background: 'var(--bg3)', color: vault.source === 'cloud' ? 'var(--ok)' : 'var(--tx3)' }}>
              {vault.source === 'cloud' ? `● Supabase · ${vault.items.length} items` : '○ seed (sign in to load your store)'}
            </span>
          </div>
        </div>
        <div className="seg">
          {TABS.map(t => (
            <button key={t.id} className={seg === t.id ? 'on' : ''} onClick={() => setSeg(t.id)}>
              {t.label}{t.badge ? <span style={{ marginLeft: 5, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* tier benchmark strip — the "what's safe to use" headline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        {(['T0', 'T1', 'T2'] as Tier[]).map(t => {
          const p = TIERS[t]
          return (
            <div key={t} className="card" style={{ padding: '10px 12px', borderLeft: `3px solid ${p.color}` }}>
              <div className="row" style={{ gap: 6 }}><span style={{ color: p.color, fontWeight: 800, fontFamily: 'var(--mono)' }}>{tierCounts[t] ?? 0}</span><span style={{ fontSize: 12, fontWeight: 700 }}>{t} · {p.label}</span></div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 3, lineHeight: 1.4 }}>{p.rule}</div>
            </div>
          )
        })}
      </div>

      {seg === 'references' && <Browser base={{ canonical: false }} data={vault.items} title="References" blurb="Open-source inspiration, license-tiered. Never edited here — browse, then copy a generation prompt." />}
      {seg === 'library' && <Browser base={{ canonical: true }} data={vault.items} title="Library" blurb="Your canonical, shippable assets — what the Arganta apps actually consume, by id." />}
      {seg === 'lashira' && <LashiraBloomArt />}
      {seg === 'usage' && <UsageView />}
      {seg === 'ingest' && <IngestView />}
      {seg === 'palettes' && <PalettesView palettes={vault.palettes} items={vault.items} />}
    </div>
  )
}
