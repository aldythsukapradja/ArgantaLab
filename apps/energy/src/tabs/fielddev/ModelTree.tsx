// ModelTree — the left drawer: what EXISTS in the project, and what is switched on.
//
// This replaces the Processes rail. Modern Petrel does the same thing: the tree is the
// permanent left-hand furniture and the processes live in a ribbon, because a tree
// answers "what is in my project" — a question you ask constantly — while a process is
// something you run occasionally and then close.
//
// ── THE ONE RULE ────────────────────────────────────────────────────────────
//
// A checkbox here changes the MODEL, not just the picture. That distinction cost a
// real bug: the horizon checkboxes used to drive viewport visibility only, so ticking
// two horizons left the grid still spanning the whole section from the seabed down.
// Every toggle in this tree says, in its own row, what it affects.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Layers, Mountain, Boxes, Droplets,
  Circle, Grid3x3, Palette, RefreshCw, Trash2,
} from 'lucide-react';
import { useStatic } from './static-store';
import type { Workspace } from './workspace-model';
import { PROPERTY_STYLES } from './prop-view';
import { indexedDbVersionStore, seedV0, type GridVersion } from './grid-versions';
// the tree primitives are SHARED with the Simulation tree, so the two cannot drift
import { TreeBranch as Branch, TreeRow as Row } from './studio-shell';

export interface ModelTreeProps {
  ws: Workspace;
  /** the property the viewport is colouring by */
  propKey: string;
  onProp: (k: string) => void;
  /** properties the packed grid actually carries */
  availableProps: string[];
  /** zones in the built grid, and which are switched on for volumes/properties */
  zones: string[];
  activeZones: string[];
  onZones: (z: string[]) => void;
  /** the realisation currently loaded, if it came from a saved version */
  versionId?: string | null;
  onLoadVersion?: (v: GridVersion) => void;
  /**
   * Rebuild the loaded case from its recipe.
   *
   * Explicit, and deliberately not automatic. A saved case is READ on open — that is
   * what makes v0 a reference rather than a recomputation that tracks the code — so the
   * only way it changes is if someone decides it should.
   */
  onRebuild?: () => void;
}

