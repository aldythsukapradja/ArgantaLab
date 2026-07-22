import { useEffect, useState } from 'react';
import { CosmoApp } from './cosmo/CosmoApp';
import { useStore } from './store';
import { DOMAINS } from './nav';
import { Drawer } from './components/Drawer';
import { ContextBar } from './components/ContextBar';
import { MobileBar } from './components/MobileBar';
import { CommandPalette } from './components/CommandPalette';
import { CosmoOrbFloating, CosmoOverlay } from './components/Cosmonaut';
import { Foundation } from './tabs/Foundation';
import { DataTab } from './tabs/DataTab';
import { DataPipeline } from './tabs/DataPipeline';
import { SchemaTab } from './tabs/SchemaTab';
import { Knowledge } from './tabs/Knowledge';
import { Stub } from './tabs/Stub';
import { FieldDev } from './tabs/fielddev/FieldDev';

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 820);
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 820);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

function Surface() {
  const { domain, subtab } = useStore();
  const def = DOMAINS.find((d) => d.id === domain)!;
  if (domain === 'data') {
    if (subtab === 'inventory') return <DataTab />;
    if (subtab === 'pipeline') return <DataPipeline />;
    if (subtab === 'model') return <SchemaTab />;
    return <Foundation />; // 'overview' — the field picture (was the standalone Core/Foundation tab)
  }
  if (domain === 'knowledge') return <Knowledge />;
  if (domain === 'fielddev') return <FieldDev subtab={subtab} />;
  return <Stub def={def} />; // Core, verticals, insight/reasoning, foundation — placeholders for now
}

export function App() {
  const isMobile = useIsMobile();

  // dual-UI: ?ui=cosmo renders the migrated COSMO shell (ArgantaEnergy-Cosmo.bat);
  // anything else keeps the classic UI. Both coexist until the migration completes.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ui') === 'cosmo') {
    return <CosmoApp />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {!isMobile && <Drawer />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ContextBar mobile={isMobile} />
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
          <Surface />
        </main>
        {isMobile && <MobileBar />}
      </div>
      <CommandPalette />
      <CosmoOrbFloating isMobile={isMobile} />
      <CosmoOverlay isMobile={isMobile} />
    </div>
  );
}
