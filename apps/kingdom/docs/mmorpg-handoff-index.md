# MMORPG Handoff Index

Generated for the NexusTK-inspired MMORPG rebuild concept.

This handoff captures the architecture direction after auditing:

- The cleaned `apps/kingdom` project.
- The NexusTK client data folder.
- The need for Supabase, GitHub, Vercel, Kinetik Circle, and ArgantaLabs synchronization.
- Separate adult and kids progression models.
- GM and user control dashboards.
- ArgantaLabs as the single source of truth for diamonds and kids education EXP.

## Handoff Files

1. [Current State Handoff (2026-07-04)](./HANDOFF-CURRENT-STATE-2026-07-04.md)
2. [System Architecture](./mmorpg-system-architecture.md)
3. [Supabase Data Schema](./mmorpg-supabase-schema.md)
4. [GM Dashboard Design](./mmorpg-gm-dashboard-design.md)
5. [User Control Dashboard Design](./mmorpg-user-control-dashboard-design.md)
6. [Identity, EXP, Diamonds, And Ledgers](./mmorpg-identity-exp-diamond-ledgers.md)
7. [Skill Effects And Quest Manager](./mmorpg-skill-effects-and-quest-manager.md)
8. [Implementation Roadmap](./mmorpg-implementation-roadmap.md)

## Core Principle

```text
GitHub stores code, migrations, seeds, and schema history.
Supabase stores game truth, ledgers, user state, and live configuration.
ArgantaLabs stores diamond truth and kids education EXP truth.
Vercel serves the game client and dashboards.
The client renders.
The server decides.
```

## Must Preserve

- Client animations must come from decoded NexusTK client assets, not scrape GIFs.
- Scrape data is useful for identity, maps, monsters, XP, drops, shops, and skills.
- Client data is useful for real sprites, palettes, motion, effects, tiles, UI, and audio.
- Links join scraped identity to client assets.
- Overrides hold designed/tuned game truth.
- Kids cannot gain progression EXP from monster kills.
- Adult monster rankings must only use monster EXP.
- Diamonds must only come from ArgantaLabs.
