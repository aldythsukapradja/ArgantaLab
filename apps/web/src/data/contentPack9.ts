// ============================================================
//  ARGANTALAB · CONTENT PACK 9 — EXTREMES + APPLIED + READING
//  Fills the thinner bands (Tiny, Champion, Legend), adds more reading
//  comprehension and real-world word problems, and broadens every world. All
//  validated by data/content.test.ts. Self-contained; facts verified.
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
  ({ id: `cp9_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const tp = (w: string, s: string, st: string, d: number, p: string, ans: string, numeric = false, e?: string) => base(w, s, 'type', st, d, p, { answer: ans, numeric, accept: [ans] }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)

// ─── TINY band (lots): counting, colours, shapes, sounds, animals, kindness ───
const TINY: PackItem[] = [
  mc('NUM', 'arith', 'tiny', 1, 'Count the stars ⭐⭐⭐⭐', ['3', '4', '5', '6'], 1),
  mc('NUM', 'arith', 'tiny', 1, 'What comes before 5?', ['3', '4', '6', '7'], 1),
  tp('NUM', 'arith', 'tiny', 1, '1 + 1 = ?', '2', true),
  tp('NUM', 'arith', 'tiny', 1, '3 + 2 = ?', '5', true),
  mc('NUM', 'geometry', 'tiny', 1, 'Which is a square?', ['●', '■', '▲', '★'], 1),
  mc('NUM', 'geometry', 'tiny', 1, 'How many corners does a square have?', ['3', '4', '5', '0'], 1),
  sq('NUM', 'placevalue', 'tiny', 1, 'Order biggest last.', ['1', '3', '5', '7', '9']),
  mc('WRD', 'phonics', 'tiny', 1, 'Which rhymes with DOG?', ['cat', 'log', 'sun', 'pen'], 1),
  mc('WRD', 'phonics', 'tiny', 1, 'First letter of "moon"?', ['n', 'm', 'o', 'w'], 1),
  mc('WRD', 'vocab', 'tiny', 1, 'Which is a colour?', ['jump', 'blue', 'loud', 'three'], 1),
  mc('WRD', 'vocab', 'tiny', 1, 'A baby sheep is a…', ['cub', 'lamb', 'kid', 'foal'], 1),
  mc('WON', 'biology', 'tiny', 1, 'Which lives in water?', ['lion', 'fish', 'bird', 'cow'], 1),
  mc('WON', 'biology', 'tiny', 1, 'We smell with our…', ['eyes', 'nose', 'ears', 'hands'], 1),
  mc('WON', 'earth', 'tiny', 1, 'The Moon comes out at…', ['noon', 'night', 'breakfast', 'lunch'], 1),
  mc('LOG', 'logic', 'tiny', 1, 'Which is biggest?', ['🐜', '🐕', '🐘', '🐈'], 2),
  mc('LOG', 'logic', 'tiny', 1, 'Same or different: 🍎🍎', ['same', 'different', 'none', 'three'], 0),
  mc('WLD', 'geography', 'tiny', 1, 'The Sun gives us…', ['rain', 'light', 'snow', 'ice'], 1),
  mc('LIF', 'kindness', 'tiny', 1, 'When you want a turn, you should…', ['grab it', 'ask nicely', 'shout', 'cry'], 1),
  mc('LIF', 'habits', 'tiny', 1, 'Before bed we should…', ['eat candy', 'brush teeth', 'run fast', 'shout'], 1),
]

// ─── EXPLORER/STARTER reading + applied (the busy middle) ───
const MID: PackItem[] = [
  mc('WRD', 'reading', 'starter', 2, '"Ben put on his boots and grabbed a bucket. He ran to the beach." Where is Ben going?', ['school', 'the beach', 'bed', 'the shop'], 1),
  mc('WRD', 'reading', 'explorer', 3, '"The volcano rumbled, then ash filled the sky." This is mostly about a…', ['party', 'storm', 'volcano erupting', 'football game'], 2),
  mc('WRD', 'reading', 'explorer', 3, '"Despite the rain, the team kept playing." This shows the team was…', ['lazy', 'determined', 'scared', 'asleep'], 1),
  mc('NUM', 'arith', 'explorer', 2, 'A box holds 6 eggs. How many eggs in 4 boxes?', ['10', '18', '24', '30'], 2),
  mc('NUM', 'money', 'explorer', 3, 'A pencil is 30¢. How many can you buy with $1.20?', ['2', '3', '4', '5'], 2, '120÷30=4.'),
  mc('NUM', 'measure', 'explorer', 3, 'A film is 90 minutes. That is… hours and minutes', ['1h 20m', '1h 30m', '2h', '1h 15m'], 1),
  mc('NUM', 'arith', 'builder', 3, 'A bus holds 45 people. How many buses for 180 people?', ['3', '4', '5', '6'], 1, '180÷45=4.'),
  mc('WON', 'biology', 'explorer', 3, 'A caterpillar becomes a…', ['frog', 'butterfly', 'bird', 'bee'], 1),
  sq('WON', 'biology', 'explorer', 3, 'Order the butterfly life cycle.', ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly']),
  mc('WLD', 'geography', 'explorer', 3, 'A place that gets very little rain is a…', ['rainforest', 'desert', 'swamp', 'lake'], 1),
  so('WLD', 'geography', 'explorer', 3, 'Hot or cold place?', ['Hot', 'Cold'], [
    { text: 'Sahara', bucket: 0 }, { text: 'Antarctica', bucket: 1 }, { text: 'Arctic', bucket: 1 }, { text: 'Desert', bucket: 0 }]),
  mc('LOG', 'code', 'explorer', 3, 'A computer follows steps in… order', ['random', 'exact', 'no', 'backwards only'], 1),
]

// ─── CHAMPION + LEGEND (advanced) ───
const ADV: PackItem[] = [
  mc('NUM', 'arith', 'champion', 4, 'What is 15% of 200?', ['15', '20', '30', '45'], 2),
  mc('NUM', 'arith', 'champion', 4, 'Solve: 3(x − 2) = 9, x = ?', ['3', '5', '6', '9'], 1, 'x−2=3, x=5.'),
  mc('NUM', 'geometry', 'champion', 4, 'A right angle is…', ['45°', '90°', '180°', '360°'], 1),
  mc('NUM', 'fractions', 'champion', 4, '1/2 + 1/4 = ?', ['2/6', '3/4', '1/6', '2/4'], 1),
  mc('NUM', 'arith', 'legend', 5, 'The next prime after 13 is…', ['14', '15', '16', '17'], 3),
  mc('NUM', 'fractions', 'legend', 5, 'A bag has 3 red and 7 blue marbles. P(red)?', ['3/7', '3/10', '7/10', '1/3'], 1),
  mc('NUM', 'arith', 'legend', 5, '√144 = ?', ['11', '12', '14', '24'], 1),
  mc('WON', 'chemistry', 'champion', 4, 'Acids have a pH that is…', ['above 7', 'exactly 7', 'below 7', 'zero only'], 2),
  mc('WON', 'physics', 'champion', 4, 'Sound cannot travel through…', ['water', 'air', 'a vacuum', 'metal'], 2),
  mc('WON', 'biology', 'legend', 5, 'The process cells use to divide into two is…', ['osmosis', 'mitosis', 'digestion', 'respiration'], 1),
  mc('WON', 'physics', 'legend', 5, 'The speed of light is about…', ['300 km/s', '3,000 km/s', '300,000 km/s', '30 km/s'], 2),
  mc('WLD', 'history', 'champion', 4, 'The ancient Olympics began in…', ['Rome', 'Greece', 'Egypt', 'Persia'], 1),
  mc('WLD', 'economics', 'champion', 4, 'Money a government collects from people is…', ['profit', 'tax', 'tip', 'loan'], 1),
  mc('WLD', 'geography', 'legend', 5, 'The deepest ocean trench is the…', ['Mariana Trench', 'Puerto Rico Trench', 'Java Trench', 'Tonga Trench'], 0),
  mc('WLD', 'economics', 'legend', 5, 'When a currency buys less than before, it has…', ['appreciated', 'depreciated', 'doubled', 'frozen'], 1),
  mc('WRD', 'vocab', 'legend', 5, '"Ubiquitous" means…', ['rare', 'everywhere', 'tiny', 'ancient'], 1),
  mc('WRD', 'grammar', 'champion', 4, 'A semicolon (;) joins…', ['two related sentences', 'a list only', 'nothing', 'two words'], 0),
  mc('LOG', 'data', 'champion', 4, '16 in binary is…', ['1000', '10000', '1100', '1111'], 1, '2⁴ = 10000₂.'),
  mc('LOG', 'logic', 'legend', 5, 'A statement that is always true is a…', ['contradiction', 'tautology', 'paradox', 'variable'], 1),
  mc('LOG', 'ai', 'legend', 5, 'A model that memorises training data but fails on new data is…', ['underfitting', 'overfitting', 'training', 'scaling'], 1),
]

export const CONTENT_PACK_9: PackItem[] = [...TINY, ...MID, ...ADV]
