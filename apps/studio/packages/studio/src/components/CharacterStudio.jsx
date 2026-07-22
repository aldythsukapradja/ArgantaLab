"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listCharacters, createCharacter, updateCharacter, deleteCharacter,
  getActiveCharacterId, setActiveCharacter, subscribeCharacters, tokenFromName,
} from "../characters.js";

// Soul characters — persistent identities used across every studio. The active
// character's trigger token is injected into generations (see fabric.js), so
// the same Soul carries from image to image (and, with a ComfyUI LoRA, the same
// face). This surface manages them; the generation wiring is automatic.

export default function CharacterStudio() {
  const [chars, setChars] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ name: "", brand: "", notes: "", lora_ref: "" });

  const refresh = useCallback(async () => {
    setChars(await listCharacters());
    setActiveId(getActiveCharacterId());
  }, []);

  useEffect(() => { refresh(); return subscribeCharacters(refresh); }, [refresh]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    await createCharacter(draft);
    setDraft({ name: "", brand: "", notes: "", lora_ref: "" });
  };

  const previewToken = draft.name ? tokenFromName(draft.name) : "ar_…";

  return (
    <div className="h-full w-full overflow-auto bg-transparent text-white relative z-10">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-bold tracking-tight">Soul Characters</h1>
          <p className="text-white/40 text-[13px]">
            Persistent identities. Activate one and every generation carries its Soul.
          </p>
        </div>

        {/* Create */}
        <form onSubmit={onCreate} className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-5 mb-8 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Character name — e.g. Aria Vale"
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
            />
            <span className="text-[11px] font-mono text-[#22d3ee]/70 whitespace-nowrap">{previewToken}</span>
          </div>
          <input
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            placeholder="Brand (optional)"
            className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
          />
          <input
            value={draft.lora_ref}
            onChange={(e) => setDraft({ ...draft, lora_ref: e.target.value })}
            placeholder="LoRA ref (optional — for ComfyUI identity)"
            className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
          />
          <input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="sm:col-span-2 bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
          />
          <button type="submit" className="sm:col-span-2 bg-[#22d3ee] text-black font-medium py-2.5 rounded-md hover:bg-[#e5ff33] transition-all text-sm">
            Create Soul
          </button>
        </form>

        {/* List */}
        {chars.length === 0 ? (
          <div className="text-white/30 text-sm py-16 text-center">No characters yet. Create one above.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {chars.map((c) => {
              const active = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`bg-white/[0.04] backdrop-blur-md border rounded-xl p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 ${
                    active ? "border-[#22d3ee]/60 shadow-[0_0_24px_rgba(34,211,238,0.12)]" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{c.name}</h3>
                      <span className="text-[11px] font-mono text-[#22d3ee]/70">{c.trigger_token}</span>
                    </div>
                    {active && <span className="text-[9px] uppercase tracking-wider bg-[#22d3ee]/15 text-[#22d3ee] px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                  {c.brand && <span className="text-[11px] text-white/40">Brand: {c.brand}</span>}
                  {c.lora_ref && <span className="text-[10px] text-white/30 font-mono truncate">LoRA: {c.lora_ref}</span>}
                  {c.notes && <p className="text-[11px] text-white/40 leading-snug">{c.notes}</p>}
                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => setActiveCharacter(active ? null : c.id)}
                      className={`flex-1 text-[12px] font-semibold py-1.5 rounded-md transition-colors ${
                        active ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-[#22d3ee]/15 text-[#22d3ee] hover:bg-[#22d3ee]/25"
                      }`}
                    >
                      {active ? "Deactivate" : "Use this Soul"}
                    </button>
                    <button
                      onClick={() => deleteCharacter(c.id)}
                      className="px-3 text-[12px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
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
