// basin-figures.ts — the basin-type figure library backing the Knowledge Bank.
//
// Each entry is a figure from Harry Doust's "Dissecting Sedimentary Basins",
// recorded with the party who actually holds its rights. Doust cites his sources
// properly, but a citation is not a licence — for 31 of the 49 figures the
// rightsholder is a different author or publisher entirely. The 17 marked `own`
// have no external source named anywhere, i.e. they are Doust's own drawings.
//
// CLEARANCE (2026-08-03): the founder's organization approved internal, scientific/
// educational use of this material ON THE CONDITION that proper attribution is
// shown. That condition is why `attributionFor()` below is not optional and why the
// UI renders a credit on every thumbnail, in the lightbox, in exported Markdown and
// on every generated knowledge-graph note. Removing attribution breaks the terms the
// use rests on.
//
// SCOPE OF THAT CLEARANCE — internal/organizational, NOT public redistribution:
//   * apps/energy/public/doust-figures/ and the source PDF stay GITIGNORED. This
//     GitHub repo is PUBLIC, so committing the images would publish third-party
//     copyrighted work worldwide — far beyond "internal use". Distribute the image
//     folder through an internal channel instead, or make the repo private first.
//   * Regenerate locally with docs/arganta-energy/knowledge-base/extract_doust_figures.py
//   * Full sourcing narrative: doust-basin-figures/README.md
//
// Verified figure-by-figure against the complete 102-page source PDF on 2026-08-03.

/** Maps onto CycleGeodynamics in cosmo/knowledge-model.ts where a cycle type exists;
 *  'foundational' and 'synthesis' are book-level groupings, not cycle types. */
export type FigureClass =
  | 'foundational' | 'extensional' | 'sag-postrift' | 'sag-cratonic'
  | 'compressional-foreland' | 'compressional-forearc' | 'synthesis';

export type Sourcing = 'own' | 'external' | 'compiled';
/** `internal` = cleared by the founder's organization for internal scientific and
 *  educational use, conditional on attribution being displayed. It does NOT cover
 *  public redistribution — that would need `public`, which requires the individual
 *  rightsholder's consent (Doust for `own`, the named publisher for `external`). */
export type Permission = 'pending' | 'requested' | 'internal' | 'public' | 'refused';

export interface BasinFigure {
  fig: number;
  page: number;
  caption: string;
  klass: FigureClass;
  sourcing: Sourcing;
  /** Who to actually ask. Empty for `own` (that means Doust himself). */
  source: string;
  /** citation_id into the master workbook's Citations tab. */
  citationId: string;
  permission: Permission;
  file: string;
}

const f = (
  fig: number, page: number, klass: FigureClass, sourcing: Sourcing,
  source: string, citationId: string, caption: string,
): BasinFigure => ({
  fig, page, klass, sourcing, source, citationId, caption,
  permission: 'internal',
  file: `doust-figures/fig-${String(fig).padStart(2, '0')}.png`,
});

/** The credit line that MUST accompany every rendering of a figure — this is the
 *  condition the organization's clearance rests on. Always name the original
 *  rightsholder first where one exists, then the booklet it was reproduced from. */
export function attributionFor(figure: BasinFigure): string {
  const book = 'Doust, H., "Dissecting Sedimentary Basins"';
  if (figure.sourcing === 'own') return `© H. Doust — ${book}, fig. ${figure.fig}`;
  if (figure.sourcing === 'compiled') return `${book}, fig. ${figure.fig} (compiled from various sources)`;
  return `After ${figure.source} — reproduced in ${book}, fig. ${figure.fig}`;
}

