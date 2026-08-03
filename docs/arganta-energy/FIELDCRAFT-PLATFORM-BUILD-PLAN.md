# Arganta Fieldcraft — Training Platform Build Plan

Status: product and implementation proposal  
Date: 2026-08-03

## 1. Product decision

**Arganta Fieldcraft is the training platform. The Volve Mission is its flagship course.**

The platform must support a growing catalogue of online, instructor-led and offline-capable technical courses. It should feel familiar to a Coursera learner while remaining uniquely Arganta: every technical course can launch the existing lifecycle workspaces, reuse their components and engines, and connect learner decisions to governed evidence.

Initial catalogue:

| Order | Offering | Owner | Purpose |
| --- | --- | --- | --- |
| 1 | **The Volve Mission: From Discovery to Decision** | Arganta founding team | Five-day flagship covering the full lifecycle |
| 2 | **Exploration Fieldcraft: Basin to Prospect** | Founding Exploration Instructor / subject-matter expert | Deep Exploration Vertical course built through Studio |
| 3+ | Field Development, Well Delivery, Drilling, Reservoir Management and specialist passports | Future domain instructors | Expand by vertical, workflow, role and proficiency |

The navigation label should be **Fieldcraft**, not the name of a specific course.

## 2. Platform promise

> **Learn the workflow. Work the evidence. Prove the decision.**

Fieldcraft combines six products behind one tab:

1. **Catalogue** — discover and enroll in courses.
2. **Course Player** — learn through theory, demonstrations, real app missions and assessments.
3. **Pathways** — combine courses into role- or competency-based journeys.
4. **Fieldcraft Live** — deliver enterprise cohorts in a classroom or restricted network.
5. **Passport** — retain competencies, artifacts, badges and certificates.
6. **Studio** — let instructors build, review, publish and deliver courses without code.

## 3. Information architecture

### Global Fieldcraft navigation

Use one sidebar entry, **LEARN → Fieldcraft**. Inside Fieldcraft use five learner tabs plus one role-gated tab:

| Tab | Purpose |
| --- | --- |
| **Home** | Continue learning, upcoming live session, recommendations and progress |
| **Catalog** | Browse, search, filter, preview and enroll in courses |
| **Pathways** | Follow multi-course role, discipline or proficiency journeys |
| **Live** | Join an instructor-led cohort, see agenda, team and competition |
| **Passport** | View competencies, artifacts, badges, certificates and verification |
| **Studio** | Role-gated authoring, review, publishing, cohort and enterprise controls |

Do not place `Learn`, `Labs` or `Assessments` at global level once multiple courses exist. They belong inside each course.

### Course workspace

Each course opens into a consistent workspace:

| Course section | Contents |
| --- | --- |
| **Overview** | Promise, instructor, syllabus, outcomes, prerequisites, effort and enrollment |
| **Learn** | Module outline, lesson player, presentation/video/article blocks and notes |
| **Labs** | Guided missions that launch real Arganta workspaces and capture evidence |
| **Assessments** | Practice, module quizzes, final exam, attempts and remediation |
| **Resources** | Glossary, source documents, references, downloads and instructor announcements |

Recommended route structure:

```text
/fieldcraft
/fieldcraft/catalog
/fieldcraft/pathways
/fieldcraft/live
/fieldcraft/passport
/fieldcraft/course/:courseSlug
/fieldcraft/course/:courseSlug/learn/:lessonId
/fieldcraft/course/:courseSlug/lab/:labId
/fieldcraft/course/:courseSlug/assessment/:assessmentId
/fieldcraft/live/:cohortId
/fieldcraft/studio
/fieldcraft/studio/course/:courseId
/fieldcraft/studio/cohort/:cohortId
/credentials/:credentialId
```

## 4. Course and pathway taxonomy

The catalogue needs more structure than a list of training files.

### Offering types

- **Flagship** — broad, signature experience such as The Volve Mission.
- **Vertical Passport** — Exploration, Field Development, Well Delivery, Drilling or Reservoir Management.
- **Workflow Masterclass** — narrower technical workflow such as Volumetrics or Production Diagnostics.
- **Role Pathway** — a sequence for Graduate Geoscientist, Exploration Geologist or Asset Integrator.
- **Enterprise Program** — client-specific combination of approved courses and live sessions.
- **Reference Module** — short uncredentialed learning resource.

