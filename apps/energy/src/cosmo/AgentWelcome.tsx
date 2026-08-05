// cosmo/AgentWelcome.tsx — the first thing you see in the agent tab.
//
// Every figure on this screen is read from the gazetteer that is loaded in the
// browser at that moment. Nothing is typed in. That matters more than it sounds:
// a welcome screen with a hardcoded "14,069 places" is a claim that silently
// goes stale the first time the catalogue is rebuilt, and the one surface whose
// entire job is to establish trust is the worst place to keep a stale number.
//
// The starter chips are chosen the same way — the busiest basin, the country
// with the most fields on record, the best-instrumented field are all computed
// from the index, so a chip can never point at something that is not there.

import { useMemo } from 'react';
import { Database, Cpu, CircleSlash } from 'lucide-react';
import type { GazIndex, GazIndexed } from '../agent/gazetteer.ts';
import type { ActiveModel, Tier } from '../agent/runtime.ts';

const fmt = (n: number) => n.toLocaleString('en-US');

/** How many descendants of a given kind hang off a node. One level only —
 *  fields hang directly off basins and countries in this graph. */
function childCount(index: GazIndex, node: GazIndexed, kind: string): number {
  return (index.childrenOf.get(node.id) ?? []).filter((c) => c.kind === kind).length;
}

/** The node of a kind with the most children of another kind. Ties keep the
 *  first, which is stable because the gazetteer's node order is stable. */
function busiest(index: GazIndex, kind: string, childKind: string): GazIndexed | null {
  let best: GazIndexed | null = null;
  let bestN = 0;
  for (const node of index.byKind.get(kind as never) ?? []) {
    const n = childCount(index, node, childKind);
    if (n > bestN) { best = node; bestN = n; }
  }
  return best;
}

/** The field carrying the most measured data — the one worth demonstrating. */
function richest(index: GazIndex): GazIndexed | null {
  let best: GazIndexed | null = null;
  let bestN = 0;
  for (const node of index.byKind.get('field' as never) ?? []) {
    const n = Object.values(node.has ?? {}).filter((v) => (typeof v === 'number' ? v > 0 : v === true)).length;
    if (n > bestN) { best = node; bestN = n; }
  }
  return best;
}

export interface AgentWelcomeProps {
  index: GazIndex | null;
  tier: Tier;
  activeModel: ActiveModel | null;
  workerConfigured: boolean;
  onChip: (query: string) => void;
}

export function AgentWelcome({ index, tier, activeModel, workerConfigured, onChip }: AgentWelcomeProps) {
  const live = useMemo(() => {
    if (!index) return null;
    const c = index.counts;
    const basin = busiest(index, 'basin', 'field');
    const country = busiest(index, 'country', 'field');
    const field = richest(index);
    const sources = [...new Set(index.nodes.flatMap((n) => n.sources ?? []))].sort();
    return {
      total: c.total ?? index.nodes.length,
      stats: [
        { n: c.basin ?? 0, label: 'basins' },
        { n: c.field ?? 0, label: 'fields' },
        { n: (c.well ?? 0) + (c.wellbore ?? 0), label: 'wells' },
        { n: c.country ?? 0, label: 'countries' },
      ].filter((s) => s.n > 0),
      sources,
      chips: [
        basin && { label: basin.name, query: basin.name, why: `${fmt(childCount(index, basin, 'field'))} fields on record` },
        country && { label: `Basins in ${country.name}`, query: `which basins are in ${country.name}`, why: `${fmt(childCount(index, country, 'field'))} fields` },
        field && { label: field.name, query: field.name, why: 'the deepest data bundle here' },
      ].filter(Boolean) as { label: string; query: string; why: string }[],
    };
  }, [index]);

  return (
    <div className="ag-welcome">
      <div className="ag-w-lead">
        <h3>What would you like to look at?</h3>
        <p>
          Name a <b>basin</b>, <b>country</b>, <b>field</b> or <b>well</b> and I will put it on the map,
          open the right surface and tell you what the catalogue holds for it.
        </p>
      </div>

      {live ? (
        <>
          <div className="ag-w-stats">
            {live.stats.map((s) => (
              <div key={s.label} className="ag-w-stat">
                <b>{fmt(s.n)}</b><span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="ag-w-chips">
            {live.chips.map((c) => (
              <button key={c.query} onClick={() => onChip(c.query)} title={c.why}>
                <span>{c.label}</span><em>{c.why}</em>
              </button>
            ))}
          </div>

          <div className="ag-w-foot">
            <div className="ag-w-line">
              <Database size={12} strokeWidth={2.2} />
              <span>{fmt(live.total)} places, loaded in this browser from {live.sources.join(', ')}.</span>
            </div>
            <div className="ag-w-line">
              {tier === 'core' && activeModel
                ? <><Cpu size={12} strokeWidth={2.2} /><span>
                    A model reads your question and picks the tool, from{' '}
                    {activeModel.ladder.length > 1
                      // The head of the ladder is the PREFERRED provider, not
                      // necessarily the one that answers — if it is rate-limited
                      // or its key is stale the next one silently takes over.
                      // Naming only the head would state as fact something this
                      // screen has no way to know. Each answer's own trace says
                      // which model actually ran.
                      ? <>{activeModel.ladder.map((p, i) => (
                          <span key={p.model}>{i > 0 && ', then '}<b>{p.model}</b></span>
                        ))}. Whichever answers is named on that answer's trace</>
                      : <><b>{activeModel.model}</b></>}
                    . It never sees a number, so it cannot restate one wrongly.
                  </span></>
                : <><CircleSlash size={12} strokeWidth={2.2} /><span>{workerConfigured
                    ? 'No model is answering right now, so questions are matched by the built-in grammar.'
                    : 'No model is configured. Questions are matched by the built-in grammar — the figures are identical either way.'}</span></>}
            </div>
            <div className="ag-w-line ag-w-honest">
              <span>Every number comes from a local file with its source attached. When something is missing I say so instead of estimating it.</span>
            </div>
          </div>
        </>
      ) : (
        <div className="ag-w-loading">Loading the catalogue…</div>
      )}
    </div>
  );
}