export const BASIN_FIGURES: BasinFigure[] = [
  // ── Ch1 foundational ────────────────────────────────────────────────────────
  f(1, 9, 'foundational', 'external', 'Kingston et al. 1983', 'C-KINGSTON-83', 'Typical sedimentary basins related to their tectonic setting (divergent or convergent, continental or oceanic, interior or marginal)'),
  f(2, 12, 'foundational', 'external', 'Ziegler & Cloetingh 2004', 'C-ZIEGLER-04', 'Stresses that trigger stretching, basin development and crustal separation in the lithosphere'),
  f(3, 13, 'foundational', 'external', 'Fraser et al. 2007', 'C-FRASER-07', 'Models illustrating the reaction of the crust to extensional stresses acting on different lithosphere strength profiles'),
  f(4, 14, 'foundational', 'own', '', 'C-DOUST-01', 'Three basic mechanisms that produce subsidence and accommodation space: crustal extension, thermal relaxation, flexural response to compression'),
  f(5, 14, 'foundational', 'own', '', 'C-DOUST-01', 'Examples of single and multiple cycle basins'),
  f(6, 17, 'foundational', 'external', 'Wikipedia (CC-BY-SA)', 'C-WIKI-DEPENV', 'General depositional environment model showing the five main facies associations'),

  // ── Ch2 divergent / extensional (rift) ──────────────────────────────────────
  f(7, 22, 'extensional', 'own', '', 'C-DOUST-01', 'Sketch cross sections and map views of common rift geometries'),
  f(8, 23, 'extensional', 'own', '', 'C-DOUST-01', 'Typical half-graben failed-rift cycle geometry, the Jurassic–Cretaceous of the southern Viking Graben, Northern North Sea'),
  f(9, 23, 'extensional', 'own', '', 'C-DOUST-01', 'Sketched examples of symmetrical failed-rift cycle geometries: the Viking Graben and the Malay Basin'),
  f(10, 24, 'extensional', 'own', '', 'C-DOUST-01', 'Examples of hyperextended rifts: Basin and Range (Nevada) and the Laptev Sea'),
  f(11, 26, 'extensional', 'own', '', 'C-DOUST-01', 'Cartoon showing stages in the development of a typical rift cycle — initiation, climax, waning'),
  f(12, 28, 'extensional', 'own', '', 'C-DOUST-01', 'Typical depositional environments and facies in the climax stage of a half-graben rift'),
  f(13, 28, 'extensional', 'external', 'Perner et al. 2018', 'C-PERNER-18', 'Lower Rhine Graben, Germany — Quaternary sediment thickness in a mature rift'),
  f(14, 30, 'extensional', 'own', '', 'C-DOUST-01', 'Impact of different rates of accommodation space creation versus rate of sedimentation in a rift cycle'),
  f(15, 31, 'extensional', 'external', 'Katz 1995', 'C-KATZ-95', 'Stratigraphy of continental synrift sequences from different continents, demonstrating the overall similarity'),
  f(16, 32, 'extensional', 'external', 'Jiang Shu et al. 2013', 'C-JIANGSHU-13', 'Liaodong Bay, East China — depositional environments in the Oligocene synrift Dongying Formation'),

  // ── Ch3 unfaulted postrift sag / passive margin ─────────────────────────────
  f(17, 42, 'sag-postrift', 'own', '', 'C-DOUST-01', 'Orange Basin, South Africa — schematic profile across the passive continental margin and its chronostratigraphy'),
  f(18, 45, 'sag-postrift', 'external', 'Lundin et al. 2018', 'C-LUNDIN-18', 'Comparison of a slowly extending magma-poor margin and a rapidly extending magma-rich margin'),
  f(19, 46, 'sag-postrift', 'external', 'Takano 2002', 'C-TAKANO-02', 'Niigata Basin, Japan — chronostratigraphic chart of a marginal rift/postrift back-arc basin'),
  f(20, 48, 'sag-postrift', 'compiled', 'various sources (unnamed)', 'C-DOUST-01', 'Sketch sections illustrating the variety of western Atlantic passive margin cycles'),

  // ── Ch4 sag basins of continental interiors (cratonic) ──────────────────────
  f(21, 53, 'sag-cratonic', 'own', '', 'C-DOUST-01', 'Worldwide location of some of the larger intracratonic basins situated on Precambrian cratons'),
  f(22, 55, 'sag-cratonic', 'own', '', 'C-DOUST-01', 'West–east cross section of the Arabian Basin, adjacent to the Arabian Shield'),
  f(23, 56, 'sag-cratonic', 'own', '', 'C-DOUST-01', 'Section illustrating the Mesozoic carbonate shelf to margin sequence of the Middle East (central Oman)'),
  f(24, 57, 'sag-cratonic', 'external', 'Miall 2019 (in Miall ed.)', 'C-MIALLBOOK-19', 'Schematic chronostratigraphic section across the Cambrian cratonic margin in western Canada'),
  f(25, 58, 'sag-cratonic', 'external', 'Watts et al. in Daly (eds) 2018', 'C-WATTS-DALY-18', 'Basin shape, thickness and stratigraphy of three representative intracratonic basins'),
  f(26, 59, 'sag-cratonic', 'own', '', 'C-DOUST-01', 'The Williston Basin, USA — megasequences (major basin cycles) stacked and shifted through time'),
  f(27, 61, 'sag-cratonic', 'external', 'Burgess 2019 (in Miall ed.)', 'C-BURGESS-19', 'Illinois Basin, USA — cyclic basin development through the Palaeozoic, annotated with Sloss megacycles'),
  f(28, 64, 'sag-cratonic', 'external', 'Watts et al. in Daly 2018 + Craig et al. 2010', 'C-WATTS-DALY-18', 'The Taoudenni Basin, Mali — Palaeozoic cratonic sag cycles overlying complex Precambrian geology'),

  // ── Ch5 convergent — foreland ───────────────────────────────────────────────
  f(29, 67, 'compressional-foreland', 'own', '', 'C-DOUST-01', 'A section across a typical foreland basin, with the depocenter displaced toward the continent interior'),
  f(30, 69, 'compressional-foreland', 'own', '', 'C-DOUST-01', 'Continent–continent collision, where colliding plates are of comparable density'),
  f(31, 70, 'compressional-foreland', 'own', '', 'C-DOUST-01', 'Ocean-to-continent collision, where the colliding plates are of unequal density'),
  f(32, 73, 'compressional-foreland', 'external', 'Allen et al. 1991', 'C-ALLEN-91', 'Chronostratigraphic foreland cycle stratigraphy of the Molasse Basin in eastern Switzerland'),
  f(33, 73, 'compressional-foreland', 'external', 'de Ruig & Hubbard 2006', 'C-DERUIG-06', 'Structure of the foreland cycle of the Austrian Molasse Basin'),
  f(34, 74, 'compressional-foreland', 'external', 'de Ruig & Hubbard 2006', 'C-DERUIG-06', 'Palaeogeographic sketch of the Oligocene in the Molasse Basin near Salzburg'),
  f(35, 75, 'compressional-foreland', 'external', 'Mann et al. 2006', 'C-MANN-06', 'Sketch map of the Maracaibo Basin, western Venezuela — a wrenched plate-boundary deformation zone'),
  f(36, 76, 'compressional-foreland', 'external', 'Miall ed. 2019, Elsevier', 'C-MIALLBOOK-19', 'Tectonic-driven stages and typical lithologies in the Taconic foreland basin cycle'),
  f(37, 79, 'compressional-foreland', 'external', 'Miall ed. 2019, Elsevier', 'C-MIALLBOOK-19', 'Depositional environments in a Laramide foreland basin cycle, western USA'),

  // ── Ch5 convergent — forearc ────────────────────────────────────────────────
  f(38, 81, 'compressional-forearc', 'external', 'Buchs et al. 2009', 'C-BUCHS-09', 'Model of a forearc zone, based on the Eocene of Costa Rica in the early Tertiary'),
  f(39, 82, 'compressional-forearc', 'external', 'Henry et al. 2012', 'C-HENRY-12', 'Geologic section based on a seismic profile across the Nankai Trough, a forearc zone in SE Japan'),
  f(40, 83, 'compressional-forearc', 'external', 'Deville et al. 2003', 'C-DEVILLE-03', 'Sketch map of the Caribbean Island Arc, including the Tobago and Barbados basins'),
  f(41, 84, 'compressional-forearc', 'external', 'Speed et al. 1991', 'C-SPEED-91', 'Sketch cross section through the Barbados outer ridge and accretionary prism'),
  f(42, 86, 'compressional-forearc', 'external', 'Surya Nugraha & Hall 2013', 'C-SURYANUGRAHA-13', 'Java forearc Tertiary stratigraphy — migration from arc, through forearc basin, outer ridge to forearc slope'),

  // ── Ch6 building the basin (cross-basin synthesis) ──────────────────────────
  f(43, 92, 'synthesis', 'external', 'Tarapoanca 2004', 'C-TARAPOANCA-04', 'Line drawing of a seismic profile across a foreland basin in Romania, broken into its component cycles'),
  f(44, 93, 'synthesis', 'external', 'Manceda & Figueroa 1995', 'C-MANCEDA-95', 'Fold belt cross section and palinspastic reconstruction, Neuquén Basin, Argentina'),
  f(45, 94, 'synthesis', 'external', 'Teisserenc & Villemin 1989 + Petronas 1999', 'C-TEISSERENC-89', 'Comparison of non-marine synrift cycle fills in the Gabon Basin and the Malay Basin'),
  f(46, 95, 'synthesis', 'external', 'Doust & Sumner 2007', 'C-DOUST-SUMNER-07', 'Cartoons showing the evolution of a selection of SE Asian Tertiary basins'),
  f(47, 96, 'synthesis', 'external', 'Beglinger, Corver, Doust, Cloetingh & Thurmond 2012', 'C-DOUST-03', 'An example of a basin trajectory plot — Almada-Camamu Basin, Brazil'),
  f(48, 98, 'synthesis', 'external', 'Rupprecht et al. 2018', 'C-RUPPRECHT-18', 'Cross section through the Vienna Basin showing the strike-slip pull-apart stage'),
  f(49, 99, 'synthesis', 'external', 'Rupprecht et al. 2018', 'C-RUPPRECHT-18', 'Complex geological evolution of the Vienna Basin, Austria — four stages'),
];

