// ============================================================
//  ARGANTALAB · CONTENT PACK 16 — "DEPTH PACK" (higher-order thinking)
//  Purpose: move the "Depth of thinking" (Bloom) chart off ~76% Understand by
//  adding items whose COGNITIVE DEMAND is apply / analyse / create — not more
//  multiple-choice recall. Two levers:
//   1. Interaction TYPE drives Bloom (lib/taxonomy.ts): pte/fix/label/map →
//      analyse; sort/seq/numline/slider/bank → apply; code/party → create.
//      Most items here use those types, so they lift the chart with zero config.
//   2. A handful of genuine reasoning multiple-choice items carry an explicit
//      `bloom` override (respected by bloomFor once migration_item_bloom.sql is
//      run; harmless before then — it just falls back to the type default).
//  Also the most *engaging* formats: predict-test-explain experiments, spot-the-
//  bug debugging, error hunts, diagram labelling, step ordering, real quests.
//  Validated by data/content.test.ts. Facts verified.
// ============================================================
type IKey =
  | 'mcq' | 'multi' | 'type' | 'speed' | 'bank' | 'cloze'
  | 'match' | 'sort' | 'seq' | 'fix' | 'numline' | 'slider'
  | 'listen' | 'label' | 'pte' | 'code' | 'map' | 'party'
