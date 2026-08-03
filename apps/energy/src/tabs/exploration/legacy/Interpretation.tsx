// Geological Interpretation — map-first 2D interpretation: the real Hugin structural
// surface with the interpreted closure polygon + well control, alongside a
// chronostratigraphic section carrying petroleum-system roles (source/reservoir/seal).
// Interpretation objects are versioned/scenario — never silently overwritten. Founder
// spec: "points, polylines and polygons · surfaces and sections · create · edit · QC".
import { useMemo, useCallback } from 'react';
import { useAsync, useCanvas } from '../../fielddev/hooks';
import { Loading, ErrorBanner, ReadoutBar } from '../../fielddev/chrome';
import { NatureBadge } from '../../../components/Provenance';
import { loadIndex, loadSurface } from '../../../wb/load';
import type { WbIndex } from '../../../wb/types';
import type { SurfaceJson } from '../../../engine/grid';
import { gridBounds, gridMinMax } from '../../../engine/grid';
import { makeView, padBounds } from '../../../engine/view';
import { contactPolygon } from '../../../engine/closure';
import { drawSurface, drawRing, drawWells } from './explDraw';
import type { ExplSel } from './ExplorationExplorer';
import { STRAT_COLUMN, type PsRole } from './explData';

const ROLE_COLOR: Record<PsRole, string> = {
  source: 'var(--red)', reservoir: 'var(--green)', seal: 'var(--amber)', overburden: 'var(--ink3)', none: 'var(--line)',
};

export function ExplInterpretation({ sel }: { sel: ExplSel }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  if (idx.loading || top.loading) return <Loading what="interpretation" />;
  if (idx.error || !idx.data || !top.data) return <ErrorBanner msg={idx.error || 'surface unavailable'} />;
  return <Inner index={idx.data} top={top.data} sel={sel} />;
}

function Inner({ index, top, sel }: { index: WbIndex; top: SurfaceJson; sel: ExplSel }) {
  const owc = index.contacts[0]?.tvdss ?? 3200;
  const bounds = useMemo(() => padBounds(gridBounds(top), 0.08), [top]);
  const minmax = useMemo(() => gridMinMax(top), [top]);
  const ring = useMemo(() => { try { return contactPolygon(top, owc); } catch { return null; } }, [top, owc]);
  const explWells = useMemo(() => index.wells.filter((w) => w.is_exploration).map((w) => ({ name: '15/9-' + w.name, x: w.x, y: w.y })), [index]);
  const selStrat = sel?.folder === 'strat' ? sel.id : undefined;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const view = makeView(bounds, w, h, 26);
    drawSurface(ctx, view, top, minmax, owc);
    if (ring?.ring?.length) drawRing(ctx, view, ring.ring, '--cyan', 1.8);
    drawWells(ctx, view, explWells, undefined, '--green');
  }, [bounds, top, minmax, owc, ring, explWells]);
  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  const objects = [
    { name: 'Hugin closure polygon', kind: 'polygon', n: ring?.ring?.length ?? 0, nat: 'interpreted' as const },
    { name: 'OWC contact', kind: 'polyline', n: 1, nat: 'interpreted' as const },
    { name: 'Wildcat tops', kind: 'points', n: explWells.length, nat: 'measured' as const },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
          <div className="eyebrow" style={{ flex: 1 }}>Hugin Top · structural interpretation</div>
          <span className="chip mono" style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}>4-way + fault-dependent closure</span>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          <ReadoutBar left={`interpreted closure @ OWC ${owc} m · ${explWells.length} wildcat control points`} />
        </div>
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', padding: '8px 12px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {objects.map((o) => (
            <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cyan)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--text)' }}>{o.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{o.kind} · {o.n}</span>
              <NatureBadge nature={o.nat} />
            </div>
          ))}
        </div>
      </div>

      {/* chrono-strat section */}
      <aside style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--panel)', overflow: 'auto', padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Chronostratigraphy · petroleum-system roles</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STRAT_COLUMN.map((s) => { const on = s.name === selStrat; return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'stretch', gap: 8, padding: '7px 8px', borderRadius: 4, background: on ? 'var(--sel)' : 'transparent', border: `1px solid ${on ? 'var(--cyan)' : 'transparent'}` }}>
              <div style={{ width: 5, borderRadius: 3, background: ROLE_COLOR[s.role], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                  {s.role !== 'none' && s.role !== 'overburden' && <span className="chip mono" style={{ fontSize: 8.5, color: ROLE_COLOR[s.role], borderColor: ROLE_COLOR[s.role] }}>{s.role.toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{s.ageMa[0]}–{s.ageMa[1]} Ma · {s.env}</div>
                {s.roleNote && on && <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 3 }}>{s.roleNote}</div>}
              </div>
            </div>
          ); })}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9.5, color: 'var(--muted)' }}>
          {(['source', 'reservoir', 'seal'] as PsRole[]).map((r) => <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_COLOR[r] }} />{r}</span>)}
        </div>
        <div style={{ marginTop: 10 }}><NatureBadge nature="interpreted" /> <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>Ages/roles are cited regional interpretation.</span></div>
      </aside>
    </div>
  );
}
