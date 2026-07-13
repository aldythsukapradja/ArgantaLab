---
title: ArgantaLab Valuation Audit
aliases:
  - Arganta Valuation Audit
  - ArgantaLab Defensible Valuation
date: 2026-07-13
updated: 2026-07-13
category: Business
type: valuation-audit
status: final-draft
company: ArgantaLab
currency: USD
valuation_date: 2026-07-13
valuation_basis: indicative pre-money equity value
audit_commit: 4b688536
audit_branch: main
confidence: medium-low
tags:
  - arganta
  - valuation
  - strategy
  - due-diligence
  - fundraising
  - obsidian
cssclasses:
  - valuation-audit
---

# ArgantaLab — Valuation Audit

> [!abstract] Audit conclusion
> ArgantaLab is an unusually deep, coherent solo-founder platform prototype with real technical assets, strong execution velocity, and a credible integrated vision. It is **not yet a product-market-fit company**: the latest verified knowledge-base snapshot records **zero external users**, no validated retention cohort, and no real-money revenue. The most defensible current indicative pre-money range is **$1.8M–$2.8M**, with an audit point estimate of **$2.2M** (approximately **QAR 8.0M**) and a recommended fundraising opening position of a **$2.5M SAFE cap** (approximately **QAR 9.1M**).

> [!warning] Important interpretation
> This is a decision-support valuation audit, not a statutory valuation, fairness opinion, tax valuation, or investment recommendation. It estimates what can be defended from the repository and available knowledge base as of the valuation date. It does **not** assert that a buyer or investor will transact at the stated value.

## Executive decision

### Table 1 — High-level, defensible valuation

| Decision item | Audit conclusion | Defensible benchmark | Evidence quality | Investor interpretation |
|---|---:|---|---|---|
| **Indicative pre-money range today** | **$1.8M–$2.8M** | Weighted triangulation of Cost-to-Duplicate, Berkus, Risk-Factor Summation, Scorecard, VC, and First Chicago methods | **Medium-low** | Stronger than an idea-stage project; weaker than a traction-backed seed company |
| **Audit point estimate** | **$2.2M** / **QAR 8.0M** | Near the internal deterministic model midpoint of ~$2.10M, adjusted modestly for current repo depth and integrated platform option value | **Medium-low** | Best single planning number; do not present it as a precise market price |
| **Recommended SAFE negotiation cap** | **$2.5M** / **QAR 9.1M** | Fundraising anchor above fair-value point but inside the defensible range | **Medium** as a negotiation position | Reasonable for a warm, conviction-led angel; not yet supported by traction |
| **Stretch position** | **Up to $3.0M** / **QAR 10.9M** | Exceptional founder velocity, strong demo, strategic investor, or near-term pilot evidence | **Low-medium** | Arguable, but depends on investor-specific option value |
| **Currently difficult to defend** | **$3.5M+** | Would normally require external retention, payment evidence, proprietary distribution, or independently validated outcomes | **High confidence in limitation** | The repo alone does not close the commercial-risk gap |
| **Internal HQ model output** | **$1.81M–$2.38M**; midpoint ~$2.10M | Current six-method engine in `apps/hq/src/data/graph/valuation.ts` | **Mechanically reproducible; inputs weak** | Useful baseline, but some benchmarks and scenarios are manually assumed or simulated |
| **Company stage** | Integrated platform prototype / pre-PMF | 0 verified external users; no live paid cohort | **High** for dated snapshot | Value resides primarily in technology, founder execution, and option value—not current cash flow |

### Table 2 — Detailed valuation-method audit

| Lens | Arganta input and calculation | Result | Benchmark / reference | Audit judgment | Weight today |
|---|---|---:|---|---|---:|
| **Cost to Duplicate** | Internal engine assumes 122K source LOC × approximately $3–$5/LOC; repo also contains a contradictory 96K LOC knowledge-base claim. Current tree contains 676 JS/TS files, 79 SQL files, 466 Markdown files, and a substantial committed art corpus. | **$0.35M–$0.60M** | IVS 210 permits a cost approach for identifiable intangibles; BLS software-developer and QA wage data demonstrate that professional replacement labor is costly. | Useful floor, not enterprise value. The exact LOC has not been independently reproduced, asset duplication inflates bulk, and historical effort does not equal buyer utility. | **High** |
| **Berkus** | Internal engine scores idea $0.40M, team $0.20M, relationships $0.10M, prototype from technical coverage ~$0.39M, and rollout $0.015M because payment remains simulated. | **$0.81M–$1.11M** | Dave Berkus’s five-factor framework assigns up to $500K per factor, designed for pre-revenue ventures. | Appropriate stage lens. Strong prototype and founder execution; major discount for market, relationship, rollout, and payment proof. | **High** |
| **Risk-Factor Summation** | Internal manual regional baseline $4.0M–$5.25M; +$0.25M for technical execution; no activation uplift. | **$4.25M–$5.50M** | Gust overview of the Risk-Factor Summation method; typically adjusts a local angel baseline across risk categories. | Directionally useful but currently **overstates defensibility** because the regional baseline is not connected to current transaction data and several risks are not explicitly debited. | **Low** |
| **Scorecard** | Internal engine directly returns a $4.0M–$5.0M regional band; it does not transparently multiply the ACA factor weights by measured Arganta scores. | **$4.00M–$5.00M** | Angel Capital Association weights: team 30%, opportunity 25%, product/technology 15%, competition 10%, sales/marketing 10%, need for capital 5%, other 5%. | Valid framework, incomplete implementation. A properly scored Arganta assessment would be helped by team and product but heavily reduced by traction, distribution, commercial validation, and key-person concentration. | **Low** |
| **VC Method** | Assumes $25M exit ARR × 7× revenue, 20–25× required return, and 50% future dilution. | **$3.50M–$4.38M** | Damodaran’s work on young-growth-company valuation supports scenario analysis and explicit survival, dilution, and exit assumptions. | Scenario value, not observed value. The $25M ARR outcome, 7× exit multiple, and execution path are not yet empirically grounded. | **Low** |
| **First Chicago** | $4M / $20M / $50M ARR cases × 7× multiple ÷ 20× return × 50% dilution; probabilities 50% / 35% / 15%. | **$2.60M–$3.41M** | Standard scenario-weighted venture technique; consistent with probability-weighting uncertain company outcomes. | Better than a single heroic forecast, but probability weights and terminal cases remain judgmental. Use as an option-value ceiling, not the central proof. | **Medium-low** |
| **Market financing comparables** | Carta reports much higher U.S. pre-seed SAFE caps, especially in AI; Qatar funding activity also expanded in 2025. | **Context only** | Carta State of Pre-Seed; MAGNiTT Qatar VC report. | Financing terms are not fair value. U.S. and AI premiums should not be imported directly into a Qatar-based, pre-traction family/education company. | **Context only** |
| **Revenue multiple cross-check** | Private B2B SaaS benchmarks around 4.8×–5.3× imply that a $6M–$12M revenue-supported valuation would need roughly $1.1M–$2.5M ARR. | **Not applicable today** | SaaS Capital private-company multiple benchmarks. | Arganta has no verified ARR and is consumer/family/education rather than pure B2B SaaS. This is a future milestone cross-check only. | **Zero today** |
| **Audit synthesis** | Stage-appropriate weighted triangulation, with greatest reliance on Cost-to-Duplicate and Berkus; reduced reliance on assumed regional, revenue, and exit cases. | **$1.8M–$2.8M**; point **$2.2M** | IPEV principle: use multiple techniques, current market evidence, consistent methods, and judgment. | Most defensible current conclusion. The range should tighten only after live cohorts, payments, and benchmark provenance are available. | **100% synthesis** |

