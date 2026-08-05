import type { CourseDay, FieldcraftCourse } from './types';
import { slidesFor } from './syllabus';

const commonBreaks = [
  { time: '10:00', label: 'Morning break', mode: 'Break' as const, detail: '15 minutes' },
  { time: '12:30', label: 'Lunch', mode: 'Break' as const, detail: '60 minutes' },
  { time: '15:15', label: 'Afternoon break', mode: 'Break' as const, detail: '15 minutes' },
];

export const VOLVE_DAYS: CourseDay[] = [
  {
    id: 'discover', number: 1, verb: 'DISCOVER', title: 'Frame the opportunity', lifecycle: 'Exploration', color: '#22d3ee',
    question: 'What do we know, how do we know it, and is the opportunity mature enough to progress?',
    outcome: 'Exploration Gate Card · Progress, Study or Stop', workspace: 'exploration',
    schedule: [
      { time: '08:30', label: 'Mission launch', mode: 'Brief', detail: 'Volve story, team roles and evidence challenge' },
      { time: '09:00', label: 'Exploration mental model', mode: 'Theory', detail: 'Petroleum system, play-to-prospect and decision maturity' },
      commonBreaks[0],
      { time: '10:15', label: 'Follow the evidence', mode: 'Demo', detail: 'Cockpit → Data → Knowledge → Exploration' },
      { time: '11:15', label: 'Build the evidence pack', mode: 'Lab', detail: 'Classify sources, truth classes, conflicts and gaps' },
      commonBreaks[1],
      { time: '13:30', label: 'Risk and volume', mode: 'Theory', detail: 'Chance, uncertainty and P90/P50/P10 without false precision' },
      { time: '14:15', label: 'Screen the opportunity', mode: 'Lab', detail: 'Run the prepared risk and volumetric case' },
      commonBreaks[2],
      { time: '15:30', label: 'Progress, Study or Stop?', mode: 'Challenge', detail: 'Three-minute evidence-backed gate defense' },
      { time: '16:15', label: 'Daily check', mode: 'Assessment', detail: '10 MCQs and Lifecycle Flag' },
    ],
    slides: slidesFor('discover'),
    materials: [
      { id: 'd1-deck', title: 'Day 1 · Discover presentation', kind: 'Presentation', meta: '20 slides · full facilitator script', status: 'Ready' },
      { id: 'd1-guide', title: 'Discover facilitator guide', kind: 'Instructor guide', meta: 'Timing · demo script · answer key', status: 'Ready' },
      { id: 'd1-workbook', title: 'Evidence pack worksheet', kind: 'Learner workbook', meta: 'Truth-class matrix · gate card', status: 'Ready' },
      { id: 'd1-challenge', title: 'Progress, Study or Stop?', kind: 'Challenge pack', meta: 'Team brief · scoring rubric', status: 'Ready' },
    ],
  },
  {
    id: 'describe-design', number: 2, verb: 'DESCRIBE & DESIGN', title: 'Build the field case', lifecycle: 'Field Development', color: '#0fb5a6',
    question: 'Which subsurface and development case is technically defensible and decision-relevant?',
    outcome: 'Development Case Card · Select, Rework or Reject', workspace: 'field-development',
    schedule: [
      { time: '08:30', label: 'Mission handover', mode: 'Brief', detail: 'Exploration gate becomes the development basis' },
      { time: '09:00', label: 'Wells to reservoir model', mode: 'Theory', detail: 'Logs, correlation, structure, properties and contacts' },
      commonBreaks[0],
      { time: '10:15', label: 'Evidence to volume', mode: 'Demo', detail: 'Map → Logs → Correlation → Structure → Volumetrics' },
      { time: '11:15', label: 'QC the field case', mode: 'Lab', detail: 'Approve inputs and run a reproducible base case' },
      commonBreaks[1],
      { time: '13:30', label: 'Uncertainty, forecast and value', mode: 'Theory', detail: 'Ranges, sensitivity and decision consequences' },
      { time: '14:15', label: 'Compare development cases', mode: 'Lab', detail: 'Test two prepared cases and identify the value driver' },
      commonBreaks[2],
      { time: '15:30', label: 'Select the case', mode: 'Challenge', detail: 'Case decision, uncertainty and value-of-information action' },
      { time: '16:15', label: 'Daily check', mode: 'Assessment', detail: '10 MCQs and Lifecycle Flag' },
    ],
    slides: slidesFor('describe-design'),
    materials: [
      { id: 'd2-deck', title: 'Day 2 · Describe & Design presentation', kind: 'Presentation', meta: '20 slides · full facilitator script', status: 'Ready' },
      { id: 'd2-guide', title: 'Field case facilitator guide', kind: 'Instructor guide', meta: 'Viewer route · planted QC · answers', status: 'Ready' },
      { id: 'd2-workbook', title: 'Development case workbook', kind: 'Learner workbook', meta: 'Input QC · comparison · decision card', status: 'Ready' },
      { id: 'd2-challenge', title: 'Select the development case', kind: 'Challenge pack', meta: 'Case A/B · scoring rubric', status: 'Ready' },
    ],
  },
  {
    id: 'deliver', number: 3, verb: 'DELIVER', title: 'Turn the plan into a well', lifecycle: 'Well Delivery & Drilling', color: '#f59e0b',
    question: 'Is the proposed well technically ready, safely framed and schedulable?',
    outcome: 'Well Gate Card · Approve, Condition or Hold', workspace: 'well-delivery',
    schedule: [
      { time: '08:30', label: 'Mission handover', mode: 'Brief', detail: 'Development intent becomes a candidate well' },
      { time: '09:00', label: 'Well maturation and design', mode: 'Theory', detail: 'Objectives, targets, trajectory, offsets and risk' },
      commonBreaks[0],
      { time: '10:15', label: 'Follow one well', mode: 'Demo', detail: 'Basis → Target → Trajectory → Risk → Handover' },
      { time: '11:15', label: 'Review the well plan', mode: 'Lab', detail: 'Test target, trajectory, offsets and approval evidence' },
      commonBreaks[1],
      { time: '13:30', label: 'Executable campaign', mode: 'Theory', detail: 'Rig capacity, readiness, dependencies and revisions' },
      { time: '14:15', label: 'Protect the slot', mode: 'Lab', detail: 'Detect a sequence conflict and control the resolution' },
      commonBreaks[2],
      { time: '15:30', label: 'Approve, Condition or Hold?', mode: 'Challenge', detail: 'Well gate defense with hazard and schedule consequence' },
      { time: '16:15', label: 'Daily check', mode: 'Assessment', detail: '10 MCQs and Lifecycle Flag' },
    ],
    slides: slidesFor('deliver'),
    materials: [
      { id: 'd3-deck', title: 'Day 3 · Deliver presentation', kind: 'Presentation', meta: '20 slides · full facilitator script', status: 'Ready' },
      { id: 'd3-guide', title: 'Well delivery facilitator guide', kind: 'Instructor guide', meta: 'Trajectory demo · schedule conflict · answers', status: 'Ready' },
      { id: 'd3-workbook', title: 'Well gate workbook', kind: 'Learner workbook', meta: 'Plan review · readiness · gate card', status: 'Ready' },
      { id: 'd3-challenge', title: 'Approve, Condition or Hold?', kind: 'Challenge pack', meta: 'Well brief · scoring rubric', status: 'Ready' },
    ],
  },
  {
    id: 'operate', number: 4, verb: 'OPERATE', title: 'Monitor, diagnose and act', lifecycle: 'Reservoir Management', color: '#7c3aed',
    question: 'Which field signal matters, what is the defensible diagnosis and what should happen next?',
    outcome: 'Reservoir Action Card · Act, Acquire Data or Monitor', workspace: 'reservoir-management',
    schedule: [
      { time: '08:30', label: 'Mission handover', mode: 'Brief', detail: 'Delivered well becomes part of a producing system' },
      { time: '09:00', label: 'Surveillance and diagnosis', mode: 'Theory', detail: 'Monitor → Diagnose → Forecast → Act → Learn' },
      commonBreaks[0],
      { time: '10:15', label: 'Monitor to diagnosis', mode: 'Demo', detail: 'Surveillance → Production → Pressure → Patterns' },
      { time: '11:15', label: 'Diagnose the exception', mode: 'Lab', detail: 'Validate the signal, compare peers and request evidence' },
      commonBreaks[1],
      { time: '13:30', label: 'Forecast and opportunity', mode: 'Theory', detail: 'DCA, scenario uplift, value and closed-loop learning' },
      { time: '14:15', label: 'Screen the action', mode: 'Lab', detail: 'Compare base and intervention cases' },
      commonBreaks[2],
      { time: '15:30', label: 'Act, Acquire Data or Monitor?', mode: 'Challenge', detail: 'Diagnosis, action, expected signal and verification' },
      { time: '16:15', label: 'Daily check', mode: 'Assessment', detail: '10 MCQs and Lifecycle Flag' },
    ],
    slides: slidesFor('operate'),
    materials: [
      { id: 'd4-deck', title: 'Day 4 · Operate presentation', kind: 'Presentation', meta: '20 slides · full facilitator script', status: 'Ready' },
      { id: 'd4-guide', title: 'Reservoir management facilitator guide', kind: 'Instructor guide', meta: 'Exception demo · forecast case · answers', status: 'Ready' },
      { id: 'd4-workbook', title: 'Reservoir action workbook', kind: 'Learner workbook', meta: 'Diagnosis · forecast · action card', status: 'Ready' },
      { id: 'd4-challenge', title: 'Act, Acquire Data or Monitor?', kind: 'Challenge pack', meta: 'Event cards · scoring rubric', status: 'Ready' },
    ],
  },
  {
    id: 'decide', number: 5, verb: 'DECIDE', title: 'Integrated Field Review', lifecycle: 'Cross-lifecycle', color: '#e11d74',
    question: 'Considering the complete evidence trail, what is the next best field decision and why?',
    outcome: 'Integrated Field Decision · Fieldcraft Passport', workspace: 'cockpit',
    schedule: [
      { time: '08:30', label: 'Final mission launch', mode: 'Brief', detail: 'Integrated scenario, final roles and scoring rubric' },
      { time: '09:00', label: 'Integrated decision quality', mode: 'Theory', detail: 'Evidence chain, uncertainty propagation and option framing' },
      commonBreaks[0],
      { time: '10:15', label: 'Capstone build · Part 1', mode: 'Lab', detail: 'Use all lifecycle artifacts and the new event card' },
      commonBreaks[1],
      { time: '13:30', label: 'Capstone freeze', mode: 'Lab', detail: 'Final evidence check and decision submission' },
      { time: '13:45', label: 'The Field Review', mode: 'Challenge', detail: 'Seven-minute presentation and three-minute defense' },
      { time: '15:00', label: 'Afternoon break', mode: 'Break', detail: '15 minutes' },
      { time: '15:15', label: 'Individual final exam', mode: 'Assessment', detail: '50 scenario-led MCQs · 75 minutes' },
    ],
    slides: slidesFor('decide'),
    materials: [
      { id: 'd5-deck', title: 'Day 5 · Decide presentation', kind: 'Presentation', meta: '20 slides · full facilitator script', status: 'Ready' },
      { id: 'd5-guide', title: 'Field Review facilitator guide', kind: 'Instructor guide', meta: 'Capstone script · panel calibration', status: 'Ready' },
      { id: 'd5-workbook', title: 'Integrated decision canvas', kind: 'Learner workbook', meta: 'Seven-element final submission', status: 'Ready' },
      { id: 'd5-challenge', title: 'Integrated event cards', kind: 'Challenge pack', meta: '6 variants · scoring rubric', status: 'Ready' },
      { id: 'd5-exam', title: 'Foundation final exam', kind: 'Assessment', meta: '50 MCQs · 75 minutes', status: 'Review' },
    ],
  },
];

