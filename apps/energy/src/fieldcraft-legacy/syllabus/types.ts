import type { Slide } from '../types';

/**
 * One day of authored course content.
 *
 * The syllabus is kept apart from `catalog.ts` because it is the bulk of the
 * course and changes on a different cadence to the platform metadata. Every day
 * runs the same six-beat spine - FRAME, EVIDENCE, METHOD, RANGE, DECIDE,
 * HANDOFF - and each day ends by handing a gate card to the next.
 */
export type SyllabusMissionStep = {
  title: string;
  detail: string;
  /** What the learner must capture. This is what gets graded. */
  evidence: string;
  /** Module id inside the day's workspace, used to deep-link the learner. */
  module: string;
};

export type SyllabusMission = {
  title: string;
  brief: string;
  scope: string;
  output: string;
  steps: SyllabusMissionStep[];
};

export type DaySyllabus = {
  slides: Slide[];
  missions: SyllabusMission[];
};
