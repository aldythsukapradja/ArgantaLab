// DataExplorer — the Field Development workspace's first stage.
//
// It used to be "Client Data QC": a file-ingestion screen. It is now a data EXPLORER
// that opens on the field basemap — the same picture the Knowledge Bank shows, from
// the same shared scene — with the ingestion, QC and provenance screens moved behind
// a pill. You arrive looking at the field, not at a drop zone.
//
//   [ 2D | 3D ]   [ Field Manager | Audit | OSDU ]
//
// 2D/3D drive the basemap. The other three are Data QC's own views, controlled from
// here so there is one pill row rather than two.
import { useEffect, useState } from 'react';
import { Box, Map as MapIcon } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { DataQc } from '../../dataqc/DataQc';
import { ensureReferenceBundle, type BundleProgress } from '../../dataqc/ensureBundle';
import { FieldScene } from './FieldScene';
import { useScene } from './scene';

type Pane = 'map' | 'qc' | 'audit' | 'osdu';

export function DataExplorer({ field }: { field: SearchEntry }) {
  const [pane, setPane] = useState<Pane>('map');
  const [loading, setLoading] = useState<BundleProgress | null>(null);
  const view = useScene((s) => s.view);
  const setView = useScene((s) => s.setView);
  const bumpData = useScene((s) => s.bumpData);

  // The basemap is drawn FROM the ingested digests, so the reference package has to
  // load because the field is open — not because the QC screen happens to be showing.
  // Opening on the map used to mean a browser that had never visited Field Manager
  // had no horizons to drape. It resumes and is cached, so a return visit is free.
  useEffect(
    () => ensureReferenceBundle(field.id, 'field-development', setLoading, bumpData),
    [field.id, bumpData],
  );

  return (
    <div className="fds-explorer">
      <div className="fds-explorer-bar">
        <span className="fds-explorer-title">Data Explorer</span>
        <span className="fds-explorer-sub">
          {loading
            ? `Digesting ${loading.label} — ${loading.done}/${loading.total}`
            : `${field.name} · basemap, wells, surfaces and the delivery behind them`}
        </span>
        <span className="fds-explorer-spacer" />
        {/* 2D/3D belong to the basemap, so selecting one also returns you to it —
            a dimension toggle that leaves you on a table would be a dead control. */}
        <span className="fds-explorer-dims">
          <button className={pane === 'map' && view === '2d' ? 'on' : ''}
            onClick={() => { setView('2d'); setPane('map'); }} title="Basemap">
            <MapIcon size={12} /> 2D
          </button>
          <button className={pane === 'map' && view === '3d' ? 'on' : ''}
            onClick={() => { setView('3d'); setPane('map'); }} title="Structural section">
            <Box size={12} /> 3D
          </button>
        </span>
        <span className="fds-explorer-panes">
          <button className={pane === 'qc' ? 'on' : ''} onClick={() => setPane('qc')}>FIELD MANAGER</button>
          <button className={pane === 'audit' ? 'on' : ''} onClick={() => setPane('audit')}>AUDIT</button>
          <button className={pane === 'osdu' ? 'on' : ''} onClick={() => setPane('osdu')}>OSDU</button>
        </span>
      </div>
      {pane === 'map' ? (
        <FieldScene field={field} />
      ) : (
        <DataQc
          fieldId={field.id} fieldName={field.name} vertical="field-development"
          view={pane} onViewChange={setPane}
        />
      )}
    </div>
  );
}
