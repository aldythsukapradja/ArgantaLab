# Journey photos

The Journey tab renders one slide per experience entry. Photos are **optional** —
a chapter with no photo shows a designed "ghost" card (logo/monogram + the era's
caption), so the deck is cinematic before any asset exists.

## Where files go

- `arganta/era-1/` … `era-5/` — the twin's five narrative eras:
  1. The Student Expedition Leader — outcrops, compass, notebook, student team
  2. The Papua Field Geologist — forest, flying camp, rain, camp table of maps
  3. The Earth Scientist — seismic, models, wells, technical rooms
  4. The Digital Transformation Leader — dashboards, agents, decisions
  5. The World Builder — apartment studio, Circle HQ, night building
- `aldhyt/` — the real profile's chapters.

## How to attach them

Photos are referenced from the profile data, not auto-discovered — the record is
the source of truth, so a file appearing on disk must not silently rewrite the
story. Add paths to the entry's `media.photos` in
`apps/hq/src/surfaces/biography/biography.ts`, e.g.

```ts
media: { photos: ['/biography/journey/arganta/era-2/camp.jpg'], caption: 'Flying camp, Papua' }
```

1–3 photos per chapter. They render as prints on a desk (parallax, slight
rotation), so 4:3 landscape reads best.

## Guardrails (Character Bible)

Never publish anything that reveals the real residence, identifiable views, the
children's faces, or employer-confidential screens/data/workflows. Conflict is
context, never decoration.
