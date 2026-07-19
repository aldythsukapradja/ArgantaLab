# Arganta Repository-Grounding Errata

**Evidence cut:** commit `27188da2` (`updated`, 2026-07-18 22:27) plus the working tree inspected on 2026-07-18  
**Scope:** `docs/audit/2026-07-18`, `docs/repository-archaeology`, `knowledge-base`, application code, Supabase SQL, CI, tests, and deploy configuration  
**Purpose:** correct the July 18 audit where the repository contradicts it, distinguish facts from assertions, and turn the surviving findings into an executable founder agenda  
**Status:** repo-grounded correction layer; the founder still owns strategy and external-state confirmation

## Bottom line

The July 18 audit is directionally strong on focus, founder-led validation, and the danger of substituting architecture for customer evidence. It is not yet reliable enough to serve as a diligence record without this correction layer.

The most important correction is material: **Arganta already has a learning-event, mastery, daily-summary, and parent-dashboard pipeline in code and SQL.** The gap is not to invent a minimal mastery model. The gap is to prove the migrations are applied, prove cross-family isolation, connect the pipeline to the first cohort, and validate that its heuristic scoring is useful.

The documentation's larger weakness is provenance. It mixes five different kinds of statement—repository fact, local test result, deployment claim, founder context, and outside-world assertion—without consistently labelling them. This creates false confidence around words such as `LIVE`, `DEPLOYED`, `migration run`, `zero users`, and `parent-only`.

My founder/investor view remains:

> Arganta has unusually substantial product and platform assets for its evidence stage, but the next increase in company value comes from a narrow, instrumented family-learning cohort—not another architecture or strategy document.

## What the repository verifies

### Verified assets

- Seven application directories, eleven packages, six Supabase edge functions, three workers, and seven Vercel configurations are present.
- The visible customer surfaces in `apps/landing`, `apps/kinetik`, and `apps/web` build locally.
- The web test suite passes: **9 files, 140 tests**.
- The package/worker suite used by CI passes: **187 tests**.
- The Arganta chat brain and Kinetik embedding work described in the handoffs are present in the inspected commit.
- A real analytics pipeline exists: answer events are logged, server-side rollups update mastery and daily summaries, and parent-facing code reads and renders those results.

### Verified evidence gap

- No customer-application tests were found for `apps/landing` or `apps/kinetik`.
- Current CI does not explicitly build or test `apps/landing`, `apps/kinetik`, or `apps/web`, and does not run migration/RLS verification.
- The repository contains 104 SQL files but only two files in the ordered `supabase/migrations` directory. Repository state therefore cannot establish which one-off SQL files were applied to production, in what order, or against which project.
- No versioned production probe, migration ledger, cohort result, interview record, or newer active-user evidence artifact was found.
- The latest versioned master knowledge-base snapshot is dated 2026-07-11 and records zero external users at that time. That is a historical snapshot, not proof of current user state.

## Material corrections to the audit

