// Cinema Director store — editable scenario overrides + version history, all
// persisted offline (localStorage). The base SCENES/NARRATION stay immutable
// (the ported story-lock); edits live here as overrides and can be versioned,
// restored, exported, or reset. This is the WS1 · E3 authoring seam arriving early.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SCENES, NARRATION, type Scene } from './scenario'
import type { StageDirection } from './contract'

export interface SceneEdit {
  idea?: string
  title?: string
  narration?: string
  voice?: 'JM' | 'KF'
  audioSrc?: string   // data: URL of a replacement clip (offline-safe)
  audioName?: string  // original filename of the replacement, for display
  stage?: StageDirection[] // authored instrument choreography for this scene
}

export interface CinemaVersion {
  id: string
  label: string
  ts: number
  overrides: Record<string, SceneEdit>
}

interface CinemaStore {
  overrides: Record<string, SceneEdit>
  versions: CinemaVersion[]
  editScene: (id: string, patch: SceneEdit) => void
  clearField: (id: string, field: keyof SceneEdit) => void
  resetScene: (id: string) => void
  resetAll: () => void
  saveVersion: (label?: string) => void
  restoreVersion: (vid: string) => void
  deleteVersion: (vid: string) => void
  exportJson: () => string
  importJson: (json: string) => boolean
}

export const useCinemaStore = create<CinemaStore>()(
  persist(
    (set, get) => ({
      overrides: {},
      versions: [],
      editScene: (id, patch) => set(s => {
        const next = { ...(s.overrides[id] || {}), ...patch }
        // drop keys set back to undefined
        for (const k of Object.keys(next) as (keyof SceneEdit)[]) if (next[k] === undefined) delete next[k]
        return { overrides: { ...s.overrides, [id]: next } }
      }),
      clearField: (id, field) => set(s => {
        const cur = { ...(s.overrides[id] || {}) }
        delete cur[field]
        const overrides = { ...s.overrides }
        if (Object.keys(cur).length) overrides[id] = cur; else delete overrides[id]
        return { overrides }
      }),
      resetScene: (id) => set(s => {
        const overrides = { ...s.overrides }; delete overrides[id]; return { overrides }
      }),
      resetAll: () => set({ overrides: {} }),
      saveVersion: (label) => set(s => ({
        versions: [{
          id: 'v' + Date.now().toString(36),
          label: label?.trim() || `Version ${s.versions.length + 1}`,
          ts: Date.now(),
          overrides: structuredClone(s.overrides),
        }, ...s.versions].slice(0, 40),
      })),
      restoreVersion: (vid) => set(s => {
        const v = s.versions.find(x => x.id === vid)
        return v ? { overrides: structuredClone(v.overrides) } : {}
      }),
      deleteVersion: (vid) => set(s => ({ versions: s.versions.filter(v => v.id !== vid) })),
      exportJson: () => JSON.stringify({ overrides: get().overrides, versions: get().versions }, null, 2),
      importJson: (json) => {
        try {
          const parsed = JSON.parse(json)
          if (parsed && typeof parsed.overrides === 'object') {
            set({ overrides: parsed.overrides, versions: Array.isArray(parsed.versions) ? parsed.versions : get().versions })
            return true
          }
        } catch { /* ignore */ }
        return false
      },
    }),
    { name: 'hq_cinema_director_v1' },
  ),
)

// ── merge helpers (base story-lock + edits) ──────────────────────────────
export interface MergedScene extends Scene {
  narration: string
  edited: boolean
  audioSrc: string // resolved: replacement data-URL or the /audio/ path
}

export function mergeScene(base: Scene, ov?: SceneEdit): MergedScene {
  const edited = !!ov && Object.keys(ov).length > 0
  return {
    ...base,
    idea: ov?.idea ?? base.idea,
    title: ov?.title ?? base.title,
    voice: ov?.voice ?? base.voice,
    narration: ov?.narration ?? NARRATION[base.id] ?? base.idea,
    audioSrc: ov?.audioSrc ?? ('/audio/' + base.file),
    edited,
  }
}

/** Resolve the clip URL for a scene id, honouring an audio replacement. */
export function resolveAudioSrc(id: string): string {
  const ov = useCinemaStore.getState().overrides[id]
  const base = SCENES.find(s => s.id === id)
  return ov?.audioSrc ?? ('/audio/' + (base?.file ?? ''))
}
