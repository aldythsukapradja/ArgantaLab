// ============================================================
//  ARGANTALAB · CONTENT PACK 15 — FABLE WAVE 1: CURVE + VARIETY FILL
//  Data-driven fill from the gap audit (2026-07-12):
//   · every world×stage cell below the 15-item floor topped up
//     (WLD/tiny 7→15, WLD/starter 10→15, LOG/tiny 11→16, LOG/starter 14→18,
//      LIF/tiny 13→16, LIF/champion 7→15, LIF/legend 5→15)
//   · difficulty rungs widened inside every stage — before this pack each
//     stage was a flat band (tiny=d1 only, starter=d1-2, explorer=d2-3,
//      champion=d4-5, legend=d5) so the selector had no curve to climb
//   · new items biased to the starved interaction types (numline/slider/
//     label/map/listen had 6-7 items EACH vs 854 mcq)
//  Validated by data/content.test.ts. Facts verified.
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
  ({ id: `cp15_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const mu = (w: string, s: string, st: string, d: number, p: string, choices: string[], answers: number[], e?: string) => base(w, s, 'multi', st, d, p, { choices, answers }, e)
const ty = (w: string, s: string, st: string, d: number, p: string, answer: string, e?: string) => base(w, s, 'type', st, d, p, { answer, numeric: /^[\d.-]+$/.test(answer) }, e)
const cl = (w: string, s: string, st: string, d: number, before: string, after: string, options: string[], answer: string, e?: string) => base(w, s, 'cloze', st, d, 'Fill the blank.', { before, after, options, answer }, e)
const ma = (w: string, s: string, st: string, d: number, p: string, pairs: string[][], e?: string) => base(w, s, 'match', st, d, p, { pairs }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const nl = (w: string, s: string, st: string, d: number, p: string, min: number, max: number, answer: number, tol: number, label?: string, e?: string) => base(w, s, 'numline', st, d, p, { min, max, answer, tol, label }, e)
const sl = (w: string, s: string, st: string, d: number, p: string, min: number, max: number, answer: number, tol: number, unit: string, e?: string) => base(w, s, 'slider', st, d, p, { min, max, answer, tol, unit }, e)
const lb = (w: string, s: string, st: string, d: number, p: string, scene: string, pairs: string[][], e?: string) => base(w, s, 'label', st, d, p, { scene, pairs }, e)
const mp = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'map', st, d, p, { choices, answer }, e)
const li = (w: string, s: string, st: string, d: number, say: string, choices: string[], answer: number, e?: string) => base(w, s, 'listen', st, d, 'Listen and choose the sound.', { say, choices, answer }, e)
const fx = (w: string, s: string, st: string, d: number, p: string, tokens: string[], wrong: number, fix: string, e?: string) => base(w, s, 'fix', st, d, p, { tokens, wrong, fix }, e)
const bk = (w: string, s: string, st: string, d: number, p: string, tiles: string[], answer: string[], e?: string) => base(w, s, 'bank', st, d, p, { tiles, answer }, e)
const cd = (w: string, s: string, st: string, d: number, p: string, tiles: string[], answer: string[], e?: string) => base(w, s, 'code', st, d, p, { tiles, answer }, e)
const pa = (w: string, s: string, st: string, d: number, task: string) => base(w, s, 'party', st, d, `Quest: ${task}.`, { task, quest: true })
const pt = (w: string, s: string, st: string, d: number, p: string, predict: { prompt: string; choices: string[]; answer: number }, sim: string, explain: { prompt: string; choices: string[]; answer: number }, e?: string) => base(w, s, 'pte', st, d, p, { predict, sim, explain }, e)

// ────────────────────────────────────────────────────────────
//  NUM · NumberDash — widen every stage's difficulty curve
// ────────────────────────────────────────────────────────────
const NUM: PackItem[] = [
  // tiny — add d2 stretch (was d1-only)
  nl('NUM', 'placevalue', 'tiny', 2, 'Drag the marker to 7.', 0, 10, 7, 0.5, '7'),
  ma('NUM', 'arith', 'tiny', 2, 'Match the apples to the number.', [['🍎', '1'], ['🍎🍎', '2'], ['🍎🍎🍎', '3']]),
  ty('NUM', 'arith', 'tiny', 2, '3 + 2 = ?', '5', '3 and 2 more makes 5.'),
  sq('NUM', 'placevalue', 'tiny', 2, 'Put the numbers in counting order.', ['1', '2', '3', '4']),
  mc('NUM', 'placevalue', 'tiny', 2, 'Which number is the biggest?', ['9', '2', '5', '1'], 0, '9 is the biggest.'),
  // starter — add d3 stretch (was d1-2)
  nl('NUM', 'placevalue', 'starter', 3, 'Drag the marker to 25.', 0, 50, 25, 2, '25'),
  mu('NUM', 'arith', 'starter', 3, 'Which pairs make 10?', ['6 + 4', '5 + 3', '7 + 3', '8 + 1'], [0, 2], '6+4 and 7+3 both make 10.'),
  cl('NUM', 'arith', 'starter', 3, '14 − ', ' = 8', ['5', '6', '7'], '6', '14 take away 6 leaves 8.'),
  sl('NUM', 'measure', 'starter', 3, 'Estimate: about how tall is a door?', 50, 400, 200, 60, 'cm', 'Most doors are around 2 metres — 200 cm.'),
  ty('NUM', 'arith', 'starter', 3, '30 + 25 = ?', '55'),
  // explorer — add d1 confidence + d4 stretch (was d2-3)
  ty('NUM', 'times', 'explorer', 1, '10 × 3 = ?', '30', 'Ten times anything just adds a zero.'),
  nl('NUM', 'fractions', 'explorer', 1, 'Drag the marker to 1/2.', 0, 1, 0.5, 0.06, '1/2'),
  ma('NUM', 'times', 'explorer', 1, 'Match the doubles.', [['6', '12'], ['7', '14'], ['9', '18']]),
  ty('NUM', 'money', 'explorer', 4, 'A book costs $7. You pay with $20. How much change?', '13', '20 − 7 = 13.'),
  mc('NUM', 'fractions', 'explorer', 4, 'What is 3/5 of 40?', ['18', '24', '25', '15'], 1, '40 ÷ 5 = 8, then 8 × 3 = 24.'),
  nl('NUM', 'fractions', 'explorer', 4, 'Drag the marker to 0.8.', 0, 1, 0.8, 0.04, '0.8'),
  // builder — add d2 confidence (was d3-5)
  nl('NUM', 'placevalue', 'builder', 2, 'Drag the marker to −3.', -5, 5, -3, 0.4, '−3'),
  sl('NUM', 'arith', 'builder', 2, 'Estimate 48% of 200.', 0, 200, 96, 12, '', 'Just under half of 200 → about 96.'),
  ma('NUM', 'arith', 'builder', 2, 'Match the power to its value.', [['2³', '8'], ['3²', '9'], ['2⁴', '16']]),
  // champion — add d3 confidence (was d4-5)
  ty('NUM', 'arith', 'champion', 3, 'Solve: 3x = 21. x = ?', '7', 'Divide both sides by 3.'),
  mc('NUM', 'arith', 'champion', 3, 'What is the mean of 4, 8, 6 and 10?', ['6', '7', '8', '9'], 1, '(4+8+6+10) ÷ 4 = 7.'),
  sl('NUM', 'arith', 'champion', 3, '√50 is about…', 0, 10, 7.1, 0.5, '', '7² = 49, so √50 is just over 7.'),
  ma('NUM', 'fractions', 'champion', 3, 'Split each amount in the given ratio.', [['1:2 of 30', '10 and 20'], ['1:4 of 25', '5 and 20'], ['2:3 of 25', '10 and 15']]),
  // legend — add d3-4 confidence (was d5-only)
  ty('NUM', 'arith', 'legend', 3, 'Solve: 2x + 5 = 17. x = ?', '6', 'Subtract 5, then divide by 2.'),
  mc('NUM', 'geometry', 'legend', 3, 'What is the gradient of y = 3x − 2?', ['−2', '3', 'x', '1/3'], 1, 'In y = mx + c, m is the gradient.'),
  mc('NUM', 'arith', 'legend', 4, 'P(rolling an even number on a fair die)?', ['1/6', '1/3', '1/2', '2/3'], 2, 'Three evens out of six faces = 1/2.'),
  nl('NUM', 'geometry', 'legend', 4, 'Drag the marker to the value of sin 90°.', 0, 1, 1, 0.05, 'sin 90°'),
]

// ────────────────────────────────────────────────────────────
//  WRD · WordQuest — listen/bank/fix variety + curve fill
// ────────────────────────────────────────────────────────────
const WRD: PackItem[] = [
  // tiny — d2 (was d1-only)
  li('WRD', 'phonics', 'tiny', 2, 'mmm', ['m', 'n', 'w'], 0, 'M says mmm.'),
  li('WRD', 'phonics', 'tiny', 2, 'sss', ['s', 'z', 'c'], 0, 'S hisses like a snake.'),
  ma('WRD', 'phonics', 'tiny', 2, 'Match big and small letters.', [['A', 'a'], ['B', 'b'], ['D', 'd']]),
  bk('WRD', 'writing', 'tiny', 2, 'Build the sentence.', ['I', 'see', 'a', 'dog'], ['I', 'see', 'a', 'dog']),
  mc('WRD', 'phonics', 'tiny', 2, 'Which word rhymes with "cat"?', ['hat', 'dog', 'sun', 'car'], 0),
  // starter — d3 (was d1-2)
  fx('WRD', 'grammar', 'starter', 3, 'Tap the word that needs a capital letter.', ['me', 'and', 'tom', 'play'], 2, 'Tom', 'Names start with a capital.'),
  cl('WRD', 'grammar', 'starter', 3, 'One dog, two ', '.', ['dogs', 'doges', 'dogz'], 'dogs', 'Most plurals just add s.'),
  so('WRD', 'grammar', 'starter', 3, 'Noun or verb?', ['Noun', 'Verb'], [{ text: 'dog', bucket: 0 }, { text: 'run', bucket: 1 }, { text: 'cake', bucket: 0 }, { text: 'jump', bucket: 1 }, { text: 'teacher', bucket: 0 }]),
  li('WRD', 'phonics', 'starter', 3, 'ch', ['ch', 'sh', 'th'], 0, 'Ch as in cheese.'),
  // explorer — d1 confidence + d4 stretch (was d2-3)
  cl('WRD', 'vocab', 'explorer', 1, 'I can ', ' a bike.', ['ride', 'write', 'right'], 'ride'),
  ma('WRD', 'vocab', 'explorer', 1, 'Match the synonyms.', [['big', 'large'], ['happy', 'glad'], ['fast', 'quick']]),
  bk('WRD', 'writing', 'explorer', 1, 'Build the sentence.', ['The', 'sun', 'is', 'hot'], ['The', 'sun', 'is', 'hot']),
  fx('WRD', 'grammar', 'explorer', 4, 'Tap the wrong word.', ['their', 'going', 'to', 'school'], 0, "They're", "They're = they are."),
  cl('WRD', 'grammar', 'explorer', 4, 'The dog wagged ', ' tail.', ['its', "it's"], 'its', "Its = belonging to it. It's = it is."),
  bk('WRD', 'writing', 'explorer', 4, 'Build the complex sentence.', ['Although', 'it', 'rained,', 'we', 'played', 'outside'], ['Although', 'it', 'rained,', 'we', 'played', 'outside']),
  // builder — d2 confidence (was d3-5)
  ma('WRD', 'vocab', 'builder', 2, 'Match the prefix to the new word.', [['un + happy', 'unhappy'], ['re + play', 'replay'], ['dis + agree', 'disagree']]),
  so('WRD', 'reading', 'builder', 2, 'Fact or opinion?', ['Fact', 'Opinion'], [{ text: 'Spiders have eight legs', bucket: 0 }, { text: 'Spiders are scary', bucket: 1 }, { text: 'The sun is a star', bucket: 0 }, { text: 'Summer is the best season', bucket: 1 }]),
  cl('WRD', 'grammar', 'builder', 2, 'He ', ' finished his homework.', ['has', 'have'], 'has', 'He/she/it takes "has".'),
  // champion — d3 confidence (was d4-5)
  cl('WRD', 'vocab', 'champion', 3, 'The new rule will ', ' everyone.', ['affect', 'effect'], 'affect', 'Affect = verb, effect = noun (usually).'),
  ma('WRD', 'vocab', 'champion', 3, 'Match the word root to its meaning.', [['bene', 'good'], ['mal', 'bad'], ['aqua', 'water']]),
  fx('WRD', 'grammar', 'champion', 3, 'Tap the wrong word.', ['its', 'a', 'sunny', 'day'], 0, "It's", "It's = it is."),
  // legend — d3-4 confidence (was d5-only)
  cl('WRD', 'writing', 'legend', 3, 'Formal register: We regret to ', ' you that the event is cancelled.', ['inform', 'tell', 'say'], 'inform', 'Formal writing prefers "inform".'),
  mc('WRD', 'reading', 'legend', 4, 'Repeating "We shall…" at the start of clauses is…', ['anaphora', 'metaphor', 'simile', 'onomatopoeia'], 0, 'Anaphora = repetition at the start of clauses.'),
  ma('WRD', 'reading', 'legend', 4, 'Match the literary device to its meaning.', [['irony', 'opposite of what is expected'], ['foreshadowing', 'a hint of what is to come'], ['allusion', 'a reference to another work']]),
]

// ────────────────────────────────────────────────────────────
//  WON · WonderLab — label/pte/slider variety + curve fill
// ────────────────────────────────────────────────────────────
const WON: PackItem[] = [
  // tiny — d2 (was d1-only)
  lb('WON', 'biology', 'tiny', 2, 'Label the body.', '🧍', [['Top', 'Head'], ['Middle', 'Tummy'], ['Bottom', 'Feet']]),
  so('WON', 'biology', 'tiny', 2, 'Living or not living?', ['Living', 'Not living'], [{ text: 'Cat', bucket: 0 }, { text: 'Rock', bucket: 1 }, { text: 'Tree', bucket: 0 }, { text: 'Car', bucket: 1 }]),
  sq('WON', 'earth', 'tiny', 2, 'Put the day in order.', ['Morning', 'Afternoon', 'Night']),
  mc('WON', 'biology', 'tiny', 2, 'Which animal can fly?', ['Bird', 'Fish', 'Dog', 'Cow'], 0),
  // starter — d3 (was d1-2)
  pt('WON', 'chemistry', 'starter', 3, 'Ice in the sun', { prompt: 'What happens to ice left in the sun?', choices: ['It melts', 'It freezes harder', 'Nothing'], answer: 0 }, '🧊→☀️→💧', { prompt: 'Why?', choices: ['Heat melts ice into water', 'The sun is cold', 'Ice is alive'], answer: 0 }),
  sl('WON', 'chemistry', 'starter', 3, 'Water boils at…', 0, 200, 100, 5, '°C', 'Water boils at 100 °C.'),
  so('WON', 'chemistry', 'starter', 3, 'Metal or wood?', ['Metal', 'Wood'], [{ text: 'Nail', bucket: 0 }, { text: 'Chair', bucket: 1 }, { text: 'Coin', bucket: 0 }, { text: 'Pencil', bucket: 1 }]),
  lb('WON', 'biology', 'starter', 3, 'Label the flower.', '🌻', [['Top', 'Petal'], ['Middle', 'Stem'], ['Bottom', 'Root']]),
  // explorer — d1 + d4 (was d2-3)
  mc('WON', 'biology', 'explorer', 1, 'A camel lives in the…', ['desert', 'ocean', 'ice', 'jungle'], 0),
  ma('WON', 'biology', 'explorer', 1, 'Match the animal to its covering.', [['Fish', 'Gills'], ['Bird', 'Feathers'], ['Dog', 'Fur']]),
  pt('WON', 'physics', 'explorer', 4, 'Two bulbs, one battery', { prompt: 'Add a second bulb to a simple circuit. The bulbs get…', choices: ['dimmer', 'brighter', 'no change'], answer: 0 }, '🔋💡💡', { prompt: 'Why?', choices: ['The same push is shared by two bulbs', 'Bulbs make their own power', 'Wires get shorter'], answer: 0 }),
  mu('WON', 'earth', 'explorer', 4, 'Which are renewable energy sources?', ['Solar', 'Coal', 'Wind', 'Oil'], [0, 2], 'Sun and wind never run out.'),
  sq('WON', 'earth', 'explorer', 4, 'Order the water cycle.', ['Evaporation', 'Condensation', 'Precipitation', 'Collection']),
  // builder — d2 (was d3-5)
  lb('WON', 'biology', 'builder', 2, 'Label the cell.', '🔬', [['Control centre', 'Nucleus'], ['Jelly inside', 'Cytoplasm'], ['Outer skin', 'Membrane']]),
  sl('WON', 'physics', 'builder', 2, 'Speed = distance ÷ time. 100 m in 10 s = ?', 0, 20, 10, 1, 'm/s'),
  mc('WON', 'chemistry', 'builder', 2, 'Which state of matter has a fixed shape?', ['Solid', 'Liquid', 'Gas', 'Plasma'], 0),
  // champion — d3 (was d4-5)
  sq('WON', 'earth', 'champion', 3, 'Order: how sedimentary rock forms.', ['Rock weathers into sediment', 'Sediment settles in layers', 'Layers press together', 'Sedimentary rock forms']),
  mu('WON', 'physics', 'champion', 3, 'Which of these are forces?', ['Friction', 'Gravity', 'Photosynthesis', 'Magnetism'], [0, 1, 3]),
  ma('WON', 'biology', 'champion', 3, 'Match the cell part to its job.', [['Mitochondria', 'Energy release'], ['Ribosome', 'Makes proteins'], ['Chloroplast', 'Photosynthesis']]),
  // legend — d3-4 (was d5-only)
  mc('WON', 'biology', 'legend', 3, 'In DNA, base A pairs with…', ['T', 'G', 'C', 'U'], 0, 'A–T and G–C in DNA.'),
  sl('WON', 'chemistry', 'legend', 3, 'The pH of lemon juice is about…', 0, 14, 2, 1, 'pH', 'Lemon juice is a weak acid, pH ≈ 2.'),
  mc('WON', 'physics', 'legend', 3, "Newton's 3rd law: every action has…", ['an equal and opposite reaction', 'a bigger reaction', 'no reaction', 'a delayed reaction'], 0),
  lb('WON', 'chemistry', 'legend', 4, 'Label the atom.', '⚛️', [['Centre', 'Nucleus'], ['Orbiting particle', 'Electron'], ['Positive particle', 'Proton']]),
]

// ────────────────────────────────────────────────────────────
//  LOG · LogicLand — thin tiny/starter cells + code variety
// ────────────────────────────────────────────────────────────
const LOG: PackItem[] = [
  // tiny — fill to floor + d2 (was 11 items, d1-only)
  mc('LOG', 'logic', 'tiny', 1, 'What comes next? 🔴🔵🔴🔵…', ['🔴', '🔵', '🟢', '🟡'], 0, 'The pattern repeats red, blue.'),
  sq('LOG', 'logic', 'tiny', 1, 'Order by size, small to big.', ['Small', 'Medium', 'Big']),
  so('LOG', 'logic', 'tiny', 2, 'Circles or squares?', ['Circles', 'Squares'], [{ text: '⚪', bucket: 0 }, { text: '⬜', bucket: 1 }, { text: '🔵', bucket: 0 }, { text: '🟦', bucket: 1 }]),
  mc('LOG', 'logic', 'tiny', 2, 'Which one is different?', ['🍎', '🍎', '🍎', '🍌'], 3),
  sq('LOG', 'logic', 'tiny', 2, 'Put the day in order.', ['Wake up', 'Eat breakfast', 'Go to school']),
  // starter — fill + d3 (was 14 items, d1-2)
  cd('LOG', 'code', 'starter', 2, 'Make the robot walk, then jump.', ['walk()', 'jump()'], ['walk()', 'jump()']),
  mc('LOG', 'logic', 'starter', 2, 'The pattern is 2, 4, 6… what comes next?', ['7', '8', '9', '10'], 1, 'Counting up in 2s.'),
  sq('LOG', 'code', 'starter', 3, 'An algorithm is steps in order. Order tooth-brushing.', ['Put paste on brush', 'Brush teeth', 'Rinse mouth']),
  cd('LOG', 'code', 'starter', 3, 'Robot route: forward, turn, forward.', ['forward()', 'turn()', 'forward()'], ['forward()', 'turn()', 'forward()']),
  // explorer — d1 + d4 (was d2-3)
  mc('LOG', 'data', 'explorer', 1, 'A tally chart shows 🍎7 🍌4 🍇2. Which fruit won?', ['Apple', 'Banana', 'Grape', 'It was a tie'], 0),
  mc('LOG', 'logic', 'explorer', 1, 'True or false: all squares have 4 sides.', ['True', 'False'], 0),
  mc('LOG', 'logic', 'explorer', 4, 'Ali is taller than Ben. Ben is taller than Cy. Who is shortest?', ['Ali', 'Ben', 'Cy'], 2, 'Work down the chain.'),
  ty('LOG', 'data', 'explorer', 4, 'What is the mode of 2, 5, 5, 7?', '5', 'The mode is the most common value.'),
  // builder — d2 (was d3-5)
  so('LOG', 'code', 'builder', 2, 'Input or output device?', ['Input', 'Output'], [{ text: 'Keyboard', bucket: 0 }, { text: 'Screen', bucket: 1 }, { text: 'Mouse', bucket: 0 }, { text: 'Printer', bucket: 1 }, { text: 'Microphone', bucket: 0 }]),
  mc('LOG', 'data', 'builder', 2, 'Binary uses only…', ['0 and 1', '1 and 2', 'letters', 'decimals'], 0),
  sq('LOG', 'code', 'builder', 2, 'Order the debugging steps.', ['Read the error', 'Find the line', 'Fix the bug', 'Run again']),
  // champion — d3 (was d4-5)
  ty('LOG', 'data', 'champion', 3, 'What is the mean of 3, 9 and 6?', '6', '(3+9+6) ÷ 3 = 6.'),
  cd('LOG', 'code', 'champion', 3, 'Order the program so it prints when x is big.', ['x = 5', 'if x > 3:', '  print("big")'], ['x = 5', 'if x > 3:', '  print("big")']),
  mc('LOG', 'code', 'champion', 3, 'An algorithm is…', ['a step-by-step recipe', 'a computer brand', 'a bug', 'a website'], 0),
  // legend — d3-4 (was d5-only)
  mc('LOG', 'code', 'legend', 3, 'An AND gate outputs 1 only when…', ['both inputs are 1', 'any input is 1', 'the inputs differ', 'never'], 0),
  mc('LOG', 'ai', 'legend', 3, 'A strong password is…', ['long and unique', 'your birthday', '123456', 'your own name'], 0),
  sq('LOG', 'code', 'legend', 4, 'Order the software design cycle.', ['Define the problem', 'Design', 'Code', 'Test', 'Improve']),
]

// ────────────────────────────────────────────────────────────
//  WLD · WorldTrail — thinnest world: tiny 7→15, starter 10→15
// ────────────────────────────────────────────────────────────
const WLD: PackItem[] = [
  // tiny — +8 to reach the floor (d1 + d2)
  mc('WLD', 'geography', 'tiny', 1, 'Where do fish live?', ['Water', 'Desert', 'Sky', 'Trees'], 0),
  mc('WLD', 'geography', 'tiny', 1, 'The big blue parts of a globe are…', ['Oceans', 'Mountains', 'Cities', 'Forests'], 0),
  so('WLD', 'geography', 'tiny', 1, 'Hot place or cold place?', ['Hot', 'Cold'], [{ text: 'Desert', bucket: 0 }, { text: 'Snowy mountain', bucket: 1 }, { text: 'Beach', bucket: 0 }, { text: 'Igloo', bucket: 1 }]),
  ma('WLD', 'geography', 'tiny', 1, 'Match the animal to where it lives.', [['🐪', 'Desert'], ['🐧', 'Ice'], ['🐠', 'Sea']]),
  mc('WLD', 'geography', 'tiny', 2, 'A map shows…', ['places', 'recipes', 'songs', 'games'], 0),
  sq('WLD', 'geography', 'tiny', 2, 'Order from small to big.', ['My room', 'My home', 'My street']),
  mp('WLD', 'geography', 'tiny', 2, 'Which one is a country?', ['France', 'Football', 'Friday'], 0),
  mc('WLD', 'economics', 'tiny', 2, 'What do farmers grow?', ['Food', 'Cars', 'Books', 'Phones'], 0),
  // starter — +5 to reach the floor (d2 + d3)
  mp('WLD', 'geography', 'starter', 2, 'Penguins at the South Pole live on which continent?', ['Antarctica', 'Africa', 'Europe'], 0),
  ma('WLD', 'geography', 'starter', 2, 'Match the country to its capital.', [['France', 'Paris'], ['Japan', 'Tokyo'], ['Egypt', 'Cairo']]),
  so('WLD', 'geography', 'starter', 3, 'Continent or country?', ['Continent', 'Country'], [{ text: 'Asia', bucket: 0 }, { text: 'Brazil', bucket: 1 }, { text: 'Africa', bucket: 0 }, { text: 'Japan', bucket: 1 }]),
  sq('WLD', 'geography', 'starter', 3, 'Order from small to big.', ['Village', 'Town', 'City', 'Country']),
  mp('WLD', 'geography', 'starter', 3, 'The river Nile is in…', ['Africa', 'Europe', 'Australia'], 0),
  // explorer — d1 + d4 (was d2-3)
  mp('WLD', 'geography', 'explorer', 1, 'The Eiffel Tower is in…', ['France', 'Spain', 'China'], 0),
  ma('WLD', 'geography', 'explorer', 1, 'Match the country to its capital.', [['Italy', 'Rome'], ['Spain', 'Madrid'], ['Germany', 'Berlin']]),
  sq('WLD', 'history', 'explorer', 4, 'Order the eras, oldest first.', ['Ancient Egypt', 'Roman Empire', 'Middle Ages', 'Modern age']),
  mc('WLD', 'economics', 'explorer', 4, 'A country that sells goods abroad is…', ['exporting', 'importing', 'taxing', 'saving'], 0),
  // builder — d2 (was d3-5)
  so('WLD', 'economics', 'builder', 2, 'Goods or services?', ['Goods', 'Services'], [{ text: 'Car', bucket: 0 }, { text: 'Haircut', bucket: 1 }, { text: 'Phone', bucket: 0 }, { text: 'Banking', bucket: 1 }]),
  sl('WLD', 'geography', 'builder', 2, 'About how many countries are in the world?', 0, 400, 195, 25, '', 'Around 195 countries.'),
  mp('WLD', 'geography', 'builder', 2, 'The Amazon rainforest is mostly in…', ['Brazil', 'Canada', 'India'], 0),
  // champion — d3 (was d4-5)
  sq('WLD', 'history', 'champion', 3, 'Order the inventions, oldest first.', ['Steam engine', 'Mass-produced car', 'Internet', 'Smartphone']),
  mc('WLD', 'economics', 'champion', 3, 'Inflation means…', ['prices rising over time', 'prices falling', 'having no money', 'goods becoming free'], 0),
  ma('WLD', 'economics', 'champion', 3, 'Match the market change to the usual price effect.', [['Supply up, demand same', 'Price tends to fall'], ['Demand up, supply same', 'Price tends to rise'], ['Supply down, demand same', 'Price tends to rise']]),
  // legend — +3, d3-4 (was d5-only, 13 items)
  mc('WLD', 'economics', 'legend', 3, "GDP measures a country's…", ['total value of goods and services', 'population', 'army size', 'weather'], 0),
  mc('WLD', 'economics', 'legend', 3, 'Interest is…', ['the cost of borrowing money', 'free money', 'a tax', 'a wage'], 0),
  ma('WLD', 'economics', 'legend', 4, 'Match the market structure to its meaning.', [['Monopoly', 'One seller'], ['Competition', 'Many sellers'], ['Cartel', 'Sellers colluding']]),
]

// ────────────────────────────────────────────────────────────
//  LIF · LifeQuest — champion 7→15, legend 5→15, tiny 13→16
// ────────────────────────────────────────────────────────────
const LIF: PackItem[] = [
  // tiny — +3 (d1 + d2)
  pa('LIF', 'habits', 'tiny', 1, 'Drink a glass of water'),
  so('LIF', 'habits', 'tiny', 2, 'Everyday food or treat?', ['Everyday', 'Treat'], [{ text: 'Apple', bucket: 0 }, { text: 'Candy', bucket: 1 }, { text: 'Carrot', bucket: 0 }, { text: 'Cake', bucket: 1 }]),
  mc('LIF', 'habits', 'tiny', 2, 'Before eating we…', ['wash our hands', 'sleep', 'shout', 'run'], 0),
  // starter — d3 (was d1-2)
  sq('LIF', 'habits', 'starter', 3, 'Order the morning routine.', ['Wake up', 'Get dressed', 'Eat breakfast', 'Brush teeth']),
  ma('LIF', 'kindness', 'starter', 3, 'Match the face to the feeling.', [['😀', 'Happy'], ['😢', 'Sad'], ['😡', 'Angry']]),
  mu('LIF', 'kindness', 'starter', 3, 'Which help you calm down?', ['Deep breaths', 'Counting to 10', 'Hitting something', 'Talking to an adult'], [0, 1, 3]),
  // explorer — d1 + d4 (LIF explorer already has 1-3; add ends)
  mc('LIF', 'habits', 'explorer', 1, 'A balanced plate has…', ['many food groups', 'only sweets', 'only meat', 'no vegetables'], 0),
  pa('LIF', 'kindness', 'explorer', 1, 'Help set the table today'),
  so('LIF', 'habits', 'explorer', 4, 'Need or want?', ['Need', 'Want'], [{ text: 'Water', bucket: 0 }, { text: 'New game', bucket: 1 }, { text: 'Sleep', bucket: 0 }, { text: 'Sweets', bucket: 1 }, { text: 'Warm clothes', bucket: 0 }]),
  mu('LIF', 'habits', 'explorer', 4, 'Signs a website may be unsafe?', ['Asks for your password', 'Prizes that look too good', 'A padlock and https', 'An urgent countdown timer'], [0, 1, 3]),
  // builder — d2 + movement (was d1/d3/d4, 21 items)
  mc('LIF', 'habits', 'builder', 2, 'A good pocket-money plan is to save…', ['some every week', 'never', 'everything, then borrow back', 'only coins'], 0),
  sq('LIF', 'habits', 'builder', 2, 'Order the goal-setting steps.', ['Set a goal', 'Break it into steps', 'Do step 1', 'Review progress']),
  pa('LIF', 'movement', 'builder', 2, 'Take a 10-minute walk or stretch break'),
  // champion — +8 to reach the floor (d3-5)
  mc('LIF', 'habits', 'champion', 3, 'Someone faints near you. First you should…', ['call for adult help', 'shake them hard', 'give them food', 'take a photo'], 0),
  mc('LIF', 'habits', 'champion', 3, 'Teens need about how much sleep?', ['8–10 hours', '4–5 hours', '12–14 hours', '2–3 hours'], 0),
  pa('LIF', 'movement', 'champion', 3, 'Do 20 jumping jacks'),
  ma('LIF', 'kindness', 'champion', 4, 'Match the feeling to a healthy response.', [['Stress', 'Deep breathing'], ['Anger', 'Count and step away'], ['Sadness', 'Talk to someone']]),
  mu('LIF', 'habits', 'champion', 4, 'Healthy digital habits?', ['Taking screen breaks', 'Phone in bed all night', 'Turning off notifications to focus', 'Comparing yourself to everyone online'], [0, 2]),
  ty('LIF', 'habits', 'champion', 4, 'You save $5 a week. How much after 8 weeks?', '40'),
  sq('LIF', 'kindness', 'champion', 4, 'Order the steps for handling a big feeling.', ['Notice the feeling', 'Name it', 'Choose a response', 'Act calmly']),
  mc('LIF', 'habits', 'champion', 5, 'In the 50/30/20 budget rule, 20% goes to…', ['savings', 'snacks', 'games', 'rent'], 0, '50 needs, 30 wants, 20 savings.'),
  // legend — +10 to reach the floor (d3-5)
  mc('LIF', 'habits', 'legend', 3, 'A CV should list your…', ['skills and experience', 'passwords', 'favourite memes', 'secrets'], 0),
  mc('LIF', 'habits', 'legend', 3, 'For an interview you should arrive…', ['a little early', 'very late', 'whenever', 'the next day'], 0),
  mc('LIF', 'kindness', 'legend', 3, 'If stress feels too heavy, you should…', ['ask for help — a friend, family or professional', 'hide it forever', 'quit everything', 'stop sleeping'], 0),
  pa('LIF', 'habits', 'legend', 3, "Plan your week: write your top 3 goals"),
  mc('LIF', 'habits', 'legend', 4, 'Compound interest means…', ['interest earning interest', 'no interest at all', 'a bank fine', 'a one-time bonus'], 0),
  ma('LIF', 'habits', 'legend', 4, 'Match the money tool to what it is.', [['Debit card', 'Your own money'], ['Credit card', 'Borrowed money'], ['Savings account', 'Money set aside']]),
  mu('LIF', 'habits', 'legend', 4, 'Scam warning signs?', ['Pressure to act urgently', 'Asking for gift cards', 'A verified official website', 'Returns that look too good'], [0, 1, 3]),
  mc('LIF', 'habits', 'legend', 4, 'Renting a home usually means…', ['more flexibility but no ownership', 'always cheaper forever', 'you own it', 'no contract at all'], 0),
  sq('LIF', 'habits', 'legend', 4, 'Order the decision-making steps.', ['Identify the decision', 'List options', 'Weigh pros and cons', 'Choose and commit', 'Review the outcome']),
  ma('LIF', 'kindness', 'legend', 5, 'Match the thinking trap to its meaning.', [['Confirmation bias', 'Favouring info you already believe'], ['Sunk cost', 'Sticking with it because you already invested'], ['Anchoring', 'Relying on the first number you saw']]),
]

export const CONTENT_PACK_15: PackItem[] = [...NUM, ...WRD, ...WON, ...LOG, ...WLD, ...LIF]