### Course metadata

Every catalogue item must declare:

- title, subtitle, cover and trailer/preview;
- instructor and reviewing experts;
- discipline, lifecycle and competency tags;
- proficiency level;
- learning outcomes and prerequisites;
- delivery modes;
- estimated effort and live duration;
- language and accessibility state;
- included labs and required app/data access;
- assessment and certificate rules;
- current version, review date and content-health state;
- public, invitation-only or organization-only visibility.

## 5. Platform experience

### Learner Home

The first screen should answer four questions immediately:

1. What am I enrolled in?
2. What should I do next?
3. What have I demonstrated?
4. What live event or deadline is approaching?

Core components:

- `ContinueCourseHero`
- `EnrollmentRail`
- `UpcomingLiveSession`
- `WeeklyLearningGoal`
- `PathwayProgress`
- `RecommendedCourseRail`
- `RecentResult`
- `PassportPreview`

### Catalog

- Featured flagship banner.
- Search and filters for lifecycle, discipline, level, role, duration and delivery mode.
- Course cards with outcome, effort, rating later, instructor and credential.
- Course preview without enrollment.
- Collections such as `Start Here`, `Exploration`, `Live This Quarter` and `Uses Real Field Data`.
- Enterprise-only catalogues controlled by organization membership.

### Course Player

The player must support the same lesson contract across all courses:

```text
Brief → Learn → See → Do → Decide → Check → Capture
```

Content blocks:

- Markdown/text
- Presentation
- Video/audio
- Image/diagram
- Interactive chart/table
- Evidence card
- Existing app component
- Existing app route/view state
- Guided lab
- Reflection/observation
- Practice MCQ
- Discussion prompt later
- Download/resource

### Lifecycle lab bridge

Fieldcraft does not recreate Exploration or other technical tools. It adds a learning adapter around them:

```text
Course Player
  → launches existing lifecycle route
  → applies course-pinned data scope and saved view state
  → shows Guided Mission Rail
  → observes explicit completion events
  → captures artifact + evidence references
  → returns to course progress
```

Required adapter contract:

```ts
type LearningLaunch = {
  courseVersionId: string;
  labId: string;
  domain: 'exploration' | 'field-development' | 'well-delivery' | 'drilling' | 'reservoir-management' | 'data' | 'knowledge';
  route: string;
  scope: Record<string, string>;
  viewState?: Record<string, unknown>;
  requiredEvents: string[];
  allowedDataPackId: string;
  returnTarget: string;
};
```

The adapter must use public component/workflow contracts and never import private internal state from a lifecycle surface.

## 6. Studio — the course factory

Studio is essential. The second Exploration course should prove that a domain expert can create a publishable course without a developer rebuilding the UI.

### Studio navigation

| Section | Job |
| --- | --- |
| **Dashboard** | See drafts, reviews, live cohorts and content-health warnings |
| **Courses** | Create, duplicate, organize and version courses |
| **Library** | Manage reusable lessons, media, references, labs and templates |
| **Questions** | Build question banks and assessment blueprints |
| **Reviews** | Domain, assessment, editorial and accessibility approvals |
| **Live Cohorts** | Schedule and facilitate instructor-led programs |
| **Credentials** | Define, issue, verify and revoke badges/certificates |
| **Organizations** | Manage enterprise catalogues, users and reporting |

### No-code course-building workflow

```text
Choose template
→ define audience and outcomes
→ select competencies
→ create modules
→ assemble content blocks
→ attach app labs and evidence
→ build question bank
→ configure assessment blueprint
→ preview as learner
→ submit for review
→ publish immutable version
→ open enrollment or create cohort
```

### Course templates

1. **Vertical Passport** — recommended for the Exploration course.
2. **Workflow Masterclass** — focused technical method.
3. **Five-Day Fieldcraft Live** — reusable enterprise agenda.
4. **Self-Paced Certificate** — Coursera-style online course.
5. **Reference Module** — short reading/demo without assessment.

### Exploration Vertical author pilot

Proposed title: **Exploration Fieldcraft: Basin to Prospect**.

The author should be able to:

