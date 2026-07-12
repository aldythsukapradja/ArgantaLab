/**
 * COMPOSER — the Music Studio's AI seam (the Director/Copilot sibling).
 * Prompt → a theme patch (key/scale/tempo/progression/instruments/levels),
 * validated so a small free model can't break the transport. The offline
 * fallback composes deterministically from mood keywords, so the chat always
 * answers — same contract as the Video Director and the Post Copilot.
 */
import { NOTE_BASE, SCALES, CHORD_PROGS, INSTRUMENTS, KITS, ROLES } from '@arganta/audio'

type Theme = any

const ROOTS = Object.keys(NOTE_BASE)
const SCALE_IDS = Object.keys(SCALES)
const PROG_IDS = Object.keys(CHORD_PROGS)
const INST_IDS = Object.keys(INSTRUMENTS)
const KIT_IDS = Object.keys(KITS)

export const MUSIC_SCHEMA = {
  type: 'object',
  properties: {
    root: { type: 'string', enum: ROOTS },
    scale: { type: 'string', enum: SCALE_IDS },
    bpm: { type: 'number' },
    prog: { type: 'string', enum: PROG_IDS },
    swing: { type: 'number' },
    density: { type: 'number' },
    reverb: { type: 'number' },
    mood: { type: 'string' },
    roles: {
      type: 'object',
      properties: Object.fromEntries((ROLES as string[]).map(r => [r, {
        type: 'object',
        properties: r === 'drums'
          ? { kit: { type: 'string', enum: KIT_IDS }, level: { type: 'number' }, on: { type: 'boolean' } }
          : { inst: { type: 'string', enum: INST_IDS }, level: { type: 'number' }, on: { type: 'boolean' } },
      }])),
    },
  },
}

export function composerMessages(prompt: string) {
  const sys = `You are a game-music composer configuring a generative engine. Output ONLY a JSON object (no prose, no markdown):
{"root":"${ROOTS.join('|')}","scale":"${SCALE_IDS.join('|')}","bpm":50-160,"prog":"${PROG_IDS.join('|')}",
 "swing":0-0.5,"density":0.2-1,"reverb":0-0.8,"mood":"one word",
 "roles":{"pad":{"inst":"...","level":0-1,"on":true},"harmony":{...},"bass":{...},"lead":{...},"arp":{...},"drums":{"kit":"${KIT_IDS.join('|')}","level":0-1,"on":true},"sparkle":{...}}}
Instruments: ${INST_IDS.join(', ')}. Match the mood: calm = slow pentatonic + mallets + high reverb; battle = fast Mixolydian/Minor + saws + dj kit; regal = minor + choir/horn + orchestral kit. Only change what the mood demands.`
  const example = {
    root: 'D', scale: 'Dorian', bpm: 92, prog: 'vi–IV–I–V', swing: 0.08, density: 0.66, reverb: 0.35, mood: 'mysterious',
    roles: {
      pad: { inst: 'glassPad', level: 0.5, on: true }, harmony: { inst: 'strings', level: 0.35, on: true },
      bass: { inst: 'subBass', level: 0.6, on: true }, lead: { inst: 'flute', level: 0.5, on: true },
      arp: { inst: 'celesta', level: 0.45, on: true }, drums: { kit: 'soft', level: 0.35, on: true },
      sparkle: { inst: 'bells', level: 0.2, on: true },
    },
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: 'a mysterious moonlit forest, gentle but uneasy' },
    { role: 'assistant', content: JSON.stringify(example) },
    { role: 'user', content: prompt },
  ]
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const oneOf = <T,>(v: T, list: T[], def: T): T => (list.includes(v) ? v : def)

/** Never-throws: model output → a valid theme patch merged over the base. */
export function coerceTheme(raw: unknown, base: Theme): Theme {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const t = JSON.parse(JSON.stringify(base))
  t.root = oneOf(o.root, ROOTS, t.root)
  t.scale = oneOf(o.scale, SCALE_IDS, t.scale)
  t.prog = oneOf(o.prog, PROG_IDS, t.prog)
  if (Number.isFinite(+o.bpm)) t.bpm = Math.round(clamp(+o.bpm, 50, 160))
  if (Number.isFinite(+o.swing)) t.swing = clamp(+o.swing, 0, 0.5)
  if (Number.isFinite(+o.density)) t.density = clamp(+o.density, 0.2, 1)
  if (Number.isFinite(+o.reverb)) t.reverb = clamp(+o.reverb, 0, 0.8)
  if (typeof o.mood === 'string' && o.mood.trim()) t.mood = o.mood.trim().slice(0, 20)
  const roles = o.roles && typeof o.roles === 'object' ? o.roles : {}
  for (const r of ROLES as string[]) {
    const src = roles[r]
    if (!src || typeof src !== 'object') continue
    const dst = t.roles[r]
    if (r === 'drums') { if (KIT_IDS.includes(src.kit)) dst.kit = src.kit }
    else if (INST_IDS.includes(src.inst)) dst.inst = src.inst
    if (Number.isFinite(+src.level)) dst.level = clamp(+src.level, 0, 1)
    if (typeof src.on === 'boolean') dst.on = src.on
  }
  return t
}

