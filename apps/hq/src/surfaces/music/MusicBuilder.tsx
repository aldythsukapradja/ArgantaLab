/**
 * MUSIC BUILDER — one main surface: the Music Studio (the third studio in the
 * Video Builder · Post Studio family). The previous three-tab toolset
 * (Overview · SFX Forge · Music Forge) lives on unchanged behind Legacy.
 */
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { MusicStudio } from './MusicStudio'
import { LegacyContent } from './Legacy'
import './musicstudio.css'

export function MusicBuilder() {
  const [view, setView] = useState<'studio' | 'legacy'>('studio')

  if (view === 'studio') return <MusicStudio onLegacy={() => setView('legacy')} />

  return (
    <div className="msx-legacywrap">
      <div className="msx-legacybar">
        <button className="msx-ghost" onClick={() => setView('studio')}><ArrowLeft size={14} /> Music Studio</button>
        <span className="note">Legacy · the previous Music Builder — Overview, SFX Forge & Music Forge, all still working (incl. publish).</span>
      </div>
      <div className="msx-legacyhost">
        <LegacyContent />
      </div>
    </div>
  )
}
