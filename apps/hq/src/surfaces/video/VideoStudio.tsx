// R3/V0 — Video Studio: Soul Cinema. Five modes on one surface: Soul (identity),
// Generate (sovereign t2v), Cinema (directed camera moves — the Higgsfield
// clone), Edit (the existing, untouched timeline builder), Library (kept
// renders + publish gate). "Send to Edit" persists a generated clip to the
// media library so the timeline's own media drawer picks it up — reusing the
// working editor without modifying it. "Animate" hands a Soul keyframe to Cinema.
import { useState } from 'react'
import { UserRound, Sparkles, Clapperboard, Scissors, LibraryBig } from 'lucide-react'
import { uploadAsset } from '@arganta/video'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { VideoBuilder } from './VideoBuilder'
import { VideoGenerate } from './VideoGenerate'
import { VideoCinema } from './VideoCinema'
import { VideoSoul } from './VideoSoul'
import { VideoLibrary } from './VideoLibrary'
import { BrainsMap } from '../shared/BrainsMap'
import './video-studio.css'

type Mode = 'soul' | 'generate' | 'cinema' | 'edit' | 'library'

export function VideoStudio() {
  const [mode, setMode] = useState<Mode>('generate')
  const [note, setNote] = useState('')

  async function sendToEdit(clip: { url: string; meta: any }) {
    setMode('edit')
    if (!cloudEnabled) { setNote('Clip kept in the gallery — sign in to add it to the timeline library.'); return }
    try {
      const blob = await (await fetch(clip.url)).blob()
      const file = new File([blob], `sovereign-${Date.now().toString(36)}.mp4`, { type: 'video/mp4' })
      await uploadAsset(supabase, file, { kind: 'video', source: 'comfyui-wan22' })
      setNote('Clip added to the media library — open the media drawer in Edit to drop it on the timeline.')
    } catch (e: any) { setNote(`Couldn’t add to library: ${e?.message || e}`) }
    setTimeout(() => setNote(''), 6000)
  }

  return (
    <div className="vs-wrap">
      <div className="vs-modebar">
        <div className="seg vs-modeseg" role="group" aria-label="Video mode">
          <button className={mode === 'soul' ? 'on' : ''} onClick={() => setMode('soul')}><UserRound size={13} /> Soul</button>
          <button className={mode === 'generate' ? 'on' : ''} onClick={() => setMode('generate')}><Sparkles size={13} /> Generate</button>
          <button className={mode === 'cinema' ? 'on' : ''} onClick={() => setMode('cinema')}><Clapperboard size={13} /> Cinema</button>
          <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}><Scissors size={13} /> Edit</button>
          <button className={mode === 'library' ? 'on' : ''} onClick={() => setMode('library')}><LibraryBig size={13} /> Library</button>
        </div>
        {note && <span className="vs-note">{note}</span>}
        <div style={{ marginLeft: 'auto' }}><BrainsMap surface="video" /></div>
      </div>
      <div className="vs-body">
        {mode === 'soul' && <VideoSoul />}
        {mode === 'generate' && <VideoGenerate onSendToEdit={sendToEdit} />}
        {mode === 'cinema' && <VideoCinema onSendToEdit={sendToEdit} />}
        {mode === 'edit' && <VideoBuilder />}
        {mode === 'library' && <VideoLibrary />}
      </div>
    </div>
  )
}
