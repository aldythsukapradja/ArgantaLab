// @arganta/audio — CLASSICAL LIBRARY. A curated set of famous public-domain
// classical themes, each hand-transcribed as compact note DATA (a semitone
// offset from a root pitch + a beat-timed start/duration) and played back
// live through the SAME synthesized INSTRUMENTS as the generative engine —
// no audio files, no sampled recordings, no copied sheet-music edition.
//
// WHY THIS IS FREE TO USE:
//   A musical COMPOSITION'S copyright expires — in the US/EU/most of the
//   world that's life-of-the-composer + 70 years (the US also has a flat
//   "published before 1930" public-domain cutoff). Every composer below
//   died decades past that line (Pachelbel 1706, Bach 1750, Vivaldi 1741,
//   Mozart 1791, Beethoven 1827, Mendelssohn 1847, Chopin 1849, J. Strauss
//   Sr. 1849, Bizet 1875, Grieg 1907, Wagner 1883, Satie 1925, Debussy 1918,
//   Holst 1934, R. Strauss 1949), or is historically anonymous (the
//   19th-century "Spanish Romance" — its author was never established, so
//   no personal copyright term ever applied to the tune itself).
//
//   WHAT STAYS COPYRIGHTED is a specific RECORDING (a named orchestra's
//   performance) or a specific modern EDITION (an editor's added fingerings
//   / phrasing marks). Neither applies here: every note below is an
//   independent, from-scratch transcription of the melody's shape,
//   synthesized fresh at playback time — the same legal footing as a
//   musician performing Beethoven from memory, not a copy of anyone's
//   recording or engraving.
//
// FIDELITY NOTE: these are the ICONIC OPENING PHRASES — the ~8–15 seconds
// everyone hums — not full scores. A handful are deliberately simplified
// into a compact, loop-friendly cell (Für Elise, Turkish March, Moonlight
// Sonata's arpeggio texture) rather than a note-perfect page of score.

import { INSTRUMENTS } from './music.js';

export const CLASSICAL_MOODS = ['cozy', 'adventurous', 'energetic', 'festive', 'regal', 'playful'];