1. Start from the `Vertical Passport` template.
2. Select the Exploration workflow groups already defined in the app.
3. Choose which tabs become modules and which remain optional resources.
4. Attach theory blocks, his own presentations, references and instructor notes.
5. Select existing maps, risk tools, analogue tools and volumetric engines through an `App Component Picker`.
6. Configure saved start states and guided lab steps.
7. Add MCQs with evidence-backed answer explanations.
8. Preview the complete learner experience.
9. Submit the course for domain, assessment and publishing review.
10. Publish a new version without touching React or TypeScript.

The pilot passes only when the instructor can revise lesson content, add a lab and replace a quiz question independently.

## 7. Roles and permissions

| Role | Core permissions |
| --- | --- |
| Learner | Enroll, learn, attempt, join cohort, retain Passport |
| Instructor | Deliver approved courses, manage cohort activity and score reviewed artifacts |
| Author | Create/edit drafts from approved components and evidence |
| Domain reviewer | Approve technical accuracy and acceptable interpretations |
| Assessment reviewer | Approve questions, blueprints, scoring and remediation |
| Publisher | Release immutable course versions and retire old versions |
| Organization manager | Manage enterprise enrollment and aggregate reporting |
| Credential manager | Issue, verify, expire or revoke credentials |
| Platform admin | Manage global configuration without bypassing content approvals |

One person may hold several roles initially, but the permissions and audit events should remain separate.

## 8. Technical architecture

### Recommended stack

Use the existing ArgantaEnergy stack wherever possible:

- React + TypeScript + Vite for surfaces.
- Existing Cosmo shell and design system.
- Zustand for ephemeral player/workspace state.
- Supabase Auth for identity.
- Supabase Postgres for catalogue, progress, attempts, cohorts and governance.
- Supabase Storage for course media, exports and signed training packs.
- IndexedDB plus an append-only event queue for offline learner state.
- Existing deterministic scientific engines and data bundles.
- Existing Knowledge and provenance contracts for grounding.

Do not store durable course progress or credentials only in `localStorage`. Use a persistence adapter so the same runtime can target cloud Postgres, a local classroom server or an offline event store.

### Bounded modules

```text
fieldcraft/catalog       course discovery and enrollment
fieldcraft/runtime       course/lesson/block rendering
fieldcraft/labs          lifecycle bridge and artifact capture
fieldcraft/assessment    question pools, attempts, scoring, remediation
fieldcraft/passport      competencies, badges, certificates, verification
fieldcraft/studio        author/review/publish tools
fieldcraft/live          cohort agenda, teams, competition and facilitation
fieldcraft/offline       training pack, local event queue and sync
fieldcraft/enterprise    organizations, catalogues and aggregate reporting
```

### Persistence layers

1. **Published content layer** — immutable course versions and training packs.
2. **Authoring layer** — mutable drafts, review comments and candidate questions.
3. **Learner layer** — enrollment, progress, responses, attempts and artifacts.
4. **Enterprise layer** — organizations, cohorts, memberships and aggregate reports.
5. **Credential layer** — definitions, issues, verification status and revocation.

### Core entity groups

```text
Identity:      profile, organization, membership, role_assignment
Catalog:       course, course_version, collection, pathway, pathway_course
Curriculum:    competency, outcome, module, lesson, content_block, resource
Grounding:     grounding_ref, evidence_snapshot, content_health_check
Labs:          lab, lab_step, learning_launch, artifact_definition, artifact_submission
Assessment:    question, question_version, option, blueprint, attempt, response, remediation
Learning:      enrollment, progress_event, progress_snapshot, note, bookmark
Live:          cohort, session, agenda_item, team, attendance, score_event, announcement
Credentials:   credential_definition, credential_issue, verification_event, revocation
Governance:    review_request, review_record, publish_event, audit_event
Offline:       training_pack, pack_manifest, sync_event, sync_conflict
```

### Security and tenancy

- Row-level security for user, organization and role boundaries.
- Enterprise managers see aggregate capability data by default, not private learner notes.
- Authors cannot approve their own technical content unless explicitly operating in a documented single-person mode.
- Published versions are immutable.
- Assessment answer keys never ship in an openly inspectable learner payload before submission.
- Offline packs encrypt restricted questions and learner exports.
- Client data is isolated by organization and never enters a public course pack.
- Credential issuance and revocation are server-authoritative.

## 9. Assessment and credential services

The assessment engine is platform-wide, not rebuilt for each course.

Capabilities:

