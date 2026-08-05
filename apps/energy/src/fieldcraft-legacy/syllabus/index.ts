import type { Mission, Slide } from '../types';
import type { DaySyllabus } from './types';
import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { DAY3 } from './day3';
import { DAY4 } from './day4';
import { DAY5 } from './day5';

export type { DaySyllabus, SyllabusMission, SyllabusMissionStep } from './types';

/** Keyed by CourseDay id so catalog.ts can attach content without importing five files. */
export const SYLLABUS: Record<string, DaySyllabus> = {
  discover: DAY1,
  'describe-design': DAY2,
  deliver: DAY3,
  operate: DAY4,
  decide: DAY5,
};

export function slidesFor(dayId: string): Slide[] {
  return SYLLABUS[dayId]?.slides ?? [];
}

/**
 * Build the runtime missions for a day. Ids are derived from the day and the
 * mission index so they stay stable across content edits - mission progress is
 * keyed on them, and a learner mid-course must not lose captured evidence
 * because a title was reworded.
 */
export function missionsFor(
  dayId: string,
  dayNumber: number,
  workspace: Mission['workspace'],
): Mission[] {
  return (SYLLABUS[dayId]?.missions ?? []).map((m, i) => ({
    id: `m-d${dayNumber}-${i + 1}`,
    dayId,
    dayNumber,
    workspace,
    title: m.title,
    brief: m.brief,
    scope: m.scope,
    output: m.output,
    steps: m.steps.map((s, si) => ({
      id: `s${si + 1}`,
      title: s.title,
      detail: s.detail,
      evidence: s.evidence,
      module: s.module,
    })),
  }));
}

/** The six-beat teaching spine every day runs. Rendered on the course overview. */
export const COURSE_SPINE = [
  { beat: 'FRAME', question: 'What decision are we making, and what would change it?' },
  { beat: 'EVIDENCE', question: 'What do we actually have, and what class of truth is it?' },
  { beat: 'METHOD', question: 'What technique applies, and where is its boundary?' },
  { beat: 'RANGE', question: 'Which uncertainty can move the decision?' },
  { beat: 'DECIDE', question: 'What is the call, and on what conditions?' },
  { beat: 'HANDOFF', question: 'What does the next stage inherit?' },
] as const;
