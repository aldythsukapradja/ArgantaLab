import { useStore } from '../store';
import { Explorer } from './knowledge/Explorer';
import { Graph } from './knowledge/Graph';
import { Extraction } from './knowledge/Extraction';

// Knowledge surface router — sub-tab decides the pane (explorer · graph · extraction).
export function Knowledge() {
  const { subtab } = useStore();
  if (subtab === 'graph') return <Graph />;
  if (subtab === 'extraction') return <Extraction />;
  return <Explorer />;
}
