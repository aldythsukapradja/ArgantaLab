# Competitor Watchlist Workflow
Goal: detect emerging-tech adoption with close-to-announcement dates.

## Sources (concrete)
**Release notes / product**
- Azure Data Manager for Energy release notes: https://learn.microsoft.com/en-us/azure/energy-data-services/release-notes
- AWS What's New (energy): https://aws.amazon.com/about-aws/whats-new/
- SLB newsroom: https://www.slb.com/news-and-insights/newsroom
- Cognite newsroom + Atlas AI release blogs: https://www.cognite.com/en/company/newsroom
- Halliburton Landmark: https://www.halliburton.com/en/software/decisionspace-365-enterprise
- Ikon Curate blog: https://curate.ikonscience.com/blog/all
- Geoteric: https://blog.geoteric.com/latest/all · Bluware: https://bluware.com/news-pr/
- C3 AI IR (quarterly O&G bookings): https://ir.c3.ai/
- AVEVA press: https://www.aveva.com/en/about/news/press-releases/

**Ecosystem**
- OSDU GitLab (milestone branches = adoption dates): https://community.opengroup.org/osdu
- OSDU Forum member announcements.

**Trade press / funding**
- JPT (jpt.spe.org), World Oil digital, Oilfield Technology, Energy Capital HTX.
- Crunchbase alerts: Collide, Terra AI, PetroAI, Belmont, Earth Science Analytics.
- LinkedIn pages (SLB Digital, Cognite, AIQ, Collide, Geoteric) — hiring posts reveal roadmap ("agent evaluation engineer", "OSDU", "evals", "RAG").

**Conferences (live-monitoring weeks)**
- ADIPEC (Nov, Abu Dhabi — SLB launch venue 2 years running), SPE ATCE, EAGE Annual (June), NAPE (Feb, Houston), Cognite Impact (fall), AVEVA World, AI in Oil & Gas Houston, SPE Data Science & Digital.

## Cadence
- **Weekly**: automated sweep (release-note URLs, Crunchbase/LinkedIn alerts) → append `watchlist/watchlist.csv` rows: `date, vendor, signal, category, source_url, threat_1to5`.
- **Monthly**: synthesis memo (what moved; threat delta to the wedge).
- **Quarterly**: deep dive aligned to C3 earnings + OSDU milestones.
- **Event weeks**: daily notes during ADIPEC / EAGE / NAPE.

## Signals to extract (each dated)
- Agent/copilot GA announcements; domain-foundation-model claims (training data, benchmarks).
- OSDU milestone adoption lag per vendor.
- **Sovereign/on-prem deployment announcements (direct wedge threat).**
- NOC partnership consortiums; pricing shifts toward consumption.
- Funding rounds in Houston/Norway subsurface AI; hiring spikes ("agentic", "evals", "RAG", "OSDU").

## Implementation
Phase 1: weekly scheduled Claude sweep writing `watchlist/<yyyy-ww>.md` + the running CSV. Phase 2: ArgantaEnergy "Radar" tab reads the CSV.
