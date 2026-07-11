import { JarvisOrb } from './components/JarvisOrb'
import { AppEmbed } from './embed/AppEmbed'
import { EMBEDS } from './embed/embeds'

// ── Command — the operator-only cockpit ON the public landing. Signed in as an
// operator, the founder gets the Jarvis reactor + the real Circle HQ embedded
// (desktop frame, session handed over the bridge) so "everything is here, can
// access the HQ as well" — without ever exposing operator surfaces publicly.
export function Command() {
  return (
    <div className="cmd">
      <div className="cmd-head">
        <span className="scr-kick">Operator · Command</span>
        <h2 className="scr-h2">The cockpit, <em>on the front door.</em></h2>
      </div>
      <div className="cmd-jarvis"><JarvisOrb /></div>
      <div className="cmd-hq">
        <div className="cmd-hq-bar">
          <span>Circle HQ · live</span>
          <a href={EMBEDS.hq} target="_blank" rel="noopener noreferrer" className="cmd-hq-open">Open in new tab ↗</a>
        </div>
        <div className="cmd-hq-frame"><AppEmbed app="hq" defaultFrame="desktop" operator /></div>
      </div>
    </div>
  )
}
