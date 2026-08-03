import { Compass, GitBranch } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { StudyStage } from './registry';

export function ExplorationSuiteCanvas({ stage, scope }: { stage: StudyStage; scope: SearchEntry }) {
  return (
    <section className="exs-canvas">
      <header>
        <div><span>{stage.phase} · {scope.name}</span><h2>{stage.name}</h2><p>{stage.blurb}</p></div>
        <span className="exs-status">S0 · shell</span>
      </header>
      <div className="exs-canvas-body">
        <div className="exs-empty">
          <div className="exs-empty-icon"><Compass size={23} /></div>
          <b>{stage.name} is ready for its engine</b>
          <p>This stage will reproduce the transparent backbone of {stage.clones}. No analysis result is shown until a deterministic engine emits a sourced study artifact.</p>
          <span><GitBranch size={12} /> produces {stage.produces}</span>
        </div>
      </div>
      <footer><b>Lineage</b><span>scope → OSDU inputs → typed artifact → downstream study stages</span><em>Nothing derived yet</em></footer>
    </section>
  );
}