interface PackItem {
  id: string; world: string; skill: string; type: IKey; stage: string
  difficulty: number; prompt: string; payload: Record<string, unknown>
  hint?: string; explanation?: string; xp?: number; diamonds?: number; bloom?: string
}
let _c = 0
const base = (world: string, skill: string, type: IKey, stage: string, difficulty: number, prompt: string, payload: Record<string, unknown>, expl?: string, bloom?: string): PackItem =>
  ({ id: `cp16_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 12, diamonds: 0, bloom })

// engaging-format constructors
const fix = (w: string, s: string, st: string, d: number, p: string, tokens: string[], wrong: number, f: string, e?: string) => base(w, s, 'fix', st, d, p, { tokens, wrong, fix: f }, e)
const seq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)
const sort = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)
const label = (w: string, s: string, st: string, d: number, p: string, scene: string, pairs: string[][], e?: string) => base(w, s, 'label', st, d, p, { scene, pairs }, e)
const map = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'map', st, d, p, { choices, answer }, e)
const code = (w: string, s: string, st: string, d: number, p: string, tiles: string[], answer: string[], e?: string) => base(w, s, 'code', st, d, p, { tiles, answer }, e)
const bank = (w: string, s: string, st: string, d: number, p: string, tiles: string[], answer: string[], e?: string) => base(w, s, 'bank', st, d, p, { tiles, answer }, e)
const nl = (w: string, s: string, st: string, d: number, p: string, min: number, max: number, answer: number, tol: number, lbl: string, e?: string) => base(w, s, 'numline', st, d, p, { min, max, answer, tol, label: lbl }, e)
const sl = (w: string, s: string, st: string, d: number, p: string, min: number, max: number, answer: number, tol: number, unit: string, e?: string) => base(w, s, 'slider', st, d, p, { min, max, answer, tol, unit }, e)
const quest = (w: string, s: string, st: string, d: number, task: string) => base(w, s, 'party', st, d, `Quest: ${task}.`, { task, quest: true })
// predict → test → explain (the signature "experiment" format)
const pte = (w: string, s: string, st: string, d: number, title: string, pq: string, pc: string[], pa: number, sim: string, eq: string, ec: string[], ea: number, e?: string) =>
  base(w, s, 'pte', st, d, title, { predict: { prompt: pq, choices: pc, answer: pa }, sim, explain: { prompt: eq, choices: ec, answer: ea } }, e)
// reasoning multiple-choice WITH an explicit Bloom override (analyse / apply / create)
const think = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, bloom: string, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e, bloom)

// ════════════════ NUM · reason about number, don't just recall ════════════════
const NUM: PackItem[] = [
  fix('NUM', 'arith', 'starter', 2, 'Find the mistake in this sum.', ['7', '+', '5', '=', '11'], 4, '12', '7 + 5 = 12, not 11.'),
  fix('NUM', 'arith', 'explorer', 3, 'Spot the wrong step.', ['24', '÷', '4', '=', '8'], 4, '6', '24 ÷ 4 = 6.'),
  seq('NUM', 'arith', 'explorer', 3, 'Order the steps to solve 2 + 3 × 4 correctly.', ['Multiply 3 × 4 = 12', 'Add 2 + 12', 'Answer is 14'], 'Multiplication before addition.'),
  sort('NUM', 'placevalue', 'starter', 2, 'Sort each number: odd or even?', ['Odd', 'Even'], [{ text: '7', bucket: 0 }, { text: '10', bucket: 1 }, { text: '3', bucket: 0 }, { text: '8', bucket: 1 }], 'Even numbers end in 0,2,4,6,8.'),
  sort('NUM', 'fractions', 'explorer', 3, 'Sort: bigger or smaller than 1/2?', ['Bigger', 'Smaller'], [{ text: '3/4', bucket: 0 }, { text: '1/4', bucket: 1 }, { text: '2/3', bucket: 0 }, { text: '1/3', bucket: 1 }]),
  nl('NUM', 'placevalue', 'explorer', 3, 'Estimate: drag to where 47 sits.', 0, 100, 47, 4, '47'),
  sl('NUM', 'measure', 'explorer', 3, 'Estimate the length of a school bus.', 0, 30, 12, 3, 'm', 'A bus is about 12 metres.'),
  think('NUM', 'arith', 'explorer', 3, 'Which is the smartest way to work out 199 + 199?', ['Add slowly in columns', 'Do 200 + 200, then take away 2', 'Count on your fingers', 'Guess'], 1, 'apply', 'Rounding then adjusting is efficient.'),
  think('NUM', 'money', 'explorer', 3, 'A toy is $8. You have three $5 notes. Best reason it fits?', ['$15 is more than $8', '$5 is less than $8', 'You need more money', "You can't buy it"], 0, 'analyze'),
  think('NUM', 'fractions', 'builder', 3, 'Why is 3/6 the same as 1/2?', ['Both have a 3', 'Top is half the bottom in each', '6 is bigger than 2', 'They are not equal'], 1, 'analyze'),
  seq('NUM', 'arith', 'builder', 3, 'Order the steps to solve 3(x + 2) = 15.', ['Divide both sides by 3', 'x + 2 = 5', 'Subtract 2', 'x = 3'], 'Undo multiply, then undo add.'),
  fix('NUM', 'arith', 'builder', 4, 'Spot the algebra error.', ['x', '+', '5', '=', '12', 'so', 'x', '=', '17'], 8, '7', 'Subtract 5 from both sides: x = 7.'),
  think('NUM', 'geometry', 'builder', 4, 'A shape has 4 equal sides but no right angles. It is best called a…', ['square', 'rhombus', 'rectangle', 'circle'], 1, 'analyze'),
  sl('NUM', 'geometry', 'builder', 3, 'Estimate the angle shown as a fraction of a turn.', 0, 360, 90, 15, '°', 'A quarter turn is 90°.'),
  think('NUM', 'arith', 'champion', 4, 'Prices rise 10% then fall 10%. Compared to the start, the price is now…', ['the same', 'slightly higher', 'slightly lower', 'double'], 2, 'analyze', '×1.1 then ×0.9 = ×0.99 — a little lower.'),
  seq('NUM', 'arith', 'champion', 4, 'Order the steps to find the mean of a data set.', ['Add all the values', 'Count how many values', 'Divide the sum by the count'], 'Sum ÷ count = mean.'),
]

// ════════════════ WRD · analyse language, build it, fix it ════════════════
const WRD: PackItem[] = [
  fix('WRD', 'grammar', 'starter', 2, 'Tap the word that should be capital.', ['my', 'dog', 'is', 'rex'], 3, 'Rex', 'Names take a capital letter.'),
  fix('WRD', 'grammar', 'explorer', 3, 'Find the wrong word.', ['She', 'walk', 'to', 'school'], 1, 'walks', 'She/he/it → add s.'),
  bank('WRD', 'writing', 'explorer', 2, 'Build a sentence that makes sense.', ['The', 'cat', 'chased', 'the', 'mouse'], ['The', 'cat', 'chased', 'the', 'mouse']),
  seq('WRD', 'reading', 'explorer', 3, 'Put the story in order.', ['She planted a seed', 'It grew into a plant', 'The plant made flowers'], 'Beginning, middle, end.'),
  sort('WRD', 'grammar', 'explorer', 3, 'Sort the words: noun, verb or adjective?', ['Noun', 'Verb', 'Adjective'], [{ text: 'dog', bucket: 0 }, { text: 'run', bucket: 1 }, { text: 'happy', bucket: 2 }, { text: 'jump', bucket: 1 }, { text: 'happiness', bucket: 0 }]),
  think('WRD', 'reading', 'explorer', 3, 'A sign says "Danger! Keep out." The writer wants to…', ['entertain you', 'warn you', 'sell you something', 'make you laugh'], 1, 'analyze'),
  think('WRD', 'reading', 'builder', 3, '"The room fell silent as she entered." This suggests people were…', ['bored', 'surprised or nervous', 'asleep', 'singing'], 1, 'analyze', 'Inferring mood from clues.'),
  fix('WRD', 'grammar', 'builder', 3, 'Find the punctuation error.', ['Its', 'raining', 'again', 'today'], 0, "It's", "It's = it is."),
  bank('WRD', 'writing', 'builder', 3, 'Build a complex sentence.', ['Because', 'it', 'was', 'late,', 'we', 'left'], ['Because', 'it', 'was', 'late,', 'we', 'left']),
  seq('WRD', 'writing', 'builder', 3, 'Order the parts of a good paragraph.', ['Topic sentence', 'Supporting detail', 'Example', 'Concluding sentence']),
  think('WRD', 'reading', 'builder', 4, 'Two texts disagree about a hero. To decide, a good reader…', ['believes the first one', 'checks the evidence in each', 'picks the longer one', 'ignores both'], 1, 'analyze'),
  think('WRD', 'vocab', 'champion', 4, 'The word "notorious" is closest in feeling to…', ['famous for good', 'famous for bad', 'unknown', 'shy'], 1, 'analyze'),
  fix('WRD', 'grammar', 'champion', 4, 'Find the wrong word.', ['Their', 'going', 'to', 'be', 'late'], 0, "They're", "They're = they are."),
  think('WRD', 'writing', 'champion', 4, 'Which opening line best "hooks" a reader?', ['This is my story.', 'The scream came from inside the house.', 'I will now begin.', 'It was a day.'], 1, 'create'),
  think('WRD', 'reading', 'legend', 4, 'A politician says "Everyone knows this plan works." This is an example of…', ['solid evidence', 'a bandwagon appeal', 'a statistic', 'a quotation'], 1, 'analyze', 'Persuasion technique, not proof.'),
]

// ════════════════ WON · predict, test, explain — real experiments ════════════════
const WON: PackItem[] = [
  pte('WON', 'chemistry', 'starter', 2, 'Ice cube race', 'Which melts an ice cube faster?', ['A warm hand', 'A cold table'], 0, '🧊🤚→💧', 'Why?', ['Heat moves into the ice', 'Ice makes heat', 'Hands are wet'], 0),
  pte('WON', 'physics', 'explorer', 3, 'Drop test', 'Drop a feather and a coin. Which lands first (in air)?', ['The coin', 'The feather', 'Same time'], 0, '🪙⬇️🪶', 'Why?', ['Air slows the light feather more', 'Coins are magic', 'Feathers are heavy'], 0),
  pte('WON', 'physics', 'explorer', 3, 'Two-bulb circuit', 'Add a 2nd bulb in a line to one battery. The bulbs get…', ['brighter', 'dimmer', 'no change'], 1, '🔋💡💡', 'Why?', ['One push is shared by two bulbs', 'Bulbs make power', 'Wires shrink'], 0),
  pte('WON', 'biology', 'builder', 3, 'Plant in the dark', 'A plant is left in a dark cupboard for a week. It will…', ['grow greener', 'turn pale and weak', 'grow flowers'], 1, '🌱🚫☀️', 'Why?', ['No light means no photosynthesis', 'Plants prefer dark', 'It needs less water'], 0),
  label('WON', 'biology', 'explorer', 3, 'Label the parts of the plant.', '🌻', [['Top', 'Flower'], ['Middle', 'Stem'], ['Bottom', 'Roots']]),
  label('WON', 'biology', 'builder', 3, 'Label the parts of the cell.', '🔬', [['Control centre', 'Nucleus'], ['Powerhouse', 'Mitochondria'], ['Outer layer', 'Membrane']]),
  sort('WON', 'biology', 'explorer', 3, 'Sort: mammal, bird or fish?', ['Mammal', 'Bird', 'Fish'], [{ text: 'Whale', bucket: 0 }, { text: 'Eagle', bucket: 1 }, { text: 'Shark', bucket: 2 }, { text: 'Bat', bucket: 0 }, { text: 'Penguin', bucket: 1 }], 'A whale is a mammal; a penguin is a bird.'),
  seq('WON', 'earth', 'explorer', 3, 'Order the water cycle.', ['Sun heats water → evaporation', 'Vapour cools → condensation', 'Clouds release rain → precipitation', 'Water flows back → collection']),
  seq('WON', 'earth', 'builder', 3, 'Order how a fossil forms.', ['An animal dies and is buried', 'Sediment layers press down', 'Minerals replace the bone', 'Erosion reveals the fossil']),
  think('WON', 'physics', 'builder', 3, 'You push a box and it slows to a stop. The best explanation is…', ['boxes get tired', 'friction acts against it', 'gravity pulls it back', 'it ran out of battery'], 1, 'analyze'),
  sort('WON', 'chemistry', 'builder', 3, 'Sort: solid, liquid or gas at room temperature?', ['Solid', 'Liquid', 'Gas'], [{ text: 'Ice', bucket: 0 }, { text: 'Water', bucket: 1 }, { text: 'Steam', bucket: 2 }, { text: 'Rock', bucket: 0 }, { text: 'Oxygen', bucket: 2 }]),
  think('WON', 'chemistry', 'champion', 4, 'A candle burns and seems to "disappear". Best explanation?', ['matter is destroyed', 'it turns into gases and heat', 'it becomes nothing', 'it melts into the table'], 1, 'analyze', 'Mass is conserved — it becomes CO₂ + water vapour.'),
  label('WON', 'chemistry', 'legend', 4, 'Label the atom.', '⚛️', [['Centre', 'Nucleus'], ['Positive', 'Proton'], ['Orbiting', 'Electron']]),
  think('WON', 'biology', 'legend', 4, 'A population of dark moths survives better in a sooty city. Over time the moths become…', ['mostly light', 'mostly dark', 'all the same size', 'extinct'], 1, 'analyze', 'Natural selection favours the camouflaged.'),
  pte('WON', 'physics', 'champion', 4, 'Ramp race', 'Roll a heavy and a light ball down the same ramp. Which reaches the bottom first?', ['Heavy', 'Light', 'About the same'], 2, '⚫⚪↘️', 'Why?', ['Gravity accelerates both the same', 'Heavy things always win', 'Light things float'], 0),
]

// ════════════════ LOG · build programs, debug, reason ════════════════
const LOG: PackItem[] = [
  code('LOG', 'code', 'starter', 2, 'Program the robot: walk, then jump.', ['walk()', 'jump()'], ['walk()', 'jump()']),
  code('LOG', 'code', 'explorer', 3, 'Order the code so the robot goes forward, turns, forward.', ['forward()', 'turn()', 'forward()'], ['forward()', 'turn()', 'forward()']),
  code('LOG', 'code', 'explorer', 3, 'Build a loop that says hello 3 times.', ['repeat 3:', '  say("hi")'], ['repeat 3:', '  say("hi")'], 'Loops repeat actions.'),
  code('LOG', 'code', 'builder', 3, 'Order the program so it only prints when x is big.', ['x = 7', 'if x > 5:', '  print("big")'], ['x = 7', 'if x > 5:', '  print("big")']),
  code('LOG', 'code', 'builder', 4, 'Build a program that counts down from 3.', ['for n in [3,2,1]:', '  print(n)', 'print("go!")'], ['for n in [3,2,1]:', '  print(n)', 'print("go!")']),
  seq('LOG', 'code', 'explorer', 3, 'Order the debugging steps.', ['Read the error message', 'Find the broken line', 'Fix the code', 'Run it again']),
  seq('LOG', 'logic', 'explorer', 3, 'Ali > Ben, Ben > Cy. Order them tallest first.', ['Ali', 'Ben', 'Cy'], 'Chain the comparisons.'),
  sort('LOG', 'code', 'builder', 3, 'Sort: input or output device?', ['Input', 'Output'], [{ text: 'Keyboard', bucket: 0 }, { text: 'Monitor', bucket: 1 }, { text: 'Mouse', bucket: 0 }, { text: 'Speaker', bucket: 1 }, { text: 'Microphone', bucket: 0 }]),
  think('LOG', 'logic', 'explorer', 3, 'If "all cats are animals", which MUST be true?', ['All animals are cats', 'Some animals are cats', 'No cats are animals', 'Cats are plants'], 1, 'analyze'),
  think('LOG', 'code', 'builder', 3, 'A program repeats forever and never stops. It has a…', ['syntax error', 'infinite loop', 'virus', 'good design'], 1, 'analyze'),
  think('LOG', 'data', 'builder', 3, 'A chart shows sales doubled each month. This growth is…', ['linear', 'exponential', 'flat', 'random'], 1, 'analyze'),
  think('LOG', 'ai', 'champion', 4, 'An AI confidently gives a made-up fact. The safest response is to…', ['trust it fully', 'verify it from another source', 'share it widely', 'ignore all AI'], 1, 'analyze'),
  code('LOG', 'code', 'legend', 4, 'Order a function that returns the bigger of a, b.', ['def big(a, b):', '  if a > b:', '    return a', '  return b'], ['def big(a, b):', '  if a > b:', '    return a', '  return b']),
  think('LOG', 'code', 'legend', 4, 'Two algorithms sort a list; one is O(n²), one is O(n log n). For a huge list, choose…', ['the O(n²) one', 'the O(n log n) one', 'either, same speed', 'neither'], 1, 'apply', 'n log n grows far slower for big n.'),
  seq('LOG', 'code', 'legend', 4, 'Order the software design cycle.', ['Define the problem', 'Design a solution', 'Write the code', 'Test it', 'Improve it']),
]

// ════════════════ WLD · locate, sequence history, reason cause & effect ════════════════
const WLD: PackItem[] = [
  map('WLD', 'geography', 'explorer', 2, 'Which country is home to the Eiffel Tower?', ['France', 'Italy', 'Spain'], 0),
  map('WLD', 'geography', 'explorer', 3, 'The Amazon rainforest is mostly in which country?', ['Brazil', 'India', 'Egypt'], 0),
  map('WLD', 'geography', 'builder', 3, 'Which continent has the Sahara Desert?', ['Africa', 'Asia', 'Europe'], 0),
  seq('WLD', 'history', 'explorer', 3, 'Order these, oldest first.', ['Ancient Egypt', 'Roman Empire', 'Middle Ages', 'Today']),
  seq('WLD', 'history', 'builder', 3, 'Order the inventions, oldest first.', ['The wheel', 'The printing press', 'The steam engine', 'The internet']),
  sort('WLD', 'geography', 'explorer', 3, 'Sort: continent or country?', ['Continent', 'Country'], [{ text: 'Asia', bucket: 0 }, { text: 'Japan', bucket: 1 }, { text: 'Africa', bucket: 0 }, { text: 'Brazil', bucket: 1 }]),
  sort('WLD', 'economics', 'builder', 3, 'Sort: a good or a service?', ['Good', 'Service'], [{ text: 'A phone', bucket: 0 }, { text: 'A haircut', bucket: 1 }, { text: 'A loaf of bread', bucket: 0 }, { text: 'Bus ride', bucket: 1 }]),
  think('WLD', 'geography', 'explorer', 3, 'Cities often grow next to rivers because rivers give…', ['gold', 'water and transport', 'mountains', 'deserts'], 1, 'analyze'),
  think('WLD', 'history', 'builder', 3, 'We study history mainly to…', ['memorise dates', 'learn from the past', 'feel old', 'avoid the future'], 1, 'analyze'),
  think('WLD', 'economics', 'builder', 3, 'A drought destroys a wheat crop. The price of bread will likely…', ['fall', 'rise', 'stay exactly the same', 'become free'], 1, 'analyze', 'Less supply, same demand → higher price.'),
  think('WLD', 'economics', 'champion', 4, 'A country imports far more than it exports. Over time this can…', ['always make it rich', 'build up debt', 'have no effect', 'stop all trade'], 1, 'analyze'),
  map('WLD', 'geography', 'champion', 4, 'Which country has the largest population?', ['India', 'Canada', 'Norway'], 0),
  think('WLD', 'geography', 'champion', 4, 'Coastal towns are warming and seas are rising. A sensible response is to…', ['ignore it', 'build defences and plan', 'move everyone to space', 'stop making maps'], 1, 'create'),
  seq('WLD', 'economics', 'legend', 4, 'Order how money flows in a simple economy.', ['A worker earns wages', 'They spend at a shop', 'The shop pays its staff', 'Those staff spend again']),
  think('WLD', 'economics', 'legend', 4, 'Two towns want one factory. To decide fairly, leaders should compare…', ['which mayor is louder', 'jobs, cost and impact of each', 'the town names', 'the weather'], 1, 'analyze'),
]

// ════════════════ LIF · plan, evaluate, act in the real world ════════════════
const LIF: PackItem[] = [
  seq('LIF', 'habits', 'starter', 2, 'Order a healthy morning.', ['Wake up', 'Wash face', 'Eat breakfast', 'Pack bag']),
  sort('LIF', 'habits', 'explorer', 2, 'Sort: healthy or treat food?', ['Healthy', 'Treat'], [{ text: 'Apple', bucket: 0 }, { text: 'Soda', bucket: 1 }, { text: 'Carrot', bucket: 0 }, { text: 'Candy', bucket: 1 }, { text: 'Water', bucket: 0 }]),
  sort('LIF', 'habits', 'explorer', 3, 'Sort: need or want?', ['Need', 'Want'], [{ text: 'Clean water', bucket: 0 }, { text: 'A new game', bucket: 1 }, { text: 'Sleep', bucket: 0 }, { text: 'Latest phone', bucket: 1 }]),
  seq('LIF', 'kindness', 'explorer', 3, 'Order the steps to calm a big feeling.', ['Notice the feeling', 'Take slow breaths', 'Name what you feel', 'Choose what to do']),
  think('LIF', 'kindness', 'explorer', 3, 'A friend is being teased. The kindest brave choice is to be an…', ['ignorer', 'upstander who helps', 'bystander', 'teaser too'], 1, 'analyze'),
  think('LIF', 'habits', 'explorer', 3, 'A game asks for your home address to "win a prize". You should…', ['send it fast', 'say no and tell an adult', 'send a photo instead', 'give a friend\'s address'], 1, 'analyze', 'Never share private info online.'),
  quest('LIF', 'kindness', 'explorer', 2, 'give a genuine compliment to someone today'),
  quest('LIF', 'habits', 'explorer', 2, 'plan and pack everything you need for tomorrow'),
  quest('LIF', 'movement', 'explorer', 2, 'invent a 5-move stretch routine and do it'),
  seq('LIF', 'habits', 'builder', 3, 'Order the goal-setting steps.', ['Set a clear goal', 'Break it into small steps', 'Do the first step', 'Review your progress']),
  think('LIF', 'habits', 'builder', 3, 'You get $10 pocket money. The healthiest money habit is to…', ['spend it all today', 'save a little every time', 'lend it to strangers', 'lose track of it'], 1, 'apply'),
  think('LIF', 'kindness', 'builder', 4, 'Two friends give you opposite advice. A wise first step is to…', ['pick the louder friend', 'weigh both against your values', 'do neither', 'flip a coin'], 1, 'analyze'),
  quest('LIF', 'kindness', 'builder', 3, 'do one helpful chore for your family without being asked'),
  think('LIF', 'habits', 'champion', 4, 'In the 50/30/20 money rule, the 20% is for…', ['wants', 'needs', 'saving', 'snacks'], 2, 'apply', '50 needs, 30 wants, 20 savings.'),
  think('LIF', 'habits', 'legend', 4, 'An online message says "act NOW or lose your account!" This urgency is a classic sign of a…', ['helpful reminder', 'scam', 'software update', 'friend'], 1, 'analyze'),
]

export const CONTENT_PACK_16: PackItem[] = [...NUM, ...WRD, ...WON, ...LOG, ...WLD, ...LIF]
