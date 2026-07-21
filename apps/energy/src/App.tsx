import { useEffect, useState } from 'react';
import { useStore } from './store';
import { DOMAINS } from './nav';
import { Drawer } from './components/Drawer';
import { ContextBar } from './components/ContextBar';
import { MobileBar } from './components/MobileBar';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { CosmoOrbFloating, CosmoOverlay } from './components/Cosmonaut';
import { Foundation } from './tabs/Foundation';
import { DataTab } from './tabs/DataTab';
import { DataPipeline } from './tabs/DataPipeline';
import { SchemaTab } from './tabs/SchemaTab';
import { Knowledge } from './tabs/Knowledge';
import { Stub } from './tabs/Stub';

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
  return <Stub def={def} />; // Core, verticals, insight/reasoning, foundation — placeholders for now
}

export function App() {
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {!isMobile && <Drawer />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ContextBar mobile={isMobile} />
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
          <Surface />
        </main>
        {!isMobile && <StatusBar />}
        {isMobile && <MobileBar />}
      </div>
      <CommandPalette />
      <CosmoOrbFloating isMobile={isMobile} />
      <CosmoOverlay isMobile={isMobile} />
    </div>
  );
}
