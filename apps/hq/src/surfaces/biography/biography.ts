/**
 * BIOGRAPHY STUDIO — the identity engine.
 *
 * One editable Master Profile per persona; every other lens (CV Maker, Intro
 * Deck, Journey Timeline) is a DERIVED, pure read of it. Nothing downstream
 * holds its own copy of the founder's story — edit the master, everything moves.
 *
 * Two profiles ship:
 *  · aldhyt  — the real, complete professional record. A list of jobs.
 *  · arganta — the public digital twin, and the SAME PERSON. A list of five
 *              transformations. Same real facts, same real numbers, told in
 *              first person, with every employer de-identified (twinText.ts).
 *              It fabricates the framing, never the facts — both handoffs forbid
 *              inventing achievements, employers, teams or revenue.
 *              Canon: knowledge-base/brand/arganta-founder-persona-handoff.md
 *              (the Character Bible; wins on conflict) + arganta-creator-handoff.md
 *
 * Ground truth = the founder's real CVs (2025 PDF + 2026 PPTX), transcribed and
 * rephrased to one voice in docs/biography-studio-design.md §8. Never summarize
 * this file away — it IS the source.
 *
 * Every experience bullet is TAGGED. Tags are the whole mechanism behind the CV
 * Maker: a template is a tag filter + a boost order, so tailoring a CV to a role
 * is deterministic today and an LLM swap at exactly one seam tomorrow
 * (cvTemplates.ts → composeCv).
 */
import { create } from 'zustand'
import { scrubDeep } from './twinText'

export type ProfileId = string

/** The vocabulary the CV Maker filters on. Every bullet carries 1+. */
export type Tag =
  | 'geology' | 'geomodeling' | 'reservoir-mgmt' | 'operations' | 'fdp' | 'geomechanics'
  | 'data' | 'bi' | 'ml' | 'ai' | 'software'
  | 'leadership' | 'training' | 'publication' | 'innovation'

export const TAG_LABEL: Record<Tag, string> = {
  geology: 'Geology', geomodeling: 'Geomodeling', 'reservoir-mgmt': 'Reservoir mgmt',
  operations: 'Operations', fdp: 'Field development', geomechanics: 'Geomechanics',
  data: 'Data', bi: 'BI', ml: 'Machine learning', ai: 'Agentic AI', software: 'Software',
  leadership: 'Leadership', training: 'Training', publication: 'Publication', innovation: 'Innovation',
}

export type Bullet = { id: string; text: string; tags: Tag[] }

export type ExperienceEntry = {
  id: string
  role: string
  company: string
  /** Rendered instead of `company` on twin profiles — never a fictional name. */
  companyAlias?: string
  logo?: string            // '/biography/logos/noc.png' — falls back to a monogram chip
  brand?: string           // hex, tints the monogram chip when no logo file exists
  place: string
  years: string
  team?: string
  bullets: Bullet[]
  highlight?: boolean
  /** Journey Timeline chapter media. Photos live in /biography/journey/<profileId>/ */
  media?: { photos: string[]; caption?: string }
  /**
   * Narrative era (1..5) — the twin's record IS its eras, so the Journey groups
   * by this. The real profile has no authored eras; they derive from years, so
   * both profiles (and any future AI-influencer persona) render identically.
   */
  era?: number
  /** The era's brand line — the caption a chapter carries when it has no photo. */
  eraLine?: string
}

export type EducationEntry = { id: string; school: string; degree: string; field: string; place: string; years: string; note?: string; logo?: string; brand?: string }
export type AwardItem = { id: string; text: string; year?: string; detail?: string }
export type PubEntry = { id: string; title: string; venue: string; year?: string; url?: string; tags: Tag[] }
export type ProjectEntry = { id: string; name: string; desc: string; tags: Tag[] }
export type SkillGroup = { id: string; label: string; items: string[] }

/**
 * `playbook: true` marks a section as brand OPERATIONS, not biography — content
 * pillars, highlight order, launch posts. They belong to the persona's canon but
 * they are not things a person *is*, so they render below a divider and are
 * excluded from the LinkedIn copy. Without this separation the twin reads like a
 * marketing deck wearing a face.
 */
export type MasterSection =
  | { kind: 'about'; id: string; title: string; bullets: Bullet[]; playbook?: boolean }
  | { kind: 'experience'; id: string; title: string; entries: ExperienceEntry[]; playbook?: boolean }
  | { kind: 'education'; id: string; title: string; entries: EducationEntry[]; playbook?: boolean }
  | { kind: 'skills'; id: string; title: string; groups: SkillGroup[]; playbook?: boolean }
  | { kind: 'awards'; id: string; title: string; items: AwardItem[]; playbook?: boolean }
  | { kind: 'publications'; id: string; title: string; entries: PubEntry[]; playbook?: boolean }
  | { kind: 'projects'; id: string; title: string; entries: ProjectEntry[]; playbook?: boolean }
  | { kind: 'custom'; id: string; title: string; bullets: Bullet[]; playbook?: boolean }

export type SectionKind = MasterSection['kind']

export type Profile = {
  id: ProfileId
  kind: 'real' | 'twin'
  label: string                       // switcher chip label
  identity: {
    name: string; headline: string; tagline?: string
    email?: string; phone?: string; location: string
    photo: string
    links: { id: string; label: string; url: string }[]
  }
  master: MasterSection[]
  deck: { accent: string }
  deckStats: { id: string; value: string; label: string }[]
  /** Twin only — the non-negotiables, pinned above the record. */
  publicRules?: string[]
  journey?: { openerTagline?: string; photos: string[] }
}

const uid = (() => { let n = 0; return (p: string) => `${p}-${(++n).toString(36)}` })()
const b = (text: string, ...tags: Tag[]): Bullet => ({ id: uid('b'), text, tags })

/* ───────────────────────────────────────────────────────────────────────────
   GROUND TRUTH — the founder's real record.
   Source: 2025_CV_Aldhyt SUKAPRADJA.pdf + Aldhyt CV 2026.pptx, rephrased to one
   voice (verb → scope → quantified outcome). Nothing here is invented.
   ─────────────────────────────────────────────────────────────────────────── */

