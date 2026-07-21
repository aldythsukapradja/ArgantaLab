# QC · Identity mastering (Volve well / wellbore)

Maps the four naming systems onto master wellbore records. Links are by normalized name token only where unambiguous; nothing is force-merged. Exploration wells (15/9-19*) are kept DISTINCT from development F-wells.

- master wellbores (from survey headers): **24**  ·  wells: **11**
- WITSML wellbores: 29  ·  production wellbores: 7  ·  log well folders: 24
- CRS (all wellbores carrying one): ED50 / UTM Zone 31N (Geo Datum European 1950)

## Master wellbores → cross-source links

| master wellbore | well | parent (drilled from) | exploration? | WITSML | production | logs |
|---|---|---|:--:|:--:|:--:|:--:|
| 15/9-19 A | 15/9-19 | 15/9-19 SR | yes |  |  | ✅ |
| 15/9-19 BT2 | 15/9-19 | 15/9-19 B | yes |  |  |  |
| 15/9-19 SR | 15/9-19 | 15/9-19 S | yes |  |  |  |
| 15/9-F-11 | F-11 | Well Ref. Point |  | ✅ | ✅ | ✅ |
| 15/9-F-11 A | F-11 | 15/9-F-11 T2 |  | ✅ |  | ✅ |
| 15/9-F-11 B | F-11 | 15/9-F-11 T2 |  | ✅ |  | ✅ |
| 15/9-F-11 T2 | F-11 | 15/9-F-11 |  | ✅ |  | ✅ |
| F-1 | F-1 | Well Ref. Point |  | ✅ |  | ✅ |
| F-1 A | F-1 | F-1 |  | ✅ |  | ✅ |
| F-1 B | F-1 | F-1 |  | ✅ |  | ✅ |
| F-1 C | F-1 | F-1 |  | ✅ | ✅ | ✅ |
| F-10 | F-10 | Well Ref. Point |  | ✅ |  | ✅ |
| F-12 | F-12 | Well Ref. Point |  | ✅ | ✅ | ✅ |
| F-14 | F-14 | Well Ref. Point |  | ✅ | ✅ | ✅ |
| F-15 | F-15 | Well Ref. Point |  | ✅ |  | ✅ |
| F-15A | F-15 | F-15 |  | ✅ |  | ✅ |
| F-15B | F-15 | F-15A |  | ✅ |  | ✅ |
| F-15C | F-15 | F-15A |  | ✅ |  | ✅ |
| F-15D | F-15 | F-15 |  | ✅ | ✅ | ✅ |
| F-4 | F-4 | Well Ref. Point |  | ✅ | ✅ | ✅ |
| F-5 | F-5 | Well Ref. Point |  | ✅ | ✅ | ✅ |
| F-7 | F-7 | Well Ref. Point |  | ✅ |  | ✅ |
| F-9 | F-9 | Well Ref. Point |  | ✅ |  | ✅ |
| F-9 A | F-9 | F-9 |  | ✅ |  | ✅ |

## Unlinked (present in a source but no confident master match) — listed, not forced

**WITSML** (1 unlinked): 15/9-F-15S - Main Wellbore

**Production** (0 unlinked): none

**Logs** (2 unlinked): 15_9-19 B&BT2, 15_9-19 S&SR

## Rule enforced

- `15/9-19` (A / BT2 / SR) = **exploration** wells, discovery of the Volve/Hugin — NOT merged with the `15/9-F-*` development wellbores. Any apparent name overlap is coincidental field numbering; kept as separate wells.
