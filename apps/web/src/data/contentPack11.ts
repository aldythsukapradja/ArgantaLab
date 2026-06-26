// ============================================================
//  ARGANTALAB · CONTENT PACK 11 — LANGUAGE & READING DEPTH
//  Heavy on Word world (reading comprehension, grammar, spelling, vocabulary,
//  figurative language) graded tiny → legend, plus a steady spread of the other
//  worlds. Validated by data/content.test.ts. Facts/usage verified.
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
  ({ id: `cp11_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)

const WRD: PackItem[] = [
  // phonics / spelling
  mc('WRD', 'phonics', 'tiny', 1, 'Which word ends with the "t" sound?', ['bed', 'cat', 'dog', 'pen'], 1),
  mc('WRD', 'phonics', 'starter', 1, 'How many syllables in "elephant"?', ['1', '2', '3', '4'], 2, 'el-e-phant.'),
  mc('WRD', 'writing', 'starter', 2, 'Correct spelling:', ['hapy', 'happy', 'happi', 'happey'], 1),
  mc('WRD', 'writing', 'explorer', 2, 'Correct spelling:', ['tomorow', 'tommorow', 'tomorrow', 'tomorroww'], 2),
  mc('WRD', 'writing', 'builder', 3, 'Correct spelling:', ['definately', 'definitely', 'definitly', 'definetly'], 1),
  mc('WRD', 'writing', 'champion', 4, 'Correct spelling:', ['rhythm', 'rythm', 'rhythem', 'rythem'], 0),
  // grammar
  cz('WRD', 'grammar', 'starter', 2, 'I ', ' a book yesterday.', ['read', 'reads', 'reading'], 'read', 'Past tense of read (sounds "red").'),
  cz('WRD', 'grammar', 'explorer', 2, 'The dogs ', ' loudly.', ['bark', 'barks', 'barking'], 'bark', 'Plural subject → "bark".'),
  mc('WRD', 'grammar', 'explorer', 3, 'Which sentence uses "their" correctly?', ['Their happy.', 'They put on their coats.', 'Their is a cat.', 'Over their.'], 1),
  mc('WRD', 'grammar', 'builder', 3, 'Pick the correct one:', ['Me and him went.', 'Him and me went.', 'He and I went.', 'I and he went.'], 2),
  mc('WRD', 'grammar', 'builder', 4, 'A comma splice joins two sentences with only a…', ['full stop', 'comma', 'colon', 'dash'], 1),
  mc('WRD', 'grammar', 'champion', 4, '"Running quickly, she caught the bus." The opening phrase describes…', ['the bus', 'she', 'the road', 'nobody'], 1),
  // vocab
  mc('WRD', 'vocab', 'starter', 2, 'Opposite of "full"?', ['empty', 'big', 'soft', 'loud'], 0),
  mc('WRD', 'vocab', 'explorer', 2, 'A synonym for "tired"?', ['awake', 'weary', 'fast', 'angry'], 1),
  mc('WRD', 'vocab', 'explorer', 3, '"Enormous" is closest to…', ['tiny', 'gigantic', 'medium', 'thin'], 1),
  mc('WRD', 'vocab', 'builder', 3, '"Re-" in "rewrite" means…', ['not', 'again', 'before', 'badly'], 1),
  mc('WRD', 'vocab', 'builder', 4, 'A word that sounds like its meaning, e.g. "buzz", is…', ['a simile', 'onomatopoeia', 'a metaphor', 'a pun'], 1),
  mc('WRD', 'vocab', 'champion', 4, '"Ancient" is an antonym of…', ['old', 'modern', 'huge', 'wise'], 1),
  mc('WRD', 'vocab', 'legend', 5, '"Benevolent" means…', ['cruel', 'kind', 'tired', 'rich'], 1),
  mc('WRD', 'vocab', 'legend', 5, '"Ephemeral" means…', ['lasting forever', 'short-lived', 'very large', 'hidden'], 1),
  // reading comprehension
  mc('WRD', 'reading', 'starter', 2, '"Sam shared his lunch with a hungry friend." Sam is…', ['greedy', 'kind', 'rude', 'shy'], 1),
  mc('WRD', 'reading', 'explorer', 3, '"The old bridge creaked and swayed in the wind." The bridge is…', ['brand new', 'safe', 'unsteady', 'underwater'], 2),
  mc('WRD', 'reading', 'explorer', 3, '"She checked her watch again and tapped her foot." She feels…', ['calm', 'impatient', 'sleepy', 'happy'], 1),
  mc('WRD', 'reading', 'builder', 3, 'A story’s "setting" is its…', ['main character', 'time and place', 'last line', 'title'], 1),
  mc('WRD', 'reading', 'builder', 4, '"The forest held its breath." This is an example of…', ['a fact', 'personification', 'a statistic', 'a question'], 1),
  mc('WRD', 'reading', 'champion', 4, 'The narrator who uses "I" is writing in… person', ['first', 'second', 'third', 'fourth'], 0),
  mc('WRD', 'writing', 'legend', 5, 'Which sentence is most formal?', ['Gonna head out now.', 'I shall now depart.', 'Catch ya later!', 'Bye bye!'], 1),
  sq('WRD', 'writing', 'builder', 3, 'Order a good paragraph.', ['Topic sentence', 'Supporting detail', 'Another detail', 'Concluding sentence']),
]

// steady spread across the other worlds
const OTHER: PackItem[] = [
  mc('NUM', 'arith', 'explorer', 2, 'Double 17 is…', ['27', '34', '37', '24'], 1),
  mc('NUM', 'arith', 'builder', 3, 'Half of 250 is…', ['100', '125', '150', '50'], 1),
  mc('NUM', 'fractions', 'builder', 3, 'Which is largest?', ['0.5', '0.45', '0.05', '0.4'], 0),
  mc('NUM', 'money', 'explorer', 3, 'Three items at $2.50 each cost…', ['$5.00', '$6.50', '$7.50', '$10.00'], 2),
  mc('WON', 'biology', 'explorer', 2, 'A spider is an arachnid, not an…', ['animal', 'insect', 'organism', 'creature'], 1, 'Insects have 6 legs; spiders 8.'),
  mc('WON', 'earth', 'builder', 3, 'The hard outer layer of Earth is the…', ['core', 'crust', 'mantle', 'cloud'], 1),
  mc('WON', 'physics', 'champion', 4, 'A complete electrical path is a…', ['switch', 'circuit', 'bulb', 'wire only'], 1),
  mc('WLD', 'geography', 'explorer', 3, 'A narrow strip of land joining two larger areas is an…', ['island', 'isthmus', 'ocean', 'bay'], 1),
  mc('WLD', 'history', 'builder', 3, 'Hieroglyphics were a writing system of ancient…', ['Greece', 'Egypt', 'China', 'Rome'], 1),
  mc('LOG', 'logic', 'explorer', 3, 'If A is taller than B, and B taller than C, the tallest is…', ['A', 'B', 'C', 'equal'], 0),
  mc('LOG', 'code', 'builder', 3, 'Pseudocode is…', ['a real language', 'plain-language steps', 'a game', 'a robot'], 1),
  mc('LIF', 'kindness', 'explorer', 2, 'A good way to make a new friend is to…', ['ignore them', 'ask about them', 'tease them', 'walk away'], 1),
  mc('LIF', 'habits', 'builder', 3, 'Screens late at night affect sleep because of their… light', ['red', 'blue', 'green', 'no'], 1),
]

export const CONTENT_PACK_11: PackItem[] = [...WRD, ...OTHER]