const EXPERIENCE: ExperienceEntry[] = [
  {
    id: 'exp-noc-rmo', role: 'Senior Geologist', company: 'North Oil Company',
    companyAlias: 'A giant offshore operator', logo: '/biography/logos/noc.png', brand: '#1B9AAA',
    place: 'Doha, Qatar', years: '2022 — Present', team: 'Reservoir Management & Opportunity',
    highlight: true,
    media: { photos: [], caption: 'Al Shaheen — the giant carbonate oil field' },
    bullets: [
      b('Lead geologist for reservoir management and opportunity maturation across the UER, Khatiyah, Mauddud, Hith and Arab reservoirs of the Al Shaheen giant oil field.', 'reservoir-mgmt', 'geology'),
      b('Steward 60+ extended-reach and multilateral horizontal wells — surveillance, opportunity screening and reservoir strategy.', 'reservoir-mgmt', 'operations'),
      b('Architect of RMO 360, a unified reservoir-management ecosystem integrating 20+ workflows into one operating picture.', 'bi', 'software', 'innovation'),
      b('Inventor of the Guard AI/ML family — FlowGuard, StimGuard, TerraGuard, FracGuard, SweepGuard and GasShield — applied ML for flow, stimulation, geomechanics, frac, sweep and gas surveillance.', 'ml', 'ai', 'innovation'),
      b('Product owner of WellWatch and WellNova, the company’s first subsurface agentic-AI products for daily monitoring and post-drill intelligence.', 'ai', 'leadership', 'innovation'),
      b('Matured the company’s first agentic AI from concept to production — recognized by the CEO and the VP Digital Solutions at the company townhall, featured in an internal article, and presented to QatarEnergy VIPs.', 'ai', 'leadership', 'innovation'),
      b('Published three papers in 2025: GasShield for Reservoir Management (EAGE), Digitally Enabled Reservoir Management and 3D Mechanical Earth Model for Waterflood Optimization & Reservoir Management (QatarEnergy LNG Forum).', 'publication', 'innovation'),
      b('Focal point for business intelligence and geomechanics projects across the asset.', 'bi', 'geomechanics'),
      b('Nahr Umr Award for Innovation & Business Efficiency three consecutive years; outstanding rating 2025 and exceeds-expectations 2024.', 'innovation'),
    ],
  },
  {
    id: 'exp-noc-ure', role: 'Senior Geologist', company: 'North Oil Company',
    companyAlias: 'A giant offshore operator', logo: '/biography/logos/noc.png', brand: '#1B9AAA',
    place: 'Doha, Qatar', years: '2020 — 2022', team: 'Underdeveloped Reservoirs & Exploration',
    bullets: [
      b('Focal point for the Upper Mauddud Field Development Plan, matured from Conceptual to Pre-FEED — 80+ extended-reach-drilling wells.', 'fdp', 'geology', 'leadership'),
      b('Asset geologist and geosteering focal point for 5 ERD long-horizontal wells and 3 static + dynamic appraisal wells.', 'operations', 'geology'),
      b('Delivered reservoir synthesis and strategic opportunity identification across the underdeveloped reservoir portfolio.', 'reservoir-mgmt', 'geology'),
      b('Exceeds-expectations performance rating two years in a row.', 'innovation'),
    ],
  },
  {
    id: 'exp-phm', role: 'Reservoir Geologist — Tunu Field', company: 'Pertamina Hulu Mahakam',
    companyAlias: 'The national energy company’s Mahakam JV', logo: '/biography/logos/pertamina.png', brand: '#009BDC',
    place: 'Balikpapan, Indonesia', years: '2018 — 2020', team: 'Tunu Field Development',
    media: { photos: [], caption: 'Tunu — Indonesia’s biggest gas field' },
    bullets: [
      b('Reservoir geologist for Tunu, Indonesia’s biggest gas field; focal point for Shallow Zone future-development and alternative-technology studies.', 'geology', 'reservoir-mgmt', 'fdp'),
      b('Built automated workflows, statistical models and a business-intelligence platform for reservoir surveillance and post-mortem efficiency.', 'bi', 'data', 'software'),
      b('Delivered AVO-based well-candidate scouting for 35+ future wells.', 'data', 'geology'),
      b('Well design and drilling monitoring across 3 concurrent swamp-rig operations.', 'operations'),
      b('Partnered with Contracts & Procurement on a cost-awareness and contractual-strategy study; contributor to an early machine-learning pilot.', 'data', 'ml', 'leadership'),
    ],
  },
  {
    id: 'exp-tepi-pp', role: 'Wellsite Geologist & Pore-Pressure Specialist', company: 'Total E&P Indonésie',
    companyAlias: 'A French supermajor', logo: '/biography/logos/totalenergies.png', brand: '#ED0000',
    place: 'Mahakam, Indonesia', years: '2017 — 2018', team: 'Mahakam Operations',
    bullets: [
      b('Focal point for the regional Mahakam pore-pressure model and synthesis — candidate for Total E&P’s Best Innovator 2017.', 'geology', 'innovation'),
      b('Developed a 3D geostatistical pore-pressure method spanning 7 Mahakam fields, published at SPE 2017.', 'geomodeling', 'data', 'publication'),
      b('Wellsite geologist for swamp-rig drilling operations.', 'operations'),
    ],
  },
  {
    id: 'exp-tepi-sisi', role: 'Reservoir Geologist — Sisi Nubi & South Mahakam', company: 'Total E&P Indonésie',
    companyAlias: 'A French supermajor', logo: '/biography/logos/totalenergies.png', brand: '#ED0000',
    place: 'Balikpapan, Indonesia', years: '2014 — 2016', team: 'Offshore Assets',
    media: { photos: [], caption: 'Sisi Nubi — offshore gas' },
    bullets: [
      b('Reservoir geologist for two offshore gas fields; focal point for the reservoir management system (GeoSEA ’16), field synthesis (IPA ’15) and geomodeling (AAPG ’17).', 'geology', 'geomodeling', 'reservoir-mgmt', 'publication'),
      b('Built the Sisi Nubi business-intelligence dashboard and web-GIS automation, published at SPE-APOGCE ’17.', 'bi', 'software', 'publication'),
      b('Fault-seal analysis, static–dynamic synthesis, simulation, well proposals and platform siting for a future Plan of Development.', 'geomodeling', 'fdp'),
      b('Operations geologist across 5 offshore fields: 3D trajectories, slanted wells and real-time geosteering — 2 offshore rigs, 5+ wells.', 'operations'),
    ],
  },
  {
    id: 'exp-handil', role: 'Petroleum Geologist — Handil Field', company: 'Total E&P Indonésie',
    companyAlias: 'A French supermajor', logo: '/biography/logos/totalenergies.png', brand: '#ED0000',
    place: 'Indonesia', years: '2012 — 2013', team: 'Total Global Scholarship',
    bullets: [
      b('Assessed step-out potential for the future of one of the world’s most mature deltaic oil fields.', 'geology'),
      b('Prospect maturation, well design, petroleum-system and spectral-decomposition studies.', 'geology', 'geomodeling'),
    ],
  },
  {
    id: 'exp-emp', role: 'Exploration Geologist', company: 'Energi Mega Persada',
    companyAlias: 'An Indonesian independent E&P', logo: '/biography/logos/emp.png', brand: '#C8102E',
    place: 'Jakarta, Indonesia', years: '2011 — 2012', team: 'Bentu & Korinci Baru PSCs',
    bullets: [
      b('Exploration geologist for 2 PSCs and 7 fields; focal point for lead & prospect maturation (IAGI-HAGI ’11) and reservoir synthesis (IPA ’12).', 'geology', 'publication'),
      b('Geomodeling and geohazard characterization, published at IPA and AAPG ’12.', 'geomodeling', 'geology', 'publication'),
      b('Contributed to long-range exploration planning — deep potential and basement fracture — and the reserves certification project.', 'geology', 'leadership'),
      b('Recognition Award for first-service-year performance.', 'innovation'),
    ],
  },
  {
    id: 'exp-lapi', role: 'Research Geologist (Unconventional)', company: 'LAPI-ITB × British Petroleum',
    companyAlias: 'A university research group × a British supermajor', logo: '/biography/logos/itb.png', brand: '#003D7C',
    place: 'Bandung, Indonesia', years: '2010 — 2011', team: 'West Sanga Sanga CBM',
    bullets: [
      b('Joint Geodynamic Research Group and BP study of regional CBM potential in the Upper Kutei Basin.', 'geology'),
      b('Focal point for CBM petrophysics, basin-scale synthesis, geomodeling and reserves calculation; field geologist.', 'geomodeling', 'data'),
    ],
  },
]

