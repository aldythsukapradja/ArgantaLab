export type FieldcraftTab = 'home' | 'catalog' | 'pathways' | 'live' | 'passport' | 'studio';
export type CourseTab = 'overview' | 'learn' | 'labs' | 'assessments' | 'resources';
export type CourseStatus = 'flagship' | 'live' | 'coming-soon' | 'draft';

export type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  note: string;
};

export type Material = {
  id: string;
  title: string;
  kind: 'Presentation' | 'Instructor guide' | 'Learner workbook' | 'Challenge pack' | 'Reference' | 'Assessment';
  meta: string;
  status: 'Ready' | 'Review' | 'Draft';
};

export type CourseDay = {
  id: string;
  number: number;
  verb: string;
  title: string;
  lifecycle: string;
  color: string;
  question: string;
  outcome: string;
  workspace: 'exploration' | 'field-development' | 'well-delivery' | 'reservoir-management' | 'cockpit';
  schedule: Array<{ time: string; label: string; mode: 'Brief' | 'Theory' | 'Demo' | 'Lab' | 'Challenge' | 'Assessment' | 'Break'; detail: string }>;
  slides: Slide[];
  materials: Material[];
};

/* ── Assessment ─────────────────────────────────────────────────────────── */

export type Competency =
  | 'evidence' | 'exploration' | 'field-development'
  | 'well-delivery' | 'reservoir-management' | 'integrated';

export type QuestionScope = 'day1' | 'day2' | 'day3' | 'day4' | 'final';

export type Question = {
  id: string;
  scope: QuestionScope;
  competency: Competency;
  stem: string;
  options: string[];
  /** 0-based index into `options`. */
  answer: number;
  explanation: string;
};

export type QuizAttempt = {
  id: string;
  scope: QuestionScope;
  submittedAt: number;
  /** questionId → chosen option index. */
  answers: Record<string, number>;
  correct: number;
  total: number;
  passed: boolean;
  /** correct / total per competency, for the Passport profile. */
  byCompetency: Partial<Record<Competency, { correct: number; total: number }>>;
};

/* ── Live scoring ───────────────────────────────────────────────────────── */

/** The rubric shown on the mission card: 40 / 20 / 20 / 20 = 100 per day. */
export type DayScore = { workflow: number; evidence: number; decision: number; quiz: number };
export const RUBRIC_MAX: DayScore = { workflow: 40, evidence: 20, decision: 20, quiz: 20 };
export const DAY_MAX = RUBRIC_MAX.workflow + RUBRIC_MAX.evidence + RUBRIC_MAX.decision + RUBRIC_MAX.quiz;

export type Team = {
  id: string;
  name: string;
  color: string;
  /** day id (CourseDay['id']) → rubric score. */
  scores: Record<string, DayScore>;
};

/* ── Compiled delivery materials ────────────────────────────────────────── */

export type MaterialSection = {
  heading: string;
  kind: 'prose' | 'list' | 'table' | 'steps' | 'qa';
  body?: string;
  items?: string[];
  rows?: Array<[string, string]>;
  steps?: Array<{ title: string; detail: string; capture: string }>;
  qa?: Array<{ q: string; a: string; why: string }>;
  /** Facilitator aside, rendered apart from the body. */
  note?: string;
  /** Answer keys and question banks are withheld from the learner view. */
  instructorOnly?: boolean;
};

export type MaterialDoc = {
  title: string;
  subtitle: string;
  kind: Material['kind'];
  version: string;
  sections: MaterialSection[];
};

/* ── Guided app missions ────────────────────────────────────────────────── */

export type MissionStep = {
  id: string;
  title: string;
  detail: string;
  /** What the learner must capture before the step counts as done. */
  evidence: string;
};

export type Mission = {
  id: string;
  dayId: string;
  dayNumber: number;
  workspace: CourseDay['workspace'];
  title: string;
  brief: string;
  /** The data scope the mission is pinned to. */
  scope: string;
  /** The artifact the mission produces, which the Passport records. */
  output: string;
  steps: MissionStep[];
};

export type MissionProgress = {
  startedAt: number;
  /** stepId → the evidence the learner captured. */
  steps: Record<string, string>;
  completedAt?: number;
};

/* ── Session ────────────────────────────────────────────────────────────── */

export type Session = {
  version: 1;
  cohort: string;
  dayIndex: number;
  teams: Team[];
  attempts: QuizAttempt[];
  /** The final exam is instructor-gated. */
  finalUnlocked: boolean;
  /** missionId → progress. */
  missions: Record<string, MissionProgress>;
  /** The mission whose HUD rides alongside the lifecycle workspaces. */
  activeMission: string | null;
  /** Where Fieldcraft should reopen when the learner comes back from a mission. */
  returnTo: 'labs' | null;
};

export type FieldcraftCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  instructor: string;
  status: CourseStatus;
  level: string;
  duration: string;
  delivery: string[];
  lifecycle: string;
  modules: number;
  labs: number;
  credential: string;
  accent: string;
  tags: string[];
  days?: CourseDay[];
};
