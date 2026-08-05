// agent/bridge/BridgeConnectDialog.tsx — token + URL, ported from
// BridgeConsole.tsx's BridgeConnectDialog. Same mixed-content guard (an HTTPS
// page can't open ws://), same "is the bridge even running" messaging.

import { useEffect } from 'react';
import type { BridgeStatus } from './client.ts';
import './bridge.css';

export function BridgeConnectDialog({ engineName, status, token, url, onToken, onUrl, onConnect, onClose }: {
  engineName: string;
  status: BridgeStatus;
  token: string;
  url: string;
  onToken: (v: string) => void;
  onUrl: (v: string) => void;
  onConnect: () => void;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusClass = status === 'unauthorized' ? 'bad' : status === 'connecting' ? 'warn' : '';

  return (
    <div className="bf-connect-scrim" onClick={onClose} role="presentation">
      <div className="bf-connect-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bf-connect-brand">
          <span>{engineName} bridge</span>
          {onClose && <button type="button" className="bf-connect-close" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className={`bf-connect-status ${statusClass}`}>
          <span className={`bf-dot ${statusClass}`} />
          {status === 'unauthorized'
            ? "Can't reach the bridge — start it (npm start in tools/arganta-bridge) and check the URL/token"
            : status === 'connecting' ? 'Connecting…' : `Connect to the Arganta Bridge for ${engineName}`}
        </div>
        <label className="bf-field">
          <span>Bridge URL</span>
          <input
            type="text" placeholder="ws://127.0.0.1:7717 (or wss://…ts.net on mobile)"
            value={url} onChange={(e) => onUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onConnect(); }}
          />
          {typeof window !== 'undefined' && window.location.protocol === 'https:' && /^ws:\/\//i.test(url.trim()) && (
            <span className="bf-field-warn">
              This page is HTTPS — a <code>ws://</code> address is blocked. Use your <code>wss://</code> Tailscale-serve URL.
            </span>
          )}
        </label>
        <label className="bf-field">
          <span>Token</span>
          <input
            type="password" placeholder="Bridge token (from tools/arganta-bridge/.env)"
            value={token} onChange={(e) => onToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onConnect(); }}
          />
        </label>
        <button type="button" className="bf-connect-btn" onClick={onConnect} disabled={!token}>Connect</button>
      </div>
    </div>
  );
}
