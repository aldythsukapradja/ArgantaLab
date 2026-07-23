// WellDeliveryHome — well picker + saved-proposal list for the Well Delivery
// lifecycle. "New Proposal" drafts a WellProposal from real wb data (index.json/
// traj/picks) via proposal-data.ts; clicking a card opens the one-pager.
import { useEffect, useState } from 'react';
import { Plus, Drill } from 'lucide-react';
import { loadIndex } from '../../wb/load';
import type { WellRow } from '../../wb/types';
import type { WellProposal } from './proposal-types';
import { listProposals, saveProposal } from './proposal-store';
import { draftProposalForWell } from './proposal-data';
import { GATE_LABEL } from './proposal-types';
import { WellProposalOnePager } from './WellProposalOnePager';
import './well-delivery.css';

export function WellDeliveryHome() {
  const [wells, setWells] = useState<WellRow[]>([]);
  const [proposals, setProposals] = useState<WellProposal[]>([]);
  const [pickWell, setPickWell] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadIndex().then((idx) => {
      setWells(idx.wells);
      if (idx.wells.length) setPickWell(idx.wells[0].name);
    });
    setProposals(listProposals());
  }, []);

  const refresh = () => setProposals(listProposals());

  const newProposal = async () => {
    if (!pickWell) return;
    setBusy(true);
    try {
      const draft = await draftProposalForWell(pickWell);
      saveProposal(draft);
      refresh();
      setOpenId(draft.id);
    } finally { setBusy(false); }
  };

  const open = proposals.find((p) => p.id === openId);
  if (open) {
    return <WellProposalOnePager proposal={open} onBack={() => { setOpenId(null); refresh(); }} />;
  }

  return (
    <div className="wd-home">
      <div className="wd-toolbar">
        <select value={pickWell} onChange={(e) => setPickWell(e.target.value)}>
          {wells.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
        </select>
        <button className="wbtn" onClick={newProposal} disabled={busy || !pickWell}>
          <Plus size={12} /> {busy ? 'Drafting…' : 'New Proposal'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink3)' }}>{proposals.length} proposal{proposals.length === 1 ? '' : 's'}</div>
      </div>

      {proposals.length === 0 ? (
        <div className="wd-empty"><Drill size={22} style={{ marginBottom: 8, opacity: .5 }} /><div>No drilling proposals yet — pick a well above and create one.</div></div>
      ) : (
        <div className="wd-list">
          {proposals.map((p) => (
            <div className="wd-card" key={p.id} onClick={() => setOpenId(p.id)}>
              <div className="wdc-well">{p.well}</div>
              <div className="wdc-gate">{GATE_LABEL[p.gate]}</div>
              <div className="wdc-meta">TD {p.trajectory.tdMd.toFixed(0)} m MD · updated {new Date(p.updatedAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