const ABOUT: Bullet[] = [
  b('Petroleum geoscientist with 15+ years across NOC, IOC, JV and consulting environments in Indonesia, France and Qatar.', 'geology', 'leadership'),
  b('Deep dual expertise: giant clastic gas fields (Mahakam Block, Indonesia) and giant carbonate oil fields (Al Shaheen, Qatar).', 'geology', 'reservoir-mgmt'),
  b('Deeply involved in 4 major Field Development Plans as focal point for reservoir geology and geomodeling — Al Shaheen (offshore oil), Tunu (swamp gas), Sisi Nubi & Jumelai (offshore gas), Seng & Segat (onshore biogenic gas).', 'fdp', 'geomodeling'),
  b('Product owner of tens of digital use cases, delivering next-generation agentic AI in daily industrial operation.', 'ai', 'leadership'),
  b('Cross-discipline focal point for 3G synthesis, 3D earth modelling, geohazard assessment, regional synthesis, reservoir management, business intelligence and data technology in geoscience studies.', 'leadership', 'geomodeling', 'bi'),
  b('20+ technical papers, reports and user manuals published internally and at IAGI, HAGI, IPA, SPE, EAGE and AAPG; 30+ advanced Petrel automation scripts.', 'publication', 'software'),
  b('In-house facilitator: integrated reservoir synthesis training, regional field trips and business-intelligence fundamentals.', 'training', 'leadership'),
  b('Beyond the day job: full-stack web and mobile developer, founder of the Arganta product ecosystem; former tourism ambassador of East Jakarta.', 'software'),
]

/** The twin's About — the same life, told rather than listed. */
const ABOUT_TWIN: Bullet[] = [
  b('I am an Earth Scientist turned AI builder and world creator.', 'leadership'),
  b('I started by reading rocks: sedimentary structures, landscapes, and evidence that was always incomplete. I led a scientific expedition before I led anything else.', 'geology', 'leadership'),
  b('My first office had no walls — flying camps in the forests of Papua, where geology, survival and logistics were the same job.', 'geology', 'operations'),
  b('Then the field moved underground. Fifteen years across giant gas fields in Indonesia and a giant carbonate oil field in Qatar: geomodeling, geomechanics, reservoir management, field development, and wells that cost more than most companies.', 'reservoir-mgmt', 'geomodeling', 'fdp'),
  b('Somewhere in there I started teaching machines to read the signals too — automation, business intelligence, statistical models, machine learning, and eventually the first agentic AI my company ever put into daily use.', 'ai', 'ml', 'bi'),
  b('Twenty-plus publications, four giant-field development plans, sixty-plus horizontal wells. I write things down because that is how I find out whether I understood them.', 'publication'),
  b('I am a husband and a father before I am a founder. I build from a practical family apartment, after the working day ends, while the region around me stays unresolved.', 'leadership'),
  b('I did not leave geology for AI. Every world I build uses the method an outcrop taught me: enter the uncertainty, read the signals, build the model, create a path forward.', 'software', 'leadership'),
]

const EDUCATION: EducationEntry[] = [
  { id: 'edu-ifp', school: 'IFP School', degree: 'M.Sc.', field: 'Petroleum Geosciences', place: 'Rueil-Malmaison, France', years: '2011 — 2012', note: 'Total Global Scholarship laureate', logo: '/biography/logos/ifp.png', brand: '#0B5FA5' },
  { id: 'edu-itb', school: 'Institut Teknologi Bandung', degree: 'B.Eng.', field: 'Petroleum Geology', place: 'Bandung, Indonesia', years: '2005 — 2010', note: 'Dean’s List — outstanding academic achievement', logo: '/biography/logos/itb.png', brand: '#003D7C' },
]

const SKILLS: SkillGroup[] = [
  { id: 'sk-sub', label: 'Subsurface', items: ['Reservoir geology', 'Geomodeling & reservoir synthesis', 'Reservoir management', 'Field development planning', 'Geosteering & well delivery', 'Pore pressure & geohazards', 'Reservoir geomechanics', 'Carbonate & clastic systems'] },
  { id: 'sk-dig', label: 'Digital & Data', items: ['Subsurface AI/ML product ownership', 'Agentic AI', 'Business intelligence (Power BI)', 'Statistical modelling', 'Data analytics', 'Petrel advanced automation (30+ scripts)', 'Full-stack web & mobile development', 'Web-GIS'] },
  { id: 'sk-lead', label: 'Leadership & Communication', items: ['Multi-discipline focal point', 'FDP maturation lead', 'In-house trainer & field-trip facilitator', '20+ conference publications', 'Multinational team player'] },
]

const AWARDS: AwardItem[] = [
  { id: 'aw-2025', text: 'Outstanding performance rating — North Oil Company', year: '2025', detail: 'For maturing the company’s first agentic AI. Cited by the CEO and VP Digital Solutions at the company townhall, featured in an internal article, and presented to QatarEnergy VIPs.' },
  { id: 'aw-nahr', text: 'Nahr Umr Award for Innovation & Business Efficiency — North Oil Company, three consecutive years', year: '2022 — 2024' },
  { id: 'aw-exceeds', text: 'Exceeds-expectations performance rating — North Oil Company', year: '2020 — 22, 2024' },
  { id: 'aw-total-out', text: 'Outstanding performance rating (highest possible), two consecutive years — Total E&P', year: '2015 — 2016' },
  { id: 'aw-innov', text: 'Best Innovator candidate, Pore-Pressure Modelling — Total E&P', year: '2017' },
  { id: 'aw-scholar', text: 'Total Global Scholarship — IFP School, Paris', year: '2011' },
  { id: 'aw-eage', text: 'Runner-up, EAGE Field Development Challenge — London', year: '2013' },
  { id: 'aw-olympic', text: 'Runner-up (team leader), Indonesian Geological Olympiad', year: '2010' },
  { id: 'aw-emp', text: 'Recognition Award, first service year — Energi Mega Persada', year: '2012' },
  { id: 'aw-dean', text: 'Dean’s List — Institut Teknologi Bandung' },
  { id: 'aw-amb', text: 'Tourism Ambassador of East Jakarta (former)' },
]