| Audit assertion | Repository finding | Corrected statement | Required action |
|---|---|---|---|
| Note 22 W2 says mastery mapping is not built and proposes a minimal model. | [`analytics.ts`](../../../apps/web/src/lib/analytics.ts), [`migration_analytics_rewards.sql`](../../../supabase/migration_analytics_rewards.sql), [`parentDash.ts`](../../../apps/web/src/lib/parentDash.ts), and [`FamilyPulse.tsx`](../../../apps/web/src/pages/FamilyPulse.tsx) implement event capture, mastery/daily rollups, gap detection, and parent rendering. Landing also reads `kid_dashboard`. | A substantial first mastery pipeline exists. It is **code-present**, not yet proven as deployed, secure, or pedagogically validated. | Replace W2 with a migration/RLS/prod-probe/cohort-validation workstream. |
| Several notes use `LIVE`, `DEPLOYED`, or `migration run` as settled facts. | Code and handoff narratives exist, but no reproducible production evidence ledger was found. | Treat these as deployment claims unless accompanied by a dated probe, project/environment identifier, and result. | Add a production evidence ledger and downgrade unsupported status labels. |
| Chat is described as parent-only. | Kid denial is based on the synthetic `@kids.argantalab.app` email suffix in the edge function and chat SQL. This is not the same as verified guardian authorization. | The current implementation excludes synthetic kid accounts; robust adult/guardian authorization is not proved. | Authorize via trusted role/profile/guardian relationships and add negative tests. |
| The chat brain is presented as a broad tool layer. | `generate_image` is the only live action. Family-related tool names are allowlisted/planned, and the health response exposes them together. The visible assistant remains deterministic except for story-image generation. | The edge brain is an image-generation action plus planned tool contracts, not yet the general assistant runtime. | Report `liveTools` separately from `plannedTools`; wire one real family data action only when access tests exist. |
| The audit implies persisted assistant memory. | The migration/table work is described, but current thread history remains in client memory and the visible assistant does not use server-persisted history as its main runtime. | Persistence infrastructure and user-facing persistent memory are different states. | Add an end-to-end persistence test before claiming memory is live. |
| `Parent-only` safety is treated as sufficiently closed. | Direct client reads and `kid_dashboard` depend on RLS/guardian checks, but automated cross-family denial tests were not found. | The access-control shape is promising; enforcement remains unverified. | Test same-family allow, other-family deny, kid deny, anonymous deny, and service-role boundaries. |
| Note 23 states that 97% of AI budget was spent on architecture and that no prospective family was contacted. | No repository artifact can establish either claim. | No customer-contact or usage evidence artifact was found in the inspected repository. Absence of an artifact is not proof that no contact occurred. | Ask the founder for CRM/interview evidence; record facts with dates and sources. |
| Note 23 states the spouse did not consent and that no entity exists. | No consent or entity/IP-assignment artifact was found in the repository. | These are unverified founder/legal questions, not repository facts. | Confirm privately; use qualified legal advice for liability/entity conclusions. |
| Note 23 makes compensation, personal-liability, and NPV conclusions. | These require personal financial inputs, jurisdiction, and legal/tax advice not present in the repository. | They are scenario hypotheses, not diligence conclusions. | Move them to a founder-input worksheet and label assumptions explicitly. |
| Note 21 proposes a $4.99 plan. | The strategy-of-record review proposes $9/month and $79/year. Product entitlements tied to either price are not fully implemented or validated. | Pricing is unresolved; $4.99 and $9/$79 are hypotheses, not canon. | Pick one cohort offer and one post-cohort willingness-to-pay test; do not publish conflicting price canon. |
| The documentation suggests a unified public Arganta direction. | [`doctrineData.ts`](../../../apps/hq/src/surfaces/brand/doctrineData.ts) still maps multiple desires to ArgantaLab, Kinetik, Lashira, and other product identities. | Strategic simplification is documented but not synchronized into product/brand canon. | Decide the public promise, then update the doctrine/brand registry and product copy together. |
| The master handoff calls strategy settled while also requesting founder ratification. | Those are different governance states. | The current review is a **provisional strategy of record pending founder ratification**. | Record a dated founder decision and supersede conflicting pricing/wedge documents. |

## The mastery system: what exists and what remains

The code path is more complete than the audit recognizes:

1. [`analytics.ts`](../../../apps/web/src/lib/analytics.ts) logs answered-item events through `log_learn_event`.
2. [`migration_analytics_rewards.sql`](../../../supabase/migration_analytics_rewards.sql) defines the server-side event path, mastery updates, daily summaries, and guardian/self-gated `kid_dashboard` RPC.
3. [`parentDash.ts`](../../../apps/web/src/lib/parentDash.ts) converts dashboard data into mastery levels, gaps, competency accuracy, interests, and rewards.
4. [`FamilyPulse.tsx`](../../../apps/web/src/pages/FamilyPulse.tsx) renders the parent view.
5. Landing chat/Pulse code reads `my_children` and `kid_dashboard` to derive recent accuracy, streak, and trend.

What this does **not** prove:

- that all required migrations are applied in production;
- that `is_guardian_of` and dependent schema are current in every environment;
- that a guardian cannot retrieve another family's child data;
- that the first cohort actually generates complete, interpretable event histories;
- that the scoring thresholds predict learning or are understandable to families;
- that sample/fallback data is never mistaken for live child evidence.

The adaptive scoring currently uses deterministic heuristics (including mastery increments and Leitner-style progression). These are reasonable product hypotheses. Documentation should call them **heuristic mastery indicators**, not validated efficacy or educational proof.

### Correct replacement for W2

Replace “build a minimal mastery model” with:

