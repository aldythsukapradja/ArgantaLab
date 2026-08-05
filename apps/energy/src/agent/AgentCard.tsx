// agent/AgentCard.tsx — how an AnswerCard renders (D8).
//
// Every card carries a provenance strip and every fact carries a source or a
// note. That is not decoration: the whole agent is built on the promise that a
// number you can see is a number that came from a file, and the card is where
// that promise is either kept or broken.

import { AlertTriangle, CircleHelp, Info, Layers, Search } from 'lucide-react';
import type { AnswerCard, CardChip } from './types.ts';
import './agent.css';

const KIND_ICON = {
  brief: Info,
  list: Layers,
  absence: AlertTriangle,
  clarify: CircleHelp,
  error: Search,
  menu: Layers,
} as const;

export function AgentCard({ card, onChip }: {
  card: AnswerCard;
  onChip: (chip: CardChip) => void;
}) {
  const Icon = KIND_ICON[card.kind] ?? Info;
  return (
    <div className={`agc agc-${card.kind}`}>
      <div className="agc-hd">
        <span className="agc-ico"><Icon size={13} strokeWidth={2} /></span>
        <div className="agc-title">
          <div className="agc-h1">{card.headline}</div>
          {card.subhead && <div className="agc-h2">{card.subhead}</div>}
        </div>
      </div>

      {card.body && <p className="agc-body">{card.body}</p>}

      {card.facts.length > 0 && (
        <dl className="agc-facts">
          {card.facts.map((fact, i) => (
            <div className="agc-fact" key={`${fact.label}-${i}`}>
              <dt>{fact.label}</dt>
              <dd>
                <span className="agc-val">{fact.value}</span>
                {fact.source && <span className="agc-src" title="Source">{fact.source}</span>}
                {fact.note && <span className="agc-note">{fact.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {card.chips.length > 0 && (
        <div className="agc-chips">
          {card.chips.map((chip, i) => (
            <button
              type="button"
              className="agc-chip"
              key={`${chip.query}-${i}`}
              title={chip.hint}
              onClick={() => onChip(chip)}
            >
              {chip.label}
              {typeof chip.count === 'number' && <i>{chip.count}</i>}
            </button>
          ))}
        </div>
      )}

      {card.provenance.length > 0 && (
        <div className="agc-prov">
          {card.provenance.map((source) => <span key={source}>{source}</span>)}
        </div>
      )}
    </div>
  );
}
