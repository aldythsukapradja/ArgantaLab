// GeaNavBar — the viewport's top bar: property, colour table, IJK player, section tool.
//
// Three rules this bar follows, all of them about not lying to the reader:
//
//  · the colour table is generated from the SAME range the mesh is coloured with
//    (`prop-view.colorTable`), never recomputed here;
//  · facies shows discrete swatches, because a colour between two facies stands for a
//    rock that does not exist;
//  · the slice index is shown as BOTH the index and the count (k 7 / 20), so a reader
//    always knows how much of the model they are not looking at.
import { useCallback, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Scissors, Layers, Eye, EyeOff, Grid2x2 } from 'lucide-react';
import type { ColorTable, PropertyStyle, SliceAxis } from './prop-view';
import { PROPERTY_STYLES, RAMP_IDS, safeRange } from './prop-view';

export interface NavBarProps {
  /** which packed property is being displayed */
  propKey: string;
  onProp: (key: string) => void;
  /** properties the packed grid actually carries — never offer one it does not */
  available: string[];
  table: ColorTable | null;
  /** the untrimmed extremes and how many cells the range is clipping */
  rangeInfo?: { dataMin: number; dataMax: number; clippedLo: number; clippedHi: number; n: number } | null;
  rampId?: string;
  onRamp?: (id: string) => void;
  onRange?: (r: { lo: number; hi: number } | null) => void;
  pinned?: boolean;

  sliceOn: boolean;
  onSliceOn: (v: boolean) => void;
  axis: SliceAxis;
  onAxis: (a: SliceAxis) => void;
  index: number;
  onIndex: (i: number) => void;
  extent: number;

  playing: boolean;
  onPlaying: (v: boolean) => void;

  sectionMode: boolean;
  onSectionMode: (v: boolean) => void;
  sectionPoints: number;
  onClearSection: () => void;

  showShell: boolean;
  onShowShell: (v: boolean) => void;
  showEdges: boolean;
  onShowEdges: (v: boolean) => void;
}

const AXES: Array<{ id: SliceAxis; label: string; hint: string }> = [
  { id: 'i', label: 'I', hint: 'section across rows' },
  { id: 'j', label: 'J', hint: 'section across columns' },
  { id: 'k', label: 'K', hint: 'one layer, in map view' },
];

