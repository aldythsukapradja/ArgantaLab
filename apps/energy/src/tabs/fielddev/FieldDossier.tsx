import { useEffect, useMemo, useState } from 'react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { loadFieldDetail, type FieldDetail, type ObservationRow } from '../../cosmo/cockpit-field-detail';
import { formatFieldObservation, volveVolumes } from './field-knowledge';

const base = import.meta.env.BASE_URL || '/';
const reported = (value: unknown) => value == null || value === '' ? 'Not reported' : String(value);

type VolveValidation = {
  stoiip?: { stoiipMMSm3?: number; method?: string };
};

function latestByProduct(rows: ObservationRow[]): ObservationRow[] {
  const latest = new Map<string, ObservationRow>();
  for (const row of rows) {
    const key = row.product.toLowerCase();
    const previous = latest.get(key);
    if (!previous || (row.year ?? -Infinity) > (previous.year ?? -Infinity)) latest.set(key, row);
  }
  const priority = (product: string) => {
    const value = product.toLowerCase();
    if (value === 'oil') return 0;
    if (value.includes('gas')) return 1;
    if (value.includes('condensate')) return 2;
    if (value.includes('ngl')) return 3;
    return 4;
  };
  return [...latest.values()].sort((a, b) => priority(a.product) - priority(b.product) || a.product.localeCompare(b.product));
}

export function FieldDossier({ field }: { field: SearchEntry }) {
  const [detail, setDetail] = useState<FieldDetail | null | undefined>(undefined);
  const [volveValidation, setVolveValidation] = useState<VolveValidation | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    loadFieldDetail(field.id).then((value) => { if (alive) setDetail(value); });
    if (field.name.toUpperCase() === 'VOLVE') {
      fetch(`${base}wb/index.json`).then((response) => response.ok ? response.json() : null)
        .then((value) => { if (alive) setVolveValidation(value?.validation ?? null); })
        .catch(() => { if (alive) setVolveValidation(null); });
    } else {
      setVolveValidation(null);
    }
    return () => { alive = false; };
  }, [field.id, field.name]);

  const reserves = useMemo(() => detail ? latestByProduct(detail.reserves).slice(0, 2) : [], [detail]);
  const isVolve = field.name.toUpperCase() === 'VOLVE';
  const resourceText = reserves.length
    ? reserves.map((row) => { const item = formatFieldObservation(row); return `${item.label} ${item.value} (${item.meta})`; }).join(' · ')
    : volveValidation?.stoiip?.stoiipMMSm3 != null
      ? `${volveVolumes()[0].label} ${volveVolumes()[0].value} · screening upper bound`
      : 'Not reported at catalogue tier';
  const setting = [detail?.onshoreOffshore, detail?.fuelType].filter(Boolean).join(' · ') || 'Not reported';

  return (
    <section className="fds-dossier" aria-label={`${field.name} field dossier`}>
      <div className="fds-dossier-title">
        <span>Field dossier</span>
        <b>{field.name}</b>
      </div>
      {/* Three facts only — status, operator and resources. Discovery year and
          setting live in the Knowledge Bank dossier; the header is a strip, not a
          record, and the space it gave back goes to the canvas. */}
      <div className="fds-dossier-fact"><span>Status</span><b>{detail === undefined ? 'Loading…' : reported(detail?.status ?? (isVolve ? 'Shut down' : null))}</b></div>
      <div className="fds-dossier-fact" title={`Discovered ${reported(detail?.discoveryYear ?? (isVolve ? 1993 : null))} · ${isVolve && setting === 'Not reported' ? 'Offshore · oil & gas' : setting}`}><span>Operator</span><b>{detail === undefined ? 'Loading…' : reported(detail?.operator ?? (isVolve ? 'Equinor Energy AS' : null))}</b></div>
      <div className="fds-dossier-fact resources" title={volveValidation?.stoiip?.method ?? resourceText}>
        <span>Resources / in-place</span><b>{detail === undefined ? 'Loading…' : resourceText}</b>
      </div>
    </section>
  );
}
