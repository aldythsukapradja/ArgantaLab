// ============================================================
//  ARGANTALAB · STAGE PACKS  — widen Maths, fill Starter (6–8) &
//  Builder (11–14), spread difficulty 1–5, and lean on the
//  interactive question types (not just multiple-choice).
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

let _s = 0
// m(world, skill, type, stage, difficulty, prompt, payload, extra)
function m(world: string, skill: string, type: IKey, stage: string, difficulty: number, prompt: string, payload: Record<string, unknown>, extra: Partial<PackItem> = {}): PackItem {
  return { id: `pk_${++_s}`, world, skill, type, stage, difficulty, prompt, payload, xp: 10, diamonds: 0, ...extra }
}

// ════════════════════════════════════════════════════════════
//  MATHS WIDENING (NUM) — place value · arithmetic · money ·
//  measurement · time · geometry — across stages & difficulty
// ════════════════════════════════════════════════════════════
const MATHS: PackItem[] = [
  // — place value —
  m('NUM', 'placevalue', 'mcq', 'starter', 1, 'What is the tens digit in 34?', { choices: ['3', '4', '7', '34'], answer: 0 }, { explanation: '34 = 3 tens and 4 ones.' }),
  m('NUM', 'placevalue', 'type', 'starter', 2, 'What number is 5 tens and 3 ones?', { answer: '53', numeric: true }, { explanation: '5 tens (50) + 3 ones (3) = 53.' }),
  m('NUM', 'placevalue', 'mcq', 'explorer', 3, 'In 482, what is the value of the 8?', { choices: ['8 ones', '80', '800', '8 thousand'], answer: 1 }, { explanation: 'The 8 is in the tens place → 80.' }),
  m('NUM', 'placevalue', 'seq', 'explorer', 3, 'Order from smallest to largest.', { items: ['109', '190', '901', '910'] }, { explanation: 'Compare the hundreds, then tens, then ones.' }),
  m('NUM', 'placevalue', 'type', 'builder', 4, 'Round 387 to the nearest hundred.', { answer: '400', numeric: true }, { explanation: '387 is closer to 400 than 300.' }),
  m('NUM', 'placevalue', 'type', 'builder', 4, 'What is 1000 more than 4,500?', { answer: '5500', numeric: true }, { explanation: '4500 + 1000 = 5500.' }),

  // — arithmetic (+ / −) —
  m('NUM', 'arith', 'type', 'starter', 1, '3 + 4 = ?', { answer: '7', numeric: true }),
  m('NUM', 'arith', 'type', 'starter', 1, '10 − 6 = ?', { answer: '4', numeric: true }),
  m('NUM', 'arith', 'speed', 'starter', 2, 'Add & subtract sprint!', { questions: [{ q: '5 + 6', a: '11' }, { q: '12 − 4', a: '8' }, { q: '7 + 8', a: '15' }, { q: '14 − 9', a: '5' }], seconds: 50 }),
  m('NUM', 'arith', 'type', 'explorer', 2, '27 + 15 = ?', { answer: '42', numeric: true }, { explanation: '27 + 15 = 42 (carry the ten).' }),
  m('NUM', 'arith', 'type', 'explorer', 3, '63 − 28 = ?', { answer: '35', numeric: true }, { explanation: '63 − 28 = 35.' }),
  m('NUM', 'arith', 'type', 'builder', 4, '504 − 267 = ?', { answer: '237', numeric: true }, { explanation: '504 − 267 = 237.' }),
  m('NUM', 'arith', 'type', 'builder', 5, 'A number plus 47 equals 112. What is the number?', { answer: '65', numeric: true }, { explanation: '112 − 47 = 65.' }),

  // — money —
  m('NUM', 'money', 'mcq', 'starter', 1, 'Which coin is worth the most?', { choices: ['1p', '10p', '50p', '5p'], answer: 2 }, { explanation: '50p is the biggest of these.' }),
  m('NUM', 'money', 'type', 'explorer', 2, 'You have 50p and spend 35p. How many pence are left?', { answer: '15', numeric: true }, { explanation: '50 − 35 = 15p.' }),
  m('NUM', 'money', 'type', 'explorer', 2, 'Three stickers cost 20p each. Total pence?', { answer: '60', numeric: true }, { explanation: '20 × 3 = 60p.' }),
  m('NUM', 'money', 'type', 'builder', 4, 'You pay £1 for a 65p snack. How much change in pence?', { answer: '35', numeric: true }, { explanation: '100 − 65 = 35p.' }),
  m('NUM', 'money', 'mcq', 'builder', 5, 'Which is better value?', { choices: ['6 pens for £3', '10 pens for £4', 'They are equal', 'Cannot tell'], answer: 1 }, { explanation: '10 for £4 = 40p each; 6 for £3 = 50p each.' }),

  // — measurement —
  m('NUM', 'measure', 'mcq', 'starter', 1, 'Which is longer?', { choices: ['1 metre', '1 centimetre'], answer: 0 }, { explanation: 'A metre is 100 centimetres.' }),
  m('NUM', 'measure', 'slider', 'explorer', 2, 'About how tall is a door? (cm)', { min: 0, max: 300, answer: 200, tol: 30, unit: 'cm' }, { explanation: 'A door is roughly 200 cm tall.' }),
  m('NUM', 'measure', 'type', 'explorer', 3, 'How many centimetres are in 2 metres?', { answer: '200', numeric: true }, { explanation: '1 m = 100 cm, so 2 m = 200 cm.' }),
  m('NUM', 'measure', 'type', 'builder', 4, 'How many grams are in 3 kilograms?', { answer: '3000', numeric: true }, { explanation: '1 kg = 1000 g.' }),
  m('NUM', 'measure', 'type', 'builder', 4, 'A jug holds 2 litres. How many millilitres is that?', { answer: '2000', numeric: true }, { explanation: '1 litre = 1000 ml.' }),

  // — time —
  m('NUM', 'time', 'mcq', 'starter', 1, 'How many days are in a week?', { choices: ['5', '7', '10', '12'], answer: 1 }, { explanation: 'A week has 7 days.' }),
  m('NUM', 'time', 'type', 'starter', 2, 'How many hours are in one day?', { answer: '24', numeric: true }, { explanation: 'A day has 24 hours.' }),
  m('NUM', 'time', 'mcq', 'explorer', 2, 'What time is "quarter past 3"?', { choices: ['3:15', '3:30', '3:45', '3:00'], answer: 0 }, { explanation: 'Quarter past = 15 minutes after.' }),
  m('NUM', 'time', 'type', 'explorer', 3, 'How many minutes are in 2 hours?', { answer: '120', numeric: true }, { explanation: '60 × 2 = 120 minutes.' }),
  m('NUM', 'time', 'type', 'builder', 4, 'From 2:45 to 4:15 — how many minutes?', { answer: '90', numeric: true }, { explanation: '2:45→3:45 is 60, then →4:15 is 30. Total 90.' }),

  // — geometry —
  m('NUM', 'geometry', 'mcq', 'starter', 1, 'How many sides does a triangle have?', { choices: ['2', '3', '4', '5'], answer: 1 }, { explanation: 'A triangle has 3 sides.' }),
  m('NUM', 'geometry', 'mcq', 'starter', 1, 'A shape with 4 equal sides is a...', { choices: ['circle', 'square', 'triangle', 'oval'], answer: 1 }, { explanation: 'A square has 4 equal sides.' }),
  m('NUM', 'geometry', 'match', 'explorer', 2, 'Match the shape to its number of sides.', { pairs: [['Triangle', '3'], ['Square', '4'], ['Pentagon', '5'], ['Hexagon', '6']] }, { explanation: 'Count each shape\'s sides.' }),
  m('NUM', 'geometry', 'mcq', 'explorer', 3, 'How many right angles does a rectangle have?', { choices: ['2', '3', '4', '0'], answer: 2 }, { explanation: 'Every corner of a rectangle is a right angle — 4.' }),
  m('NUM', 'geometry', 'mcq', 'builder', 4, 'A 3D shape with 6 square faces is a...', { choices: ['cube', 'sphere', 'cone', 'cylinder'], answer: 0 }, { explanation: 'A cube has 6 equal square faces.' }),
  m('NUM', 'geometry', 'type', 'builder', 4, 'A square has sides of 5 cm. What is its perimeter (cm)?', { answer: '20', numeric: true }, { explanation: '5 × 4 sides = 20 cm.' }),

  // a couple harder times/fractions to widen the existing skills' difficulty band
  m('NUM', 'times', 'type', 'builder', 4, '13 × 12 = ?', { answer: '156', numeric: true }, { explanation: '13 × 12 = 156.' }),
  m('NUM', 'times', 'type', 'builder', 5, '144 ÷ 12 = ?', { answer: '12', numeric: true }, { explanation: '12 × 12 = 144.' }),
  m('NUM', 'fractions', 'type', 'builder', 4, '3/4 + 1/4 = ? (whole number)', { answer: '1', numeric: true }, { explanation: '3/4 + 1/4 = 4/4 = 1.' }),
  m('NUM', 'fractions', 'mcq', 'builder', 5, 'Which is bigger: 2/3 or 3/5?', { choices: ['2/3', '3/5', 'Equal'], answer: 0 }, { explanation: '2/3 ≈ 0.67, 3/5 = 0.6 → 2/3 is bigger.' }),
  m('NUM', 'times', 'mcq', 'starter', 1, '2 × 3 = ?', { choices: ['5', '6', '8', '4'], answer: 1 }, { explanation: '2 × 3 = 6.' }),
  m('NUM', 'fractions', 'mcq', 'starter', 1, 'Half of 4 is...?', { choices: ['1', '2', '3', '4'], answer: 1 }, { explanation: 'Half of 4 is 2.' }),
]