// note shape: { t: startBeat, d: durationBeats, n: semitoneOffsetFromRoot, oct?: octaveShift }
export const CLASSICAL_PIECES = [
  {
    id: 'fur_elise', title: 'Für Elise', composer: 'Ludwig van Beethoven',
    born: 1770, died: 1827, work: 'Bagatelle No. 25 in A minor, WoO 59', year: 1810,
    mood: 'playful', instrument: 'piano', rootMidi: 69, bpm: 80, reverb: 0.34,
    notes: [
      { t: 0, d: 0.5, n: 7 }, { t: 0.5, d: 0.5, n: 6 }, { t: 1.0, d: 0.5, n: 7 }, { t: 1.5, d: 0.5, n: 6 },
      { t: 2.0, d: 0.5, n: 7 }, { t: 2.5, d: 0.5, n: 2 }, { t: 3.0, d: 0.5, n: 5 }, { t: 3.5, d: 0.5, n: 3 },
      { t: 4.0, d: 1.0, n: 0 },
      { t: 5.0, d: 0.5, n: -9 }, { t: 5.5, d: 0.5, n: -5 }, { t: 6.0, d: 1.0, n: 0 }, { t: 7.0, d: 1.0, n: 2 },
      { t: 8.0, d: 0.5, n: -5 }, { t: 8.5, d: 0.5, n: -1 }, { t: 9.0, d: 0.5, n: 2 }, { t: 9.5, d: 0.5, n: 3 },
      { t: 10.0, d: 1.5, n: 0 },
    ],
  },
  {
    id: 'ode_to_joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven',
    born: 1770, died: 1827, work: 'Symphony No. 9 in D minor, "Choral", 4th mvt', year: 1824,
    mood: 'festive', instrument: 'strings', rootMidi: 62, bpm: 100, reverb: 0.3,
    notes: [
      { t: 0, d: 1, n: 4 }, { t: 1, d: 1, n: 4 }, { t: 2, d: 1, n: 5 }, { t: 3, d: 1, n: 7 },
      { t: 4, d: 1, n: 7 }, { t: 5, d: 1, n: 5 }, { t: 6, d: 1, n: 4 }, { t: 7, d: 1, n: 2 },
      { t: 8, d: 1, n: 0 }, { t: 9, d: 1, n: 0 }, { t: 10, d: 1, n: 2 }, { t: 11, d: 1.5, n: 4 },
      { t: 12.5, d: 0.5, n: 2 }, { t: 13, d: 2, n: 2 },
    ],
  },
  {
    id: 'eine_kleine_nachtmusik', title: 'Eine kleine Nachtmusik', composer: 'Wolfgang Amadeus Mozart',
    born: 1756, died: 1791, work: 'Serenade No. 13 in G, K. 525, 1st mvt', year: 1787,
    mood: 'festive', instrument: 'strings', rootMidi: 67, bpm: 120, reverb: 0.28,
    notes: [
      { t: 0, d: 0.5, n: -12 }, { t: 0.5, d: 0.5, n: -5 }, { t: 1.0, d: 0.5, n: 0 }, { t: 1.5, d: 0.5, n: 4 },
      { t: 2.0, d: 1.0, n: 7 }, { t: 3.0, d: 0.5, n: 7 }, { t: 3.5, d: 0.5, n: 5 }, { t: 4.0, d: 0.5, n: 4 },
      { t: 4.5, d: 0.5, n: 2 }, { t: 5.0, d: 0.5, n: 0 }, { t: 5.5, d: 0.5, n: -1 }, { t: 6.0, d: 0.5, n: -3 },
      { t: 6.5, d: 1.0, n: -5 },
    ],
  },
  {
    id: 'turkish_march', title: 'Turkish March', composer: 'Wolfgang Amadeus Mozart',
    born: 1756, died: 1791, work: 'Piano Sonata No. 11, K. 331, "Rondo alla Turca"', year: 1783,
    mood: 'playful', instrument: 'piano', rootMidi: 69, bpm: 138, reverb: 0.2,
    notes: [
      { t: 0.00, d: 0.25, n: 2 }, { t: 0.25, d: 0.25, n: 3 }, { t: 0.50, d: 0.25, n: 2 }, { t: 0.75, d: 0.25, n: 0 },
      { t: 1.00, d: 0.25, n: 2 }, { t: 1.25, d: 0.25, n: 3 }, { t: 1.50, d: 0.25, n: 5 }, { t: 1.75, d: 0.25, n: 3 },
      { t: 2.00, d: 0.25, n: 2 }, { t: 2.25, d: 0.25, n: 0 }, { t: 2.50, d: 0.25, n: -1 }, { t: 2.75, d: 0.25, n: 0 },
      { t: 3.00, d: 0.25, n: 2 }, { t: 3.25, d: 0.25, n: 0 }, { t: 3.50, d: 0.25, n: -1 }, { t: 3.75, d: 0.5, n: 0 },
    ],
  },
  {
    id: 'canon_in_d', title: 'Canon in D', composer: 'Johann Pachelbel',
    born: 1653, died: 1706, work: 'Canon and Gigue in D major, P. 37', year: 1690,
    mood: 'regal', instrument: 'strings', bassInstrument: 'upright', rootMidi: 62, bpm: 92, reverb: 0.4,
    notes: [
      { t: 0, d: 2, n: 16 }, { t: 2, d: 2, n: 14 }, { t: 4, d: 2, n: 12 }, { t: 6, d: 2, n: 11 },
      { t: 8, d: 2, n: 9 }, { t: 10, d: 2, n: 7 }, { t: 12, d: 2, n: 9 }, { t: 14, d: 2, n: 11 },
    ],
    bass: [
      { t: 0, d: 1, n: 0, oct: -2 }, { t: 1, d: 1, n: 7, oct: -2 }, { t: 2, d: 1, n: 9, oct: -2 }, { t: 3, d: 1, n: 4, oct: -2 },
      { t: 4, d: 1, n: 5, oct: -2 }, { t: 5, d: 1, n: 0, oct: -2 }, { t: 6, d: 1, n: 5, oct: -2 }, { t: 7, d: 1, n: 7, oct: -2 },
      { t: 8, d: 1, n: 0, oct: -2 }, { t: 9, d: 1, n: 7, oct: -2 }, { t: 10, d: 1, n: 9, oct: -2 }, { t: 11, d: 1, n: 4, oct: -2 },
      { t: 12, d: 1, n: 5, oct: -2 }, { t: 13, d: 1, n: 0, oct: -2 }, { t: 14, d: 1, n: 5, oct: -2 }, { t: 15, d: 1, n: 7, oct: -2 },
    ],
  },
  {
    id: 'clair_de_lune', title: 'Clair de Lune', composer: 'Claude Debussy',
    born: 1862, died: 1918, work: 'Suite bergamasque, 3rd mvt', year: 1905,
    mood: 'cozy', instrument: 'piano', rootMidi: 61, bpm: 54, reverb: 0.48,
    notes: [
      { t: 0, d: 2, n: 7 }, { t: 2, d: 2, n: 12 }, { t: 4, d: 1, n: 12 }, { t: 5, d: 1, n: 11 },
      { t: 6, d: 2, n: 9 }, { t: 8, d: 2, n: 7 }, { t: 10, d: 2, n: 4 }, { t: 12, d: 3, n: 7 },
    ],
  },
  {
    id: 'gymnopedie_1', title: 'Gymnopédie No. 1', composer: 'Erik Satie',
    born: 1866, died: 1925, work: 'Trois Gymnopédies', year: 1888,
    mood: 'cozy', instrument: 'piano', rootMidi: 62, bpm: 66, reverb: 0.42,
    notes: [
      { t: 0, d: 1.5, n: 4 }, { t: 1.5, d: 1.5, n: 7 }, { t: 3, d: 1, n: 5 }, { t: 4, d: 1, n: 4 },
      { t: 5, d: 1.5, n: 2 }, { t: 6.5, d: 2, n: 0 },
    ],
  },
  {
    id: 'morning_mood', title: 'Morning Mood', composer: 'Edvard Grieg',
    born: 1843, died: 1907, work: 'Peer Gynt Suite No. 1, Op. 46', year: 1875,
    mood: 'adventurous', instrument: 'flute', rootMidi: 64, bpm: 66, reverb: 0.4,
    notes: [
      { t: 0, d: 1.5, n: 0 }, { t: 1.5, d: 0.5, n: 2 }, { t: 2, d: 1, n: 4 }, { t: 3, d: 2, n: 7 },
      { t: 5, d: 1, n: 4 }, { t: 6, d: 1, n: 2 }, { t: 7, d: 2, n: 0 },
    ],
  },
  {
    id: 'mountain_king', title: 'In the Hall of the Mountain King', composer: 'Edvard Grieg',
    born: 1843, died: 1907, work: 'Peer Gynt Suite No. 1, Op. 46', year: 1875,
    mood: 'energetic', instrument: 'pizzStrings', bassInstrument: 'upright', rootMidi: 59, bpm: 100, reverb: 0.24,
    notes: [
      { t: 0, d: 0.5, n: 0 }, { t: 0.5, d: 0.5, n: 2 }, { t: 1.0, d: 0.5, n: 3 }, { t: 1.5, d: 0.5, n: 5 },
      { t: 2.0, d: 0.5, n: 7 }, { t: 2.5, d: 0.5, n: 8 }, { t: 3.0, d: 1, n: 12 },
    ],
  },
  {
    id: 'ride_of_the_valkyries', title: 'Ride of the Valkyries', composer: 'Richard Wagner',
    born: 1813, died: 1883, work: 'Die Walküre, Act III', year: 1870,
    mood: 'energetic', instrument: 'brass', rootMidi: 62, bpm: 100, reverb: 0.26,
    notes: [
      { t: 0.00, d: 0.75, n: 0 }, { t: 0.75, d: 0.25, n: 4 }, { t: 1.00, d: 0.75, n: 7 }, { t: 1.75, d: 0.25, n: 12 },
      { t: 2.00, d: 1.0, n: 7 },
      { t: 3.00, d: 0.75, n: 0 }, { t: 3.75, d: 0.25, n: 4 }, { t: 4.00, d: 0.75, n: 7 }, { t: 4.75, d: 0.25, n: 12 },
      { t: 5.00, d: 1.5, n: 7 },
    ],
  },
  {
    id: 'radetzky_march', title: 'Radetzky March', composer: 'Johann Strauss Sr.',
    born: 1804, died: 1849, work: 'Op. 228', year: 1848,
    mood: 'festive', instrument: 'brass', rootMidi: 70, bpm: 126, reverb: 0.22,
    notes: [
      { t: 0, d: 0.5, n: 0 }, { t: 0.5, d: 0.5, n: 0 }, { t: 1.0, d: 0.5, n: 4 }, { t: 1.5, d: 0.5, n: 7 },
      { t: 2.0, d: 1, n: 7 }, { t: 3.0, d: 0.5, n: 4 }, { t: 3.5, d: 0.5, n: 2 }, { t: 4.0, d: 1.5, n: 0 },
    ],
  },
  {
    id: 'wedding_march', title: 'Wedding March', composer: 'Felix Mendelssohn',
    born: 1809, died: 1847, work: 'A Midsummer Night’s Dream, Op. 61', year: 1842,
    mood: 'regal', instrument: 'brass', rootMidi: 72, bpm: 112, reverb: 0.3,
    notes: [
      { t: 0.0, d: 0.4, n: 0 }, { t: 0.4, d: 0.4, n: 0 }, { t: 0.8, d: 0.4, n: 0 }, { t: 1.2, d: 0.4, n: 0 },
      { t: 1.6, d: 1.4, n: 7 }, { t: 3.0, d: 0.5, n: 5 }, { t: 3.5, d: 0.5, n: 4 }, { t: 4.0, d: 1.5, n: 0 },
    ],
  },
  {
    id: 'jupiter_holst', title: 'Jupiter (theme)', composer: 'Gustav Holst',
    born: 1874, died: 1934, work: 'The Planets, Op. 32, IV. Jupiter', year: 1917,
    mood: 'regal', instrument: 'strings', rootMidi: 63, bpm: 76, reverb: 0.4,
    notes: [
      { t: 0, d: 1, n: 0 }, { t: 1, d: 1, n: 2 }, { t: 2, d: 1, n: 4 }, { t: 3, d: 2, n: 7 },
      { t: 5, d: 1, n: 9 }, { t: 6, d: 1, n: 7 }, { t: 7, d: 1, n: 5 }, { t: 8, d: 2, n: 4 },
    ],
  },
  {
    id: 'habanera', title: 'Habanera', composer: 'Georges Bizet',
    born: 1838, died: 1875, work: 'Carmen, Act I', year: 1875,
    mood: 'adventurous', instrument: 'clarinet', rootMidi: 74, bpm: 96, reverb: 0.3,
    notes: [
      { t: 0, d: 1, n: 0 }, { t: 1, d: 1, n: -1 }, { t: 2, d: 1, n: -2 }, { t: 3, d: 1, n: -3 },
      { t: 4, d: 1, n: -4 }, { t: 5, d: 2, n: -5 }, { t: 7, d: 0.5, n: -5 }, { t: 7.5, d: 0.5, n: 0, oct: 1 },
      { t: 8, d: 1.5, n: -5 },
    ],
  },
  {
    id: 'vivaldi_spring', title: 'Spring (La Primavera)', composer: 'Antonio Vivaldi',
    born: 1678, died: 1741, work: 'The Four Seasons, Concerto No. 1, 1st mvt', year: 1723,
    mood: 'adventurous', instrument: 'strings', rootMidi: 64, bpm: 126, reverb: 0.22,
    notes: [
      { t: 0.0, d: 0.5, n: 0 }, { t: 0.5, d: 0.5, n: 0 }, { t: 1.0, d: 0.5, n: 0 }, { t: 1.5, d: 0.5, n: 4 },
      { t: 2.0, d: 0.5, n: 7 }, { t: 2.5, d: 1, n: 12 }, { t: 3.5, d: 0.5, n: 7 }, { t: 4.0, d: 0.5, n: 4 },
      { t: 4.5, d: 1.5, n: 0 },
    ],
  },
  {
    id: 'minuet_in_g', title: 'Minuet in G', composer: 'Christian Petzold (attr. J.S. Bach)',
    born: 1677, died: 1733, work: 'Notebook for Anna Magdalena Bach, BWV Anh. 114', year: 1725,
    mood: 'playful', instrument: 'harp', rootMidi: 67, bpm: 108, reverb: 0.3,
    notes: [
      { t: 0, d: 1, n: 0 }, { t: 1, d: 1, n: 4 }, { t: 2, d: 1, n: 2 }, { t: 3, d: 1, n: 0 },
      { t: 4, d: 1, n: -5 }, { t: 5, d: 1, n: 0 }, { t: 6, d: 0.5, n: 2 }, { t: 6.5, d: 0.5, n: 4 },
      { t: 7, d: 2, n: 0 },
    ],
  },
  {
    id: 'moonlight_sonata', title: 'Moonlight Sonata (opening)', composer: 'Ludwig van Beethoven',
    born: 1770, died: 1827, work: 'Piano Sonata No. 14, Op. 27 No. 2, 1st mvt', year: 1801,
    mood: 'cozy', instrument: 'piano', rootMidi: 49, bpm: 54, reverb: 0.44,
    notes: (() => {
      const cell = [0, 7, 12]; const out = []
      for (let bar = 0; bar < 8; bar++) for (let i = 0; i < 3; i++) out.push({ t: bar + i / 3, d: 0.32, n: cell[i] })
      return out
    })(),
  },
  {
    id: 'romance_de_amor', title: 'Romance de Amor (Spanish Romance)', composer: 'Anonymous',
    born: null, died: null, work: 'Romance Anónimo — traditional 19th-century guitar piece', year: 1850,
    mood: 'cozy', instrument: 'guitar', rootMidi: 64, bpm: 88, reverb: 0.38,
    notes: [
      { t: 0, d: 1, n: 12 }, { t: 1, d: 1, n: 7 }, { t: 2, d: 0.5, n: 8 }, { t: 2.5, d: 0.5, n: 7 },
      { t: 3, d: 1, n: 5 }, { t: 4, d: 1, n: 3 }, { t: 5, d: 1, n: 2 }, { t: 6, d: 2, n: 0 },
    ],
  },
  {
    id: 'nocturne_op9_no2', title: 'Nocturne Op. 9 No. 2', composer: 'Frédéric Chopin',
    born: 1810, died: 1849, work: 'Nocturnes, Op. 9', year: 1832,
    mood: 'cozy', instrument: 'piano', rootMidi: 63, bpm: 66, reverb: 0.44,
    notes: [
      { t: 0, d: 0.75, n: 7 }, { t: 0.75, d: 1.5, n: 12 }, { t: 2.25, d: 0.75, n: 11 }, { t: 3.0, d: 0.75, n: 9 },
      { t: 3.75, d: 1.5, n: 7 }, { t: 5.25, d: 0.75, n: 5 }, { t: 6.0, d: 0.75, n: 4 }, { t: 6.75, d: 2.25, n: 2 },
    ],
  },
  {
    id: 'zarathustra', title: 'Also sprach Zarathustra (fanfare)', composer: 'Richard Strauss',
    born: 1864, died: 1949, work: 'Op. 30, opening', year: 1896,
    mood: 'energetic', instrument: 'brass', rootMidi: 48, bpm: 60, reverb: 0.4,
    notes: [
      { t: 0, d: 2, n: 0 }, { t: 2, d: 2, n: 7 }, { t: 4, d: 2, n: 12 },
      { t: 6, d: 1, n: 16 }, { t: 7, d: 1, n: 19 }, { t: 8, d: 3, n: 12, oct: 1 },
    ],
  },
];

