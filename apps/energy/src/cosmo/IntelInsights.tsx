// IntelInsights (Intelligence → Insights) — the world-data insight board. Reads the same
// cockpit-insights.json the Cockpit teaser uses (OSDU-grounded totals + USGS-province field
// density), but as its own dedicated, full-page surface instead of a Cockpit overlay.
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Database, Globe2, Link2, TrendingUp, Gauge, ShieldCheck,
} from 'lucide-react';
import './intel-insights.css';

type CockpitInsights = {
  totals: {
    osduRecords: number;
    spatialFields: number;
    matchedFields: number;
    assessedProvinces: number;
    matchRate: number;
  };
  topProvinces: Array<{
    prvCode: string;
    prvName: string;
    fieldCount: number;
    boeMean: number | null;
  }>;
  provinceFields: Record<string, number>;
};

const SOURCES = [
  { name: 'GOGET', full: 'Global Energy Monitor', licence: 'CC BY 4.0' },
  { name: 'USGS', full: 'World Petroleum Assessment 2012', licence: 'Public domain' },
  { name: 'Sodir / NSTA', full: 'Norway + UK North Sea regulators', licence: 'NLOD-2.0 / NSTA-OUL' },
  { name: 'ANP', full: 'Brazil national petroleum agency', licence: 'Open data' },
  { name: 'Volve', full: 'Equinor open field dataset', licence: 'Equinor Open Data' },
];

export function IntelInsights() {
  const [insights, setInsights] = useState<CockpitInsights | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}osdu/cockpit-insights.json`)
      .then((response) => response.json())
      .then(setInsights)
      .catch(() => setInsights(null));
  }, []);

  const tiles = useMemo(() => {
    if (!insights) return [];
    const { totals } = insights;
    return [
      { icon: Link2, label: 'Fields connected', value: totals.matchedFields.toLocaleString(), note: `${totals.matchRate.toFixed(1)}% catalogue match rate` },
      { icon: Gauge, label: 'Match rate', value: `${totals.matchRate.toFixed(1)}%`, note: 'GOGET twins found for regulator/ANP fields' },
      { icon: Globe2, label: 'Basins assessed', value: totals.assessedProvinces.toLocaleString(), note: 'USGS 2012 world petroleum provinces' },
      { icon: TrendingUp, label: 'Spatial fields', value: totals.spatialFields.toLocaleString(), note: 'Fields carrying real map geometry' },
      { icon: Database, label: 'OSDU records', value: totals.osduRecords.toLocaleString(), note: 'Canonical, source-governed records' },
      { icon: ShieldCheck, label: 'Governed sources', value: String(SOURCES.length), note: 'GOGET · USGS · Sodir/NSTA · ANP · Volve' },
    ];
  }, [insights]);

  // Signals — short, plainly-derived statements. Every number here traces straight back to
  // insights.totals / topProvinces; nothing here is invented or estimated beyond the data.
  const signals = useMemo(() => {
    if (!insights) return [];
    const { totals, topProvinces } = insights;
    const lead = topProvinces[0];
    const top10 = topProvinces.slice(0, 10).filter((p) => p.boeMean != null);
    const richest = top10.reduce<typeof top10[number] | null>(
      (best, p) => (!best || (p.boeMean ?? 0) > (best.boeMean ?? 0) ? p : best), null,
    );
    const out: string[] = [];
    out.push(
      `${totals.matchedFields.toLocaleString()} of ${totals.spatialFields.toLocaleString()} mapped fields `
      + `(${totals.matchRate.toFixed(1)}%) are now cross-referenced against a national or regional `
      + 'regulator or ANP record — the rest remain GOGET-only until a matching authority is found.',
    );
    if (lead) {
      out.push(
        `${lead.prvName} carries the single densest catalogue overlap worldwide, with `
        + `${lead.fieldCount.toLocaleString()} connected fields — more than any other assessed basin.`,
      );
    }
    if (richest && lead && richest.prvCode !== lead.prvCode) {
      out.push(
        `Among the ten most field-dense basins, ${richest.prvName} carries the highest average `
        + `per-field reserve intensity, at roughly ${Math.round(richest.boeMean ?? 0).toLocaleString()} MMBOE-eq/field.`,
      );
    }
    out.push(
      `${totals.assessedProvinces.toLocaleString()} USGS-assessed petroleum provinces are represented `
      + `in the spatial spine, underpinned by ${totals.osduRecords.toLocaleString()} OSDU-governed records `
      + 'spanning five independent public sources.',
    );
    return out;
  }, [insights]);

  const maxFieldCount = insights?.topProvinces[0]?.fieldCount ?? 1;

  return (
    <div className="ins">
      <div className="ins-bar">
        <div className="ins-title">
          <span className="ins-ic"><Sparkles size={15} /></span>
          <b>Insights</b>
          <span className="ins-sub">
            {insights ? `${insights.totals.matchedFields.toLocaleString()} fields connected · ${insights.totals.matchRate.toFixed(1)}% match rate` : 'Loading world data…'}
          </span>
        </div>
        <div className="ins-prov"><ShieldCheck size={11} /> WORLD PETROLEUM DATA · read-only, source-governed</div>
      </div>

      <div className="ins-body">
        <div className="ins-grid">
          {tiles.map((tile) => (
            <div key={tile.label} className="ins-tile">
              <span className="ins-tile-ic"><tile.icon size={15} /></span>
              <b>{tile.value}</b>
              <small>{tile.label}</small>
              <span>{tile.note}</span>
            </div>
          ))}
          {!insights && Array.from({ length: 6 }).map((_, i) => <div key={i} className="ins-tile ins-tile-loading" />)}
        </div>

        {signals.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-head"><TrendingUp size={13} />SIGNALS FROM THE WORLD SPINE</div>
            <div className="ins-signals">
              {signals.map((signal, i) => (
                <div key={i} className="ins-signal"><span>{i + 1}</span><p>{signal}</p></div>
              ))}
            </div>
          </div>
        )}

        {insights && insights.topProvinces.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-head"><Globe2 size={13} />LEADING BASINS BY FIELD DENSITY</div>
            <div className="ins-leaderboard">
              {insights.topProvinces.slice(0, 10).map((province, i) => (
                <div key={province.prvCode} className="ins-lb-row">
                  <span className="ins-lb-rank">{i + 1}</span>
                  <span className="ins-lb-name">{province.prvName}</span>
                  <span className="ins-lb-bar"><span style={{ width: `${Math.max(4, (province.fieldCount / maxFieldCount) * 100)}%` }} /></span>
                  <span className="ins-lb-count">{province.fieldCount.toLocaleString()}</span>
                  <span className="ins-lb-boe">{province.boeMean != null ? `${Math.round(province.boeMean).toLocaleString()} boe` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ins-section">
          <div className="ins-section-head"><Database size={13} />GOVERNED SOURCES</div>
          <div className="ins-sources">
            {SOURCES.map((source) => (
              <div key={source.name} className="ins-source">
                <b>{source.name}</b><small>{source.full}</small><span>{source.licence}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
