// SuiteCanvas — the LOD scale router (concept doc Part 4 / 7.4). D0 ships the
// router chrome only: the honest "not wired yet" state per stage. The LOD control
// itself (World/Basin/Field/Structure/Well) lives in the Scope row now (HeaderBars),
// since "where am I" and "how zoomed in" are one navigation decision — this
// component just reads the current `lod` for when real renderers land here.
import { Compass } from 'lucide-react';
import type { StageManifest } from './registry';
import type { Lod } from './registry';

export function SuiteCanvas({ stage, lod: _lod }: { stage: StageManifest; lod: Lod }) {
  return (
    <div className="fds-canvas">
      <div className="fds-canvas-top">
        <div>
          <div className="fds-canvas-title">{stage.name}</div>
          <div className="fds-canvas-blurb">{stage.blurb}</div>
        </div>
      </div>
      <div className="fds-canvas-body">
        <div className="fds-canvas-empty">
          <div className="fds-canvas-ic"><Compass size={22} /></div>
          <b>{stage.name} — coming online</b>
          <span>Clones {stage.clones}. This LOD regime renders once the {stage.name.toLowerCase()} engine is wired — no number is shown until it is real.</span>
          <span className="fds-canvas-produces">produces {stage.produces}</span>
        </div>
      </div>
    </div>
  );
}
