// ============================================================
//  ARGANTALAB · EXPLORER CONTENT PACK  (ages 8–11)
//  Real curriculum material, Cambridge-Primary-aligned, fed into
//  the adaptive engine. Add rows here to add real questions — the
//  journey nodes pick from this pool by skill. Answers verified.
// ============================================================
// Types are duplicated locally (not imported) so this file has NO dependency on
// learn.ts — that keeps the module graph one-directional (learn imports this).
type IKey =
  | 'mcq' | 'multi' | 'type' | 'speed' | 'bank' | 'cloze'
  | 'match' | 'sort' | 'seq' | 'fix' | 'numline' | 'slider'
  | 'listen' | 'label' | 'pte' | 'code' | 'map' | 'party'
interface PackItem {
  id: string; world: string; skill: string; type: IKey; stage: string
  difficulty: number; prompt: string; payload: Record<string, unknown>
  hint?: string; explanation?: string; xp?: number; diamonds?: number
}

let _p = 0
function q(world: string, skill: string, type: IKey, prompt: string, payload: Record<string, unknown>, extra: Partial<PackItem> = {}): PackItem {
  return { id: `pack_${++_p}`, world, skill, type, stage: 'explorer', difficulty: extra.difficulty ?? 2, prompt, payload, xp: 10, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  NUMBERDASH · Mathematics
// ════════════════════════════════════════════════════════════
const NUM_PACK: PackItem[] = [
  // — times tables —
  q('NUM', 'times', 'speed', 'Times-table sprint (3s & 4s)!', { questions: [{ q: '3 × 4', a: '12' }, { q: '4 × 6', a: '24' }, { q: '3 × 8', a: '24' }, { q: '4 × 9', a: '36' }, { q: '3 × 7', a: '21' }], seconds: 50 }),
  q('NUM', 'times', 'speed', 'Times-table sprint (6s, 7s, 8s)!', { questions: [{ q: '6 × 7', a: '42' }, { q: '7 × 8', a: '56' }, { q: '8 × 6', a: '48' }, { q: '7 × 7', a: '49' }, { q: '8 × 9', a: '72' }], seconds: 55 }),
  q('NUM', 'times', 'mcq', 'What is 12 × 3?', { choices: ['33', '36', '39', '32'], answer: 1 }, { explanation: '12 × 3 = 36.' }),
  q('NUM', 'times', 'mcq', 'What is 11 × 9?', { choices: ['99', '108', '90', '109'], answer: 0 }, { explanation: '11 × 9 = 99.' }),
  q('NUM', 'times', 'type', '9 × 9 = ?', { answer: '81', numeric: true }, { explanation: '9 × 9 = 81.' }),
  q('NUM', 'times', 'type', '7 × 6 = ?', { answer: '42', numeric: true }, { explanation: '7 × 6 = 42.' }),
  q('NUM', 'times', 'cloze', 'Complete the fact.', { before: '? × 7 = 56', after: '', options: ['6', '7', '8'], answer: '8' }, { explanation: '8 × 7 = 56.' }),
  q('NUM', 'times', 'cloze', 'Division fact.', { before: '48 ÷ 6 = ', after: '', options: ['7', '8', '9'], answer: '8' }, { explanation: '48 ÷ 6 = 8.' }),
  q('NUM', 'times', 'match', 'Match each fact to its answer.', { pairs: [['6 × 6', '36'], ['7 × 9', '63'], ['8 × 4', '32'], ['12 × 5', '60']] }, { explanation: 'Skip-count to check.' }),
  q('NUM', 'times', 'mcq', 'Which is NOT a multiple of 5?', { choices: ['25', '40', '52', '15'], answer: 2 }, { explanation: 'Multiples of 5 end in 0 or 5; 52 does not.' }),
  q('NUM', 'times', 'type', 'A box holds 8 pens. How many pens in 7 boxes?', { answer: '56', numeric: true }, { explanation: '8 × 7 = 56 pens.' }),
  q('NUM', 'times', 'mcq', 'Boss: 12 × 12 = ?', { choices: ['124', '144', '122', '154'], answer: 1 }, { difficulty: 3, explanation: '12 × 12 = 144.' }),

  // — fractions —
  q('NUM', 'fractions', 'mcq', 'Which fraction is equivalent to 1/2?', { choices: ['2/4', '1/3', '2/5', '3/8'], answer: 0 }, { explanation: '2/4 = 1/2.' }),
  q('NUM', 'fractions', 'mcq', 'Which is the largest?', { choices: ['1/3', '1/2', '1/4', '1/5'], answer: 1 }, { explanation: 'The bigger the bottom number, the smaller the slice — 1/2 is biggest.' }),
  q('NUM', 'fractions', 'type', 'What is 1/4 of 20?', { answer: '5', numeric: true }, { explanation: '20 ÷ 4 = 5.' }),
  q('NUM', 'fractions', 'type', 'What is 3/4 of 12?', { answer: '9', numeric: true }, { explanation: '12 ÷ 4 = 3, then 3 × 3 = 9.' }),
  q('NUM', 'fractions', 'numline', 'Place 2/5 on the line.', { min: 0, max: 1, answer: 0.4, tol: 0.06, label: '2/5' }, { explanation: '2/5 = 0.4.' }),
  q('NUM', 'fractions', 'match', 'Match the fraction to its decimal.', { pairs: [['1/2', '0.5'], ['1/4', '0.25'], ['1/10', '0.1'], ['3/4', '0.75']] }, { explanation: 'Fractions and decimals show the same amount.' }),
  q('NUM', 'fractions', 'cloze', 'Add the fractions.', { before: '1/5 + 2/5 = ', after: '', options: ['3/5', '3/10', '2/5'], answer: '3/5' }, { explanation: 'Same bottom number → add the tops: 1+2 = 3 fifths.' }),
  q('NUM', 'fractions', 'sort', 'Sort: bigger or smaller than 1/2?', { buckets: ['Smaller than 1/2', 'Bigger than 1/2'], items: [{ text: '1/3', bucket: 0 }, { text: '3/4', bucket: 1 }, { text: '2/5', bucket: 0 }, { text: '5/8', bucket: 1 }] }, { explanation: 'Compare each to one half.' }),
  q('NUM', 'fractions', 'mcq', 'A pizza is cut into 8 slices. You eat 2. What fraction is left?', { choices: ['6/8', '2/8', '8/6', '1/2'], answer: 0 }, { explanation: '8 − 2 = 6 slices left = 6/8.' }),
  q('NUM', 'fractions', 'mcq', 'Boss: which fraction equals 3/6?', { choices: ['1/2', '1/3', '2/3', '3/4'], answer: 0 }, { difficulty: 3, explanation: '3/6 simplifies to 1/2.' }),
]

// ════════════════════════════════════════════════════════════
//  WORDQUEST · English
// ════════════════════════════════════════════════════════════
const WRD_PACK: PackItem[] = [
  // — phonics —
  q('WRD', 'phonics', 'mcq', 'Which word rhymes with "light"?', { choices: ['night', 'lamp', 'list', 'love'], answer: 0 }, { explanation: 'light and night both end in -ight.' }),
  q('WRD', 'phonics', 'cloze', 'Finish the word: shi__', { before: 'shi', after: '', options: ['p', 'g', 'k'], answer: 'p' }, { explanation: 's-h-i-p spells ship.' }),
  q('WRD', 'phonics', 'mcq', 'What sound do "ch" make in "chair"?', { choices: ['ch', 'k', 'sh', 'j'], answer: 0 }, { explanation: '"ch" makes the /ch/ sound.' }),
  q('WRD', 'phonics', 'listen', 'Which letter makes this sound?', { say: 'fff', choices: ['f', 'v', 'th'], answer: 0 }, { explanation: 'The /f/ sound is the letter f.' }),
  q('WRD', 'phonics', 'cloze', 'Make a word: __ain (rhymes with "rain")', { before: '', after: 'ain', options: ['tr', 'br', 'ch'], answer: 'tr' }, { explanation: 'tr-ain spells train.' }),
  q('WRD', 'phonics', 'mcq', 'How many syllables in "elephant"?', { choices: ['2', '3', '4', '1'], answer: 1 }, { explanation: 'el-e-phant = 3 syllables.' }),

  // — grammar —
  q('WRD', 'grammar', 'cloze', 'Choose the correct verb.', { before: 'The cats ', after: ' on the mat.', options: ['sits', 'sit', 'sitting'], answer: 'sit' }, { explanation: 'Plural "cats" takes "sit".' }),
  q('WRD', 'grammar', 'fix', 'Tap the word that should be capital.', { tokens: ['we', 'visited', 'london', 'last', 'year'], wrong: 2, fix: 'London' }, { explanation: 'Place names are proper nouns — always capital.' }),
  q('WRD', 'grammar', 'mcq', 'Which sentence uses the past tense?', { choices: ['I walk to school.', 'I walked to school.', 'I will walk.', 'I am walking.'], answer: 1 }, { explanation: '"walked" is past tense.' }),
  q('WRD', 'grammar', 'mcq', 'What is the plural of "child"?', { choices: ['childs', 'children', 'childes', 'childrens'], answer: 1 }, { explanation: '"child" → "children" (irregular plural).' }),
  q('WRD', 'grammar', 'cloze', 'Choose a or an.', { before: 'She ate ', after: ' apple.', options: ['a', 'an'], answer: 'an' }, { explanation: 'Use "an" before a vowel sound.' }),
  q('WRD', 'grammar', 'fix', 'Tap the punctuation mistake.', { tokens: ['What', 'time', 'is', 'it.'], wrong: 3, fix: 'it?' }, { explanation: 'A question ends with "?".' }),
  q('WRD', 'grammar', 'mcq', 'Which word is an adjective?', { choices: ['quickly', 'happy', 'run', 'table'], answer: 1 }, { explanation: 'An adjective describes a noun — "happy".' }),
  q('WRD', 'grammar', 'mcq', 'Boss: which is the verb? "The bird sang sweetly."', { choices: ['bird', 'sang', 'sweetly', 'the'], answer: 1 }, { difficulty: 3, explanation: 'A verb is an action — "sang".' }),

  // — vocab —
  q('WRD', 'vocab', 'mcq', 'What does "ancient" mean?', { choices: ['very new', 'very old', 'very fast', 'very small'], answer: 1 }, { explanation: 'Ancient = very old.' }),
  q('WRD', 'vocab', 'match', 'Match the antonyms (opposites).', { pairs: [['begin', 'end'], ['empty', 'full'], ['ancient', 'modern'], ['brave', 'scared']] }, { explanation: 'Antonyms are opposites.' }),
  q('WRD', 'vocab', 'mcq', 'A synonym for "happy" is...', { choices: ['joyful', 'angry', 'tired', 'hungry'], answer: 0 }, { explanation: 'Joyful means the same as happy.' }),
  q('WRD', 'vocab', 'cloze', 'Which prefix means "not"? __happy', { before: '', after: 'happy', options: ['un', 're', 'pre'], answer: 'un' }, { explanation: '"un-" means not — unhappy = not happy.' }),
  q('WRD', 'vocab', 'mcq', 'What does "enormous" mean?', { choices: ['tiny', 'gigantic', 'gentle', 'noisy'], answer: 1 }, { explanation: 'Enormous = very big / gigantic.' }),
  q('WRD', 'vocab', 'match', 'Match the word to its meaning.', { pairs: [['rapid', 'fast'], ['weary', 'tired'], ['silent', 'quiet'], ['gleaming', 'shiny']] }, { explanation: 'These are synonyms.' }),

  // — writing —
  q('WRD', 'writing', 'seq', 'Put the instructions in order.', { items: ['Get the bread', 'Spread the butter', 'Add the filling', 'Eat the sandwich'] }, { explanation: 'Order the steps in time.' }),
  q('WRD', 'writing', 'bank', 'Build a sentence.', { tiles: ['The', 'brave', 'knight', 'saved', 'the', 'village'], answer: ['The', 'brave', 'knight', 'saved', 'the', 'village'] }, { explanation: 'Start with a capital, end with a full stop.' }),
  q('WRD', 'writing', 'mcq', 'Which sentence is written correctly?', { choices: ['my dog is big', 'My dog is big.', 'My Dog is big', 'my dog is Big.'], answer: 1 }, { explanation: 'Capital at the start, full stop at the end.' }),
  q('WRD', 'writing', 'bank', 'Boss: build the question.', { tiles: ['Where', 'did', 'you', 'go', 'today'], answer: ['Where', 'did', 'you', 'go', 'today'] }, { difficulty: 3 }),
]

// ════════════════════════════════════════════════════════════
//  WONDERLAB · Science
// ════════════════════════════════════════════════════════════
const WON_PACK: PackItem[] = [
  // — biology —
  q('WON', 'biology', 'seq', 'Order the food chain (start with the plant).', { items: ['Grass', 'Grasshopper', 'Frog', 'Snake'] }, { explanation: 'Energy flows from plants to animals along a food chain.' }),
  q('WON', 'biology', 'mcq', 'Which organ pumps blood around your body?', { choices: ['Brain', 'Heart', 'Lungs', 'Stomach'], answer: 1 }, { explanation: 'The heart pumps blood.' }),
  q('WON', 'biology', 'sort', 'Sort: herbivore or carnivore?', { buckets: ['Herbivore (plants)', 'Carnivore (meat)'], items: [{ text: 'Cow', bucket: 0 }, { text: 'Lion', bucket: 1 }, { text: 'Rabbit', bucket: 0 }, { text: 'Shark', bucket: 1 }] }, { explanation: 'Herbivores eat plants; carnivores eat meat.' }),
  q('WON', 'biology', 'label', 'Label the parts of a plant.', { scene: '🌻', pairs: [['Top', 'Flower'], ['Middle', 'Stem'], ['Bottom', 'Roots']] }, { explanation: 'Roots drink water, the stem carries it up, the flower makes seeds.' }),
  q('WON', 'biology', 'mcq', 'What do humans breathe IN to stay alive?', { choices: ['Carbon dioxide', 'Oxygen', 'Helium', 'Smoke'], answer: 1 }, { explanation: 'We breathe in oxygen and breathe out carbon dioxide.' }),
  q('WON', 'biology', 'mcq', 'Which group does a frog belong to?', { choices: ['Mammal', 'Amphibian', 'Reptile', 'Bird'], answer: 1 }, { explanation: 'Frogs are amphibians — they live in water and on land.' }),

  // — chemistry —
  q('WON', 'chemistry', 'seq', 'Order the states as water heats up.', { items: ['Ice (solid)', 'Water (liquid)', 'Steam (gas)'] }, { explanation: 'Heating melts then evaporates: solid → liquid → gas.' }),
  q('WON', 'chemistry', 'mcq', 'What is it called when a solid turns into a liquid?', { choices: ['Freezing', 'Melting', 'Boiling', 'Floating'], answer: 1 }, { explanation: 'Solid → liquid is melting.' }),
  q('WON', 'chemistry', 'sort', 'Sort the materials.', { buckets: ['Waterproof', 'Soaks up water'], items: [{ text: 'Plastic', bucket: 0 }, { text: 'Towel', bucket: 1 }, { text: 'Raincoat', bucket: 0 }, { text: 'Paper', bucket: 1 }] }, { explanation: 'Waterproof materials keep water out.' }),
  q('WON', 'chemistry', 'pte', 'You put sugar in hot tea and stir.', { predict: { prompt: 'Predict: what happens to the sugar?', choices: ['It dissolves', 'It floats forever'], answer: 0 }, sim: '🍬 + ☕ = dissolves', explain: { prompt: 'Why?', choices: ['It spreads through the water', 'It turns to gas'], answer: 0 } }, { explanation: 'Sugar dissolves — it spreads out in the water.' }),
  q('WON', 'chemistry', 'mcq', 'Which of these is a liquid at room temperature?', { choices: ['Wood', 'Milk', 'Stone', 'Glass'], answer: 1 }, { explanation: 'Milk flows and takes the shape of its container — a liquid.' }),

  // — physics —
  q('WON', 'physics', 'mcq', 'What force pulls a dropped ball to the ground?', { choices: ['Magnetism', 'Gravity', 'Electricity', 'Friction'], answer: 1 }, { explanation: 'Gravity pulls objects down.' }),
  q('WON', 'physics', 'mcq', 'Which surface gives the MOST friction?', { choices: ['Ice', 'Sandpaper', 'Glass', 'Wet floor'], answer: 1 }, { explanation: 'Rough surfaces like sandpaper grip more — more friction.' }),
  q('WON', 'physics', 'slider', 'At what temperature (°C) does water freeze?', { min: -20, max: 40, answer: 0, tol: 3, unit: '°C' }, { explanation: 'Water freezes at 0°C.' }),
  q('WON', 'physics', 'pte', 'You shine a torch at a mirror.', { predict: { prompt: 'Predict: what does the light do?', choices: ['Bounces off', 'Disappears'], answer: 0 }, sim: '🔦 → 🪞 → bounces', explain: { prompt: 'Why?', choices: ['Mirrors reflect light', 'Mirrors eat light'], answer: 0 } }, { explanation: 'Mirrors reflect (bounce) light.' }),
  q('WON', 'physics', 'mcq', 'A magnet will attract...', { choices: ['Plastic spoon', 'Iron nail', 'Wooden block', 'Glass cup'], answer: 1 }, { explanation: 'Magnets attract iron and steel.' }),
  q('WON', 'physics', 'mcq', 'Sound travels by making the air...', { choices: ['Vibrate', 'Freeze', 'Glow', 'Disappear'], answer: 0 }, { explanation: 'Sound is vibrations travelling through the air.' }),

  // — earth & space —
  q('WON', 'earth', 'seq', 'Order the water cycle.', { items: ['Sun heats the sea', 'Water evaporates', 'Clouds form (condensation)', 'Rain falls'] }, { explanation: 'Evaporate → condense → precipitate, then repeat.' }),
  q('WON', 'earth', 'mcq', 'Why do we have day and night?', { choices: ['The Sun moves around Earth', 'Earth spins on its axis', 'The Moon blocks the Sun', 'Clouds cover the Sun'], answer: 1 }, { explanation: 'Earth spins once a day, turning us toward and away from the Sun.' }),
  q('WON', 'earth', 'mcq', 'Which is the closest planet to the Sun?', { choices: ['Earth', 'Mercury', 'Mars', 'Jupiter'], answer: 1 }, { explanation: 'Mercury is closest to the Sun.' }),
  q('WON', 'earth', 'seq', 'Order from smallest to largest.', { items: ['Moon', 'Earth', 'Sun'] }, { explanation: 'The Moon is small, Earth bigger, the Sun is huge.' }),
  q('WON', 'earth', 'mcq', 'What causes the seasons?', { choices: ["Earth's tilt as it orbits the Sun", 'The Sun turning off', 'Clouds', 'The Moon'], answer: 0 }, { difficulty: 3, explanation: "Earth's tilt means different parts get more sunlight at different times of year." }),
]

// ════════════════════════════════════════════════════════════
//  LOGICLAND · Computing & Logic
// ════════════════════════════════════════════════════════════
const LOG_PACK: PackItem[] = [
  // — code —
  q('LOG', 'code', 'code', 'Order the blocks to make a square (loop).', { tiles: ['repeat 4 times', '  move forward', '  turn right 90°'], answer: ['repeat 4 times', '  move forward', '  turn right 90°'] }, { explanation: 'A loop repeats "move + turn" four times.' }),
  q('LOG', 'code', 'match', 'Match the web language to its job.', { pairs: [['HTML', 'Structure'], ['CSS', 'Style & colour'], ['JavaScript', 'Actions']] }, { explanation: 'HTML = bones, CSS = looks, JS = behaviour.' }),
  q('LOG', 'code', 'mcq', 'What does a "loop" do in code?', { choices: ['Repeats steps', 'Deletes the file', 'Adds colour', 'Stops the program'], answer: 0 }, { explanation: 'A loop repeats instructions.' }),
  q('LOG', 'code', 'fix', 'Tap the block that is NOT a real instruction.', { tokens: ['start', 'moveForward', 'banana', 'stop'], wrong: 2, fix: 'turn' }, { explanation: '"banana" is not a code instruction.' }),
  q('LOG', 'code', 'mcq', 'In code, what does "if" let you do?', { choices: ['Make a decision', 'Print forever', 'Change colour', 'Delete code'], answer: 0 }, { explanation: '"if" runs code only when a condition is true.' }),

  // — data —
  q('LOG', 'data', 'mcq', 'The average (mean) of 4, 6, and 8 is...', { choices: ['6', '5', '8', '18'], answer: 0 }, { explanation: '(4+6+8) ÷ 3 = 18 ÷ 3 = 6.' }),
  q('LOG', 'data', 'mcq', 'Which chart is best to show "how scores changed each week"?', { choices: ['Line chart', 'Pie chart', 'Photo', 'Map'], answer: 0 }, { explanation: 'Line charts show change over time.' }),
  q('LOG', 'data', 'sort', 'Sort: data or not data?', { buckets: ['Data', 'Not data'], items: [{ text: 'Number of goals: 5', bucket: 0 }, { text: 'A funny story', bucket: 1 }, { text: 'Temperature: 22°C', bucket: 0 }, { text: 'Your opinion', bucket: 1 }] }, { explanation: 'Data is facts you can measure or count.' }),
  q('LOG', 'data', 'mcq', 'In 7, 2, 9, 4 — what is the largest value?', { choices: ['9', '7', '4', '2'], answer: 0 }, { explanation: '9 is the largest.' }),
  q('LOG', 'data', 'type', 'How many even numbers are in: 3, 4, 7, 8, 10?', { answer: '3', numeric: true }, { explanation: '4, 8, 10 are even — that is 3.' }),

  // — ai —
  q('LOG', 'ai', 'mcq', 'What is a "prompt"?', { choices: ['The instructions you give an AI', 'A type of robot', 'A computer chip', 'A video game'], answer: 0 }, { explanation: 'A prompt is what you ask an AI to do.' }),
  q('LOG', 'ai', 'mcq', 'Which is the clearest prompt?', { choices: ['make a game', 'Make a 2-player space racing game with coins', 'do stuff', 'game please'], answer: 1 }, { explanation: 'Clear details give better results.' }),
  q('LOG', 'ai', 'match', 'Match the AI helper to its job.', { pairs: [['Chat AI', 'Ideas & answers'], ['Code AI', 'Writes code'], ['Agent', 'Does tasks step by step']] }, { explanation: 'Different AI tools have different strengths.' }),
  q('LOG', 'ai', 'mcq', 'Who is in charge when you build with AI?', { choices: ['You — the director', 'The AI', 'Nobody', 'The computer mouse'], answer: 0 }, { explanation: 'You direct; the AI helps. You decide.' }),

  // — logic —
  q('LOG', 'logic', 'seq', 'Order the algorithm to wash hands.', { items: ['Turn on the tap', 'Add soap', 'Scrub', 'Rinse', 'Dry'] }, { explanation: 'An algorithm is a clear step-by-step list.' }),
  q('LOG', 'logic', 'mcq', 'Pattern: 2, 4, 8, 16, __?', { choices: ['32', '20', '24', '18'], answer: 0 }, { explanation: 'Each number doubles → 16 × 2 = 32.' }),
  q('LOG', 'logic', 'mcq', 'If it is raining, take an umbrella. It is raining. So you...', { choices: ['Take an umbrella', 'Wear sunglasses', 'Go swimming', 'Do nothing'], answer: 0 }, { explanation: 'That is "if-then" reasoning.' }),
  q('LOG', 'logic', 'seq', 'Sort these numbers smallest to largest.', { items: ['3', '7', '12', '20'] }, { explanation: 'Sorting puts items in order.' }),
  q('LOG', 'logic', 'mcq', 'Pattern: 🔺🔵🔺🔵🔺__?', { choices: ['🔵', '🔺', '⭐', '🟩'], answer: 0 }, { explanation: 'The pattern alternates triangle, circle → next is circle.' }),
]

// ════════════════════════════════════════════════════════════
//  WORLDTRAIL · Humanities (Geography · History · Economics)
// ════════════════════════════════════════════════════════════
const WLD_PACK: PackItem[] = [
  // — geography —
  q('WLD', 'geography', 'mcq', 'How many continents are there on Earth?', { choices: ['5', '6', '7', '8'], answer: 2 }, { explanation: 'There are 7 continents.' }),
  q('WLD', 'geography', 'mcq', 'Which is the largest ocean?', { choices: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answer: 2 }, { explanation: 'The Pacific Ocean is the largest.' }),
  q('WLD', 'geography', 'match', 'Match the country to its capital city.', { pairs: [['France', 'Paris'], ['Japan', 'Tokyo'], ['Egypt', 'Cairo'], ['Qatar', 'Doha']] }, { explanation: 'A capital is a country\'s main city.' }),
  q('WLD', 'geography', 'map', 'Which country is in the Middle East?', { choices: ['Qatar', 'Brazil', 'Canada', 'Australia'], answer: 0 }, { explanation: 'Qatar is in the Middle East — where Baba works!' }),
  q('WLD', 'geography', 'sort', 'Sort: hot or cold climate?', { buckets: ['Hot', 'Cold'], items: [{ text: 'Sahara Desert', bucket: 0 }, { text: 'Antarctica', bucket: 1 }, { text: 'Arabian Desert', bucket: 0 }, { text: 'North Pole', bucket: 1 }] }, { explanation: 'Climate depends on where a place is on Earth.' }),
  q('WLD', 'geography', 'match', 'Match the landmark to its country.', { pairs: [['Eiffel Tower', 'France'], ['Pyramids', 'Egypt'], ['Great Wall', 'China'], ['Taj Mahal', 'India']] }, { explanation: 'Landmarks help us recognise countries.' }),
  q('WLD', 'geography', 'mcq', 'Which is a continent?', { choices: ['Africa', 'Paris', 'The Pacific', 'Mount Everest'], answer: 0 }, { explanation: 'Africa is one of the 7 continents.' }),

  // — history —
  q('WLD', 'history', 'seq', 'Order these from oldest to newest.', { items: ['Dinosaurs', 'Ancient Egypt', 'Medieval castles', 'The internet'] }, { explanation: 'A timeline runs from long ago to today.' }),
  q('WLD', 'history', 'mcq', 'The ancient Egyptians are famous for building...', { choices: ['Skyscrapers', 'Pyramids', 'Submarines', 'Airports'], answer: 1 }, { explanation: 'The Egyptians built the pyramids thousands of years ago.' }),
  q('WLD', 'history', 'seq', 'Order these inventions oldest to newest.', { items: ['The wheel', 'The printing press', 'The telephone', 'The smartphone'] }, { explanation: 'Technology improved over time.' }),
  q('WLD', 'history', 'mcq', 'Who lived and fought in castles long ago?', { choices: ['Knights', 'Astronauts', 'Pilots', 'Robots'], answer: 0 }, { explanation: 'Knights served kings and defended castles.' }),
  q('WLD', 'history', 'mcq', 'Before electricity, people lit their homes with...', { choices: ['Candles & oil lamps', 'LED bulbs', 'Phones', 'Televisions'], answer: 0 }, { explanation: 'Candles and oil lamps gave light before electricity.' }),

  // — economics —
  q('WLD', 'economics', 'mcq', 'Which is a NEED (not a want)?', { choices: ['Clean water', 'A video game', 'Sweets', 'A toy car'], answer: 0 }, { explanation: 'Needs keep us alive; wants are extras.' }),
  q('WLD', 'economics', 'type', 'You buy a toy for 8 coins and sell it for 13. What is your profit?', { answer: '5', numeric: true }, { explanation: '13 − 8 = 5 coins profit.' }),
  q('WLD', 'economics', 'sort', 'Sort: need or want?', { buckets: ['Need', 'Want'], items: [{ text: 'Food', bucket: 0 }, { text: 'New trainers', bucket: 1 }, { text: 'Shelter', bucket: 0 }, { text: 'Ice cream', bucket: 1 }] }, { explanation: 'Needs first, then wants.' }),
  q('WLD', 'economics', 'mcq', 'Saving money means...', { choices: ['Keeping some for later', 'Spending it all now', 'Giving it all away', 'Losing it'], answer: 0 }, { explanation: 'Saving = keeping money to use later.' }),
  q('WLD', 'economics', 'mcq', 'Why do people use money?', { choices: ['To trade for goods and services', 'To eat it', 'To fly', 'To sleep'], answer: 0 }, { explanation: 'Money makes trading easier than swapping things.' }),
]

// ════════════════════════════════════════════════════════════
//  LIFEQUEST · Wellbeing & Life Skills
// ════════════════════════════════════════════════════════════
const LIF_PACK: PackItem[] = [
  // — habits —
  q('LIF', 'habits', 'mcq', 'About how many hours of sleep do children your age need?', { choices: ['9–11 hours', '2–3 hours', '20 hours', 'None'], answer: 0 }, { explanation: 'Kids need around 9–11 hours of sleep to grow and focus.' }),
  q('LIF', 'habits', 'mcq', 'When should you wash your hands?', { choices: ['Before eating & after the toilet', 'Only on birthdays', 'Never', 'Only at school'], answer: 0 }, { explanation: 'Washing hands stops germs spreading.' }),
  q('LIF', 'habits', 'party', 'Daily quest', { task: 'Drink a glass of water', quest: true }, { explanation: 'Your body needs water to stay healthy.' }),
  q('LIF', 'habits', 'party', 'Daily quest', { task: 'Make your bed today', quest: true }),
  q('LIF', 'habits', 'mcq', 'Which is the healthiest snack?', { choices: ['An apple', 'A bag of sweets', 'Fizzy drink', 'Chocolate bar'], answer: 0 }, { explanation: 'Fruit gives energy and vitamins.' }),

  // — kindness —
  q('LIF', 'kindness', 'mcq', 'A classmate dropped their books. What is kind?', { choices: ['Help pick them up', 'Laugh', 'Walk past', 'Kick them away'], answer: 0 }, { explanation: 'Helping others is kind.' }),
  q('LIF', 'kindness', 'mcq', 'Your friend looks sad. A kind thing to say is...', { choices: ['"Are you okay? I\'m here."', '"Stop being sad."', 'Nothing', '"That\'s silly."'], answer: 0 }, { explanation: 'Listening and caring shows empathy.' }),
  q('LIF', 'kindness', 'party', 'Kindness quest', { task: 'Give someone a genuine compliment today', quest: true }),
  q('LIF', 'kindness', 'party', 'Kindness quest', { task: 'Help a family member with a small chore', quest: true }, { difficulty: 3 }),

  // — movement —
  q('LIF', 'movement', 'mcq', 'Which activity is good exercise?', { choices: ['Riding a bike', 'Sitting all day', 'Watching TV', 'Sleeping'], answer: 0 }, { explanation: 'Moving keeps your heart and body strong.' }),
  q('LIF', 'movement', 'party', 'Movement quest', { task: 'Do 10 star jumps', quest: true }),
  q('LIF', 'movement', 'party', 'Movement quest', { task: 'Stretch up tall and touch your toes 5 times', quest: true }),

  // — party games —
  q('LIF', 'party', 'party', 'Emoji guess', { prompt: 'A yellow fruit monkeys love 🐵', reveal: '🍌 Banana!' }),
  q('LIF', 'party', 'party', 'Emoji guess', { prompt: 'It falls from clouds when it rains ☁️', reveal: '🌧️ Rain!' }),
  q('LIF', 'party', 'party', 'Emoji guess', { prompt: 'Cold and white, you build it in winter ⛄', reveal: '❄️ Snowman!' }),
  q('LIF', 'party', 'mcq', 'Which is a way to calm down when angry?', { choices: ['Take deep breaths', 'Shout louder', 'Throw things', 'Stomp around'], answer: 0 }, { explanation: 'Slow, deep breaths help your body calm down.' }),
]

export const EXPLORER_PACK: PackItem[] = [
  ...NUM_PACK, ...WRD_PACK, ...WON_PACK, ...LOG_PACK, ...WLD_PACK, ...LIF_PACK,
]