export function GeaNavBar(p: NavBarProps) {
  const timer = useRef<number | null>(null);

  // ── the player ──
  //
  // Steps on a timer rather than requestAnimationFrame: this is a data scrubber, not
  // an animation, and 6 layers a second is readable where 60 is a strobe. It also keeps
  // running when the tab is hidden throttles rAF to a crawl.
  useEffect(() => {
    if (!p.playing || !p.sliceOn || p.extent <= 1) return;
    timer.current = window.setInterval(() => {
      p.onIndex((p.index + 1) % p.extent);
    }, 160);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [p.playing, p.sliceOn, p.extent, p.index, p.onIndex]);

  // stop at the end of the model rather than wrapping silently while the user is
  // reading the last layer
  const step = useCallback((d: number) => {
    p.onPlaying(false);
    p.onIndex(Math.max(0, Math.min(p.extent - 1, p.index + d)));
  }, [p]);

  const t = p.table;

  return (
    <div className="gea-nav">
      {/* ── property ─────────────────────────────────────────────── */}
      <div className="gea-nav-group">
        <span className="gea-nav-label">Property</span>
        <div className="gea-seg">
          {PROPERTY_STYLES.filter((s) => p.available.includes(s.key)).map((s) => (
            <button key={s.key}
              className={`gea-seg-btn${p.propKey === s.key ? ' on' : ''}`}
              onClick={() => p.onProp(s.key)}
              title={`${s.label}${s.unit ? ` (${s.unit})` : ''}`}>
              {s.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── colour table ─────────────────────────────────────────── */}
      {t && (
        <ColorTableStrip table={t} rampId={p.rampId} onRamp={p.onRamp}
          onRange={p.onRange} pinned={p.pinned} rangeInfo={p.rangeInfo} />
      )}

      {/* ── IJK player ───────────────────────────────────────────── */}
      <div className="gea-nav-group gea-nav-player">
        <button className={`gea-icon${p.sliceOn ? ' on' : ''}`}
          onClick={() => p.onSliceOn(!p.sliceOn)}
          title={p.sliceOn ? 'Show the whole shell' : 'Slice the model'}>
          <Layers size={14} />
        </button>
        <div className="gea-seg">
          {AXES.map((a) => (
            <button key={a.id}
              className={`gea-seg-btn${p.axis === a.id && p.sliceOn ? ' on' : ''}`}
              disabled={!p.sliceOn}
              onClick={() => p.onAxis(a.id)} title={a.hint}>{a.label}</button>
          ))}
        </div>
        <button className="gea-icon" disabled={!p.sliceOn} onClick={() => step(-1)} title="Previous"><SkipBack size={14} /></button>
        <button className={`gea-icon${p.playing ? ' on' : ''}`} disabled={!p.sliceOn}
          onClick={() => p.onPlaying(!p.playing)} title={p.playing ? 'Pause' : 'Play through the model'}>
          {p.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="gea-icon" disabled={!p.sliceOn} onClick={() => step(1)} title="Next"><SkipForward size={14} /></button>
        <input type="range" className="gea-scrub" min={0} max={Math.max(0, p.extent - 1)} step={1}
          value={p.index} disabled={!p.sliceOn}
          onChange={(e) => { p.onPlaying(false); p.onIndex(Number(e.target.value)); }} />
        {/* index AND count — a reader must know how much they are not seeing */}
        <span className="gea-nav-read">{p.axis} {p.index + 1} / {p.extent}</span>
        {p.sliceOn && (
          <span className="gea-nav-iso" title="While slicing, the shell, horizons and contact plane are hidden so nothing occludes the cut. Wells stay for spatial reference.">
            isolated
          </span>
        )}
      </div>

      {/* ── section + shell ──────────────────────────────────────── */}
      <div className="gea-nav-group">
        <button className={`gea-icon${p.sectionMode ? ' on' : ''}`}
          onClick={() => p.onSectionMode(!p.sectionMode)}
          title="Draw a cross-section on the map">
          <Scissors size={14} />
        </button>
        {p.sectionPoints > 0 && (
          <button className="gea-nav-clear" onClick={p.onClearSection}>
            clear ({p.sectionPoints})
          </button>
        )}
        <button className={`gea-icon${p.showShell ? ' on' : ''}`}
          onClick={() => p.onShowShell(!p.showShell)}
          title={p.showShell ? 'Hide the grid shell' : 'Show the grid shell'}>
          {p.showShell ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button className={`gea-icon${p.showEdges ? ' on' : ''}`}
          disabled={!p.showShell}
          onClick={() => p.onShowEdges(!p.showEdges)}
          title="Cell edges — the layering and areal resolution, by eye">
          <Grid2x2 size={14} />
        </button>
      </div>
    </div>
  );
}

/** The legend. Continuous properties get a gradient with ticks; categorical get
 *  swatches, one per code, and no gradient anywhere. */
export function ColorTableStrip({ table, rampId, onRamp, onRange, pinned, rangeInfo }: {
  table: ColorTable;
  rampId?: string;
  onRamp?: (id: string) => void;
  onRange?: (r: { lo: number; hi: number } | null) => void;
  pinned?: boolean;
  rangeInfo?: { dataMin: number; dataMax: number; clippedLo: number; clippedHi: number; n: number } | null;
}) {
  const s: PropertyStyle = table.style;
  if (s.categorical) {
    return (
      <div className="gea-nav-group gea-ct">
        <span className="gea-nav-label">{s.label}</span>
        <div className="gea-ct-codes">
          {table.entries.map((e) => (
            <span key={e.value} className="gea-ct-code">
              <i style={{ background: e.color }} />{e.label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  const clipped = rangeInfo ? rangeInfo.clippedLo + rangeInfo.clippedHi : 0;
  const clipPct = rangeInfo?.n ? (clipped / rangeInfo.n) * 100 : 0;

  return (
    <div className="gea-nav-group gea-ct">
      <span className="gea-nav-label">
        {s.label}{s.unit ? ` · ${s.unit}` : ''}{s.log ? ' · log' : ''}
      </span>
      <div className="gea-ct-bar">
        <div className="gea-ct-ramp" style={{ background: table.gradient }} />
        <div className="gea-ct-ticks">
          {table.entries.map((e, i) => (
            <span key={i} className="gea-ct-tick">{e.label}</span>
          ))}
        </div>
      </div>

      {onRamp && (
        <select className="gea-ct-ramp-pick" value={rampId ?? ''} onChange={(e) => onRamp(e.target.value)}
          title="Colour ramp — a reading instrument, not decoration">
          {RAMP_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      )}

      {onRange && (
        <span className="gea-ct-range">
          <input type="number" step="any" value={Number(table.lo.toFixed(4))}
            title="Range minimum"
            onChange={(e) => onRange(safeRange(Number(e.target.value), table.hi, table))} />
          <input type="number" step="any" value={Number(table.hi.toFixed(4))}
            title="Range maximum"
            onChange={(e) => onRange(safeRange(table.lo, Number(e.target.value), table))} />
          <button className={pinned ? 'on' : ''} onClick={() => onRange(null)}
            title={pinned
              ? 'Pinned — click to return to auto (P2–P98, outliers trimmed)'
              : 'Auto: P2–P98, outliers trimmed'}>
            {pinned ? 'pinned' : 'auto'}
          </button>
        </span>
      )}

      {/* A map with a tenth of its cells pinned at the top of the ramp is a map with
          the wrong range, and nothing on the picture says so. This does. */}
      {clipPct >= 1 && rangeInfo && (
        <span className="gea-ct-clip" title={`data ${rangeInfo.dataMin.toFixed(3)} – ${rangeInfo.dataMax.toFixed(3)}`}>
          {clipPct.toFixed(0)}% clipped
        </span>
      )}
    </div>
  );
}
