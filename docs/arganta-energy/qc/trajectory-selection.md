# QC · Trajectory selection (definitive-survey rule)

Founder rule: from each wellbore's WITSML trajectory objects, keep ONLY the definitive/final as-drilled survey (greatest MD + non-plan naming + most stations). A plan is never stored as `measured`.

- wellbores: **29**  ·  definitive surveys selected: **29**  ·  trajectory objects total: **63**
- angle unit across all Volve WITSML stations: `dega` (degrees) — no radians encountered

## All trajectory objects per wellbore

| wellbore | file | name | inferred | stations | MD range (m) | KEPT |
|---|---|---|---|--:|---|:--:|
| 15/9-F-1 - Main Wellbore | 1.xml | 36in. Section. Combined SLB/Geoservices RT-Data  | definitive | 8 | 0.0 → 210.6957432 | ✅ |
| 15/9-F-10 - Main Wellbore | 1.xml | 8.5 in Section - Actual Traj | definitive | 479 | 0.0 → 5300.0653968 | ✅ |
|  | 2.xml | 26in. Section - Actual Traj | definitive | 57 | 0.0 → 1381.5998784 |  |
|  | 3.xml | 12.25 in. Section - Actual Traj | definitive | 102 | 0.0 → 3426.6198168 |  |
|  | 4.xml | 36in. Section - Actual Traj | definitive | 7 | 0.0 → 193.6747968 |  |
|  | 5.xml | 17.5 in. Section - Actual Traj | definitive | 81 | 0.0 → 2600.3591376 |  |
| 15/9-F-12 - Main Wellbore | 1.xml | Real Time MWD/LWD data - 8.5in. Pilot - Actual T | definitive | 38 | 0.0 → 1329.5601552 |  |
|  | 2.xml | Real Time MWD/LWD Mudlog data - 12.25in. - Actua | definitive | 200 | 0.0 → 3081.2484984 | ✅ |
|  | 3.xml | Real Time MWD/LWD data - 26in. section - Actual  | definitive | 37 | 0.0 → 1344.7398048 |  |
|  | 4.xml | Real Time MWD/LWD data - 36in. section - Actual  | definitive | 10 | 0.0 → 242.7418056 |  |
|  | 5.xml | Real Time MWD/LWD Mudlog data - 17.5in. section  | definitive | 67 | 0.0 → 2536.0682832 |  |
|  | 6.xml | Real Time MWD/LWD Mudlog data - 8.5 in. section  | definitive | 2 | 0.0 → 145.0000656 |  |
|  | 7.xml | Real Time MWD/LWD data - 8.5in. section - Actual | definitive | 200 | 0.0 → 3081.2484984 |  |
|  | 8.xml | Real Time MWD/LWD data - 26in. section - Plan Tr | ambiguous | 146 | 0.0 → 3441.2895509352 |  |
| 15/9-F-14 - Main Wellbore | 1.xml | Real Time MWD/LWD data - 36in. Section - Actual  | definitive | 5 | 0.0 → 184.0998096 |  |
|  | 2.xml | 17 1/2in Section. - Actual Traj | definitive | 47 | 0.0 → 2227.4534064 |  |
|  | 3.xml | MWD Geocervices Real Time Data 26in - Actual Tra | definitive | 17 | 0.0 → 1065.6999768 |  |
|  | 4.xml | 8 1/2 in Section - Actual Traj | definitive | 92 | 145.8998352 → 3729.8577168 | ✅ |
|  | 5.xml | 12 1/4in Section - Actual Traj | definitive | 59 | 0.0 → 2747.1581328 |  |
| 15/9-F-15 - Main Wellbore | 1.xml | 17.5in Section - Actual Traj | definitive | 61 | 0.0 → 2576.1851448 |  |
|  | 2.xml | 8.5 in - Actual Traj | definitive | 99 | 0.0 → 4075.0397544 | ✅ |
| 15/9-F-15A - Main Wellbore | 1.xml | 8.5in. Section - Actual Traj | definitive | 80 | 0.0 → 3211.7848896 | ✅ |
|  | 2.xml | 12.25in section - Actual Traj | definitive | 69 | 0.0 → 2892.3968568 |  |
| 15/9-F-15B - Main Wellbore | 1.xml | 8.5in section - Actual Traj | definitive | 87 | 0.0 → 3476.8465896 | ✅ |
| 15/9-F-15S - Main Wellbore | 1.xml | 8.5in Section - Actual Traj | definitive | 101 | 0.0 → 4042.8827448 | ✅ |
|  | 2.xml | 12.25in. section - Actual Traj | definitive | 64 | 0.0 → 2522.9198208 |  |
| 15/9-F-4 - Main Wellbore | 1.xml | Preload Test - Actual Traj | definitive | 68 | 0.0 → 2760.2425872 |  |
|  | 2.xml | Real Time MWD/LWD Mudlog Data - 12.25 in. sectio | definitive | 67 | 0.0 → 2740.785984 |  |
|  | 3.xml | Real Time MWD/LWD data - 36in. section - Actual  | definitive | 10 | 0.0 → 242.3598912 |  |
|  | 4.xml | Real Time MWD/LWD Mudlog Data - 8.5 in. section  | definitive | 86 | 0.0 → 3484.982616 | ✅ |
|  | 5.xml | Real Time MWD/LWD data - 17.5in. section - Actua | definitive | 42 | 0.0 → 1335.6500592 |  |
| 15/9-F-5 - Main Wellbore | 1.xml | Real Time SLB & Geoservice data -17.5in.Section  | definitive | 38 | 0.0 → 1386.4288248 |  |
|  | 2.xml | Real Time SLB & Geoservices data -12.25in.Sectio | definitive | 74 | 0.0 → 2913.3116232 |  |
|  | 3.xml | Real Time SLB & Geoservices data - 8.5in. Sectio | definitive | 96 | 0.0 → 3761.7654 | ✅ |
|  | 4.xml | Real Time SLB & Geoservice data - 36in. Section  | definitive | 9 | 0.0 → 213.0164904 |  |
| 15/9-F-7 - Main Wellbore | 1.xml | Real Time MWD  Mudlog data - 36 in. section - Ac | definitive | 6 | 0.0 → 195.6489864 |  |
|  | 2.xml | Real Time MWD/LWD Mudlog Data - 12.25 in. sectio | definitive | 42 | 0.0 → 1043.9558496 | ✅ |
|  | 3.xml | Real Time MWD/LWD Mudlog Data - 17.5 in. section | definitive | 40 | 0.0 → 881.1566832 |  |
| 15/9-F-9 - Main Wellbore | 1.xml | 36in. Section. Combined SLB and Geoservises RT-D | definitive | 8 | 0.0 → 210.7024488 |  |
|  | 2.xml | 12.25 in RT - Actual Traj | definitive | 25 | 149.5464624 → 1048.8622152 | ✅ |
|  | 3.xml | 17.5 in section Combined SLB and Geoservices Dat | definitive | 9 | 0.0 → 213.0164904 |  |
| 15/9-F-9 A - Main Wellbore | 1.xml | 8.5 in Section - Actual Traj | definitive | 21 | 420.399972 → 1181.034468 | ✅ |
|  | 2.xml | 12.25 in Section - Actual Traj | definitive | 17 | 420.399972 → 968.1344112 |  |
| NO 15/9-F-1 | 1.xml | MWD-15/9-F-1 | definitive | 93 | 0.0 → 3620.3 | ✅ |
|  | 2.xml | MWD-15/9-F-1 | definitive | 113 | 0.0 → 3465.0 |  |
| NO 15/9-F-1 A | 1.xml | MWD-15/9-F-1 A | definitive | 96 | 0.0 → 3671.1 | ✅ |
| NO 15/9-F-1 B | 1.xml | MWD-15/9-F-1 B | definitive | 90 | 0.0 → 3453.8 | ✅ |
| NO 15/9-F-1 C | 1.xml | MWD-15/9-F-1 C | definitive | 105 | 0.0 → 4079.2 |  |
|  | 2.xml | MWD-15/9-F-1 C | definitive | 113 | 0.0 → 4094.0 | ✅ |
| NO 15/9-F-11 | 1.xml | MWD-15/9-F-11 | definitive | 20 | 0.0 → 319.22 | ✅ |
| NO 15/9-F-11 A | 1.xml | MWD-15/9-F-11 A | definitive | 319 | 0.0 → 3749.1 | ✅ |
| NO 15/9-F-11 B | 1.xml | MWD-15/9-F-11 B | definitive | 300 | 0.0 → 4770.0 | ✅ |
|  | 2.xml | MWD-15/9-F-11 B | definitive | 299 | 0.0 → 4757.1 |  |
|  | 3.xml | MWD-15/9-F-11 B_bull | definitive | 255 | 0.0 → 2966.3 |  |
| NO 15/9-F-11 T2 | 1.xml | MWD-15/9-F-11 T2 | definitive | 133 | 0.0 → 4547.6 | ✅ |
| NO 15/9-F-12 | 1.xml | MWD-15/9-F-12 | definitive | 212 | 0.0 → 3520.0 | ✅ |
| NO 15/9-F-14 | 1.xml | MWD-15/9-F-14 | definitive | 94 | 0.0 → 3750.0 | ✅ |
| NO 15/9-F-15 C | 1.xml | MWD-15/9-F-15 C | definitive | 80 | 0.0 → 3232.0 | ✅ |
| NO 15/9-F-15 D | 1.xml | MWD-15/9-F-15 D | definitive | 114 | 0.0 → 4671.0 | ✅ |
| NO 15/9-F-4 | 1.xml | MWD-15/9-F-4 | definitive | 87 | 0.0 → 3510.0 | ✅ |
| NO 15/9-F-5 | 1.xml | MWD-15/9-F-5 | definitive | 98 | 0.0 → 3792.0 | ✅ |
| NO 15/9-F-7 | 1.xml | MWD-15/9-F-7 | definitive | 42 | 0.0 → 1083.0 | ✅ |
| NO 15/9-F-9 A | 1.xml | MWD-15/9-F-9 A | definitive | 25 | 0.0 → 1206.0 | ✅ |

## AMBIGUOUS wellbores — founder review at Gate 2

None — every kept survey came from a definitively-named object.
