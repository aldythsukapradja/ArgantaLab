import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { Farm } from './farm.js';
import { Hud } from '../ui/Hud.jsx';
import { Panels } from '../ui/Panels.jsx';

// Mounts the Pixi farm, wires nipplejs (touch) + WASD/arrows (desktop) into the
// engine, and renders the React HUD/panels on top.
export default function FarmView({ profile }) {
  const hostRef = useRef(null);
  const stickRef = useRef(null);
  const gameRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [panel, setPanel] = useState(null); // 'shop' | 'barn' | 'kin' | 'house' | null

  useEffect(() => {
    const game = new Farm(profile);
    gameRef.current = game;
    if (import.meta.env.DEV) window.__farm = game; // dev handle for debugging
    let unsub = () => {};
    let manager = null;
    game.init(hostRef.current, stickRef.current).then(() => {
      unsub = game.subscribe(setSnap);
      // nipplejs virtual joystick (touch / mouse in the bottom-left zone)
      try {
        manager = nipplejs.create({
          zone: stickRef.current,
          mode: 'dynamic',
          color: 'rgba(139,92,246,0.6)',
          size: 110,
          restJoystick: true,
        });
        manager.on('move', (_e, d) => {
          if (!d?.vector) return;
          game.setControl(d.vector.x, -d.vector.y); // nipple Y up -> world Y down
        });
        manager.on('end', () => game.setControl(0, 0));
      } catch (err) { console.warn('joystick init failed', err); }
    });

    // keyboard
    const keys = { up: false, down: false, left: false, right: false };
    const apply = () => game.setControl((keys.right ? 1 : 0) - (keys.left ? 1 : 0), (keys.down ? 1 : 0) - (keys.up ? 1 : 0));
    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = true;
      else if (k === 's' || k === 'arrowdown') keys.down = true;
      else if (k === 'a' || k === 'arrowleft') keys.left = true;
      else if (k === 'd' || k === 'arrowright') keys.right = true;
      else if (k === ' ' || k === 'e') { e.preventDefault(); game.action(); return; }
      else if (k === '1') { game.setTool('hoe'); return; }
      else if (k === '2') { game.setTool('seed'); return; }
      else if (k === '3') { game.setTool('can'); return; }
      else return;
      e.preventDefault(); apply();
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = false;
      else if (k === 's' || k === 'arrowdown') keys.down = false;
      else if (k === 'a' || k === 'arrowleft') keys.left = false;
      else if (k === 'd' || k === 'arrowright') keys.right = false;
      else return;
      apply();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const onHide = () => game.save();
    window.addEventListener('beforeunload', onHide);

    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('beforeunload', onHide);
      unsub();
      try { manager?.destroy(); } catch { /* ignore */ }
      game.destroy();
    };
  }, [profile]);

  return (
    <div className="game-root">
      <div className="pixi-host" ref={hostRef} />
      <div className="stick-zone" ref={stickRef} />
      {snap && (
        <>
          <Hud snap={snap} game={gameRef.current} onOpen={setPanel} />
          <Panels panel={panel} snap={snap} game={gameRef.current} onClose={() => setPanel(null)} />
        </>
      )}
      {!snap && <div className="loading">Growing your valley…</div>}
    </div>
  );
}
