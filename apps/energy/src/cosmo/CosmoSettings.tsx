// CosmoSettings — the Settings modal ported 1:1 from COSMO_Final.html (SettingsModal).
// Sections: DESIGN SYSTEM (Designer Studio → embedded 80% designer), APPEARANCE (theme
// Light/Dark selector · density · motion), FOUNDATION (governed workspace). Theme mode
// drives the shell's dark state; the Designer Studio embeds the verbatim data: URL app.
import { useState } from 'react';
import { Settings, X, Palette, Sun, Moon, Rows3, Sparkles, Minimize2, Ruler, Presentation } from 'lucide-react';
import { DESIGNER_STUDIO_URL } from './designer-studio-url';
import { useUnits, unitConventions, systemLabel } from '../units';

export function CosmoSettings({ open, onClose, dark, setDark, onPresent }: {
  open: boolean; onClose: () => void; dark: boolean; setDark: (v: boolean) => void;
  /** Launches the keynote surface. Settings is a modal, so it hands off rather
   *  than hosting — a cinematic deck cannot live inside a dialog. */
  onPresent?: () => void;
}) {
  const [designer, setDesigner] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const [motion, setMotion] = useState(true);
  // Units are a PROJECT setting, not a per-surface toggle — one store, whole app.
  const { system, setSystem } = useUnits();
  const conv = unitConventions(system);
  const closeAll = () => { setDesigner(false); onClose(); };

  return (
    <>
      <div className={'modal-scrim ' + (open && !designer ? 'on' : '')} onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-hd">
            <div className="mi"><Settings size={18} /></div>
            <div><h2>Settings</h2><div className="ms">workspace, appearance and design control</div></div>
            <button className="mx" onClick={onClose}><X size={15} /></button>
          </div>
          <div className="modal-body">
            <div className="set-sec">DESIGN SYSTEM</div>
            <div className="set-row" style={{ borderColor: 'var(--teal)', background: 'var(--teal-soft)' }}>
              <span className="si"><Palette size={15} /></span>
              <div><div className="st">Designer Studio</div><div className="sd">Themes, components, canvas spine and knowledge studio</div></div>
              <button className="newbtn" onClick={() => setDesigner(true)}>Open Designer</button>
            </div>

            <div className="set-sec">PROJECT UNITS</div>
            <div className="set-row">
              <span className="si"><Ruler size={15} /></span>
              <div>
                <div className="st">Unit system</div>
                <div className="sd">Applies app-wide. Data is stored metric-native; this converts for display only.</div>
              </div>
              <div className="sc segsm">
                <b className={system === 'field' ? 'on' : ''} onClick={() => setSystem('field')}>Field</b>
                <b className={system === 'metric' ? 'on' : ''} onClick={() => setSystem('metric')}>Metric</b>
              </div>
            </div>
            <div className="set-row">
              <span className="si" style={{ opacity: 0.5 }}><Ruler size={15} /></span>
              <div>
                <div className="st">{systemLabel(system)}</div>
                <div className="sd">
                  depth <b>{conv.depth}</b> · oil <b>{conv.oil}</b> · gas <b>{conv.gas}</b> · rate <b>{conv.rate}</b> · pressure <b>{conv.pressure}</b>
                </div>
              </div>
            </div>

            <div className="set-sec">APPEARANCE</div>
            <div className="set-row">
              <span className="si">{dark ? <Moon size={15} /> : <Sun size={15} />}</span>
              <div><div className="st">Theme mode</div><div className="sd">Preserve explicit light / dark selection</div></div>
              <div className="sc segsm">
                <b className={!dark ? 'on' : ''} onClick={() => setDark(false)}>Light</b>
                <b className={dark ? 'on' : ''} onClick={() => setDark(true)}>Dark</b>
              </div>
            </div>
            <div className="set-row">
              <span className="si"><Rows3 size={15} /></span>
              <div><div className="st">Density</div><div className="sd">Workspace spacing</div></div>
              <div className="sc segsm">
                {['compact', 'comfortable'].map((d) => <b key={d} className={density === d ? 'on' : ''} onClick={() => setDensity(d)}>{d}</b>)}
              </div>
            </div>
            <div className="set-row">
              <span className="si"><Sparkles size={15} /></span>
              <div><div className="st">Motion</div><div className="sd">Respect reduced-motion preference</div></div>
              <button className={'tgl ' + (motion ? 'on' : '')} onClick={() => setMotion(!motion)} />
            </div>

            <div className="set-sec">PRESENTATION</div>
            <div className="set-row" style={{ borderColor: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)' }}>
              <span className="si"><Presentation size={15} /></span>
              <div>
                <div className="st">Indonesia's Geological Legacy</div>
                <div className="sd">6 scenes · ~14 min · every figure read live from the corpus</div>
              </div>
              <button className="newbtn" onClick={() => { onClose(); onPresent?.(); }}>Present</button>
            </div>
          </div>
        </div>
      </div>

      {designer && (
        <div className="designer-scrim">
          <div className="designer-modal">
            <div className="designer-head">
              <Palette size={17} style={{ color: 'var(--teal)' }} />
              <div><b>ArgantaEnergy Designer Studio</b><br /><span>embedded previous designer · 80% canvas</span></div>
              <div className="sp" />
              <button className="wbtn" onClick={() => setDesigner(false)}><Minimize2 size={13} /> Back to settings</button>
              <button className="mx" onClick={closeAll}><X size={15} /></button>
            </div>
            <iframe
              className="designer-frame"
              srcDoc={atob(DESIGNER_STUDIO_URL.substring(DESIGNER_STUDIO_URL.indexOf(',') + 1))}
              title="ArgantaEnergy Designer Studio"
              sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
            />
          </div>
        </div>
      )}
    </>
  );
}
