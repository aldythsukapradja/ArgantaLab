"use client";

import { useState, useCallback } from "react";
import { useRunner } from "../useRunner.js";
import { canPolish, polishRun } from "../fabric.js";

// The durable Library — every generation as a persisted run (kills G1/G3).
// Reads the run ledger via useRunner; survives refresh because the store
// backs it with Supabase (when creds present) or localStorage.

const STATUS_STYLE = {
  complete: { dot: "#22d3ee", label: "Complete" },
  pending: { dot: "#eab308", label: "Running" },
  failed: { dot: "#ef4444", label: "Failed" },
};

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LibraryStudio({ apiKey }) {
  const { runs, loading, backend, refresh } = useRunner();
  const [polishing, setPolishing] = useState(null); // run id in flight
  const [polishError, setPolishError] = useState(null);
  const polishEnabled = canPolish(apiKey);

  const handlePolish = useCallback(async (run) => {
    setPolishError(null);
    setPolishing(run.id);
    try {
      await polishRun(apiKey, run);
      await refresh();
    } catch (e) {
      setPolishError({ id: run.id, message: e.message });
    } finally {
      setPolishing(null);
    }
  }, [apiKey, refresh]);

  return (
    <div className="h-full w-full overflow-auto bg-transparent text-white relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Library</h1>
            <p className="text-white/40 text-[13px]">Every generation, persisted as a run.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${backend === "supabase" ? "bg-green-500" : "bg-yellow-500"}`} />
            <span className="text-[11px] font-bold text-white/70">
              {backend === "supabase" ? "Cloud (Supabase)" : "Local (this device)"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-white/30 text-sm py-20 text-center">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="text-white/30 text-sm py-20 text-center">
            No runs yet. Generate something in Image Studio — it lands here and survives refresh.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {runs.map((r) => {
              const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
              return (
                <div key={r.id} className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col hover:border-[#22d3ee]/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden">
                    {r.asset_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.asset_url} alt={r.prompt || "generation"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/20 text-xs">{st.label}…</span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <p className="text-[12px] text-white/80 leading-snug line-clamp-2" title={r.prompt}>
                      {r.prompt || "—"}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                      <span>{r.created_at ? timeAgo(r.created_at) : ""}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                        {r.provider || "?"}
                      </span>
                      <span className="text-white/40">
                        {r.cost_class === 0 ? "$0 · sovereign" : `$${r.cost || 0}`}
                      </span>
                    </div>
                    {r.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#22d3ee]/10 text-[#22d3ee]/80">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      {r.palette?.length > 0 ? (
                        <div className="flex gap-0.5" title="Deterministic palette">
                          {r.palette.slice(0, 5).map((c, k) => (
                            <span key={k} className="w-3 h-3 rounded-sm border border-white/10" style={{ background: c.hex }} />
                          ))}
                        </div>
                      ) : <span />}
                      {r.engine && <span className="text-[9px] text-white/25">{r.engine}</span>}
                    </div>

                    {/* Draft → Polish ladder: escalate a completed sovereign draft
                        to a paid model. Requires a real key (the approval gate). */}
                    {r.status === "complete" && !r.tags?.includes("polished") && (
                      <button
                        onClick={() => handlePolish(r)}
                        disabled={!polishEnabled || polishing === r.id}
                        title={polishEnabled ? "Re-run this prompt on a paid model" : "Connect an API key in Settings to enable Polish"}
                        className="mt-1 w-full text-[10px] font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-[#22d3ee]/15 to-[#a855f7]/15 text-[#22d3ee] hover:from-[#22d3ee]/25 hover:to-[#a855f7]/25"
                      >
                        {polishing === r.id ? "Polishing…" : "✦ Polish"}
                      </button>
                    )}
                    {polishError?.id === r.id && (
                      <p className="text-[9px] text-red-400/80 leading-snug">{polishError.message}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