> **W2 — Prove the existing learning-evidence pipeline.** Apply and fingerprint the analytics migrations in the target environment; run guardian and cross-family denial tests; complete one end-to-end child-answer-to-parent-dashboard trace; clearly label sample data; and use the first cohort to test whether the mastery and gap indicators are understandable and actionable.

Suggested acceptance evidence:

- migration hash, project reference, timestamp, and applied-state query;
- one anonymized event-to-rollup trace;
- automated allow/deny matrix for RLS/RPC access;
- screenshot or JSON probe showing live-versus-sample state;
- five parent comprehension interviews or an explicit alternative sample size;
- a decision log for changing or retaining mastery thresholds.

## Product and technical gaps that survive battle-testing

### P0 — before involving more families

1. **Access-control proof.** Add automated tests for guardian, non-guardian, child, anonymous, and cross-family access to child data and chat history.
2. **Production-state proof.** Create a migration/deploy ledger. “Migration run” must include environment, project, timestamp, hash, operator, and verification query.
3. **Live-versus-sample honesty.** Ensure every parent-facing dashboard visibly distinguishes live child data, empty state, and sample/demo state.
4. **Chat authorization and safety.** Replace email-suffix authorization with trusted identity/relationship checks. Add rate limits, request quotas, moderation/abuse handling, and provider-data-flow disclosure before widening use.
5. **Customer-surface regression checks.** Put landing, Kinetik, and web builds/tests into CI. At minimum add smoke tests for authentication, child selection, one learning event, one parent dashboard read, and logout.

### P1 — during the first cohort

1. **Instrument the promised outcome.** Track child activity, answer quality, return behavior, parent dashboard comprehension, and whether a suggested next action was taken.
2. **Test the wedge, not the platform.** Use one promise for one family segment and a fixed cohort duration. Treat other apps as internal assets unless the cohort requires them.
3. **Validate mastery semantics.** Ask parents and educators what `familiar`, `proficient`, and `mastered` imply; prevent the UI from overstating precision.
4. **Persist only useful memory.** Prove one end-to-end assistant memory use case before claiming a general memory layer.
5. **Resolve pricing canon.** Choose the cohort offer and a post-cohort price test. Archive other price points as hypotheses.

### P2 — after evidence

1. Consolidate deploy surfaces and lockfile/workspace policy only where this reduces operating load.
2. Optimize the large web/Kinetik bundles after usage shows which routes matter.
3. Extend the assistant tool layer only after one action has measured family value and hardened authorization.
4. Revisit multi-product branding only after the public promise is demonstrated.

## Documentation integrity findings

### 1. No canonical index or supersession map

The folder contains two `00` documents, numbered notes, a superseded handoff stub, and a duplicate consolidated review. “Complete at 24 notes” is therefore ambiguous. A reader cannot reliably tell which files are canonical, historical, corrected, or awaiting founder confirmation.

**Fix:** add an audit `README.md` containing for every document: status, canonical successor, evidence cut, owner, and decision state.

### 2. The consolidated review is duplicated

The root review and audit-folder copy have the same content hash. The audit copy contains broken relative links because it was copied one directory deeper without rebasing them.

**Fix:** keep [`ARGANTA-CONSOLIDATED-FOUNDER-INVESTOR-REVIEW-2026-07-18.md`](../../ARGANTA-CONSOLIDATED-FOUNDER-INVESTOR-REVIEW-2026-07-18.md) as the single canonical document. Replace the audit copy with a short pointer or clearly mark it as a frozen snapshot.

### 3. At least one audit wikilink is unresolved

The target `17-Remaining-Success-Gaps` does not exist; the corresponding file is numbered `18`.

**Fix:** repair the reference and run a documentation link check in CI.

### 4. The executive summary is stale relative to later corrections

Later notes correct CI, native-wrapper, assistant-brain, wedge, and strategy assumptions, but the early executive summary remains easy to read as authoritative.

**Fix:** add a prominent corrigenda banner pointing to this document and the strategy-of-record, or update the summary directly.

### 5. Knowledge-base snapshots are stale but written in present tense

[`00-MASTER-KB.md`](../../../knowledge-base/00-MASTER-KB.md) is a 2026-07-11 snapshot and does not reflect the latest package/app work. Generated HQ knowledge content can therefore repeat outdated counts and conclusions.

**Fix:** regenerate the KB from the current commit or add `snapshot_at`, `commit`, and `stale_after` metadata rendered visibly in every generated view.

### 6. Claims are not typed by evidence class

The audit mixes code existence with operational truth and personal assertions.