## 1. Mandate, scope, and standard of proof

This audit addresses five questions:

1. What has actually been built?
2. Which parts constitute reusable or defensible company assets?
3. Which company claims are live, partial, simulated, placeholder, inferred, or contradictory?
4. What valuation range can be defended today using recognized early-stage methods?
5. What evidence would unlock a higher valuation?

### Evidence reviewed

- Repository `main` at commit `4b688536` dated 2026-07-12.
- Repository tree, package manifests, SQL migrations, tests, workflow configuration, valuation engine, financial model, growth model, MCP bridge, and Agent OS design.
- The internal knowledge base, including [[00-MASTER-KB]], [[ArgantaLabs]], [[KinetikCircle]], [[LashiraBloom]], [[HQ]], [[Investor Narrative]], [[Product Loop]], [[Product Roadmap]], [[Family Pilot Plan]], [[The Economy]], [[Founder Decisions]], and the knowledge-base verification method.
- Current deterministic CEO brief and valuation behavior exposed by the Arganta MCP implementation.
- External primary or authoritative references for valuation practice, labor cost, retention, financing terms, and category analogs.

### Provenance scale

| Label | Meaning in this audit | Example |
|---|---|---|
| **Live-observed** | Read from a current production system or verified external transaction | None available for users, retention, or revenue in this audit |
| **Live-backed** | Code path exists to read a live source, but the current value was not independently observed | Supabase-backed growth RPCs |
| **Repo-verified** | Directly verified in code, tree, migration, or configuration | 42,829 tracked files; 479 commits; 7 package directories |
| **Snapshot** | Recorded in a dated internal knowledge-base snapshot | 0 external users on 2026-07-11 |
| **Simulated / placeholder** | Scenario, seed, mock, or default rather than a measured business fact | HQ financial model; pay stage; some CEO-brief nodes |
| **Inferred** | Analyst conclusion derived from verified evidence | Product depth is strong, distribution proof is weak |

> [!important] Valuation discipline
> “Live” inside a product schema can mean that a node has a live-capable data path. It does not necessarily mean that the current number was retrieved from production. This audit preserves that distinction.

## 2. What the company actually is

ArgantaLab is best understood as a **shared family learning substrate**, not a collection of unrelated applications.

The integrated loop documented in [[Product Loop]] is:

1. **Learn — ArgantaLabs:** adaptive learning, quests, streaks, badges, parent visibility, Arena, KinQuest, and a game-builder layer.
2. **Bloom — LashiraBloom:** a persistent, game-like family world in which learning and participation can create emotional retention and identity.
3. **Organize — KinetikCircle:** the adult/family coordination layer for calendars, chores, moments, routines, and family operations.
4. **Observe and govern — HQ:** an internal operating cockpit for graph state, finance, growth, verdicts, agents, and decision support.

The technical thesis is credible: one Supabase-oriented backend, a shared family identity/circle model, shared packages, a reusable visual pipeline, and multiple frontends. The strongest one-line formulation is:

> **Arganta is a family learning platform in which children’s learning powers a persistent world, parents extend it into family coordination, and an agentic HQ governs the system.**

That is a differentiated vision. However, the **integration itself is not yet a market moat**. It becomes a moat only when it produces a measurable advantage—higher activation, retention, learning outcomes, family invitations, content creation, or lower operating cost—relative to focused alternatives.

## 3. Repository and asset audit

### 3.1 Verified repository footprint

| Indicator | Verified or documented state | Audit interpretation |
|---|---:|---|
| Audited branch / commit | `main` / `4b688536` | Current audit anchor |
| Commit count | **479** | Meaningful execution history, but commit count is not traction |
| Tracked files | **42,829** | Very large for a pre-traction company; dominated by assets |
| Bitmap assets | **40,130** PNG/JPG/JPEG/WebP/GIF | Material creative corpus, but duplication and transferability must be audited |
| JS/TS source files | **676** | Strong software breadth |
| SQL files | **79** | Substantial data-layer work |
| Markdown files | **466** | Strong documentation/knowledge effort; quality varies |
| Knowledge-base notes | **321** Markdown notes | Valuable founder-memory system if maintained as a single source of truth |
| Table documents | **71** graph table notes | Consistent with the 71-table knowledge-base snapshot |
| Shared packages | **7** current directories | More than the older KB snapshot’s four; documentation is stale |
| Deploy targets | **7** documented | Six Vercel targets plus an MCP service target |
| Tests | At least **9** `apps/web` Vitest files plus specialist harnesses/templates | Better than the old “6 tests” snapshot, but not proportionate to surface area |
| Recent local verification claim | **140 tests pass**, TypeScript clean, production build clean for `apps/web` | Positive, but not a repository-wide independently executed CI result |

