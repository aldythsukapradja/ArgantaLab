import { useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SFX_RECIPES, cueGroups, mergeAudioLibrary, validateAudioLibrary,
  publishAudioLibrary, createMasterChain, playRecipe,
} from '@arganta/audio'
import { supabase, cloudEnabled } from '../../lib/supabase'
import './music.css'

// Music Builder — HQ's SFX authoring surface. Edits ride as a small "override"
// map (cue name → full replacement recipe) merged over the shared package
// defaults; Publish writes that map to Supabase, and the game applies it on
// next boot (@arganta/audio's bootAudioLibrary, wired into lashira's main.jsx).
// Same pipeline shape as Battle Builder's combat tuning — see tuningRepo.js.
//
// SCOPE (this pass): every cue's FIRST layer is fully editable (waveform,
// pitch, envelope, and the free-tier polish knobs — layers/reverb/jitter/
// drive). Layers 2+ are shown read-only. Music Forge (per-realm ambient) has
// no recipe table yet — it publishes through the SAME draft/table as SFX
// Forge (there is only ever one audio_library row), it just has nothing of
// its own to add to it yet.
//
// LAYOUT: one non-scrolling workbench — a roster (each row plays itself
// inline, no separate "select then find the stage" step) beside a settings
// panel, both with their OWN internal scroll so the outer page never does.

type Layer = Record<string, any>
type Kind = 'tone' | 'noise'

const GROUPS = cueGroups() as Record<string, string[]>
const TONE_TYPES = ['sine', 'triangle', 'square', 'sawtooth']

function VRow({ label, val, lo, hi, step, color, fmt, onChange }:
  { label: string; val: number; lo: number; hi: number; step: number; color?: string; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, ((val - lo) / (hi - lo)) * 100))
  return (
    <div className="mbf-vrow">
      <div className="mbf-vl">{label}</div>
      <div className="mbf-vs" style={color ? ({ ['--pc' as any]: color }) : undefined}>
        <div className="mbf-vtrack" /><div className="mbf-vfill" style={{ width: pct + '%' }} />
        <div className="mbf-vthumb" style={{ left: pct + '%' }}>{fmt ? fmt(val) : val}</div>
        <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))} />
      </div>
    </div>
  )
}
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mbf-tograw" onClick={() => onChange(!on)}>
      <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{label}</span>
      <div className={'mbf-togsw' + (on ? ' on' : '')} />
    </div>
  )
}
function PlayIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}

