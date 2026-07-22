// shared.tsx — small presentational helpers reused across the Well Delivery
// cockpits (tab header, CVP gate track, formatters). Classic control-room tokens.
import type { ReactNode } from 'react';
import { NatureBadge, type DataNature } from '../../components/Provenance';
import { GATES, gateIndex, type Gate } from './types';
import type { WdTab } from './registry';

export const roleColor = (r: 'producer' | 'injector') => (r === 'producer' ? 'var(--amber)' : 'var(--blue)');
export const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}MM` : `$${(v / 1e3).toFixed(0)}k`);

export function GateTrack({ current }: { current: Gate }) {
  const ci = gateIndex(current);
  return (
    <div className="wd-gates">
      {GATES.map((g, i) => (
        <div key={g.id} className={'wd-gate' + (g.id === current ? ' on' : i < ci ? ' done' : '')} title={g.blurb}>
          <div className="g-dg">{g.dg}</div>
          <div className="g-name">{g.label}</div>
        </div>
      ))}
    </div>
  );
}

export function WdHead({ tab, well, nature = 'scenario', gate, right }: {
  tab: WdTab; well: string; nature?: DataNature; gate?: Gate; right?: ReactNode;
}) {
  return (
    <div className="wd-head">
      <div className="wd-h-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wd-eyebrow">{tab.eyebrow}</div>
          <div className="wd-title">{tab.name} · {well}</div>
        </div>
        <NatureBadge nature={nature} />
        {right}
      </div>
      <div className="wd-blurb">{tab.detail}</div>
      {gate && <GateTrack current={gate} />}
    </div>
  );
}

/** Honest "gate not reached yet" body — mirrors FieldDev's placeholder ethic. */
export function GateLocked({ what, gate }: { what: string; gate: string }) {
  return (
    <div className="wd-empty">
      <div>
        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{what}</div>
        <div>This becomes available once the candidate reaches the <b style={{ color: 'var(--teal)' }}>{gate}</b> gate.</div>
      </div>
    </div>
  );
}
