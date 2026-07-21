# Competitive Landscape — AI/Data Platforms in Upstream O&G
Research date: 2026-07-21.

## Players

### SLB — Lumi + Delfi/Petrel + Tela (incumbent gravity well)
- **Lumi** (Sept 2024): enterprise data+AI platform spanning subsurface→operations, feeding Delfi (Petrel, reservoir, seismic, geosteering).
- **Tela** (ADIPEC, Nov 3 2025): agentic assistant with observe–plan–generate–act–learn loop embedded across SLB apps (well-log interpretation, drilling issue prediction, equipment optimization).
- LLM strategy: frontier LLMs + SLB domain foundation models (DFMs); NVIDIA partnership for energy genAI.
- Marquee: SLB + AIQ deploying agentic AI across ADNOC's subsurface value chain.
- North star: "AI for energy at enterprise scale" — top-down NOC/major sales, hyperscaler-hosted, OSDU founding member. Pricing: enterprise/private.
- https://www.slb.com/products-and-services/delivering-digital-at-scale/software/tela

### Cognite — Data Fusion + Atlas AI (industrial DataOps leader)
- CDF = OT/IT/engineering contextualization into a knowledge graph; **Atlas AI** = low-code agent workbench (Sept 2025: agents inside data pipelines GA, Databricks integration; "digital teammates" vision at Impact 2025).
- Flagship: **Aker BP "AI-first"** expansion on Atlas AI (Sept 2025) — document automation, proactive barrier management; also ADNOC Offshore, Hess, Idemitsu.
- Weakness: strong ops/OT, comparatively shallow deep-subsurface (seismic/logs/geomodels).
- https://www.cognite.com/en/product/atlas

### "EnergyAI" — disambiguation (important)
- **energyai.com is NOT upstream** — Berkeley CA electricity-bill-monitoring SMB (founded 2009, $5/meter/mo).
- The upstream **ENERGYai** = **AIQ** (Abu Dhabi; ADNOC + G42 + Microsoft + SLB) — agentic AI over 70 years of ADNOC data; autonomous seismic agents.
- Closest Houston-startup analog: **Collide** — "first GenAI platform for energy", curated knowledge + Q&A, $5M seed Apr 2025 (Mercury Fund).

### Halliburton Landmark — iEnergy + DecisionSpace 365 + DS365.ai
- Only major marketing **hybrid/on-prem** (iEnergy Stack) — sovereignty-adjacent incumbent, but weak public agentic story vs Tela/Atlas. DS365.ai = domain AI/ML on OSDU; Seismic Engine supports Bluware OpenVDS.

### AVEVA / OSIsoft PI — the OT-historian estate
- PI System + CONNECT; AVEVA World 2026: AI embedded across CONNECT/PI, PI Server scaled for AI workloads. Not subsurface — the ops data plane a digital brain federates with.

### C3 AI / Baker Hughes
- JV renewed through June 2028; Shell, Eni, QatarEnergy LNG, Petronas, ExxonMobil. C3 "Agentic AI Platform"; Baker Hughes **Leucipa** + AWS intelligent agents (Nov 2025): physics-guided failure prediction, digital twins, conversational LLM. Production ops, not interpretation.

### Bluware — seismic AI + OpenVDS standard
- InteractivAI human-in-the-loop DL seismic interpretation (Azure OSDU build for a supermajor, June 2025); OpenVDS is the OSDU seismic standard — a wedge into every OSDU deployment.

### Ikon Science — Curate
- Subsurface knowledge management on AWS OSDU (RokDoc heritage); 2025.1 deepened OSDU integration/filtering.

### Hyperscaler OSDU platforms
- **Azure Data Manager for Energy**: managed OSDU at M26; Reservoir DMS GA (versioned reservoir models with lineage); **no native copilot** — intelligence left to partners.
- **AWS Energy Data Insights**: managed OSDU; EDI IQ (LLM-assisted ingestion mapping); May 2025 AMS managed support; **pay-as-you-go pricing**; S&P well-data partnership.
- OSDU **EDS** pulls external provider metadata + on-demand bulk LAS/SEG-Y (e.g. Katalyst iGlass).

### Emerging (2024–2026)
| Company | Angle |
|---|---|
| Geoteric | AI fault/horizon detection; Stratum cloud |
| Earth Science Analytics | EarthNET / EarthAI (Norway) |
| PetroAI | Unconventionals; TGS partnership — on-demand AI Earth Models |
| Collide | GenAI energy knowledge platform, $5M seed 2025 |
| Terra AI | Geoscience frontier AI |
| subsurfaceAI | ML seismic suite (Canada) |
| Quantico | Synthetic logs, drilling ML |
| Belmont Technology | BP-backed geoscience knowledge graph ("Sandy") |
| AspenTech SSE | Industrial-AI subsurface |

## Gap analysis — the ArgantaEnergy wedge
1. **Sovereignty gap**: every serious agentic offer is hyperscaler-resident; ADNOC's sovereign build required a G42+Microsoft+SLB consortium. A self-hostable/air-gappable brain (OSDU-compatible, LLM-pluggable) targets NOCs/mid-caps under data-residency law (Indonesia, Malaysia, ME, Africa).
2. **Evidence-grounding gap**: Tela/Atlas are thin on verifiable provenance. "Every answer carries its evidence record + lineage" is the differentiator; reserves/integrity decisions need audit chains.
3. **Demonstrability gap**: incumbent demos hide behind NDAs. A public, reproducible **Volve** pipeline (raw → canonical → grounded copilot → agent workflows) is credibility collateral nobody markets openly.
4. **Training-platform gap**: nobody bundles workforce upskilling. Crew-change is acute; Collide's traction proves appetite. "Digital worker + train humans on the same platform" = whitespace + bottom-up GTM.
5. **Mid-market gap**: SLB/Cognite/C3 economics fit majors; transparent seat/consumption pricing for sub-majors is uncontested (AWS EDI pay-as-you-go proves demand).
6. **Integration seams**: build ON OSDU (EDS, OpenVDS), federate PI for ops, stay LLM-agnostic. Compete at the brain + worker layer, not the data platform.

**Threat watch**: Tela down-market; Cognite adding subsurface depth; AIQ commercializing ENERGYai beyond ADNOC; hyperscalers shipping native ADME/EDI copilots.