export interface FigureClassMeta {
  id: FigureClass;
  title: string;
  /** CycleGeodynamics value in knowledge-model.ts, where one applies. */
  geodynamics: 'pre-rift' | 'extensional' | 'sag' | 'compressional' | null;
  blurb: string;
}

export const FIGURE_CLASSES: FigureClassMeta[] = [
  { id: 'foundational', title: 'Foundations', geodynamics: null,
    blurb: 'What makes a basin subside at all — extension, thermal relaxation and flexural loading — and the vocabulary the rest of the library is built on.' },
  { id: 'extensional', title: 'Extensional · rift', geodynamics: 'extensional',
    blurb: 'Active crustal extension and normal faulting. Half-graben and symmetric geometries; fill swings non-marine to marine as accommodation outpaces or lags supply.' },
  { id: 'sag-postrift', title: 'Sag · postrift margin', geodynamics: 'sag',
    blurb: 'Thermal-relaxation subsidence after faulting stops. Wider than the rift beneath it, and the setting of most passive-margin stratigraphy.' },
  { id: 'sag-cratonic', title: 'Sag · cratonic interior', geodynamics: 'sag',
    blurb: 'Long-lived, low-rate subsidence on Precambrian shields. Megasequences stacked and offset over hundreds of millions of years.' },
  { id: 'compressional-foreland', title: 'Compressional · foreland', geodynamics: 'compressional',
    blurb: 'Flexural depocentres ahead of an advancing fold-and-thrust belt, migrating continentward and cannibalising their own earlier fill.' },
  { id: 'compressional-forearc', title: 'Compressional · forearc', geodynamics: 'compressional',
    blurb: 'Sediment trapped between a volcanic arc and an accretionary prism, in the most tectonically unstable setting of all.' },
  { id: 'synthesis', title: 'Building the basin', geodynamics: null,
    blurb: 'Real basins dissected into their component cycles — the payoff of the whole approach, and how one basin becomes an analogue for another.' },
];

