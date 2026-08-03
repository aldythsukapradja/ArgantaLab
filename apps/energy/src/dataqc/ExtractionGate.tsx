// dataqc/ExtractionGate.tsx — the Extraction Studio's mirror inside Data QC.
//
// Deliberately READ-ONLY and state-free: it reports where this field's documents
// sit in the review gate and routes to the real Studio (Intelligence → Knowledge →
// Extraction Studio), which owns the queue, the accept/reject decisions and the
// vault writes. Two surfaces, one source of truth.
import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, ArrowUpRight } from 'lucide-react';
import { useStore } from '../store';
import { applyReviews, loadReviews, tally, type ReviewTally } from '../knowledge/review';
import type { ExtractionCandidate } from '../knowledge/types';
import { readRecord } from './readDigest.ts';
import type { IngestedAsset } from './types.ts';

interface DocPayload { candidates?: ExtractionCandidate[] }

export function ExtractionGate({ assets }: { assets: IngestedAsset[] }) {
  const requestNav = useStore((s) => s.requestNav);
  const [counts, setCounts] = useState<ReviewTally | null>(null);

  const docs = useMemo(() => assets.filter((a) => a.kind === 'document'), [assets]);

  useEffect(() => {
    if (!docs.length) { setCounts(null); return; }
    let dead = false;
    (async () => {
      const all: ExtractionCandidate[] = [];
      for (const d of docs) {
        const p = await readRecord<DocPayload>(d);   // cached after the first read
        if (dead) return;
        if (p?.candidates) all.push(...p.candidates);
      }
      if (dead) return;
      setCounts(tally(applyReviews(all, loadReviews())));
    })().catch(() => { if (!dead) setCounts(null); });
    return () => { dead = true; };
  }, [docs]);

  if (!docs.length) return null;

  return (
    <>
      <div className="dqc-h"><FlaskConical size={11} /> Extraction gate</div>
      <div className="dqc-kv"><span>documents</span><span>{docs.length}</span></div>
      {counts ? (
        <>
          <div className="dqc-kv"><span>candidates</span><span>{counts.total}</span></div>
          <div className="dqc-kv"><span>pending review</span><span>{counts.pending}</span></div>
          <div className="dqc-kv"><span>in vault · rejected</span><span>{counts.accepted} · {counts.rejected}</span></div>
        </>
      ) : (
        <div className="dqc-kv"><span>candidates</span><span>reading…</span></div>
      )}
      <button className="dqc-gate-link" onClick={() => requestNav('knowledge', 'extraction')}>
        Open Extraction Studio <ArrowUpRight size={12} />
      </button>
      <div className="dqc-gate-note">
        Review happens in the Studio — nothing reaches the knowledge vault without an explicit accept.
      </div>
    </>
  );
}