export const FIELDCRAFT_COURSES: FieldcraftCourse[] = [
  {
    id: 'volve-mission', slug: 'volve-mission', title: 'The Volve Mission', subtitle: 'From Discovery to Decision',
    description: 'Follow one real North Sea field through every upstream lifecycle. Inspect the evidence, operate the workspaces and defend what should happen next.',
    instructor: 'Arganta Fieldcraft Faculty', status: 'flagship', level: 'Foundation → Guided Practitioner', duration: '5 days · 40 hours',
    delivery: ['Instructor-led', 'Offline-ready', 'Enterprise'], lifecycle: 'Integrated lifecycle', modules: 5, labs: 10,
    credential: 'Integrated Geoscience Fieldcraft Passport', accent: '#0fb5a6',
    tags: ['Volve', 'Real data', 'Geoscience', 'Field development', 'Well delivery', 'Reservoir management'], days: VOLVE_DAYS,
  },
  {
    id: 'exploration-basin-prospect', slug: 'exploration-basin-to-prospect', title: 'Exploration Fieldcraft', subtitle: 'Basin to Prospect',
    description: 'Build an explainable exploration case from basin framework and petroleum-system evidence through opportunity risk, volume and drill-or-study decisions.',
    instructor: 'Founding Exploration Instructor', status: 'coming-soon', level: 'Foundation → Practitioner', duration: 'In development',
    delivery: ['Online', 'Instructor-led'], lifecycle: 'Exploration', modules: 6, labs: 6,
    credential: 'Exploration Vertical Passport', accent: '#22d3ee',
    tags: ['Basin', 'Petroleum system', 'Play fairway', 'Prospect risk', 'Volumetrics'],
  },
];

/* Team scores are no longer static content — they live in the session store
   (src/fieldcraft/session.ts) and are entered through the trainer console. */
