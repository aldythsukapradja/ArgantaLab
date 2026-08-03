import { useSyncExternalStore } from 'react';
import type { Competency, DayScore, Question, QuizAttempt, Session, Team } from './types';
import { DAY_MAX, RUBRIC_MAX } from './types';

/**
 * Fieldcraft session runtime.
 *
 * A five-day instructor-led course cannot lose its state on a refresh, so every
 * mutable thing the classroom produces — teams, scores, quiz attempts, the
 * active day — lives here and is persisted.
 *
 * Persistence goes through the `SessionStore` seam. Today that is localStorage;
 * a cohort-backed (Supabase) implementation can drop in without touching any
 * component, because components only ever talk to the action helpers below.
 */

export type SessionStore = {
  load(): Session | null;
  save(session: Session): void;
};

const KEY = 'fieldcraft-session-v1';

export const localSessionStore: SessionStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  save(session) {
    try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* private mode */ }
  },
};

let store: SessionStore = localSessionStore;
/** Swap the persistence backend (e.g. to a cohort-backed store) before first render. */
export function setSessionStore(next: SessionStore) {
  store = next;
  state = hydrate(store.load());
  emit();
}

const TEAM_PALETTE = ['#22d3ee', '#0fb5a6', '#7c3aed', '#f59e0b', '#e11d74', '#38bdf8'];

function defaultSession(): Session {
  return {
    version: 1,
    cohort: 'Volve Mission · Cohort 001',
    dayIndex: 0,
    teams: [
      { id: 'northstar', name: 'Northstar', color: TEAM_PALETTE[0], scores: {} },
      { id: 'aegir', name: 'Aegir', color: TEAM_PALETTE[1], scores: {} },
      { id: 'deep-blue', name: 'Deep Blue', color: TEAM_PALETTE[2], scores: {} },
      { id: 'valhall', name: 'Valhall', color: TEAM_PALETTE[3], scores: {} },
    ],
    attempts: [],
    finalUnlocked: false,
    missions: {},
    activeMission: null,
    returnTo: null,
  };
}

/** Tolerate partial or older payloads rather than throwing away a live session. */
function hydrate(raw: Session | null): Session {
  const base = defaultSession();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: 1,
    cohort: typeof raw.cohort === 'string' ? raw.cohort : base.cohort,
    dayIndex: Number.isFinite(raw.dayIndex) ? Math.max(0, Math.min(4, raw.dayIndex)) : 0,
    teams: Array.isArray(raw.teams)
      ? raw.teams.filter((t) => t && typeof t.id === 'string').map((t) => ({
          id: t.id,
          name: typeof t.name === 'string' ? t.name : t.id,
          color: typeof t.color === 'string' ? t.color : TEAM_PALETTE[0],
          scores: t.scores && typeof t.scores === 'object' ? t.scores : {},
        }))
      : base.teams,
    attempts: Array.isArray(raw.attempts) ? raw.attempts.filter((a) => a && typeof a.id === 'string') : [],
    finalUnlocked: raw.finalUnlocked === true,
    missions: raw.missions && typeof raw.missions === 'object' ? raw.missions : {},
    activeMission: typeof raw.activeMission === 'string' ? raw.activeMission : null,
    returnTo: raw.returnTo === 'labs' ? 'labs' : null,
  };
}

let state: Session = hydrate(store.load());
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function snapshot() { return state; }

function commit(next: Session) {
  state = next;
  store.save(state);
  emit();
}

