// ============================================================
//  ARGANTALAB · CONTENT PACK 7 — FULL-RANGE BREADTH (tiny → legend)
//  Big, age-graded coverage across all six worlds so every level (Tiny, Starter,
//  Explorer, Builder, Champion, Legend) has real, factually-correct questions in
//  every skill. Diverse interaction types (mcq / type / cloze / match / sort /
//  seq / multi). Self-contained — no import of learn.ts. All facts checked.
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
  ({ id: `cp7_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })

// terse authoring helpers (one per common interaction)
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) =>
  base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const tp = (w: string, s: string, st: string, d: number, p: string, ans: string, numeric = false, e?: string) =>
  base(w, s, 'type', st, d, p, { answer: ans, numeric, accept: [ans] }, e)
const cz = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) =>
  base(w, s, 'cloze', st, d, `${before}___${after}`.trim(), { before, after, options, answer }, e)
const mt = (w: string, s: string, st: string, d: number, p: string, pairs: [string, string][], e?: string) =>
  base(w, s, 'match', st, d, p, { pairs }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) =>
  base(w, s, 'sort', st, d, p, { buckets, items }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) =>
  base(w, s, 'seq', st, d, p, { items }, e)

// ════════════════════════════════════════════════════════════
//  NUMBER (NUM)  · placevalue arith times fractions money measure time geometry
// ════════════════════════════════════════════════════════════
const NUM: PackItem[] = [
  // — tiny —
  mc('NUM', 'arith', 'tiny', 1, 'How many? 🍎🍎🍎', ['2', '3', '4', '5'], 1, 'Count: 1, 2, 3.'),
  mc('NUM', 'arith', 'tiny', 1, 'What comes after 7?', ['6', '8', '9', '10'], 1),
  mc('NUM', 'arith', 'tiny', 1, 'Which is more?', ['🐟🐟', '🐟🐟🐟🐟', 'same', 'none'], 1),
  tp('NUM', 'arith', 'tiny', 1, '2 + 1 = ?', '3', true),
  tp('NUM', 'arith', 'tiny', 1, '4 + 1 = ?', '5', true),
  mc('NUM', 'geometry', 'tiny', 1, 'Which one is a circle?', ['▲', '⬛', '●', '⬟'], 2),
  mc('NUM', 'geometry', 'tiny', 1, 'How many sides does a triangle have?', ['2', '3', '4', '5'], 1),
  sq('NUM', 'placevalue', 'tiny', 1, 'Count up — put in order.', ['1', '2', '3', '4', '5']),
  // — starter —
  tp('NUM', 'arith', 'starter', 1, '8 + 6 = ?', '14', true),
  tp('NUM', 'arith', 'starter', 2, '23 + 19 = ?', '42', true),
  tp('NUM', 'arith', 'starter', 2, '50 − 24 = ?', '26', true),
  mc('NUM', 'placevalue', 'starter', 2, 'In 47, the 4 stands for…', ['4 ones', '4 tens', '4 hundreds', '40 tens'], 1, '4 tens = 40.'),
  tp('NUM', 'placevalue', 'starter', 2, 'What is 30 + 5?', '35', true),
  mc('NUM', 'fractions', 'starter', 2, 'Half of 10 is…', ['2', '4', '5', '6'], 2),
  tp('NUM', 'times', 'starter', 2, '5 × 2 = ?', '10', true),
  tp('NUM', 'times', 'starter', 2, '3 × 4 = ?', '12', true),
  mc('NUM', 'money', 'starter', 2, 'Which coin is worth the most?', ['1¢', '5¢', '10¢', '25¢'], 3),
  mc('NUM', 'geometry', 'starter', 2, 'A shape with 4 equal sides is a…', ['triangle', 'square', 'circle', 'pentagon'], 1),
  // — explorer —
  tp('NUM', 'times', 'explorer', 2, '7 × 8 = ?', '56', true),
  tp('NUM', 'times', 'explorer', 2, '9 × 6 = ?', '54', true),
  tp('NUM', 'arith', 'explorer', 3, '128 + 95 = ?', '223', true),
  mc('NUM', 'fractions', 'explorer', 2, 'Which fraction is biggest?', ['1/2', '1/3', '1/4', '1/8'], 0, 'Smaller bottom number = bigger piece.'),
  mc('NUM', 'fractions', 'explorer', 3, '1/2 equals…', ['2/4', '1/4', '3/4', '2/3'], 0),
  tp('NUM', 'money', 'explorer', 2, 'You buy a $4 toy with a $10 note. Change?', '6', true),
  mc('NUM', 'measure', 'explorer', 2, 'Perimeter of a square with side 5?', ['10', '15', '20', '25'], 2, '4 × 5 = 20.'),
  mc('NUM', 'time', 'explorer', 2, 'How many minutes in an hour?', ['30', '60', '90', '100'], 1),
  mc('NUM', 'geometry', 'explorer', 3, 'How many faces does a cube have?', ['4', '6', '8', '12'], 1),
  so('NUM', 'geometry', 'explorer', 3, 'Sort the shapes.', ['3 sides', '4 sides'], [
    { text: 'Triangle', bucket: 0 }, { text: 'Square', bucket: 1 }, { text: 'Rectangle', bucket: 1 }, { text: 'Equilateral', bucket: 0 }]),
  // — builder —
  tp('NUM', 'arith', 'builder', 3, '144 ÷ 12 = ?', '12', true),
  mc('NUM', 'fractions', 'builder', 3, '0.75 as a fraction is…', ['1/4', '3/4', '7/5', '1/2'], 1),
  mc('NUM', 'fractions', 'builder', 3, '25% of 80 is…', ['16', '20', '25', '40'], 1, '80 ÷ 4 = 20.'),
  tp('NUM', 'arith', 'builder', 4, '−5 + 8 = ?', '3', true),
  mc('NUM', 'measure', 'builder', 3, 'Area of a rectangle 6 × 4?', ['10', '20', '24', '48'], 2),
  mc('NUM', 'placevalue', 'builder', 3, 'In 3,205 the 2 is in the… place', ['tens', 'hundreds', 'thousands', 'ones'], 1),
  mc('NUM', 'geometry', 'builder', 3, 'Angles in a triangle add to…', ['90°', '180°', '270°', '360°'], 1),
  // — champion —
  mc('NUM', 'arith', 'champion', 4, 'Which number is prime?', ['21', '27', '29', '33'], 2, '29 has no factors but 1 and itself.'),
  tp('NUM', 'times', 'champion', 4, '2^5 = ?', '32', true),
  mc('NUM', 'fractions', 'champion', 4, 'Simplify 18/24', ['2/3', '3/4', '6/8', '9/12'], 1),
  mc('NUM', 'arith', 'champion', 4, 'Ratio 3:5 — if 3 parts = 12, total parts value?', ['20', '24', '32', '40'], 2, '1 part=4, 8 parts=32.'),
  mc('NUM', 'geometry', 'champion', 4, 'Angles in a quadrilateral add to…', ['180°', '270°', '360°', '540°'], 2),
  // — legend —
  mc('NUM', 'arith', 'legend', 5, 'Solve x: 2x + 5 = 17', ['4', '5', '6', '7'], 2, '2x=12, x=6.'),
  mc('NUM', 'fractions', 'legend', 5, 'Probability of rolling an even number on a die?', ['1/6', '1/3', '1/2', '2/3'], 2, '3 of 6 outcomes.'),
  mc('NUM', 'geometry', 'legend', 5, 'Area of a circle radius 3 (π≈3.14)?', ['9.42', '18.84', '28.26', '6.28'], 2, 'πr² = 3.14×9.'),
]

// ════════════════════════════════════════════════════════════
//  WORD (WRD)  · phonics grammar vocab reading writing
// ════════════════════════════════════════════════════════════
const WRD: PackItem[] = [
  // tiny
  mc('WRD', 'phonics', 'tiny', 1, 'Which word rhymes with CAT?', ['dog', 'hat', 'sun', 'cup'], 1),
  mc('WRD', 'phonics', 'tiny', 1, 'What sound does 🐍 make? "sss" — which letter?', ['S', 'B', 'M', 'T'], 0),
  mc('WRD', 'vocab', 'tiny', 1, 'Which is an animal?', ['chair', 'dog', 'apple', 'shoe'], 1),
  mc('WRD', 'phonics', 'tiny', 1, 'First letter of "ball"?', ['d', 'b', 'p', 'g'], 1),
  // starter
  cz('WRD', 'grammar', 'starter', 1, 'The cat ', ' on the mat.', ['sit', 'sits', 'sitting'], 'sits', 'One cat → "sits".'),
  mc('WRD', 'phonics', 'starter', 2, 'Plural of "box"?', ['boxs', 'boxes', 'boxen', 'box'], 1),
  mc('WRD', 'grammar', 'starter', 2, 'Which needs a capital letter?', ['dog', 'london', 'happy', 'run'], 1, 'Place names are proper nouns.'),
  mc('WRD', 'vocab', 'starter', 2, 'Opposite of "hot"?', ['warm', 'cold', 'big', 'fast'], 1),
  mc('WRD', 'vocab', 'starter', 2, 'Opposite of "up"?', ['side', 'down', 'over', 'in'], 1),
  // explorer
  mc('WRD', 'grammar', 'explorer', 2, 'Which word is a verb?', ['quickly', 'jump', 'happy', 'blue'], 1, 'A verb is an action.'),
  mc('WRD', 'grammar', 'explorer', 2, 'Which word is a noun?', ['run', 'teacher', 'bright', 'slowly'], 1),
  mc('WRD', 'vocab', 'explorer', 2, 'A synonym for "happy" is…', ['sad', 'joyful', 'angry', 'tired'], 1),
  mc('WRD', 'vocab', 'explorer', 2, 'A synonym for "big" is…', ['tiny', 'huge', 'thin', 'quiet'], 1),
  mc('WRD', 'grammar', 'explorer', 3, 'Which sentence is correct?', ['I goed home.', 'I went home.', 'I gone home.', 'I going home.'], 1),
  mc('WRD', 'reading', 'explorer', 3, '"The sky turned grey and rain fell." The weather is…', ['sunny', 'stormy', 'snowy', 'dry'], 1),
  so('WRD', 'grammar', 'explorer', 3, 'Sort by word type.', ['Noun', 'Verb'], [
    { text: 'dog', bucket: 0 }, { text: 'run', bucket: 1 }, { text: 'school', bucket: 0 }, { text: 'sing', bucket: 1 }]),
  // builder
  mc('WRD', 'vocab', 'builder', 3, 'The prefix "un-" means…', ['again', 'not', 'before', 'after'], 1, 'unhappy = not happy.'),
  mc('WRD', 'vocab', 'builder', 3, '"Bi-" in bicycle means…', ['one', 'two', 'three', 'many'], 1),
  mc('WRD', 'grammar', 'builder', 3, 'Past tense of "buy"?', ['buyed', 'bought', 'buys', 'buying'], 1),
  mc('WRD', 'grammar', 'builder', 3, 'Which uses correct punctuation?', ['Wow, what a day!', 'Wow what a day', 'wow, what a day.', 'Wow! what a day?'], 0),
  cz('WRD', 'grammar', 'builder', 3, "They ", " their homework yesterday.", ['finish', 'finished', 'finishes'], 'finished', 'Yesterday → past tense.'),
  // champion
  mc('WRD', 'vocab', 'champion', 4, '"The classroom was a zoo" is a…', ['simile', 'metaphor', 'rhyme', 'pun'], 1, 'Metaphor = says one thing IS another.'),
  mc('WRD', 'vocab', 'champion', 4, '"As brave as a lion" is a…', ['metaphor', 'simile', 'alliteration', 'idiom'], 1, 'Simile uses "as/like".'),
  mc('WRD', 'grammar', 'champion', 4, 'Which is a conjunction?', ['because', 'happy', 'quickly', 'mountain'], 0),
  // legend
  mc('WRD', 'reading', 'legend', 5, '"It cost an arm and a leg" means it was…', ['cheap', 'very expensive', 'broken', 'painful'], 1, 'An idiom for costly.'),
  mc('WRD', 'writing', 'legend', 5, 'The author wants to PERSUADE. Best opener?', ['Once upon a time…', 'Surely we must act now.', 'The cell has a nucleus.', 'Mix flour and eggs.'], 1),
]

// ════════════════════════════════════════════════════════════
//  WONDER (WON) · biology chemistry physics earth
// ════════════════════════════════════════════════════════════
const WON: PackItem[] = [
  // tiny
  mc('WON', 'biology', 'tiny', 1, 'Which animal can fly?', ['fish', 'bird', 'dog', 'snake'], 1),
  mc('WON', 'earth', 'tiny', 1, 'We see the Sun during the…', ['night', 'day', 'rain', 'snow'], 1),
  mc('WON', 'biology', 'tiny', 1, 'What do we use to see?', ['ears', 'eyes', 'nose', 'feet'], 1),
  // starter
  so('WON', 'biology', 'starter', 2, 'Living or not living?', ['Living', 'Not living'], [
    { text: 'Tree', bucket: 0 }, { text: 'Rock', bucket: 1 }, { text: 'Cat', bucket: 0 }, { text: 'Chair', bucket: 1 }]),
  mc('WON', 'biology', 'starter', 2, 'Which part of a plant takes in water?', ['leaf', 'flower', 'roots', 'petal'], 2),
  mc('WON', 'earth', 'starter', 2, 'Frozen water is…', ['steam', 'ice', 'cloud', 'rain'], 1),
  mc('WON', 'physics', 'starter', 2, 'Which is heavier?', ['a feather', 'a brick', 'same', 'paper'], 1),
  // explorer
  mc('WON', 'chemistry', 'explorer', 2, 'Water turning to ice is a change of…', ['colour', 'state', 'smell', 'mass'], 1),
  mc('WON', 'earth', 'explorer', 2, 'How many planets in our Solar System?', ['7', '8', '9', '10'], 1, 'Mercury…Neptune.'),
  mc('WON', 'earth', 'explorer', 2, 'Closest planet to the Sun?', ['Earth', 'Venus', 'Mercury', 'Mars'], 2),
  mc('WON', 'biology', 'explorer', 3, 'A food chain usually starts with a…', ['lion', 'plant', 'shark', 'eagle'], 1, 'Plants make their own food.'),
  so('WON', 'biology', 'explorer', 3, 'Group the animals.', ['Mammal', 'Reptile'], [
    { text: 'Dog', bucket: 0 }, { text: 'Snake', bucket: 1 }, { text: 'Whale', bucket: 0 }, { text: 'Lizard', bucket: 1 }]),
  mc('WON', 'physics', 'explorer', 3, 'What pulls things down to Earth?', ['magnetism', 'gravity', 'friction', 'wind'], 1),
  // builder
  mc('WON', 'biology', 'builder', 3, 'The "powerhouse of the cell" is the…', ['nucleus', 'mitochondria', 'membrane', 'ribosome'], 1),
  mc('WON', 'chemistry', 'builder', 3, 'Water is made of hydrogen and…', ['oxygen', 'nitrogen', 'carbon', 'helium'], 0, 'H₂O.'),
  mc('WON', 'earth', 'builder', 3, 'The water cycle step where vapour becomes clouds is…', ['evaporation', 'condensation', 'precipitation', 'collection'], 1),
  mc('WON', 'physics', 'builder', 3, 'Speed = distance ÷ …', ['mass', 'time', 'force', 'area'], 1),
  // champion
  mc('WON', 'biology', 'champion', 4, 'Photosynthesis turns sunlight, water and CO₂ into glucose and…', ['nitrogen', 'oxygen', 'salt', 'protein'], 1),
  mc('WON', 'physics', 'champion', 4, "Newton's 1st law is about…", ['gravity', 'inertia', 'magnetism', 'heat'], 1, 'Objects keep their motion unless a force acts.'),
  mc('WON', 'chemistry', 'champion', 4, 'The smallest unit of an element is an…', ['atom', 'cell', 'molecule', 'organ'], 0),
  // legend
  mc('WON', 'biology', 'legend', 5, 'Genes are made of…', ['RNA only', 'DNA', 'protein', 'lipids'], 1),
  mc('WON', 'physics', 'legend', 5, 'Energy cannot be created or destroyed — this is the law of…', ['gravity', 'conservation of energy', 'relativity', 'entropy decrease'], 1),
]

// ════════════════════════════════════════════════════════════
//  LOGIC (LOG) · code data ai logic
// ════════════════════════════════════════════════════════════
const LOG: PackItem[] = [
  // tiny
  mc('LOG', 'logic', 'tiny', 1, 'What comes next? 🔴🔵🔴🔵🔴…', ['🔴', '🔵', '🟡', '🟢'], 1),
  mc('LOG', 'logic', 'tiny', 1, 'Which is different?', ['🐶', '🐶', '🐱', '🐶'], 2),
  sq('LOG', 'logic', 'tiny', 1, 'Order: small to big.', ['🐭', '🐱', '🐘']),
  // starter
  sq('LOG', 'logic', 'starter', 2, 'What comes next? 2, 4, 6, …', ['2', '4', '6', '8']),
  mc('LOG', 'logic', 'starter', 2, 'If it rains, you take an umbrella. It rains. You take…', ['nothing', 'an umbrella', 'a hat', 'shoes'], 1),
  mc('LOG', 'data', 'starter', 2, 'A tally of ||| means…', ['1', '2', '3', '5'], 2),
  // explorer
  mc('LOG', 'logic', 'explorer', 2, 'TRUE or FALSE: 5 > 9', ['True', 'False', 'Maybe', 'Both'], 1),
  mc('LOG', 'code', 'explorer', 3, 'A "loop" lets a computer…', ['stop forever', 'repeat steps', 'delete files', 'change colour'], 1),
  sq('LOG', 'code', 'explorer', 3, 'Order the steps to make tea.', ['Boil water', 'Add tea bag', 'Pour water', 'Stir']),
  mc('LOG', 'ai', 'explorer', 3, 'AI learns patterns from…', ['magic', 'examples (data)', 'guessing only', 'nothing'], 1),
  // builder
  mc('LOG', 'code', 'builder', 3, 'An "if" statement runs code only when something is…', ['colourful', 'true', 'fast', 'big'], 1),
  mc('LOG', 'data', 'builder', 3, 'In binary, the number 2 is written…', ['10', '11', '01', '20'], 0),
  mc('LOG', 'code', 'builder', 3, 'A box that stores a value is a…', ['loop', 'variable', 'pixel', 'cable'], 1),
  so('LOG', 'logic', 'builder', 3, 'True or False?', ['True', 'False'], [
    { text: '3 + 3 = 6', bucket: 0 }, { text: '7 is even', bucket: 1 }, { text: '10 > 2', bucket: 0 }, { text: 'A square has 3 sides', bucket: 1 }]),
  // champion
  mc('LOG', 'code', 'champion', 4, 'A reusable block of code that does one job is a…', ['function', 'pixel', 'folder', 'cable'], 0),
  mc('LOG', 'logic', 'champion', 4, 'AND is only true when…', ['either is true', 'both are true', 'neither is true', 'always'], 1),
  mc('LOG', 'ai', 'champion', 4, '"Training data" that is biased makes an AI…', ['faster', 'unfair', 'smaller', 'colourful'], 1),
  // legend
  mc('LOG', 'code', 'legend', 5, 'A function that calls itself is…', ['a loop', 'recursion', 'a variable', 'an array'], 1),
  mc('LOG', 'logic', 'legend', 5, 'NOT(True AND False) = ?', ['True', 'False', 'Error', 'Both'], 0, 'True AND False = False; NOT False = True.'),
]

// ════════════════════════════════════════════════════════════
//  WORLD (WLD) · geography history economics
// ════════════════════════════════════════════════════════════
const WLD: PackItem[] = [
  // tiny
  mc('WLD', 'geography', 'tiny', 1, 'The big blue water is the…', ['desert', 'ocean', 'forest', 'mountain'], 1),
  mc('WLD', 'geography', 'tiny', 1, 'Where do we live — on…', ['the Moon', 'Earth', 'the Sun', 'Mars'], 1),
  // starter
  mc('WLD', 'geography', 'starter', 2, 'How many continents are there?', ['5', '6', '7', '8'], 2),
  mc('WLD', 'geography', 'starter', 2, 'Which is the largest ocean?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 2),
  so('WLD', 'geography', 'starter', 2, 'Land or water?', ['Land', 'Water'], [
    { text: 'Mountain', bucket: 0 }, { text: 'River', bucket: 1 }, { text: 'Desert', bucket: 0 }, { text: 'Lake', bucket: 1 }]),
  // explorer
  mc('WLD', 'geography', 'explorer', 2, 'Capital of France?', ['Madrid', 'Paris', 'Rome', 'Berlin'], 1),
  mc('WLD', 'geography', 'explorer', 2, 'Capital of Japan?', ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], 2),
  mc('WLD', 'geography', 'explorer', 3, 'The Sahara is a huge…', ['ocean', 'desert', 'forest', 'city'], 1),
  mc('WLD', 'history', 'explorer', 3, 'The Great Pyramids are in…', ['Greece', 'Egypt', 'Italy', 'China'], 1),
  mc('WLD', 'economics', 'explorer', 3, 'Money you set aside for later is your…', ['spending', 'savings', 'tax', 'loan'], 1),
  // builder
  mc('WLD', 'geography', 'builder', 3, 'The longest river in the world is the…', ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], 1, 'The Nile (~6,650 km).'),
  mc('WLD', 'history', 'builder', 3, 'Ancient Romans spoke…', ['Greek', 'Latin', 'English', 'Arabic'], 1),
  mc('WLD', 'economics', 'builder', 3, 'When demand is high and supply low, prices usually…', ['fall', 'rise', 'stay equal', 'vanish'], 1),
  mc('WLD', 'geography', 'builder', 4, 'Which line splits Earth into North and South?', ['Prime Meridian', 'Equator', 'Tropic', 'Axis'], 1),
  // champion
  mc('WLD', 'history', 'champion', 4, 'World War II ended in the year…', ['1918', '1939', '1945', '1955'], 2),
  mc('WLD', 'economics', 'champion', 4, 'A rise in overall prices over time is called…', ['interest', 'inflation', 'profit', 'budget'], 1),
  mc('WLD', 'geography', 'champion', 4, 'The largest country by area is…', ['Canada', 'China', 'Russia', 'USA'], 2),
  // legend
  mc('WLD', 'economics', 'legend', 5, 'GDP measures a country’s…', ['population', 'total output', 'land area', 'army size'], 1),
  mc('WLD', 'history', 'legend', 5, 'The Industrial Revolution began in…', ['France', 'Britain', 'Japan', 'Brazil'], 1),
]

// ════════════════════════════════════════════════════════════
//  LIFE (LIF) · habits kindness movement party
// ════════════════════════════════════════════════════════════
const LIF: PackItem[] = [
  mc('LIF', 'habits', 'tiny', 1, 'Before eating, you should…', ['jump', 'wash hands', 'sleep', 'shout'], 1),
  mc('LIF', 'habits', 'starter', 1, 'How many hours of sleep do kids need?', ['2–3', '4–5', '9–11', '14–16'], 2),
  mc('LIF', 'kindness', 'starter', 1, 'Your friend is sad. The kind thing to do is…', ['ignore them', 'ask if they’re okay', 'laugh', 'walk away'], 1),
  mc('LIF', 'movement', 'starter', 2, 'Which warms up your body?', ['sitting still', 'jumping jacks', 'sleeping', 'reading'], 1),
  mc('LIF', 'habits', 'explorer', 2, 'Which is the healthiest snack?', ['candy bar', 'an apple', 'soda', 'chips'], 1),
  mc('LIF', 'kindness', 'explorer', 2, 'Someone drops their books. You…', ['step over them', 'help pick them up', 'laugh', 'run'], 1),
  mc('LIF', 'habits', 'explorer', 3, 'Brushing teeth keeps away…', ['friends', 'cavities', 'homework', 'sleep'], 1),
  mc('LIF', 'movement', 'explorer', 3, 'Drinking water during exercise helps you stay…', ['tired', 'hydrated', 'hungry', 'cold'], 1),
  mc('LIF', 'habits', 'builder', 3, 'A good way to handle big feelings is to…', ['hold your breath', 'take slow deep breaths', 'shout at people', 'skip meals'], 1),
  mc('LIF', 'kindness', 'builder', 3, 'Sharing credit for teamwork shows…', ['selfishness', 'respect', 'fear', 'boredom'], 1),
  base('LIF', 'party', 'party', 'starter', 1, 'Quest: do one kind thing for a family member today.', { task: 'Do one kind thing for someone at home', quest: true }),
  base('LIF', 'party', 'party', 'explorer', 1, 'Quest: tidy your space for 5 minutes.', { task: 'Tidy your space for 5 minutes', quest: true }),
  base('LIF', 'party', 'party', 'builder', 1, 'Quest: move your body for 10 minutes.', { task: 'Move your body for 10 minutes', quest: true }),
]

export const CONTENT_PACK_7: PackItem[] = [...NUM, ...WRD, ...WON, ...LOG, ...WLD, ...LIF]
