// ============================================================
//  ARGANTALAB · CONTENT PACK 12 — STEM & WORLD DEPTH
//  Heavy on Number, Wonder (science), World (geo/history/economics) and Logic,
//  graded tiny → legend. Lots of applied reasoning + verified facts. Validated by
//  data/content.test.ts.
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
  ({ id: `cp12_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const tp = (w: string, s: string, st: string, d: number, p: string, ans: string, numeric = false, e?: string) => base(w, s, 'type', st, d, p, { answer: ans, numeric, accept: [ans] }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)

const NUM: PackItem[] = [
  tp('NUM', 'arith', 'tiny', 1, '5 + 5 = ?', '10', true),
  tp('NUM', 'arith', 'starter', 1, '9 + 9 = ?', '18', true),
  tp('NUM', 'arith', 'starter', 2, '64 + 28 = ?', '92', true),
  tp('NUM', 'times', 'explorer', 2, '4 × 9 = ?', '36', true),
  tp('NUM', 'times', 'explorer', 2, '7 × 7 = ?', '49', true),
  mc('NUM', 'fractions', 'explorer', 3, '2/5 + 1/5 = ?', ['3/10', '3/5', '2/25', '1/5'], 1),
  mc('NUM', 'measure', 'explorer', 3, 'A rectangle is 8 cm by 3 cm. Its area is…', ['11 cm²', '22 cm²', '24 cm²', '16 cm²'], 2),
  mc('NUM', 'time', 'explorer', 2, 'How many seconds in a minute?', ['30', '60', '100', '120'], 1),
  mc('NUM', 'geometry', 'builder', 3, 'A polygon with 5 sides is a…', ['hexagon', 'pentagon', 'octagon', 'quad'], 1),
  mc('NUM', 'geometry', 'builder', 3, 'A triangle with all sides equal is…', ['scalene', 'isosceles', 'equilateral', 'right'], 2),
  mc('NUM', 'arith', 'builder', 4, 'Which is divisible by 3?', ['22', '34', '51', '40'], 2, '5+1=6, divisible by 3.'),
  mc('NUM', 'fractions', 'champion', 4, '3/4 as a decimal is…', ['0.34', '0.75', '0.43', '0.7'], 1),
  mc('NUM', 'arith', 'champion', 4, 'A shirt is $40 with 25% off. New price?', ['$25', '$30', '$32', '$35'], 1, '40−10=30.'),
  mc('NUM', 'arith', 'legend', 5, 'The mean of 10, 20, 30, 40 is…', ['20', '25', '30', '100'], 1),
  mc('NUM', 'geometry', 'legend', 5, 'By Pythagoras, a 3-4-? right triangle has hypotenuse…', ['5', '6', '7', '12'], 0, '3²+4²=5².'),
]

const WON: PackItem[] = [
  mc('WON', 'biology', 'tiny', 1, 'A frog starts life as a…', ['puppy', 'tadpole', 'chick', 'cub'], 1),
  mc('WON', 'biology', 'starter', 2, 'Which is NOT a sense?', ['sight', 'smell', 'flying', 'taste'], 2),
  mc('WON', 'earth', 'starter', 2, 'Rain, snow and hail are types of…', ['wind', 'precipitation', 'cloud', 'soil'], 1),
  mc('WON', 'chemistry', 'explorer', 3, 'Which can dissolve in water?', ['oil', 'sand', 'salt', 'plastic'], 2),
  mc('WON', 'physics', 'explorer', 3, 'A magnet attracts…', ['wood', 'iron', 'glass', 'paper'], 1),
  so('WON', 'biology', 'explorer', 3, 'Herbivore or carnivore?', ['Herbivore', 'Carnivore'], [
    { text: 'Cow', bucket: 0 }, { text: 'Lion', bucket: 1 }, { text: 'Rabbit', bucket: 0 }, { text: 'Wolf', bucket: 1 }]),
  mc('WON', 'earth', 'builder', 3, 'The Sun is a…', ['planet', 'star', 'moon', 'comet'], 1),
  mc('WON', 'biology', 'builder', 3, 'Green colour in leaves comes from…', ['water', 'chlorophyll', 'sugar', 'oxygen'], 1),
  mc('WON', 'physics', 'builder', 4, 'Energy from moving things is… energy', ['potential', 'kinetic', 'chemical', 'nuclear'], 1),
  mc('WON', 'chemistry', 'champion', 4, 'The gas plants release in photosynthesis is…', ['carbon dioxide', 'oxygen', 'nitrogen', 'hydrogen'], 1),
  mc('WON', 'earth', 'champion', 4, 'Which layer of Earth is liquid?', ['inner core', 'outer core', 'crust', 'none'], 1),
  mc('WON', 'physics', 'legend', 5, 'Voltage is measured in…', ['amps', 'volts', 'watts', 'ohms'], 1),
  mc('WON', 'biology', 'legend', 5, 'DNA has a shape called a double…', ['circle', 'helix', 'square', 'line'], 1),
]

const WLD: PackItem[] = [
  mc('WLD', 'geography', 'tiny', 1, 'Snow is cold or hot?', ['cold', 'hot', 'warm', 'wet only'], 0),
  mc('WLD', 'geography', 'starter', 2, 'Which is a country?', ['Asia', 'Brazil', 'Pacific', 'Sahara'], 1),
  mc('WLD', 'geography', 'explorer', 2, 'Capital of the USA?', ['New York', 'Los Angeles', 'Washington, D.C.', 'Chicago'], 2),
  mc('WLD', 'geography', 'explorer', 3, 'The longest land animal migration is by the… ', ['lion', 'caribou', 'penguin', 'koala'], 1),
  mc('WLD', 'history', 'explorer', 3, 'A leader of ancient Egypt was called a…', ['king only', 'pharaoh', 'emperor', 'sultan'], 1),
  mc('WLD', 'history', 'builder', 3, 'The printing press was invented by…', ['Edison', 'Gutenberg', 'Newton', 'Da Vinci'], 1),
  mc('WLD', 'geography', 'builder', 3, 'Lines on a map that measure north-south position are lines of…', ['longitude', 'latitude', 'altitude', 'attitude'], 1),
  mc('WLD', 'economics', 'builder', 3, 'Putting money in a bank can earn you…', ['rent', 'interest', 'tax', 'a loan'], 1),
  mc('WLD', 'geography', 'champion', 4, 'Which country spans the most time zones?', ['USA', 'Russia', 'China', 'Brazil'], 1),
  mc('WLD', 'history', 'champion', 4, 'The first World War began in the year…', ['1900', '1914', '1939', '1945'], 1),
  mc('WLD', 'economics', 'legend', 5, 'When more money chases the same goods, you usually get…', ['deflation', 'inflation', 'recession', 'surplus'], 1),
  sq('WLD', 'history', 'champion', 4, 'Order these from earliest to latest.', ['Stone Age', 'Ancient Egypt', 'Roman Empire', 'Modern day']),
]

const LOG: PackItem[] = [
  mc('LOG', 'logic', 'tiny', 1, 'Which finishes the pattern? ⬆️➡️⬆️➡️…', ['⬆️', '➡️', '⬅️', '⬇️'], 0),
  sq('LOG', 'logic', 'starter', 2, 'Continue: 3, 6, 9, …', ['3', '6', '9', '12']),
  mc('LOG', 'data', 'explorer', 3, 'Data shown as rows and columns is a…', ['graph', 'table', 'map', 'sound'], 1),
  mc('LOG', 'code', 'explorer', 3, 'Giving a robot exact steps to follow is an…', ['emotion', 'algorithm', 'opinion', 'image'], 1),
  mc('LOG', 'logic', 'builder', 3, '"If hungry then eat." You are not hungry, so you…', ['must eat', 'need not eat', 'sleep', 'run'], 1),
  mc('LOG', 'code', 'builder', 4, 'Counting from 0 instead of 1 is common in…', ['cooking', 'programming', 'singing', 'sport'], 1),
  mc('LOG', 'ai', 'champion', 4, 'Teaching a model with labelled examples is called… learning', ['supervised', 'magic', 'random', 'manual'], 0),
  mc('LOG', 'logic', 'legend', 5, '(True OR False) AND True = ?', ['True', 'False', 'Error', 'Maybe'], 0, 'True AND True = True.'),
]

const LIF: PackItem[] = [
  mc('LIF', 'movement', 'starter', 2, 'After running, your breathing gets…', ['slower', 'faster', 'stops', 'colder'], 1),
  mc('LIF', 'habits', 'explorer', 2, 'Sugary drinks can harm your…', ['hair', 'teeth', 'shoes', 'books'], 1),
  mc('LIF', 'kindness', 'explorer', 3, 'Apologising when you’re wrong shows…', ['weakness', 'maturity', 'fear', 'boredom'], 1),
  base('LIF', 'party', 'party', 'starter', 1, 'Quest: help set or clear the table today.', { task: 'Help set or clear the table', quest: true }),
  base('LIF', 'party', 'party', 'explorer', 1, 'Quest: do 10 jumping jacks.', { task: 'Do 10 jumping jacks', quest: true }),
]

export const CONTENT_PACK_12: PackItem[] = [...NUM, ...WON, ...WLD, ...LOG, ...LIF]