**Fix:** use this status vocabulary everywhere:

| Status | Meaning |
|---|---|
| `CODE_PRESENT` | Implementation is present in the referenced commit. |
| `LOCAL_VERIFIED` | A named command passed locally at a stated commit/date. |
| `DEPLOY_CLAIM` | A handoff says it was deployed, but no current probe is attached. |
| `PROD_PROBED` | A dated production probe and target environment are recorded. |
| `USER_VERIFIED` | Named/anonymized user evidence and date are recorded. |
| `FOUNDER_INPUT` | Personal/company context supplied by the founder, not inferred from the repo. |
| `EXTERNAL_UNVERIFIED` | Market, partner, credit, price, or legal claim awaiting primary-source verification. |

## Recommended documentation changes

### Immediate

1. Mark this file as the correction layer for the July 18 audit.
2. Correct W2 in [`22-Battle-Test-of-Consolidated-Review.md`](22-Battle-Test-of-Consolidated-Review.md).
3. Add an `UNVERIFIED / FOUNDER CONFIRMATION REQUIRED` banner to the personal, legal, and financial assertions in [`23-Black-Hat-Final-Critique.md`](23-Black-Hat-Final-Critique.md).
4. Mark the $4.99 model in [`21-Monetization-Partners-Investors.md`](21-Monetization-Partners-Investors.md) as a superseded pricing hypothesis unless the founder selects it.
5. Change the master handoff's status from settled to provisional pending founder ratification.
6. Create the missing `FOCUS.md` only after the founder ratifies the wedge, cohort, time budget, and stop rule.

### Next

1. Add `docs/audit/2026-07-18/README.md` as the canonical index.
2. Add `docs/evidence/production-ledger.md` or an equivalent machine-readable ledger.
3. Add a link checker and customer-app build/test matrix to CI.
4. Regenerate or clearly expire the knowledge-base snapshot.
5. Convert the audit's surviving action items into a single owner/date/evidence register; archive narrative duplicates.

## Founder/investor decision frame

The repository supports three conclusions:

1. **Technical feasibility risk is no longer the dominant risk.** There is enough product, data, and infrastructure to run a meaningful experiment.
2. **Trust and evidence risk are still high.** Child-data authorization, production migration state, heuristic mastery claims, and live-versus-sample boundaries need proof before scale.
3. **Commercial risk is almost entirely unresolved.** The repository does not provide current evidence of repeated external use, willingness to pay, or a repeatable acquisition path.

For the next decision gate, I would not ask “did the founder build the next six workstreams?” I would ask:

- Did 5–10 target families complete the defined cohort?
- Did the existing event/mastery pipeline produce trusted, understandable evidence?
- Did at least three families take a meaningful repeat action without founder prompting?
- Did any family commit money, a deposit, or an unambiguous purchase intent at the selected price?
- Were all child-data access tests and live/sample boundaries passed?
- Did the founder remain within the agreed time and cash box?

If those answers are positive, the existing platform becomes leverage. If they are not, more platform work is unlikely to repair the core risk.

## Verification record

The following was run or inspected against the evidence cut and working tree:

| Check | Result |
|---|---|
| `apps/web` test run | 9 files, 140 tests passed |
| Package/worker test command represented in CI | 187 tests passed |
| `apps/landing` production build | Passed |
| `apps/kinetik` production build | Passed |
| `apps/web` production build | Passed |
| Customer-app test-file search in landing/Kinetik | None found |
| CI references to landing/Kinetik/web/migration/RLS verification | None found |
| Ordered migration directory | 2 files |
| SQL files across repository | 104 files |
| Root versus audit consolidated review | Exact duplicate by SHA-256 |
| Audit local-link check | 1 unresolved wikilink; 17 broken relative links in the duplicated review |
| `FOCUS.md` and `docs/blueprint` | Not present |

Local build success is not production verification. No production systems were mutated during this audit.

## Consolidated recommendation

Accept the July 18 audit's focus thesis, reject or relabel its unsupported factual claims, correct its mastery-system conclusion, and freeze further strategy narrative until one short cohort produces a dated evidence packet.

The best next artifact is not another thesis. It is a compact cohort dossier containing: consent and scope, migration/probe record, access-control results, anonymized usage, parent comprehension, repeat behavior, willingness-to-pay evidence, founder time/cash consumed, and a go/pivot/stop decision.
