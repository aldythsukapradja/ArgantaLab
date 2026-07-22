// CosmoApp (U0+G1) — the migrated COSMO shell. Reached via ?ui=cosmo. Renders the
// COSMO design (light-first, teal, sidebar/topbar/icon-tabs) with the Petrel
// 3-zone Field Development body: [ explorer | canvas(reused viewer + its inspector) ].
// The built Field-Dev engines are reused unchanged — they re-theme to COSMO via the
// alias-bridge tokens in cosmo.css. Classic UI is untouched (App.tsx routes here).
import { useEffect, useState } from 'react';
import {
  Wrench, Compass, Truck, Waves as WavesI, Search, Bell, Map as MapIcon, Activity, Gauge,
  Columns3, Layers, Grid3x3, Boxes, Box, Sparkles, LineChart, DollarSign, ClipboardCheck,
} from 'lucide-react';
import './cosmo.css';
import { FieldDev } from '../tabs/fielddev/FieldDev';
import { CosmoExplorer } from './CosmoExplorer';

type TabDef = { id: string; label: string; icon: typeof MapIcon };
const TABS: TabDef[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'petrophysics', label: 'Petrophysics', icon: Gauge },
  { id: 'correlation', label: 'Correlation', icon: Columns3 },
  { id: 'structural', label: 'Structural', icon: Layers },
  { id: 'property', label: 'Property', icon: Grid3x3 },
  { id: 'gridmodel', label: 'Static Model', icon: Boxes },
  { id: 'simulation', label: 'Simulation', icon: WavesI },
  { id: 'volumetrics', label: 'Volumetrics', icon: Box },
  { id: 'uncertainty', label: 'Uncertainty', icon: Sparkles },
  { id: 'forecast', label: 'Forecast', icon: LineChart },
  { id: 'economics', label: 'Economics', icon: DollarSign },
  { id: 'review', label: 'Field Review', icon: ClipboardCheck },
];

const NAV = [
  { id: 'exploration', label: 'Exploration', icon: Compass, status: 'plan' as const },
  { id: 'fielddev', label: 'Field Development', icon: Wrench, status: 'live' as const },
  { id: 'welldelivery', label: 'Well Delivery', icon: Truck, status: 'plan' as const },
  { id: 'resmgmt', label: 'Reservoir Mgmt', icon: WavesI, status: 'plan' as const },
];

export function CosmoApp() {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    html.setAttribute('data-ui', 'cosmo');
    html.removeAttribute('data-theme');   // let COSMO light tokens win over :root[data-theme]
    return () => { html.removeAttribute('data-ui'); if (prevTheme) html.setAttribute('data-theme', prevTheme); };
  }, []);
  const [tab, setTab] = useState('map');
  const [nav, setNav] = useState('fielddev');
  const [sel, setSel] = useState<{ folder: string; id: string } | null>(null);
  const tabDef = TABS.find((t) => t.id === tab)!;

  return (
    <div className="cx-app">
      {/* sidebar */}
      <aside className="cx-side">
        <div className="cx-brand">
          <div className="cx-mark">Æ</div>
          <div className="cx-bt">ArgantaEnergy</div>
          <div className="cx-bs">COSMO</div>
        </div>
        <nav className="cx-nav">
          <div className="cx-navlabel">VERTICALS</div>
          {NAV.map((n) => (
            <div key={n.id} className={'cx-navitem' + (nav === n.id ? ' on' : '')} onClick={() => setNav(n.id)}>
              <span className="d"><n.icon size={13} /></span>
              <span className="lbl">{n.label}</span>
              <span className={'cx-st ' + n.status}>{n.status === 'live' ? 'LIVE' : 'PLAN'}</span>
            </div>
          ))}
          <div className="cx-navlabel">INTELLIGENCE</div>
          <div className="cx-navitem"><span className="d"><Sparkles size={13} /></span><span className="lbl">Data · Knowledge</span></div>
        </nav>
      </aside>

      {/* main */}
      <div className="cx-main">
        <header className="cx-top">
          <div className="cx-crumbs">
            <span>ArgantaEnergy</span><span className="sep">/</span>
            <span>Field Development</span><span className="sep">/</span>
            <span className="cur">{tabDef.label}</span>
          </div>
          <div className="cx-tr">
            <span className="cx-badge"><span className="dot" /> Volve · North Sea</span>
            <button className="cx-ibtn" title="Search"><Search size={15} /></button>
            <button className="cx-ibtn" title="Notifications"><Bell size={15} /></button>
            <div className="cx-avatar">A</div>
          </div>
        </header>

        {nav === 'fielddev' ? (
          <>
            <div className="cx-tabs">
              {TABS.map((t) => (
                <div key={t.id} className={'cx-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
                  <t.icon size={14} />{t.label}
                </div>
              ))}
            </div>
            <div className="cx-body">
              <CosmoExplorer sel={sel} setSel={setSel} />
              <div className="cx-canvas">
                <div className="cx-viewer"><FieldDev subtab={tab} /></div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink3)', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{NAV.find((n) => n.id === nav)?.label}</div>
              Coming in a later migration phase — Field Development is the first vertical on COSMO.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