### 3.2 LOC inconsistency

The repository contains two same-date or near-same-date internal claims:

- [[00-MASTER-KB]]: approximately **96K LOC**.
- HQ valuation engine comment: approximately **122K source LOC**.

The difference is 26K LOC, or about 27% of the lower number. The audit therefore does **not** certify an exact LOC count. Until the company defines exclusions—generated files, builds, migrations, fixtures, duplicated applications, and vendored assets—the defensible statement is:

> **Arganta internally reports 96K–122K LOC; the discrepancy is unresolved and should not be used as a precise valuation input.**

### 3.3 Architecture strengths

- A coherent family/circle identity model can support cross-product network effects.
- The current tree contains seven shared packages: `ai`, `audio`, `character`, `combat`, `heroes-engine`, `usage`, and `video`.
- ArgantaLabs appears to be the most complete customer-facing application, with a real learning-event write path and multiple content and engagement systems.
- LashiraBloom contains real farm and combat work rather than only concept screens.
- KinetikCircle has a functional family-OS shell and native-capable surface.
- Growth migrations create real Supabase RPC paths for activity, retention, acquisition, economy, and portfolio views.
- HQ is a meaningful internal-product asset: graph model, verdicts, offices, roster, finance, growth, model adapters, and MCP surface.
- The knowledge base documents not only features but operating principles, evidence gaps, milestones, and founder decisions.

### 3.4 Architecture and delivery risks

| Risk | Evidence | Valuation effect | Required remediation |
|---|---|---|---|
| **Asset duplication / repository bloat** | Kingdom client data, committed distribution assets, and Lashira art mirror; repository metadata indicates approximately 918MB | Reduces maintainability and exaggerates replacement-cost impressions | Move immutable assets to object storage/CDN, deduplicate manifests, remove generated builds from source control, and clean history safely |
| **Fragmented dependency baselines** | React 18/19, Vite 5/6, Capacitor 6/8, Supabase 2.45/2.110 across applications | Raises integration, security, and upgrade cost | Establish supported platform matrix and upgrade windows |
| **Incomplete workspace coverage** | Root workspace includes `packages/*`, Kingdom, and Lashira, but excludes several major apps | Prevents reliable repo-wide commands and shared policy | Bring all active applications under a deliberate monorepo strategy or explicitly separate them |
| **Partial CI** | `vault-kb.yml` runs primarily for one branch pattern, checks HQ KB drift/build, but not a full product matrix | Weakens claims of production readiness | Create pull-request CI for typecheck, unit tests, migration lint, build, and artifact checks across all active targets |
| **Small test surface relative to scope** | Some real tests and harnesses, but many product surfaces lack visible systematic coverage | Increases regression and diligence risk | Prioritize event, identity, permission, economy, learning-state, and payment-path tests |
| **Key-person concentration** | Solo-founder execution is a strength and a dependency | Material operational, knowledge, and fundraising risk | Operational runbooks, architecture decision records, deploy recovery, and selective specialist support |
| **Child/family trust obligations** | Education, family identity, UGC signals, and potential payments | Privacy/safety failure could destroy enterprise value | Formal consent, age gating, moderation, data retention, access controls, incident response, and legal review before scale |

## 4. Product-by-product audit

| Product | What is real | What is not yet proven | Current valuation contribution |
|---|---|---|---|
| **ArgantaLabs** | The deepest product; adaptive learning, packs, quests, streaks, badges, parent views, KinQuest, Arena, Game Builder, and a learning-event write RPC | Educator validation, external learner activation, measured outcomes, cohort retention, and payment | **Primary wedge and strongest product asset** |
| **LashiraBloom** | Real farm/combat implementation, shared combat package, persistent-world thesis | Stranger onboarding, reason to return, content cadence, retention lift from learning loop | **Retention and IP option**, not yet commercial proof |
| **KinetikCircle** | Functional family shell, calendar/moments/chores/mini-apps, native-capable architecture | External family adoption, invitation loop, active household behavior, willingness to pay | **Expansion option**; valuable after the child wedge creates parent pull |
| **HQ** | Real cockpit code, offices, roster, graph, finance/growth views, AI runtime, verdicts, proxy, MCP, and extensive design documentation | Autonomous actions, durable run ledger, schedules/events, unified agent registry, real ROI, reliable live-data coverage | **Founder-leverage/IP asset**, but not a virtual workforce |
| **Landing / umbrella** | Coherent external narrative surface | Validated acquisition funnel and conversion | **Brand and narrative support**, not a standalone value driver |

### Strategic sequencing conclusion

The knowledge base contains an important contradiction:

- [[Investor Narrative]] names **KinetikCircle** as the wedge.
- [[Founder Decisions]] states that the wedge remains unanswered.
- The repository and product-depth evidence point to **ArgantaLabs** as the most credible entry product.

The recommended sequence is:

> **ArgantaLabs wedge → LashiraBloom retention/reward world → KinetikCircle parent/family expansion → HQ governance and operating leverage.**

This order minimizes the number of unproven assumptions at each step. A child can receive value from ArgantaLabs before the full family OS is adopted; Lashira can strengthen the child’s return loop; Kinetik can then convert demonstrated child value into parent and household coordination.

## 5. HQ and Agent OS audit

HQ is one of the repository’s most distinctive assets, but it must be represented accurately.

### What is credible today

