/**
 * BRANDING — "The Fitting Room." The default pill.
 *
 * A brand book shows the clothes folded in the drawer. This stands the brand in
 * front of a mirror: pick a platform on the left, see the brand actually
 * wearing it in the middle, take the assets off the rack on the right.
 *
 * Three jobs, one surface:
 *   SEE  — device-faithful replicas (./replicas.tsx), everything inside them
 *          rendered from the registry by the code that ships it.
 *   TAKE — every required asset at its exact spec size, [COPY] for text and
 *          [PNG] for raster, rendered by ./compose.ts — the same function the
 *          mirror draws with. The rack is derived from kitStatus(), never
 *          hand-maintained (Law 08).
 *   FIX  — founder-lane text edited IN PLACE inside the replica, saved to
 *          brand_registry.overlay. Agent-lane values show a lock: the mark and
 *          the palette live in git and a coding agent owns them. This is the
 *          two-lane rule made visible at the point of use.
 */
import { useCallback, useMemo, useState } from 'react'
import { kitStatus, illegalOverlayPaths } from '@arganta/brand'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { Mark } from './scenes'
import { REPLICAS, Lock, type EditCtl } from './replicas'
import { exportAsset, copyOrDownload, copyPlainText } from './compose'

const CATS = [
  { id: 'social', label: 'SOCIAL' },
  { id: 'app', label: 'APP' },
  { id: 'web', label: 'WEB' },
]

const GLYPH: Record<string, string> = { ok: '✓', draft: '✎', warn: '!', missing: '×' }

/** Platforms whose replica has founder-lane text to edit. iOS/Android/Splash/Web
 *  are pure artwork — there is nothing to type, so they never offer EDIT. */
const EDITABLE = new Set(['instagram', 'linkedin', 'tiktok', 'youtube', 'x'])

export interface BrandingProps {
  worlds: { id: string; doc: any }[]
  contextId: string
  onSource: (id: string) => void
  /** Founder-lane write landed — BrandStudio refolds its overlays so every
   *  surface (including Cinematic and The Method) sees the new text at once. */
  onSaved: (brandId: string, patch: any) => void
}

