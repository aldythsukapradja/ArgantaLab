import type { Mission } from './types';
import { VOLVE_DAYS } from './catalog';
import { missionsFor } from './syllabus';

/**
 * Guided app missions - the hands-on labs of the course.
 *
 * A mission is the seam between Fieldcraft and the real lifecycle workspaces:
 * it pins a data scope, walks an ordered set of steps, and captures a piece of
 * learner evidence at each one. Each step names the exact module it happens in,
 * so the workspace becomes the laboratory rather than a place to get lost in.
 *
 * The content itself lives in `syllabus/`, alongside the slides it is taught
 * with, so an exercise and the lecture that sets it up cannot drift apart.
 */
export const MISSIONS: Mission[] = VOLVE_DAYS.flatMap((day) =>
  missionsFor(day.id, day.number, day.workspace),
);

export function missionsForDay(dayId: string): Mission[] {
  return MISSIONS.filter((m) => m.dayId === dayId);
}

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
