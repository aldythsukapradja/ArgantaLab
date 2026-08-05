// agent/bridge/BridgeFeedItem.tsx — one Bridge event, rendered.
//
// Ported from apps/hq/src/surfaces/core/BridgeConsole.tsx's FeedRow +
// BridgePreviews, trimmed to what apps/energy actually has: no preview-pane bus
// (opens in a new tab instead), no ClaudeMark/OpenAIMark brand SVGs (a plain
// text badge — this app's icon language is lucide-react + text capsules, not
// custom brand marks).

import type { ReactNode } from 'react';
import './bridge.css';

// Same extraction regexes as HQ's console — pull previewable results out of a
// mission's text so the user can SEE them without leaving the chat.
const IMG_RE = /https?:\/\/[^\s)"'<>\]]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s)"'<>\]]*)?/gi;
const URL_RE = /https?:\/\/[^\s)"'<>\]]+/gi;
const LOCAL_RE = /(?:[A-Za-z]:[\\/]|[\\/])[^`\n\r"'<>|]*?(?:generated-media|generated_images)[\\/][^`\n\r"'<>|]*?\.(?:png|jpe?g|gif|webp|avif|svg|html?|mp4|webm|mp3|wav)/gi;
const baseName = (p: string) => p.split(/[\\/]/).pop() || p;
const isImageRef = (p: string) => /\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?|#|$)/i.test(p);

function extractPreviewables(text: string): { images: string[]; pages: string[] } {
  const images = Array.from(new Set(text.match(IMG_RE) || []));
  const imgSet = new Set(images);
  const pages = Array.from(new Set(text.match(URL_RE) || []))
    .filter((u) => !imgSet.has(u) && /(\.html?(\?|#|$)|localhost|127\.0\.0\.1|\.ts\.net|vercel\.app|\.pages\.dev)/i.test(u));
  return { images, pages };
}

/** `fileBase`/`token` (the connected bridge's http origin + token) additionally
 *  preview a LOCAL generated file — a codex built-in image, a single-file .html
 *  the mission wrote — via the bridge's own /file endpoint. */
function BridgePreviews({ text, fileBase, token }: { text: string; fileBase?: string; token?: string }) {
  const { images, pages } = extractPreviewables(text);
  const httpBasenames = new Set(images.map(baseName));
  const fileUrl = (p: string) => `${fileBase}/file?path=${encodeURIComponent(p)}&token=${encodeURIComponent(token || '')}`;
  const locals = fileBase && token ? Array.from(new Set(text.match(LOCAL_RE) || [])) : [];
  const localImages = locals.filter((p) => isImageRef(p) && !httpBasenames.has(baseName(p))).map(fileUrl);
  const localPages = locals.filter((p) => /\.html?$/i.test(p)).map(fileUrl);

  const allImages = [...images, ...localImages];
  const allPages = [...pages, ...localPages];
  if (!allImages.length && !allPages.length) return null;
  return (
    <div className="bf-previews">
      {allImages.map((src) => (
        <a key={src} className="bf-preview-img" href={src} target="_blank" rel="noreferrer" title="Open full size">
          <img src={src} alt="Generated result" loading="lazy" onError={(e) => { const a = e.currentTarget.closest('.bf-preview-img') as HTMLElement | null; if (a) a.style.display = 'none'; }} />
        </a>
      ))}
      {allPages.map((url) => (
        <button type="button" key={url} className="bf-preview-open" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 5.6 H14.5" stroke="currentColor" strokeWidth="1.4" /></svg>
          Open preview
        </button>
      ))}
    </div>
  );
}

export type BridgeMsgKind =
  | { kind: 'status' | 'tool'; label: string }
  /** Consecutive status/tool events, collapsed into ONE feed item.
   *
   *  Each event used to become its own ARGANTA bubble, so "Planning mission"
   *  and "Reading repository" arrived as two separate messages from the
   *  assistant -- which reads as the agent talking twice rather than as one
   *  mission making progress. They are the same mission; they belong in the
   *  same box. */
  | { kind: 'steps'; steps: { label: string; kind: 'status' | 'tool' }[]; running?: boolean }
  | { kind: 'approval'; approvalId: string; tool: string; label: string; input: unknown; resolved?: 'approved' | 'denied' }
  | { kind: 'done'; ok: boolean; result?: string; costUsd?: number; engineLabel?: string }
  | { kind: 'error'; message: string };

export function BridgeFeedItem({ item, fileBase, token, onResolve, renderMarkdown }: {
  item: BridgeMsgKind;
  fileBase?: string;
  token?: string;
  onResolve: (approvalId: string, approved: boolean, input: unknown) => void;
  /** CosmoChat's own mdToHtml — one markdown renderer for the whole app, not a
   *  second implementation. */
  renderMarkdown: (md: string) => string;
}): ReactNode {
  switch (item.kind) {
    case 'steps':
      return (
        <div className="bf-steps">
          {item.steps.map((s, i) => {
            const last = i === item.steps.length - 1;
            return (
              <div key={i} className={'bf-step' + (last && item.running ? ' is-live' : ' is-done')}>
                <span className="bf-step-dot" />
                <span className="bf-step-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      );
    case 'status':
      return <div className="bf-status">{item.label}</div>;
    case 'tool':
      return <div className="bf-tool"><span className="bf-tick" />{item.label}</div>;
    case 'error':
      return <div className="bf-error">⚠ {item.message}</div>;
    case 'done':
      return (
        <div className={`bf-done ${item.ok ? 'ok' : 'bad'}`}>
          <div className="bf-done-head">
            <strong>{item.ok ? 'Mission complete' : 'Mission failed'}</strong>
            {item.engineLabel && <span className="bf-model-capsule mono">{item.engineLabel}</span>}
            {item.costUsd != null && <span className="bf-cost">${item.costUsd.toFixed(4)}</span>}
          </div>
          {item.result && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(item.result) }} />}
          {item.result && <BridgePreviews text={item.result} fileBase={fileBase} token={token} />}
        </div>
      );
    case 'approval':
      return (
        <div className={`bf-approval ${item.resolved || ''}`}>
          <div className="bf-approval-head">Approval required · <code>{item.tool}</code></div>
          <div className="bf-approval-label">{item.label}</div>
          {!item.resolved ? (
            <div className="bf-approval-actions">
              <button type="button" className="bf-approve" onClick={() => onResolve(item.approvalId, true, item.input)}>Approve</button>
              <button type="button" className="bf-deny" onClick={() => onResolve(item.approvalId, false, item.input)}>Deny</button>
            </div>
          ) : <div className={`bf-approval-done ${item.resolved}`}>{item.resolved === 'approved' ? 'Approved' : 'Denied'}</div>}
        </div>
      );
    default:
      return null;
  }
}

/** The mission-body text, rendered through the app's own markdown + preview
 *  extraction. For a plain streamed `message` event (rendered as a normal chat
 *  bubble, not through BridgeFeedItem — see CosmoChat's bridge branch). */
export function BridgeMessageExtras({ text, fileBase, token }: { text: string; fileBase?: string; token?: string }) {
  return <BridgePreviews text={text} fileBase={fileBase} token={token} />;
}