export const classicalPiece = (id) => CLASSICAL_PIECES.find((p) => p.id === id) || null;

/** The default mood-matched world → anthem mapping. Fully overridable in HQ. */
export const REALM_ANTHEM = {
  farm: 'clair_de_lune',
  bloomwall_pass: 'vivaldi_spring',
  emberring_arena: 'ride_of_the_valkyries',
  fountain_festival: 'radetzky_march',
  lashira_keep: 'jupiter_holst',
  hearthrush_kitchen: 'fur_elise',
};

/** Schedule a piece's notes through the SAME synthesized instruments the
 *  generative engine uses — zero new DSP, zero files. Fires `onNote(role,
 *  midi)` near each note's real playback time (not at call-time) so a
 *  visualizer driven by note events stays in sync. Returns the piece's
 *  total duration in seconds. */
export function scheduleClassicalPiece(ctx, master, revBus, piece, opts = {}) {
  const spb = 60 / (opts.bpm || piece.bpm);
  const t0 = opts.startAt ?? ctx.currentTime + 0.06;
  const gain = opts.gain ?? 0.75;
  const bassGain = opts.bassGain ?? 0.55;
  let maxEnd = 0;
  const schedule = (notes, role, instId, gainMul) => {
    if (!notes || !instId) return;
    const def = INSTRUMENTS[instId];
    if (!def) return;
    for (const nte of notes) {
      const midi = piece.rootMidi + nte.n + 12 * (nte.oct || 0);
      const t = t0 + nte.t * spb;
      const dur = nte.d * spb * 0.94;
      def.fn(ctx, master, revBus, { midi, t, dur, gain: gain * gainMul, pan: 0, rev: piece.reverb ?? 0.35 });
      if (opts.onNote) {
        const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => opts.onNote(role, midi), delayMs);
      }
      maxEnd = Math.max(maxEnd, nte.t * spb + dur);
    }
  };
  schedule(piece.notes, 'lead', piece.instrument, 1);
  schedule(piece.bass, 'bass', piece.bassInstrument, bassGain);
  return { duration: maxEnd + 0.4 };
}
