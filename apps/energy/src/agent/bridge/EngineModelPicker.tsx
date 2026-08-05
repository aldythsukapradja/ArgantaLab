// agent/bridge/EngineModelPicker.tsx — the model dropdown next to the composer.
//
// Ported from BridgeConsole.tsx's BridgeModelPicker, generalised to take any
// mark + option list so both Frontier engines (and, in read-only form, Core/Lite)
// share one component and one look.

import { useEffect, useRef, useState } from 'react';
import './bridge.css';

export interface EngineModelOption { id: string; label: string; sub: string }
type MarkComp = (p: { size?: number; color?: string }) => JSX.Element;

export function EngineModelPicker({ Mark, accent, capsulePrefix, models, model, onPick, disabled, title }: {
  Mark: MarkComp;
  accent: string;
  capsulePrefix: string;
  models: EngineModelOption[];
  model: string;
  onPick: (id: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = models.find((m) => m.id === model) || models[0];
  const label = (s: string) => (capsulePrefix ? `${capsulePrefix} ${s}` : s);

  return (
    <div className="bf-model-picker" ref={ref}>
      <button
        type="button" className="bf-model-pill mono" aria-haspopup="menu" aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)} title={title ?? `Choose the ${capsulePrefix} model`}
        disabled={disabled}
      >
        <Mark size={13} color={accent} />
        <span className="bf-model-pill-txt">{label(current.label)}</span>
        {!disabled && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      {open && !disabled && (
        <>
          <div className="bf-model-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="bf-model-menu" role="menu">
            {models.map((m) => (
              <button
                key={m.id || 'default'} type="button" role="menuitem"
                className={'bf-model-opt' + (m.id === model ? ' active' : '')}
                onClick={() => { onPick(m.id); setOpen(false); }}
              >
                <b>{label(m.label)}</b>
                <i>{m.sub}</i>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