- A six-office organizational model and 27-agent roster exist in code and documentation.
- The graph and verdict systems create a deterministic operating spine.
- `@arganta/ai` provides model abstraction.
- The operator-gated proxy establishes a sensible future control point.
- An MCP surface exposes CEO brief, graph, node, valuation, financial-model, office, root-cause, and queue functions.
- The Agent OS v2 design correctly identifies the need for registries, tool packs, persistent mission runs, approval-gated writes, scheduled briefs, and ROI measurement.

### What is not credible yet

The current Agent OS design audit records that agents mostly **describe** the company rather than **operate** it. The following gaps remain material:

- Tools are primarily reads; agents do not perform governed operating actions.
- Orchestration is shallow and partly cosmetic.
- Council and organizational models contain hard-coded or conflicting structures.
- Persistent memory, run ledger, schedules, event triggers, autonomy budgets, and agent ROI are not fully implemented.
- Verdicts are mainly rule-derived rather than the output of durable agent missions.
- Displayed model labels do not always describe the actual Gemini/Groq/mock execution path.
- MCP and HQ duplicate some CEO logic instead of sharing one operating brain.

The correct investor statement is:

> **HQ is a real internal decision-support and future agent-platform asset. It is not yet an autonomous digital workforce and should not be valued as one.**

## 6. Live-data and CEO-brief audit

The current CEO brief reports:

- North Star: Weekly Two-Hook Families — partial / amber.
- Graph coverage: 59 of 76 grounded nodes, reported as 78%.
- Provenance mix: 35 live, 24 partial, 3 simulated, and 14 placeholder nodes.
- Weakest lever: activation efficiency.
- Blind offices: Operations, Technology, Treasury, and Legal.
- Root-cause path: `ns.w2f → lever.efficiency → arganta.home → arganta.home.event(feature_view)`.
- `stage.pay` is simulated; `sig.paywall_bounce` and `sig.ugc_flagged` are placeholders.

However, the MCP bridge imports deterministic graph seed nodes and pure engine functions. It does not establish that the brief queried current Supabase business data. Therefore:

- **78% is seed-graph grounding coverage, not 78% live company-data coverage.**
- Only 35 of 76 nodes—approximately **46%**—are marked live/live-backed, and even that does not prove a current production read.
- The latest verified user fact remains the 2026-07-11 knowledge-base snapshot of **0 external users**.
- The repo’s recent commits do not provide evidence of a pilot, external distribution, or payment, but absence of commit evidence is not proof that no off-repo event occurred.

### Required terminology change

Rename graph provenance from `live` to `live-backed` unless a response includes:

- source system,
- query/RPC identifier,
- observation timestamp,
- cohort or entity scope,
- metric definition,
- freshness threshold,
- and error/fallback state.

This single change would make CEO reporting materially more credible.

## 7. Market benchmark and analog audit

### 7.1 Product analogs—not valuation comparables

| Analog | What it validates | Scale signal | What Arganta may learn | Why it is not a direct comparable |
|---|---|---|---|---|
| **Duolingo** | Daily learning habit, gamification, freemium subscription, content flywheel | FY2025 disclosures: over 50M DAU, over $1B bookings, and approximately 9% of MAUs paid | Obsess over daily-return mechanics, learning efficacy, and payer conversion without breaking free utility | Public, global, mature, and many orders of magnitude larger |
| **Prodigy** | Curriculum-linked game world and child engagement | Official materials cite 100M+ registered users/students and parents | The learning-to-world bridge can be a powerful retention mechanism | Established distribution and brand; scale metric is registered users, not current active/paying users |
| **Kahoot!** | Content creation, participation, classroom/family engagement | Official site cites 1B+ participating players annually | Creator tools and repeatable content formats can create distribution | Annual plays/players are not unique active families; enterprise and classroom model differs |
| **Cozi** | Family coordination as a durable consumer category | Official press materials cite more than 20M registered users | Household calendar and routine utility can retain adults | Mature single-category product; registered users are not revenue or current actives |
| **FamilyWall** | Premium family organizer and shared household features | Active consumer offering with premium tier | A family subscription can bundle coordination and safety/utility | Private operating metrics and transaction valuation are not available |

### 7.2 Retention benchmarks

Retention definitions vary by product, platform, country, acquisition source, age group, and whether “return” means opening the app or completing a meaningful learning/family action. Benchmarks must therefore be used as ranges, not universal pass/fail thresholds.

| Metric | External reference point | Arganta management target / implication | Audit view |
|---|---:|---|---|
| General mobile D1 | ~26% in Adjust’s general guide | Internal product targets should define meaningful activation before comparing | Useful broad context only |
| General mobile D7 | ~13% | [[Family Pilot Plan]] proposes D7 ≥20% at an early milestone | 20% would be a strong early signal if measured on activated external families |
| General mobile D30 | ~7% | Internal growth code treats D30 >35% as top-quartile edtech | 35% is an elite aspiration, not a neutral industry average |
| Education Android D1 / D30 | 13.93% / 2.69% in AppsFlyer’s cited education benchmark | A family-learning product should outperform low-intent install cohorts after activation | Older benchmark; use cautiously and preserve platform/cohort definition |
| Education iOS D1 / D30 | 14.59% / 3.23% | Same as above | Older benchmark; not directly comparable to invited family pilots |
| Education D1 / D7 | 18% / 8% in Adjust’s education trend article | Pilot D7 ≥20% is ambitious but credible for a tightly recruited cohort | Do not compare recruited pilot families with paid-acquisition installs without labeling the difference |

### 7.3 Financing benchmarks

Carta’s U.S. pre-seed reporting shows post-money SAFE caps around $10M for smaller institutionalized rounds, rising for larger rounds, and widespread SAFE usage. That is **market context**, not a portable Arganta valuation. The U.S. dataset reflects investor competition, geography, round size, founder networks, and an AI premium that Arganta has not yet earned through commercial evidence.

