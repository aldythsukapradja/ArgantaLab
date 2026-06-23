// ============================================================
//  ARGANTALAB · CONTENT PACK 2  — fills out Starter (6–8) &
//  Builder (11–14), opens Champion (14–16), and deepens thin
//  Explorer skills. Varied interaction types, verified answers.
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
  return { id: `cp2_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, xp: 10, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  STARTER (ages 6–8) — gentle, concrete, difficulty 1–2
// ════════════════════════════════════════════════════════════
const STARTER: PackItem[] = [
  // NUM
  m('NUM', 'arith', 'type', 'starter', 1, '4 + 4 = ?', { answer: '8', numeric: true }),
  m('NUM', 'arith', 'type', 'starter', 1, '9 − 3 = ?', { answer: '6', numeric: true }),
  m('NUM', 'arith', 'mcq', 'starter', 1, 'Which makes 10? 6 + ?', { choices: ['2', '3', '4', '5'], answer: 2 }, { explanation: '6 + 4 = 10.' }),
  m('NUM', 'times', 'mcq', 'starter', 1, 'Count by 2s: 2, 4, 6, __?', { choices: ['7', '8', '9', '10'], answer: 1 }, { explanation: 'Add 2 → 8.' }),
  m('NUM', 'times', 'type', 'starter', 2, '5 × 2 = ?', { answer: '10', numeric: true }),
  m('NUM', 'placevalue', 'mcq', 'starter', 1, 'What number comes after 19?', { choices: ['18', '20', '21', '90'], answer: 1 }),
  m('NUM', 'placevalue', 'seq', 'starter', 2, 'Put in order, smallest first.', { items: ['3', '7', '11', '15'] }),
  m('NUM', 'money', 'mcq', 'starter', 1, 'Which is worth more?', { choices: ['10p', '2p', '1p', '5p'], answer: 0 }),
  m('NUM', 'geometry', 'mcq', 'starter', 1, 'How many corners does a square have?', { choices: ['3', '4', '5', '6'], answer: 1 }),
  m('NUM', 'geometry', 'match', 'starter', 2, 'Match the shape to its name.', { pairs: [['🔺', 'Triangle'], ['⬛', 'Square'], ['🔵', 'Circle']] }),
  m('NUM', 'fractions', 'type', 'starter', 1, 'Half of 6 is...?', { answer: '3', numeric: true }),
  m('NUM', 'measure', 'mcq', 'starter', 1, 'Which is heavier?', { choices: ['An elephant', 'A feather', 'A leaf', 'A button'], answer: 0 }),
  m('NUM', 'time', 'mcq', 'starter', 1, 'How many months are in a year?', { choices: ['10', '12', '7', '24'], answer: 1 }),
  // WRD
  m('WRD', 'phonics', 'mcq', 'starter', 1, 'Which word rhymes with "dog"?', { choices: ['log', 'cat', 'sun', 'pen'], answer: 0 }),
  m('WRD', 'phonics', 'listen', 'starter', 1, 'Which letter makes this sound?', { say: 'sss', choices: ['s', 'z', 't'], answer: 0 }),
  m('WRD', 'phonics', 'cloze', 'starter', 1, 'Finish the word: ca__', { before: 'ca', after: '', options: ['t', 'r', 'd'], answer: 't' }),
  m('WRD', 'grammar', 'cloze', 'starter', 1, 'Choose a or an.', { before: 'I see ', after: ' egg.', options: ['a', 'an'], answer: 'an' }),
  m('WRD', 'grammar', 'fix', 'starter', 2, 'Tap the letter that should be a capital.', { tokens: ['i', 'am', 'happy'], wrong: 0, fix: 'I' }),
  m('WRD', 'vocab', 'match', 'starter', 1, 'Match the opposites.', { pairs: [['day', 'night'], ['big', 'small'], ['fast', 'slow']] }),
  m('WRD', 'writing', 'seq', 'starter', 2, 'Put the bedtime in order.', { items: ['Put on pyjamas', 'Brush teeth', 'Get in bed', 'Sleep'] }),
  // WON
  m('WON', 'biology', 'match', 'starter', 1, 'Match the animal to its home.', { pairs: [['Bird', 'Nest'], ['Bee', 'Hive'], ['Dog', 'Kennel']] }),
  m('WON', 'biology', 'mcq', 'starter', 1, 'A baby dog is called a...', { choices: ['Kitten', 'Puppy', 'Calf', 'Chick'], answer: 1 }),
  m('WON', 'earth', 'mcq', 'starter', 1, 'When do we see the Sun?', { choices: ['Daytime', 'Night', 'Never', 'Only winter'], answer: 0 }),
  m('WON', 'earth', 'sort', 'starter', 2, 'Sort: sunny-day or rainy-day?', { buckets: ['Sunny', 'Rainy'], items: [{ text: 'Sunglasses', bucket: 0 }, { text: 'Umbrella', bucket: 1 }, { text: 'Hat', bucket: 0 }, { text: 'Raincoat', bucket: 1 }] }),
  m('WON', 'physics', 'pte', 'starter', 2, 'You put a cork in water.', { predict: { prompt: 'Predict: float or sink?', choices: ['Float', 'Sink'], answer: 0 }, sim: '🪵 floats on 💧', explain: { prompt: 'Why?', choices: ['Cork is light for its size', 'Cork is heavy'], answer: 0 } }),
  m('WON', 'chemistry', 'sort', 'starter', 2, 'Sort: hot or cold?', { buckets: ['Hot', 'Cold'], items: [{ text: 'Ice', bucket: 1 }, { text: 'Fire', bucket: 0 }, { text: 'Snow', bucket: 1 }, { text: 'Sun', bucket: 0 }] }),
  // LOG
  m('LOG', 'logic', 'mcq', 'starter', 1, 'Pattern: 🐱🐶🐱🐶🐱__?', { choices: ['🐶', '🐱', '🐰', '🐭'], answer: 0 }),
  m('LOG', 'logic', 'seq', 'starter', 2, 'Order: make toast.', { items: ['Get bread', 'Put in toaster', 'Wait', 'Eat'] }),
  m('LOG', 'code', 'mcq', 'starter', 1, 'A robot follows your...', { choices: ['Instructions', 'Feelings', 'Dreams', 'Songs'], answer: 0 }),
  m('LOG', 'data', 'mcq', 'starter', 1, 'Which is more: 3 or 7?', { choices: ['3', '7', 'Same', 'None'], answer: 1 }),
  // WLD
  m('WLD', 'geography', 'sort', 'starter', 2, 'Sort: land or water?', { buckets: ['Land', 'Water'], items: [{ text: 'Mountain', bucket: 0 }, { text: 'Ocean', bucket: 1 }, { text: 'Forest', bucket: 0 }, { text: 'River', bucket: 1 }] }),
  m('WLD', 'history', 'mcq', 'starter', 1, 'Which is from long ago?', { choices: ['A dinosaur', 'A robot', 'A phone', 'A jet'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'starter', 2, 'Which is a "need"?', { choices: ['Water', 'A toy', 'Candy', 'Stickers'], answer: 0 }),
  // LIF
  m('LIF', 'habits', 'party', 'starter', 1, 'Daily quest', { task: 'Wash your hands before eating', quest: true }),
  m('LIF', 'kindness', 'mcq', 'starter', 1, 'Your friend is sad. You can...', { choices: ['Give a hug', 'Laugh', 'Run away', 'Shout'], answer: 0 }),
  m('LIF', 'movement', 'party', 'starter', 1, 'Movement quest', { task: 'Hop on one foot 10 times', quest: true }),
  m('LIF', 'party', 'party', 'starter', 1, 'Emoji guess', { prompt: 'Yellow, in the sky, warm ☀️', reveal: '🌞 Sun!' }),
]

// ════════════════════════════════════════════════════════════
//  BUILDER (ages 11–14) — abstract, multi-step, difficulty 4–5
// ════════════════════════════════════════════════════════════
const BUILDER: PackItem[] = [
  // NUM
  m('NUM', 'times', 'type', 'builder', 4, '14 × 6 = ?', { answer: '84', numeric: true }, { explanation: '14 × 6 = 84.' }),
  m('NUM', 'times', 'mcq', 'builder', 4, 'Which is a square number?', { choices: ['36', '40', '45', '50'], answer: 0 }, { explanation: '6 × 6 = 36.' }),
  m('NUM', 'fractions', 'mcq', 'builder', 5, 'Simplify 6/8.', { choices: ['3/4', '2/3', '1/2', '4/6'], answer: 0 }, { explanation: 'Divide top & bottom by 2 → 3/4.' }),
  m('NUM', 'fractions', 'type', 'builder', 5, '1/2 + 1/4 = ? (write as x/4)', { answer: '3/4' }, { explanation: '1/2 = 2/4, + 1/4 = 3/4.' }),
  m('NUM', 'arith', 'type', 'builder', 4, 'What is −5 + 8?', { answer: '3', numeric: true }, { explanation: 'Start at −5, count up 8 → 3.' }),
  m('NUM', 'placevalue', 'type', 'builder', 4, 'Round 4,762 to the nearest thousand.', { answer: '5000', numeric: true }, { explanation: '4762 is closer to 5000.' }),
  m('NUM', 'placevalue', 'mcq', 'builder', 5, 'In 3.47, what is the value of the 4?', { choices: ['4 tenths', '4 hundredths', '4 ones', '4 tens'], answer: 0 }, { explanation: 'First decimal place = tenths.' }),
  m('NUM', 'geometry', 'type', 'builder', 4, 'Area of a rectangle 6 cm by 4 cm? (cm²)', { answer: '24', numeric: true }, { explanation: '6 × 4 = 24 cm².' }),
  m('NUM', 'geometry', 'type', 'builder', 5, 'Angles in a triangle add up to how many degrees?', { answer: '180', numeric: true }, { explanation: 'A triangle\'s angles sum to 180°.' }),
  m('NUM', 'measure', 'type', 'builder', 4, 'How many millilitres in 2.5 litres?', { answer: '2500', numeric: true }, { explanation: '1 L = 1000 ml.' }),
  m('NUM', 'time', 'mcq', 'builder', 4, 'In 24-hour time, 3 PM is...', { choices: ['13:00', '15:00', '03:00', '23:00'], answer: 1 }, { explanation: '12 + 3 = 15:00.' }),
  m('NUM', 'money', 'type', 'builder', 5, 'A £20 game is 25% off. New price in £?', { answer: '15', numeric: true }, { explanation: '25% of 20 = 5; 20 − 5 = £15.' }),
  // WRD
  m('WRD', 'grammar', 'mcq', 'builder', 4, 'Which sentence is in the passive voice?', { choices: ['The dog chased the ball.', 'The ball was chased by the dog.', 'The dog runs fast.', 'Chase the ball!'], answer: 1 }, { explanation: 'Passive: the subject receives the action.' }),
  m('WRD', 'grammar', 'fix', 'builder', 5, 'Tap the word with the wrong tense.', { tokens: ['Yesterday', 'I', 'go', 'home'], wrong: 2, fix: 'went' }, { explanation: '"Yesterday" needs past tense "went".' }),
  m('WRD', 'vocab', 'mcq', 'builder', 5, 'What does the idiom "break the ice" mean?', { choices: ['Start a conversation', 'Smash something', 'Get cold', 'Win a game'], answer: 0 }),
  m('WRD', 'vocab', 'cloze', 'builder', 4, 'Add a prefix meaning "again": __build', { before: '', after: 'build', options: ['re', 'un', 'dis'], answer: 're' }),
  m('WRD', 'writing', 'bank', 'builder', 4, 'Build a sentence with a conjunction.', { tiles: ['I', 'was', 'tired', 'but', 'I', 'finished'], answer: ['I', 'was', 'tired', 'but', 'I', 'finished'] }),
  // WON
  m('WON', 'biology', 'mcq', 'builder', 4, 'Which process do plants use to make food?', { choices: ['Respiration', 'Photosynthesis', 'Digestion', 'Evaporation'], answer: 1 }),
  m('WON', 'biology', 'mcq', 'builder', 5, 'The basic unit of all living things is the...', { choices: ['Atom', 'Cell', 'Organ', 'Molecule'], answer: 1 }),
  m('WON', 'chemistry', 'mcq', 'builder', 4, 'Which is an acid?', { choices: ['Lemon juice', 'Soap', 'Pure water', 'Baking soda'], answer: 0 }),
  m('WON', 'physics', 'type', 'builder', 5, 'A car travels 100 m in 5 s. Its speed in m/s?', { answer: '20', numeric: true }, { explanation: 'Speed = distance ÷ time = 100 ÷ 5 = 20 m/s.' }),
  m('WON', 'physics', 'mcq', 'builder', 4, 'In a circuit, what does a switch do?', { choices: ['Breaks or completes the circuit', 'Stores energy', 'Makes light', 'Adds resistance only'], answer: 0 }),
  m('WON', 'earth', 'seq', 'builder', 4, 'Order the planets from the Sun.', { items: ['Mercury', 'Venus', 'Earth', 'Mars'] }),
  // LOG
  m('LOG', 'code', 'code', 'builder', 5, 'Order blocks: a function that greets.', { tiles: ['function greet(name)', '  say "Hi " + name', 'end', 'greet("Zoe")'], answer: ['function greet(name)', '  say "Hi " + name', 'end', 'greet("Zoe")'] }),
  m('LOG', 'data', 'type', 'builder', 4, 'The median of 3, 9, 4, 7, 5 is?', { answer: '5', numeric: true }, { explanation: 'Sorted: 3,4,5,7,9 → middle = 5.' }),
  m('LOG', 'data', 'mcq', 'builder', 5, 'The most common value in a set is the...', { choices: ['Mean', 'Median', 'Mode', 'Range'], answer: 2 }),
  m('LOG', 'logic', 'mcq', 'builder', 4, '"NOT (true AND false)" equals...', { choices: ['true', 'false', 'maybe', 'error'], answer: 0 }, { explanation: 'true AND false = false; NOT false = true.' }),
  m('LOG', 'ai', 'mcq', 'builder', 5, 'How does machine learning improve?', { choices: ['By studying lots of examples', 'By magic', 'By guessing once', 'It cannot improve'], answer: 0 }),
  // WLD
  m('WLD', 'geography', 'mcq', 'builder', 4, 'Lines that run east–west around the globe are lines of...', { choices: ['Latitude', 'Longitude', 'Altitude', 'Equator'], answer: 0 }),
  m('WLD', 'history', 'seq', 'builder', 5, 'Order: oldest civilisation first.', { items: ['Ancient Egypt', 'Roman Empire', 'Middle Ages', 'Modern era'] }),
  m('WLD', 'economics', 'mcq', 'builder', 5, 'If demand rises and supply stays the same, price usually...', { choices: ['Goes up', 'Goes down', 'Stays same', 'Disappears'], answer: 0 }),
  // LIF
  m('LIF', 'kindness', 'mcq', 'builder', 4, 'Empathy means...', { choices: ['Understanding how others feel', 'Always agreeing', 'Winning arguments', 'Ignoring people'], answer: 0 }),
  m('LIF', 'habits', 'mcq', 'builder', 4, 'A SMART goal is specific, measurable, achievable, relevant and...', { choices: ['Time-bound', 'Tiny', 'Tricky', 'Tempting'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  CHAMPION (ages 14–16) — exam-level, difficulty 5
// ════════════════════════════════════════════════════════════
const CHAMPION: PackItem[] = [
  m('NUM', 'arith', 'type', 'champion', 5, 'Solve for x: 3x + 7 = 22', { answer: '5', numeric: true }, { explanation: '3x = 15, x = 5.' }),
  m('NUM', 'fractions', 'type', 'champion', 5, 'What is 0.75 as a percentage?', { answer: '75', numeric: true }, { explanation: '0.75 = 75%.' }),
  m('NUM', 'geometry', 'type', 'champion', 5, "A right triangle has legs 3 and 4. Hypotenuse?", { answer: '5', numeric: true }, { explanation: '3² + 4² = 25, √25 = 5 (Pythagoras).' }),
  m('NUM', 'placevalue', 'mcq', 'champion', 5, 'Standard form of 45,000?', { choices: ['4.5 × 10⁴', '45 × 10³', '4.5 × 10³', '450 × 10²'], answer: 0 }),
  m('WRD', 'grammar', 'mcq', 'champion', 5, 'Which is a subordinate clause?', { choices: ['because it was raining', 'the dog barked', 'run fast', 'a big house'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'champion', 5, 'What does "ubiquitous" mean?', { choices: ['Found everywhere', 'Very rare', 'Ancient', 'Confusing'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'champion', 5, 'What is the chemical symbol for water?', { choices: ['H₂O', 'CO₂', 'O₂', 'NaCl'], answer: 0 }),
  m('WON', 'physics', 'mcq', 'champion', 5, 'Newton\'s 3rd law: every action has an equal and opposite...', { choices: ['Reaction', 'Friction', 'Velocity', 'Mass'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'champion', 5, 'DNA is found in the cell\'s...', { choices: ['Nucleus', 'Membrane', 'Cytoplasm only', 'Wall'], answer: 0 }),
  m('LOG', 'code', 'mcq', 'champion', 5, 'What is the output of a loop that runs "i from 1 to 3, print i"?', { choices: ['1 2 3', '0 1 2', '3 2 1', '1 1 1'], answer: 0 }),
  m('LOG', 'data', 'type', 'champion', 5, 'Mean of 10, 20, 30, 40, 50?', { answer: '30', numeric: true }, { explanation: '150 ÷ 5 = 30.' }),
  m('LOG', 'ai', 'mcq', 'champion', 5, 'Training data that unfairly favours one group causes...', { choices: ['Bias', 'Speed', 'Storage', 'Encryption'], answer: 0 }),
  m('WLD', 'geography', 'match', 'champion', 5, 'Match the country to its continent.', { pairs: [['Brazil', 'South America'], ['Kenya', 'Africa'], ['Japan', 'Asia'], ['France', 'Europe']] }),
  m('WLD', 'economics', 'mcq', 'champion', 5, 'Inflation means prices, on average, are...', { choices: ['Rising', 'Falling', 'Frozen', 'Free'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'champion', 5, 'The Industrial Revolution began in which country?', { choices: ['Britain', 'USA', 'China', 'Egypt'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  EXPLORER fill — top up the thinner skills
// ════════════════════════════════════════════════════════════
const EXPLORER_FILL: PackItem[] = [
  m('WON', 'earth', 'mcq', 'explorer', 2, 'What causes a shadow?', { choices: ['Light being blocked', 'Wind', 'Sound', 'Water'], answer: 0 }),
  m('WON', 'earth', 'slider', 'explorer', 3, 'How many planets orbit our Sun?', { min: 0, max: 12, answer: 8, tol: 0, unit: '' }, { explanation: 'There are 8 planets.' }),
  m('LOG', 'ai', 'mcq', 'explorer', 2, 'A good prompt is...', { choices: ['Clear and detailed', 'One vague word', 'Empty', 'Random letters'], answer: 0 }),
  m('LOG', 'ai', 'match', 'explorer', 3, 'Match the tool to its job.', { pairs: [['Chatbot', 'Answers questions'], ['Image AI', 'Makes pictures'], ['Code AI', 'Writes code']] }),
  m('WRD', 'writing', 'mcq', 'explorer', 2, 'Which sentence has correct punctuation?', { choices: ['Wow, that\'s amazing!', 'wow thats amazing', 'Wow thats amazing.', 'wow, thats amazing'], answer: 0 }),
  m('WRD', 'writing', 'seq', 'explorer', 3, 'Order the parts of a story.', { items: ['Beginning', 'Problem', 'Solution', 'Ending'] }),
  m('LIF', 'movement', 'mcq', 'explorer', 2, 'Why is warming up before exercise good?', { choices: ['It prevents injury', 'It wastes time', 'It makes you tired', 'It does nothing'], answer: 0 }),
  m('LIF', 'movement', 'party', 'explorer', 2, 'Movement quest', { task: 'Do 15 jumping jacks', quest: true }),
  m('LIF', 'kindness', 'mcq', 'explorer', 2, 'Someone is being left out. The kind thing is to...', { choices: ['Invite them to join', 'Ignore it', 'Laugh', 'Walk away'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'explorer', 3, 'What happens to most things when heated?', { choices: ['They expand', 'They shrink', 'They vanish', 'They freeze'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'explorer', 2, 'Who explored the seas in big wooden ships long ago?', { choices: ['Explorers', 'Astronauts', 'Pilots', 'Gamers'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'explorer', 2, 'Which unit measures weight?', { choices: ['Grams', 'Litres', 'Metres', 'Seconds'], answer: 0 }),
]

export const CONTENT_PACK_2: PackItem[] = [...STARTER, ...BUILDER, ...CHAMPION, ...EXPLORER_FILL]