- practice versus scored mode;
- competency- and difficulty-balanced question pools;
- deterministic randomization from a versioned blueprint;
- attempt limits, cooldown and remediation;
- visual/evidence-backed MCQs;
- per-option feedback in practice;
- restricted review after final exams;
- item analysis: facility, discrimination and distractor performance;
- manual review seam for future advanced artifacts;
- accessibility and localization fields;
- audit trail from question version to credential issue.

Credential hierarchy:

```text
Module achievement
→ Course badge/certificate
→ Vertical Passport
→ Multi-course Role Pathway / Comprehensive Learner Record
```

Prepare credentials for Open Badges 3.0, but do not block the MVP on external wallet integration. V1 requires a secure verification page, unique ID, QR code and revocation state.

## 10. Live and enterprise capability

The five-day Volve course is the first live product, but the live engine must be reusable by every future course.

Shared capabilities:

- cohort creation and participant import;
- scheduled agenda from published course objects;
- instructor console and projector mode;
- session unlocks and announcements;
- attendance and progress heatmap;
- live polls and individual quizzes;
- stable teams, role rotation and configurable scoring rubric;
- artifact submission and rubric scoring;
- client-branded workbook, certificate and completion report;
- local/LAN delivery from a signed training pack;
- post-course sync and credential issuance.

Enterprise reporting should answer:

- Who enrolled, attended and completed?
- Which competencies were assessed?
- Where did the cohort struggle?
- Which learners require remediation?
- Which course version and data pack were used?
- Which credentials remain valid?

## 11. Build sequence

Use gated increments. Do not author the full course catalogue before the runtime and Studio contracts are proven.

### Phase 0 — Contracts and prototype map

Deliverables:

- final Fieldcraft navigation and route map;
- TypeScript contracts for course, block, lab launch, progress event, question and credential;
- component registry for reusable Arganta workspaces/engines;
- backend decision record and tenancy model;
- clickable low-fidelity flows for learner, author and instructor;
- map of the flagship syllabus into course objects.

Exit gate: the team can represent one complete Volve module and one proposed Exploration module using data/config only.

### Phase 1 — Platform shell and local vertical slice

Build:

- Fieldcraft sidebar entry and global tabs;
- learner Home and Catalog with seeded courses;
- course Overview and module outline;
- generic Lesson Player for core content blocks;
- local persistence adapter;
- one guided lifecycle launch and return flow;
- basic progress calculation.

Use one Day 1 Volve module as the test content.

Exit gate: a learner can discover, enroll, start, leave, resume and complete one evidence-grounded lesson/lab without bespoke page code.

### Phase 2 — Cloud identity, catalogue and progress

Build:

- Supabase Auth integration;
- organization and role model;
- catalogue/course/version schema with row-level security;
- enrollment and append-only progress events;
- media/resource storage;
- learner dashboard synchronized across devices;
- import/seed pipeline for authored JSON content.

Exit gate: two users with different roles see correct data; progress survives device/session changes; published content cannot be silently edited.

### Phase 3 — Labs, assessment and Passport

Build:

- reusable lifecycle learning adapter;
- Guided Mission Rail, completion events and evidence capture;
- question bank and versioned assessment engine;
- module quiz, final exam, attempt and remediation flows;
- competency progress and artifact portfolio;
- certificate renderer and public verification page.

Exit gate: one learner can complete a course, fail/remediate/pass an assessment and receive a verifiable test credential grounded to immutable versions.

### Phase 4 — Studio authoring MVP

Build:

- course template selector;
- outline/module/lesson builder;
- block editor and media library;
- Evidence Picker and App Component Picker;
- guided lab builder with saved view state;
- question editor and assessment blueprint editor;
- learner preview;
- review queue and immutable publish flow;
- content-health warnings.

Pilot with the Exploration Vertical instructor while building—not after Studio is finished.

Exit gate: the instructor independently creates and revises one Exploration module, submits it, receives review feedback and publishes a test version without developer intervention.

### Phase 5 — Five-day Live delivery

Build:

- cohort and agenda management;
- facilitator console and projector mode;
- teams, role rotation and 100-point daily scoring;
- polls, attendance, artifact rubric and leaderboard;
- enterprise completion report;
- learner workbook and instructor-guide export;
- training-pack manifest and local/LAN runtime;
- offline event queue and controlled sync.

