// Reusable quantity picker — tap Buy on a shop item → pick how many (stepper +
// 1/5/10/Max quick buttons + live total), then confirm. Used by the seed shops.
import { useState } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString();

export function QtyDialog({ item, unitCost, maxQty = 999, onBuy, onClose, currency = '🌸' }) {
  const cap = Math.max(1, Math.min(999, maxQty));
  const [qty, setQty] = useState(1);
  const clamp = (n) => Math.max(1, Math.min(cap, Math.floor(Number(n) || 1)));
  const total = qty * unitCost;
  const buy = () => { onBuy(qty); onClose(); };
  return (
    <div className="qty-scrim" onClick={onClose}>
      <div className="qty-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="qty-head"><span className="qty-ico">{item.emoji || item.icon || '📦'}</span>
          <b>{item.name}</b><span className="qty-unit">{currency}{fmt(unitCost)} each</span></div>
        <div className="qty-stepper">
          <button type="button" onClick={() => setQty((q) => clamp(q - 1))} aria-label="less">−</button>
          <input type="number" min="1" max={cap} value={qty} onChange={(e) => setQty(clamp(e.target.value))} />
          <button type="button" onClick={() => setQty((q) => clamp(q + 1))} aria-label="more">+</button>
        </div>
        <div className="qty-quick">
          {[1, 5, 10].map((n) => (
            <button type="button" key={n} disabled={n > cap} className={qty === n ? 'on' : ''} onClick={() => setQty(clamp(n))}>{n}</button>
          ))}
          <button type="button" className={qty === cap ? 'on' : ''} onClick={() => setQty(cap)}>Max</button>
        </div>
        <div className="qty-total">Total <b>{currency}{fmt(total)}</b></div>
        <div className="qty-actions">
          <button type="button" className="rbtn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="rbtn" onClick={buy}>Buy {qty} · {currency}{fmt(total)}</button>
        </div>
      </div>
    </div>
  );
}
