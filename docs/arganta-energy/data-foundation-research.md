# Arganta Energy — Data Foundation Research

**Deep-dive: Cognite CDF, Azure Data Manager for Energy, OSDU, and the pipeline architecture Arganta Energy should build.**
*Synthesized 2026-07-21 from a multi-agent research run (search + fetch completed; CDF claims 3-vote verified against live docs; ADME/OSDU claims from primary Microsoft/OSDU sources, single-checked).*

---

## 1. How Cognite Data Fusion actually works (the model to steal from)

CDF's ingestion architecture is a clean, four-stage ELT pattern — all verified against live Cognite docs:

1. **Extract** — *extractors* (one-way) and *connectors* (bi-directional) pull from source systems. Cognite ships ~90+ prebuilt ones: OPC-UA, OSIsoft PI, SAP, ODBC, files — and for subsurface: **WITSML, SLB Petrel Studio, Avocet, Halliburton EDM** extractors. Best practice: lift data out of source systems fast and thin — extractors do no transformation.
2. **Stage (CDF RAW)** — everything lands in a schemaless staging store first. This is deliberate: transforms are re-runnable without touching the source, and extractors stay dumb. Data that's already shaped can bypass RAW into typed storage (time series, assets, files, events).
3. **Transform** — a distinct service (Spark SQL) shapes RAW data into CDF data models. Transformation happens *inside* the platform, after ingestion — never required upstream.
4. **Contextualize** — the commercial crown jewel: entity matching that links time series ↔ assets ↔ documents across source systems, using **ML + a rules engine + human-in-the-loop domain review**. Two modes: unsupervised (no training matches) and supervised (learns feature weights from confirmed matches).

**Verified weakness:** CDF entity matching is **string-similarity based only** — it "will never return entities with no similarities," per Cognite's own docs. Messy vendor data with unrelated identifiers needs pre-transformation or manual rules. That's a real seam for an LLM-assisted matcher.

**Commercial reality:** no public pricing, no free tier, no self-serve — custom enterprise quotes only (Capterra lists zero user reviews; the footprint is a small number of very large deals). Cognite's own DIY-vs-buy blog concedes lock-in is "a common concern" and targets buyers who lack strong IT teams. CDF also ships an **OSDU extractor (Beta)** — i.e., even Cognite treats OSDU as a source to interoperate with, not something CDF replaces: Cognite frames OSDU as "subsurface master data," CDF as the operational contextualization layer on top.

## 2. Microsoft's answer: Azure Data Manager for Energy (ADME)

- ADME is Microsoft's **fully managed OSDU Data Platform** PaaS, built with SLB, tracking OSDU milestone releases (M26 as of June 2026). Microsoft handles OSDU version upgrades.
- **Ingestion is manifest-based and opaque**: it does *not parse file contents* — you hand it a JSON manifest conforming to OSDU well-known schemas and it creates searchable metadata records via pre-configured Airflow DAGs (`Osdu_ingest`), with ordered loading (ReferenceData → MasterData → Datasets → WPC → WorkProduct) and referential-integrity validation. **All domain parsing (LAS/DLIS) happens upstream of the platform.**
- Data quality is punted to partners (RoQC, Katalyst, Petrosys|Interica) — the platform itself does not solve preprocessing. This is exactly the "strong pre-processing" gap you identified.
- **Notable gaps**: Production DDMS and the Energistics parser DAGs (WITSML/RESQML/PRODML) are *not* in base ADME — daily production data, one of your three target data types, needs add-on deployment.
- **Pricing kills it for small operators**: always-on hourly instance fee; even the *Developer* (non-production) tier is ~**$2,898/month** (US East, after a 75% cut from $11,680) — before storage, egress, and apps.
- Two 2026 features worth copying conceptually: **External Data Services** (ingest metadata only, leave LAS/SEG-Y files at the source, fetch on demand) and the **Analytics Consumption Zone** (export OSDU entities as Delta Parquet for Fabric/Databricks).

## 3. Is OSDU really THE standard? (Yes — as the schema layer, not the platform)

**Adoption is real:** OSDU sits under The Open Group with 870+ member organizations; operator members include Shell, Equinor, ExxonMobil, Chevron, BP, TotalEnergies. All three hyperscalers implement it (Azure = ADME, AWS publishes an OSDU implementation series, Google likewise). Equinor is a flagship: hundreds of thousands of QC'd well logs migrated to ADME (they estimate 250 person-years of manual work saved); Aker BP is another named adopter.