Exit gate: run a complete internal rehearsal of the five-day Volve course using the same course objects as online mode, including a temporary public-internet outage.

### Phase 6 — Content production

Two parallel course workstreams:

**A. The Volve Mission**

- complete five-day content, labs, daily challenges and question bank;
- domain and assessment reviews;
- dry runs with novice and experienced learners;
- final certificate and instructor package.

**B. Exploration Fieldcraft: Basin to Prospect**

- author course outcomes and module map;
- reuse existing Exploration workflow groups;
- add instructor theory and references;
- configure deeper labs and assessments;
- prove reuse of platform templates and components.

Exit gate: the catalogue contains two genuinely different courses built from the same runtime and Studio.

### Phase 7 — Launch hardening

- accessibility and keyboard audit;
- security/RLS review;
- backup/restore and credential revocation tests;
- performance testing for a 24-person live cohort;
- offline pack checksum, expiry and sync-conflict tests;
- item-quality dashboards;
- course-version migration and retirement flow;
- support/runbook and facilitator recovery procedures;
- pilot delivery, feedback and controlled public/enterprise release.

## 12. Recommended implementation releases

| Release | User-visible outcome |
| --- | --- |
| **R0 — Fieldcraft Frame** | Navigation, seeded catalog and course preview |
| **R1 — Learn** | Enroll, lesson player, progress and one real app lab |
| **R2 — Prove** | Assessments, remediation, Passport and test certificate |
| **R3 — Create** | Studio authoring and Exploration instructor pilot |
| **R4 — Deliver** | Five-day cohort, competition and offline classroom pack |
| **R5 — Launch** | Two reviewed courses, enterprise reporting and hardened credentials |

## 13. MVP boundaries

Include in first production release:

- responsive web learner platform;
- catalog, enrollment, course player and progress;
- existing-app labs;
- MCQ assessments and remediation;
- Passport and verifiable PDF certificate;
- author/reviewer/publisher workflow;
- one five-day live cohort mode;
- one offline/LAN training pack;
- The Volve Mission plus one Exploration authoring pilot.

Defer:

- marketplace payments and instructor revenue sharing;
- public ratings/reviews;
- discussion forums and peer grading;
- native mobile apps;
- external university credit;
- advanced remote proctoring;
- SCORM/xAPI/LTI integrations;
- Open Badges wallet interoperability;
- L3/L4 credentials requiring qualified assessors;
- three-day and four-day Volve derivatives.

## 14. Platform success measures

### Learner

- catalog preview → enrollment conversion;
- first-lesson and first-lab completion;
- weekly return and course completion;
- assessment mastery after remediation;
- certificate verification/share;
- confidence calibration and competency gain.

### Author

- time from draft to publish;
- percentage of edits completed without developers;
- reuse of lessons, evidence and app components;
- review turnaround and defect rate;
- stale-evidence warnings resolved before publication.

### Enterprise/live

- cohort attendance and completion;
- instructor preparation time;
- agenda adherence without consuming breaks;
- lab completion and misconception hotspots;
- offline sync success;
- repeat bookings and reuse across clients.

### Platform

- published-version integrity;
- assessment item quality;
- credential verification availability;
- course/runtime compatibility failures;
- cross-course component reuse.

## 15. First decisions

1. Confirm **Fieldcraft** as the platform tab and **The Volve Mission** as a course inside it.
2. Confirm the global tabs: Home, Catalog, Pathways, Live, Passport and role-gated Studio.
3. Confirm **Exploration Fieldcraft: Basin to Prospect** as the working title for the second course.
4. Confirm Supabase as the online system of record, with a persistence adapter for offline/LAN delivery.
5. Confirm the author pilot success criterion: the Exploration instructor publishes one reviewed module without developer help.
6. Confirm that the first production release launches with two course cards even if the second remains marked `Coming Soon` during the initial Volve pilot.

## 16. Recommended next implementation slice

Build the **Fieldcraft Frame** first:

1. Add the Fieldcraft shell entry.
2. Create global Home and Catalog surfaces.
3. Seed two course cards: The Volve Mission and Exploration Fieldcraft.
4. Open The Volve Mission into a generic Course Overview/module outline.
5. Define the data-driven course contract and render one lesson from config.
6. Deep-link one lab into the existing Exploration workspace and return with a captured evidence artifact.

That slice proves the platform architecture before significant course-authoring effort begins.

