// Cinema — WS1 authoring surface with live editing + offline version control.
// Left: scenes grouped by act (edited scenes flagged). Centre: cinematic stage +
// live karaoke. Right: an EDITABLE inspector (text, voice, audio replacement) plus
// a version panel. All edits persist in the Cinema Director store (localStorage).
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Film, Mic, Boxes, Network, Pencil,
  Upload, Copy, Undo2, History, Save, Trash2, Download, FileUp, Check,
} from 'lucide-react'
import { useCinema } from './director'
import { SCENES, ACTS, type Scene } from './scenario'
import { CoreSlot } from './slots/CoreSlot'
import { NodesSlot } from './slots/NodesSlot'
import { KaraokeLine } from '../lib/karaoke/KaraokeLine'
import { RENDERERS } from './registry'
import { useCinemaStore, mergeScene } from './store'
import {
  INSTRUMENTS, STAGE_EFFECTS, SCENE_ACTIONS, ACTION_TARGETS,
  type InstrumentId, type StageEffect, type StageDirection, type SceneAction, type ActionTarget,
} from './contract'
import { actionFor, coreForAction } from './deriveState'
import { speakBrowser, TTS_TIERS, type TtsTier, type SpeakHandle } from '../lib/tts/tts'
import { Volume2, Square, GripVertical, GripHorizontal } from 'lucide-react'
import './cinema.css'

const CORE_TEXT: Record<string, string> = {
  offline: 'Offline', booting: 'Ignition', idle: 'Unified core', listening: 'Listening',
  'jarvis-speaking': 'Jarvis speaking', 'specialist-speaking': 'Specialist speaking',
  think: 'THINK', know: 'KNOW', do: 'DO', 'product-focus': 'Product focus',
  'popup-open': 'Product detail', 'vault-entry': 'Vault entry',
  'architecture-unfold': 'Architecture', return: 'Recombining',
}
const PRODUCT_NAME: Record<string, string> = {
  arganta: 'ArgantaLab', kinetik: 'KinetikCircle', lashira: 'LashiraBloom', landing: 'Landing', hq: 'Circle HQ',
}
const INSTR_LABEL: Record<InstrumentId, string> = {
  reach: 'World Reach', engaged: 'Weekly Engaged', valuation: 'Valuation',
  products: 'Five Products', access: 'Access & Attention', rhythm: 'Visit Rhythm',
}
function resolveStageMap(dirs: StageDirection[]): Record<InstrumentId, StageEffect> {
  const m = Object.fromEntries(INSTRUMENTS.map(i => [i, 'recede'])) as Record<InstrumentId, StageEffect>
  for (const d of dirs) { if (d.target === 'all') INSTRUMENTS.forEach(i => { m[i] = d.effect }); else if (d.target !== 'none') m[d.target] = d.effect }
  return m
}