export const figuresFor = (klass: FigureClass) => BASIN_FIGURES.filter((x) => x.klass === klass);
export const figureByNumber = (fig: number) => BASIN_FIGURES.find((x) => x.fig === fig) ?? null;

/** Figures whose geodynamic class matches a basin cycle's `geodynamics` value, so a
 *  real cycle (e.g. Volve's Hugin syn-rift) can show the type-section literature. */
export const figuresForGeodynamics = (g: string) => {
  const classes = FIGURE_CLASSES.filter((c) => c.geodynamics === g).map((c) => c.id);
  return BASIN_FIGURES.filter((x) => classes.includes(x.klass));
};

export const FIGURE_STATS = {
  total: BASIN_FIGURES.length,
  own: BASIN_FIGURES.filter((x) => x.sourcing === 'own').length,
  external: BASIN_FIGURES.filter((x) => x.sourcing === 'external').length,
  compiled: BASIN_FIGURES.filter((x) => x.sourcing === 'compiled').length,
  internal: BASIN_FIGURES.filter((x) => x.permission === 'internal').length,
  public: BASIN_FIGURES.filter((x) => x.permission === 'public').length,
  /** Distinct third-party rightsholders — who to approach if public use is ever wanted. */
  rightsholders: new Set(BASIN_FIGURES.filter((x) => x.sourcing === 'external').map((x) => x.source)).size,
};
