// ============================================================
//  ARGANTALAB · CONTENT PACK 6  — FLUENCY VOLUME + BREADTH
//  Daily drilling burns through items fast, especially quick-fire
//  fluency (number facts, times tables, vocab). This pack adds high
//  volume of those repeatable formats plus broad fact coverage so the
//  bank comfortably sustains months of practice without repeats.
//  Types declared locally so this file never imports learn.ts.
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
function m(world: string, skill: string, type: IKey, stage: string, difficulty: number, prompt: string, payload: Record<string, unknown>, extra: Partial<PackItem> = {}): PackItem {
  return { id: `cp6_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, xp: 10, diamonds: 0, ...extra }
}
// quick numeric-answer helper
const t = (world: string, skill: string, stage: string, diff: number, prompt: string, ans: string, extra: Partial<PackItem> = {}) =>
  m(world, skill, 'speed', stage, diff, prompt, { answer: ans, numeric: true, accept: [ans] }, extra)

// ════════════════════════════════════════════════════════════
//  NUMBER FLUENCY — addition / subtraction facts (speed)
// ════════════════════════════════════════════════════════════
const ADD: PackItem[] = [
  t('NUM', 'arith', 'starter', 1, '6 + 7 = ?', '13'),
  t('NUM', 'arith', 'starter', 1, '9 + 8 = ?', '17'),
  t('NUM', 'arith', 'starter', 1, '5 + 9 = ?', '14'),
  t('NUM', 'arith', 'starter', 1, '8 + 8 = ?', '16'),
  t('NUM', 'arith', 'starter', 1, '7 + 4 = ?', '11'),
  t('NUM', 'arith', 'starter', 1, '12 + 9 = ?', '21'),
  t('NUM', 'arith', 'starter', 2, '15 + 16 = ?', '31'),
  t('NUM', 'arith', 'starter', 2, '24 + 18 = ?', '42'),
  t('NUM', 'arith', 'starter', 1, '13 − 5 = ?', '8'),
  t('NUM', 'arith', 'starter', 1, '16 − 9 = ?', '7'),
  t('NUM', 'arith', 'starter', 2, '20 − 7 = ?', '13'),
  t('NUM', 'arith', 'starter', 2, '34 − 16 = ?', '18'),
  t('NUM', 'arith', 'explorer', 2, '45 + 38 = ?', '83'),
  t('NUM', 'arith', 'explorer', 2, '72 − 29 = ?', '43'),
  t('NUM', 'arith', 'explorer', 3, '128 + 94 = ?', '222'),
  t('NUM', 'arith', 'explorer', 3, '305 − 147 = ?', '158'),
  t('NUM', 'arith', 'explorer', 3, '256 + 256 = ?', '512'),
  t('NUM', 'arith', 'explorer', 3, '1000 − 365 = ?', '635'),
]
// ── times tables (speed) ──
const TIMES: PackItem[] = [
  t('NUM', 'times', 'starter', 1, '3 × 4 = ?', '12'),
  t('NUM', 'times', 'starter', 1, '5 × 6 = ?', '30'),
  t('NUM', 'times', 'starter', 2, '7 × 7 = ?', '49'),
  t('NUM', 'times', 'starter', 2, '8 × 6 = ?', '48'),
  t('NUM', 'times', 'starter', 2, '9 × 4 = ?', '36'),
  t('NUM', 'times', 'starter', 2, '6 × 7 = ?', '42'),
  t('NUM', 'times', 'explorer', 2, '8 × 9 = ?', '72'),
  t('NUM', 'times', 'explorer', 2, '7 × 8 = ?', '56'),
  t('NUM', 'times', 'explorer', 2, '12 × 6 = ?', '72'),
  t('NUM', 'times', 'explorer', 3, '11 × 12 = ?', '132'),
  t('NUM', 'times', 'explorer', 3, '15 × 4 = ?', '60'),
  t('NUM', 'times', 'explorer', 3, '25 × 4 = ?', '100'),
  t('NUM', 'times', 'starter', 1, '48 ÷ 6 = ?', '8'),
  t('NUM', 'times', 'starter', 2, '63 ÷ 9 = ?', '7'),
  t('NUM', 'times', 'explorer', 2, '72 ÷ 8 = ?', '9'),
  t('NUM', 'times', 'explorer', 3, '144 ÷ 12 = ?', '12'),
  t('NUM', 'times', 'explorer', 3, '81 ÷ 9 = ?', '9'),
  t('NUM', 'times', 'explorer', 3, '100 ÷ 4 = ?', '25'),
]
// ── place value, money, fractions facts ──
const NFACT: PackItem[] = [
  m('NUM', 'placevalue', 'mcq', 'explorer', 2, 'What is 10 times bigger than 47?', { choices: ['470', '57', '4.7', '407'], answer: 0 }),
  m('NUM', 'placevalue', 'mcq', 'explorer', 2, 'Which digit is in the tens place in 5,162?', { choices: ['6', '1', '5', '2'], answer: 0 }),
  m('NUM', 'placevalue', 'type', 'explorer', 2, 'Round 268 to the nearest ten.', { answer: '270', numeric: true, accept: ['270'] }),
  m('NUM', 'placevalue', 'mcq', 'starter', 1, 'Which is an EVEN number?', { choices: ['18', '7', '23', '9'], answer: 0 }),
  m('NUM', 'placevalue', 'mcq', 'explorer', 2, 'Which number is a multiple of 5?', { choices: ['35', '32', '41', '28'], answer: 0 }),
  m('NUM', 'fractions', 'mcq', 'explorer', 2, 'Which is equal to 1/2?', { choices: ['2/4', '1/3', '3/4', '2/5'], answer: 0 }),
  m('NUM', 'fractions', 'mcq', 'explorer', 3, 'Which is bigger: 2/3 or 3/5?', { choices: ['2/3', '3/5', 'They are equal', 'Cannot tell'], answer: 0 }, { explanation: '2/3 ≈ 0.67, 3/5 = 0.6.' }),
  m('NUM', 'fractions', 'type', 'explorer', 3, 'What is 1/4 of 32?', { answer: '8', numeric: true, accept: ['8'] }),
  m('NUM', 'money', 'mcq', 'explorer', 2, 'How many 20¢ coins make $1?', { choices: ['5', '4', '20', '2'], answer: 0 }),
  m('NUM', 'money', 'type', 'explorer', 3, 'You buy a $2.40 drink with a $5 note. Change in dollars?', { answer: '2.6', numeric: true, accept: ['2.6', '2.60'] }),
  m('NUM', 'measure', 'mcq', 'explorer', 2, 'How many centimetres in 1 metre?', { choices: ['100', '10', '1000', '12'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'explorer', 2, 'How many grams in 1 kilogram?', { choices: ['1000', '100', '10', '500'], answer: 0 }),
  m('NUM', 'time', 'mcq', 'explorer', 2, 'How many days are in a leap year?', { choices: ['366', '365', '360', '364'], answer: 0 }),
  m('NUM', 'time', 'mcq', 'explorer', 2, '15:00 in 12-hour time is…', { choices: ['3 pm', '5 pm', '3 am', '1 pm'], answer: 0 }),
  m('NUM', 'geometry', 'mcq', 'explorer', 2, 'How many faces does a cube have?', { choices: ['6', '4', '8', '12'], answer: 0 }),
  m('NUM', 'geometry', 'mcq', 'explorer', 3, 'A shape with all sides equal and 5 sides is a regular…', { choices: ['pentagon', 'square', 'hexagon', 'triangle'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WORD FLUENCY — synonyms, antonyms, spelling, micro-reading
// ════════════════════════════════════════════════════════════
const VOCAB: PackItem[] = [
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'SYNONYM of "fast"?', { choices: ['rapid', 'slow', 'heavy', 'late'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'SYNONYM of "big"?', { choices: ['huge', 'tiny', 'thin', 'short'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'SYNONYM of "smart"?', { choices: ['clever', 'dull', 'weak', 'loud'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'SYNONYM of "cold"?', { choices: ['chilly', 'warm', 'bright', 'soft'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'ANTONYM of "begin"?', { choices: ['end', 'start', 'open', 'go'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'ANTONYM of "empty"?', { choices: ['full', 'open', 'light', 'small'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'ANTONYM of "noisy"?', { choices: ['quiet', 'loud', 'busy', 'fast'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'ANTONYM of "generous"?', { choices: ['selfish', 'kind', 'giving', 'rich'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, '"Furious" means very…', { choices: ['angry', 'happy', 'tired', 'hungry'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, '"Exhausted" means very…', { choices: ['tired', 'excited', 'cold', 'fast'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, '"Ancient" means very…', { choices: ['old', 'new', 'big', 'fast'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, '"Enormous" means very…', { choices: ['big', 'small', 'loud', 'sweet'], answer: 0 }),
  m('WRD', 'vocab', 'match', 'builder', 4, 'Match the word to its meaning.', { pairs: [['Brave', 'Not afraid'], ['Gentle', 'Soft and kind'], ['Curious', 'Wanting to know'], ['Honest', 'Tells the truth']] }),
  m('WRD', 'vocab', 'match', 'builder', 4, 'Match the tricky word to its meaning.', { pairs: [['Fragile', 'Easily broken'], ['Vivid', 'Bright and clear'], ['Weary', 'Very tired'], ['Eager', 'Keen to do something']] }),
]
const SPELL: PackItem[] = [
  m('WRD', 'phonics', 'cloze', 'explorer', 2, 'Spell it: "bea__iful" (lovely to look at).', { before: 'bea', after: 'iful', options: ['ut', 'oot', 'aut', 'it'], answer: 'ut' }),
  m('WRD', 'phonics', 'cloze', 'explorer', 2, 'Spell it: "fr__nd" (someone you like).', { before: 'fr', after: 'nd', options: ['ie', 'ei', 'e', 'i'], answer: 'ie' }),
  m('WRD', 'phonics', 'mcq', 'explorer', 2, 'Which word is spelled correctly?', { choices: ['because', 'becuase', 'becauze', 'becase'], answer: 0 }),
  m('WRD', 'phonics', 'mcq', 'explorer', 2, 'Which word is spelled correctly?', { choices: ['necessary', 'neccessary', 'necesary', 'neccesary'], answer: 0 }),
  m('WRD', 'phonics', 'mcq', 'explorer', 3, 'The plural of "child" is…', { choices: ['children', 'childs', 'childes', 'childies'], answer: 0 }),
  m('WRD', 'phonics', 'mcq', 'explorer', 3, 'The plural of "mouse" is…', { choices: ['mice', 'mouses', 'mowse', 'mices'], answer: 0 }),
  m('WRD', 'grammar', 'mcq', 'explorer', 3, 'Which contraction means "they are"?', { choices: ["they're", 'their', 'there', 'theyre'], answer: 0 }),
  m('WRD', 'grammar', 'mcq', 'explorer', 3, 'Which is the correct word: "I can\'t find ___ shoes."', { choices: ['my', 'mine', 'me', 'I'], answer: 0 }),
]
const MICROREAD: PackItem[] = [
  m('WRD', 'reading', 'mcq', 'explorer', 2, 'Read: "The puppy chewed the slipper, then hid under the sofa." Why did the puppy hide?', { choices: ['It knew it did something naughty', 'It was cold', 'It wanted a nap', 'It lost the slipper'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 2, 'Read: "Dark clouds gathered and the wind picked up." What will probably happen?', { choices: ['A storm', 'A sunny day', 'Snow in summer', 'Nothing'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 3, 'Read: "Ravi finished last but grinned, holding his finishing medal high." How does Ravi feel about NOT winning?', { choices: ['Proud he finished', 'Furious', 'Embarrassed', 'Bored'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 3, 'Read: "The library was silent except for the soft turning of pages." The mood is…', { choices: ['calm and peaceful', 'scary', 'exciting', 'angry'], answer: 0 }),
  m('WRD', 'reading', 'cloze', 'explorer', 3, 'Read: "After days with no rain, the river shrank to a trickle." The weather had been ___.', { before: 'had been ', after: '.', options: ['dry', 'wet', 'snowy', 'stormy'], answer: 'dry' }),
  m('WRD', 'reading', 'mcq', 'builder', 4, 'Read: "She said the cake was \'fine\' — barely touching it and pushing the plate away." What does she really think?', { choices: ['She does not like it', 'She loves it', 'She is full of cake', 'She baked it'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WONDER FACTS — quick science recall across strands
// ════════════════════════════════════════════════════════════
const WONFACT: PackItem[] = [
  m('WON', 'biology', 'mcq', 'explorer', 2, 'Which body system pumps blood?', { choices: ['Circulatory', 'Digestive', 'Nervous', 'Skeletal'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'explorer', 2, 'Insects have how many legs?', { choices: ['6', '8', '4', '10'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'explorer', 2, 'The gas plants release that we breathe is…', { choices: ['oxygen', 'carbon dioxide', 'helium', 'nitrogen'], answer: 0 }),
  m('WON', 'biology', 'sort', 'explorer', 3, 'Sort: vertebrate (has a backbone) or invertebrate?', { buckets: ['Vertebrate', 'Invertebrate'], items: [{ text: 'Frog', bucket: 0 }, { text: 'Worm', bucket: 1 }, { text: 'Eagle', bucket: 0 }, { text: 'Octopus', bucket: 1 }] }),
  m('WON', 'chemistry', 'mcq', 'explorer', 2, 'Water is made of hydrogen and…', { choices: ['oxygen', 'carbon', 'iron', 'salt'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'explorer', 3, 'When liquid water turns to gas it…', { choices: ['evaporates', 'freezes', 'melts', 'condenses'], answer: 0 }),
  m('WON', 'chemistry', 'sort', 'explorer', 3, 'Sort: acid or not? (taste/feel clues)', { buckets: ['Acidic', 'Not acidic'], items: [{ text: 'Lemon juice', bucket: 0 }, { text: 'Pure water', bucket: 1 }, { text: 'Vinegar', bucket: 0 }, { text: 'Milk (about neutral)', bucket: 1 }] }),
  m('WON', 'physics', 'mcq', 'explorer', 2, 'Which travels fastest?', { choices: ['Light', 'Sound', 'A car', 'A runner'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'explorer', 2, 'A force that slows sliding objects is…', { choices: ['friction', 'gravity', 'magnetism', 'sound'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'explorer', 3, 'Which material lets light pass through (transparent)?', { choices: ['Clear glass', 'Wood', 'Metal', 'Cardboard'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'explorer', 2, 'How many planets are in our solar system?', { choices: ['8', '9', '7', '10'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'explorer', 2, 'Which planet is known as the Red Planet?', { choices: ['Mars', 'Venus', 'Saturn', 'Neptune'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'explorer', 2, 'What is the centre of our solar system?', { choices: ['The Sun', 'The Moon', 'Earth', 'Jupiter'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'explorer', 3, 'Hot melted rock under the ground is called…', { choices: ['magma', 'lava ice', 'soil', 'coal'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  LOGIC FLUENCY — patterns, sequences, quick reasoning
// ════════════════════════════════════════════════════════════
const LOGFLOW: PackItem[] = [
  m('LOG', 'logic', 'type', 'explorer', 2, 'What number comes next? 2, 4, 6, 8, ?', { answer: '10', numeric: true, accept: ['10'] }),
  m('LOG', 'logic', 'type', 'explorer', 2, 'What number comes next? 5, 10, 15, 20, ?', { answer: '25', numeric: true, accept: ['25'] }),
  m('LOG', 'logic', 'type', 'explorer', 3, 'What number comes next? 1, 3, 9, 27, ?', { answer: '81', numeric: true, accept: ['81'] }, { explanation: 'Each ×3.' }),
  m('LOG', 'logic', 'type', 'explorer', 3, 'What number comes next? 1, 1, 2, 3, 5, 8, ?', { answer: '13', numeric: true, accept: ['13'] }, { explanation: 'Add the last two (Fibonacci).' }),
  m('LOG', 'logic', 'mcq', 'explorer', 3, 'Odd one out: apple, banana, carrot, grape.', { choices: ['carrot', 'apple', 'banana', 'grape'], answer: 0 }, { explanation: 'Carrot is a vegetable; the rest are fruit.' }),
  m('LOG', 'logic', 'mcq', 'explorer', 3, 'Odd one out: square, circle, triangle, cube.', { choices: ['cube', 'square', 'circle', 'triangle'], answer: 0 }, { explanation: 'Cube is 3-D; the rest are flat shapes.' }),
  m('LOG', 'logic', 'mcq', 'builder', 4, 'If A is taller than B, and B is taller than C, who is shortest?', { choices: ['C', 'A', 'B', 'Cannot tell'], answer: 0 }),
  m('LOG', 'logic', 'mcq', 'builder', 4, 'A code shifts each letter +1: "CAT" becomes…', { choices: ['DBU', 'BZS', 'CAT', 'ECV'], answer: 0 }),
  m('LOG', 'data', 'mcq', 'explorer', 3, 'In 4, 8, 8, 6, which value appears most (the mode)?', { choices: ['8', '4', '6', '18'], answer: 0 }),
  m('LOG', 'data', 'type', 'explorer', 3, 'Find the range of 3, 9, 5, 2 (biggest − smallest).', { answer: '7', numeric: true, accept: ['7'] }),
  m('LOG', 'code', 'fix', 'explorer', 3, 'Debug: a recipe loop bakes BEFORE mixing. Tap the step out of order.', { tokens: ['Bake', 'Mix', 'Pour'], wrong: 0, fix: 'Mix → Pour → Bake' }),
  m('LOG', 'ai', 'mcq', 'explorer', 3, 'A spam filter is an AI that learns to…', { choices: ['sort junk from real mail', 'send emails for you', 'delete everything', 'write poems'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WORLD FACTS — geography / history / economics breadth
// ════════════════════════════════════════════════════════════
const WLDFACT: PackItem[] = [
  m('WLD', 'geography', 'mcq', 'explorer', 2, 'Which is a continent?', { choices: ['Africa', 'Egypt', 'Paris', 'Nile'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'explorer', 2, 'The longest river in the world is generally said to be the…', { choices: ['Nile', 'Thames', 'Seine', 'Tiber'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'explorer', 2, 'A very dry, sandy region is called a…', { choices: ['desert', 'jungle', 'glacier', 'swamp'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'explorer', 3, 'The imaginary line around the middle of the Earth is the…', { choices: ['equator', 'horizon', 'border', 'tropic line only'], answer: 0 }),
  m('WLD', 'geography', 'match', 'explorer', 3, 'Match each landmark to its country.', { pairs: [['Eiffel Tower', 'France'], ['Great Wall', 'China'], ['Pyramids', 'Egypt'], ['Statue of Liberty', 'USA']] }),
  m('WLD', 'history', 'mcq', 'explorer', 2, 'People who study the past using objects they dig up are…', { choices: ['archaeologists', 'astronauts', 'chefs', 'pilots'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'A "decade" is how many years?', { choices: ['10', '100', '5', '1000'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'Stone Age people made tools mostly from…', { choices: ['stone and bone', 'plastic', 'steel', 'glass'], answer: 0 }),
  m('WLD', 'history', 'seq', 'explorer', 3, 'Order these from earliest to latest.', { items: ['Dinosaurs', 'Ancient Egypt', 'The Romans', 'Today'] }),
  m('WLD', 'history', 'mcq', 'builder', 4, 'A timeline helps historians see…', { choices: ['the order events happened in', 'who was tallest', 'the weather', 'prices'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 2, 'Swapping goods directly without money is called…', { choices: ['bartering', 'saving', 'taxing', 'banking'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'A place where buyers and sellers meet to trade is a…', { choices: ['market', 'museum', 'library', 'park'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'Putting money in a bank can earn extra money called…', { choices: ['interest', 'a fine', 'a fee', 'tax'], answer: 0 }),
  m('WLD', 'economics', 'sort', 'builder', 4, 'Sort: is this a good (object) or a service (action)?', { buckets: ['Good', 'Service'], items: [{ text: 'A bicycle', bucket: 0 }, { text: 'A haircut', bucket: 1 }, { text: 'An apple', bucket: 0 }, { text: 'A bus ride', bucket: 1 }] }),
]

// ════════════════════════════════════════════════════════════
//  LIFE — quick SEL + habits + daily quests (high repeat value)
// ════════════════════════════════════════════════════════════
const LIFE: PackItem[] = [
  m('LIF', 'kindness', 'mcq', 'explorer', 2, 'A good way to make a new friend is to…', { choices: ['ask a friendly question', 'ignore them', 'show off', 'tease them'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 2, 'Saying "thank you" shows…', { choices: ['gratitude', 'anger', 'boredom', 'fear'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 3, 'When you make a mistake, the best mindset is…', { choices: ['"I can learn from this"', '"I am useless"', '"I will hide it"', '"It is someone else\'s fault"'], answer: 0 }),
  m('LIF', 'habits', 'mcq', 'explorer', 2, 'Drinking enough water each day helps you…', { choices: ['stay focused and healthy', 'grow taller instantly', 'skip sleep', 'run forever'], answer: 0 }),
  m('LIF', 'habits', 'mcq', 'explorer', 3, 'A good way to remember tasks is to…', { choices: ['write a to-do list', 'hope you remember', 'do nothing', 'worry a lot'], answer: 0 }),
  m('LIF', 'habits', 'sort', 'explorer', 3, 'Sort: builds focus, or breaks focus while studying?', { buckets: ['Builds focus', 'Breaks focus'], items: [{ text: 'Quiet space', bucket: 0 }, { text: 'Phone buzzing', bucket: 1 }, { text: 'A clear goal', bucket: 0 }, { text: 'TV on loud', bucket: 1 }] }),
  m('LIF', 'movement', 'mcq', 'explorer', 2, 'Stretching before sport helps prevent…', { choices: ['injuries', 'fun', 'water', 'friends'], answer: 0 }),
  m('LIF', 'party', 'party', 'explorer', 2, 'Focus quest!', { quest: true, task: 'Spend 10 minutes tidying your study space.' }),
  m('LIF', 'party', 'party', 'explorer', 2, 'Kindness quest!', { quest: true, task: 'Say something encouraging to a friend or sibling today.' }),
  m('LIF', 'habits', 'party', 'explorer', 2, 'Healthy quest!', { quest: true, task: 'Eat a fruit or vegetable with your next meal.' }),
  m('LIF', 'movement', 'party', 'explorer', 2, 'Energy quest!', { quest: true, task: 'Go outside for 15 minutes of fresh air.' }),
  m('LIF', 'party', 'party', 'explorer', 1, 'Emoji guess', { prompt: 'Cold white stuff that falls in winter ❄️', reveal: '☃️ Snow!' }),
]

// ── Extra fluency volume (push the bank past months of daily drill) ──
const EXTRA: PackItem[] = [
  t('NUM', 'arith', 'starter', 1, '9 + 6 = ?', '15'),
  t('NUM', 'arith', 'starter', 1, '7 + 8 = ?', '15'),
  t('NUM', 'arith', 'starter', 2, '17 + 25 = ?', '42'),
  t('NUM', 'arith', 'explorer', 2, '63 + 29 = ?', '92'),
  t('NUM', 'arith', 'explorer', 3, '410 − 175 = ?', '235'),
  t('NUM', 'arith', 'explorer', 3, '350 + 275 = ?', '625'),
  t('NUM', 'times', 'starter', 2, '6 × 8 = ?', '48'),
  t('NUM', 'times', 'starter', 2, '9 × 7 = ?', '63'),
  t('NUM', 'times', 'explorer', 2, '12 × 8 = ?', '96'),
  t('NUM', 'times', 'explorer', 3, '13 × 7 = ?', '91'),
  t('NUM', 'times', 'explorer', 2, '56 ÷ 7 = ?', '8'),
  t('NUM', 'times', 'explorer', 3, '120 ÷ 8 = ?', '15'),
  m('NUM', 'fractions', 'type', 'explorer', 3, 'What is 2/3 of 18?', { answer: '12', numeric: true, accept: ['12'] }),
  m('NUM', 'money', 'type', 'explorer', 3, 'Four tickets cost $26 in total. How much is one (in dollars)?', { answer: '6.5', numeric: true, accept: ['6.5', '6.50'] }),
  m('NUM', 'time', 'mcq', 'explorer', 3, 'A clock shows 09:45. What time is it 40 minutes later?', { choices: ['10:25', '10:15', '09:85', '11:25'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'SYNONYM of "happy"?', { choices: ['cheerful', 'gloomy', 'tired', 'angry'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 2, 'ANTONYM of "ancient"?', { choices: ['modern', 'old', 'dusty', 'huge'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, '"Timid" means…', { choices: ['shy', 'brave', 'loud', 'fast'], answer: 0 }),
  m('WRD', 'grammar', 'mcq', 'explorer', 3, 'Which word is an ADVERB?', { choices: ['slowly', 'slow', 'snail', 'sleepy'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 3, 'Read: "The ice cream melted into a puddle on the hot pavement." What does this tell you about the day?', { choices: ['It was very hot', 'It was snowing', 'It was night', 'It was raining'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'explorer', 2, 'Which organ helps you think?', { choices: ['Brain', 'Liver', 'Lungs', 'Skin'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'explorer', 3, 'Sound needs something to travel through. In empty space (vacuum), sound…', { choices: ['cannot travel', 'travels faster', 'turns to light', 'gets louder'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'explorer', 2, 'The natural satellite of Earth is the…', { choices: ['Moon', 'Sun', 'Mars', 'Comet'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'explorer', 3, 'Ice, water and steam are all the same substance in different…', { choices: ['states', 'colours', 'planets', 'sizes'], answer: 0 }),
  m('LOG', 'logic', 'type', 'explorer', 2, 'What comes next? 3, 6, 9, 12, ?', { answer: '15', numeric: true, accept: ['15'] }),
  m('LOG', 'data', 'type', 'explorer', 3, 'Find the mean of 2, 4, 6.', { answer: '4', numeric: true, accept: ['4'] }),
  m('WLD', 'geography', 'mcq', 'explorer', 2, 'Which is NOT an ocean?', { choices: ['Sahara', 'Pacific', 'Atlantic', 'Indian'], answer: 0 }, { explanation: 'The Sahara is a desert.' }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'A "millennium" is how many years?', { choices: ['1000', '100', '10', '500'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'Spending less than you earn lets you build…', { choices: ['savings', 'debt', 'fines', 'taxes'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 2, 'A friend wins and you lose. A good sport says…', { choices: ['"Well played!"', '"You cheated!"', 'nothing, and sulks', '"This is unfair!"'], answer: 0 }),
  m('LIF', 'habits', 'party', 'explorer', 2, 'Learning quest!', { quest: true, task: 'Teach someone one thing you learned today.' }),
]

export const CONTENT_PACK_6: PackItem[] = [
  ...ADD, ...TIMES, ...NFACT,
  ...VOCAB, ...SPELL, ...MICROREAD,
  ...WONFACT, ...LOGFLOW, ...WLDFACT, ...LIFE,
  ...EXTRA,
]