export function Branding({ worlds, contextId, onSource, onSaved }: BrandingProps) {
  const [brandId, setBrandId] = useState(contextId)
  const brand = worlds.find(w => w.id === brandId) || worlds[0]
  const rows = useMemo(() => kitStatus(brand.doc), [brand.doc])
  const [platformId, setPlatformId] = useState('instagram')
  const platform = rows.find((r: any) => r.id === platformId) || rows[0]

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const say = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(t => (t === m ? null : t)), 2400)
  }, [])

  const switchTo = (id: string) => { setEditing(false); setDraft({}); setPlatformId(id) }
  const switchBrand = (id: string) => { setEditing(false); setDraft({}); setBrandId(id) }

  // The edit seam handed to whichever replica is on stage.
  const ctl: EditCtl = {
    on: editing,
    specId: platform?.assets.some((a: any) => a.constraint) ? platformId : null,
    get: (field) => draft[field] ?? String(brand.doc?.presence?.[platformId]?.[field] ?? ''),
    set: (field, value) => setDraft(d => ({ ...d, [field]: value })),
  }

  const save = async () => {
    const patch = { presence: { [platformId]: draft } }
    // The lane rule, checked before the write rather than trusted: a founder
    // edit that reached an agent-lane path would be silently overruled by git
    // on the next deploy, which is the worst kind of bug — invisible.
    const illegal = illegalOverlayPaths(patch)
    if (illegal.length) { say('BLOCKED · AGENT LANE · ' + illegal[0]); return }
    if (!cloudEnabled) { say('NO CLOUD · REGISTRY IS ON SEED'); return }
    setSaving(true)
    try {
      const { data } = await supabase.from('brand_registry').select('overlay').eq('brand_id', brandId).maybeSingle()
      const prev = (data?.overlay as any) || {}
      const next = { ...prev, presence: { ...(prev.presence || {}), [platformId]: { ...(prev.presence?.[platformId] || {}), ...draft } } }
      const { error } = await supabase.from('brand_registry').upsert({ brand_id: brandId, overlay: next }, { onConflict: 'brand_id' })
      if (error) throw error
      onSaved(brandId, next)
      setDraft({}); setEditing(false)
      say('SAVED · ' + platform.label.toUpperCase() + ' · FOUNDER LANE')
    } catch (e: any) {
      say('SAVE FAILED · ' + (e?.message || 'unknown'))
    } finally { setSaving(false) }
  }

  const copyText = async (a: any) => {
    const v = ctl.get(a.id) || String(brand.doc?.presence?.[platformId]?.[a.id] ?? '')
    if (!v) { say('NOTHING TO COPY · ' + a.label.toUpperCase()); return }
    const ok = await copyPlainText(v)
    say(ok ? `COPIED · ${a.label.toUpperCase()} · ${a.note}` : `COPY BLOCKED · ${a.label.toUpperCase()} · CLIPBOARD DENIED`)
  }

  const copyPng = async (a: any) => {
    if (a.state === 'missing') { say('CANNOT RENDER · ' + a.note.toUpperCase()); return }
    try {
      const blob = await exportAsset(brand.doc, a)
      const how = await copyOrDownload(blob, `${brand.doc.id}-${platformId}-${a.id}-${a.w}x${a.h}.png`)
      say(`${how.toUpperCase()} · ${a.label.toUpperCase()} · ${a.w}×${a.h}`)
    } catch (e: any) { say('EXPORT FAILED · ' + (e?.message || 'unknown')) }
  }

  const Replica = REPLICAS[platformId]
  const canEdit = EDITABLE.has(platformId)

  return (
    <div className="bs-branding">
      {/* ── the drawer ── */}
      <aside className="bs-fam">
        <div className="bs-fam-h">BRAND</div>
        <div className="bs-brand-switch">
          {worlds.map(w => (
            <button key={w.id} className={'bs-brand-chip' + (w.id === brandId ? ' on' : '')}
              style={{ ['--n-accent' as any]: w.doc.identity?.palette?.accent || '#888' }}
              onClick={() => switchBrand(w.id)} title={w.doc.name}>
              <Mark doc={w.doc} size={20} active />
            </button>
          ))}
        </div>
        <div className="bs-fam-h" style={{ marginTop: 14 }}>PLATFORMS</div>
        {CATS.map(cat => (
          <div key={cat.id} className="bs-plat-group">
            <div className="bs-plat-group-h">{cat.label}</div>
            {rows.filter((r: any) => r.category === cat.id).map((r: any) => (
              <button key={r.id} className={'bs-plat-row' + (r.id === platformId ? ' on' : '')} onClick={() => switchTo(r.id)}>
                <i className={'bs-plat-dot c-' + (r.pct === 100 ? 'ok' : r.pct === 0 ? 'missing' : 'draft')} />
                <span>{r.label}</span>
                <b>{r.ready}/{r.total}</b>
              </button>
            ))}
          </div>
        ))}
        <button className="bs-fam-canon" onClick={() => onSource('brand-kit-handoff')}>READ THE HANDOFF →</button>
      </aside>

      {/* ── the mirror ── */}
      <div className="bs-mirror">
        <div className="bs-mirror-bar">
          <span className="bs-mirror-k">{platform?.label.toUpperCase()} · AS IT LOOKS</span>
          {canEdit && (editing ? (
            <span className="bs-mirror-edit">
              <Lock label="MARK · PALETTE · AVATAR — GIT" />
              <button className="bk-btn ghost" onClick={() => { setEditing(false); setDraft({}) }}>CANCEL</button>
              <button className="bk-btn go" onClick={save} disabled={saving || !Object.keys(draft).length}>
                {saving ? 'SAVING…' : '✓ SAVE'}
              </button>
            </span>
          ) : (
            <button className="bk-btn" onClick={() => setEditing(true)}>✎ EDIT</button>
          ))}
        </div>
        <div className={'bs-mirror-stage' + (editing ? ' editing' : '')}>
          {Replica ? <Replica doc={brand.doc} ctl={ctl} /> : <div className="bs-await">no replica</div>}
        </div>
      </div>

      {/* ── the rack ── */}
      <aside className="bs-rack">
        <div className="bs-ref-h">{platform?.label.toUpperCase()} · {platform?.ready}/{platform?.total} READY</div>
        <div className="bs-rack-list">
          {platform?.assets.map((a: any) => (
            <div key={a.id} className="bs-rack-row">
              <em className={'c-' + a.state}>{GLYPH[a.state]}</em>
              <div className="bs-rack-info">
                <b>{a.label}</b>
                {/* A ready raster's note IS its dimensions — printing both gave
                    "320×320 · 320×320". Dimensions for raster, the note only
                    when it carries news (a gap, an overflow, a text value). */}
                <span>{a.w && a.h ? `${a.w}×${a.h}` : ''}{a.state !== 'ok' || a.kind === 'text' ? (a.w ? ' · ' : '') + a.note : ''}</span>
              </div>
              {a.kind === 'text'
                ? <button className="bk-take" onClick={() => copyText(a)} title="Copy to clipboard">COPY</button>
                : <button className="bk-take" onClick={() => copyPng(a)} title={`Render ${a.w}×${a.h} PNG`}>PNG</button>}
            </div>
          ))}
        </div>
        <div className="bs-rack-foot">
          ▲ EVERY ASSET RENDERED AT EXPORT<br />FROM THE REGISTRY — NOTHING STORED
        </div>
      </aside>

      {toast && <div className="bk-toast">{toast}</div>}
    </div>
  )
}