/**
 * The twin's honors, written rather than scrubbed.
 *
 * Running the real list through twinText produces prose like "the operator's
 * innovation award — the operator, three consecutive years": accurate, but
 * obviously machine-mangled, and this profile has to read like a person wrote
 * it. Same facts, same years, phrased once, properly.
 */
const AWARDS_TWIN: AwardItem[] = [
  { id: 'awt-2025', text: 'Outstanding performance rating', year: '2025', detail: 'For maturing my company’s first agentic AI from concept into daily production use. Cited by the CEO and the VP of Digital Solutions at the company townhall, written up internally, and presented to the state energy major’s leadership.' },
  { id: 'awt-innov', text: 'Innovation & Business Efficiency Award — three consecutive years', year: '2022 — 2024' },
  { id: 'awt-exceeds', text: 'Exceeds-expectations performance rating', year: '2020 — 22, 2024' },
  { id: 'awt-total', text: 'Outstanding performance rating — the highest available — two years running at a French supermajor', year: '2015 — 2016' },
  { id: 'awt-bestinnov', text: 'Best Innovator candidate, for the regional pore-pressure model', year: '2017' },
  { id: 'awt-scholar', text: 'Global scholarship to a French petroleum institute — a supermajor paid for the master’s degree', year: '2011' },
  { id: 'awt-eage', text: 'Runner-up, EAGE Field Development Challenge — London', year: '2013' },
  { id: 'awt-olympic', text: 'Runner-up and team lead, Indonesian Geological Olympiad', year: '2010' },
  { id: 'awt-first', text: 'First-service-year recognition award', year: '2012' },
  { id: 'awt-dean', text: 'Dean’s List — outstanding academic achievement' },
  { id: 'awt-amb', text: 'Tourism Ambassador of East Jakarta (former)' },
]

const PUBLICATIONS: PubEntry[] = [
  { id: 'pub-gasshield', title: 'GasShield for Reservoir Management', venue: 'EAGE', year: '2025', tags: ['ml', 'reservoir-mgmt', 'publication'] },
  { id: 'pub-derm', title: 'Digitally Enabled Reservoir Management', venue: 'QatarEnergy LNG Forum', year: '2025', tags: ['bi', 'reservoir-mgmt', 'publication'] },
  { id: 'pub-mem', title: '3D Mechanical Earth Model for Waterflood Optimization & Reservoir Management', venue: 'QatarEnergy LNG Forum', year: '2025', tags: ['geomechanics', 'reservoir-mgmt', 'publication'] },
  { id: 'pub-dash', title: 'Sisi Nubi Dashboard: Implementation of Business Intelligence in Reservoir Modelling & Synthesis', venue: 'SPE-APOGCE · SPE-186907-MS', year: '2017', url: 'https://www.onepetro.org/conference-paper/SPE-186907-MS', tags: ['bi', 'publication'] },
  { id: 'pub-pp3d', title: 'Integrated 3D Pore Pressure Characterisation and Modeling: Methodology & Application in Sisi Nubi Field, Mahakam', venue: 'SPE-APOGCE · SPE-186310-MS', year: '2017', url: 'https://www.onepetro.org/conference-paper/SPE-186310-MS', tags: ['geomodeling', 'publication'] },
  { id: 'pub-bentu', title: 'Integrated Reservoir Study in Bentu–Seng–Segat Fields, Central Sumatra Basin: A Conceptual Approach', venue: 'IPA · IPA12-G-087', year: '2012', url: 'http://archives.datapages.com/data/ipa_pdf/083/083001/pdfs/IPA12-G-087.htm', tags: ['geology', 'publication'] },
  { id: 'pub-pp-bentu', title: '3D Pore Pressure Prediction Model in Bentu Block, Central Sumatra Basin', venue: 'IPA · IPA12-G-104', year: '2012', url: 'http://archives.datapages.com/data/ipa_pdf/083/083001/pdfs/IPA12-G-104.htm', tags: ['geomodeling', 'publication'] },
  { id: 'pub-iter', title: 'Integration of Static & Dynamic Synthesis with Iterative Workflow to Enhance Reservoir Understanding', venue: 'IPA / AAPG', year: '2015', url: 'http://archives.datapages.com/data/ipa_pdf/2015/ipa15-e-110.htm', tags: ['reservoir-mgmt', 'publication'] },
  { id: 'pub-shallow', title: 'Unlocking Potential Resources at Shallow Zone for Future Development', venue: 'AAPG Search & Discovery', year: '2018', url: 'http://www.searchanddiscovery.com/documents/2018/30563suardiputra/ndx_suardiputra.pdf', tags: ['fdp', 'publication'] },
  { id: 'pub-sisi-char', title: 'An Integrated Reservoir Characterization & Model to Locate Future Potential of Sisi Nubi Fields', venue: 'GeoSEA XIV / 45th IAGI', year: '2016', tags: ['geomodeling', 'publication'] },
  { id: 'pub-outcrop', title: 'Ancient Mahakam Virtual Outcrop Project: A Breakthrough in Preserving Indonesia’s Precious Outcrops', venue: 'GeoSEA XIV / 45th IAGI', year: '2016', tags: ['innovation', 'publication'] },
  { id: 'pub-rms', title: 'The Reservoir Management System of Sisi Nubi Fields and Its Implication to Future Development Planning', venue: 'GeoSEA XIV / 45th IAGI', year: '2016', tags: ['reservoir-mgmt', 'publication'] },
]

const PROJECTS: ProjectEntry[] = [
  { id: 'pr-rmo', name: 'RMO 360', desc: 'Unified reservoir-management ecosystem — 20+ integrated workflows in one operating picture.', tags: ['bi', 'software', 'innovation'] },
  { id: 'pr-guard', name: 'The Guard family', desc: 'FlowGuard · StimGuard · TerraGuard · FracGuard · SweepGuard · GasShield — six applied-ML surveillance products.', tags: ['ml', 'ai'] },
  { id: 'pr-wellwatch', name: 'WellWatch', desc: 'Agentic-AI daily well monitoring — the first subsurface agentic AI in production.', tags: ['ai'] },
  { id: 'pr-wellnova', name: 'WellNova', desc: 'Agentic-AI post-drill intelligence.', tags: ['ai'] },
  { id: 'pr-arganta', name: 'Arganta ecosystem', desc: 'Founder — KinetikCircle, ArgantaLab, Circle HQ. Five apps, one HQ, built after hours.', tags: ['software', 'leadership'] },
]

