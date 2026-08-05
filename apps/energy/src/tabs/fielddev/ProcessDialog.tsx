// ProcessDialog — a Petrel-style process window.
//
// Petrel's rule, reproduced: a process dialog FLOATS OVER the 3D window rather than
// replacing it, because the whole point of a modelling dialog is to watch what it
// does to the model while you change it. A dialog that covers its own result is a
// dialog you have to close to use.
//
// So it is:
//   · draggable by the title bar, anywhere over the canvas
//   · resizable from the bottom-right grip
//   · DOUBLE-CLICK THE TITLE toggles dock ↔ float — Petrel's own gesture
//   · minimisable to its title bar, so you can park one and open another
//   · click-to-focus, with a z-order, because two open at once is normal
//
// It is deliberately NOT modal. Nothing here blocks the canvas, the Input tree or
// another process.
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Minus, PanelRightClose, Square, X } from 'lucide-react';
import { useStatic, type DialogWindow, type ProcessDef } from './static-store';

export function ProcessDialog({ def, win, children, footer }: {
  def: ProcessDef;
  win: DialogWindow;
  children: ReactNode;
  /** the Apply/Close row — supplied by the process so it can name its own verb */
  footer?: ReactNode;
}) {
  const { close, focus, move, resize, toggleDock, toggleMin } = useStatic();
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const sizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (dragRef.current) {
      // clamp so a window can never be dragged fully off its own host
      move(def.id, Math.max(-40, e.clientX - dragRef.current.dx), Math.max(0, e.clientY - dragRef.current.dy));
    } else if (sizeRef.current) {
      const s = sizeRef.current;
      resize(def.id, s.w + (e.clientX - s.x), s.h + (e.clientY - s.y));
    }
  }, [def.id, move, resize]);

  const onPointerUp = useCallback(() => { dragRef.current = null; sizeRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const style = win.docked
    ? undefined
    : { left: win.x, top: win.y, width: win.w, height: win.minimised ? undefined : win.h, zIndex: win.z };

  return (
    <div className={'pdlg' + (win.docked ? ' docked' : '') + (win.minimised ? ' min' : '')}
      style={style} onPointerDown={() => focus(def.id)}>
      <header
        onPointerDown={(e) => {
          if (win.docked) return;
          dragRef.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
        }}
        // Petrel's gesture: double-clicking the window toggles its docking state
        onDoubleClick={() => toggleDock(def.id)}
        title="Drag to move · double-click to dock or float"
      >
        <b>{def.label}</b>
        <em>{def.step}</em>
        <span className="pdlg-sp" />
        <button title={win.docked ? 'Float' : 'Dock to the right'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleDock(def.id)}><PanelRightClose size={11} /></button>
        <button title={win.minimised ? 'Restore' : 'Minimise'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleMin(def.id)}>{win.minimised ? <Square size={10} /> : <Minus size={11} />}</button>
        <button title="Close" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => close(def.id)}><X size={11} /></button>
      </header>
      {!win.minimised && (
        <>
          <div className="pdlg-sub">{def.purpose}</div>
          <div className="pdlg-body">{children}</div>
          {footer && <div className="pdlg-foot">{footer}</div>}
          {!win.docked && (
            <span className="pdlg-grip" title="Resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                sizeRef.current = { x: e.clientX, y: e.clientY, w: win.w, h: win.h };
              }} />
          )}
        </>
      )}
    </div>
  );
}