/** Subscribe a component to the live session. */
export function useSession(): Session {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getSession(): Session { return state; }

/* ── Actions ────────────────────────────────────────────────────────────── */

export function setDayIndex(dayIndex: number) {
  commit({ ...state, dayIndex: Math.max(0, Math.min(4, dayIndex)) });
}

export function setCohort(cohort: string) {
  commit({ ...state, cohort });
}

export function setFinalUnlocked(finalUnlocked: boolean) {
  commit({ ...state, finalUnlocked });
}

export function addTeam(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const id = `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${state.teams.length + 1}`;
  const color = TEAM_PALETTE[state.teams.length % TEAM_PALETTE.length];
  commit({ ...state, teams: [...state.teams, { id, name: trimmed, color, scores: {} }] });
}

export function renameTeam(id: string, name: string) {
  commit({ ...state, teams: state.teams.map((t) => (t.id === id ? { ...t, name } : t)) });
}

export function removeTeam(id: string) {
  commit({ ...state, teams: state.teams.filter((t) => t.id !== id) });
}

/** Clamp each rubric criterion to its published maximum so a total can never exceed 100. */
export function setTeamScore(teamId: string, dayId: string, patch: Partial<DayScore>) {
  commit({
    ...state,
    teams: state.teams.map((t) => {
      if (t.id !== teamId) return t;
      const current: DayScore = t.scores[dayId] ?? { workflow: 0, evidence: 0, decision: 0, quiz: 0 };
      const merged = { ...current, ...patch };
      const clamped: DayScore = {
        workflow: clamp(merged.workflow, RUBRIC_MAX.workflow),
        evidence: clamp(merged.evidence, RUBRIC_MAX.evidence),
        decision: clamp(merged.decision, RUBRIC_MAX.decision),
        quiz: clamp(merged.quiz, RUBRIC_MAX.quiz),
      };
      return { ...t, scores: { ...t.scores, [dayId]: clamped } };
    }),
  });
}

function clamp(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function recordAttempt(attempt: QuizAttempt) {
  commit({ ...state, attempts: [...state.attempts, attempt] });
}

export function resetSession() {
  commit(defaultSession());
}

/* ── Missions ───────────────────────────────────────────────────────────── */

/** Start (or resume) a mission and make it the one riding alongside the workspaces. */
export function startMission(missionId: string) {
  const existing = state.missions[missionId];
  commit({
    ...state,
    activeMission: missionId,
    missions: existing
      ? state.missions
      : { ...state.missions, [missionId]: { startedAt: Date.now(), steps: {} } },
  });
}

/** Put the HUD away without discarding what the learner has captured. */
export function pauseMission() {
  commit({ ...state, activeMission: null, returnTo: 'labs' });
}

/** Step back to the Labs board without ending the mission — the HUD returns
 *  as soon as the learner navigates back into the workspace. */
export function requestLabsView() {
  commit({ ...state, returnTo: 'labs' });
}

/** Consumed by Fieldcraft on mount so it reopens where the learner left off. */
export function clearReturnTo() {
  if (!state.returnTo) return;
  commit({ ...state, returnTo: null });
}

export function saveStepEvidence(missionId: string, stepId: string, text: string) {
  const progress = state.missions[missionId] ?? { startedAt: Date.now(), steps: {} };
  commit({
    ...state,
    missions: { ...state.missions, [missionId]: { ...progress, steps: { ...progress.steps, [stepId]: text } } },
  });
}

/** A mission completes only when every step carries captured evidence. */
export function completeMission(missionId: string, stepIds: string[]) {
  const progress = state.missions[missionId];
  if (!progress || !stepIds.every((id) => (progress.steps[id] ?? '').trim())) return;
  commit({
    ...state,
    activeMission: null,
    returnTo: 'labs',
    missions: { ...state.missions, [missionId]: { ...progress, completedAt: Date.now() } },
  });
}

export function missionStepsDone(session: Session, missionId: string, stepIds: string[]): number {
  const progress = session.missions[missionId];
  if (!progress) return 0;
  return stepIds.filter((id) => (progress.steps[id] ?? '').trim()).length;
}

export function isMissionComplete(session: Session, missionId: string): boolean {
  return !!session.missions[missionId]?.completedAt;
}

/* ── Derivations ────────────────────────────────────────────────────────── */

export function teamTotal(team: Team): number {
  return Object.values(team.scores).reduce(
    (sum, s) => sum + s.workflow + s.evidence + s.decision + s.quiz,
    0,
  );
}

/** Points available so far — days that have been scored for at least one team. */
export function pointsPossible(session: Session): number {
  const scoredDays = new Set<string>();
  session.teams.forEach((t) => Object.keys(t.scores).forEach((d) => scoredDays.add(d)));
  return scoredDays.size * DAY_MAX;
}

export function leaderboard(session: Session): Array<Team & { total: number }> {
  return session.teams
    .map((t) => ({ ...t, total: teamTotal(t) }))
    .sort((a, b) => b.total - a.total);
}

/** The best attempt for a scope, which is what the Passport and gating read. */
export function bestAttempt(session: Session, scope: QuizAttempt['scope']): QuizAttempt | null {
  const forScope = session.attempts.filter((a) => a.scope === scope);
  if (!forScope.length) return null;
  return forScope.reduce((best, a) => (a.correct / a.total > best.correct / best.total ? a : best));
}

export const PASS_MARK = 0.8;

/** Grade a submission and shape it into a storable attempt. */
export function gradeAttempt(
  scope: QuizAttempt['scope'],
  questions: Question[],
  answers: Record<string, number>,
): QuizAttempt {
  const byCompetency: QuizAttempt['byCompetency'] = {};
  let correct = 0;
  questions.forEach((q) => {
    const hit = answers[q.id] === q.answer;
    if (hit) correct += 1;
    const bucket = byCompetency[q.competency] ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (hit) bucket.correct += 1;
    byCompetency[q.competency] = bucket;
  });
  const total = questions.length;
  return {
    id: `${scope}-${Date.now()}`,
    scope,
    submittedAt: Date.now(),
    answers,
    correct,
    total,
    passed: total > 0 && correct / total >= PASS_MARK,
    byCompetency,
  };
}

/** Competency mastery across every attempt, for the Passport profile. */
export function competencyProfile(session: Session): Partial<Record<Competency, number>> {
  const totals: Partial<Record<Competency, { correct: number; total: number }>> = {};
  session.attempts.forEach((a) => {
    Object.entries(a.byCompetency).forEach(([key, value]) => {
      if (!value) return;
      const c = key as Competency;
      const bucket = totals[c] ?? { correct: 0, total: 0 };
      bucket.correct += value.correct;
      bucket.total += value.total;
      totals[c] = bucket;
    });
  });
  const out: Partial<Record<Competency, number>> = {};
  Object.entries(totals).forEach(([key, value]) => {
    if (value && value.total) out[key as Competency] = Math.round((value.correct / value.total) * 100);
  });
  return out;
}
