// proposal-store.ts — retained for the in-progress Drilling Sequence (sequence/*)
// build (listProposals / listScheduleItems seed the schedule). The live Well
// The parked delivery workbench uses src/tabs/welldelivery/legacy/wdData instead; both share the
// energy_drilling_sequence_v1 key so a sanctioned candidate can surface here.
import type { WellProposal, DrillingScheduleItem } from './proposal-types';

const PROPOSALS_KEY = 'energy_well_proposals_v1';
const SEQUENCE_KEY = 'energy_drilling_sequence_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable — no-op */ }
}

export function listProposals(): WellProposal[] {
  return readJson<WellProposal[]>(PROPOSALS_KEY, []);
}

export function getProposal(id: string): WellProposal | null {
  return listProposals().find((p) => p.id === id) ?? null;
}

export function saveProposal(proposal: WellProposal): void {
  const all = listProposals();
  const i = all.findIndex((p) => p.id === proposal.id);
  const next = { ...proposal, updatedAt: new Date().toISOString() };
  if (i >= 0) all[i] = next; else all.push(next);
  writeJson(PROPOSALS_KEY, all);
}

export function deleteProposal(id: string): void {
  writeJson(PROPOSALS_KEY, listProposals().filter((p) => p.id !== id));
}

export function listScheduleItems(): DrillingScheduleItem[] {
  return readJson<DrillingScheduleItem[]>(SEQUENCE_KEY, []);
}

export function emitToDrillingSequence(proposal: WellProposal): DrillingScheduleItem {
  const items = listScheduleItems();
  const item: DrillingScheduleItem = {
    proposalId: proposal.id, well: proposal.well, p50Days: proposal.afe.p50Days,
    earliestStart: null, dependencies: [], emittedAt: new Date().toISOString(),
  };
  const i = items.findIndex((x) => x.proposalId === proposal.id);
  if (i >= 0) items[i] = item; else items.push(item);
  writeJson(SEQUENCE_KEY, items);
  return item;
}

export function isEmittedToSequence(proposalId: string): boolean {
  return listScheduleItems().some((x) => x.proposalId === proposalId);
}
