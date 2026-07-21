import data from '../data/data.json';
import foundation from '../data/foundation.json';
import { useStore } from '../store';

export function StatusBar() {
  const { domain, subtab } = useStore();
  return (
    <footer
      className="mono"
      style={{
        height: 'var(--statusbar-h)', flex: '0 0 var(--statusbar-h)', background: 'var(--panel)',
        borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 12px', fontSize: 10.5, color: 'var(--muted)', overflowX: 'auto', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--teal)' }}>● AUDIT OK</span>
      <span>mirror {data.mirror.files} files · {data.mirror.gb} GB · sha256 ✓ {data.mirror.verified}/{data.mirror.files}</span>
      <span>failures {data.mirror.failures}</span>
      <span>route /{domain}/{subtab}</span>
      <div style={{ flex: 1 }} />
      <span>src data-energy/processed · manifest</span>
      <span>© Equinor · Volve · Open Data Licence</span>
      <span style={{ color: 'var(--muted)' }}>built {foundation.generatedAt.slice(0, 10)}</span>
    </footer>
  );
}