// ════════════════════════════════════════════════════════════
//  STARTER PACK (ages 6–8) — gentle, difficulty 1–2, varied types
// ════════════════════════════════════════════════════════════
const STARTER: PackItem[] = [
  m('WRD', 'phonics', 'listen', 'starter', 1, 'Which letter makes this sound?', { say: 'buh', choices: ['b', 'd', 'p'], answer: 0 }, { explanation: 'The /b/ sound is the letter b.' }),
  m('WRD', 'phonics', 'mcq', 'starter', 1, 'Which word rhymes with "cat"?', { choices: ['hat', 'dog', 'sun', 'cup'], answer: 0 }),
  m('WRD', 'phonics', 'cloze', 'starter', 1, 'Finish the word: su__', { before: 'su', after: '', options: ['n', 't', 'g'], answer: 'n' }, { explanation: 's-u-n spells sun.' }),
  m('WRD', 'grammar', 'cloze', 'starter', 2, 'Choose the right word.', { before: 'I ', after: ' a red ball.', options: ['has', 'have', 'haves'], answer: 'have' }, { explanation: '"I have".' }),
  m('WRD', 'vocab', 'match', 'starter', 1, 'Match the opposites.', { pairs: [['big', 'small'], ['hot', 'cold'], ['up', 'down']] }),
  m('WON', 'biology', 'mcq', 'starter', 1, 'Where do fish live?', { choices: ['In water', 'In trees', 'In the sky', 'Underground'], answer: 0 }),
  m('WON', 'biology', 'sort', 'starter', 2, 'Sort: animal or plant?', { buckets: ['Animal', 'Plant'], items: [{ text: 'Dog', bucket: 0 }, { text: 'Tree', bucket: 1 }, { text: 'Cat', bucket: 0 }, { text: 'Flower', bucket: 1 }] }),
  m('WON', 'earth', 'mcq', 'starter', 1, 'What do we see in the sky at night?', { choices: ['The Sun', 'The Moon', 'A rainbow', 'Grass'], answer: 1 }),
  m('LOG', 'logic', 'seq', 'starter', 1, 'Put the morning in order.', { items: ['Wake up', 'Brush teeth', 'Eat breakfast'] }),
  m('LOG', 'logic', 'mcq', 'starter', 2, 'Pattern: 🔴🔵🔴🔵🔴__?', { choices: ['🔵', '🔴', '🟢', '⭐'], answer: 0 }),
  m('WLD', 'geography', 'mcq', 'starter', 1, 'A very big area of water is called an...', { choices: ['ocean', 'hill', 'forest', 'road'], answer: 0 }),
  m('WLD', 'history', 'mcq', 'starter', 2, 'Which is from a long time ago?', { choices: ['A castle', 'A smartphone', 'A jet plane', 'A laptop'], answer: 0 }),
  m('LIF', 'habits', 'party', 'starter', 1, 'Daily quest', { task: 'Brush your teeth', quest: true }),
  m('LIF', 'kindness', 'mcq', 'starter', 1, 'A kind thing to do is...', { choices: ['Share your toys', 'Grab things', 'Shout', 'Push'], answer: 0 }),
  m('LIF', 'party', 'party', 'starter', 1, 'Emoji guess', { prompt: 'It says "woof" 🐾', reveal: '🐶 Dog!' }),
]

