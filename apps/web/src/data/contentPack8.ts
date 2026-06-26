// ============================================================
//  ARGANTALAB · CONTENT PACK 8 — KNOWLEDGE BREADTH + FLUENCY VOLUME
//  Heavy on factual knowledge (vocab, science, geography, history) + reading
//  comprehension + repeatable number/word fluency, graded tiny → legend. Pairs
//  with the procedural drills (number facts) by adding the KNOWLEDGE the drills
//  can't generate. Self-contained, all facts verified.
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
  ({ id: `cp8_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const tp = (w: string, s: string, st: string, d: number, p: string, ans: string, numeric = false, e?: string) => base(w, s, 'type', st, d, p, { answer: ans, numeric, accept: [ans] }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)
const mt = (w: string, s: string, st: string, d: number, p: string, pairs: [string, string][], e?: string) => base(w, s, 'match', st, d, p, { pairs }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)

// ─── NUMBER: reasoning + word problems (facts beyond raw drills) ───
const NUM: PackItem[] = [
  mc('NUM', 'arith', 'starter', 1, 'You have 3 apples and get 4 more. How many?', ['6', '7', '8', '12'], 1),
  mc('NUM', 'arith', 'starter', 2, '12 sweets shared equally between 2 kids — each gets…', ['4', '5', '6', '8'], 2),
  mc('NUM', 'money', 'starter', 2, 'Two $5 notes make…', ['$7', '$10', '$15', '$25'], 1),
  mc('NUM', 'time', 'starter', 2, 'How many days in a week?', ['5', '6', '7', '10'], 2),
  mc('NUM', 'measure', 'explorer', 2, '1 metre = how many centimetres?', ['10', '50', '100', '1000'], 2),
  mc('NUM', 'measure', 'explorer', 3, '1 kilogram = how many grams?', ['10', '100', '1000', '10000'], 2),
  mc('NUM', 'time', 'explorer', 2, 'How many months in a year?', ['10', '11', '12', '13'], 2),
  mc('NUM', 'fractions', 'explorer', 3, '3/4 of 12 is…', ['6', '8', '9', '10'], 2, '12÷4=3, ×3=9.'),
  mc('NUM', 'arith', 'builder', 3, 'A train leaves at 2:15 and arrives 3:45. Journey?', ['1h 15m', '1h 30m', '1h 45m', '2h'], 1),
  mc('NUM', 'money', 'builder', 3, '20% tip on a $50 bill is…', ['$5', '$10', '$15', '$20'], 1, '50÷5=10.'),
  mc('NUM', 'arith', 'champion', 4, 'Average of 4, 8, and 12?', ['6', '8', '10', '12'], 1, '(24)÷3=8.'),
  mc('NUM', 'fractions', 'champion', 4, '0.2 as a percent is…', ['2%', '20%', '0.2%', '200%'], 1),
  mc('NUM', 'arith', 'legend', 5, 'If 5 workers build a wall in 6 days, 3 workers take… (same rate)', ['8 days', '10 days', '12 days', '15 days'], 1, '30 worker-days ÷ 3.'),
]

// ─── WORD: vocab, grammar, comprehension ───
const WRD: PackItem[] = [
  mc('WRD', 'vocab', 'tiny', 1, 'A baby dog is a…', ['kitten', 'puppy', 'calf', 'cub'], 1),
  mc('WRD', 'vocab', 'tiny', 1, 'A baby cat is a…', ['puppy', 'kitten', 'foal', 'chick'], 1),
  mc('WRD', 'phonics', 'starter', 1, 'Which word starts with the same sound as "fish"?', ['sun', 'phone', 'box', 'tree'], 1, '"ph" makes the f sound.'),
  mc('WRD', 'grammar', 'starter', 2, 'Pick the adjective: "the RED ball"', ['the', 'red', 'ball', 'none'], 1),
  mc('WRD', 'vocab', 'starter', 2, 'Opposite of "begin"?', ['start', 'end', 'open', 'go'], 1),
  mt('WRD', 'vocab', 'explorer', 2, 'Match the synonyms.', [['big', 'large'], ['fast', 'quick'], ['glad', 'happy'], ['small', 'tiny']]),
  mt('WRD', 'vocab', 'explorer', 3, 'Match the antonyms.', [['hot', 'cold'], ['up', 'down'], ['day', 'night'], ['open', 'shut']]),
  mc('WRD', 'grammar', 'explorer', 3, 'Which is a complete sentence?', ['Running fast.', 'The dog barked.', 'Under the big.', 'Because she.'], 1),
  mc('WRD', 'reading', 'explorer', 3, '"Maya grabbed her coat and umbrella." It is probably…', ['sunny', 'rainy', 'snowy', 'windy'], 1),
  mc('WRD', 'vocab', 'builder', 3, '"Trans-" in transport means…', ['under', 'across', 'again', 'small'], 1),
  mc('WRD', 'vocab', 'builder', 3, 'The suffix "-less" means…', ['full of', 'without', 'more', 'before'], 1, 'fearless = without fear.'),
  mc('WRD', 'grammar', 'builder', 4, 'Which is the adverb? "She sang beautifully."', ['She', 'sang', 'beautifully', 'none'], 2),
  mc('WRD', 'reading', 'champion', 4, 'The main idea of a paragraph is its…', ['first word', 'central point', 'longest sentence', 'title only'], 1),
  mc('WRD', 'vocab', 'champion', 4, '"Reluctant" means…', ['eager', 'unwilling', 'tired', 'angry'], 1),
  mc('WRD', 'writing', 'legend', 5, 'A paragraph that gives both sides of an argument is…', ['narrative', 'balanced/discursive', 'instructional', 'descriptive'], 1),
]

// ─── WONDER: science facts across domains ───
const WON: PackItem[] = [
  mc('WON', 'biology', 'tiny', 1, 'How many legs does a spider have?', ['6', '8', '10', '4'], 1),
  mc('WON', 'biology', 'starter', 2, 'Which animal lays eggs?', ['dog', 'cow', 'hen', 'cat'], 2),
  mc('WON', 'earth', 'starter', 2, 'The season after winter is…', ['summer', 'spring', 'autumn', 'monsoon'], 1),
  mc('WON', 'biology', 'explorer', 2, 'Insects breathe through tiny holes called…', ['gills', 'spiracles', 'lungs', 'pores'], 1),
  mc('WON', 'earth', 'explorer', 2, 'The Earth orbits the…', ['Moon', 'Sun', 'Mars', 'Galaxy'], 1),
  mc('WON', 'physics', 'explorer', 3, 'Light travels faster than…', ['nothing', 'sound', 'rockets', 'time'], 1),
  mc('WON', 'chemistry', 'explorer', 3, 'Which is a gas at room temperature?', ['iron', 'water', 'oxygen', 'gold'], 2),
  mc('WON', 'biology', 'builder', 3, 'Humans have how many bones (adult)?', ['106', '206', '306', '406'], 1),
  mc('WON', 'earth', 'builder', 3, 'Most of Earth’s surface is covered by…', ['land', 'water', 'ice', 'forest'], 1, 'About 71% water.'),
  mc('WON', 'chemistry', 'builder', 4, 'The chemical symbol for gold is…', ['Go', 'Gd', 'Au', 'Ag'], 2),
  mc('WON', 'physics', 'champion', 4, 'Force = mass × …', ['speed', 'acceleration', 'time', 'distance'], 1),
  mc('WON', 'biology', 'champion', 4, 'Red blood cells carry…', ['signals', 'oxygen', 'fat', 'sugar only'], 1),
  mc('WON', 'earth', 'legend', 5, 'The most abundant gas in Earth’s atmosphere is…', ['oxygen', 'nitrogen', 'carbon dioxide', 'hydrogen'], 1, '~78% nitrogen.'),
]

// ─── LOGIC: reasoning, code, data ───
const LOG: PackItem[] = [
  sq('LOG', 'logic', 'starter', 2, 'Continue: 5, 10, 15, …', ['5', '10', '15', '20']),
  mc('LOG', 'logic', 'explorer', 2, 'All cats are animals. Tom is a cat. So Tom is…', ['a dog', 'an animal', 'a plant', 'a rock'], 1),
  mc('LOG', 'data', 'explorer', 3, 'A graph with bars compares…', ['nothing', 'amounts', 'colours only', 'shapes'], 1),
  mc('LOG', 'code', 'explorer', 3, 'Repeat 4 times: step forward. The robot moves…', ['1 step', '2 steps', '4 steps', '0 steps'], 2),
  mc('LOG', 'ai', 'builder', 3, 'A chatbot predicts the next…', ['weather', 'word', 'planet', 'coin'], 1),
  mc('LOG', 'data', 'builder', 4, '8 in binary is…', ['100', '1000', '110', '111'], 1, '8 = 1000₂.'),
  mc('LOG', 'logic', 'champion', 4, 'If P→Q and P is true, then Q is…', ['false', 'true', 'unknown', 'both'], 1),
  mc('LOG', 'code', 'champion', 4, 'A list of items in order is an…', ['array', 'pixel', 'cable', 'cloud'], 0),
  mc('LOG', 'logic', 'legend', 5, 'OR is false only when…', ['both true', 'one true', 'both false', 'always'], 2),
]

// ─── WORLD: geography, history, economics ───
const WLD: PackItem[] = [
  mt('WLD', 'geography', 'explorer', 3, 'Match country → capital.', [['Italy', 'Rome'], ['Spain', 'Madrid'], ['Egypt', 'Cairo'], ['Kenya', 'Nairobi']]),
  mc('WLD', 'geography', 'explorer', 2, 'Which is a continent?', ['France', 'Africa', 'Paris', 'Nile'], 1),
  mc('WLD', 'geography', 'explorer', 3, 'The tallest mountain on Earth is…', ['K2', 'Everest', 'Kilimanjaro', 'Alps'], 1),
  mc('WLD', 'history', 'explorer', 3, 'Dinosaurs lived… before humans', ['100 years', 'millions of years', 'last week', '50 years'], 1),
  mc('WLD', 'geography', 'builder', 3, 'Which country has the most people?', ['USA', 'India', 'Brazil', 'Russia'], 1),
  mc('WLD', 'history', 'builder', 3, 'The first humans to walk on the Moon did so in…', ['1959', '1969', '1979', '1989'], 1),
  mc('WLD', 'economics', 'builder', 3, 'Trading goods without money is called…', ['barter', 'banking', 'tax', 'tariff'], 0),
  mc('WLD', 'geography', 'champion', 4, 'The Equator passes through…', ['Canada', 'Brazil', 'Russia', 'Japan'], 1),
  mc('WLD', 'history', 'champion', 4, 'The Great Wall is in…', ['India', 'China', 'Egypt', 'Peru'], 1),
  mc('WLD', 'economics', 'legend', 5, 'A central bank can change interest rates to control…', ['weather', 'inflation', 'population', 'tides'], 1),
]

// ─── LIFE: health, kindness, focus ───
const LIF: PackItem[] = [
  mc('LIF', 'habits', 'starter', 1, 'Which drink is healthiest?', ['soda', 'water', 'energy drink', 'milkshake'], 1),
  mc('LIF', 'kindness', 'explorer', 2, 'A friend wins a prize. A kind response is…', ['ignore them', 'say congratulations', 'feel jealous loudly', 'walk off'], 1),
  mc('LIF', 'movement', 'explorer', 2, 'Stretching before sport helps prevent…', ['hunger', 'injuries', 'sleep', 'thirst'], 1),
  mc('LIF', 'habits', 'builder', 3, 'Too much screen time before bed can hurt your…', ['hair', 'sleep', 'shoes', 'lunch'], 1),
  mc('LIF', 'kindness', 'builder', 3, 'Listening without interrupting shows…', ['boredom', 'respect', 'anger', 'fear'], 1),
  base('LIF', 'party', 'party', 'explorer', 1, 'Quest: drink a glass of water now.', { task: 'Drink a glass of water', quest: true }),
  base('LIF', 'party', 'party', 'starter', 1, 'Quest: say thank you to someone today.', { task: 'Say thank you to someone today', quest: true }),
]

export const CONTENT_PACK_8: PackItem[] = [...NUM, ...WRD, ...WON, ...LOG, ...WLD, ...LIF]