MAGNiTT reports that Qatar deployed QAR 214M in venture funding in 2025, up 81% year over year. This supports a more active local funding context, but it does not provide a reliable Arganta-stage pre-money median. A defensible Qatar-specific comparable set would require transaction-level data: company stage, round type, capital raised, sector, revenue, user traction, and investor rights.

## 8. Detailed valuation calculations and adjustments

### 8.1 Cost-to-Duplicate

The internal floor of $0.35M–$0.60M is plausible as a heavily discounted replacement-cost estimate, but its rationale needs repair.

Professional labor cost is much higher than $3–$5 per line of code. The U.S. Bureau of Labor Statistics reports May 2024 median annual pay of $133,080 for software developers and $102,610 for software quality-assurance analysts and testers. A true clean-room rebuild would also require product design, curriculum expertise, art direction, DevOps, data engineering, mobile release work, management, and rework.

Why, then, retain only $0.35M–$0.60M?

- LOC is inconsistent and can include low-value, generated, duplicated, or obsolete code.
- A buyer pays for useful, transferable functionality—not founder hours already spent.
- The repository carries integration debt, incomplete testing, and unproven production behavior.
- The art corpus may include duplication and requires an IP/license inventory.
- Rebuilding only the economically useful core would be cheaper than reproducing every file.

The cost lens is therefore a **floor for useful technical work**, not a claim that all historical effort should be capitalized.

### 8.2 Berkus

The Berkus method fits Arganta’s stage because it explicitly values risk-reduction achievements before reliable revenue forecasts exist.

| Berkus factor | Internal amount | Audit view |
|---|---:|---|
| Sound idea / basic value | $0.40M | Strong integrated thesis, but breadth may obscure a single wedge |
| Prototype / technology | ~$0.39M | Significant real implementation; reduced for repo debt, test gaps, and lack of independently verified production usage |
| Quality team | $0.20M | Exceptional founder velocity; discounted for solo-founder/key-person dependency and missing commercial/education specialists |
| Strategic relationships | $0.10M | Some option value, but no audited distribution, school, employer, or channel agreement was found |
| Product rollout / sales | $0.015M | Correctly minimal while external use and payment remain unverified |
| **Total** | **$0.805M–$1.105M** | Strongest stage-appropriate external framework after replacement cost |

### 8.3 Risk-Factor Summation

The internal model starts from a $4.0M–$5.25M manual regional baseline and adds one $0.25M step for technical execution. A proper audit would score at least these risks explicitly:

| Risk | Direction today | Reason |
|---|---:|---|
| Management execution | Positive | High founder build velocity and strategic clarity |
| Stage / traction | Strong negative | No verified external cohort or revenue |
| Legislative / political | Neutral | Qatar can be supportive; specific child/privacy obligations still matter |
| Manufacturing / delivery | Mild negative | Software delivery exists, but multi-app operational complexity is high |
| Sales and marketing | Strong negative | No validated acquisition channel or conversion evidence |
| Funding / capital | Negative | Broad product surface can consume capital before wedge proof |
| Competition | Negative | Each category contains mature focused competitors |
| Technology | Positive to neutral | Deep platform; offset by debt, fragmentation, and incomplete test/CI coverage |
| Litigation / trust | Negative | Child, family, UGC, privacy, and payment surface requires formal controls |
| International | Neutral to negative | Global upside, but localization, content, privacy, and app-store demands grow |
| Reputation | Negative asymmetry | Early trust failure could be severe for a family brand |
| Exit | Negative | No acquisition thesis or strategic comparable evidence yet |

The audit therefore gives this method low weight until a sourced Qatar/GCC pre-seed baseline and a fully documented risk schedule are installed.

### 8.4 Scorecard

A qualitative application of the ACA framework produces the following direction:

| ACA category | Weight | Arganta directional score | Rationale |
|---|---:|---|---|
| Management team | 30% | Above average in product/engineering; below average in team breadth | Strong output, key-person concentration |
| Opportunity size | 25% | Above average potential; high execution complexity | Learning, family coordination, and game engagement are large, but integration must create measurable advantage |
| Product / technology | 15% | Well above average for pre-traction stage | Multiple functional surfaces and shared substrate |
| Competitive environment | 10% | Below average risk profile | Competes indirectly with focused, well-funded leaders across several categories |
| Marketing / sales / partnerships | 10% | Materially below average | No verified distribution engine |
| Need for additional investment | 5% | Below average | Trust, content, operations, distribution, and multi-app maintenance require capital/time |
| Other | 5% | Mixed | Strong narrative and founder knowledge system; documentation contradictions reduce diligence confidence |

The current code does not calculate this schedule; it simply returns a regional band. The valuation engine should be changed to persist each factor, benchmark mean, score, evidence link, source date, and reviewer.

### 8.5 Venture Capital and First Chicago

The VC method and First Chicago method express **future option value**. They do not establish today’s market value.

The internal scenario assumes a 7× revenue exit multiple. For context, SaaS Capital’s private B2B SaaS estimates are approximately 4.8× for bootstrapped and 5.3× for equity-backed companies. Arganta is not pure B2B SaaS, and consumer/education multiples depend heavily on growth, retention, gross margin, payer conversion, platform fees, and acquisition economics. A 7× multiple may be attainable for a high-quality, fast-growing asset, but should not be the base before evidence.

The scenario model should add:

- explicit failure probability,
- time to exit and discount period,
- follow-on financing schedule,
- dilution by round,
- gross margin and app-store fees,
- CAC and payback,
- learning/content and safety operating costs,
- founder/key-person risk,
- and comparable exit or public-market reference dates.

## 9. Financial-model audit

The current mid-case model is explicitly simulated. Its defaults include:

- 4% payer conversion,
- $6.99 monthly price,
- $0.08 infrastructure cost per active user,
- $1.50 acquisition cost per net-new active,
- 5% churn,
- $10K capacity/infrastructure parameter,
- 19% child D30 retention,
- 34% parent D30 retention,
- and fixed monthly cost of only **$63**.

The model outputs roughly:

