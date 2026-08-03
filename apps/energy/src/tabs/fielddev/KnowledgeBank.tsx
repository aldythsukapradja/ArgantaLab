import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, CircleDashed, Database, Layers3, Library, MapPinned } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { KnowledgeMap } from './KnowledgeMap';
import {
  formatFieldObservation, loadKnowledgeContext, sourceRecordCount, volveVolumes, type KnowledgeContext,
} from './field-knowledge';

const reported = (value: unknown) => value == null || value === '' ? 'Not reported' : String(value);

function SourceCard({ name, kind, value, linked, note }: { name: string; kind: string; value: string; linked: boolean; note: string }) {
  return (
    <article className={'fds-source-card' + (linked ? ' linked' : '')}>
      <div className="fds-source-icon">{linked ? <CircleCheck size={14} /> : <CircleDashed size={14} />}</div>
      <div><span>{kind}</span><b>{name}</b><small>{note}</small></div>
      <strong>{value}</strong>
    </article>
  );
}

export function KnowledgeBank({ field }: { field: SearchEntry }) {
  const [context, setContext] = useState<KnowledgeContext | null>(null);
  useEffect(() => {
    let alive = true;
    setContext(null);
    loadKnowledgeContext(field).then((value) => { if (alive) setContext(value); });
    return () => { alive = false; };
  }, [field]);

  const values = useMemo(() => {
    if (!context) return [];
    if (context.isVolve) return volveVolumes();
    return (context.detail?.reserves ?? []).slice(0, 4).map(formatFieldObservation);
  }, [context]);
  const gogetLinked = field.source === 'GOGET' || Boolean(context?.detail?.enrichedFrom?.includes('GOGET'));
  const usgsLinked = Boolean(context?.province || context?.au);
  const au = context?.au;

  return (
    <section className="fds-kb-dashboard" aria-label={`${field.name} Knowledge Bank`}>
      <section className="fds-kb-map-panel">
        <div className="fds-kb-section-title"><MapPinned size={14} /><span>Location</span></div>
        <KnowledgeMap field={field} context={context} />
        <div className="fds-location-meta">
          <div><span>Country / area</span><b>{field.parent === 'NO' ? 'Norway' : reported(field.parent)}</b></div>
          <div><span>Setting</span><b>{reported(context?.detail?.onshoreOffshore)}</b></div>
        </div>
      </section>

      <section className="fds-kb-hierarchy-panel">
        <div className="fds-kb-section-title"><Layers3 size={14} /><span>Geological alignment</span><em>OSDU master-data spine</em></div>
        <div className="fds-hierarchy">
          {(context?.hierarchy ?? Array.from({ length: 5 }, (_, i) => ({ label: ['Basin / province', 'Petroleum system', 'Assessment unit', 'Field', 'Formation / reservoir'][i], value: 'Resolving…', source: '—' }))).map((node, index) => (
            <div className={'fds-hierarchy-node' + (node.value === 'Not linked' ? ' empty' : '')} key={node.label}>
              <span>{node.label}</span><b>{node.value}</b><small>{node.source}</small>{index < 4 && <i>›</i>}
            </div>
          ))}
        </div>
        <div className="fds-field-facts">
          <div><span>Status</span><b>{reported(context?.detail?.status)}</b></div>
          <div><span>Discovered</span><b>{reported(context?.detail?.discoveryYear ?? (context?.isVolve ? 1993 : null))}</b></div>
          <div><span>Operator</span><b>{reported(context?.detail?.operator ?? (context?.isVolve ? 'Equinor Energy AS' : null))}</b></div>
          <div><span>Hydrocarbon</span><b>{reported(context?.detail?.fuelType ?? (context?.isVolve ? 'Oil & gas' : null))}</b></div>
        </div>
      </section>

      <section className="fds-kb-value-panel">
        <div className="fds-kb-section-title"><Database size={14} /><span>Resource view</span><em>field units</em></div>
        <div className="fds-kb-values">
          {values.length ? values.map((item) => (
            <div className="fds-kb-value" key={`${item.label}-${item.value}`}><span>{item.label}</span><b>{item.value}</b><small>{item.meta}</small></div>
          )) : <div className="fds-kb-no-value"><b>No field volume reported</b><span>GOGET master data is linked; add client volumetrics to populate STOIIP / GIIP.</span></div>}
        </div>
        {au && <div className="fds-usgs-endowment">
          <span>USGS AU undiscovered mean · regional, not field reserves</span>
          <div><b>{au.oilMean == null ? '—' : `${au.oilMean.toLocaleString()} MMSTB`}</b><b>{au.gasMean == null ? '—' : `${au.gasMean.toLocaleString()} BSCF`}</b></div>
        </div>}
      </section>

      <section className="fds-kb-sources-panel">
        <div className="fds-kb-section-title"><Library size={14} /><span>Aligned evidence</span><em>{context?.osdu?.standard ?? 'OSDU R3'} · {context?.osdu?.dataDefinitions?.release ?? 'loading'}</em></div>
        <div className="fds-source-grid">
          <SourceCard name="GOGET" kind="Field spine" linked={gogetLinked} value="6,999 spatial fields" note={`${(sourceRecordCount(context, 'GOGET') ?? 8032).toLocaleString()} OSDU records · lifecycle · reserves/production`} />
          <SourceCard name="USGS" kind="Geologic context" linked={usgsLinked} value={`${context?.worldCounts?.provinces ?? 179} provinces · ${context?.worldCounts?.aus ?? 340} AUs`} note={`${sourceRecordCount(context, 'USGS') ?? 698} OSDU records · province → TPS → assessment unit`} />
          <SourceCard name="AAPG framework" kind="Knowledge alignment" linked={Boolean(context)} value="literature" note="basin-cycle and play-development interpretation; no field catalogue" />
          <SourceCard name={context?.isVolve ? 'Volve showcase' : 'Client field slot'} kind="Deep-dive extension" linked={Boolean(context?.isVolve)} value={context?.isVolve ? `${sourceRecordCount(context, 'Volve') ?? 105} records` : 'ready'} note={context?.isVolve ? 'Sodir + Equinor models, wells and production' : 'client data follows the same OSDU field spine'} />
        </div>
      </section>
    </section>
  );
}