export function CinemaDev() {
  const c = useCinema()
  const { overrides, versions, editScene, resetScene, resetAll, saveVersion, restoreVersion, deleteVersion, exportJson, importJson } = useCinemaStore()
  const base = SCENES[c.index]
  const scene = mergeScene(base, overrides[base.id])
  const act = ACTS[scene.act]
  const st = c.state
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tier, setTier] = useState<TtsTier>('experiment')
  const [speaking, setSpeaking] = useState(false)
  const speakRef = useRef<SpeakHandle | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Adjustable right-hand inspector drawer width (persisted) + the stage's
  // reactor/brain vertical split ratio (also persisted, also draggable).
  const [inspW, setInspW] = useState(() => Number(localStorage.getItem('hq_cin_insp_w')) || 300)
  const [splitPct, setSplitPct] = useState(() => Number(localStorage.getItem('hq_cin_split_pct')) || 58)
  const dragRef = useRef<{ mode: 'insp' | 'split'; startX: number; startY: number; startW: number; startPct: number; stageEl: HTMLDivElement | null } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const onDragMove = (e: PointerEvent) => {
    const d = dragRef.current; if (!d) return
    if (d.mode === 'insp') {
      const next = Math.max(260, Math.min(560, d.startW - (e.clientX - d.startX)))
      setInspW(next)
    } else {
      const rect = d.stageEl?.getBoundingClientRect()
      if (!rect) return
      const next = Math.max(28, Math.min(82, d.startPct + ((e.clientY - d.startY) / rect.height) * 100))
      setSplitPct(next)
    }
  }
  const onDragEnd = () => {
    dragRef.current = null
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    document.body.style.cursor = ''
    localStorage.setItem('hq_cin_insp_w', String(inspW))
    localStorage.setItem('hq_cin_split_pct', String(splitPct))
    // both embedded WebGL canvases need to re-measure after a manual resize
    window.dispatchEvent(new Event('resize'))
  }
  const startInspDrag = (e: React.PointerEvent) => {
    dragRef.current = { mode: 'insp', startX: e.clientX, startY: 0, startW: inspW, startPct: 0, stageEl: null }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
    document.body.style.cursor = 'col-resize'
  }
  const startSplitDrag = (e: React.PointerEvent) => {
    dragRef.current = { mode: 'split', startX: 0, startY: e.clientY, startW: 0, startPct: splitPct, stageEl: stageRef.current }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
    document.body.style.cursor = 'row-resize'
  }

  const grouped = useMemo(() => {
    const by: Record<number, Scene[]> = {}
    SCENES.forEach(s => { (by[s.act] ||= []).push(s) })
    return Object.entries(by).map(([a, list]) => ({ act: Number(a), list }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('input,textarea,select')) return
      if (e.key === 'ArrowRight') { e.preventDefault(); c.next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); c.prev() }
      else if (e.code === 'Space') { e.preventDefault(); c.toggle() }
      else if (e.key.toLowerCase() === 'a') c.startAuto()
      else if (e.key.toLowerCase() === 'g') c.startGuided()
      else if (e.key.toLowerCase() === 'r') c.replay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c])

  const onReplaceAudio = (f: File | undefined) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      editScene(base.id, { audioSrc: String(reader.result), audioName: f.name })
      setTimeout(() => c.reload(true), 30) // load the replacement clip
    }
    reader.readAsDataURL(f)
  }
  const onSpeak = async () => {
    if (speaking) { speakRef.current?.cancel(); setSpeaking(false); return }
    setSpeaking(true)
    const h = await speakBrowser(scene.narration, scene.voice)
    speakRef.current = h
    h.done.then(() => setSpeaking(false))
  }
  const copyRerecord = () => {
    const text = `[${scene.voice}] ${scene.title}\n${scene.narration}`
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `cinema-scenario-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  const doImport = (f: File | undefined) => {
    if (!f) return
    const r = new FileReader(); r.onload = () => { importJson(String(r.result)); setTimeout(() => c.reload(), 30) }; r.readAsText(f)
  }

  const editedCount = Object.keys(overrides).length
  const audioReplaced = !!overrides[base.id]?.audioSrc
  const textChanged = !!(overrides[base.id]?.narration || overrides[base.id]?.idea)

  // Stage · instrument choreography for this scene (override or derived default).
  const stageMap = resolveStageMap(overrides[base.id]?.stage ?? c.state.stage)
  const stageAuthored = !!overrides[base.id]?.stage
  const setInstrumentFx = (id: InstrumentId, effect: StageEffect) => {
    const next = { ...stageMap, [id]: effect }
    editScene(base.id, { stage: INSTRUMENTS.filter(i => next[i] !== 'recede').map(i => ({ target: i, effect: next[i] })) })
  }

  // Action selector — a founder-facing verb+target over the low-level core
  // state. No override = today's exact baseline; an override REPLACES the
  // derived `core` for this one scene, so the reactor AND the WS3 brain (which
  // keys its region activation off `core`) move together — one dropdown.
  const actionOv = overrides[base.id]?.action
  const actionAuthored = !!actionOv
  const effectiveAction = actionOv ?? actionFor(base)
  const effectiveCore = actionAuthored ? coreForAction(actionOv) : st.core
  const setAction = (patch: Partial<{ action: SceneAction; target: ActionTarget | undefined }>) => {
    editScene(base.id, { action: { ...effectiveAction, ...patch } })
  }

  return (
    <div className="cin" style={{ ['--act-accent' as string]: act.accent, ['--insp-w' as string]: `${inspW}px` }}>
      {/* ── Left: grouped scene list ──────────────────────────────── */}
      <aside className="cin-list">
        <div className="cin-list-head">
          <Film size={13} /> <b>Scenario</b>
          <span>{editedCount ? `${editedCount} edited` : `${c.total} scenes`}</span>
        </div>
        <div className="cin-list-scroll">
          {grouped.map(({ act: a, list }) => (
            <div key={a} className="cin-actgrp" style={{ ['--act-accent' as string]: ACTS[a as 1].accent }}>
              <div className="cin-actgrp-head"><i /> ACT {ACTS[a as 1].roman} · {ACTS[a as 1].title}<em>{list.length}</em></div>
              {list.map(s => {
                const i = SCENES.indexOf(s)
                const ov = overrides[s.id]
                const title = ov?.title ?? s.title
                return (
                  <button key={s.id} className={'cin-row' + (i === c.index ? ' on' : '')} onClick={() => c.jump(i)}>
                    <span className="cin-row-id">{s.id}</span>
                    <span className="cin-row-title">{title}</span>
                    {ov && Object.keys(ov).length > 0 && <span className="cin-edited" title="Edited" />}
                    <span className={'cin-row-voice ' + (ov?.voice ?? s.voice)}>{ov?.voice ?? s.voice}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Centre: cinematic stage — top reactor, bottom brain, always both visible ── */}
      <section className="cin-stage">
        <div className="cin-stage-top">
          <span className="cin-kicker">ACT {act.roman} · {act.title}</span>
          <span className="cin-scenetag">Scene {scene.id}</span>
        </div>
        <div className="cin-split" ref={stageRef} style={{ ['--split' as string]: `${splitPct}%` }}>
          <div className="cin-split-top">
            <CoreSlot state={effectiveCore} product={st.product} progress={c.progress} />
          </div>
          <div className="cin-split-handle" onPointerDown={startSplitDrag} title="Drag to resize reactor / brain">
            <GripHorizontal size={13} />
          </div>
          <div className="cin-split-bottom">
            {/* Always mounted (not gated by nodes.visible) — the founder can see
                the brain react to every scene while authoring, per beat. */}
            <NodesSlot state={{ ...st.nodes, visible: true }} progress={c.progress} core={effectiveCore} sceneId={scene.id} />
            <span className="cin-split-label">COGNITIVE CORTEX · WS3</span>
          </div>
        </div>
        <div className="cin-narrative">
          <div className="cin-idea">{scene.idea}</div>
          <KaraokeLine audio={c.audioEl} text={scene.narration} playing={c.playing} className="cin-kara" />
          <div className="cin-speaker">
            <i className={scene.voice} />{scene.voice === 'KF' ? 'KF · Specialist' : 'JM · Jarvis'}
            <span>·</span>{overrides[base.id]?.audioName ?? base.file}
          </div>
        </div>
      </section>

      {/* ── Right: EDITABLE inspector + version control (adjustable width) ── */}
      <aside className="cin-inspector">
        <div className="cin-insp-handle" onPointerDown={startInspDrag} title="Drag to resize the Editor drawer">
          <GripVertical size={13} />
        </div>
        <div className="cin-insp-head">
          <Pencil size={13} /> <b>Editor</b>
          <button className={'cin-hist-btn' + (showHistory ? ' on' : '')} onClick={() => setShowHistory(h => !h)} title="Version history">
            <History size={13} />{versions.length > 0 && <em>{versions.length}</em>}
          </button>
        </div>

        {showHistory ? (
          <div className="cin-insp-scroll">
            <div className="cin-ver-actions">
              <button className="cin-btn primary" onClick={() => saveVersion(window.prompt('Version label') || undefined)}><Save size={12} /> Save version</button>
              <button className="cin-btn" onClick={doExport}><Download size={12} /> Export</button>
              <button className="cin-btn" onClick={() => importRef.current?.click()}><FileUp size={12} /> Import</button>
              <input ref={importRef} type="file" accept="application/json" hidden onChange={e => doImport(e.target.files?.[0])} />
            </div>
            {versions.length === 0 && <div className="cin-insp-note">No saved versions yet. “Save version” snapshots the whole scenario; restore any point later.</div>}
            {versions.map(v => (
              <div key={v.id} className="cin-ver">
                <div className="cin-ver-main">
                  <b>{v.label}</b>
                  <span>{new Date(v.ts).toLocaleString()} · {Object.keys(v.overrides).length} edits</span>
                </div>
                <button className="cin-ico" title="Restore" onClick={() => { restoreVersion(v.id); setTimeout(() => c.reload(), 30) }}><Undo2 size={13} /></button>
                <button className="cin-ico" title="Delete" onClick={() => deleteVersion(v.id)}><Trash2 size={13} /></button>
              </div>
            ))}
            {editedCount > 0 && <button className="cin-btn danger wide" onClick={() => { if (confirm('Reset ALL scenes to the original story-lock?')) { resetAll(); setTimeout(() => c.reload(), 30) } }}><RotateCcw size={12} /> Reset all to original</button>}
          </div>
        ) : (
          <div className="cin-insp-scroll">
            <label className="cin-field">
              <span>Idea (headline)</span>
              <textarea rows={2} value={scene.idea} onChange={e => editScene(base.id, { idea: e.target.value })} />
            </label>
            <label className="cin-field">
              <span>Title</span>
              <input value={scene.title} onChange={e => editScene(base.id, { title: e.target.value })} />
            </label>
            <div className="cin-field">
              <span>Voice</span>
              <div className="cin-voice-toggle">
                {(['JM', 'KF'] as const).map(v => (
                  <button key={v} className={scene.voice === v ? 'on ' + v : ''} onClick={() => editScene(base.id, { voice: v })}>
                    {v === 'JM' ? 'JM · Jarvis' : 'KF · Specialist'}
                  </button>
                ))}
              </div>
            </div>
            <label className="cin-field">
              <span>Narration <em>drives the karaoke live</em></span>
              <textarea rows={5} value={scene.narration} onChange={e => editScene(base.id, { narration: e.target.value })} />
            </label>

            <div className="cin-field">
              <span>Audio clip</span>
              <div className="cin-audio">
                <span className="cin-audio-name">{overrides[base.id]?.audioName ?? base.file}{audioReplaced && <em> · replaced</em>}</span>
                <div className="cin-audio-btns">
                  <button className={'cin-btn' + (speaking ? ' primary' : '')} onClick={onSpeak} title="Speak the narration with browser TTS">
                    {speaking ? <Square size={12} /> : <Volume2 size={12} />} {speaking ? 'Stop' : 'Speak'}
                  </button>
                  <button className="cin-btn" onClick={() => fileRef.current?.click()}><Upload size={12} /> Replace</button>
                  <button className="cin-btn" onClick={copyRerecord}>{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Re-record text'}</button>
                  {audioReplaced && <button className="cin-ico" title="Revert audio" onClick={() => { useCinemaStore.getState().clearField(base.id, 'audioSrc'); useCinemaStore.getState().clearField(base.id, 'audioName'); setTimeout(() => c.reload(), 30) }}><Undo2 size={13} /></button>}
                </div>
                <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => onReplaceAudio(e.target.files?.[0])} />
                <div className="cin-tiers">
                  {TTS_TIERS.map(t => (
                    <button key={t.id} className={'cin-tier' + (tier === t.id ? ' on' : '') + (t.wired ? '' : ' soon')}
                      onClick={() => setTier(t.id)} title={`${t.provider} — ${t.note}`}>
                      {t.label}{!t.wired && <em>soon</em>}
                    </button>
                  ))}
                </div>
              </div>
              {textChanged && !audioReplaced && <div className="cin-warn">Text edited — the clip still plays the original recording. Use Speak to preview, Replace to bake a new clip, or Re-record text for the TTS pipeline.</div>}
            </div>

            <div className="cin-field">
              <span>Action <em>drives the reactor + brain together</em> {actionAuthored && <em>edited</em>}
                {actionAuthored && <button className="cin-stage-auto" onClick={() => useCinemaStore.getState().clearField(base.id, 'action')}>reset to auto</button>}
              </span>
              <div className="cin-stage-grid">
                <div className="cin-stage-row">
                  <b>Verb</b>
                  <select value={effectiveAction.action} data-fx={effectiveAction.action === 'hold' ? 'recede' : 'focus'}
                    onChange={e => setAction({ action: e.target.value as SceneAction })}>
                    {SCENE_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="cin-stage-row">
                  <b>Target</b>
                  <select value={effectiveAction.target ?? ''} data-fx={effectiveAction.target ? 'focus' : 'recede'}
                    onChange={e => setAction({ target: (e.target.value || undefined) as ActionTarget | undefined })}>
                    <option value="">— none —</option>
                    {ACTION_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="cin-insp-note">
                <Boxes size={11} /> Resolves to core <em>{effectiveCore}</em>{actionAuthored ? ' · override active' : ' · baseline (no override)'}
              </div>
            </div>

            <div className="cin-field">
              <span>Stage · instrument choreography {stageAuthored && <em>edited</em>}
                {stageAuthored && <button className="cin-stage-auto" onClick={() => useCinemaStore.getState().clearField(base.id, 'stage')}>reset to auto</button>}
              </span>
              <div className="cin-stage-grid">
                {INSTRUMENTS.map(id => (
                  <div className="cin-stage-row" key={id}>
                    <b>{INSTR_LABEL[id]}</b>
                    <select value={stageMap[id]} onChange={e => setInstrumentFx(id, e.target.value as StageEffect)}
                      data-fx={stageMap[id]}>
                      {STAGE_EFFECTS.map(fx => <option key={fx} value={fx}>{fx}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="cin-meta-strip">
              <span>Act {act.roman}</span>
              {scene.product && <span>{PRODUCT_NAME[scene.product]}</span>}
              {scene.beat && <span>{scene.beat}</span>}
              <span>{c.duration ? `${c.duration.toFixed(1)}s` : '—'}</span>
              <span className="core"><Boxes size={10} /> {CORE_TEXT[st.core] || st.core}</span>
              {st.nodes.visible && <span className="nodes"><Network size={10} /> {st.nodes.tour ? `Tour ${st.nodes.tour}` : 'Nodes'}</span>}
            </div>

            {overrides[base.id] && <button className="cin-btn danger wide" onClick={() => { resetScene(base.id); setTimeout(() => c.reload(), 30) }}><Undo2 size={12} /> Reset this scene</button>}
            <div className="cin-insp-note"><Mic size={11} /> Edits persist locally and are versioned. Reactor slot <em>{RENDERERS.core}</em> · Nodes slot <em>{RENDERERS.nodes}</em>.</div>
          </div>
        )}
      </aside>

      {/* ── Bottom: transport ─────────────────────────────────────── */}
      <footer className="cin-transport">
        <div className="cin-ctrl">
          <button onClick={c.prev} title="Previous (←)"><SkipBack size={16} /></button>
          <button className="cin-play" onClick={c.toggle} title="Play / Pause (Space)">{c.playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <button onClick={c.next} title="Next (→)"><SkipForward size={16} /></button>
          <button onClick={c.replay} title="Replay (R)"><RotateCcw size={15} /></button>
        </div>
        <div className="cin-rail">
          {SCENES.map((s, i) => (
            <button key={s.id} className={'cin-seg' + (i === c.index ? ' on' : i < c.index ? ' past' : '')}
              style={{ ['--fill' as string]: i === c.index ? `${(c.progress * 100).toFixed(1)}%` : i < c.index ? '100%' : '0%',
                       ['--seg-accent' as string]: ACTS[s.act].accent }}
              onClick={() => c.jump(i)} title={`${s.id} · ${s.title}`} />
          ))}
        </div>
        <div className="cin-tport-right">
          <button className={'cin-mode ' + c.mode} onClick={c.mode === 'auto' ? c.pause : c.startAuto}>
            {c.mode === 'auto' ? 'AUTO' : c.mode === 'paused' ? 'PAUSED' : 'GUIDED'}
          </button>
          <span className="cin-count">{String(c.index + 1).padStart(2, '0')} / {c.total}</span>
        </div>
      </footer>
    </div>
  )
}
