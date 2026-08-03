// registry.ts — Well Delivery tab manifests. Names are the "mission sequence" of
// delivering a well: Proposal → Basis → Clearance → Steering → Debrief → Handover.
// Each maps to a Capital Value Process gate and the researched WDP deliverable.
import type { Gate } from './types';

export interface WdTab {
  id: string;
  name: string;      // the polished, punchy tab label
  eyebrow: string;   // short kicker shown under the title
  gate: Gate;        // the CVP gate this cockpit serves
  blurb: string;     // one-line description shown in the tab header
  detail: string;    // the richer "what this cockpit is" paragraph
}

export const WD_TABS: WdTab[] = [
  {
    id: 'proposal', name: 'Proposal', eyebrow: 'Well-on-a-page · sanction case', gate: 'sanction',
    blurb: 'The single-screen drilling proposal that goes to the investment decision.',
    detail: 'A non-scrolling cockpit that synthesises the whole delivery case for the FID gate — objective, subsurface target, trajectory, casing & mud scheme, AFE, top risks and gate readiness — on one page. This is the drilling proposal; the full documents live in the Report workspace.',
  },
  {
    id: 'basis', name: 'Basis', eyebrow: 'SOR & Basis of Design', gate: 'select',
    blurb: 'What the well must achieve and the design envelope that delivers it.',
    detail: 'The multi-discipline Statement of Requirements and Basis of Design — objectives, subsurface targets, success criteria, design envelope, rig sizing, Level-2 cost basis, data-acquisition programme and the risk register. Answers "what & why" before engineering answers "how".',
  },
  {
    id: 'clearance', name: 'Clearance', eyebrow: 'Hazards · mud window · anti-collision', gate: 'define',
    blurb: 'Everything that must be green before the well is cleared to drill.',
    detail: 'The safe-to-drill review: the pore-pressure / collapse / fracture mud window, shallow-hazard screen, ISCWSA-style anti-collision separation factor against real offset wells, and the two-envelope well-barrier schematic per NORSOK D-010.',
  },
  {
    id: 'steering', name: 'Steering', eyebrow: 'Real-time follow-up & geosteering', gate: 'execute',
    blurb: 'Keeping the bit in zone — plan versus actual on bottom.',
    detail: 'The drilling follow-up cockpit: a StarSteer-style TVT stratigraphic cross-section correlating the wellpath to a type well, live distance-to-boundary, in-zone percentage and planned-versus-actual trajectory while the well is being drilled.',
  },
  {
    id: 'debrief', name: 'Debrief', eyebrow: 'Final Well Report · planned vs actual', gate: 'execute',
    blurb: 'What we planned, what we got, and what the next well should learn.',
    detail: 'The Final Well Report workspace: prognosed-versus-actual formation tops, non-productive time by hole section, days and cost planned-versus-actual, the as-built casing tally, and the captured lessons that feed the next well.',
  },
  {
    id: 'handover', name: 'Handover', eyebrow: 'As-drilled package → Reservoir Mgmt', gate: 'handover',
    blurb: 'Closing the loop — delivering the finished well to the reservoir team.',
    detail: 'The handover gate: the well-barrier element report, well operating limits and handover checklist, with the as-drilled geometry, logs, tops and completion packaged and delivered to Reservoir Management to close the Exploration → Field Dev → Well Delivery → Reservoir loop.',
  },
];

export const wdTab = (id: string) => WD_TABS.find((t) => t.id === id) ?? WD_TABS[0];