- $6.48 realized ARPU per payer after modeled deductions,
- $0.1362 contribution per active,
- 462 steady-state actives to cover fixed cost,
- first positive month around month 18,
- 24-month cumulative net of approximately negative $6.7K,
- NPV of approximately negative $6.2K,
- and an end state of about 9,506 actives and 380 payers.

These are **not investable forecasts** because the cost base omits major economic realities:

- founder or employee payroll,
- product design and curriculum validation,
- customer support and community operations,
- privacy, legal, safeguarding, and insurance,
- moderation and UGC review,
- content production and localization,
- marketing labor, creative, and channel management,
- refunds, taxes, chargebacks, and some platform economics,
- analytics, security, observability, and incident response,
- enterprise/education sales if that channel is pursued.

There is also a scenario inconsistency: one static consultation calculates $75 CAC per payer at 2% conversion, while the model default uses 4% conversion and $1.50 CAC per active. At those values, CAC per payer is $37.50, not $75. The $75 figure is valid only for the 2% scenario. All outputs should be generated from one versioned assumption set.

### Required financial-model rebuild

Use three separate views:

1. **Cash survival:** actual monthly company cash needs, including founder support and compliance.
2. **Unit economics:** activated family → retained family → payer conversion → contribution margin → CAC payback.
3. **Venture scenario:** cohort growth, staffing plan, financing, dilution, and probability-weighted exits.

Every assumption should include `value`, `unit`, `source`, `as_of`, `owner`, `scenario`, and `confidence`.

## 10. Company scorecard

| Dimension | Score / 10 | Audit rationale |
|---|---:|---|
| Vision and strategic coherence | **9** | Distinctive full-stack family-learning thesis and well-articulated loop |
| Founder product/engineering execution | **9** | Unusually high repository depth and breadth for the stage |
| Product depth | **8** | Multiple substantive product systems, especially ArgantaLabs |
| Architecture | **7** | Strong shared substrate, offset by fragmentation, workspace drift, and asset duplication |
| Data model | **7** | Rich schema and RPC orientation; current business facts remain largely unobserved |
| Instrumentation readiness | **7** | Real event/RPC foundations, but CEO/MCP truth path is not yet reliably live |
| Agentic-operating reality | **4** | Real platform work, but actions, missions, schedules, persistent memory, and ROI are incomplete |
| Testing and CI | **4** | Positive recent app-level verification; insufficient repo-wide control |
| Security, privacy, and trust readiness | **4** | High-risk domain with insufficient audited controls |
| Distribution | **1** | No verified external acquisition or repeatable channel |
| Traction and retention | **1** | Latest verified snapshot records zero external users |
| Revenue | **0** | No verified real-money revenue or payer cohort |
| Fundraising readiness | **4** | Strong demo/story and technical diligence; weak market, cohort, finance, and governance proof |

These numbers are diagnostic, not meant to be averaged. At this stage, **distribution, retention, and trust are gating variables**: high technical scores cannot mathematically compensate for zero market evidence.

## 11. Key contradictions and diligence exceptions

| Topic | Conflicting evidence | Audit resolution |
|---|---|---|
| Wedge | Kinetik named in [[Investor Narrative]]; unresolved in [[Founder Decisions]]; ArgantaLabs is deepest in repo | Ratify ArgantaLabs as wedge and update all strategy notes |
| LOC | 96K in Master KB vs 122K in valuation engine | Report 96K–122K unresolved; implement reproducible counter |
| Shared packages | Older KB says four; current tree contains seven | Current repo wins; regenerate KB |
| Testing | Older KB says six tests; current repo shows more files and a recent 140-test app claim | Report partial improvement, not repo-wide maturity |
| CI | Older KB says no CI; current workflow exists | Report **partial CI**, not no CI and not full CI |
| “Live” graph coverage | CEO brief says 78% grounded; MCP uses seed graph | Treat as graph grounding; rename data provenance `live-backed` |
| Valuation history | Snapshot/ledger concept exists; MCP returns current deterministic point | Do not claim a verified historical series until persisted rows are inspected |
| Payment | Diamonds/economy exist; `stage.pay` is simulated | Separate learning economy from real-money payment proof |
| Agent workforce | 27 agents and offices exist; actions and persistent missions incomplete | Value as internal platform option, not equivalent headcount |

The knowledge-base method says contradictions should not remain silent. These exceptions should become a tracked audit queue with an owner and closure date.

## 12. Valuation-unlock ladder

| Evidence milestone | Minimum proof package | Indicative valuation / financing interpretation |
|---|---|---:|
| **Today** | Deep repo, integrated demo, dated 0-user snapshot, no verified payment | **$1.8M–$2.8M** fair-value range; **$2.5M** SAFE opening cap |
| **20–50 weekly external families** | Defined activation, D7 >20% on activated families, event integrity, interview evidence | **$2.5M–$4.0M** financing-cap range may become defensible |
| **100–300 external families** | Repeated cohorts, D30 trend, parent/child loop, initial paid conversion, educator validation | **$4M–$6M** may become defensible |
| **1,000 WAU and 100 paying families** | Sustained growth, retention, reliable payment, support/trust operations, early CAC | **$6M–$10M** financing cap may become defensible |
| **$1.1M–$2.5M ARR with retention** | Cohort stability, gross margin, CAC payback, compliance, repeatable channel | Approximately **$6M–$12M** revenue-supported valuation at a 4.8×–5.3× proxy, adjusted for growth and company quality |

> [!note] Financing versus fair value
> A SAFE cap can exceed an audit point estimate because it prices access to future upside, round competition, strategic fit, and investor rights. It should not be described as proof that the company is already worth the cap in a cash transaction.

## 13. Ninety-day evidence plan

### Days 0–14 — Establish one truth system

