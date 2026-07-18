import { useState } from 'react'
import { Boxes, Hammer, X } from 'lucide-react'
import { Browser } from './Browser'
import { UsageView, PalettesView, IngestView, ForgeView } from './views'
import { LashiraBloomArt } from './LashiraBloomArt'
import { useVault } from './useVault'
import { vaultFacets, ingestQueue, listPalettes, TIERS } from '../../data/pixel/engine'
import type { Tier } from '../../data/pixel/types'
import './pixel.css'

// R4 — gallery-first: one dense grid with a segmented view switch, and the Forge
// as a PERSISTENT rail (desktop) / FAB sheet (mobile) instead of a buried tab.
// Clicking any grid card can seed the Forge's style-ref. Secondary analytics
// (Usage/Palettes/LashiraBloom) live in the same segment, not a separate row.
type Seg = 'library' | 'references' | 'ingest' | 'palettes' | 'usage' | 'lashira'

export function Pixel() {
  const [seg, setSeg] = useState<Seg>('library')
  const [forgeOpen, setForgeOpen] = useState(true)     // desktop rail
  const [sheetOpen, setSheetOpen] = useState(false)    // mobile forge sheet
  const [styleRef, setStyleRef] = useState('')         // card → Forge style ref
  const vault = useVault()
  const all = vaultFacets({ includeUnverified: true }, vault.items)
  const tierCounts = Object.fromEntries((all.facets.tier ?? []).map(f => [f.value, f.count])) as Record<Tier, number>
  const pending = ingestQueue().length
  const palettes = listPalettes(vault.palettes, vault.items).length

  const TABS: { id: Seg; label: string; badge?: number }[] = [
    { id: 'library', label: 'Library' },
    { id: 'references', label: 'References' },
    { id: 'ingest', label: 'Ingest', badge: pending },
    { id: 'palettes', label: 'Palettes', badge: palettes },
    { id: 'usage', label: 'Usage' },
    { id: 'lashira', label: 'LashiraBloom' },
  ]

  const useAsRef = (id: string) => { setStyleRef(id); setSheetOpen(true) }

  return (
    <div className="pixel-wrap">
      <div className="spread pixel-head" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1"><span className="row" style={{ gap: 8 }}><Boxes size={20} /> Pixel Studio</span></div>
          <div className="sub row" style={{ gap: 8 }}>
            Generate, curate, and ship pixel art — one gallery, license-tiered, agent-queryable
            <span className="pill" style={{ fontSize: 9.5, background: 'var(--bg3)', color: vault.source === 'cloud' ? 'var(--ok)' : 'var(--tx3)' }}>
              {vault.source === 'cloud' ? `● Supabase · ${vault.items.length} items` : '○ seed (sign in to load your store)'}
            </span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg">
            {TABS.map(t => (
              <button key={t.id} className={seg === t.id ? 'on' : ''} onClick={() => setSeg(t.id)}>
                {t.label}{t.badge ? <span style={{ marginLeft: 5, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
          <button className={'pixel-forge-toggle' + (forgeOpen ? ' on' : '')} onClick={() => setForgeOpen(o => !o)} title="Toggle the Forge rail">
            <Hammer size={14} /> Forge
          </button>
        </div>
      </div>

      {/* tier benchmark strip — the "what's safe to use" headline */}
      <div className="pixel-tiers">
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

      <div className={'pixel-main' + (forgeOpen ? ' with-rail' : '')}>
        <div className="pixel-gallery">
          {seg === 'library' && <Browser base={{ canonical: true }} data={vault.items} title="Library" blurb="Your canonical, shippable assets — what the Arganta apps consume, by id." onUseAsRef={useAsRef} />}
          {seg === 'references' && <Browser base={{ canonical: false }} data={vault.items} title="References" blurb="Open-source inspiration, license-tiered. Browse, then generate against a style." onUseAsRef={useAsRef} />}
          {seg === 'ingest' && <IngestView />}
          {seg === 'palettes' && <PalettesView palettes={vault.palettes} items={vault.items} />}
          {seg === 'usage' && <UsageView />}
          {seg === 'lashira' && <LashiraBloomArt />}
        </div>

        {forgeOpen && (
          <aside className="pixel-forge-rail">
            <div className="pixel-forge-railhead"><Hammer size={13} /> Forge</div>
            <ForgeView presetStyleRef={styleRef} />
          </aside>
        )}
      </div>

      {/* mobile: Forge as a floating action → full-screen sheet */}
      <button className="pixel-forge-fab" onClick={() => setSheetOpen(true)} aria-label="Open Forge"><Hammer size={18} /></button>
      {sheetOpen && (
        <div className="pixel-forge-sheet">
          <div className="pixel-forge-sheethead"><Hammer size={14} /> Forge<button onClick={() => setSheetOpen(false)} aria-label="Close"><X size={16} /></button></div>
          <div className="pixel-forge-sheetbody"><ForgeView presetStyleRef={styleRef} /></div>
        </div>
      )}
    </div>
  )
}
