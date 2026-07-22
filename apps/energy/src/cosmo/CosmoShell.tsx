// CosmoShell (?ui=cosmo&build=1) — the progressive React rebuild of the COSMO shell,
// rendered with the founder's EXACT styles (cosmo-system.css, extracted verbatim +
// scoped; animations kept global → byte-identical). Same classes, same Lucide icons,
// same Inter/JetBrains type → 1:1 with the iframe reference (?ui=cosmo). We grow this
// region by region; today: sidebar + topbar + tabs (1:1) with the REAL, truth-locked
// Field Development viewers in the body. Un-migrated lifecycles show a placeholder.
import { useEffect, useState } from 'react';
import {
  Compass, Layers, Wrench, Gauge, CalendarClock, LayoutGrid, GraduationCap, Sparkles,
  Bot, BookOpen, Database, Search, Bell, Plus, Map as MapIcon, Activity, Columns3,
  Grid3x3, Boxes, Waves, Box, LineChart, DollarSign, ClipboardCheck,
} from 'lucide-react';
import './cosmo-system.css';
import { FieldDev } from '../tabs/fielddev/FieldDev';

const LIFECYCLES = [
  { id: 'exploration', name: 'Exploration', icon: Compass, color: '#22d3ee', status: 'BETA' },
  { id: 'field-development', name: 'Field Development', icon: Layers, color: '#0FB5A6', status: 'LIVE' },
  { id: 'well-delivery', name: 'Well Delivery', icon: Wrench, color: '#f59e0b', status: 'BETA' },
  { id: 'reservoir-management', name: 'Reservoir Management', icon: Gauge, color: '#7c3aed', status: 'LIVE' },
  { id: 'drilling-sequence', name: 'Drilling Sequence', icon: CalendarClock, color: '#e11d74', status: 'BETA' },
];
const INTEL = [
  { id: 'insights', name: 'Insights', icon: Sparkles },
  { id: 'agents', name: 'Agents', icon: Bot },
  { id: 'knowledge', name: 'Knowledge', icon: BookOpen },
  { id: 'data', name: 'Data', icon: Database },
];
// Field Development tabs → our real, built subtabs
const FD_TABS = [
  { id: 'map', label: 'Map', icon: MapIcon }, { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'petrophysics', label: 'Petrophysics', icon: Gauge }, { id: 'correlation', label: 'Correlation', icon: Columns3 },
  { id: 'structural', label: 'Structural', icon: Layers }, { id: 'property', label: 'Property', icon: Grid3x3 },
  { id: 'gridmodel', label: 'Static Model', icon: Boxes }, { id: 'simulation', label: 'Simulation', icon: Waves },
  { id: 'volumetrics', label: 'Volumetrics', icon: Box }, { id: 'uncertainty', label: 'Uncertainty', icon: Sparkles },
  { id: 'forecast', label: 'Forecast', icon: LineChart }, { id: 'economics', label: 'Economics', icon: DollarSign },
  { id: 'review', label: 'Field Review', icon: ClipboardCheck },
];
const TIERS = ['DET', 'SOV', 'FRO'];

export function CosmoShell() {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    html.setAttribute('data-ui', 'cosmo');
    html.removeAttribute('data-theme');
    return () => { html.removeAttribute('data-ui'); if (prevTheme) html.setAttribute('data-theme', prevTheme); };
  }, []);
  const [lc, setLc] = useState('field-development');
  const [tab, setTab] = useState('map');
  const [tier, setTier] = useState('DET');
  const active = LIFECYCLES.find((l) => l.id === lc);
  const isFD = lc === 'field-development';

  const navItem = (item: { id: string; name: string; icon: typeof Compass; color?: string; status?: string }, on: boolean, onClick: () => void) => (
    <div key={item.id} className={'navitem' + (on ? ' active' : '')} onClick={onClick}>
      <span className="d" style={on && item.color ? undefined : undefined}><item.icon size={13} /></span>
      <span className="lbl">{item.name}</span>
      {item.status && <span className={'st st-' + item.status}>{item.status}</span>}
    </div>
  );

  return (
    <div className="app">
      {/* sidebar (1:1 COSMO) */}
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">Æ</div>
          <div><div className="bt">ArgantaEnergy</div></div>
          <div className="bs">COSMO</div>
        </div>
        <div className="nav">
          <div className="navlabel">COMMAND</div>
          {navItem({ id: 'cockpit', name: 'Cockpit', icon: LayoutGrid }, lc === 'cockpit', () => setLc('cockpit'))}
          <div className="navlabel">LIFECYCLES</div>
          {LIFECYCLES.map((l) => navItem(l, lc === l.id, () => { setLc(l.id); setTab('map'); }))}
          <div className="navlabel">INTELLIGENCE</div>
          {INTEL.map((n) => navItem(n, lc === n.id, () => setLc(n.id)))}
          <div className="navlabel">FOUNDATION</div>
          {navItem({ id: 'foundation', name: 'Foundation', icon: GraduationCap }, lc === 'foundation', () => setLc('foundation'))}
        </div>
        {/* sovereign tier bar (1:1) */}
        <div className="sov">
          <div className="h">SOVEREIGN TIER</div>
          <div className="bar">
            {TIERS.map((t) => <div key={t} className={'t' + (tier === t ? ' on' : '')} onClick={() => setTier(t)}>{t}</div>)}
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="main" style={{ gridRow: '1 / 4', gridColumn: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="topbar">
          <div className="crumbs">
            <span>ArgantaEnergy</span><span className="sep">/</span>
            <span className="cur">{active ? active.name : 'Cockpit'}</span>
            {isFD && <><span className="sep">/</span><span className="cur">{FD_TABS.find((t) => t.id === tab)?.label}</span></>}
          </div>
          <div className="tr">
            <span className="tbadge"><span className="dot" /> Volve · North Sea</span>
            <button className="ibtn"><Search size={15} /></button>
            <button className="ibtn"><Bell size={15} /></button>
            <button className="newbtn"><Plus size={13} style={{ verticalAlign: '-2px' }} /> New</button>
            <div className="avatar">A</div>
          </div>
        </div>

        {isFD ? (
          <>
            <div className="tabs">
              {FD_TABS.map((t) => (
                <div key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <t.icon size={13} />{t.label}
                </div>
              ))}
            </div>
            <div className="content noscroll" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><FieldDev subtab={tab} /></div>
            </div>
          </>
        ) : (
          <div className="content">
            <div className="ph" style={{ height: '100%' }}>
              <div className="phi">{active ? <active.icon size={24} /> : <LayoutGrid size={24} />}</div>
              <div className="pht">{active ? active.name : 'Cockpit'} — migrating to COSMO</div>
              <div className="phs">Field Development is the first live lifecycle on the COSMO rebuild. This surface still lives in the reference shell (open <b>?ui=cosmo</b>); it comes online as we migrate region by region.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