// ════════════════════════════════════════════════════════════
//  BUILDER PACK (ages 11–14) — stretch, difficulty 4–5
// ════════════════════════════════════════════════════════════
const BUILDER: PackItem[] = [
  m('WRD', 'grammar', 'mcq', 'builder', 4, 'Which word is the adverb? "She ran quickly home."', { choices: ['She', 'ran', 'quickly', 'home'], answer: 2 }, { explanation: 'An adverb describes a verb — "quickly".' }),
  m('WRD', 'grammar', 'fix', 'builder', 4, 'Tap the word that breaks subject–verb agreement.', { tokens: ['The', 'team', 'were', 'happy'], wrong: 2, fix: 'was' }, { explanation: '"team" is singular → "was".' }),
  m('WRD', 'vocab', 'mcq', 'builder', 5, 'What does "reluctant" mean?', { choices: ['eager', 'unwilling', 'tired', 'angry'], answer: 1 }, { explanation: 'Reluctant = unwilling / hesitant.' }),
  m('WRD', 'writing', 'bank', 'builder', 4, 'Build a complex sentence.', { tiles: ['Although', 'it', 'rained', 'we', 'played'], answer: ['Although', 'it', 'rained', 'we', 'played'] }, { explanation: 'A subordinate clause + main clause.' }),
  m('WON', 'physics', 'mcq', 'builder', 4, 'Which is a non-contact force?', { choices: ['Friction', 'Gravity', 'Pushing', 'Air resistance'], answer: 1 }, { explanation: 'Gravity acts without touching.' }),
  m('WON', 'chemistry', 'mcq', 'builder', 5, 'What is it called when a gas turns into a liquid?', { choices: ['Evaporation', 'Condensation', 'Melting', 'Freezing'], answer: 1 }, { explanation: 'Gas → liquid is condensation.' }),
  m('WON', 'biology', 'seq', 'builder', 4, 'Order the food chain energy flow.', { items: ['Sun', 'Plant', 'Herbivore', 'Carnivore'] }, { explanation: 'Energy starts at the Sun.' }),
  m('LOG', 'code', 'code', 'builder', 4, 'Order the blocks to count down from 3.', { tiles: ['set n = 3', 'repeat while n > 0', '  say n', '  n = n − 1'], answer: ['set n = 3', 'repeat while n > 0', '  say n', '  n = n − 1'] }, { explanation: 'A loop with a counter.' }),
  m('LOG', 'data', 'type', 'builder', 4, 'The mean of 8, 12, 10, 14 is?', { answer: '11', numeric: true }, { explanation: '(8+12+10+14) ÷ 4 = 44 ÷ 4 = 11.' }),
  m('LOG', 'ai', 'mcq', 'builder', 5, 'What does an AI "agent" add beyond a chatbot?', { choices: ['It uses tools to take actions', 'It changes colour', 'It is offline', 'Nothing'], answer: 0 }, { explanation: 'An agent uses tools + memory to act toward a goal.' }),
  m('WLD', 'geography', 'mcq', 'builder', 4, 'The imaginary line at 0° latitude is the...', { choices: ['Equator', 'Prime Meridian', 'Tropic', 'Axis'], answer: 0 }, { explanation: 'The Equator is at 0° latitude.' }),
  m('WLD', 'economics', 'type', 'builder', 5, 'Buy at £4, sell at £7, on 10 items. Total profit in £?', { answer: '30', numeric: true }, { explanation: '(7−4) × 10 = £30.' }),
  m('WLD', 'history', 'seq', 'builder', 4, 'Order these eras oldest → newest.', { items: ['Stone Age', 'Ancient Rome', 'Middle Ages', 'Industrial Revolution'] }),
  m('LIF', 'kindness', 'mcq', 'builder', 4, 'A friend spreads a rumour about you. The best first step is to...', { choices: ['Calmly talk to them', 'Spread one back', 'Tell everyone', 'Ignore forever'], answer: 0 }, { explanation: 'Calm, direct communication resolves conflict.' }),
  m('LIF', 'habits', 'mcq', 'builder', 4, 'Which builds a good study habit?', { choices: ['Short focused sessions with breaks', 'One all-nighter', 'Never reviewing', 'Multitasking on a phone'], answer: 0 }),
]

export const STAGE_PACKS: PackItem[] = [...MATHS, ...STARTER, ...BUILDER]
