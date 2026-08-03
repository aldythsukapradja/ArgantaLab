// WellDeliveryWorkspace — the whole Well Delivery lifecycle surface, shaped exactly
// like the Field Development area in the shell: a `.tabs` bar + `.fd-body`
// [ explorer | canvas ]. Owns the candidate portfolio, the selected candidate and
// the active cockpit tab. Rendered by CosmoShell for nav === 'well-delivery'.
import { useEffect, useState } from 'react';
import { FileText, ClipboardList, ShieldCheck, Navigation, BookOpenCheck, ArrowRightCircle } from 'lucide-react';
import { WD_TABS } from './registry';
import type { WdCandidate } from './types';
import { loadCandidates, saveCandidate } from './wdData';
import { WellDeliveryExplorer } from './WellDeliveryExplorer';
import { WellDelivery } from './WellDelivery';
import './well-delivery.css';

const TAB_ICON: Record<string, typeof FileText> = {
  proposal: FileText, basis: ClipboardList, clearance: ShieldCheck, steering: Navigation, debrief: BookOpenCheck, handover: ArrowRightCircle,
};

export function WellDeliveryWorkspace({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const [cands, setCands] = useState<WdCandidate[]>([]);
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates().then((list) => { setCands(list); setSelId((s) => s ?? (list[0]?.id ?? null)); }).catch(() => setCands([]));
  }, []);

  const sel = cands.find((c) => c.id === selId) ?? null;
  const onChange = (c: WdCandidate) => {
    saveCandidate(c);
    setCands((list) => list.map((x) => (x.id === c.id ? c : x)));
  };

  return (
    <>
      <div className="tabs">
        {WD_TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          return (
            <div key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={t.blurb}>
              <Icon size={13} />{t.name}
            </div>
          );
        })}
      </div>
      <div className="fd-body">
        <WellDeliveryExplorer candidates={cands} selId={selId} onSelect={setSelId} />
        <div className="fd-canvas">
          <div className="fd-view">
            {sel
              ? <WellDelivery subtab={tab} candidate={sel} onChange={onChange} />
              : <div className="wd-empty">Loading Well Delivery portfolio…</div>}
          </div>
        </div>
      </div>
    </>
  );
}