**The alternatives are not rivals — they're feeders:**
- **Energistics standards (WITSML/RESQML/PRODML)** are being folded *into* OSDU — Energistics sits inside the OSDU R3 core team; WITSML 2.1 was explicitly harmonized with the OSDU data model. WITSML = real-time drilling *transfer* protocol; OSDU = the data *lake* it feeds. (Fun fact: WITSML 2.0 had practically zero adoption since 2016; 1.4.1.1 still dominates.)
- **PPDM** remains the relational master-data model many operators still run; it coexists with OSDU rather than competing for the "cloud platform" role.

So your instinct is correct: **OSDU is the right standard to align to** — there is no better bet. But note the criticisms, all sourced:
- Deployments discover data-definition flaws *after* ingestion (no early QC/visualization tooling) — practitioners advise "visualize, identify, correct" before loading.
- The extension mechanism pushes complexity onto every downstream app.
- Peer-reviewed evaluation (JIDM 2022) found OSDU insufficient alone — it needs supplementary data enrichment, workflow, and lineage layers.
- Legacy apps may take years to be OSDU-ready or never will → hybrid silos are the norm.

**What "OSDU-aligned" minimally means for a startup** (this is the key insight): you do **not** run the platform. You align to its *data shapes*:
1. Model records as OSDU **kinds** with JSON schemas, using the group-type taxonomy: `ReferenceData` (controlled vocabularies), `MasterData` (Well, Wellbore), `WorkProduct` / `WorkProductComponent` (WellLog, the smallest usable unit), `Dataset` (the file itself).
2. Keep OSDU-style IDs, ACL + legal-tag fields on every record (even if simplified).
3. Be able to *emit a valid OSDU manifest JSON* on demand.

Do those three things and any customer who later adopts ADME/AWS OSDU can ingest your output natively — "OSDU-compatible export" becomes a checkbox feature, not a re-architecture.

## 4. The market gap Arganta Energy fits

- Rystad: ~70% of O&G digital initiatives never leave pilot; substantial upfront cost is the #1 hurdle for smaller players, who "lack the capital resources for comprehensive technology overhauls" (Grand View notes modular/SaaS delivery emerging precisely to fix this).
- CDF: enterprise-only, opaque pricing, lock-in concerns. ADME: $2.9k/mo *floor* for a dev sandbox, sold through SIs (Accenture, Wipro, EPAM), doesn't parse your files, and lacks production data services out of the box.
- SLB's digital division at ~35% EBITDA margin (2025) proves O&G data platforms monetize.

**Nobody serves the small/mid operator who wants to drop a folder of LAS/DLIS/Excel/PDF onto a tool and get clean, standards-aligned, queryable data.** Both incumbents assume that preprocessing is someone else's job. Make it *the* job.

## 5. Recommended architecture (the Arganta Energy pipeline)

Steal CDF's stage names, OSDU's schemas, ADME's by-reference trick — at Supabase scale:

```
 SOURCES                LAND (RAW)              REFINE                   SERVE
 LAS / DLIS  ──►  raw files in cheap        parse + QC + unit        OSDU-aligned records
 production xlsx    object storage (R2)       normalization            in Postgres (Supabase)
 PDFs / reports     + raw_records JSONB     (lasio / dlisio / welly    - master_data (wells)
 (later: WITSML)      staging table           pandas / docling)        - work_products (logs,
                    files stay AT SOURCE    contextualize:               prod series, docs)
                    when possible            match logs↔wells↔prod     - manifest export (JSON)
                    (EDS pattern)            rules + LLM assist        + pgvector for PDF chunks
```

