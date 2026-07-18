// BrainsMap (R5/T4) — makes the tri-brain doctrine discoverable in-product:
// "Sovereign makes the media, Claude makes the content, Codex makes the tools."
// A small button in each studio's top bar opens a popover showing what each
// brain does ON THIS surface. Doctrine source: docs/media-center/
// Tri-Brain-Studio-Map.md. Pure display — no engine calls.
import { useState } from 'react'
import { Brain } from 'lucide-react'
import './brains-map.css'

type Row = { sovereign: string; claude: string; codex: string }
const MAP: Record<string, Row> = {
  music: {
    sovereign: 'ACE-Step songs, synth themes & SFX, recordings, voice audition',
    claude: 'Composer chat (mood→theme, lyrics), audio briefs, naming the feed',
    codex: 'new instrument in the synth engine, new SFX cue, scale/chord work',
  },
  video: {
    sovereign: 'Wan clips (Generate), timeline render & export, registry voice',
    claude: 'Director chat (brief→storyboard→scenes), captions, publishing',
    codex: 'new transition, new text animation, export-preset work',
  },
  pixel: {
    sovereign: 'ComfyUI pixel-LoRA one-offs, palette ops, vault queries',
    claude: 'fulfils Forge briefs (PixelLab→ingest), tags/classifies, usage triage',
    codex: 'new facet, sprite-sheet slicer, vault tooling',
  },
  broadcast: {
    sovereign: 'z-image slide backgrounds (+ARGANTA LoRA), PNG compose & export',
    claude: 'Copilot prompt→carousel, captions/polish, drafts, Buffer/Moment publish',
    codex: 'new platform preset, new sticker pack, template authoring',
  },
  media: {
    sovereign: 'the Sovereign Rack — engines, queue, test renders',
    claude: "batch missions ('generate this week's asset needs')",
    codex: 'pipeline & tooling missions',
  },
}
const LABELS: Record<string, string> = { music: 'Audio Studio', video: 'Video Studio', pixel: 'Pixel Forge', broadcast: 'Post Studio', media: 'Media Center' }

export function BrainsMap({ surface }: { surface: string }) {
  const [open, setOpen] = useState(false)
  const row = MAP[surface]
  if (!row) return null
  const brains: { id: string; name: string; color: string; verb: string; body: string }[] = [
    { id: 'sov', name: 'Sovereign', color: 'var(--acc)', verb: 'makes the media', body: row.sovereign },
    { id: 'claude', name: 'Claude', color: '#D97757', verb: 'makes the content', body: row.claude },
    { id: 'codex', name: 'Codex', color: '#10A37F', verb: 'makes the tools', body: row.codex },
  ]
  return (
    <div className="brains-wrap">
      <button className="brains-btn" onClick={() => setOpen(o => !o)} title="What each brain does here">
        <Brain size={13} /> Brains
      </button>
      {open && (
        <>
          <div className="brains-scrim" onClick={() => setOpen(false)} />
          <div className="brains-pop" role="dialog" aria-label="Tri-brain map">
            <div className="brains-pop-head">
              <b>Three brains · {LABELS[surface] || surface}</b>
              <span>bytes → Sovereign · words → Claude · diffs → Codex</span>
            </div>
            {brains.map(b => (
              <div key={b.id} className="brains-row">
                <span className="brains-dot" style={{ background: b.color }} />
                <div className="brains-row-body">
                  <div className="brains-row-name"><b style={{ color: b.color }}>{b.name}</b> <span>{b.verb}</span></div>
                  <div className="brains-row-detail">{b.body}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