/**
 * Interests — the real ones, from the Character Bible.
 *
 * These are not decoration. Each one is load-bearing for how the founder thinks,
 * and the profile is dishonest without them: the games explain the product
 * design, the sport explains the discipline, the driving explains the
 * expedition instinct. Written the way a person writes, not the way a brand does.
 */
const INTERESTS: Bullet[] = [
  b('Padel — the strategy and the reaction of it, and the fact that it is impossible to play alone.', 'training'),
  b('Swimming and the gym. Swimming is where I think; the gym is just the consistency that keeps everything else running.', 'training'),
  b('Role-playing games — Pokémon, Suikoden, Final Fantasy. They are why I think about progression, community and world-building the way I do; every product I build owes them something.', 'software'),
  b('Racing simulators. Precision, repetition and decisions under pressure — a reservoir engineer has been simulating before executing his whole career.', 'data'),
  b('Off-road driving and desert camping. The same instinct as fieldwork: go where the road stops and find out what is there.', 'training'),
  b('Full-stack web and mobile development, after hours. It started as a way to automate my own work and turned into an ecosystem.', 'software'),
  b('Mentoring and teaching — in-house training, field trips, and writing things down so someone else does not have to learn them the slow way.', 'training', 'leadership'),
  b('Family first, always — and an expatriate life that keeps teaching all of us how to adapt.', 'leadership'),
]

/** The twin's interests — same life, first person, told rather than listed. */
const INTERESTS_TWIN: Bullet[] = [
  b('Padel — strategy, reaction, community. You cannot play it alone, which is most of the point.', 'training'),
  b('Swimming and the gym. Swimming is where I think; the gym is the plain consistency that keeps a body working under pressure.', 'training'),
  b('Role-playing games — Pokémon, Suikoden, Final Fantasy. Pokémon taught me accessible systems with hidden depth. Suikoden taught me that a headquarters is a character and the world is larger than the hero. Final Fantasy taught me that people remember how a world made them feel.', 'software'),
  b('Racing simulators — precision, repetition, feedback loops, decisions under pressure. Before you drive the future, you simulate it.', 'data'),
  b('Two old Land Cruisers and a lot of desert. One for the dunes and camping, one for the city. Neither is a trophy; they are engineering that has never let me down.', 'training'),
  b('Building things after the kids are asleep. It started as automating my own work and turned into an ecosystem.', 'software'),
  b('Teaching — training, field trips, and writing things down. If I understood it, I should be able to hand it over.', 'training', 'leadership'),
  b('My family, ahead of all of it.', 'leadership'),
]

const DECK_STATS = [
  { id: 'st-yrs', value: '15+', label: 'Years in oil & gas' },
  { id: 'st-pubs', value: '20+', label: 'Publications · 3 in 2025' },
  { id: 'st-fdp', value: '4', label: 'Major field development plans' },
  { id: 'st-wells', value: '60+', label: 'Horizontal wells stewarded' },
  { id: 'st-awards', value: '3×', label: 'Innovation awards' },
  { id: 'st-ai', value: '8', label: 'AI/ML products shipped' },
]

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/**
 * Section order is LinkedIn's, deliberately, and identical on both profiles:
 * About → Experience → Education → Skills → Projects → Publications → Honors →
 * Interests. The twin keeps its narrative subtitles ("the five eras") but never
 * its own structure — two profiles of the same person that disagree about what
 * a profile IS would read as two different people.
 */
const MASTER = (): MasterSection[] => [
  { kind: 'about', id: 'sec-about', title: 'About', bullets: clone(ABOUT) },
  { kind: 'experience', id: 'sec-exp', title: 'Experience', entries: clone(EXPERIENCE) },
  { kind: 'education', id: 'sec-edu', title: 'Education', entries: clone(EDUCATION) },
  { kind: 'skills', id: 'sec-skills', title: 'Skills', groups: clone(SKILLS) },
  { kind: 'projects', id: 'sec-projects', title: 'Projects', entries: clone(PROJECTS) },
  { kind: 'publications', id: 'sec-pubs', title: 'Publications', entries: clone(PUBLICATIONS) },
  { kind: 'awards', id: 'sec-awards', title: 'Honors & Awards', items: clone(AWARDS) },
  { kind: 'custom', id: 'sec-interests', title: 'Interests', bullets: clone(INTERESTS) },
]

const ALDHYT: Profile = {
  id: 'aldhyt', kind: 'real', label: 'Aldhyt',
  identity: {
    name: 'Aldhyt Sukapradja',
    headline: 'Senior Geologist · Reservoir Management & Digital Innovation',
    tagline: '15+ years turning subsurface complexity into decisions — from giant fields to agentic AI.',
    email: 'aldhyt.sukapradja@gmail.com', phone: '+974 666 8989 2', location: 'West Bay, Doha, Qatar',
    photo: '/biography/aldhyt-headshot.png',
    links: [{ id: 'ln-li', label: 'LinkedIn', url: 'https://linkedin.com/in/' }],
  },
  master: MASTER(),
  deck: { accent: '#0E4C92' },
  deckStats: clone(DECK_STATS),
  journey: { openerTagline: 'Fifteen years modelling what no one can see.', photos: [] },
}

/* ── The twin ────────────────────────────────────────────────────────────────
   Canon: knowledge-base/brand/arganta-founder-persona-handoff.md (the Character
   Bible — wins on conflict) + arganta-creator-handoff.md (v1).

   Arganta IS Aldhyt. The twin fabricates the FRAMING, never the FACTS: the same
   real journey, the same real numbers, told in first person as five eras, with
   every employer de-identified (twinText.ts). Both handoffs forbid invented
   achievements, companies, teams or revenue — so nothing here is invented.
   Dates are grounded: university 2005–2010 and the field/career years come from
   the real CV; the World Builder era starts 2026 because that is when this
   repository's first commit landed.

   The eras are the record. That is the whole difference from the real profile:
   Aldhyt's experience is a list of jobs; Arganta's is a list of transformations. */

