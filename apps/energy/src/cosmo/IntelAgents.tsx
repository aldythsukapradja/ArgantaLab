// IntelAgents (Intelligence → Agents) — the agent directory. One card per lifecycle agent,
// Copilot-Studio-style: avatar, name, status pill, one-line purpose, primary action. Reads
// from the shared agents.ts registry so this list can never drift from the Cockpit's own
// quick-launch strip.
import { Bot, ArrowUpRight } from 'lucide-react';
import { AGENTS } from './agents';
import './intel-agents.css';

export function IntelAgents({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="iag">
      <div className="iag-bar">
        <div className="iag-title">
          <span className="iag-ic"><Bot size={15} /></span>
          <b>Agents</b>
          <span className="iag-sub">{AGENTS.length} lifecycle agents · spatial evidence to accountable decision</span>
        </div>
      </div>

      <div className="iag-body">
        <div className="iag-grid">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              className="iag-card"
              style={{ '--agent': agent.color } as React.CSSProperties}
              onClick={() => onNavigate(agent.id)}
            >
              <div className="iag-card-head">
                <span className="iag-card-icon"><agent.icon size={20} /></span>
                <span className="iag-card-name">
                  <b>{agent.name}</b>
                  <small>{agent.short} AGENT</small>
                </span>
                <em className={'iag-status iag-status-' + agent.state.toLowerCase()}>{agent.state}</em>
              </div>
              <p className="iag-card-copy">{agent.generic}</p>
              <p className="iag-card-proof"><b>On Volve —</b> {agent.proof}</p>
              <span className="iag-card-action">Open workspace <ArrowUpRight size={13} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
