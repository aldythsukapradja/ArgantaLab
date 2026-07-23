// CockpitDossier — Stream E: the §7-8 lifecycle field dossier. Replaces the flat key/value
// inspector for Field selections with a compact lifecycle dossier: header badges → primary
// facts → exploration/development/production/reserve context → lifecycle timeline → actions.
// Fetches its own dossier detail lazily (cockpit-field-detail.ts) so the map's render-critical
// payload stays light. Every field is real or explicitly "Not reported" — never a fabricated 0.
import { useEffect, useState } from 'react';
import {
  X, Droplet, Flame, MapPin, Compass, Layers3, GitCompare, FileSearch,
} from 'lucide-react';
import type { CockpitSelection } from './CockpitMap';
import { loadFieldDetail, type FieldDetail, type ObservationRow } from './cockpit-field-detail';

type Props = { selection: CockpitSelection; onClose: () => void; onNavigate: (id: string) => void };

const NR = 'Not reported';
const str = (v: unknown): string => (v == null || v === '' ? NR : String(v));
const num = (v: number | null, unit?: string | null): string => (v == null ? NR : `${v.toLocaleString()}${unit ? ` ${unit}` : ''}`);
const yr = (v: unknown): string => (v == null || v === '' ? NR : String(v));

function findProduct(rows: ObservationRow[], product: string): ObservationRow | undefined {
  return rows.find((r) => r.product.toLowerCase() === product);
}

function ProductStat({ icon, label, row }: { icon: React.ReactNode; label: string; row?: ObservationRow }) {
  return (
    <div className="aeck-dstat">
      <span className="aeck-dstat-ic">{icon}</span>
      <div>
        <small>{label}</small>
        <b>{row ? num(row.valueConverted ?? row.value, row.unitConverted ?? row.unit) : NR}</b>
        {row?.year && <em>{row.year}</em>}
      </div>
    </div>
  );
}

function Timeline({ d }: { d: FieldDetail }) {
  const steps = [
    { label: 'Discovery', year: d.discoveryYear },
    { label: 'FID', year: d.fidYear },
    { label: 'First production', year: d.productionStartYear },
    { label: 'Latest report', year: [...d.production, ...d.reserves].reduce((max, r) => (r.year && (!max || r.year > max) ? r.year : max), null as number | null) },
  ];
  const known = steps.filter((s) => s.year != null && s.year !== '');
  if (!known.length) return null;
  return (
    <div className="aeck-dtimeline" aria-label="Field lifecycle timeline">
      {steps.map((s, i) => (
        <div key={s.label} className={'aeck-dtime-step' + (s.year != null && s.year !== '' ? ' on' : '')}>
          <span className="aeck-dtime-dot" />
          <small>{s.label}</small>
          <b>{yr(s.year)}</b>
          {i < steps.length - 1 && <span className="aeck-dtime-line" />}
        </div>
      ))}
    </div>
  );
}