export function MusicBuilder() {
  const [tab, setTab] = useState<'overview' | 'sfx' | 'music'>('overview')
  const [draft, setDraft] = useState<Record<string, Layer[]>>({})
  const [selected, setSelected] = useState('harvest')
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const effective = useMemo(() => mergeAudioLibrary(draft), [draft])
  const recipe: Layer[] = effective[selected] || []
  const layer0: Layer = recipe[0] || { kind: 'tone', type: 'sine', f0: 440, t: 0.12, gain: 0.2 }
  const dirty = Object.keys(draft)
  const isDirty = (name: string) => draft[name] != null

  const audioRef = useRef<{ ctx: AudioContext; master: GainNode; reverbBus: GainNode } | null>(null)
  function ensureAudio() {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = new AC()
      const { master, reverbBus } = createMasterChain(ctx, 0.7)
      audioRef.current = { ctx, master, reverbBus }
    }
    if (audioRef.current.ctx.state === 'suspended') audioRef.current.ctx.resume()
    return audioRef.current
  }
  // Plays any cue directly from its roster row — no need to select it first.
  function playCue(name: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const a = ensureAudio()
    playRecipe(a.ctx, a.master, a.reverbBus, effective[name] || [])
  }

  function patchLayer0(patch: Partial<Layer>) {
    setDraft(d => {
      const base = (d[selected] || DEFAULT_SFX_RECIPES[selected] || []).map((l: Layer) => ({ ...l }))
      base[0] = { ...(base[0] || {}), ...patch }
      return { ...d, [selected]: base }
    })
  }

  async function publish() {
    setPublishing(true); setPubMsg(null)
    try {
      const v = validateAudioLibrary(draft)
      if (!v.ok) { setPubMsg({ ok: false, text: 'Invalid: ' + v.errors.join('; ') }); return }
      await publishAudioLibrary(supabase, draft, { note: 'HQ Music Builder' })
      setPubMsg({ ok: true, text: `Published ${dirty.length} cue(s) to LashiraBloom. Applies on next game boot.` })
      setDraft({})
    } catch (e: any) {
      setPubMsg({ ok: false, text: `Publish failed: ${e?.message || e}` })
    } finally { setPublishing(false) }
  }

  // One shared publish bar — rendered at the bottom of BOTH SFX Forge and
  // Music Forge (per design note: same audio_library row, not a separate
  // table/tab). `extra` lets Music Forge show its own empty-state caption.
  function PublishBar({ extra }: { extra?: React.ReactNode }) {
    return (
      <div className="mbf-pubbar">
        {extra}
        {pubMsg && <span style={{ fontSize: 11, color: pubMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{pubMsg.text}</span>}
        {!cloudEnabled && <span className="pill pill-mut" style={{ color: 'var(--warn)' }}>offline — run migration_audio_library.sql</span>}
        <span className="mbf-pubspend">{dirty.length} pending · $0 spend</span>
        <button className="mbf-pubbtn" disabled={publishing || !cloudEnabled || dirty.length === 0} onClick={publish}>
          {publishing ? 'Publishing…' : `Publish ${dirty.length} change${dirty.length === 1 ? '' : 's'}`}
        </button>
      </div>
    )
  }

  return (
    <div className="mbf">
      <div className="mbf-top">
        <div className="mbf-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        </div>
        <div className="mbf-title"><b>Music Builder</b><span>Circle HQ · Build</span></div>
        <div className="mbf-credit"><span className="dot" />ElevenLabs: not connected · Synth mode only</div>
      </div>

      <div className="mbf-tabs">
        <div className={'mbf-tab' + (tab === 'overview' ? ' on' : '')} onClick={() => setTab('overview')}>
          <div className="tn">📊</div><div><span className="lbl">Overview</span><span className="sub">dashboard</span></div>
        </div>
        <div className={'mbf-tab' + (tab === 'sfx' ? ' on' : '')} onClick={() => setTab('sfx')}>
          <div className="tn">🔊</div><div><span className="lbl">SFX Forge</span><span className="sub">{Object.keys(DEFAULT_SFX_RECIPES).length} cues · {dirty.length} pending</span></div>
        </div>
        <div className={'mbf-tab' + (tab === 'music' ? ' on' : '')} onClick={() => setTab('music')}>
          <div className="tn">🎼</div><div><span className="lbl">Music Forge</span><span className="sub">not wired yet</span></div>
        </div>
      </div>

      <div className="mbf-body">

        {tab === 'overview' && (
          <div className="mbf-scroll">
            <div className="grid mbf-kpis">
              <div className="card mbf-kpi"><div className="k">Cues in library</div><div className="v">{Object.keys(DEFAULT_SFX_RECIPES).length}</div><div className="s">across action / combat / emote</div></div>
              <div className="card mbf-kpi"><div className="k">Edited this session</div><div className="v">{dirty.length}</div><div className="s">{dirty.length ? dirty.join(', ') : 'nothing yet'}</div></div>
              <div className="card mbf-kpi"><div className="k">Provider mix</div><div className="v" style={{ color: 'var(--acc-text)' }}>100%</div><div className="s">synth · $0 spend</div></div>
              <div className="card mbf-kpi"><div className="k">Cloud publish</div><div className="v" style={{ color: cloudEnabled ? 'var(--ok)' : 'var(--tx3)', fontSize: 17 }}>{cloudEnabled ? 'Connected' : 'Offline'}</div><div className="s">{cloudEnabled ? 'ready to publish' : 'run migration_audio_library.sql'}</div></div>
            </div>
            <div className="mbf-sec"><div className="ic" style={{ background: 'var(--acc-soft)' }}>🎚️</div><div className="tt">Provider mix</div><div className="sb">what's rendering each asset today</div><div className="ln" /></div>
            <div className="card">
              <div className="mbf-mixbar"><div className="mbf-mixseg" style={{ width: '100%', background: 'var(--acc)' }}>{Object.keys(DEFAULT_SFX_RECIPES).length} synth cues</div></div>
              <div className="mbf-mixleg"><span><i style={{ background: 'var(--acc)' }} />Synth (free, WebAudio)</span><span><i style={{ background: 'var(--bd3)' }} />ElevenLabs (0 generated)</span></div>
            </div>
            {!cloudEnabled && (
              <>
                <div className="mbf-sec"><div className="ic" style={{ background: 'var(--warn-bg)' }}>⚠️</div><div className="tt">Attention</div><div className="sb" /><div className="ln" /></div>
                <div className="mbf-att"><span className="dot" style={{ background: 'var(--warn)' }} /><span className="tx">Offline preview — connect Supabase + run <b>supabase/migration_audio_library.sql</b> once to enable Publish.</span></div>
              </>
            )}
          </div>
        )}

        {tab === 'sfx' && (
          <div className="mbf-tabpane">
            <div className="mbf-work2">
              <div className="mbf-col roster">
                <input className="mbf-search" placeholder="Search cues…" />
                {Object.entries(GROUPS).map(([grp, names]) => (
                  <div key={grp}>
                    <div className="mbf-grp">{grp}</div>
                    {names.map(name => (
                      <div key={name} className={'mbf-row' + (selected === name ? ' on' : '')} onClick={() => setSelected(name)}>
                        <button className="mbf-rowplay" onClick={(e) => playCue(name, e)} title={`Play ${name}`}><PlayIcon /></button>
                        <span className="nm">{name}</span>
                        <span className={'pv' + (isDirty(name) ? ' dirty' : '')}>{isDirty(name) ? 'EDITED' : 'SYNTH'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mbf-col settings2">
                <div className="mbf-edithead">
                  <button className="mbf-play" onClick={() => playCue(selected)}><PlayIcon size={16} /></button>
                  <div className="mbf-stage-who">{selected}<small>{recipe.length} layer{recipe.length === 1 ? '' : 's'} · editing layer 1</small></div>
                </div>

                <div className="mbf-grid2">
                  <div className="mbf-selrow">
                    <span className="mbf-vl">Kind</span>
                    <select value={layer0.kind === 'noise' ? 'noise' : 'tone'} onChange={e => patchLayer0({ kind: e.target.value as Kind, type: e.target.value === 'tone' ? (layer0.type || 'sine') : undefined })}>
                      <option value="tone">tone</option><option value="noise">noise</option>
                    </select>
                  </div>
                  {layer0.kind !== 'noise' && (
                    <div className="mbf-selrow">
                      <span className="mbf-vl">Waveform</span>
                      <select value={layer0.type || 'sine'} onChange={e => patchLayer0({ type: e.target.value })}>
                        {TONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {layer0.kind !== 'noise' ? (
                    <>
                      <VRow label="Pitch f0" val={layer0.f0 ?? 440} lo={80} hi={2000} step={5} fmt={v => Math.round(v) + ' Hz'} onChange={v => patchLayer0({ f0: v })} />
                      <Toggle label="Has glide (f1)" on={layer0.f1 != null} onChange={on => patchLayer0({ f1: on ? (layer0.f0 ?? 440) * 1.6 : null })} />
                      {layer0.f1 != null && <VRow label="Glide f1" val={layer0.f1} lo={40} hi={3000} step={5} fmt={v => Math.round(v) + ' Hz'} onChange={v => patchLayer0({ f1: v })} />}
                    </>
                  ) : (
                    <>
                      <VRow label="Lowpass" val={layer0.lp ?? 2000} lo={200} hi={8000} step={50} fmt={v => Math.round(v) + ' Hz'} onChange={v => patchLayer0({ lp: v })} />
                      <VRow label="Highpass" val={layer0.hp ?? 0} lo={0} hi={4000} step={50} fmt={v => Math.round(v) + ' Hz'} onChange={v => patchLayer0({ hp: v })} />
                      <VRow label="Drive" val={layer0.drive ?? 0} lo={0} hi={1} step={0.05} color="var(--mbf-mel)" fmt={v => v.toFixed(2)} onChange={v => patchLayer0({ drive: v })} />
                    </>
                  )}
                  <VRow label="Duration" val={layer0.t ?? 0.12} lo={0.02} hi={1} step={0.01} fmt={v => v.toFixed(2) + 's'} onChange={v => patchLayer0({ t: v })} />
                  <VRow label="Gain" val={layer0.gain ?? 0.2} lo={0} hi={1} step={0.01} fmt={v => v.toFixed(2)} onChange={v => patchLayer0({ gain: v })} />
                  {layer0.kind !== 'noise' && <VRow label="Layers" val={layer0.layers ?? 1} lo={1} hi={3} step={1} color="var(--mbf-mel)" onChange={v => patchLayer0({ layers: Math.round(v) })} />}
                  <VRow label="Reverb send" val={layer0.reverb ?? 0} lo={0} hi={1} step={0.05} color="var(--mbf-mel)" fmt={v => v.toFixed(2)} onChange={v => patchLayer0({ reverb: v })} />
                  <Toggle label="Pitch/timing jitter" on={!!layer0.jitter} onChange={v => patchLayer0({ jitter: v })} />

                  {recipe.length > 1 && recipe.slice(1).map((l, i) => (
                    <div key={i} className="mbf-readonly">layer {i + 2} (read-only): {l.kind === 'noise' ? 'noise' : `${l.type} ${l.f0}${l.f1 ? '→' + l.f1 : ''}Hz`}, {l.t}s, delay {l.delay || 0}</div>
                  ))}

                  <div className="mbf-elgroup mbf-elcell">
                    <textarea className="mbf-eltext" placeholder="ElevenLabs prompt — soft harvest chime, kid-friendly…" />
                    <div className="mbf-lockcap"><span>Connect an ElevenLabs API key to unlock generation</span></div>
                  </div>
                </div>
              </div>
            </div>

            <PublishBar />
          </div>
        )}

        {tab === 'music' && (
          <div className="mbf-tabpane">
            <div className="mbf-scroll" style={{ flex: 1 }}>
              <div className="mbf-sec"><div className="ic" style={{ background: 'var(--warn-bg)' }}>🚧</div><div className="tt">Music Forge</div><div className="sb">no recipe table yet</div><div className="ln" /></div>
              <div className="mbf-note">
                All 6 realms currently share one hardcoded ambient pad (<code>apps/lashira/web/src/audio/ambient.js</code>) — it isn't data-driven yet the way SFX cues now are, so there's nothing here to edit safely without inventing a fake control. Bringing the pad's voices/birdsong into <code>@arganta/audio</code> as a second recipe table (mirroring exactly what SFX Forge just did) is the next real step. Publish below is already wired to the same <code>audio_library</code> row SFX Forge uses — there's only ever one table.
              </div>
            </div>
            <PublishBar extra={dirty.length === 0 ? <span style={{ fontSize: 11, color: 'var(--tx3)' }}>No music edits yet — nothing to add from this tab</span> : undefined} />
          </div>
        )}

      </div>
    </div>
  )
}
