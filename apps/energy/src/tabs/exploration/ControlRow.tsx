// The control row — one horizontal line above the charts, replacing the 180px
// empty left drawer this workspace used to reserve.
//
// It holds the only state that is genuinely cross-tab: how many basins are in the
// frame, which ones (and therefore what the series colours mean), what is dimmed,
// and how good the evidence is. Filters belong in one row above the charts; a
// vertical rail for them cost 180px at every breakpoint and needed a bespoke
// bottom-sheet on mobile, where a chip row just scroll-snaps.
import { useState } from 'react';
import { Ban, Filter, Globe, Layers3, Pin, X } from 'lucide-react';
import { FACETS, MAX_PINS, scopeStateOf, useCanvas } from './canvas-store';
import { pinColor, PROVENANCE_META, type Provenance } from '../../viz/palette';
import { useStore } from '../../store';

const SCOPE_META = {
  WORLD: { icon: Globe, hint: 'All 179 provinces · where should we look?' },
  DOSSIER: { icon: Pin, hint: 'One basin against its peer distribution' },
  COMPARE: { icon: Layers3, hint: 'Series-coloured across the pinned set' },
} as const;

export function ExplorationControlRow({ provenance, n }: { provenance: Provenance; n: number }) {
  const pins = useCanvas((s) => s.pins);
  const facets = useCanvas((s) => s.facets);
  const togglePin = useCanvas((s) => s.togglePin);
  const toggleFacet = useCanvas((s) => s.toggleFacet);
  const clearFacets = useCanvas((s) => s.clearFacets);
  const dark = useStore((s) => s.theme) === 'dark';
  const [facetsOpen, setFacetsOpen] = useState(false);

  const state = scopeStateOf(pins);
  const Icon = SCOPE_META[state].icon;
  const activeFacets = Object.values(facets).reduce((total, list) => total + list.length, 0);
  const grade = PROVENANCE_META[provenance];

  return (
    <div className="exc-control" role="toolbar" aria-label="Exploration scope and facets">
      <span className={`exc-scope-state ${state.toLowerCase()}`} title={SCOPE_META[state].hint}>
        <Icon size={12} />{state}
      </span>

      <div className="exc-pins">
        {pins.length === 0 && <span className="exc-pins-empty">No basin pinned — showing all 179</span>}
        {pins.map((pin) => (
          <button
            key={pin.id}
            className="exc-pin"
            onClick={() => togglePin(pin)}
            title={`Unpin ${pin.name}`}
          >
            <i style={{ background: pinColor(pin.slot, dark) }} />
            <b>{pin.name}</b>
            {pin.fieldCount !== undefined && <em>{pin.fieldCount.toLocaleString()}</em>}
            <X size={10} />
          </button>
        ))}
        {pins.length > 0 && pins.length < MAX_PINS && (
          <span className="exc-pins-hint">click any basin mark to pin ({MAX_PINS - pins.length} left)</span>
        )}
        {pins.length === MAX_PINS && <span className="exc-pins-hint">pin limit reached</span>}
      </div>

      <div className="exc-facet-zone">
        <button
          className={'exc-facet-btn' + (activeFacets ? ' on' : '')}
          onClick={() => setFacetsOpen((open) => !open)}
          aria-expanded={facetsOpen}
        >
          <Filter size={11} />Filters{activeFacets ? ` (${activeFacets})` : ''}
        </button>
        {activeFacets > 0 && (
          <button className="exc-facet-clear" onClick={clearFacets} title="Clear all facets"><Ban size={11} /></button>
        )}
        {facetsOpen && (
          <div className="exc-facet-pop">
            <header>
              <b>Facets dim, they do not remove</b>
              <span>The denominator stays on screen — only the choropleth filters destructively.</span>
            </header>
            {FACETS.map((group) => (
              <div className="exc-facet-group" key={group.id}>
                <small>{group.label}</small>
                <div>
                  {group.options.map((option) => {
                    const on = facets[group.id]?.includes(option) ?? false;
                    return (
                      <button
                        key={option}
                        className={'exc-facet-chip' + (on ? ' on' : '')}
                        onClick={() => toggleFacet(group.id, option)}
                        aria-pressed={on}
                      >{option}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <span className={`exc-grade ${provenance.toLowerCase()}`} title={`${grade.hint} · rendered as ${grade.fill}`}>
        <i />{provenance}<em>n={n.toLocaleString()}</em>
      </span>
    </div>
  );
}