const ERAS: ExperienceEntry[] = [
  {
    id: 'era-1', era: 1, role: 'Expedition Lead — Sedimentology',
    company: 'University field research', companyAlias: 'University field research',
    brand: '#8A6A3B', place: 'Indonesia', years: '2005 — 2010',
    team: 'The Student Expedition Leader',
    eraLine: 'Before he built systems, he learned to read the Earth.',
    media: { photos: [], caption: 'Outcrops, a compass, a notebook' },
    bullets: [
      b('I led a scientific sedimentology expedition while I was still a student — the traverse, the logistics, the team, and the responsibility for what we brought back.', 'geology', 'leadership'),
      b('I learned to build a model from incomplete evidence: a few outcrops, a notebook, and the discipline not to claim more than the rock supports.', 'geology', 'geomodeling'),
      b('It taught me that reading the Earth is a team problem before it is a scientific one — the same lesson every system since has repeated.', 'leadership', 'training'),
    ],
  },
  {
    id: 'era-2', era: 2, role: 'Field Geologist',
    company: 'Remote flying camps', companyAlias: 'Remote flying camps',
    brand: '#2F6B4F', place: 'Papua, Indonesia', years: '2010 — 2011',
    team: 'The Papua Field Geologist',
    eraLine: 'His first office had no walls.',
    media: { photos: [], caption: 'Forest, rain, a camp table of maps' },
    bullets: [
      b('I began my career in flying camps deep in the forests of Papua. Geology, survival and logistics were one job — you could not be good at one and careless about the others.', 'geology', 'operations'),
      b('There was no infrastructure to fall back on. The terrain, the weather and the team were the entire system, and the system did not forgive optimism.', 'operations'),
      b('I was doing rigorous science under a tarpaulin. It set the standard I have used everywhere since: the environment is allowed to be hostile; the work is not allowed to be sloppy.', 'geology', 'training'),
    ],
  },
  {
    id: 'era-3', era: 3, role: 'Earth Scientist',
    company: 'Supermajors & national joint ventures', companyAlias: 'Supermajors & national joint ventures',
    brand: '#1B5E8A', place: 'Mahakam, Indonesia · Paris, France', years: '2011 — 2020',
    team: 'The Earth Scientist',
    eraLine: 'The field moved underground, but the expedition continued.',
    media: { photos: [], caption: 'Seismic, models, wells' },
    bullets: [
      b('The outcrop became a reservoir I could never visit. I learned to read it anyway — through seismic, wells, pressure, production and the arguments between disciplines.', 'geology', 'geomodeling', 'reservoir-mgmt'),
      b('A master’s degree in France, then a decade across giant clastic gas fields: geomodeling, pore pressure, fault seal, field development, and drilling operations from swamp rigs to offshore platforms.', 'fdp', 'operations', 'geomodeling'),
      b('I published more than twenty papers along the way — not for the certificates, but because writing a thing down is how you find out whether you actually understood it.', 'publication', 'training'),
      b('I started automating my own work: scripts, dashboards, statistical models. Nobody asked me to. It was the only way to make the analysis keep up with the questions.', 'software', 'bi', 'data'),
    ],
  },
  {
    id: 'era-4', era: 4, role: 'Digital Transformation Leader',
    company: 'A giant offshore operator', companyAlias: 'A giant offshore operator',
    brand: '#1B9AAA', place: 'Doha, Qatar', years: '2020 — Present',
    team: 'The Digital Transformation Leader', highlight: true,
    eraLine: 'He began teaching machines to read signals too.',
    media: { photos: [], caption: 'Dashboards, agents, decisions' },
    bullets: [
      b('I moved to a giant carbonate oil field and, over four years, stopped only reading signals from the Earth and started teaching machines to read them too.', 'ai', 'reservoir-mgmt'),
      b('I architected a unified reservoir-management ecosystem that folded twenty-plus workflows into one operating picture, and invented a family of six applied-ML products for flow, stimulation, geomechanics, frac, sweep and gas surveillance.', 'ml', 'bi', 'innovation'),
      b('I took the company’s first agentic AI from a concept to something people actually use every morning — recognized by the CEO and the VP of Digital Solutions, and presented to the state energy major’s leadership.', 'ai', 'leadership', 'innovation'),
      b('Sixty-plus horizontal wells still depend on the geology being right. The AI did not replace that judgement; it gave it a wider field of view.', 'reservoir-mgmt', 'ai'),
    ],
  },
  {
    id: 'era-5', era: 5, role: 'Founder & World Builder',
    company: 'The Arganta ecosystem', companyAlias: 'The Arganta ecosystem',
    brand: '#22D3EE', place: 'A family apartment, Doha', years: '2026 — Present',
    team: 'The World Builder', highlight: true,
    eraLine: 'After mapping hidden worlds beneath the Earth, he began building new ones.',
    media: { photos: [], caption: 'After the kids sleep' },
    bullets: [
      b('After mapping hidden worlds beneath the Earth, I started building new ones. Circle HQ, ArgantaLab, KinetikCircle, LashiraBloom — one connected ecosystem, built after the working day ends.', 'software', 'leadership'),
      b('I build it from a practical family apartment, not a founder mansion. A large universe can begin in a small room.', 'software'),
      b('I have not left geology for AI. Every product I build is the same method I learned on an outcrop: enter the uncertainty, read the signals, build the model, create a path forward.', 'leadership', 'ai'),
      b('The world outside is uncertain and the responsibilities have not moved. So I keep showing up — and keep building.', 'leadership'),
    ],
  },
]

