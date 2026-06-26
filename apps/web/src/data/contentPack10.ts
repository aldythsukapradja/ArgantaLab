// ============================================================
//  ARGANTALAB · CONTENT PACK 10 — DEEP VOLUME (every world, every band)
//  Another broad, dense layer so the bank comfortably sustains long-term daily
//  play without repeats: spelling, grammar, more word problems, more science /
//  geography / history / logic facts. Validated by data/content.test.ts.
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
  ({ id: `cp10_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const tp = (w: string, s: string, st: string, d: number, p: string, ans: string, numeric = false, e?: string) => base(w, s, 'type', st, d, p, { answer: ans, numeric, accept: [ans] }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)

const NUM: PackItem[] = [
  tp('NUM', 'arith', 'starter', 1, '7 + 9 = ?', '16', true),
  tp('NUM', 'arith', 'starter', 2, '100 − 37 = ?', '63', true),
  mc('NUM', 'placevalue', 'starter', 2, 'Which number is two hundred and five?', ['25', '250', '205', '2005'], 2),
  tp('NUM', 'times', 'explorer', 2, '6 × 7 = ?', '42', true),
  tp('NUM', 'times', 'explorer', 2, '8 × 9 = ?', '72', true),
  tp('NUM', 'times', 'explorer', 3, '12 × 11 = ?', '132', true),
  mc('NUM', 'fractions', 'explorer', 3, 'Which is equal to 1?', ['2/3', '4/4', '3/2', '1/2'], 1),
  mc('NUM', 'time', 'explorer', 2, 'Quarter past 3 is…', ['3:15', '3:30', '3:45', '3:00'], 0),
  mc('NUM', 'geometry', 'explorer', 3, 'A 3D shape like a ball is a…', ['cube', 'sphere', 'cone', 'prism'], 1),
  mc('NUM', 'measure', 'builder', 3, 'How many millilitres in 1 litre?', ['10', '100', '1000', '10000'], 2),
  mc('NUM', 'arith', 'builder', 3, 'Round 4,678 to the nearest hundred.', ['4,600', '4,700', '4,680', '5,000'], 1),
  mc('NUM', 'arith', 'builder', 4, '−3 × 4 = ?', ['−12', '12', '−7', '7'], 0),
  mc('NUM', 'arith', 'champion', 4, 'LCM of 4 and 6 is…', ['10', '12', '18', '24'], 1),
  mc('NUM', 'arith', 'champion', 4, 'HCF of 12 and 18 is…', ['2', '3', '6', '9'], 2),
  mc('NUM', 'geometry', 'champion', 4, 'Circumference uses the constant…', ['e', 'π', 'g', 'c'], 1),
  mc('NUM', 'arith', 'legend', 5, 'Simplify 3⁴ ÷ 3²', ['3', '9', '27', '81'], 1, '3^(4−2)=3²=9.'),
]

const WRD: PackItem[] = [
  mc('WRD', 'writing', 'starter', 2, 'Which is spelled correctly?', ['frend', 'friend', 'freind', 'frind'], 1),
  mc('WRD', 'writing', 'explorer', 2, 'Which is spelled correctly?', ['becuase', 'becouse', 'because', 'becase'], 2),
  mc('WRD', 'writing', 'explorer', 3, 'Which is spelled correctly?', ['necessary', 'neccessary', 'necesary', 'neccesary'], 0),
  cz('WRD', 'grammar', 'starter', 2, 'There ', ' three cats.', ['is', 'are', 'am'], 'are', 'Plural → "are".'),
  cz('WRD', 'grammar', 'explorer', 2, 'She ', ' to music every day.', ['listen', 'listens', 'listening'], 'listens', 'He/she → add s.'),
  mc('WRD', 'grammar', 'explorer', 3, 'Which is a pronoun?', ['table', 'she', 'jump', 'red'], 1),
  mc('WRD', 'vocab', 'explorer', 2, 'A synonym for "scared" is…', ['brave', 'afraid', 'happy', 'tall'], 1),
  mc('WRD', 'vocab', 'explorer', 3, 'A group of wolves is a…', ['herd', 'pack', 'school', 'flock'], 1),
  mc('WRD', 'vocab', 'builder', 3, 'A group of fish is a…', ['pack', 'herd', 'school', 'pride'], 2),
  mc('WRD', 'grammar', 'builder', 3, 'Contraction of "do not" is…', ['dont', "don't", 'donot', "do'nt"], 1),
  mc('WRD', 'vocab', 'builder', 4, '"Microscope" — "micro" means…', ['big', 'small', 'fast', 'far'], 1),
  mc('WRD', 'reading', 'champion', 4, '"He was over the moon." He felt…', ['sad', 'delighted', 'tired', 'sick'], 1),
  mc('WRD', 'vocab', 'champion', 4, '"Generous" means…', ['mean', 'giving', 'quiet', 'fast'], 1),
  mc('WRD', 'vocab', 'legend', 5, '"Meticulous" means…', ['careless', 'very careful', 'lazy', 'loud'], 1),
]

const WON: PackItem[] = [
  mc('WON', 'biology', 'starter', 2, 'Which animal is a mammal?', ['shark', 'frog', 'dolphin', 'eagle'], 2, 'Dolphins breathe air & feed milk.'),
  mc('WON', 'biology', 'explorer', 2, 'Plants make food using sunlight in their…', ['roots', 'leaves', 'stem', 'seeds'], 1),
  mc('WON', 'earth', 'explorer', 2, 'A shape the Earth makes around the Sun is an…', ['line', 'orbit', 'square', 'spiral'], 1),
  mc('WON', 'earth', 'explorer', 3, 'It takes Earth about… to orbit the Sun', ['1 day', '1 month', '1 year', '10 years'], 2),
  mc('WON', 'chemistry', 'explorer', 3, 'Steam is water in which state?', ['solid', 'liquid', 'gas', 'plasma'], 2),
  so('WON', 'chemistry', 'explorer', 3, 'Solid, liquid or gas?', ['Solid', 'Liquid', 'Gas'], [
    { text: 'Ice', bucket: 0 }, { text: 'Milk', bucket: 1 }, { text: 'Steam', bucket: 2 }, { text: 'Rock', bucket: 0 }]),
  mc('WON', 'physics', 'builder', 3, 'A push or a pull is a…', ['force', 'mass', 'cell', 'gas'], 0),
  mc('WON', 'physics', 'builder', 3, 'Which surface has the most friction?', ['ice', 'glass', 'sandpaper', 'oil'], 2),
  mc('WON', 'biology', 'builder', 4, 'The organ that pumps blood is the…', ['lungs', 'heart', 'liver', 'brain'], 1),
  mc('WON', 'earth', 'builder', 4, 'Earthquakes happen where tectonic… meet', ['clouds', 'plates', 'rivers', 'stars'], 1),
  mc('WON', 'chemistry', 'champion', 4, 'Table salt is sodium and…', ['chlorine', 'oxygen', 'carbon', 'iron'], 0, 'NaCl.'),
  mc('WON', 'physics', 'legend', 5, 'A material that lets electricity flow is a…', ['insulator', 'conductor', 'magnet', 'gas'], 1),
  mc('WON', 'biology', 'legend', 5, 'Organisms that make their own food are…', ['consumers', 'producers', 'decomposers', 'predators'], 1),
]

const LOG: PackItem[] = [
  sq('LOG', 'logic', 'starter', 2, 'Continue: 1, 2, 4, 8, …', ['1', '2', '4', '8', '16']),
  mc('LOG', 'logic', 'explorer', 2, 'Odd one out: 2, 4, 7, 8', ['2', '4', '7', '8'], 2, '7 is odd.'),
  mc('LOG', 'code', 'explorer', 3, 'A bug in code is a…', ['feature', 'mistake', 'colour', 'cable'], 1),
  mc('LOG', 'data', 'explorer', 3, 'A pie chart shows…', ['parts of a whole', 'time only', 'words', 'sounds'], 0),
  mc('LOG', 'logic', 'builder', 3, 'NOT true = ?', ['true', 'false', 'maybe', 'both'], 1),
  mc('LOG', 'code', 'builder', 3, 'Code inside a loop runs…', ['once', 'never', 'many times', 'backwards'], 2),
  mc('LOG', 'data', 'builder', 4, 'The binary digit can be…', ['0–9', '0 or 1', 'A–Z', 'any number'], 1),
  mc('LOG', 'ai', 'builder', 4, 'AI that recognises faces is trained on many…', ['sounds', 'images', 'smells', 'coins'], 1),
  mc('LOG', 'code', 'champion', 4, 'Sorting a list smallest-to-largest is… order', ['random', 'ascending', 'descending', 'circular'], 1),
  mc('LOG', 'logic', 'legend', 5, 'If "no birds are mammals" is true, a bat (a mammal) is…', ['a bird', 'not a bird', 'both', 'neither'], 1),
]

const WLD: PackItem[] = [
  mc('WLD', 'geography', 'starter', 2, 'A very cold place at the bottom of Earth is…', ['Sahara', 'Antarctica', 'Amazon', 'Alps'], 1),
  mc('WLD', 'geography', 'explorer', 2, 'Capital of the United Kingdom?', ['Manchester', 'London', 'Dublin', 'Paris'], 1),
  mc('WLD', 'geography', 'explorer', 3, 'Capital of Australia?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2, 'Canberra, not Sydney.'),
  mc('WLD', 'geography', 'explorer', 3, 'The Amazon rainforest is mostly in…', ['Africa', 'Brazil', 'India', 'Canada'], 1),
  mc('WLD', 'history', 'explorer', 3, 'People who study the past using old objects are…', ['biologists', 'archaeologists', 'chemists', 'pilots'], 1),
  mc('WLD', 'history', 'builder', 3, 'The Titanic sank in the year…', ['1812', '1912', '1942', '1992'], 1),
  mc('WLD', 'geography', 'builder', 3, 'A map’s key (legend) explains its…', ['title', 'symbols', 'price', 'author'], 1),
  mc('WLD', 'economics', 'builder', 3, 'Money you owe back, usually with interest, is a…', ['gift', 'loan', 'tax', 'profit'], 1),
  mc('WLD', 'geography', 'champion', 4, 'The line at 0° longitude is the…', ['Equator', 'Prime Meridian', 'Tropic of Cancer', 'Date Line'], 1),
  mc('WLD', 'history', 'champion', 4, 'The Renaissance was a rebirth of art and learning beginning in…', ['Italy', 'Germany', 'Russia', 'Egypt'], 0),
  mc('WLD', 'economics', 'legend', 5, 'Supply and demand together set a market…', ['law', 'price', 'tax', 'flag'], 1),
]

const LIF: PackItem[] = [
  mc('LIF', 'habits', 'starter', 1, 'Washing hands removes…', ['colours', 'germs', 'water', 'soap'], 1),
  mc('LIF', 'kindness', 'starter', 2, 'A new student looks lonely. You could…', ['ignore them', 'invite them to play', 'laugh', 'point'], 1),
  mc('LIF', 'movement', 'explorer', 2, 'Exercise makes your heart…', ['stop', 'stronger', 'smaller', 'colder'], 1),
  mc('LIF', 'habits', 'explorer', 3, 'A balanced plate has fruit, grains and…', ['only candy', 'vegetables', 'soda', 'cake'], 1),
  mc('LIF', 'kindness', 'builder', 3, 'If you make a mistake, the brave thing is to…', ['hide it', 'blame others', 'own up and fix it', 'quit'], 2),
  base('LIF', 'party', 'party', 'explorer', 1, 'Quest: take 5 deep breaths and notice how you feel.', { task: 'Take 5 slow deep breaths', quest: true }),
  base('LIF', 'party', 'party', 'builder', 1, 'Quest: write down one thing you are grateful for.', { task: 'Write one thing you are grateful for', quest: true }),
]

export const CONTENT_PACK_10: PackItem[] = [...NUM, ...WRD, ...WON, ...LOG, ...WLD, ...LIF]
