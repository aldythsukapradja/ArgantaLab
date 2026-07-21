import { useStore } from './store';
import { DOMAINS } from './nav';
import { ActivityRail } from './components/ActivityRail';
import { ContextBar } from './components/ContextBar';
import { TabBar } from './components/TabBar';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { Foundation } from './tabs/Foundation';
import { DataTab } from './tabs/DataTab';
import { SchemaTab } from './tabs/SchemaTab';
import { Knowledge } from './tabs/Knowledge';
import { Stub } from './tabs/Stub';

export function App() {
  const { domain } = useStore();
  const def = DOMAINS.find((d) => d.id === domain)!;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <ActivityRail />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ContextBar />
        <TabBar />
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
          {domain === 'foundation' && <Foundation />}
          {domain === 'data' && <DataTab />}
          {domain === 'schema' && <SchemaTab />}
          {domain === 'knowledge' && <Knowledge />}
          {def.status === 'stub' && <Stub def={def} />}
        </main>
        <StatusBar />
      </div>
      <CommandPalette />
    </div>
  );
}
