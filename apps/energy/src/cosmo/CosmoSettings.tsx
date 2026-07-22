// CosmoSettings — the Settings modal ported 1:1 from COSMO_Final.html (SettingsModal).
// Sections: DESIGN SYSTEM (Designer Studio → embedded 80% designer), APPEARANCE (theme
// Light/Dark selector · density · motion), FOUNDATION (governed workspace). Theme mode
// drives the shell's dark state; the Designer Studio embeds the verbatim data: URL app.
import { useState } from 'react';
import { Settings, X, Palette, Sun, Moon, Rows3, Sparkles, Shield, Minimize2 } from 'lucide-react';
import { DESIGNER_STUDIO_URL } from './designer-studio-url';

export function CosmoSettings({ open, onClose, dark, setDark }: {
  open: boolean; onClose: () => void; dark: boolean; setDark: (v: boolean) => void;
}) {
  const [designer, setDesigner] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const [motion, setMotion] = useState(true);
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

            <div className="set-sec">FOUNDATION</div>
            <div className="set-row">
              <span className="si"><Shield size={15} /></span>
              <div><div className="st">C1-controlled workspace</div><div className="sd">Permissions, routing and export controls require production services</div></div>
              <span className="chip">GOVERNED</span>
            </div>
          </div>
        </div>
      </div>

      {designer && (
        <div className="designer-scrim">
          <div className="designer-modal">
            <div className="designer-head">
              <Palette size={17} style={{ color: 'var(--teal)' }} />
              <div><b>COSMO Designer Studio</b><br /><span>embedded previous designer · 80% canvas</span></div>
              <div className="sp" />
              <button className="wbtn" onClick={() => setDesigner(false)}><Minimize2 size={13} /> Back to settings</button>
              <button className="mx" onClick={closeAll}><X size={15} /></button>
            </div>
            <iframe
              className="designer-frame"
              srcDoc={atob(DESIGNER_STUDIO_URL.substring(DESIGNER_STUDIO_URL.indexOf(',') + 1))}
              title="COSMO Designer Studio"
              sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
            />
          </div>
        </div>
      )}
    </>
  );
}
