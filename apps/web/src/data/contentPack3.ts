// ============================================================
//  ARGANTALAB · CONTENT PACK 3  — fills the two EMPTY stages:
//  TINY (1–6, picture/audio-first) & LEGEND (16–19, exam-level),
//  and finishes opening CHAMPION (14–16) across every world.
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
  return { id: `cp3_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, xp: 10, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  TINY (ages 1–6) — pre-reading. Pictures, sounds, counting,
//  colours, shapes, big/small. Difficulty 1. Lots of emoji so a
//  child who can't read yet can still answer from the visuals.
// ════════════════════════════════════════════════════════════
const TINY: PackItem[] = [
  // ── NumberDash · counting, shapes, size ──
  m('NUM', 'placevalue', 'mcq', 'tiny', 1, 'How many? 🍎🍎🍎', { choices: ['2', '3', '4', '5'], answer: 1 }, { hint: 'Touch each apple and count.' }),
  m('NUM', 'placevalue', 'mcq', 'tiny', 1, 'How many stars? ⭐⭐', { choices: ['1', '2', '3', '4'], answer: 1 }),
  m('NUM', 'placevalue', 'mcq', 'tiny', 1, 'How many ducks? 🦆🦆🦆🦆', { choices: ['2', '3', '4', '5'], answer: 2 }),
  m('NUM', 'placevalue', 'seq', 'tiny', 1, 'Count up! Put them in order.', { items: ['1', '2', '3'] }),
  m('NUM', 'placevalue', 'mcq', 'tiny', 1, 'Which group has MORE? ', { choices: ['🐸🐸🐸', '🐸', '—', '∅'], answer: 0 }),
  m('NUM', 'arith', 'mcq', 'tiny', 1, '🍓 and one more 🍓. How many?', { choices: ['1', '2', '3', '4'], answer: 1 }, { explanation: '1 and 1 more is 2.' }),
  m('NUM', 'arith', 'mcq', 'tiny', 1, 'You have 🎈🎈🎈. One pops! How many left?', { choices: ['1', '2', '3', '4'], answer: 1 }),
  m('NUM', 'geometry', 'match', 'tiny', 1, 'Match the shape to its picture.', { pairs: [['Circle', '🔵'], ['Square', '🟦'], ['Triangle', '🔺']] }),
  m('NUM', 'geometry', 'mcq', 'tiny', 1, 'Which one is round?', { choices: ['🔵', '🟥', '🔺', '⬛'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'tiny', 1, 'Which is BIG?', { choices: ['🐘', '🐭', '🐜', '🐞'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'tiny', 1, 'Which is small?', { choices: ['🐜', '🐘', '🦒', '🐳'], answer: 0 }),
  m('NUM', 'measure', 'sort', 'tiny', 1, 'Sort: big or little?', { buckets: ['Big', 'Little'], items: [{ text: '🐘', bucket: 0 }, { text: '🐭', bucket: 1 }, { text: '🦕', bucket: 0 }, { text: '🐞', bucket: 1 }] }),
  // ── WordQuest · sounds, first letters, colours ──
  m('WRD', 'phonics', 'listen', 'tiny', 1, 'What letter says "mmm"?', { say: 'mmm', choices: ['m', 'b', 's'], answer: 0 }),
  m('WRD', 'phonics', 'listen', 'tiny', 1, 'What letter says "aaa"?', { say: 'aaa', choices: ['a', 'o', 'e'], answer: 0 }),
  m('WRD', 'phonics', 'mcq', 'tiny', 1, 'What does 🐱 start with?', { choices: ['C', 'D', 'M', 'S'], answer: 0 }, { explanation: 'Cat starts with C.' }),
  m('WRD', 'phonics', 'mcq', 'tiny', 1, 'What does 🐶 start with?', { choices: ['D', 'B', 'P', 'T'], answer: 0 }, { explanation: 'Dog starts with D.' }),
  m('WRD', 'vocab', 'match', 'tiny', 1, 'Match the colour word.', { pairs: [['Red', '🔴'], ['Blue', '🔵'], ['Green', '🟢']] }),
  m('WRD', 'vocab', 'mcq', 'tiny', 1, 'What colour is the sun? ☀️', { choices: ['Yellow', 'Blue', 'Black', 'Pink'], answer: 0 }),
  m('WRD', 'vocab', 'match', 'tiny', 1, 'Match the animal sound.', { pairs: [['🐄', 'Moo'], ['🐱', 'Meow'], ['🐶', 'Woof']] }),
  m('WRD', 'grammar', 'mcq', 'tiny', 1, 'Which is a person?', { choices: ['👩 Mum', '🚗 Car', '🍎 Apple', '🌳 Tree'], answer: 0 }),
  // ── WonderLab · animals, day/night, senses ──
  m('WON', 'biology', 'match', 'tiny', 1, 'Match the baby animal.', { pairs: [['🐶 Dog', '🐕 Puppy'], ['🐱 Cat', '🐈 Kitten'], ['🐔 Hen', '🐤 Chick']] }),
  m('WON', 'biology', 'mcq', 'tiny', 1, 'Which animal can fly?', { choices: ['🐦', '🐟', '🐍', '🐢'], answer: 0 }),
  m('WON', 'biology', 'sort', 'tiny', 1, 'Sort: lives in water or on land?', { buckets: ['Water 💧', 'Land 🌱'], items: [{ text: '🐟', bucket: 0 }, { text: '🐶', bucket: 1 }, { text: '🐠', bucket: 0 }, { text: '🐰', bucket: 1 }] }),
  m('WON', 'earth', 'mcq', 'tiny', 1, 'When do we sleep?', { choices: ['🌙 Night', '☀️ Day', 'Never', 'Lunch'], answer: 0 }),
  m('WON', 'earth', 'match', 'tiny', 1, 'Match the weather.', { pairs: [['☀️', 'Sunny'], ['🌧️', 'Rainy'], ['❄️', 'Snowy']] }),
  m('WON', 'physics', 'mcq', 'tiny', 1, 'Which is HOT?', { choices: ['🔥', '❄️', '🧊', '⛄'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'tiny', 1, 'Ice is very...', { choices: ['Cold ❄️', 'Hot 🔥', 'Loud', 'Fast'], answer: 0 }),
  // ── LogicLand · patterns, sorting, same/different ──
  m('LOG', 'logic', 'mcq', 'tiny', 1, 'What comes next? 🔴🔵🔴🔵__', { choices: ['🔴', '🔵', '🟢', '🟡'], answer: 0 }),
  m('LOG', 'logic', 'mcq', 'tiny', 1, 'Which one is different?', { choices: ['🍎', '🍎', '🍌', '🍎'], answer: 2 }),
  m('LOG', 'logic', 'match', 'tiny', 1, 'Match the same ones.', { pairs: [['🌟', '🌟'], ['🌙', '🌙'], ['☁️', '☁️']] }),
  m('LOG', 'data', 'mcq', 'tiny', 1, 'Which has more? 🍪🍪🍪 or 🍪', { choices: ['🍪🍪🍪', '🍪', 'Same', 'None'], answer: 0 }),
  m('LOG', 'code', 'seq', 'tiny', 1, 'Help the robot get dressed!', { items: ['Socks 🧦', 'Shoes 👟'] }),
  // ── WorldTrail · places, family, helpers ──
  m('WLD', 'geography', 'sort', 'tiny', 1, 'Sort: in the sky or in the sea?', { buckets: ['Sky ☁️', 'Sea 🌊'], items: [{ text: '⭐', bucket: 0 }, { text: '🐠', bucket: 1 }, { text: '🌙', bucket: 0 }, { text: '🐙', bucket: 1 }] }),
  m('WLD', 'history', 'match', 'tiny', 1, 'Match the helper to the tool.', { pairs: [['👩‍⚕️ Doctor', '🩺'], ['👨‍🚒 Firefighter', '🧯'], ['👮 Police', '🚓']] }),
  m('WLD', 'economics', 'mcq', 'tiny', 1, 'You buy a toy with...', { choices: ['💰 Money', '🍎 Apple', '🧦 Sock', '🌧️ Rain'], answer: 0 }),
  // ── LifeQuest · feelings, body, helping ──
  m('LIF', 'kindness', 'mcq', 'tiny', 1, 'How does this face feel? 😊', { choices: ['Happy', 'Sad', 'Angry', 'Sleepy'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'tiny', 1, 'How does this face feel? 😢', { choices: ['Sad', 'Happy', 'Excited', 'Silly'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'tiny', 1, 'Your friend fell over. You...', { choices: ['Help them up 🤝', 'Laugh', 'Walk away', 'Hide'], answer: 0 }),
  m('LIF', 'habits', 'party', 'tiny', 1, 'Tiny quest!', { task: 'Brush your teeth 🪥', quest: true }),
  m('LIF', 'movement', 'party', 'tiny', 1, 'Move it!', { task: 'Jump up high 3 times 🦘', quest: true }),
  m('LIF', 'party', 'mcq', 'tiny', 1, 'Which one do we eat?', { choices: ['🍌', '🧦', '✏️', '🔑'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  LEGEND (ages 16–19) — exam / pre-university. Difficulty 6.
//  Rigorous, abstract, real terminology. Verified answers.
// ════════════════════════════════════════════════════════════
const LEGEND: PackItem[] = [
  // ── NumberDash · algebra, calculus, stats ──
  m('NUM', 'arith', 'type', 'legend', 6, 'Solve for x: 3x − 7 = 2x + 5', { answer: '12', numeric: true }, { explanation: 'x = 12: subtract 2x → x − 7 = 5 → x = 12.' }),
  m('NUM', 'arith', 'mcq', 'legend', 6, 'What is the derivative of x³?', { choices: ['3x²', 'x²', '3x', 'x⁴/4'], answer: 0 }, { explanation: 'Power rule: d/dx xⁿ = n·xⁿ⁻¹.' }),
  m('NUM', 'arith', 'mcq', 'legend', 6, '∫ 2x dx = ?', { choices: ['x² + C', '2 + C', 'x² ', '2x² + C'], answer: 0 }, { explanation: 'Integral of 2x is x² + C.' }),
  m('NUM', 'arith', 'type', 'legend', 6, 'Evaluate log₂(32).', { answer: '5', numeric: true }, { explanation: '2⁵ = 32, so log₂(32) = 5.' }),
  m('NUM', 'fractions', 'mcq', 'legend', 6, 'Solve x² − 5x + 6 = 0.', { choices: ['x = 2 or 3', 'x = 1 or 6', 'x = −2 or −3', 'x = 0 or 5'], answer: 0 }, { explanation: 'Factors: (x−2)(x−3) = 0.' }),
  m('NUM', 'geometry', 'mcq', 'legend', 6, 'In a right triangle, sin θ = ?', { choices: ['opposite / hypotenuse', 'adjacent / hypotenuse', 'opposite / adjacent', 'hypotenuse / opposite'], answer: 0 }),
  m('NUM', 'measure', 'mcq', 'legend', 6, 'Standard deviation measures...', { choices: ['Spread of data', 'The average', 'The middle value', 'The most common value'], answer: 0 }, { explanation: 'It quantifies dispersion around the mean.' }),
  m('NUM', 'placevalue', 'mcq', 'legend', 6, 'Which is irrational?', { choices: ['√2', '0.75', '3/7', '−4'], answer: 0 }, { explanation: '√2 cannot be written as a fraction.' }),
  // ── WordQuest · rhetoric, literary analysis, advanced grammar ──
  m('WRD', 'writing', 'mcq', 'legend', 6, 'A strong thesis statement should be...', { choices: ['Arguable and specific', 'A neutral fact', 'A question', 'A list of topics'], answer: 0 }),
  m('WRD', 'writing', 'seq', 'legend', 6, 'Order the parts of a formal essay.', { items: ['Introduction', 'Body paragraphs', 'Counter-argument', 'Conclusion'] }),
  m('WRD', 'grammar', 'fix', 'legend', 6, 'Fix the dangling modifier: tap the misplaced phrase.', { tokens: ['Running', 'late', ',', 'the', 'bus', 'was', 'missed'], wrong: 0, fix: 'Running late, I missed the bus' }, { explanation: 'The subject doing the running must follow the modifier.' }),
  m('WRD', 'vocab', 'mcq', 'legend', 6, '"Ephemeral" most nearly means...', { choices: ['Short-lived', 'Enormous', 'Hidden', 'Ancient'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'legend', 6, 'Which is an example of a metaphor?', { choices: ['Time is a thief', 'Brave as a lion', 'The wind whispered', 'Boom!'], answer: 0 }, { explanation: 'Metaphor states one thing IS another; "as" would make it a simile.' }),
  m('WRD', 'grammar', 'mcq', 'legend', 6, 'Identify the subjunctive: "If I ___ you..."', { choices: ['were', 'was', 'am', 'be'], answer: 0 }, { explanation: 'Subjunctive uses "were" for hypotheticals.' }),
  // ── WonderLab · organic chem, genetics, mechanics ──
  m('WON', 'chemistry', 'mcq', 'legend', 6, 'The functional group −OH defines an...', { choices: ['Alcohol', 'Ketone', 'Acid', 'Alkane'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'legend', 6, 'Avogadro\'s number is approximately...', { choices: ['6.02 × 10²³', '3.14 × 10⁸', '9.81', '1.6 × 10⁻¹⁹'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'legend', 6, 'In DNA, adenine always pairs with...', { choices: ['Thymine', 'Guanine', 'Cytosine', 'Uracil'], answer: 0 }, { explanation: 'A–T and C–G are the complementary base pairs.' }),
  m('WON', 'biology', 'mcq', 'legend', 6, 'A monohybrid cross of Aa × Aa gives a phenotype ratio of...', { choices: ['3:1', '1:1', '9:3:3:1', '1:2:1'], answer: 0 }),
  m('WON', 'physics', 'type', 'legend', 6, 'A 2 kg mass accelerates at 5 m/s². Force in newtons?', { answer: '10', numeric: true }, { explanation: 'F = ma = 2 × 5 = 10 N.' }),
  m('WON', 'physics', 'mcq', 'legend', 6, 'Kinetic energy is given by...', { choices: ['½mv²', 'mgh', 'mv', 'ma'], answer: 0 }),
  m('WON', 'earth', 'mcq', 'legend', 6, 'The greenhouse effect is intensified mainly by...', { choices: ['CO₂ and methane', 'Oxygen', 'Nitrogen', 'Argon'], answer: 0 }),
  // ── LogicLand · algorithms, complexity, AI, formal logic ──
  m('LOG', 'code', 'mcq', 'legend', 6, 'Big-O of binary search on a sorted array?', { choices: ['O(log n)', 'O(n)', 'O(n²)', 'O(1)'], answer: 0 }, { explanation: 'Each step halves the search space.' }),
  m('LOG', 'code', 'mcq', 'legend', 6, 'What does this return? `[x*x for x in range(3)]`', { choices: ['[0, 1, 4]', '[1, 4, 9]', '[0, 1, 2]', '[1, 2, 3]'], answer: 0 }, { explanation: '0², 1², 2² = 0, 1, 4.' }),
  m('LOG', 'data', 'mcq', 'legend', 6, 'In a normal distribution, ~68% of data lies within...', { choices: ['1 standard deviation', '2 SD', '3 SD', 'the median'], answer: 0 }),
  m('LOG', 'ai', 'mcq', 'legend', 6, 'Overfitting means a model...', { choices: ['Memorises training data, fails on new data', 'Is too simple', 'Trains too fast', 'Has no parameters'], answer: 0 }),
  m('LOG', 'ai', 'mcq', 'legend', 6, 'Gradient descent is used to...', { choices: ['Minimise a loss function', 'Sort a list', 'Encrypt data', 'Render graphics'], answer: 0 }),
  m('LOG', 'logic', 'mcq', 'legend', 6, 'Which is logically equivalent to "If P then Q"?', { choices: ['If not Q then not P', 'If Q then P', 'P and Q', 'If not P then not Q'], answer: 0 }, { explanation: 'The contrapositive is equivalent.' }),
  // ── WorldTrail · macroeconomics, geopolitics, modern history ──
  m('WLD', 'economics', 'mcq', 'legend', 6, 'When central banks raise interest rates, they aim to...', { choices: ['Reduce inflation', 'Increase spending', 'Weaken the currency', 'Raise unemployment on purpose'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'legend', 6, 'GDP measures...', { choices: ['Total value of goods & services produced', 'Government debt', 'Stock prices', 'The number of workers'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'legend', 6, 'A progressive tax means...', { choices: ['Higher earners pay a higher rate', 'Everyone pays the same rate', 'Only companies pay', 'Tax falls over time'], answer: 0 }),
  m('WLD', 'history', 'seq', 'legend', 6, 'Order these 20th-century events.', { items: ['World War I', 'Great Depression', 'World War II', 'Fall of the Berlin Wall'] }),
  m('WLD', 'geography', 'mcq', 'legend', 6, 'Plate tectonics best explains...', { choices: ['Earthquakes and mountain formation', 'The phases of the Moon', 'Ocean tides', 'Seasons'], answer: 0 }),
  // ── LifeQuest · ethics, finance, wellbeing, leadership ──
  m('LIF', 'habits', 'mcq', 'legend', 6, 'Compound interest works best when you...', { choices: ['Start saving early', 'Wait until you\'re older', 'Spend first', 'Avoid all banks'], answer: 0 }, { explanation: 'Time is the biggest multiplier in compounding.' }),
  m('LIF', 'habits', 'mcq', 'legend', 6, 'A "growth mindset" means believing...', { choices: ['Ability improves with effort', 'Talent is fixed at birth', 'Mistakes mean failure', 'Only winning matters'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'legend', 6, 'Active listening means...', { choices: ['Fully focusing and reflecting back', 'Planning your reply while they talk', 'Staying silent only', 'Agreeing with everything'], answer: 0 }),
  m('LIF', 'movement', 'mcq', 'legend', 6, 'For lasting fitness, the best plan is...', { choices: ['Consistent, sustainable habits', 'One extreme workout', 'Only training when motivated', 'Skipping rest days'], answer: 0 }),
  m('LIF', 'party', 'mcq', 'legend', 6, 'Good leadership in a team is mostly about...', { choices: ['Listening and empowering others', 'Taking all the credit', 'Working alone', 'Avoiding decisions'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  CHAMPION FILL (ages 14–16) — difficulty 5. Brings every
//  world up to a usable depth, including LifeQuest (was 0).
// ════════════════════════════════════════════════════════════
const CHAMPION: PackItem[] = [
  // NUM — was 4, thin skills
  m('NUM', 'times', 'type', 'champion', 5, 'What is 12² ?', { answer: '144', numeric: true }, { explanation: '12 × 12 = 144.' }),
  m('NUM', 'money', 'mcq', 'champion', 5, 'A £40 jacket has 25% off. New price?', { choices: ['£30', '£35', '£32', '£28'], answer: 0 }, { explanation: '25% of 40 = 10, so 40 − 10 = £30.' }),
  m('NUM', 'measure', 'type', 'champion', 5, 'A car travels 150 km in 2 hours. Speed in km/h?', { answer: '75', numeric: true }, { explanation: 'Speed = distance ÷ time = 150 ÷ 2.' }),
  m('NUM', 'time', 'mcq', 'champion', 5, 'A train leaves 14:50 and arrives 16:25. Journey length?', { choices: ['1h 35m', '1h 25m', '2h 35m', '1h 45m'], answer: 0 }),
  // WRD — was 2
  m('WRD', 'phonics', 'mcq', 'champion', 5, 'The "ph" in "photograph" sounds like...', { choices: ['f', 'p', 'v', 'b'], answer: 0 }),
  m('WRD', 'writing', 'mcq', 'champion', 5, 'Which sentence uses a semicolon correctly?', { choices: ['It rained; we stayed inside.', 'It rained; and we stayed inside.', 'It rained, we; stayed inside.', 'It; rained we stayed inside.'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'champion', 5, '"Reluctant" means...', { choices: ['Unwilling', 'Eager', 'Tired', 'Confused'], answer: 0 }),
  // WON — was 3
  m('WON', 'earth', 'mcq', 'champion', 5, 'The water cycle stage where vapour becomes clouds is...', { choices: ['Condensation', 'Evaporation', 'Precipitation', 'Collection'], answer: 0 }),
  m('WON', 'chemistry', 'mcq', 'champion', 5, 'On the pH scale, a value of 2 is...', { choices: ['Strongly acidic', 'Neutral', 'Strongly alkaline', 'Pure water'], answer: 0 }),
  // LOG — was 3
  m('LOG', 'logic', 'mcq', 'champion', 5, 'All cats are mammals. Whiskers is a cat. Therefore...', { choices: ['Whiskers is a mammal', 'All mammals are cats', 'Whiskers is a dog', 'Nothing follows'], answer: 0 }),
  m('LOG', 'data', 'mcq', 'champion', 5, 'The median of 3, 7, 9, 4, 5 is...', { choices: ['5', '7', '4', '9'], answer: 0 }, { explanation: 'Ordered: 3,4,5,7,9 → middle is 5.' }),
  // WLD — was 3
  m('WLD', 'geography', 'mcq', 'champion', 5, 'The largest ocean on Earth is the...', { choices: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'champion', 5, 'The Industrial Revolution began in which country?', { choices: ['Britain', 'France', 'USA', 'Japan'], answer: 0 }),
  // LIF — was 0! seed every skill
  m('LIF', 'habits', 'mcq', 'champion', 5, 'The best way to build a new habit is to...', { choices: ['Start small and be consistent', 'Do everything at once', 'Wait for motivation', 'Tell no one'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'champion', 5, 'Empathy means...', { choices: ['Understanding how others feel', 'Always agreeing', 'Feeling sorry for someone', 'Ignoring feelings'], answer: 0 }),
  m('LIF', 'movement', 'party', 'champion', 5, 'Fitness quest', { task: 'Hold a 30-second plank', quest: true }),
  m('LIF', 'party', 'mcq', 'champion', 5, 'In a group project, a fair way to decide is to...', { choices: ['Listen to everyone, then vote', 'Loudest person decides', 'Nobody decides', 'Flip without discussing'], answer: 0 }),
]

export const CONTENT_PACK_3: PackItem[] = [...TINY, ...LEGEND, ...CHAMPION]