const ARGANTA_CANON: MasterSection[] = [
  {
    kind: 'custom', playbook: true, id: 'canon-bio', title: 'Instagram bio — the recommended cut',
    bullets: [
      b('I spent fifteen years reading the Earth. Now I build worlds above it. Building Arganta Core.', 'leadership'),
      b('Alternate (professional): Earth Scientist → systems thinker → AI builder. Indonesia · France · Qatar. Building Arganta Core and connected products.', 'leadership'),
      b('Alternate (executive): Earth Scientist. Digital transformation leader. Published researcher turned world builder. Building Arganta Core.', 'leadership'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-method', title: 'The method — every expedition, every system',
    bullets: [
      b('Enter an uncertain environment. Observe the available signals. Build a mental model. Connect the people and the disciplines. Navigate the risk. Make the decision. Create a path forward.', 'leadership'),
      b('It has not changed since the first outcrop: sedimentology expeditions, Papua forest camps, reservoir management, multinational organisations, digital transformation, agentic AI, and now the Arganta ecosystem. The terrain changes. The method does not.', 'leadership'),
      b('Earth → Rock → Reservoir → Well → Production → Decision → Digital System. My strongest skill was never one specialisation; it was the chain.', 'geomodeling', 'ai'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-pillars', title: 'Content pillars',
    bullets: [
      b('Earth — geological origin, expeditions, Papua, sedimentology, field lessons, Earth systems, reservoir thinking.', 'geology'),
      b('Build — agentic AI, product architecture, Circle HQ, the Arganta products, coding, founder execution, digital transformation.', 'ai', 'software'),
      b('Play — RPGs, racing simulators, Pokémon, Suikoden, Final Fantasy, hardware, and the world-building philosophy underneath them.', 'software'),
      b('Move — padel, swimming, gym, driving, desert exploration.', 'training'),
      b('Endure — professional responsibility, family stability, regional uncertainty, expatriate life, resilience without spectacle.', 'leadership'),
      b('Create Worlds — ArgantaLab, KinetikCircle, LashiraBloom, Circle HQ, and the connected ecosystem.', 'software', 'leadership'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-highlights', title: 'Highlight order',
    bullets: [b('START · JOURNEY · EARTH · BUILD · PLAY · MOVE · WORLDS — explain the person before the machinery.', 'leadership')],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-play', title: 'Play — the games that built the builder',
    bullets: [
      b('Pokémon taught me accessible systems with hidden depth: discovery, collection, progression, companionship. It is why ArgantaLab treats a child’s learning as a world worth exploring rather than a worksheet.', 'software'),
      b('Suikoden taught me that a headquarters is a character: you recruit a community, the castle grows with it, and the world is larger than the hero. That is Circle HQ, almost literally.', 'software', 'leadership'),
      b('Final Fantasy taught me that technology and myth can share a frame, and that people remember how a world made them feel. That is LashiraBloom.', 'software'),
      b('Racing simulators taught me feedback loops — precision, repetition, decisions under pressure, hardware and software as one instrument. Before you drive the future, you simulate it. A geologist has been doing that his whole career.', 'data', 'ml'),
      b('I am not a gaming channel. Games are simply where I learned progression, community, reward and world-building — the four things every product I build has to get right.', 'software'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-move', title: 'Move — discipline, not display',
    bullets: [
      b('Padel for strategy, reaction and community. Swimming for silence and recovery. The gym for the plain consistency that keeps a body working under professional pressure.', 'training'),
      b('Two Lexus LX570s: a 2013 for the desert, camping and difficult terrain — the expedition side; a silver 2019 for Doha, the office, airports and family. They are not trophies. They are engineering that has never let me down.', 'training'),
      b('A Rolex Submariner, worn and not displayed. Precision, water, durability — an object built to outlast the person who bought it. It appears on a steering wheel or beside a notebook, never as the subject of the photograph.', 'training'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-endure', title: 'Endure — building through uncertainty',
    bullets: [
      b('I work with full professionalism while living through regional uncertainty. The war is the context I live in, not material I perform with.', 'leadership'),
      b('The order does not move: family safety and presence first, professional responsibility second, health third, and the ecosystem fourth. Anything that inverts it is a mistake I have already made once.', 'leadership'),
      b('Building a hopeful world does not mean ignoring reality. It means refusing to let reality remove your ability to create.', 'leadership'),
      b('By day I help manage systems tied to the physical world. By night I build systems for a digital one. Around me, history stays unresolved.', 'leadership', 'ai'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-lines', title: 'The lines',
    bullets: [
      b('From reading ancient sedimentary worlds to building digital ones.', 'leadership'),
      b('A field geologist who learned the whole Earth system — and then started building worlds of his own.', 'leadership'),
      b('Before he built systems, he learned to read the Earth.', 'leadership'),
      b('His first office had no walls.', 'leadership'),
      b('The field moved underground, but the expedition continued.', 'leadership'),
      b('He began teaching machines to read signals too.', 'leadership'),
      b('The world outside is uncertain. The responsibilities remain. So he keeps showing up — and keeps building.', 'leadership'),
      b('A large universe can begin in a small room.', 'leadership'),
      b('Building a hopeful world does not mean ignoring reality.', 'leadership'),
      b('Before you drive the future, you simulate it.', 'leadership'),
      b('The tools changed. The mission did not.', 'leadership'),
    ],
  },
  {
    kind: 'custom', playbook: true, id: 'canon-launch', title: 'Launch — the first nine posts',
    bullets: [
      b('1 Arganta Manifesto · 2 From Earth Scientist to World Builder · 3 The Sedimentology Expedition · 4 Papua: The First Office Had No Walls · 5 The Integrated Career Journey · 6 Building Professionally During Uncertainty · 7 The Arganta Ecosystem · 8 Games That Shaped the Builder · 9 Invitation to Follow the Journey.', 'leadership'),
      b('Recurring series: From Earth to Worlds · The First Office Had No Walls · Games That Built the Builder · Still Building · After the Kids Sleep · Small Room, Large World · Simulation Mindset · Miles Before Metrics · Desert Systems · Between Meetings.', 'leadership'),
      b('Balance across ~12 pieces: 4–5 products/AI/building · 2 Earth-science journey · 2 gaming and world-building · 1–2 sport · 1 cars or exploration · 1 family, apartment or building-through-uncertainty. Founder-led — never a gaming, automotive, luxury or fitness profile.', 'leadership'),
    ],
  },
]

/** The twin's numbers — the same facts, counted the way the story tells them. */
const ARGANTA_STATS = [
  { id: 'as-yrs', value: '15+', label: 'Years reading the Earth' },
  { id: 'as-worlds', value: '2', label: 'Worlds — physical, then digital' },
  { id: 'as-ai', value: '8', label: 'AI/ML products shipped' },
  { id: 'as-pubs', value: '20+', label: 'Publications · 3 in 2025' },
  { id: 'as-fdp', value: '4', label: 'Giant-field development plans' },
  { id: 'as-eco', value: '5', label: 'Products in the ecosystem' },
]

const ARGANTA: Profile = {
  id: 'arganta', kind: 'twin', label: 'Arganta',
  identity: {
    name: 'Arganta',
    headline: 'I spent fifteen years reading the Earth. Now I build worlds above it.',
    tagline: 'Earth Scientist turned AI builder and world creator.',
    location: 'Indonesia · France · Qatar',
    // The twin's own formal portrait — Arganta is the same person, but the
    // public face is the persona's, not a photo carrying employer branding.
    photo: '/biography/arganta-formal.png',
    links: [{ id: 'ln-ig', label: 'Instagram', url: 'https://instagram.com/' }],
  },
  // The twin's record is his ERAS, not his jobs — that is the whole difference.
  // Scrubbed at seed time even though the prose is already de-identified: a
  // hand-edit could reintroduce a name, and this profile feeds a public feed.
  // A real profile first, a playbook second. Same section order a person's
  // LinkedIn has — About, Experience, Education, Skills, Projects, Publications,
  // Honors, Interests — so this can be read (and saved) as a human being rather
  // than a campaign. The brand ops live below the divider, flagged `playbook`.
  master: scrubDeep([
    { kind: 'about', id: 'sec-about', title: 'About', bullets: clone(ABOUT_TWIN) },
    { kind: 'experience', id: 'sec-exp', title: 'Experience — the five eras', entries: clone(ERAS) },
    { kind: 'education', id: 'sec-edu', title: 'Education', entries: clone(EDUCATION) },
    { kind: 'skills', id: 'sec-skills', title: 'Skills', groups: clone(SKILLS) },
    { kind: 'projects', id: 'sec-projects', title: 'Projects — the worlds', entries: clone(PROJECTS) },
    { kind: 'publications', id: 'sec-pubs', title: 'Publications', entries: clone(PUBLICATIONS) },
    { kind: 'awards', id: 'sec-awards', title: 'Honors & Awards', items: clone(AWARDS_TWIN) },
    { kind: 'custom', id: 'sec-interests', title: 'Interests', bullets: clone(INTERESTS_TWIN) },
    ...clone(ARGANTA_CANON),
  ] as MasterSection[]),
  deck: { accent: '#22D3EE' },
  deckStats: clone(ARGANTA_STATS),
  publicRules: [
    'Arganta IS Aldhyt — the same person, the real biography. First person, a real personal creator account.',
    'Never invent achievements, employers, teams, revenue, publications, awards or personal events. Fabricate the framing, never the facts.',
    'Employers render as descriptive aliases, never as fictional company names, and never as real ones.',
    'Never expose employer-confidential screens, data, numbers, workflows or identities.',
    'Public vocabulary is Earth Scientist · Field Geologist · Geoscientist · Systems Thinker · AI Builder · Digital Transformation Leader · Founder · World Builder. Never "subsurface engineer" as the primary title.',
    'He did not leave geology for AI, and he has not abandoned his career. The power of the story is building WHILE performing professionally.',
    'He is not a software engineer by training. Do not erase the Earth-science foundation.',
    'The war is context, not marketing material. Never romanticize conflict, never use suffering or military imagery as decoration, never imply personal heroism.',
    'Family first: never expose the children unnecessarily; never reveal the real building, location, apartment number or identifiable view. Use a fictionalized premium Doha apartment.',
    'Cars and the watch are supporting details — engineered, reliable objects. No wealth signaling, no status language, no luxury-flex posts.',
    'The operating intelligence is called Arganta Core — never AURA, never JARVIS.',
    'Never present simulated data, concept metrics or placeholders as live.',
    'Do not lead the Instagram bio with an AI-disclosure statement.',
    'Cinematic visuals are welcome; the evidence must stay authentic. No direct Iron Man imitation.',
    'Never sound like a fake billionaire, a motivational guru, a loud tech influencer or a self-proclaimed visionary. Confidence comes from experience and execution.',
  ],
  journey: { openerTagline: 'His first office had no walls.', photos: [] },
}

export const DEFAULT_PROFILES: Profile[] = [ALDHYT, ARGANTA]

/** Twin profiles show the alias; real profiles show the true employer. */
export const companyName = (e: ExperienceEntry, p: Profile) =>
  p.kind === 'twin' && e.companyAlias ? e.companyAlias : e.company

/* ── store ─────────────────────────────────────────────────────────────────── */

const KEY = 'hq_biography_v3'
const KEY_V2 = 'hq_biography_v2'
const HISTORY_MAX = 20

type Persisted = { version: 3; activeId: ProfileId; profiles: Profile[] }

const freshTwin = () => clone(DEFAULT_PROFILES.find(p => p.id === 'arganta')!)

/**
 * Load, with a v2→v3 migration.
 *
 * The store is the source of truth once it exists, which means a new seed is
 * invisible to anyone who already has a saved payload — the twin persona could
 * ship and never appear. So v3 migrates rather than ignores:
 *  · the real record keeps every founder edit (his CV, his words),
 *  · the twin is REPLACED by the new seed — v2's twin was a scrubbed mirror of
 *    the CV and the Character Bible supersedes it wholesale; keeping the old one
 *    would preserve a persona that canon has retired.
 */
function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Persisted
      if (p?.version === 3 && Array.isArray(p.profiles) && p.profiles.length) return p
    }
    const old = localStorage.getItem(KEY_V2)
    if (old) {
      const p2 = JSON.parse(old) as { version: number; activeId: ProfileId; profiles: Profile[] }
      if (p2?.version === 2 && Array.isArray(p2.profiles)) {
        const kept = p2.profiles.filter(x => x.id !== 'arganta')
        const migrated: Persisted = {
          version: 3,
          activeId: p2.activeId === 'arganta' ? 'arganta' : p2.activeId,
          profiles: [...kept, freshTwin()],
        }
        save(migrated)
        return migrated
      }
    }
  } catch { /* corrupt payload → ground truth */ }
  return { version: 3, activeId: 'aldhyt', profiles: clone(DEFAULT_PROFILES) }
}

function save(s: Persisted) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota — in-memory only */ }
}

export type BioTab = 'master' | 'cv' | 'deck' | 'journey'

interface BioState {
  activeId: ProfileId
  profiles: Profile[]
  tab: BioTab
  history: Profile[][]
  savedAt: number
  setTab: (t: BioTab) => void
  setActive: (id: ProfileId) => void
  /** The single write path — every edit funnels here, so undo/persist are free. */
  edit: (fn: (p: Profile) => void) => void
  undo: () => void
  reset: (id: ProfileId) => void
  profile: () => Profile
}

const init = load()

export const useBio = create<BioState>((set, get) => ({
  activeId: init.activeId,
  profiles: init.profiles,
  tab: 'master',
  history: [],
  savedAt: 0,
  setTab: (tab) => set({ tab }),
  setActive: (activeId) => { set({ activeId }); save({ version: 3, activeId, profiles: get().profiles }) },
  edit: (fn) => set((s) => {
    const profiles = clone(s.profiles)
    const p = profiles.find(x => x.id === s.activeId)
    if (!p) return {}
    fn(p)
    save({ version: 3, activeId: s.activeId, profiles })
    return { profiles, history: [...s.history, s.profiles].slice(-HISTORY_MAX), savedAt: Date.now() }
  }),
  undo: () => set((s) => {
    if (!s.history.length) return {}
    const profiles = s.history[s.history.length - 1]
    save({ version: 3, activeId: s.activeId, profiles })
    return { profiles, history: s.history.slice(0, -1), savedAt: Date.now() }
  }),
  reset: (id) => set((s) => {
    const fresh = DEFAULT_PROFILES.find(p => p.id === id)
    if (!fresh) return {}
    const profiles = s.profiles.map(p => (p.id === id ? clone(fresh) : p))
    save({ version: 3, activeId: s.activeId, profiles })
    return { profiles, history: [...s.history, s.profiles].slice(-HISTORY_MAX), savedAt: Date.now() }
  }),
  profile: () => get().profiles.find(p => p.id === get().activeId) ?? get().profiles[0],
}))

/** Stable id factory for user-added rows. */
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