Concrete rules:
1. **Extract–Stage–Transform–Contextualize as four explicit, separately re-runnable stages** (CDF's proven shape). Thin extractors; all smarts in the refine stage.
2. **Bytes never live in Postgres.** Raw files → R2/Storage (or left at the customer source, ADME EDS-style, with metadata-only ingestion). Postgres holds parsed rows, OSDU-shaped metadata records, and embeddings — your 100 GB stays safe even multi-tenant.
3. **Preprocessing is the product**: `lasio` (LAS→DataFrame), `dlisio` (Equinor's own DLIS/LIS79 reader — handles the multi-logical-file/frame/channel hierarchy), `welly` (multi-well QC), pandas for production sheets, missing-data profiling (well logs are notoriously gappy), curve-mnemonic normalization against a ReferenceData vocabulary, unit conversion. Ship a QC report per ingested file — this is exactly the "visualize before ingest" lesson OSDU deployments learned the hard way.
4. **Contextualization with an LLM assist + rules + human confirm** — leapfrogs CDF's string-similarity-only limitation and every confirmed match becomes training data (their supervised-mode idea, minus their price tag).
5. **OSDU-aligned, not OSDU-hosted**: internal tables mirror kinds/group-types; one export function emits valid manifests. Positioning line: *"OSDU-aligned from day one, without the OSDU platform tax."*
6. **Volve is the perfect test corpus** — real Equinor LAS/DLIS messiness, production Excel, and report PDFs; there's an existing literature of welly/dlisio-on-Volve walkthroughs to benchmark against.

**Positioning vs the incumbents:** Arganta Energy is *the ingestion + preprocessing refinery* — the layer both CDF (which sells contextualization to enterprises) and ADME (which explicitly doesn't parse files) leave to partners and consultants. Downstream you're compatible with all of them: export OSDU manifests, Delta/Parquet, or plain Postgres.

---

## Sources (key)

- Cognite docs: [data pipelines](https://docs.cognite.com/cdf/integration/concepts/about_data_pipelines), [entity matching](https://docs.cognite.com/cdf/integration/guides/contextualization/matching), [extractor catalog](https://www.cognite.com/en/product/extractors), [DIY vs CDF](https://www.cognite.com/en/resources/blog/choosing-between-diy-and-cognite-data-fusion), [CDF + OSDU positioning](https://www.cognite.com/en/extend-your-osdu-data-platform-into-valuable-data-products)
- Microsoft: [ADME overview](https://learn.microsoft.com/en-us/azure/energy-data-services/overview-microsoft-energy-data-services), [manifest ingestion](https://learn.microsoft.com/en-us/azure/energy-data-services/concepts-manifest-ingestion), [OSDU services on ADME](https://learn.microsoft.com/en-us/azure/energy-data-services/osdu-services-on-adme), [pricing](https://azure.microsoft.com/en-us/pricing/details/energy-data-services/), [release notes (M26, EDS GA, ACZ)](https://learn.microsoft.com/en-us/azure/energy-data-services/release-notes), [Equinor case study](https://www.microsoft.com/en/customers/story/25408-equinor-microsoft-azure-data-manager-for-energy)
- OSDU/standards: [OSDU operator members](https://osduforum.org/about-us/communities/operators/), [Energistics ↔ OSDU collaboration](https://energistics.org/energistics-collaboration-osdutm-forum-0), [WITSML vs OSDU myth-busting (Kongsberg)](https://kongsbergdigital.com/blog/myth-busting-well-data-information-systems-witsml-vs-osdu), [OSDU deployment challenges (INT)](https://www.int.com/blog/navigating-deployment-challenges-osdu-data-platform-strategies-for-maximizing-value/), [AWS OSDU ingestion series](https://aws.amazon.com/blogs/industries/osdu-data-platform-on-aws-ingestion-series-1-overview-of-data-types-for-osdutm-data-platform/), JIDM 2022 digital-twin evaluation of OSDU
- Tooling: [lasio/dlisio/welly overview](https://towardsdatascience.com/6-python-libraries-you-should-know-about-for-well-log-data-petrophysics-3dfde47856b8/), [dlisio on Volve-style DLIS](https://towardsdatascience.com/loading-well-log-data-from-dlis-using-python-9d48df9a23e2/), [welly on Volve](https://discovervolve.com/2020/09/26/navigating-well-log-formats-in-the-volve-oilfield-data-with-the-welly-library/), [OSDU custom schemas guide (Mivaa)](https://deepdatawithmivaa.com/2024/12/05/creating-custom-osdu-schemas-for-data-management/)
- Market: Rystad via [Discovery Alert 2025](https://discoveryalert.com.au/digital-transformation-oil-gas-innovation-trends-2025/), [Grand View digital oilfield report](https://www.grandviewresearch.com/industry-analysis/digital-oilfield-market)
