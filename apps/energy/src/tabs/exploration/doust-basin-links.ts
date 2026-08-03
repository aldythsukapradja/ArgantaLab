// doust-basin-links.ts — where Doust's own worked examples connect to REAL USGS
// provinces in this catalogue.
//
// This is deliberately NOT an algorithmic classifier (no guessing a basin's
// geodynamics from its name or region). Doust's booklet names specific, real basins
// as examples — Williston, the Arabian Basin, Maracaibo, Vienna, the Malay Basin — and
// nine of those names match a real USGS province in this workbook exactly. For those
// nine (plus Viking Graben, already fully modelled in knowledge-model.ts), we can
// honestly say "Doust himself classified this basin, and here is his figure of it."
// For the other ~169 provinces there is no such match, and the Geology card says so
// rather than inventing a classification the data doesn't support.
//
// Matched 2026-08-03 by exact/near-exact name match against public/world/provinces.geojson.
import type { CycleGeodynamics } from '../../cosmo/knowledge-model';
import type { FigureClass } from './basin-figures';

export interface DoustBasinLink {
  /** USGS province code (provinces.geojson prvCode) this classification applies to. */
  prvCode: string;
  /** Primary geodynamic class, per Doust's own chapter placement of the example. */
  geodynamics: CycleGeodynamics | null;
  figureClass: FigureClass;
  /** The figure that most directly pictures this basin — shown as "picture of the basin". */
  primaryFig: number;
  /** Other figures from the library that also apply. */
  relatedFigs: number[];
  /** Why this classification is trustworthy — always traces to Doust's own caption. */
  basis: string;
}

export const DOUST_BASIN_LINKS: DoustBasinLink[] = [
  {
    prvCode: '4025', geodynamics: 'extensional', figureClass: 'extensional', primaryFig: 8, relatedFigs: [9],
    basis: 'Doust\'s own worked example, both fig. 8 and fig. 9A — "the Jurassic–Cretaceous of the southern Viking Graben, Northern North Sea".',
  },
  {
    prvCode: '2019', geodynamics: 'sag', figureClass: 'sag-cratonic', primaryFig: 22, relatedFigs: [],
    basis: 'Doust\'s own worked example, fig. 22 — "the Arabian Basin, adjacent to the Arabian Shield" — is this province\'s namesake (Rub al Khali Basin, Arabian Shield margin).',
  },
  {
    prvCode: '3703', geodynamics: 'extensional', figureClass: 'extensional', primaryFig: 9, relatedFigs: [45],
    basis: 'Doust\'s own worked example, fig. 9B — "the Malay Basin, a composite non-marine rift to postrift section" — plus fig. 45 (external, Teisserenc & Villemin / Petronas) comparing its synrift fill to Gabon.',
  },
  {
    prvCode: '6099', geodynamics: 'compressional', figureClass: 'compressional-foreland', primaryFig: 35, relatedFigs: [],
    basis: 'Named worked example, fig. 35 — "Sketch map of the Maracaibo Basin, western Venezuela" (external: Mann et al. 2006).',
  },
  {
    prvCode: '6055', geodynamics: 'compressional', figureClass: 'synthesis', primaryFig: 44, relatedFigs: [],
    basis: 'Named worked example, fig. 44 — fold belt cross section and palinspastic reconstruction of the Neuquén Basin, Argentina (external: Manceda & Figueroa 1995).',
  },
  {
    prvCode: '6016', geodynamics: 'sag', figureClass: 'sag-cratonic', primaryFig: 25, relatedFigs: [28],
    basis: 'The cited source for figs. 25 and 28 — Daly, Fuck, Julia & Macdonald 2018 — is titled "Cratonic basin formation, Parnaiba Basin, Brazil"; this province is that basin.',
  },
  {
    prvCode: '7303', geodynamics: 'sag', figureClass: 'sag-postrift', primaryFig: 17, relatedFigs: [],
    basis: 'Doust\'s own worked example, fig. 17 — "Orange Basin, South Africa. Schematic geological profile across the passive continent margin."',
  },
  {
    prvCode: '3824', geodynamics: 'compressional', figureClass: 'compressional-foreland', primaryFig: 46, relatedFigs: [],
    basis: 'Named worked example, fig. 46 panel D — "Northwest Java Basin, Indonesia – synrift, postrift and compressional foreland cycles" (Doust\'s own paper, Doust & Sumner 2007).',
  },
  {
    prvCode: '3809', geodynamics: 'compressional', figureClass: 'compressional-forearc', primaryFig: 42, relatedFigs: [],
    basis: 'Named worked example, fig. 42 — "Java forearc Tertiary stratigraphy" (external: Surya Nugraha & Hall 2013) is the East Java forearc.',
  },
  {
    prvCode: '5234', geodynamics: null, figureClass: 'synthesis', primaryFig: 0, relatedFigs: [],
    basis: 'Described in Doust\'s own closing text (not a figure): a 5-cycle history — Carboniferous rift, Permian sag, Triassic–Jurassic sag, a second Cretaceous rift, and Paleocene foreland — citing Embry & Beauchamp 2019. Too mixed for one geodynamic label; genuinely multi-cycle.',
  },
];

export const doustLinkFor = (prvCode: string) => DOUST_BASIN_LINKS.find((l) => l.prvCode === prvCode) ?? null;
