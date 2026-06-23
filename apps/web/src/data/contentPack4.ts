// ============================================================
//  ARGANTALAB · CONTENT PACK 4  — DEPTH + READING COMPREHENSION
//  Goal (from the pedagogy re-concept): lift the share of higher-order
//  Bloom items (analyse / create), deepen thin world×skill cells, and
//  introduce the new READING strand (WRD/reading) with real passages.
//  Mostly Explorer (8–11) + Builder (11–14) — the daily-drill core ages.
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
  return { id: `cp4_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, xp: 12, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  READING COMPREHENSION  (WRD/reading) — the new strand.
//  Detail · main idea · inference · sequence · vocab-in-context.
//  Passages live in the prompt; questions test understanding, not recall.
// ════════════════════════════════════════════════════════════
const READING: PackItem[] = [
  // — Explorer (8–11) —
  m('WRD', 'reading', 'mcq', 'explorer', 2,
    'Read: "Maya planted a seed and watered it every day. After two weeks, a tiny green shoot pushed through the soil." Why did the shoot appear?',
    { choices: ['Maya watered it every day', 'It was winter', 'She forgot about it', 'The pot cracked'], answer: 0 },
    { explanation: 'Daily watering gave the seed what it needed to grow.' }),
  m('WRD', 'reading', 'mcq', 'explorer', 2,
    'Read: "The market was loud. Vendors shouted prices, carts rattled, and somewhere a radio played." What is the main idea?',
    { choices: ['The market was a busy, noisy place', 'The radio was broken', 'Nobody was at the market', 'It was night time'], answer: 0 },
    { hint: 'Which choice covers the WHOLE passage, not one detail?' }),
  m('WRD', 'reading', 'mcq', 'explorer', 3,
    'Read: "Sam grabbed his umbrella before leaving, even though the sun was out." What can you INFER?',
    { choices: ['Sam expected rain later', 'Sam loves sunshine', 'Sam was going swimming', 'Sam lost his umbrella'], answer: 0 },
    { explanation: 'Taking an umbrella under a clear sky hints he expects the weather to change.' }),
  m('WRD', 'reading', 'cloze', 'explorer', 2,
    'Read: "The turtle was slow but it never stopped. In the end it won the race." Finish: The turtle won because it was ___.',
    { before: 'The turtle won because it was ', after: '.', options: ['persistent', 'fast', 'lucky', 'asleep'], answer: 'persistent' },
    { explanation: 'Persistent = keeps going without giving up.' }),
  m('WRD', 'reading', 'seq', 'explorer', 2,
    'Read the story, then put the events in order: "Leo woke up. He ate breakfast. He walked to school. He met his friends."',
    { items: ['Leo woke up', 'He ate breakfast', 'He walked to school', 'He met his friends'] }),
  m('WRD', 'reading', 'mcq', 'explorer', 3,
    'Read: "Despite the cold, the children laughed as they built a snowman." The word "despite" tells us the cold was…',
    { choices: ['something they enjoyed anyway', 'the reason they cried', 'making them warm', 'not real'], answer: 0 }),
  m('WRD', 'reading', 'multi', 'explorer', 3,
    'Read: "Owls hunt at night. They have huge eyes and silent wings." Pick TWO facts the passage states.',
    { choices: ['Owls hunt at night', 'Owls have small eyes', 'Owls have silent wings', 'Owls sleep at night'], answers: [0, 2] }),
  m('WRD', 'reading', 'mcq', 'explorer', 2,
    'Read: "Priya shared her lunch with a new student who had forgotten his." What does this show about Priya?',
    { choices: ['She is kind', 'She is hungry', 'She is angry', 'She is tired'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'explorer', 3,
    'Read: "The old bridge groaned in the wind, its ropes fraying." Here, "groaned" makes the bridge seem…',
    { choices: ['old and unsafe', 'brand new', 'happy', 'silent'], answer: 0 },
    { explanation: 'Word choice ("groaned", "fraying") builds a feeling of danger.' }),
  m('WRD', 'reading', 'mcq', 'explorer', 2,
    'Read: "First mix the flour and eggs. Next, pour the batter. Finally, bake for 20 minutes." What do you do RIGHT AFTER mixing?',
    { choices: ['Pour the batter', 'Bake it', 'Eat it', 'Add eggs'], answer: 0 }),
  m('WRD', 'reading', 'cloze', 'explorer', 3,
    'Read: "The desert stretched for miles with no water in sight." Choose the best word: The desert was ___.',
    { before: 'The desert was ', after: '.', options: ['barren', 'crowded', 'wet', 'leafy'], answer: 'barren' },
    { explanation: 'Barren = empty and lifeless.' }),
  m('WRD', 'reading', 'mcq', 'explorer', 2,
    'Read: "Tom practised piano every evening. By spring, he played for the whole school." What is the lesson?',
    { choices: ['Practice leads to progress', 'Pianos are heavy', 'Spring is cold', 'School is boring'], answer: 0 }),
  // — Builder (11–14): longer, more inference —
  m('WRD', 'reading', 'mcq', 'builder', 3,
    'Read: "The scientists worked through the night. By dawn, exhausted but smiling, they announced the vaccine had passed its trial." Why were they smiling?',
    { choices: ['Their hard work succeeded', 'They wanted to sleep', 'It was sunrise', 'They lost the data'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'builder', 4,
    'Read: "He claimed the lake was safe, yet he refused to swim in it himself." The author wants you to feel the man is…',
    { choices: ['not trustworthy', 'a strong swimmer', 'very honest', 'afraid of fish'], answer: 0 },
    { explanation: 'His actions contradict his words — a clue to character.' }),
  m('WRD', 'reading', 'multi', 'builder', 4,
    'Read: "Recycling saves energy, cuts landfill waste, and protects wildlife habitats." Select ALL benefits stated.',
    { choices: ['Saves energy', 'Makes money instantly', 'Cuts landfill waste', 'Protects habitats'], answers: [0, 2, 3] }),
  m('WRD', 'reading', 'mcq', 'builder', 4,
    'Read: "The author writes: \'We must act now, before the last forests fall.\'" What is the author\'s PURPOSE?',
    { choices: ['To persuade readers to protect forests', 'To describe a tree', 'To tell a funny joke', 'To sell furniture'], answer: 0 }),
  m('WRD', 'reading', 'seq', 'builder', 3,
    'Order the plot: "A storm hit. The ship lost power. The crew sent a distress call. A rescue boat arrived."',
    { items: ['A storm hit', 'The ship lost power', 'The crew sent a distress call', 'A rescue boat arrived'] }),
  m('WRD', 'reading', 'cloze', 'builder', 4,
    'Read: "Her argument had no evidence, so the judges found it ___." Pick the precise word.',
    { before: 'The judges found it ', after: '.', options: ['unconvincing', 'delicious', 'colourful', 'loud'], answer: 'unconvincing' }),
  // — Starter (6–8): picture-supported early reading —
  m('WRD', 'reading', 'mcq', 'starter', 1,
    'Read: "The cat sat on the mat. It was soft and warm." Where did the cat sit?',
    { choices: ['On the mat', 'On a tree', 'In a box', 'On a car'], answer: 0 }),
  m('WRD', 'reading', 'mcq', 'starter', 2,
    'Read: "Ben lost his red ball. He looked under the bed and found it!" How did Ben feel at the end?',
    { choices: ['Happy 😊', 'Scared', 'Sleepy', 'Hungry'], answer: 0 }),
  m('WRD', 'reading', 'seq', 'starter', 2,
    'Put the day in order: "Wake up ☀️. Eat lunch 🥪. Go to bed 🌙."',
    { items: ['Wake up ☀️', 'Eat lunch 🥪', 'Go to bed 🌙'] }),
]

// ════════════════════════════════════════════════════════════
//  NUMBERDASH — multi-step word problems + reasoning (apply→analyse)
// ════════════════════════════════════════════════════════════
const NUM_DEEP: PackItem[] = [
  m('NUM', 'arith', 'type', 'explorer', 3, 'A bus holds 42 seats. 17 people get on, then 9 more. How many seats are still empty?',
    { answer: '16', numeric: true, accept: ['16'] }, { explanation: '17+9=26 taken. 42−26=16 empty.' }),
  m('NUM', 'arith', 'fix', 'explorer', 3, 'Spot the wrong step: 25 + 18 = 33 → 33 − 5 = 28.',
    { tokens: ['25 + 18 = 33', '→', '33 − 5 = 28'], wrong: 0, fix: '25 + 18 = 43' },
    { explanation: '25+18 is 43, not 33.' }),
  m('NUM', 'times', 'type', 'explorer', 3, 'Each box has 6 cupcakes. You buy 7 boxes and eat 4 cupcakes. How many are left?',
    { answer: '38', numeric: true, accept: ['38'] }, { explanation: '6×7=42, minus 4 = 38.' }),
  m('NUM', 'fractions', 'mcq', 'explorer', 3, 'A pizza is cut into 8 slices. You eat 3. What fraction is LEFT?',
    { choices: ['5/8', '3/8', '5/3', '8/5'], answer: 0 }, { explanation: '8−3=5 slices left out of 8.' }),
  m('NUM', 'fractions', 'numline', 'explorer', 3, 'Place 3/4 on the number line.',
    { min: 0, max: 1, answer: 0.75, tol: 0.06, label: '3/4' }),
  m('NUM', 'money', 'type', 'explorer', 3, 'A toy costs $7.50. You pay with a $10 note. How much change (in dollars)?',
    { answer: '2.5', numeric: true, accept: ['2.5', '2.50'] }, { explanation: '10 − 7.50 = 2.50.' }),
  m('NUM', 'money', 'mcq', 'explorer', 2, 'Apples are 3 for $2. How much for 9 apples?',
    { choices: ['$6', '$5', '$9', '$18'], answer: 0 }, { explanation: '9 ÷ 3 = 3 groups, 3 × $2 = $6.' }),
  m('NUM', 'measure', 'type', 'explorer', 3, 'A ribbon is 120 cm. You cut off 45 cm. How many cm remain?',
    { answer: '75', numeric: true, accept: ['75'] }),
  m('NUM', 'time', 'mcq', 'explorer', 3, 'A film starts at 4:15 and lasts 90 minutes. When does it end?',
    { choices: ['5:45', '5:15', '6:15', '4:45'], answer: 0 }, { explanation: '90 min = 1h30. 4:15 + 1:30 = 5:45.' }),
  m('NUM', 'geometry', 'mcq', 'explorer', 3, 'A rectangle is 5 cm by 3 cm. What is its PERIMETER?',
    { choices: ['16 cm', '15 cm', '8 cm', '11 cm'], answer: 0 }, { explanation: '2×(5+3)=16.' }),
  m('NUM', 'geometry', 'sort', 'explorer', 3, 'Sort the shapes by number of sides.',
    { buckets: ['3 sides', '4 sides'], items: [{ text: 'Triangle', bucket: 0 }, { text: 'Square', bucket: 1 }, { text: 'Rectangle', bucket: 1 }, { text: 'Pyramid face △', bucket: 0 }] }),
  m('NUM', 'placevalue', 'mcq', 'explorer', 2, 'In 4,572, what is the value of the digit 5?',
    { choices: ['500', '50', '5', '5,000'], answer: 0 }, { explanation: '5 is in the hundreds place.' }),
  // Builder — ratios, percentages, algebra-readiness
  m('NUM', 'fractions', 'type', 'builder', 4, 'What is 25% of 80?',
    { answer: '20', numeric: true, accept: ['20'] }, { explanation: '25% = 1/4, and 80 ÷ 4 = 20.' }),
  m('NUM', 'arith', 'type', 'builder', 4, 'Solve for x: x + 14 = 30.',
    { answer: '16', numeric: true, accept: ['16'] }),
  m('NUM', 'times', 'mcq', 'builder', 4, 'A recipe for 4 needs 6 eggs. How many eggs for 10 people?',
    { choices: ['15', '12', '16', '10'], answer: 0 }, { explanation: '6 ÷ 4 = 1.5 eggs each, ×10 = 15.' }),
  m('NUM', 'money', 'mcq', 'builder', 4, 'A $40 jacket is 30% off. What is the sale price?',
    { choices: ['$28', '$30', '$12', '$37'], answer: 0 }, { explanation: '30% of 40 = 12, so 40 − 12 = 28.' }),
]

// ════════════════════════════════════════════════════════════
//  WONDERLAB — predict/test/explain + classify + analyse (analyse-heavy)
// ════════════════════════════════════════════════════════════
const WON_DEEP: PackItem[] = [
  m('WON', 'physics', 'pte', 'explorer', 3, 'A feather and a coin are dropped together in a normal room. Predict, then explain.',
    { predict: { prompt: 'Which lands first?', choices: ['The coin', 'The feather', 'Exactly together'], answer: 0 },
      sim: 'The coin drops fast and straight; the feather drifts slowly on the air.',
      explain: { prompt: 'Why?', choices: ['Air resistance slows the feather', 'The coin is magic', 'Feathers hate the floor'], answer: 0 } }),
  m('WON', 'chemistry', 'pte', 'explorer', 3, 'You add sugar to warm water and stir. Predict, then explain.',
    { predict: { prompt: 'What happens to the sugar?', choices: ['It dissolves', 'It floats forever', 'It turns red'], answer: 0 },
      sim: 'The sugar grains disappear into the water, making it sweet.',
      explain: { prompt: 'Where did the sugar go?', choices: ['Spread between water particles', 'It vanished completely', 'It became water'], answer: 0 } }),
  m('WON', 'biology', 'sort', 'explorer', 3, 'Sort each living thing: producer (makes food) or consumer (eats food)?',
    { buckets: ['Producer', 'Consumer'], items: [{ text: 'Oak tree', bucket: 0 }, { text: 'Rabbit', bucket: 1 }, { text: 'Grass', bucket: 0 }, { text: 'Fox', bucket: 1 }] }),
  m('WON', 'biology', 'label', 'explorer', 3, 'Match each body part to its job.',
    { pairs: [['Heart', 'Pumps blood'], ['Lungs', 'Take in air'], ['Stomach', 'Digests food'], ['Brain', 'Sends signals']] }),
  m('WON', 'earth', 'seq', 'explorer', 3, 'Put the water cycle in order.',
    { items: ['Sun heats water', 'Water evaporates', 'Clouds form', 'Rain falls'] }),
  m('WON', 'biology', 'multi', 'explorer', 3, 'Which are needed for a plant to grow? Select ALL.',
    { choices: ['Sunlight', 'Water', 'Television', 'Air'], answers: [0, 1, 3] }),
  m('WON', 'physics', 'mcq', 'explorer', 3, 'Why does a metal spoon feel colder than a wooden one in the same room?',
    { choices: ['Metal conducts heat away from your hand faster', 'Metal is actually colder', 'Wood is warm inside', 'Spoons hate metal'], answer: 0 }),
  m('WON', 'earth', 'sort', 'explorer', 2, 'Sort: renewable or non-renewable energy?',
    { buckets: ['Renewable', 'Non-renewable'], items: [{ text: 'Solar', bucket: 0 }, { text: 'Coal', bucket: 1 }, { text: 'Wind', bucket: 0 }, { text: 'Oil', bucket: 1 }] }),
  // Builder
  m('WON', 'chemistry', 'pte', 'builder', 4, 'You mix baking soda with vinegar. Predict, then explain.',
    { predict: { prompt: 'What will you see?', choices: ['Fizzing bubbles', 'Nothing', 'It freezes'], answer: 0 },
      sim: 'The mixture fizzes and foams, releasing gas.',
      explain: { prompt: 'What gas is made?', choices: ['Carbon dioxide', 'Oxygen only', 'Helium'], answer: 0 } }),
  m('WON', 'physics', 'mcq', 'builder', 4, 'A toy car rolls further on tile than on carpet. The best explanation is…',
    { choices: ['Carpet has more friction', 'Tile is downhill', 'The car prefers tile', 'Carpet is magnetic'], answer: 0 }),
  m('WON', 'biology', 'mcq', 'builder', 4, 'In a food chain grass → rabbit → fox, what happens to foxes if all the grass dies?',
    { choices: ['Foxes decline as rabbits starve', 'Foxes increase', 'Nothing changes', 'Grass grows back instantly'], answer: 0 },
    { explanation: 'Remove the producer and the whole chain collapses.' }),
]

// ════════════════════════════════════════════════════════════
//  LOGICLAND — debugging, algorithms, true/false logic (create + analyse)
// ════════════════════════════════════════════════════════════
const LOG_DEEP: PackItem[] = [
  m('LOG', 'code', 'code', 'explorer', 3, 'Build the algorithm to make a sandwich (drag tiles in order).',
    { tiles: ['Get bread', 'Add filling', 'Close sandwich', 'Eat'], answer: ['Get bread', 'Add filling', 'Close sandwich', 'Eat'] }),
  m('LOG', 'code', 'seq', 'explorer', 3, 'Order the steps for a robot to cross a road safely.',
    { items: ['Stop at the curb', 'Look both ways', 'Wait for green', 'Walk across'] }),
  m('LOG', 'code', 'fix', 'explorer', 3, 'Debug the loop: REPEAT 3 [ FORWARD, FORWARD, LEFT ] — but the robot should turn RIGHT.',
    { tokens: ['REPEAT 3', '[ FORWARD', 'FORWARD', 'LEFT ]'], wrong: 3, fix: 'RIGHT ]' }),
  m('LOG', 'logic', 'mcq', 'explorer', 3, 'IF it is raining THEN take an umbrella. It is NOT raining. What should you do?',
    { choices: ['Nothing required', 'Always take umbrella', 'Stay home forever', 'Take two umbrellas'], answer: 0 }),
  m('LOG', 'logic', 'sort', 'explorer', 3, 'Sort each statement: TRUE or FALSE?',
    { buckets: ['True', 'False'], items: [{ text: 'All squares have 4 sides', bucket: 0 }, { text: 'All birds can fly', bucket: 1 }, { text: '2 + 2 = 4', bucket: 0 }, { text: 'The sun rises in the west', bucket: 1 }] }),
  m('LOG', 'data', 'mcq', 'explorer', 3, 'A tally shows: 🍎5 🍌3 🍇7. Which fruit is most popular?',
    { choices: ['Grapes', 'Apples', 'Bananas', 'Tie'], answer: 0 }),
  m('LOG', 'data', 'multi', 'explorer', 3, 'Which of these are good ways to show data? Select ALL.',
    { choices: ['Bar chart', 'Pie chart', 'A random scribble', 'Table'], answers: [0, 1, 3] }),
  m('LOG', 'ai', 'mcq', 'explorer', 3, 'An AI learns to spot cats from 1,000 cat photos. If you show it only black cats, it might…',
    { choices: ['Struggle with orange cats', 'Become a dog', 'Learn nothing', 'Refuse to work'], answer: 0 },
    { explanation: 'Biased data → biased results. Variety matters.' }),
  m('LOG', 'logic', 'seq', 'explorer', 2, 'What comes next? Order the pattern blocks: 1, 2, 4, 8.',
    { items: ['1', '2', '4', '8'] }),
  // Builder
  m('LOG', 'code', 'code', 'builder', 4, 'Write the loop to draw a square (drag commands).',
    { tiles: ['REPEAT 4', 'FORWARD 100', 'RIGHT 90', 'END'], answer: ['REPEAT 4', 'FORWARD 100', 'RIGHT 90', 'END'] }),
  m('LOG', 'logic', 'mcq', 'builder', 4, 'IF (age ≥ 13) AND (has ticket) THEN enter. Sam is 12 with a ticket. Can Sam enter?',
    { choices: ['No — fails the age test', 'Yes', 'Only on weekends', 'Need a third rule'], answer: 0 }),
  m('LOG', 'ai', 'mcq', 'builder', 4, 'Which is the BEST prompt for an AI to get a useful answer?',
    { choices: ['"List 3 healthy lunches for a 10-year-old, with reasons"', '"food"', '"tell me stuff"', '"???"'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WORLDTRAIL — cause/effect, timelines, map reasoning (analyse)
// ════════════════════════════════════════════════════════════
const WLD_DEEP: PackItem[] = [
  m('WLD', 'geography', 'sort', 'explorer', 3, 'Sort each into its continent.',
    { buckets: ['Africa', 'Asia'], items: [{ text: 'Egypt', bucket: 0 }, { text: 'Japan', bucket: 1 }, { text: 'Kenya', bucket: 0 }, { text: 'India', bucket: 1 }] }),
  m('WLD', 'geography', 'map', 'explorer', 3, 'A compass: you face NORTH and turn right 90°. Which way now?',
    { choices: ['East', 'West', 'South', 'North'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'explorer', 3, 'Cities often grow beside rivers. The BEST reason is…',
    { choices: ['Water for drinking, farming and transport', 'Rivers are pretty', 'To avoid fish', 'Rivers are warm'], answer: 0 }),
  m('WLD', 'history', 'seq', 'explorer', 3, 'Put these inventions in time order.',
    { items: ['The wheel', 'The printing press', 'The car', 'The smartphone'] }),
  m('WLD', 'history', 'mcq', 'explorer', 3, 'Why do historians use more than one source for a story?',
    { choices: ['To check the facts agree', 'To make it longer', 'One is illegal', 'Sources are free'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'explorer', 3, 'A toy is "sold out" everywhere. What usually happens to its price?',
    { choices: ['It rises (high demand, low supply)', 'It falls', 'It stays exactly the same', 'It becomes free'], answer: 0 }),
  m('WLD', 'economics', 'sort', 'explorer', 2, 'Sort: a NEED or a WANT?',
    { buckets: ['Need', 'Want'], items: [{ text: 'Clean water', bucket: 0 }, { text: 'A video game', bucket: 1 }, { text: 'Food', bucket: 0 }, { text: 'A gold watch', bucket: 1 }] }),
  m('WLD', 'geography', 'label', 'explorer', 3, 'Match each landform to its description.',
    { pairs: [['Mountain', 'Very high land'], ['Island', 'Land surrounded by water'], ['Desert', 'Very dry land'], ['River', 'Flowing water']] }),
  // Builder
  m('WLD', 'history', 'mcq', 'builder', 4, 'A primary source is…',
    { choices: ['A diary written at the time', 'A modern textbook', 'A movie made today', 'A guess'], answer: 0 }),
  m('WLD', 'economics', 'mcq', 'builder', 4, 'A country exports coffee and imports cars. "Imports" are goods that are…',
    { choices: ['Bought from other countries', 'Sold abroad', 'Grown at home', 'Given away'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'builder', 4, 'Deforestation near a river can cause…',
    { choices: ['More flooding and soil loss', 'Cleaner air only', 'Nothing at all', 'More fish instantly'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  LIFEQUEST — emotional reasoning + real-world quests (SEL, create)
// ════════════════════════════════════════════════════════════
const LIF_DEEP: PackItem[] = [
  m('LIF', 'kindness', 'mcq', 'explorer', 2, 'Your friend is left out of a game. The kindest action is to…',
    { choices: ['Invite them to join', 'Ignore it', 'Laugh', 'Tell them to leave'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'explorer', 3, 'You feel angry. A healthy first step is to…',
    { choices: ['Take three deep breaths', 'Shout at someone', 'Break something', 'Bottle it up forever'], answer: 0 }),
  m('LIF', 'habits', 'sort', 'explorer', 2, 'Sort: healthy habit or unhealthy?',
    { buckets: ['Healthy', 'Unhealthy'], items: [{ text: 'Sleep 9 hours', bucket: 0 }, { text: 'Skip breakfast daily', bucket: 1 }, { text: 'Drink water', bucket: 0 }, { text: 'Screens all night', bucket: 1 }] }),
  m('LIF', 'habits', 'seq', 'explorer', 2, 'Order a calm bedtime routine.',
    { items: ['Brush teeth', 'Put away screens', 'Read a book', 'Sleep'] }),
  m('LIF', 'kindness', 'mcq', 'explorer', 3, 'A classmate takes credit for YOUR idea. The best response is to…',
    { choices: ['Calmly say it was your idea', 'Yell at them', 'Never speak again', 'Take their idea back secretly'], answer: 0 }),
  m('LIF', 'movement', 'mcq', 'explorer', 2, 'Before exercise you should always…',
    { choices: ['Warm up', 'Eat a big meal', 'Sit still', 'Hold your breath'], answer: 0 }),
  m('LIF', 'party', 'party', 'explorer', 2, 'Kindness quest!',
    { quest: true, task: 'Give someone a genuine compliment today.' }),
  m('LIF', 'habits', 'party', 'explorer', 2, 'Habit quest!',
    { quest: true, task: 'Drink a glass of water and tidy one small thing.' }),
  // Builder — empathy + decision making
  m('LIF', 'kindness', 'mcq', 'builder', 4, 'A friend shares a worry. The most supportive reply is…',
    { choices: ['"That sounds hard — want to talk about it?"', '"Get over it."', '"Boring."', 'Change the subject'], answer: 0 }),
  m('LIF', 'kindness', 'mcq', 'builder', 3, 'You see a post online that might be untrue and mean. You should…',
    { choices: ['Not share it and check the facts', 'Share it fast', 'Add an insult', 'Screenshot and spread it'], answer: 0 }),
]

// ════════════════════════════════════════════════════════════
//  WORDQUEST — grammar editing + sentence building (analyse + create)
// ════════════════════════════════════════════════════════════
const WRD_DEEP: PackItem[] = [
  m('WRD', 'grammar', 'fix', 'explorer', 3, 'Tap the word that is WRONG: "She don\'t like apples."',
    { tokens: ['She', 'don\'t', 'like', 'apples.'], wrong: 1, fix: "doesn't" },
    { explanation: 'With "she/he/it" we use "doesn\'t".' }),
  m('WRD', 'grammar', 'fix', 'explorer', 3, 'Tap the error: "The dog wagged it\'s tail."',
    { tokens: ['The', 'dog', 'wagged', "it's", 'tail.'], wrong: 3, fix: 'its' },
    { explanation: '"its" = belonging to it; "it\'s" = it is.' }),
  m('WRD', 'grammar', 'cloze', 'explorer', 2, 'Choose the correct word: "There ___ three cats on the wall."',
    { before: 'There ', after: ' three cats on the wall.', options: ['are', 'is', 'be', 'am'], answer: 'are' }),
  m('WRD', 'writing', 'bank', 'explorer', 3, 'Build a clear sentence from the tiles.',
    { tiles: ['The', 'brave', 'knight', 'rescued', 'the', 'cat'], answer: ['The', 'brave', 'knight', 'rescued', 'the', 'cat'] }),
  m('WRD', 'writing', 'bank', 'explorer', 3, 'Arrange into a proper question.',
    { tiles: ['Where', 'did', 'you', 'find', 'it'], answer: ['Where', 'did', 'you', 'find', 'it'] }),
  m('WRD', 'grammar', 'mcq', 'explorer', 3, 'Which sentence uses punctuation correctly?',
    { choices: ['"Run!" she shouted.', 'run she shouted', '"Run" she shouted', 'Run! she shouted"'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'Which word is a SYNONYM of "enormous"?',
    { choices: ['Gigantic', 'Tiny', 'Quiet', 'Fast'], answer: 0 }),
  m('WRD', 'vocab', 'mcq', 'explorer', 3, 'Which word is an ANTONYM of "ancient"?',
    { choices: ['Modern', 'Old', 'Dusty', 'Stone'], answer: 0 }),
  // Builder
  m('WRD', 'grammar', 'fix', 'builder', 4, 'Tap the error: "Me and him went to the shop."',
    { tokens: ['Me', 'and', 'him', 'went', 'to the shop.'], wrong: 0, fix: 'He and I' },
    { explanation: 'Subject pronouns: "He and I went…".' }),
  m('WRD', 'writing', 'bank', 'builder', 4, 'Build a complex sentence with a conjunction.',
    { tiles: ['Although', 'it', 'rained', 'we', 'kept', 'playing'], answer: ['Although', 'it', 'rained', 'we', 'kept', 'playing'] }),
  m('WRD', 'vocab', 'cloze', 'builder', 4, 'Choose the precise word: "The detective found a ___ clue that solved the case."',
    { before: 'a ', after: ' clue', options: ['crucial', 'tiny', 'happy', 'green'], answer: 'crucial' }),
]

export const CONTENT_PACK_4: PackItem[] = [
  ...READING,
  ...NUM_DEEP,
  ...WON_DEEP,
  ...LOG_DEEP,
  ...WLD_DEEP,
  ...LIF_DEEP,
  ...WRD_DEEP,
]
