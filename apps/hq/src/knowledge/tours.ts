// WS3 — Auto tours. Tour A (Company anatomy) is the first vertical slice: it
// walks the 8-node spine, spotlighting each node's neighbourhood, then returns
// deterministically to the overview (the "CEO Orb" resting frame).
//
// A tour is a pure list of beats; the surface plays them on a timer (a stand-in
// for the WS1 audio clock) and the CameraRig eases to each focus. No audio is
// read here — WS3 only ever reacts to a focus target.

import { SPINE } from './spine'

export interface TourBeat {
  focus: string | null       // node id to frame (null = overview)
  caption: string
  hold: number               // ms to hold this beat (mock audio-clip length)
}

export interface Tour {
  id: 'A' | 'B' | 'C' | 'D'
  name: string
  beats: TourBeat[]
}

export const TOUR_A: Tour = {
  id: 'A',
  name: 'Company anatomy',
  beats: [
    { focus: null, caption: 'Circle HQ — the whole company as one living graph.', hold: 3200 },
    ...SPINE.map((s) => ({
      focus: s.key,
      caption: `${s.label} — ${s.caption}`,
      hold: 3400,
    })),
    { focus: null, caption: 'Founder → Products. One spine, all grounded in real notes.', hold: 3600 },
  ],
}

export const TOURS: Tour[] = [TOUR_A]