export function ModelTree({
  ws, propKey, onProp, availableProps, zones, activeZones, onZones, versionId, onLoadVersion, onRebuild,
}: ModelTreeProps) {
  const visible = useStatic((s) => s.visibleHorizons);
  const toggleHorizon = useStatic((s) => s.toggleHorizon);
  const showWells = useStatic((s) => s.showWells);
  const visibleWells = useStatic((s) => s.visibleWells);
  const setVisibleWells = useStatic((s) => s.setVisibleWells);
  const toggleWell = useStatic((s) => s.toggleWell);
  const setShowWells = useStatic((s) => s.setShowWells);
  const showContact = useStatic((s) => s.showContact);
  const setShowContact = useStatic((s) => s.setShowContact);
  const grid = useStatic((s) => s.grid);
  const simInfo = useStatic((s) => s.simInfo);
  const upscaled = useStatic((s) => s.upscaled);

  // stratigraphic order, from the grids' own mid-depth — never alphabetical, because
  // "BCU" sorts before "Hugin" in the alphabet and below it in the ground
  const surfaces = useMemo(() => {
    const withDepth = ws.surfaces.map((s) => ({
      s, mid: s.zmin != null && s.zmax != null ? (Math.abs(s.zmin) + Math.abs(s.zmax)) / 2 : Infinity,
    }));
    withDepth.sort((a, b) => a.mid - b.mid);
    return withDepth;
  }, [ws.surfaces]);

  const flowing = ws.bores.filter((b) => b.role === 'oil-producer' || /inject/i.test(String(b.role ?? '')));
  // null means ALL — resolved here so the rows and the count agree with the scene
  const allWells = useMemo(() => ws.bores.map((b) => b.name), [ws.bores]);
  const wellsOn = visibleWells ?? allWells;

  // ── saved realisations ──
  //
  // First thing in the tree, because "which version am I looking at" outranks every
  // other question on this panel. A geostatistical model has no single answer; two
  // seeds are both valid and give different volumes, so a model you cannot name and
  // swap is a model you can only build once.
  const [versions, setVersions] = useState<GridVersion[]>([]);
  const reload = useCallback(() => {
    if (!ws.fieldId) return;
    // seed the shipped v0 first, so the list is never empty on a fresh browser
    seedV0(indexedDbVersionStore, ws.fieldId, (u) => fetch(u).then((r) => (r.ok ? r.json() : null)))
      .finally(() => {
        indexedDbVersionStore.list(ws.fieldId as string).then(setVersions).catch(() => setVersions([]));
      });
  }, [ws.fieldId]);
  useEffect(reload, [reload, grid]);

  const del = useCallback((v: GridVersion) => {
    // no confirm dialog for a saved recipe: it is cheap to rebuild from its seed, and a
    // modal on every tidy-up is how version lists become graveyards
    indexedDbVersionStore.remove(v.id).then(reload).catch(() => undefined);
  }, [reload]);

  return (
    <div className="mt">
      <div className="mt-head">Model</div>

      <div className="mt-ver">
        <select
          value={versionId ?? ''}
          onChange={(e) => {
            const v = versions.find((x) => x.id === e.target.value);
            if (v) onLoadVersion?.(v);
          }}>
          <option value="">
            {versions.length ? 'current (unsaved)' : 'no saved realisations'}
          </option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id === 'v0' ? '★ ' : ''}{v.name}
              {Number.isFinite(v.stats.stoiipMMSm3) ? ` · ${v.stats.stoiipMMSm3.toFixed(1)} MMSm³` : ''}
            </option>
          ))}
        </select>
        {onRebuild && (
          <button className="mt-ver-re" title="Rebuild this case from its recipe — the only way a saved case changes"
            onClick={onRebuild}>
            <RefreshCw size={11} />
          </button>
        )}
        <button
          className="mt-ver-del"
          disabled={!versionId}
          title={versionId ? 'Delete this realisation' : 'Select a saved realisation to delete it'}
          onClick={() => {
            const v = versions.find((x) => x.id === versionId);
            if (v) del(v);
          }}>
          <Trash2 size={11} />
        </button>
      </div>

      <Branch id="surfaces" icon={<Mountain size={12} />} label="Horizons"
        count={`${visible.length}/${surfaces.length}`}
        affects="ticked horizons BUILD THE GRID — not just the view">
        {surfaces.map(({ s, mid }) => (
          <Row key={s.id} on={visible.includes(s.id)} onToggle={() => toggleHorizon(s.id)}
            label={s.name} right={Number.isFinite(mid) ? `${mid.toFixed(0)} m` : ''} />
        ))}
      </Branch>

      <Branch id="zones" icon={<Layers size={12} />} label="Zones"
        count={zones.length ? `${activeZones.length}/${zones.length}` : '—'}
        affects="active zones carry properties and volumes">
        {zones.length === 0
          ? <div className="mt-empty">build the grid to create zones</div>
          : zones.map((z) => (
            <Row key={z} on={activeZones.includes(z)}
              onToggle={() => onZones(activeZones.includes(z)
                ? activeZones.filter((x) => x !== z)
                : [...activeZones, z])}
              label={z} />
          ))}
      </Branch>

      <Branch id="props" icon={<Palette size={12} />} label="Properties"
        count={availableProps.length ? String(availableProps.length) : '—'}
        affects="one at a time — this is what the viewport colours by">
        {availableProps.length === 0
          ? <div className="mt-empty">run the property modelling to create properties</div>
          : PROPERTY_STYLES.filter((s) => availableProps.includes(s.key)).map((s) => (
            <Row key={s.key} kind="radio" on={propKey === s.key} onToggle={() => onProp(s.key)}
              label={s.label} right={s.unit} />
          ))}
      </Branch>

      <Branch id="grid" icon={<Grid3x3 size={12} />} label="3D grid" defaultOpen={false}>
        {grid
          ? (
            <div className="mt-facts">
              <span>{grid.packed.nx} × {grid.packed.ny} × {grid.packed.nz}</span>
              <span>{(grid.cells / 1e6).toFixed(2)} M cells</span>
              <span>{(grid.packedBytes / 1048576).toFixed(1)} MB packed</span>
              <span>{grid.zoneLayers.length} zones</span>
            </div>
          )
          : <div className="mt-empty">not built</div>}
      </Branch>

      <Branch id="wells" icon={<Circle size={12} />} label="Wells"
        count={`${wellsOn.length}/${allWells.length}`}
        affects="ticked wells are drawn in the 3D scene">
        <Row on={showWells} onToggle={() => setShowWells(!showWells)} label="Show well paths" />
        <div className="mt-mini">
          <button onClick={() => setVisibleWells(null)}>all</button>
          <button onClick={() => setVisibleWells([])}>none</button>
          <button onClick={() => setVisibleWells(flowing.map((b) => b.name))}>flowing only</button>
        </div>
        {allWells.map((name) => {
          const b = ws.bores.find((x) => x.name === name);
          const role = b?.role === 'oil-producer' ? 'PROD' : /inject/i.test(String(b?.role ?? '')) ? 'INJ' : '';
          return (
            <Row key={name} on={wellsOn.includes(name)} dim={!showWells}
              onToggle={() => toggleWell(name, allWells)} label={name} right={role} />
          );
        })}
        {upscaled
          ? <div className="mt-facts"><span>{upscaled.cells.length} upscaled cells</span></div>
          : <div className="mt-empty">logs not scaled up</div>}
      </Branch>

      <Branch id="fluids" icon={<Droplets size={12} />} label="Fluids" defaultOpen={false}>
        <Row on={showContact} onToggle={() => setShowContact(!showContact)} label="Show contact plane" />
        {ws.contacts.map((c, n) => (
          <div key={n} className="mt-facts">
            <span>{c.kind ?? 'OWC'}</span>
            <span>{c.tvdss != null ? `${Math.abs(c.tvdss).toFixed(0)} m` : '—'}</span>
          </div>
        ))}
      </Branch>

      <Branch id="realis" icon={<Boxes size={12} />} label="Realisation" defaultOpen={false}>
        {simInfo
          ? (
            <div className="mt-facts">
              <span>seed {simInfo.seed}</span>
              <span>{simInfo.simNodes} × {simInfo.simNodes} simulated</span>
              <span>{simInfo.simulatedLayers}/{simInfo.totalLayers} layers</span>
              <span>{(simInfo.sandFraction * 100).toFixed(0)}% sand</span>
              {simInfo.permCapped > 0 && <span>{simInfo.permCapped.toLocaleString('en-US')} k capped</span>}
            </div>
          )
          : <div className="mt-empty">no realisation yet</div>}
      </Branch>
    </div>
  );
}
