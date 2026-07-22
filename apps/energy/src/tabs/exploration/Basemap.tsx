// Exploration Basemap — the spatial entry point: a selectable depth surface with the
// real Volve wells (exploration wildcats highlighted), the interpreted Hugin closure
// outline and prospect markers. Click a well to inspect it. Founder spec: "map layers
// · wells and survey footprints · lead/prospect outlines · select an object · inspect".
import { useMemo, useState, useCallback } from 'react';
import { Layers as LayersIcon } from 'lucide-react';
import { useAsync, useCanvas } from '../fielddev/hooks';
import { Inspector, InspectorSection, Loading, ErrorBanner, ReadoutBar } from '../fielddev/chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { gridBounds, gridMinMax } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { contactPolygon } from '../../engine/closure';
import { drawSurface, drawRing, drawWells } from './explDraw';
import type { ExplSel } from '../../cosmo/ExplorationExplorer';

export function ExplBasemap({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const [surfId, setSurfId] = useState('hugin_top');
  const surf = useAsync<SurfaceJson>(() => loadSurface(surfId), [surfId]);
  if (idx.loading) return <Loading what="basemap" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} surf={surf} surfId={surfId} setSurfId={setSurfId} sel={sel} setSel={setSel} />;
}

function Inner({ index, surf, surfId, setSurfId, sel, setSel }: {
  index: WbIndex; surf: { data: SurfaceJson | null; loading: boolean; error: string | null };
  surfId: string; setSurfId: (s: string) => void; sel: ExplSel; setSel: (s: ExplSel) => void;
}) {
  const [showWells, setShowWells] = useState(true);
  const [explOnly, setExplOnly] = useState(false);
  const [showClosure, setShowClosure] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const owc = index.contacts[0]?.tvdss ?? 3200;

  const wells = useMemo(() => index.wells.filter((w) => (explOnly ? w.is_exploration : true)), [index, explOnly]);
  const explNames = useMemo(() => new Set(index.wells.filter((w) => w.is_exploration).map((w) => w.name)), [index]);
  const g = surf.data;
  const bounds = useMemo(() => g ? padBounds(gridBounds(g), 0.08) : { minX: 0, minY: 0, maxX: 1, maxY: 1 }, [g]);
  const minmax = useMemo(() => g ? gridMinMax(g) : { min: 0, max: 1 }, [g]);
  const ring = useMemo(() => g && surfId === 'hugin_top' ? (() => { try { return contactPolygon(g, owc); } catch { return null; } })() : null, [g, surfId, owc]);
  const activeWell = sel?.folder === 'wells' ? sel.id : undefined;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!g) return;
    const view = makeView(bounds, w, h, 26);
    drawSurface(ctx, view, g, minmax);
    if (showClosure && ring?.ring?.length) drawRing(ctx, view, ring.ring);
    if (showWells) {
      const muted = wells.filter((wl) => !explNames.has(wl.name)).map((wl) => ({ name: wl.name, x: wl.x, y: wl.y }));
      const expl = wells.filter((wl) => explNames.has(wl.name)).map((wl) => ({ name: '15/9-' + wl.name, x: wl.x, y: wl.y }));
      drawWells(ctx, view, muted, undefined, '--ink3');
      drawWells(ctx, view, expl, activeWell ? '15/9-' + activeWell : undefined, '--green');
    }
  }, [g, bounds, minmax, ring, showClosure, showWells, wells, explNames, activeWell]);
  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  const onClick = (e: React.MouseEvent) => {
    if (!g) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(bounds, rect.width, rect.height, 26);
    const p = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    let best: string | null = null, bd = Infinity;
    for (const wl of wells) { const d = Math.hypot(wl.x - p.x, wl.y - p.y); if (d < bd) { bd = d; best = wl.name; } }
    if (best && bd < 400) setSel({ folder: 'wells', id: best });
  };

  const selWell = index.wells.find((w) => w.name === activeWell);
  const Toggle = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: on ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', marginBottom: 7 }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ accentColor: 'var(--cyan)' }} />{label}
    </label>
  );

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
          <LayersIcon size={14} style={{ color: 'var(--muted)' }} />
          <select value={surfId} onChange={(e) => setSurfId(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)' }}>
            {index.surfaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{index.crs} · {index.datum}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setInspOpen((o) => !o)} title="Layers" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><LayersIcon size={15} /></button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          {surf.loading ? <Loading what="surface" /> : surf.error ? <ErrorBanner msg={surf.error} /> : (
            <><canvas ref={canvasRef} onClick={onClick} style={{ display: 'block', width: '100%', height: '100%' }} />
            <ReadoutBar left={`${g?.name} · ${wells.length} wells · ${explNames.size} wildcats${showClosure && ring ? ' · Hugin closure @ ' + owc + 'm' : ''}`} /></>
          )}
        </div>
      </div>

      <Inspector title="Layers & selection" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Layers">
          <Toggle on={showWells} set={setShowWells} label="Wells" />
          <Toggle on={explOnly} set={setExplOnly} label="Exploration wells only" />
          <Toggle on={showClosure} set={setShowClosure} label="Hugin closure outline" />
        </InspectorSection>
        <InspectorSection title="Selection">
          {selWell ? (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{explNames.has(selWell.name) ? '15/9-' : ''}{selWell.name} {explNames.has(selWell.name) && <span className="chip mono" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>wildcat</span>}</div>
              <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
                {[['role', selWell.role], ['TD MD', selWell.td_md.toFixed(0) + ' m'], ['TD TVD', selWell.td_tvd.toFixed(0) + ' m'], ['easting', selWell.x.toFixed(0)], ['northing', selWell.y.toFixed(0)]].map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>)}
              </tbody></table>
              <div style={{ marginTop: 8 }}><NatureBadge nature="measured" /></div>
            </div>
          ) : <div style={{ fontSize: 11, color: 'var(--muted)' }}>Click a well on the map to inspect it.</div>}
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)', lineHeight: 1.5 }}>Real Volve well surface locations & depth grids (measured/interpreted). Closure outline is interpreted at the deck OWC.</div>
      </Inspector>
    </div>
  );
}