// ── deterministic offline composer ────────────────────────────
interface Mood {
  match: RegExp
  mood: string
  scale: string; prog: string; bpm: [number, number]
  swing: number; density: number; reverb: number
  roles: Record<string, any>
}
const MOODS: Mood[] = [
  { match: /calm|cozy|gentle|soft|rain|sleep|lull|warm|home|kitchen/i, mood: 'Cozy',
    scale: 'Major pentatonic', prog: 'I–V–vi–IV', bpm: [72, 88], swing: 0.12, density: 0.55, reverb: 0.38,
    roles: { pad: { inst: 'warmPad', level: 0.5 }, harmony: { inst: 'strings', level: 0.3 }, bass: { inst: 'upright', level: 0.6 }, lead: { inst: 'marimba', level: 0.65 }, arp: { inst: 'harp', level: 0.4 }, drums: { kit: 'soft', level: 0.35 }, sparkle: { inst: 'musicBox', level: 0.3 } } },
  { match: /epic|battle|boss|fight|arena|energetic|drive|intense|race/i, mood: 'Energetic',
    scale: 'Mixolydian', prog: 'I–IV', bpm: [118, 134], swing: 0, density: 0.9, reverb: 0.14,
    roles: { pad: { inst: 'glassPad', level: 0.3 }, harmony: { inst: 'brass', level: 0.5 }, bass: { inst: 'sawBass', level: 0.8 }, lead: { inst: 'superSaw', level: 0.55 }, arp: { inst: 'squareLead', level: 0.6 }, drums: { kit: 'dj', level: 0.7 }, sparkle: { inst: 'bells', level: 0.1, on: false } } },
  { match: /myster|night|moon|forest|dark|cave|secret|uneasy|spooky/i, mood: 'Mysterious',
    scale: 'Harmonic minor', prog: 'i–VI–III–VII', bpm: [78, 94], swing: 0.06, density: 0.5, reverb: 0.5,
    roles: { pad: { inst: 'glassPad', level: 0.55 }, harmony: { inst: 'choir', level: 0.4 }, bass: { inst: 'subBass', level: 0.6 }, lead: { inst: 'flute', level: 0.45 }, arp: { inst: 'celesta', level: 0.45 }, drums: { kit: 'orchestral', level: 0.3 }, sparkle: { inst: 'bells', level: 0.25 } } },
  { match: /happy|festive|party|festival|celebrat|joy|market|fair|carnival/i, mood: 'Festive',
    scale: 'Major', prog: 'I–vi–IV–V', bpm: [106, 120], swing: 0.1, density: 0.82, reverb: 0.22,
    roles: { pad: { inst: 'warmPad', level: 0.4 }, harmony: { inst: 'strings', level: 0.4 }, bass: { inst: 'upright', level: 0.6 }, lead: { inst: 'marimba', level: 0.8 }, arp: { inst: 'guitar', level: 0.5 }, drums: { kit: 'folk', level: 0.55 }, sparkle: { inst: 'glockenspiel', level: 0.45 } } },
  { match: /sad|melanchol|farewell|rainy|longing|nostalg|goodbye/i, mood: 'Wistful',
    scale: 'Dorian', prog: 'ii–V–I', bpm: [62, 76], swing: 0.05, density: 0.4, reverb: 0.5,
    roles: { pad: { inst: 'warmPad', level: 0.55 }, harmony: { inst: 'strings', level: 0.5 }, bass: { inst: 'upright', level: 0.5 }, lead: { inst: 'piano', level: 0.55 }, arp: { inst: 'harp', level: 0.3 }, drums: { kit: 'none', level: 0.2, on: false }, sparkle: { inst: 'celesta', level: 0.2 } } },
  { match: /regal|castle|keep|royal|throne|cathedral|ancient|hall/i, mood: 'Regal',
    scale: 'Minor', prog: 'i–VI–III–VII', bpm: [66, 78], swing: 0.06, density: 0.45, reverb: 0.5,
    roles: { pad: { inst: 'choir', level: 0.6 }, harmony: { inst: 'strings', level: 0.45 }, bass: { inst: 'upright', level: 0.55 }, lead: { inst: 'horn', level: 0.4 }, arp: { inst: 'harp', level: 0.35 }, drums: { kit: 'orchestral', level: 0.4 }, sparkle: { inst: 'musicBox', level: 0.35 } } },
  { match: /adventur|journey|travel|explore|trail|pass|mountain|quest/i, mood: 'Adventurous',
    scale: 'Dorian', prog: 'vi–IV–I–V', bpm: [98, 112], swing: 0.04, density: 0.75, reverb: 0.22,
    roles: { pad: { inst: 'glassPad', level: 0.45 }, harmony: { inst: 'horn', level: 0.4 }, bass: { inst: 'upright', level: 0.7 }, lead: { inst: 'flute', level: 0.5 }, arp: { inst: 'pizzStrings', level: 0.55 }, drums: { kit: 'folk', level: 0.55 }, sparkle: { inst: 'bells', level: 0.15 } } },
]

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h) }

/** Deterministic prompt → theme (same prompt always composes the same theme). */
export function localCompose(prompt: string, base: Theme): Theme {
  const m = MOODS.find(x => x.match.test(prompt)) || MOODS[0]
  const h = hash(prompt.toLowerCase().trim())
  const t = JSON.parse(JSON.stringify(base))
  t.mood = m.mood
  t.root = ROOTS[h % ROOTS.length]
  t.scale = m.scale
  t.prog = m.prog
  t.bpm = m.bpm[0] + (h % (m.bpm[1] - m.bpm[0] + 1))
  t.swing = m.swing
  t.density = m.density
  t.reverb = m.reverb
  for (const r of ROLES as string[]) {
    const src = m.roles[r]
    if (!src) continue
    t.roles[r] = { ...t.roles[r], on: src.on !== false, ...src }
  }
  return t
}
