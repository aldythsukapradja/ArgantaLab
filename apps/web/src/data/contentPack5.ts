// ============================================================
//  ARGANTALAB · CONTENT PACK 5  — ROBUST DAILY-DRILL VOLUME
//  Goal: enough variety that a kid drilling daily for months rarely
//  sees a repeat. Broadens every world×skill cell, fills the thin
//  ones (WLD history/economics, LIF, WON physics/chemistry), and adds
//  more higher-order Bloom (analyse / create) across Explorer→Champion.
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
  return { id: `cp5_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, xp: 12, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  NUMBERDASH — number sense across every strand & stage
// ════════════════════════════════════════════════════════════
const NUM: PackItem[] = [
  // — Starter (6–8) —
  m('NUM', 'placevalue', 'mcq', 'starter', 1, 'Which number is bigger?', { choices: ['37', '73', '17', '7'], answer: 1 }),
  m('NUM', 'placevalue', 'type', 'starter', 1, 'What number comes right after 49?', { answer: '50', numeric: true, accept: ['50'] }),
  m('NUM', 'arith', 'type', 'starter', 1, 'What is 8 + 7?', { answer: '15', numeric: true, accept: ['15'] }, { hint: 'Make 10 first: 8 + 2 = 10, then + 5.' }),
  m('NUM', 'arith', 'type', 'starter', 2, 'What is 14 − 6?', { answer: '8', numeric: true, accept: ['8'] }),
  m('NUM', 'arith', 'speed', 'starter', 1, 'Quick! 5 + 5 + 5 = ?', { answer: '15', numeric: true, accept: ['15'] }),
  m('NUM', 'times', 'mcq', 'starter', 2, 'How many legs do 3 dogs have?', { choices: ['12', '6', '9', '8'], answer: 0 }, { explanation: '3 × 4 = 12.' }),
  m('NUM', 'money', 'mcq', 'starter', 1, 'You have 2 coins worth 50¢ each. How much is that?', { choices: ['$1.00', '50¢', '$2.00', '25¢'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'starter', 1, 'Which is longer?', { choices: ['A bus', 'A pencil', 'An ant', 'A coin'], answer: 0 }),
  m('NUM', 'time', 'mcq', 'starter', 2, 'The big hand points to 12 and the little hand to 3. What time is it?', { choices: ['3 o\'clock', '12 o\'clock', 'Half past 3', 'Noon'], answer: 0 }),
  m('NUM', 'geometry', 'sort', 'starter', 2, 'Sort: which shapes have corners?', { buckets: ['Has corners', 'No corners'], items: [{ text: 'Square', bucket: 0 }, { text: 'Circle', bucket: 1 }, { text: 'Triangle', bucket: 0 }, { text: 'Ball', bucket: 1 }] }),
  // — Explorer (8–11) —
  m('NUM', 'placevalue', 'type', 'explorer', 2, 'Write the number: three thousand and forty.', { answer: '3040', numeric: true, accept: ['3040', '3,040'] }),
  m('NUM', 'placevalue', 'mcq', 'explorer', 3, 'Round 3,847 to the nearest hundred.', { choices: ['3,800', '3,900', '3,850', '4,000'], answer: 0 }, { explanation: '47 rounds down, so 3,800.' }),
  m('NUM', 'arith', 'type', 'explorer', 3, 'What is 256 + 178?', { answer: '434', numeric: true, accept: ['434'] }),
  m('NUM', 'arith', 'type', 'explorer', 3, 'What is 503 − 268?', { answer: '235', numeric: true, accept: ['235'] }),
  m('NUM', 'arith', 'fix', 'explorer', 3, 'Spot the wrong step: 64 ÷ 8 = 7 → 7 × 8 = 56.', { tokens: ['64 ÷ 8 = 7', '→', '7 × 8 = 56'], wrong: 0, fix: '64 ÷ 8 = 8' }, { explanation: '64 ÷ 8 = 8, not 7.' }),
  m('NUM', 'times', 'speed', 'explorer', 2, 'Quick! 7 × 6 = ?', { answer: '42', numeric: true, accept: ['42'] }),
  m('NUM', 'times', 'type', 'explorer', 3, 'A theatre has 12 rows of 15 seats. How many seats in total?', { answer: '180', numeric: true, accept: ['180'] }, { explanation: '12 × 15 = 180.' }),
  m('NUM', 'fractions', 'mcq', 'explorer', 3, 'Which fraction is the largest?', { choices: ['3/4', '1/2', '2/5', '1/4'], answer: 0 }),
  m('NUM', 'fractions', 'numline', 'explorer', 3, 'Place 2/5 on the number line.', { min: 0, max: 1, answer: 0.4, tol: 0.06, label: '2/5' }),
  m('NUM', 'fractions', 'type', 'explorer', 3, 'What is 1/2 + 1/4? (write as a fraction like 3/4)', { answer: '3/4', accept: ['3/4'] }, { explanation: '1/2 = 2/4, so 2/4 + 1/4 = 3/4.' }),
  m('NUM', 'money', 'type', 'explorer', 3, 'Three pens cost $4.50 in total. How much is ONE pen (in dollars)?', { answer: '1.5', numeric: true, accept: ['1.5', '1.50'] }, { explanation: '4.50 ÷ 3 = 1.50.' }),
  m('NUM', 'money', 'mcq', 'explorer', 3, 'You buy items for $3.25 and $4.80. About how much, rounded to the nearest dollar?', { choices: ['$8', '$7', '$9', '$10'], answer: 0 }, { explanation: '$3 + $5 ≈ $8.' }),
  m('NUM', 'measure', 'type', 'explorer', 3, 'A jug holds 2 litres. How many millilitres is that?', { answer: '2000', numeric: true, accept: ['2000', '2,000'] }, { explanation: '1 L = 1000 mL.' }),
  m('NUM', 'measure', 'mcq', 'explorer', 3, 'A pencil is about 15 ___ long.', { choices: ['cm', 'm', 'km', 'mL'], answer: 0 }),
  m('NUM', 'time', 'type', 'explorer', 3, 'How many minutes are there in 2 and a half hours?', { answer: '150', numeric: true, accept: ['150'] }, { explanation: '2.5 × 60 = 150.' }),
  m('NUM', 'time', 'mcq', 'explorer', 3, 'A train leaves at 14:20 and arrives at 16:05. How long is the journey?', { choices: ['1 h 45 min', '2 h 15 min', '1 h 15 min', '2 h 45 min'], answer: 0 }),
  m('NUM', 'geometry', 'mcq', 'explorer', 3, 'A square has a side of 6 cm. What is its AREA?', { choices: ['36 cm²', '24 cm²', '12 cm²', '18 cm²'], answer: 0 }, { explanation: 'Area = side × side = 6 × 6 = 36.' }),
  m('NUM', 'geometry', 'label', 'explorer', 3, 'Match each shape to its number of sides.', { pairs: [['Pentagon', '5'], ['Hexagon', '6'], ['Triangle', '3'], ['Octagon', '8']] }),
  m('NUM', 'geometry', 'mcq', 'explorer', 2, 'An angle that is exactly 90° is called a…', { choices: ['Right angle', 'Straight angle', 'Acute angle', 'Obtuse angle'], answer: 0 }),
  // — Builder (11–14) —
  m('NUM', 'arith', 'type', 'builder', 4, 'Solve for x: 3x = 24.', { answer: '8', numeric: true, accept: ['8'] }),
  m('NUM', 'arith', 'mcq', 'builder', 4, 'What is the value of 2 + 3 × 4? (order of operations)', { choices: ['14', '20', '24', '9'], answer: 0 }, { explanation: 'Multiply first: 3×4=12, then +2 = 14.' }),
  m('NUM', 'fractions', 'type', 'builder', 4, 'What is 3/5 of 60?', { answer: '36', numeric: true, accept: ['36'] }, { explanation: '60 ÷ 5 = 12, × 3 = 36.' }),
  m('NUM', 'fractions', 'mcq', 'builder', 4, 'Which decimal equals 7/10?', { choices: ['0.7', '0.07', '7.0', '0.71'], answer: 0 }),
  m('NUM', 'money', 'mcq', 'builder', 4, 'A $60 game is 25% off, then $5 extra off. Final price?', { choices: ['$40', '$45', '$35', '$50'], answer: 0 }, { explanation: '25% of 60 = 15 → 45, then − 5 = 40.' }),
  m('NUM', 'times', 'type', 'builder', 4, 'A printer makes 24 pages per minute. How many in 7 minutes?', { answer: '168', numeric: true, accept: ['168'] }),
  m('NUM', 'measure', 'type', 'builder', 4, 'A rectangle is 8 cm by 5 cm. What is its area in cm²?', { answer: '40', numeric: true, accept: ['40'] }),
  m('NUM', 'placevalue', 'mcq', 'builder', 4, 'Which number is closest to 1 million?', { choices: ['998,750', '1,250,000', '900,000', '1,500,000'], answer: 0 }),
  // — Champion (13–16) — analyse/apply —
  m('NUM', 'arith', 'mcq', 'champion', 4, 'A number is doubled, then 6 is added, giving 26. What was the number?', { choices: ['10', '16', '13', '20'], answer: 0 }, { explanation: '2n + 6 = 26 → 2n = 20 → n = 10.' }),
  m('NUM', 'fractions', 'type', 'champion', 5, 'A tank is 3/4 full and holds 240 L when full. How many litres are in it now?', { answer: '180', numeric: true, accept: ['180'] }, { explanation: '3/4 × 240 = 180.' }),
  m('NUM', 'money', 'mcq', 'champion', 5, 'You invest $100 and it grows 10% each year. After 2 years (compound), about how much?', { choices: ['$121', '$120', '$110', '$200'], answer: 0 }, { explanation: '100→110→121 (10% of 110 is 11).' }),
  m('NUM', 'geometry', 'mcq', 'champion', 5, 'A triangle has angles 90° and 35°. The third angle is…', { choices: ['55°', '65°', '45°', '35°'], answer: 0 }, { explanation: 'Angles sum to 180: 180 − 90 − 35 = 55.' }),
]

// ════════════════════════════════════════════════════════════
//  WORDQUEST — phonics, grammar, vocab, reading, writing
// ════════════════════════════════════════════════════════════
const WRD: PackItem[] = [
  // — Starter / phonics —
  m('WRD', 'phonics', 'mcq', 'starter', 1, 'Which word rhymes with "cat"?', { choices: ['hat', 'dog', 'sun', 'cup'], answer: 0 }),
  m('WRD', 'phonics', 'mcq', 'starter', 1, 'What sound does "sh" make in "ship"?', { choices: ['shhh', 'sss', 'kuh', 'tuh'], answer: 0 }),
  m('WRD', 'phonics', 'cloze', 'starter', 2, 'Finish the word: "fr__g" (a jumping animal).', { before: 'fr', after: 'g', options: ['o', 'a', 'u', 'e'], answer: 'o' }),
  m('WRD', 'phonics', 'mcq', 'starter', 2, 'How many syllables in "banana"?', { choices: ['3', '2', '1', '4'], answer: 0 }, { explanation: 'ba-na-na = 3.' }),
  // — Grammar —
  m('WRD', 'grammar', 'mcq', 'explorer', 2, 'Which word is a NOUN?', { choices: ['mountain', 'quickly', 'jump', 'happy'], answer: 0 }),
  m('WRD', 'grammar', 'mcq', 'explorer', 2, 'Which word is a VERB?', { choices: ['sprint', 'blue', 'table', 'soft'], answer: 0 }),
  m('WRD', 'grammar', 'fix', 'explorer', 3, 'Tap the error: "We was late for school."', { tokens: ['We', 'was', 'late', 'for school.'], wrong: 1, fix: 'were' }, { explanation: 'With "we" we use "were".' }),
  m('WRD', 'grammar', 'fix', 'explorer', 3, 'Tap the error: "She have two brothers."', { tokens: ['She', 'have', 'two', 'brothers.'], wrong: 1, fix: 'has' }),
  m('WRD', 'grammar', 'cloze', 'explorer', 3, 'Choose the correct word: "I have lived here ___ 2019."', { before: 'here ', after: ' 2019.', options: ['since', 'for', 'from', 'at'], answer: 'since' }),
  m('WRD', 'grammar', 'mcq', 'explorer', 3, 'Which sentence is in the PAST tense?', { choices: ['She walked home.', 'She walks home.', 'She will walk home.', 'She is walking home.'], answer: 0 }),
  m('WRD', 'grammar', 'sort', 'explorer', 3, 'Sort each word: noun or adjective?', { buckets: ['Noun', 'Adjective'], items: [{ text: 'river', bucket: 0 }, { text: 'shiny', bucket: 1 }, { text: 'courage', bucket: 0 }, { text: 'ancient', bucket: 1 }] }),
  // — Vocab —
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'A SYNONYM for "happy" is…', { choices: ['joyful', 'tired', 'angry', 'cold'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'An ANTONYM for "brave" is…', { choices: ['cowardly', 'bold', 'strong', 'fast'], answer: 0 }),
  m('WRD', 'vocab', 'cloze', 'explorer', 3, 'Pick the precise word: "The soup was so hot it was almost ___."', { before: 'almost ', after: '.', options: ['scalding', 'frozen', 'mild', 'sweet'], answer: 'scalding' }),
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'What does the prefix "un-" mean in "unhappy"?', { choices: ['not', 'again', 'before', 'very'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'builder', 4, 'What does "reluctant" mean?', { choices: ['unwilling', 'excited', 'tired', 'famous'], answer: 0 }),
  m('WRD', 'vocab', 'match', 'builder', 4, 'Match each prefix to its meaning.', { pairs: [['re-', 'again'], ['pre-', 'before'], ['mis-', 'wrongly'], ['sub-', 'under']] }),
  // — Reading —
  m('WRD', 'reading', 'mcq', 'explorer', 3, 'Read: "The lighthouse beam swept the dark sea, warning ships of the rocks below." Why is the lighthouse important?', { choices: ['It keeps ships safe from rocks', 'It is very tall', 'Sailors like the light', 'It is painted white'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 3, 'Read: "Mira checked her bag twice, her heart pounding, before the big test." How does Mira feel?', { choices: ['Nervous', 'Bored', 'Sleepy', 'Angry'], answer: 0 }, { explanation: '"Heart pounding" + checking twice signals nerves.' }),
  m('WRD', 'reading', 'cloze', 'explorer', 3, 'Read: "The volcano had been quiet for years, but smoke now curled from its peak." The smoke suggests the volcano may ___.', { before: 'may ', after: '.', options: ['erupt', 'freeze', 'disappear', 'sleep'], answer: 'erupt' }),
  m('WRD', 'reading', 'multi', 'builder', 4, 'Read: "Bats are nocturnal, use echolocation to hunt, and are the only mammals that truly fly." Pick TWO facts stated.', { choices: ['Bats are nocturnal', 'Bats lay eggs', 'Bats use echolocation', 'Bats cannot fly'], answers: [0, 2] }),
  m('WRD', 'reading', 'mcq', 'builder', 4, 'Read: "Though small, the start-up out-innovated giant rivals, proving size isn\'t everything." The main idea is…', { choices: ['Clever ideas can beat size', 'Big companies always win', 'Start-ups are small', 'Rivals are giant'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'champion', 5, 'Read: "The narrator insists he is calm, yet his hands tremble as he speaks." This is an example of…', { choices: ['an unreliable narrator', 'a happy ending', 'a setting', 'a rhyme'], answer: 0 }, { explanation: 'His words contradict his actions — we doubt him.' }),
  // — Writing —
  m('WRD', 'writing', 'bank', 'explorer', 3, 'Build a sentence with a capital and full stop.', { tiles: ['The', 'sun', 'set', 'over', 'the', 'hills'], answer: ['The', 'sun', 'set', 'over', 'the', 'hills'] }),
  m('WRD', 'writing', 'bank', 'builder', 4, 'Arrange into a sentence using "because".', { tiles: ['We', 'stayed', 'inside', 'because', 'it', 'rained'], answer: ['We', 'stayed', 'inside', 'because', 'it', 'rained'] }),
  m('WRD', 'writing', 'mcq', 'builder', 4, 'Which sentence is the most VIVID?', { choices: ['The thunder cracked and rattled the windows.', 'It was loud.', 'There was a noise.', 'The weather was bad.'], answer: 0 }),
  m('WRD', 'writing', 'fix', 'champion', 5, 'Tap the run-on error: "I love reading I read every night."', { tokens: ['I love reading', 'I read every night.'], wrong: 0, fix: 'I love reading;' }, { explanation: 'Two sentences joined without punctuation — needs a full stop or semicolon.' }),
]

// ════════════════════════════════════════════════════════════
//  WONDERLAB — biology, chemistry, physics, earth (predict/analyse)
// ════════════════════════════════════════════════════════════
const WON: PackItem[] = [
  // — Biology —
  m('WON', 'biology', 'mcq', 'starter', 1, 'What do plants need to make food?', { choices: ['Sunlight', 'Darkness', 'Sugar', 'Plastic'], answer: 0 }),
  m('WON', 'biology', 'sort', 'explorer', 2, 'Sort each animal: mammal or reptile?', { buckets: ['Mammal', 'Reptile'], items: [{ text: 'Dog', bucket: 0 }, { text: 'Snake', bucket: 1 }, { text: 'Whale', bucket: 0 }, { text: 'Lizard', bucket: 1 }] }),
  m('WON', 'biology', 'label', 'explorer', 3, 'Match each plant part to its job.', { pairs: [['Roots', 'Soak up water'], ['Leaves', 'Catch sunlight'], ['Stem', 'Holds the plant up'], ['Flower', 'Makes seeds']] }),
  m('WON', 'biology', 'seq', 'explorer', 3, 'Order the life cycle of a butterfly.', { items: ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly'] }),
  m('WON', 'biology', 'mcq', 'builder', 4, 'Why do many animals in the Arctic have white fur?', { choices: ['Camouflage in snow', 'They like white', 'It is warmer', 'To scare predators'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'champion', 5, 'In a food web, if the number of foxes suddenly drops, the rabbit population will likely…', { choices: ['Increase', 'Vanish', 'Stay exactly the same', 'Turn into foxes'], answer: 0 }, { explanation: 'Fewer predators → more rabbits survive.' }),
  // — Chemistry —
  m('WON', 'chemistry', 'sort', 'explorer', 2, 'Sort each into its state of matter.', { buckets: ['Solid', 'Liquid'], items: [{ text: 'Ice', bucket: 0 }, { text: 'Water', bucket: 1 }, { text: 'Rock', bucket: 0 }, { text: 'Juice', bucket: 1 }] }),
  m('WON', 'chemistry', 'mcq', 'explorer', 3, 'What happens to water when it reaches 100°C?', { choices: ['It boils into steam', 'It freezes', 'It turns to ice', 'Nothing'], answer: 0 }),
  m('WON', 'chemistry', 'pte', 'explorer', 3, 'You put a metal spoon in hot soup. Predict, then explain.', { predict: { prompt: 'What happens to the spoon handle?', choices: ['It gets warm', 'It stays cold', 'It melts'], answer: 0 }, sim: 'After a minute the handle feels warm even though it never touched the soup.', explain: { prompt: 'Why?', choices: ['Metal conducts heat', 'Soup is magic', 'Spoons make heat'], answer: 0 } }),
  m('WON', 'chemistry', 'mcq', 'builder', 4, 'Dissolving sugar in water is a ___ change (it can be reversed by evaporating).', { choices: ['physical', 'chemical', 'nuclear', 'permanent'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'champion', 5, 'Burning wood is a CHEMICAL change because…', { choices: ['new substances (ash, gas) form and it can\'t be undone', 'the wood gets smaller', 'it makes light', 'it is hot'], answer: 0 }),
  // — Physics —
  m('WON', 'physics', 'mcq', 'starter', 2, 'What makes a ball roll DOWN a hill?', { choices: ['Gravity', 'Wind only', 'Magic', 'The grass'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'explorer', 3, 'A magnet will attract a…', { choices: ['steel paperclip', 'plastic spoon', 'wooden block', 'glass marble'], answer: 0 }),
  m('WON', 'physics', 'pte', 'explorer', 3, 'You shine a torch at a mirror. Predict, then explain.', { predict: { prompt: 'What does the light do?', choices: ['Bounces off', 'Passes through', 'Disappears'], answer: 0 }, sim: 'The beam reflects off the mirror and lands on the opposite wall.', explain: { prompt: 'This bouncing of light is called…', choices: ['Reflection', 'Gravity', 'Friction'], answer: 0 } }),
  m('WON', 'physics', 'mcq', 'builder', 4, 'A heavier box is harder to push than a light one because it has more…', { choices: ['mass (so more inertia)', 'colour', 'corners', 'air'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'builder', 4, 'Why do you see lightning BEFORE you hear thunder?', { choices: ['Light travels faster than sound', 'Thunder is shy', 'Lightning is louder', 'Sound travels faster'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'champion', 5, 'A 2 kg ball and a 5 kg ball are dropped together (ignore air). Which lands first?', { choices: ['They land together', 'The 5 kg ball', 'The 2 kg ball', 'Neither falls'], answer: 0 }, { explanation: 'Gravity accelerates all masses equally.' }),
  // — Earth & space —
  m('WON', 'earth', 'mcq', 'starter', 2, 'What causes day and night?', { choices: ['Earth spinning', 'The Sun moving away', 'Clouds', 'The Moon'], answer: 0 }),
  m('WON', 'earth', 'seq', 'explorer', 3, 'Order the phases: new moon to full.', { items: ['New moon', 'Crescent', 'Half moon', 'Full moon'] }),
  m('WON', 'earth', 'sort', 'explorer', 3, 'Sort: planet or star?', { buckets: ['Planet', 'Star'], items: [{ text: 'Mars', bucket: 0 }, { text: 'The Sun', bucket: 1 }, { text: 'Jupiter', bucket: 0 }, { text: 'Sirius', bucket: 1 }] }),
  m('WON', 'earth', 'mcq', 'builder', 4, 'Why is it warmer in summer?', { choices: ['Earth\'s tilt gives more direct sunlight', 'Earth is closer to the Sun', 'The Sun is bigger', 'Less air'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'champion', 5, 'Fossils of sea creatures are found on mountain tops. The best explanation is…', { choices: ['the land was once under the sea and was lifted up', 'fish climbed the mountain', 'someone placed them there', 'it always rains there'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  LOGICLAND — code, data, ai, logic (debug, reason, create)
// ════════════════════════════════════════════════════════════
const LOG: PackItem[] = [
  m('LOG', 'logic', 'mcq', 'starter', 1, 'What comes next? 🔴🔵🔴🔵🔴 ___', { choices: ['🔵', '🔴', '🟢', '🟡'], answer: 0 }),
  m('LOG', 'logic', 'seq', 'starter', 2, 'Order smallest to biggest.', { items: ['Ant', 'Cat', 'Horse', 'Elephant'] }),
  m('LOG', 'logic', 'mcq', 'explorer', 3, 'All cats are animals. Felix is a cat. So Felix is…', { choices: ['an animal', 'a dog', 'not an animal', 'a plant'], answer: 0 }),
  m('LOG', 'logic', 'sort', 'explorer', 3, 'Sort each statement: always true or sometimes false?', { buckets: ['Always true', 'Sometimes false'], items: [{ text: 'A week has 7 days', bucket: 0 }, { text: 'It is sunny outside', bucket: 1 }, { text: 'Triangles have 3 sides', bucket: 0 }, { text: 'Dogs are brown', bucket: 1 }] }),
  m('LOG', 'logic', 'mcq', 'builder', 4, 'IF (homework done) OR (it is weekend) THEN play. It is Tuesday and homework is NOT done. Can you play?', { choices: ['No', 'Yes', 'Only at night', 'Maybe'], answer: 0 }),
  m('LOG', 'logic', 'mcq', 'champion', 5, 'NOT (true AND false) equals…', { choices: ['true', 'false', 'maybe', 'error'], answer: 0 }, { explanation: 'true AND false = false; NOT false = true.' }),
  // — Code —
  m('LOG', 'code', 'seq', 'explorer', 3, 'Order the steps to plant a seed (an algorithm).', { items: ['Dig a hole', 'Drop the seed', 'Cover with soil', 'Water it'] }),
  m('LOG', 'code', 'fix', 'explorer', 3, 'Debug: the robot should go FORWARD then turn RIGHT, but the code says LEFT.', { tokens: ['FORWARD', 'LEFT'], wrong: 1, fix: 'RIGHT' }),
  m('LOG', 'code', 'code', 'builder', 4, 'Build a loop to draw a triangle.', { tiles: ['REPEAT 3', 'FORWARD 100', 'RIGHT 120', 'END'], answer: ['REPEAT 3', 'FORWARD 100', 'RIGHT 120', 'END'] }),
  m('LOG', 'code', 'mcq', 'builder', 4, 'A loop "REPEAT 5 [ STEP ]" makes the robot step how many times?', { choices: ['5', '1', '10', '0'], answer: 0 }),
  m('LOG', 'code', 'mcq', 'champion', 5, 'Why use a loop instead of writing FORWARD 100 times?', { choices: ['Shorter, clearer, easier to change', 'Loops are slower', 'It looks cool', 'No reason'], answer: 0 }),
  // — Data —
  m('LOG', 'data', 'mcq', 'explorer', 3, 'A bar chart shows: Mon 4, Tue 9, Wed 2. Which day had the most?', { choices: ['Tuesday', 'Monday', 'Wednesday', 'Tie'], answer: 0 }),
  m('LOG', 'data', 'type', 'explorer', 3, 'Scores: 4, 8, 6. What is the TOTAL?', { answer: '18', numeric: true, accept: ['18'] }),
  m('LOG', 'data', 'mcq', 'builder', 4, 'The numbers 3, 5, 7, 9 have a mean (average) of…', { choices: ['6', '5', '7', '24'], answer: 0 }, { explanation: '(3+5+7+9)/4 = 24/4 = 6.' }),
  m('LOG', 'data', 'mcq', 'champion', 5, 'A survey of 10 friends says "everyone loves pizza." Why might this be misleading for a whole school?', { choices: ['The sample is tiny and not random', 'Pizza is bad', '10 is too many', 'Surveys are illegal'], answer: 0 }),
  // — AI —
  m('LOG', 'ai', 'mcq', 'explorer', 3, 'An AI is "trained." That means it…', { choices: ['learns patterns from many examples', 'goes to a gym', 'is born knowing everything', 'guesses randomly forever'], answer: 0 }),
  m('LOG', 'ai', 'mcq', 'builder', 4, 'You want an AI to recommend books. The MOST useful information to give it is…', { choices: ['Books you already enjoyed and why', 'Your shoe size', 'The weather', 'Nothing'], answer: 0 }),
  m('LOG', 'ai', 'mcq', 'champion', 5, 'An AI trained only on photos taken in daytime may fail at night. This problem is called…', { choices: ['biased training data', 'too much memory', 'a fast computer', 'a good model'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WORLDTRAIL — geography, history, economics  (THIN cells → heavy)
// ════════════════════════════════════════════════════════════
const WLD: PackItem[] = [
  // — Geography —
  m('WLD', 'geography', 'match', 'explorer', 2, 'Match each country to its capital.', { pairs: [['Italy', 'Rome'], ['Brazil', 'Brasília'], ['Canada', 'Ottawa'], ['Kenya', 'Nairobi']] }),
  m('WLD', 'geography', 'mcq', 'explorer', 3, 'Which is the largest ocean?', { choices: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 0 }),
  m('WLD', 'geography', 'map', 'explorer', 3, 'On a map, which direction is usually at the TOP?', { choices: ['North', 'South', 'East', 'West'], answer: 0 }),
  m('WLD', 'geography', 'sort', 'explorer', 3, 'Sort each feature: natural or human-made?', { buckets: ['Natural', 'Human-made'], items: [{ text: 'Mountain', bucket: 0 }, { text: 'Bridge', bucket: 1 }, { text: 'River', bucket: 0 }, { text: 'Skyscraper', bucket: 1 }] }),
  m('WLD', 'geography', 'mcq', 'builder', 4, 'Why is the air thinner and colder high up a mountain?', { choices: ['Less atmosphere presses down at altitude', 'Mountains hate warmth', 'The Sun is further', 'More trees'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'champion', 5, 'Countries near the equator are usually hot because…', { choices: ['sunlight hits them most directly', 'they are closer to the Sun', 'they have no wind', 'the Earth is flat there'], answer: 0 }),
  // — History (THIN — extra volume) —
  m('WLD', 'history', 'seq', 'explorer', 3, 'Order these eras from oldest to newest.', { items: ['Stone Age', 'Ancient Egypt', 'Middle Ages', 'Modern times'] }),
  m('WLD', 'history', 'seq', 'explorer', 3, 'Order these inventions by date.', { items: ['Writing', 'Printing press', 'Telephone', 'Internet'] }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'A "century" is how many years?', { choices: ['100', '10', '1000', '50'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'Ancient Egyptians are famous for building…', { choices: ['the pyramids', 'cars', 'the internet', 'skyscrapers'], answer: 0 }),
  m('WLD', 'history', 'match', 'explorer', 3, 'Match each ancient civilisation to what it is known for.', { pairs: [['Egypt', 'Pyramids'], ['Rome', 'Roads & laws'], ['Greece', 'Democracy'], ['China', 'Great Wall']] }),
  m('WLD', 'history', 'mcq', 'builder', 4, 'Why did early towns often build walls around them?', { choices: ['Defence from attackers', 'To look pretty', 'To keep out rain', 'For shade'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'builder', 4, 'A SECONDARY source about an event is…', { choices: ['written later, using other sources', 'written by a witness at the time', 'always wrong', 'a photograph'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'builder', 4, 'Historians say a source may be BIASED when…', { choices: ['the writer had a strong personal interest', 'it is very old', 'it is short', 'it has pictures'], answer: 0 }),
  m('WLD', 'history', 'seq', 'builder', 4, 'Order: how transport sped up over history.', { items: ['Walking', 'Horse', 'Steam train', 'Aeroplane'] }),
  m('WLD', 'history', 'mcq', 'champion', 5, 'Two diaries describe the same battle very differently. The BEST conclusion is…', { choices: ['each writer saw it from their own viewpoint', 'one of them is lying for sure', 'the battle never happened', 'history is pointless'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'champion', 5, 'The printing press (1440s) changed the world mainly because it…', { choices: ['spread ideas cheaply and quickly', 'made paper', 'ended all wars', 'invented reading'], answer: 0 }),
  // — Economics (THIN — extra volume) —
  m('WLD', 'economics', 'sort', 'explorer', 2, 'Sort each: a need or a want?', { buckets: ['Need', 'Want'], items: [{ text: 'Shelter', bucket: 0 }, { text: 'A games console', bucket: 1 }, { text: 'Medicine', bucket: 0 }, { text: 'Designer shoes', bucket: 1 }] }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'Money is useful mainly because it…', { choices: ['makes trading easier than swapping goods', 'is pretty', 'is heavy', 'never runs out'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'If you SAVE part of your pocket money, you can…', { choices: ['afford something bigger later', 'never buy anything', 'lose it all', 'get fined'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'When LOTS of people want a rare toy, its price usually…', { choices: ['goes up', 'goes down', 'becomes free', 'disappears'], answer: 0 }),
  m('WLD', 'economics', 'match', 'builder', 4, 'Match each money word to its meaning.', { pairs: [['Income', 'Money you receive'], ['Expense', 'Money you spend'], ['Savings', 'Money you keep'], ['Budget', 'A spending plan']] }),
  m('WLD', 'economics', 'mcq', 'builder', 4, 'A "profit" is made when a shop…', { choices: ['sells for more than it cost', 'gives things away', 'spends more than it earns', 'closes early'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'builder', 4, '"Supply" means the amount available; "demand" means…', { choices: ['how much people want it', 'how heavy it is', 'the colour', 'the price tag'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'builder', 4, 'A country IMPORTS goods it…', { choices: ['buys from abroad', 'sells abroad', 'grows at home', 'throws away'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'champion', 5, 'A bakery raises bread prices and sells fewer loaves. This shows that, usually, higher price →', { choices: ['lower demand', 'higher demand', 'no change', 'free bread'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'champion', 5, 'Why might a government tax sugary drinks?', { choices: ['to discourage buying them and raise money', 'because sugar is rare', 'to help shops', 'for fun'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  LIFEQUEST — habits, kindness, movement, party (SEL, real quests)
// ════════════════════════════════════════════════════════════
const LIF: PackItem[] = [
  // — Habits —
  m('LIF', 'habits', 'mcq', 'starter', 1, 'How many times a day should you brush your teeth?', { choices: ['Twice', 'Never', 'Once a week', 'Ten times'], answer: 0 }),
  m('LIF', 'habits', 'sort', 'explorer', 2, 'Sort each into a healthy or less-healthy snack.', { buckets: ['Healthy', 'Less healthy'], items: [{ text: 'Apple', bucket: 0 }, { text: 'Candy bar', bucket: 1 }, { text: 'Carrot sticks', bucket: 0 }, { text: 'Fizzy drink', bucket: 1 }] }),
  m('LIF', 'habits', 'seq', 'explorer', 2, 'Order a good morning routine.', { items: ['Wake up', 'Brush teeth', 'Eat breakfast', 'Pack your bag'] }),
  m('LIF', 'habits', 'mcq', 'explorer', 3, 'You have a big project due in a week. The best plan is to…', { choices: ['do a little each day', 'leave it all to the last night', 'ignore it', 'do it twice'], answer: 0 }),
  m('LIF', 'habits', 'mcq', 'builder', 4, 'Screens right before bed can make sleep harder because the light…', { choices: ['tricks your brain into staying awake', 'is too dim', 'is good for sleep', 'makes you tired instantly'], answer: 0 }),
  // — Kindness / SEL —
  m('LIF', 'kindness', 'mcq', 'starter', 2, 'A new kid looks lonely at lunch. You could…', { choices: ['Ask them to sit with you', 'Point and laugh', 'Move away', 'Ignore them'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 3, 'You feel jealous of a friend\'s new bike. A healthy response is to…', { choices: ['Be happy for them and notice your own good things', 'Break the bike', 'Stop being friends', 'Sulk all week'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 3, 'You accidentally hurt a friend\'s feelings. The best thing to do is…', { choices: ['Apologise sincerely', 'Pretend it didn\'t happen', 'Blame them', 'Laugh'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'builder', 4, 'A group chat starts teasing someone. The kind AND brave choice is to…', { choices: ['Speak up or check the person is okay', 'Join in', 'Forward it', 'Add a laughing emoji'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'builder', 4, 'Someone disagrees with you strongly. Respectful debate means…', { choices: ['Listen, then explain your view calmly', 'Shout louder', 'Call them names', 'Walk off angry'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'champion', 5, 'You see a classmate being treated unfairly by a group. The most courageous response is to…', { choices: ['support the person and tell a trusted adult', 'do nothing', 'join the stronger side', 'record it for laughs'], answer: 0 }),
  // — Movement —
  m('LIF', 'movement', 'mcq', 'starter', 1, 'Which keeps your heart strong?', { choices: ['Running and playing', 'Sitting all day', 'Eating sweets', 'Watching TV'], answer: 0 }),
  m('LIF', 'movement', 'mcq', 'explorer', 3, 'After hard exercise, your body needs…', { choices: ['water and rest', 'more running forever', 'no sleep', 'only sugar'], answer: 0 }),
  m('LIF', 'movement', 'seq', 'explorer', 2, 'Order a safe workout.', { items: ['Warm up', 'Exercise', 'Cool down', 'Drink water'] }),
  // — Party / real-world quests —
  m('LIF', 'party', 'party', 'explorer', 2, 'Kindness quest!', { quest: true, task: 'Help someone at home with a chore without being asked.' }),
  m('LIF', 'party', 'party', 'explorer', 2, 'Gratitude quest!', { quest: true, task: 'Tell someone one thing you are thankful for today.' }),
  m('LIF', 'habits', 'party', 'explorer', 2, 'Habit quest!', { quest: true, task: 'Read for 15 minutes before screens today.' }),
  m('LIF', 'movement', 'party', 'explorer', 2, 'Movement quest!', { quest: true, task: 'Do 10 star-jumps and a 30-second stretch.' }),
  m('LIF', 'party', 'party', 'explorer', 1, 'Emoji guess', { prompt: 'Buzzy insect that makes honey 🐝', reveal: '🍯 A bee!' }),
  m('LIF', 'party', 'party', 'explorer', 1, 'Emoji guess', { prompt: 'Red fruit a doctor likes 🍎', reveal: 'An apple a day!' }),
]

export const CONTENT_PACK_5: PackItem[] = [
  ...NUM,
  ...WRD,
  ...WON,
  ...LOG,
  ...WLD,
  ...LIF,
]
