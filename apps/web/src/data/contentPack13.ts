// ============================================================
//  ARGANTALAB · CONTENT PACK 13 — INTERACTION DIVERSITY
//  Deliberately heavy on the non-mcq formats (match / sort / sequence /
//  multi-select / cloze) so practice feels varied and hands-on, across all six
//  worlds and a tiny → legend spread. Validated by data/content.test.ts.
// ============================================================
type IKey =
  | 'mcq' | 'multi' | 'type' | 'speed' | 'bank' | 'cloze'
  | 'match' | 'sort' | 'seq' | 'fix' | 'numline' | 'slider'
  | 'listen' | 'label' | 'pte' | 'code' | 'map' | 'party'
interface PackItem {
  id: string; world: string; skill: string; type: IKey; stage: string
  difficulty: number; prompt: string; payload: Record<string, unknown>
  hint?: string; explanation?: string; xp?: number; diamonds?: number
}
let _c = 0
const base = (world: string, skill: string, type: IKey, stage: string, difficulty: number, prompt: string, payload: Record<string, unknown>, expl?: string): PackItem =>
  ({ id: `cp13_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mt = (w: string, s: string, st: string, d: number, p: string, pairs: [string, string][], e?: string) => base(w, s, 'match', st, d, p, { pairs }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const ms = (w: string, s: string, st: string, d: number, p: string, choices: string[], answers: number[], e?: string) => base(w, s, 'multi', st, d, p, { choices, answers }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)

const ITEMS: PackItem[] = [
  // ── matching ──
  mt('NUM', 'fractions', 'explorer', 3, 'Match fraction → decimal.', [['1/2', '0.5'], ['1/4', '0.25'], ['3/4', '0.75'], ['1/10', '0.1']]),
  mt('NUM', 'geometry', 'explorer', 3, 'Match shape → number of sides.', [['Triangle', '3'], ['Square', '4'], ['Pentagon', '5'], ['Hexagon', '6']]),
  mt('NUM', 'measure', 'builder', 3, 'Match unit → what it measures.', [['Metre', 'Length'], ['Gram', 'Mass'], ['Litre', 'Volume'], ['Second', 'Time']]),
  mt('WRD', 'vocab', 'explorer', 2, 'Match word → meaning.', [['Huge', 'Very big'], ['Tiny', 'Very small'], ['Rapid', 'Very fast'], ['Silent', 'No sound']]),
  mt('WON', 'biology', 'explorer', 3, 'Match animal → group.', [['Frog', 'Amphibian'], ['Eagle', 'Bird'], ['Shark', 'Fish'], ['Bat', 'Mammal']]),
  mt('WON', 'earth', 'builder', 3, 'Match planet → fact.', [['Mercury', 'Closest to Sun'], ['Mars', 'The Red Planet'], ['Jupiter', 'The biggest'], ['Saturn', 'Famous rings']]),
  mt('WLD', 'geography', 'explorer', 3, 'Match country → continent.', [['Egypt', 'Africa'], ['Japan', 'Asia'], ['Brazil', 'South America'], ['France', 'Europe']]),
  mt('WLD', 'economics', 'builder', 3, 'Match term → meaning.', [['Income', 'Money you earn'], ['Savings', 'Money you keep'], ['Budget', 'A spending plan'], ['Loan', 'Money you borrow']]),
  mt('LOG', 'code', 'builder', 3, 'Match coding word → meaning.', [['Loop', 'Repeat'], ['Variable', 'Stores a value'], ['Bug', 'A mistake'], ['Function', 'Reusable steps']]),
  mt('LIF', 'kindness', 'explorer', 2, 'Match feeling → face.', [['Happy', '😊'], ['Sad', '😢'], ['Angry', '😠'], ['Surprised', '😲']]),
  // ── sorting ──
  so('NUM', 'arith', 'starter', 2, 'Odd or even?', ['Odd', 'Even'], [{ text: '3', bucket: 0 }, { text: '8', bucket: 1 }, { text: '5', bucket: 0 }, { text: '10', bucket: 1 }]),
  so('WRD', 'grammar', 'explorer', 3, 'Noun, verb or adjective?', ['Noun', 'Verb', 'Adjective'], [
    { text: 'cat', bucket: 0 }, { text: 'run', bucket: 1 }, { text: 'shiny', bucket: 2 }, { text: 'jump', bucket: 1 }, { text: 'house', bucket: 0 }]),
  so('WON', 'chemistry', 'explorer', 3, 'Solid, liquid or gas?', ['Solid', 'Liquid', 'Gas'], [
    { text: 'Brick', bucket: 0 }, { text: 'Juice', bucket: 1 }, { text: 'Air', bucket: 2 }, { text: 'Wood', bucket: 0 }]),
  so('WON', 'biology', 'builder', 3, 'Living or non-living?', ['Living', 'Non-living'], [
    { text: 'Tree', bucket: 0 }, { text: 'Robot', bucket: 1 }, { text: 'Bird', bucket: 0 }, { text: 'Stone', bucket: 1 }]),
  so('WLD', 'geography', 'explorer', 3, 'Continent or ocean?', ['Continent', 'Ocean'], [
    { text: 'Asia', bucket: 0 }, { text: 'Pacific', bucket: 1 }, { text: 'Europe', bucket: 0 }, { text: 'Atlantic', bucket: 1 }]),
  so('LIF', 'habits', 'starter', 2, 'Healthy or treat?', ['Healthy', 'Treat'], [
    { text: 'Apple', bucket: 0 }, { text: 'Candy', bucket: 1 }, { text: 'Carrot', bucket: 0 }, { text: 'Cake', bucket: 1 }]),
  // ── sequences ──
  sq('NUM', 'placevalue', 'starter', 2, 'Order smallest → largest.', ['12', '21', '102', '120']),
  sq('NUM', 'placevalue', 'builder', 3, 'Order smallest → largest.', ['0.3', '0.33', '3.0', '30']),
  sq('WON', 'earth', 'explorer', 3, 'Order the water cycle.', ['Evaporation', 'Condensation', 'Precipitation', 'Collection']),
  sq('WON', 'biology', 'builder', 3, 'Order a plant’s growth.', ['Seed', 'Sprout', 'Seedling', 'Plant']),
  sq('WLD', 'history', 'builder', 3, 'Order earliest → latest transport.', ['Walking', 'Horse', 'Train', 'Aeroplane']),
  sq('LOG', 'code', 'explorer', 3, 'Order steps to brush teeth.', ['Wet brush', 'Add toothpaste', 'Brush teeth', 'Rinse']),
  sq('WRD', 'reading', 'builder', 3, 'Order a story’s parts.', ['Beginning', 'Build-up', 'Climax', 'Ending']),
  // ── multi-select ──
  ms('NUM', 'arith', 'explorer', 3, 'Pick ALL even numbers.', ['3', '4', '6', '9'], [1, 2]),
  ms('WON', 'biology', 'explorer', 3, 'Pick ALL mammals.', ['Dog', 'Snake', 'Whale', 'Frog'], [0, 2]),
  ms('WRD', 'grammar', 'explorer', 3, 'Pick ALL the verbs.', ['run', 'happy', 'sing', 'tree'], [0, 2]),
  ms('WLD', 'geography', 'builder', 3, 'Pick ALL oceans.', ['Pacific', 'Sahara', 'Atlantic', 'Andes'], [0, 2]),
  ms('NUM', 'geometry', 'builder', 3, 'Pick ALL 3D shapes.', ['Cube', 'Square', 'Sphere', 'Triangle'], [0, 2]),
  ms('LIF', 'habits', 'explorer', 2, 'Pick ALL healthy habits.', ['Brush teeth', 'Skip sleep', 'Drink water', 'Eat only candy'], [0, 2]),
  // ── cloze ──
  cz('WON', 'biology', 'explorer', 3, 'Plants need sunlight, water and ', ' to grow.', ['sugar', 'air', 'plastic'], 'air'),
  cz('WLD', 'geography', 'explorer', 3, 'The biggest hot desert is the ', '.', ['Sahara', 'Amazon', 'Pacific'], 'Sahara'),
  cz('NUM', 'time', 'starter', 2, 'There are sixty minutes in one ', '.', ['day', 'hour', 'week'], 'hour'),
]

export const CONTENT_PACK_13: PackItem[] = ITEMS