1. Ratify **ArgantaLabs** as the wedge in [[Founder Decisions]] and reconcile all strategy documents.
2. Freeze net-new product surfaces except for activation, retention, trust, and payment-critical work.
3. Add reproducible repo metrics with explicit inclusion/exclusion rules; remove LOC from valuation until reconciled.
4. Wire the missing CEO events: `arganta.home.feature_view`, paywall bounce, and UGC flagged.
5. Change `live` to `live-backed`; include source, timestamp, scope, definition, and fallback state in every CEO packet.
6. Make MCP call the same live Supabase-backed packet layer as HQ, with seed data available only under an explicit demo mode.
7. Create a sourced `BenchmarkRef` registry: metric, definition, cohort, geography, source URL, publication date, retrieval date, confidence, and owner.

### Days 15–45 — Prove stranger value

1. Recruit the first 10 external families, none of whom depend on founder explanation to complete the core loop.
2. Define activation before observing results—for example: child completes a learning activity, receives the expected world reward, and a parent sees or responds to it.
3. Run an educator review of curriculum, progression, feedback, and child-safety assumptions.
4. Record usability failure, time-to-value, and the exact drop-off step.
5. Test notification and return loops conservatively; do not optimize vanity session counts.
6. Complete privacy/consent, data-retention, access-control, UGC moderation, and incident-response gates before expansion.

### Days 46–90 — Prove retention and willingness to pay

1. Expand toward 20–50 weekly external families.
2. Measure D1, D7, and D30 by cohort and activation state; preserve recruited versus paid-acquisition labels.
3. Test one real-money offer. Keep Diamonds explicitly separate from cash revenue.
4. Capture first paying families, refund behavior, and qualitative willingness-to-pay evidence.
5. Rebuild the model with actual cloud bills, store fees, support load, compliance, content, and founder/team cost.
6. Implement repo-wide CI and align dependencies on the active wedge path.
7. Produce one investor chart covering weekly activated families, retained families, completed learning events, cross-surface hooks, and paying families.

### Ninety-day board questions

- Did a stranger complete the loop without founder intervention?
- Did the child return because learning and world progression reinforce each other?
- Did the parent receive enough value to remain involved?
- Did anyone pay real money, and why?
- Are child/family trust controls strong enough to invite the next 100 families?
- Does HQ report live facts with a visible timestamp and provenance?
- Which product or feature was stopped because evidence did not support it?

## 14. Recommended investor framing

### Defensible version

> Arganta is building a shared family learning platform. Children’s learning powers a persistent world, parents extend that value into family coordination, and an internal agentic HQ governs the system. The company has built an unusually deep integrated prototype and data substrate, but it is still pre-PMF: today’s value is technical IP, founder velocity, and platform option value—not current revenue. A repository- and benchmark-based audit supports an indicative pre-money range of $1.8M–$2.8M, with a $2.2M planning point and a $2.5M SAFE negotiation cap. The next valuation step is earned by external family activation, D7/D30 retention, educator validation, and real payment.

### Claims to avoid

- “We have 78% live data.” Use: “78% of seed graph nodes are grounded; approximately 46% are marked live-backed, and production freshness is being hardened.”
- “We have 27 autonomous agents.” Use: “We have a 27-role agent operating model and a functioning decision-support platform; persistent governed missions and actions are the next build.”
- “The repository proves a $5M valuation.” Use: “The repository establishes a replacement-cost floor and option value; traction will determine the next material re-rating.”
- “Our financial model reaches profitability on $63 per month.” Use: “The current model is a product/infrastructure simulation and is being rebuilt into a full company cash and unit-economics model.”
- “Diamonds prove monetization.” Use: “Diamonds are an internal learning economy; real-money payment is tracked separately.”

## 15. Valuation engine remediation

The current deterministic engine is a strong starting artifact. To make it diligence-grade:

1. **Separate calculation from evidence.** Each input should link to an `EvidenceRef` with source, date, scope, owner, and confidence.
2. **Version every benchmark.** Regional baselines and exit multiples must have publication or transaction dates.
3. **Implement Scorecard mathematically.** Store peer mean and Arganta factor ratios rather than returning a preset band.
4. **Implement full risk-factor debits.** Do not add only the technology uplift.
5. **Repair the payer-uplift calculation.** The current lever changes post-live synthesis weights without clearly recomputing all pay-dependent method values, including Berkus rollout.
6. **Keep fair value and financing cap separate.** Return both, with different labels and rationales.
7. **Add sensitivity tables.** Show the impact of D7/D30, pay conversion, CAC, gross margin, time, dilution, and failure probability.
8. **Persist snapshots.** A valuation history should be backed by inspected rows, input versions, commit hash, and provenance—not only a current deterministic point.
9. **Add reviewer overrides.** Permit documented human judgment without silently editing constants.
10. **Generate an exception report.** Missing or stale sources should reduce confidence automatically.

## 16. Audit opinion

ArgantaLab has built more technology, creative material, internal operating structure, and strategic documentation than many companies at its verified commercial stage. That creates real asset value and can justify a financing discussion above a bare idea-stage startup.

The same breadth also creates the central diligence concern: **the system may be optimizing the completeness of the company model before proving the smallest external value loop**. The next 90 days should therefore convert technical depth into four pieces of evidence:

1. a stranger activates,
2. the family returns,
3. an educator validates the learning experience,
4. a family pays real money.

Until then, the valuation should stay anchored to the lower, stage-appropriate methods. The audit conclusion is:

> **Indicative pre-money: $1.8M–$2.8M. Audit point: $2.2M. Recommended SAFE opening cap: $2.5M.**

The earlier broad view of $1.5M–$3.5M with a $2.5M central number should be revised: after direct inspection of the valuation code, company evidence, and method quality, **$2.5M is better treated as a fundraising anchor, not the scientific point estimate**. The internal deterministic engine itself produces approximately $1.81M–$2.38M under current seed inputs.

## 17. Reference register

### Valuation standards and methods

