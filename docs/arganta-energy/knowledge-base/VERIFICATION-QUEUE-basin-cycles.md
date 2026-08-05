# Verification queue — recalled basin cycles

250 cycle rows across 66 basins were authored on 2026-08-03 from **analyst recall with no
source consulted**. Every one carries `provenance: literature-recalled`,
`citation_status: recalled`, `source_citation_id: C-RECALL-UNVERIFIED`.

They are **hypotheses that make targeted retrieval cheap** — not evidence. This file ranks
them for the verification pass that turns `recalled` into `cited`.

## The corroboration signal

The recalled `units` were written blind. The workbook *separately* holds USGS-derived
formation names (`PS Elements.unit_name`, `Petroleum System.source_rock_formation` and the
AU narrative notes). Cross-matching distinctive formation tokens against that independent
text is a free first-pass check: where a recalled name also appears in USGS text the author
never saw, the recall is corroborated by a source it did not consult.

**Result: 46 of the 49 checkable basins corroborated — 94%.**

| outcome | basins | meaning |
|---|---|---|
| corroborated | 46 | ≥1 recalled formation independently appears in USGS text |
| text held, **no overlap** | 3 | **highest priority** — recall and authority disagree, or terminology differs |
| no USGS text held | 17 | check impossible here; needs external literature |

This is **not** a citation and does not license flipping `citation_status`. It only says
where to spend verification effort.

## Priority 1 — text held but zero overlap (3)

Resolve these first: the workbook holds USGS text for the province and *none* of the
recalled formation names appear in it.

- **Santos Basin** — recalled Piçarras / Itapema / Barra Velha / Ariri. Suspect the pre-salt
  nomenclature simply post-dates or sits outside the DDS-60 text rather than being wrong;
  confirm against a pre-salt reference.
- **Guyana-Suriname Basin** — recalled Canje Fm as source. Note "Liza" was written as a
  reservoir interval label but is a *field* name, not a formation — fix that regardless.
- **North Sakhalin Basin** — recalled Daehurinsk / Uinsk / Okobykai / Dagi / Nutovo. Russian
  transliteration varies widely; likely a spelling mismatch, but confirm.

## Priority 2 — no USGS text held (17)

No local corpus to check against, so recall is entirely unverified:

Mesopotamian Foredeep · Saline-Comalcalco · Nile Delta · Pearl River Mouth ·
Tampico-Misantla · Thai Basin · Upper Magdalena Valley · Burgos · Arctic Alaska ·
Lower Magdalena Valley · South Oman Salt · East Java · Levant · Sud · Anah Graben ·
Tanzania Coastal · Mozambique Coastal

Two of these are worth extra scepticism because they are USGS *province* names rather than
classic basins, so the cycle stack is a judgement call about what the province contains:
**Anah Graben** and **Sud**.

## Priority 3 — corroborated, confirm and cite (46)

Lowest risk. The job here is to attach a real citation, not to re-derive the geology.
Strongest signals (most recalled names matching independent text):

Bohaiwan 6/6 · Anglo-Dutch 6/9 · Neuquén 5/8 · Rub al Khali 5/9 · Greater Ghawar 5/9 ·
Labrador-Newfoundland 5/9 · Llanos 3/4 · Ghaba Salt 3/4 · Middle Magdalena 4/6 ·
Volga-Ural 4/6

## Rules for the verification pass

1. Replace `C-RECALL-UNVERIFIED` with the real `citation_id` **and** set
   `citation_status: cited` in the same edit — the validator fails if one moves without
   the other (`test-basin-cycles.mjs`, check 5).
2. Add the source to the `Citations` tab first; a dangling citation FK fails check 2.
3. `literature-recalled` must never raise a model above **G1**.
4. Where literature contradicts the recalled stack, **replace the row** — do not keep both.
5. Re-run after every batch:
   ```bash
   cd apps/energy && node scripts/build-master-kb.mjs && node scripts/test-basin-cycles.mjs
   ```

## Still untouched

**113 of 179 basins have no cycles at all** — the 59 with 1–9 mapped fields and the 54 with
none. For genuinely frontier basins (Vilkitskii, Long Strait, Novaya Zemlya, Zyryanka…)
"no publicly established petroleum system" is the *correct* entry, not a gap to fill.