export function CockpitDossier({ selection, onClose, onNavigate }: Props) {
  const [detail, setDetail] = useState<FieldDetail | null | undefined>(undefined);
  const p = selection.raw ?? {};

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    loadFieldDetail(selection.id).then((d) => { if (alive) setDetail(d); });
    return () => { alive = false; };
  }, [selection.id]);

  const loading = detail === undefined;
  const d = detail ?? null;
  const status = str(d?.status ?? p.status);
  const fuel = str(d?.fuelType);
  const shore = str(d?.onshoreOffshore);
  const accuracy = str(d?.accuracy ?? p.accuracy);
  const country = str(p.country);
  const basin = str(d?.basin || p.basin);
  const sources = Array.isArray(p.sources) ? (p.sources as string[]) : [];
  const aliasCount = Array.isArray(p.aliases) ? (p.aliases as string[]).length : 0;

  const oilProd = d ? findProduct(d.production, 'oil') : undefined;
  const gasProd = d ? findProduct(d.production, 'gas') : undefined;
  const oilRes = d ? findProduct(d.reserves, 'oil') : undefined;
  const gasRes = d ? findProduct(d.reserves, 'gas') : undefined;
  const condensate = d ? (findProduct(d.production, 'condensate') ?? findProduct(d.reserves, 'condensate')) : undefined;
  const ngl = d ? (findProduct(d.production, 'ngl') ?? findProduct(d.reserves, 'ngl')) : undefined;

  return (
    <aside className="aeck-context aeck-inspector aeck-dossier" aria-label={`${selection.name} field dossier`}>
      <button className="aeck-inspector-close" onClick={onClose} aria-label="Close field dossier"><X size={14} /></button>

      <div className="aeck-dbadges">
        <span className="aeck-dbadge type">{selection.type.toUpperCase()}</span>
        {status !== NR && <span className="aeck-dbadge status">{status.toUpperCase()}</span>}
        {fuel !== NR && <span className="aeck-dbadge">{fuel.toUpperCase()}</span>}
        {shore !== NR && <span className="aeck-dbadge">{shore.toUpperCase()}</span>}
        <span className="aeck-dbadge accuracy">{accuracy.toUpperCase()}</span>
      </div>

      <h1>{selection.name}</h1>
      <p>{country}{basin !== NR ? ` · ${basin}` : ''} <span className="aeck-dsource">{selection.source}</span></p>
      {aliasCount > 0 && (
        <p className="aeck-dalias">Also reported in {sources.filter((s) => s !== selection.source).join(', ') || `${aliasCount} other source(s)`} — same field, cross-source identity resolved.</p>
      )}

      {loading ? (
        <div className="aeck-dloading">Loading field context…</div>
      ) : (
        <>
          <div className="aeck-dstats">
            <ProductStat icon={<Droplet size={13} />} label="Oil · latest production" row={oilProd} />
            <ProductStat icon={<Flame size={13} />} label="Gas · latest production" row={gasProd} />
            <ProductStat icon={<Droplet size={13} />} label="Oil · reported reserves" row={oilRes} />
            <ProductStat icon={<Flame size={13} />} label="Gas · reported reserves" row={gasRes} />
          </div>
          {(condensate || ngl) && (
            <div className="aeck-dsplit">
              {condensate && <span>Condensate {num(condensate.valueConverted ?? condensate.value, condensate.unitConverted ?? condensate.unit)}</span>}
              {ngl && <span>NGL {num(ngl.valueConverted ?? ngl.value, ngl.unitConverted ?? ngl.unit)}</span>}
            </div>
          )}
          {d && <Timeline d={d} />}
          {(!d || (!d.reserves.length && !d.production.length)) && (
            <div className="aeck-dnote"><FileSearch size={12} />No production or reserve observations reported for this field in the current source release.</div>
          )}

          <div className="aeck-dmeta">
            <div><small>Operator</small><b>{str(d?.operator ?? p.operator)}</b></div>
            <div><small>Production type</small><b>{str(d?.productionType)}</b></div>
            <div><small>Block</small><b>{str(d?.block)}</b></div>
            <div><small>Location quality</small><b>{accuracy}</b></div>
          </div>
          {d?.owners && (
            <details className="aeck-dmore">
              <summary>More evidence</summary>
              <div className="aeck-dmore-rows">
                <div><small>Owners</small><b>{d.owners}</b></div>
                {d.parents && <div><small>Parent companies</small><b>{d.parents}</b></div>}
                {d.statusDetail && <div><small>Status detail</small><b>{d.statusDetail}</b></div>}
                <div><small>Source</small><b>{d.enrichedFrom ? `${selection.source} + ${d.enrichedFrom}` : selection.source}</b></div>
                <div><small>OSDU field ID</small><b className="mono">{selection.id}</b></div>
              </div>
            </details>
          )}
        </>
      )}

      <div className="aeck-dactions">
        <button onClick={() => onNavigate('exploration')}><Compass size={13} />Ask Exploration</button>
        <button onClick={() => onNavigate('field-development')}><Layers3 size={13} />Ask Field Development</button>
        <button onClick={() => onNavigate('field-development')} className="secondary"><GitCompare size={13} />Compare analogues</button>
      </div>
      <button className="aeck-dive" onClick={() => onNavigate('field-development')}><MapPin size={14} />OPEN FIELD WORKSPACE <span>↗</span></button>
    </aside>
  );
}
