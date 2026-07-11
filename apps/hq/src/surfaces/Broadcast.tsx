/**
 * CONTENT BUILDER — one main surface: the Post Studio (a Video-Builder-shaped
 * design workspace for every social format). The previous seven-tab toolset
 * (Catalogue · Autopilot · Studio · Prompts · Import · Library · Research)
 * lives on unchanged behind the Legacy button.
 */
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PostStudio } from './broadcast/PostStudio'
import { LegacyContent } from './broadcast/Legacy'
import './broadcast/post.css'

export function Broadcast() {
  const [view, setView] = useState<'studio' | 'legacy'>('studio')

  if (view === 'studio') return <PostStudio onLegacy={() => setView('legacy')} />

  return (
    <div className="pbx-legacywrap">
      <div className="pbx-legacybar">
        <button className="pbx-ghost" onClick={() => setView('studio')}><ArrowLeft size={14} /> Post Studio</button>
        <span className="note">Legacy · the previous Content Builder toolset — everything still works, including the Discover-feed catalogue.</span>
      </div>
      <div className="pbx-legacyscroll">
        <div className="inner"><LegacyContent /></div>
      </div>
    </div>
  )
}
