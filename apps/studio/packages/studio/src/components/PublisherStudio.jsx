"use client";

import { useState, useEffect, useCallback } from "react";
import { listRuns, listPosts, subscribe } from "../store.js";
import {
  PLATFORMS, platformFormats, composePost,
  canQueueToBuffer, getBufferToken, setBufferToken, listBufferChannels,
} from "../publish.js";

// The Publisher — turn any generation into a platform-targeted post. Posts
// appear in the Knowledge Graph as the character→generation→post leaf. Without
// a Buffer token they're local drafts; with one, they queue to Buffer for review
// (never auto-published — honoring Buffer's addToQueue semantics).

const STATUS_STYLE = {
  draft: { color: "#94a3b8", label: "Draft" },
  queued: { color: "#22d3ee", label: "Queued in Buffer" },
  published: { color: "#4ade80", label: "Published" },
  failed: { color: "#ef4444", label: "Failed" },
};

export default function PublisherStudio() {
  const [runs, setRuns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selRun, setSelRun] = useState(null);
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("post");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Buffer connection state
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    const [r, p] = await Promise.all([listRuns(200), listPosts(200)]);
    setRuns(r.filter((x) => x.status === "complete"));
    setPosts(p);
  }, []);

  useEffect(() => { refresh(); return subscribe(refresh); }, [refresh]);

  const loadChannels = useCallback(async () => {
    if (!canQueueToBuffer()) { setConnected(false); setChannels([]); return; }
    const { channels: ch } = await listBufferChannels();
    setConnected(true);
    setChannels(ch);
    if (ch[0]) setChannelId(ch[0].id);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const onConnect = async () => {
    setBufferToken(tokenInput);
    setTokenInput("");
    await loadChannels();
  };
  const onDisconnect = () => { setBufferToken(null); setConnected(false); setChannels([]); };

  const onSelectRun = (run) => {
    setSelRun(run);
    if (!caption) setCaption(run.prompt || "");
  };

  const onPublish = async () => {
    if (!selRun) return;
    setError(null); setBusy(true);
    try {
      const { queued } = await composePost({
        run: selRun, platform, format, caption,
        channelId: connected ? channelId : null,
        brand: selRun.brand,
      });
      setCaption(""); setSelRun(null);
      await refresh();
      // eslint-disable-next-line no-unused-vars
      void queued;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const formats = platformFormats(platform);
  useEffect(() => { if (!formats.includes(format)) setFormat(formats[0]); }, [platform]); // eslint-disable-line

  return (
    <div className="h-full w-full overflow-auto bg-transparent text-white relative z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Publisher</h1>
            <p className="text-white/40 text-[13px]">Turn a generation into a post. 5 platforms, one queue.</p>
          </div>
          {/* Buffer connection */}
          <div className="flex items-center gap-2">
            {connected ? (
              <div className="flex items-center gap-2 bg-[#22d3ee]/10 border border-[#22d3ee]/30 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
                <span className="text-[11px] font-bold text-[#22d3ee]">Buffer · {channels.length} channels</span>
                <button onClick={onDisconnect} className="text-[10px] text-white/40 hover:text-white ml-1">disconnect</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  type="password"
                  placeholder="Buffer API token"
                  className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-[12px] w-40 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
                />
                <button onClick={onConnect} disabled={!tokenInput.trim()} className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-30 transition-colors">Connect</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Left: pick a generation */}
          <div>
            <h2 className="text-[11px] uppercase tracking-widest text-white/30 font-bold mb-3">Pick a generation</h2>
            {runs.length === 0 ? (
              <div className="text-white/30 text-sm py-12 text-center bg-white/[0.02] rounded-xl border border-white/5">
                No completed generations yet. Make one in Image or Cinema Studio.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectRun(r)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selRun?.id === r.id ? "border-[#22d3ee] scale-95" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {r.asset_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.asset_url} alt={r.prompt} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center text-[9px] text-white/30 p-1 text-center">{r.prompt?.slice(0, 30)}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: compose */}
          <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col gap-4 h-fit lg:sticky lg:top-4">
            <h2 className="text-[11px] uppercase tracking-widest text-white/30 font-bold">Compose</h2>

            {selRun?.asset_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selRun.asset_url} alt="" className="w-full rounded-lg border border-white/10" />
            )}

            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`text-[12px] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    platform === p.id ? "bg-[#22d3ee]/15 text-[#22d3ee]" : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  <span>{p.icon}</span>{p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`text-[11px] px-2 py-1 rounded-md capitalize transition-colors ${
                    format === f ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
            />

            {connected && channels.length > 0 && (
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {channels.map((c) => <option key={c.id} value={c.id} className="bg-[#0a0a0c]">{c.name} · {c.service}</option>)}
              </select>
            )}

            {error && <p className="text-[11px] text-red-400/80">{error}</p>}

            <button
              onClick={onPublish}
              disabled={!selRun || busy}
              className="w-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-bold py-2.5 rounded-lg hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
            >
              {busy ? "Adding…" : connected ? "Queue to Buffer" : "Save as Draft"}
            </button>
            {!connected && (
              <p className="text-[10px] text-white/30 text-center -mt-1">
                Connect Buffer above to queue to Instagram, TikTok, LinkedIn & more. Drafts still appear in your Graph.
              </p>
            )}
          </div>
        </div>

        {/* Posts list */}
        {posts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[11px] uppercase tracking-widest text-white/30 font-bold mb-3">Posts ({posts.length})</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {posts.map((p) => {
                const st = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
                const plat = PLATFORMS.find((x) => x.id === p.platform);
                return (
                  <div key={p.id} className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold flex items-center gap-1.5">
                        <span>{plat?.icon}</span>{plat?.label} · <span className="capitalize text-white/50">{p.format}</span>
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-[12px] text-white/70 leading-snug line-clamp-2">{p.caption || "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