1. **International Private Equity and Venture Capital Valuation Guidelines, 2025 edition.** Best-practice framework for fair-value judgment, calibration, multiple techniques, market evidence, and consistency. [IPEV Valuation Guidelines](https://www.privateequityvaluation.com/Valuation-Guidelines)
2. **International Valuation Standards Council, IVS 210 — Intangible Assets.** Cost, market, and income approaches for identifiable intangible assets. [IVS 210 PDF](https://www.ivsc.org/wp-content/uploads/2021/10/IVS210IntangibleAssets.pdf)
3. **Dave Berkus, The Berkus Method.** Five-factor pre-revenue valuation framework with up to $500K assigned per risk-reduction factor in its canonical formulation. [Berkus Method](https://berkus.com/the-berkus-method-valuing-an-early-stage-investment-2/)
4. **Angel Capital Association, Scorecard Valuation Methodology.** Pre-revenue benchmark-relative approach and standard factor weights. [ACA Scorecard Methodology](https://angelcapitalassociation.org/blog/blog-scorecard-valuation-methodology-rev-2019-establishing-the-valuation-of-pre-revenue-start-up-companies/)
5. **Gust, Valuations 101 — Risk Factor Summation Method.** Overview of adjusting a regional baseline for company-specific risks. [Gust RFS Method](https://gust.com/blog/valuations-101-the-risk-factor-summation-method/)
6. **Aswath Damodaran, Valuing Young, Start-up and Growth Companies.** Treatment of uncertainty, survival, scaling, dilution, and scenario-based valuation. [Damodaran paper](https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/younggrowth.pdf)
7. **U.S. Bureau of Labor Statistics, Software Developers, QA Analysts, and Testers.** May 2024 wage reference used only to contextualize professional replacement labor. [BLS Occupational Outlook](https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm)

### Financing and market context

8. **Carta, State of Pre-Seed: 2025.** U.S. SAFE-cap and round-size context; not treated as direct fair-value evidence. [Carta 2025 Pre-Seed](https://carta.com/data/state-of-pre-seed-2025/)
9. **Carta, State of Pre-Seed: Q1 2026.** SAFE prevalence, concentration, and AI-premium context. [Carta Q1 2026 Pre-Seed](https://carta.com/data/state-of-pre-seed-q1-2026/)
10. **MAGNiTT, 2025 Qatar Venture Capital Report.** Qatar venture funding activity and ecosystem context. [MAGNiTT Qatar VC Report](https://magnitt.com/research/2025-Qatar-Venture-Capital-Report-51024)
11. **SaaS Capital, Private B2B SaaS Benchmarks.** Private-company revenue multiple context; used only as a future cross-check because Arganta is not pure B2B SaaS. [SaaS Capital benchmarks](https://www.saas-capital.com/blog-posts/spending-benchmarks-for-private-b2b-saas-companies/)

### Retention benchmarks

12. **Adjust, User Retention Guide.** Broad mobile D1/D7/D14/D30 reference points and retention definitions. [Adjust retention guide](https://www.adjust.com/resources/guides/user-retention/)
13. **AppsFlyer, Retention Rate.** Retention definitions and education-app benchmark examples. [AppsFlyer retention glossary](https://www.appsflyer.com/glossary/retention-rate/)
14. **Adjust, Educational App Trends, Insights and Strategies.** Education-app engagement and retention context. [Adjust education-app trends](https://www.adjust.com/blog/educational-app-trends-insights-strategies/)

### Product and category analogs

15. **Duolingo FY2025 shareholder materials and Form 10-K.** Scale, bookings, profitability, DAU, and payer-ratio context. [Duolingo FY2025 shareholder letter](https://investors.duolingo.com/static-files/961ce633-3cee-49d0-bd7a-2c63731d45fb) · [Duolingo Form 10-K](https://investors.duolingo.com/static-files/f19d76fb-dee4-4f13-96ae-138ebfd0f2d3)
16. **Prodigy official company article.** Registered-user scale and category validation for game-based learning. [Prodigy scale reference](https://www.prodigygame.com/main-en/blog/making-a-prodigious-leap-by-daring-to-dream-big)
17. **Kahoot! official site.** Annual participation-scale statement. [Kahoot](https://kahoot.com/)
18. **Cozi official press and media kit.** Registered-user scale for family organization. [Cozi press kit](https://www.cozi.com/press-media-kit/)
19. **FamilyWall official product and premium pages.** Family-organizer category and subscription packaging. [FamilyWall](https://www.familywall.com/index.html) · [FamilyWall Premium](https://www.familywall.com/premium.html)

## Appendix A — Reproducible evidence checklist

- [ ] Reconcile 96K vs 122K LOC with a committed counting script.
- [ ] Generate current package, app, table, RPC, test, and asset counts in CI.
- [ ] Inventory art provenance, ownership, and licenses.
- [ ] Remove generated distributions and duplicate art from source control.
- [ ] Put all active applications under a deliberate build/test policy.
- [ ] Link every HQ benchmark constant to a dated source.
- [ ] Mark seed, mock, placeholder, and live-backed states explicitly in UI and MCP output.
- [ ] Inspect and document production data availability without exposing personal data.
- [ ] Verify first external-family cohort and publish metric definitions.
- [ ] Record real payment separately from Diamonds or other internal economies.
- [ ] Add child/family privacy, consent, moderation, and incident controls.
- [ ] Persist valuation inputs, output, reviewer, timestamp, and commit hash.

## Appendix B — Currency translation

Using the long-standing Qatari riyal peg of approximately QAR 3.64 per USD for planning translation:

| USD | Approximate QAR |
|---:|---:|
| $1.8M | QAR 6.55M |
| $2.2M | QAR 8.01M |
| $2.5M | QAR 9.10M |
| $2.8M | QAR 10.19M |
| $3.0M | QAR 10.92M |

Currency translation does not add valuation precision; the USD valuation itself remains a range.

---

*Prepared from repository, internal knowledge-base, deterministic model, and external benchmark evidence available on 2026-07-13. Update after any verified external cohort, real-money payment, financing event, material code change, or benchmark refresh.*
