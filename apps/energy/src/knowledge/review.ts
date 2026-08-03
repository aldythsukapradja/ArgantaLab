// knowledge/review.ts — the extraction review ledger.
//
// A candidate's accept/reject decision is a HUMAN judgement, so it has to outlive
// the component that captured it. Accepting also writes a vault note, but a
// REJECT produces no artefact — without this ledger a rejected candidate would
// reappear as 'proposed' on every remount and the gate would never settle.
//
// Deliberately localStorage, not IndexedDB: this is a few hundred bytes of
// {candId → verdict}, unlike the megabytes of digests that forced Data QC onto
// IndexedDB. It sits beside the vault's own user layer (`ae_kb_user`).
import type { ExtractionCandidate } from './types';

export type Verdict = 'accepted' | 'rejected';
export type ReviewLedger = Record<string, { verdict: Verdict; at: string }>;

const KEY = 'ae_kb_review';

export function loadReviews(): ReviewLedger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ReviewLedger) : {};
  } catch { return {}; }
}

export function saveReviews(ledger: ReviewLedger): void {
  try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch { /* quota / private mode — decisions stay in-session */ }
}

export function recordReview(ledger: ReviewLedger, candId: string, verdict: Verdict, at: string): ReviewLedger {
  const next = { ...ledger, [candId]: { verdict, at } };
  saveReviews(next);
  return next;
}

/** Replay the ledger over freshly-built candidates. Extraction is deterministic,
 *  so `candId` (xc-<docId>-<n>) is stable across runs and a decision made in an
 *  earlier session still applies to the same candidate. */
export function applyReviews(cands: ExtractionCandidate[], ledger: ReviewLedger): ExtractionCandidate[] {
  return cands.map((c) => {
    const seen = ledger[c.candId];
    return seen ? { ...c, status: seen.verdict, reviewedAt: seen.at } : c;
  });
}

export interface ReviewTally { total: number; accepted: number; rejected: number; pending: number }

export function tally(cands: ExtractionCandidate[]): ReviewTally {
  let accepted = 0, rejected = 0;
  for (const c of cands) {
    if (c.status === 'accepted') accepted++;
    else if (c.status === 'rejected') rejected++;
  }
  return { total: cands.length, accepted, rejected, pending: cands.length - accepted - rejected };
}
