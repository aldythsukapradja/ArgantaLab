// ============================================================
//  ARGANTALAB · DRILLS
//  Short, repeatable fluency rounds that sit ALONGSIDE the journey.
//  A drill is "simple but infinite": each round is procedurally
//  generated, so a kid can run it again and again and never see the
//  exact same set. Drills build automaticity (times tables, spelling,
//  flags, clock reading) — they do NOT gate journey progression.
//
//  Reward model (per completed round):
//    • base XP + diamonds defined per drill below
//    • full reward at ≥ 60% accuracy, half reward below
//  Per-item XP is also logged to the cloud (telemetry) exactly like a
//  journey item, so drills feed the Family Pulse charts too.
// ============================================================

import type { InteractionKey, Item } from './learn'

// Drills can use the standard interaction renderers PLUS two drill-only
// visual types handled directly by the DrillPlayer.
export type DrillType = InteractionKey | 'clock' | 'flag'

export interface DrillItem extends Omit<Item, 'type'> {
  type: DrillType
}

export interface Drill {
  key: string
  world: string
  skill: string            // a real world skill key → mastery is logged
  title: string
  emoji: string
  blurb: string
  rounds: number           // questions per round
  xp: number               // round-completion XP
  diamonds: number         // round-completion diamonds
  gen: () => DrillItem[]    // fresh, shuffled items every call
}

// ── tiny RNG helpers (no deps) ──────────────────────────────
const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const shuf = <T,>(a: T[]): T[] => { const s = [...a]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[s[i], s[j]] = [s[j], s[i]] } return s }
const pad = (n: number) => String(n).padStart(2, '0')
let _seq = 0
const uid = (k: string) => `drill_${k}_${++_seq}`

// Build an MCQ DrillItem from a correct answer + a pool of distractors.
function mcq(k: string, world: string, skill: string, prompt: string, correct: string, pool: string[], opts: Partial<DrillItem> = {}): DrillItem {
  const distract = shuf(pool.filter(p => p !== correct)).slice(0, 3)
  const choices = shuf([correct, ...distract])
  return { id: uid(k), world, skill, type: 'mcq', stage: 'explorer', difficulty: 2, prompt, payload: { choices, answer: choices.indexOf(correct) }, xp: 4, diamonds: 0, ...opts }
}
function typed(k: string, world: string, skill: string, prompt: string, answer: string, opts: Partial<DrillItem> = {}): DrillItem {
  return { id: uid(k), world, skill, type: 'type', stage: 'explorer', difficulty: 2, prompt, payload: { answer, numeric: /^[\d.:/-]+$/.test(answer) }, xp: 4, diamonds: 0, ...opts }
}

// ════════════════════════════════════════════════════════════
//  NUM · NumberDash
// ════════════════════════════════════════════════════════════
function genTimes(): DrillItem[] {
  return Array.from({ length: 12 }, () => {
    const a = ri(2, 12), b = ri(2, 12)
    return typed('times', 'NUM', 'times', `${a} × ${b} = ?`, String(a * b), { explanation: `${a} × ${b} = ${a * b}.` })
  })
}
function genAddSub(): DrillItem[] {
  return Array.from({ length: 12 }, () => {
    if (Math.random() < 0.5) { const a = ri(2, 50), b = ri(2, 50); return typed('addsub', 'NUM', 'arith', `${a} + ${b} = ?`, String(a + b)) }
    const a = ri(10, 60), b = ri(1, a); return typed('addsub', 'NUM', 'arith', `${a} − ${b} = ?`, String(a - b))
  })
}
const FRACS: [string, number][] = [['1/2', .5], ['1/3', .333], ['1/4', .25], ['1/5', .2], ['2/3', .667], ['3/4', .75], ['2/5', .4], ['1/8', .125], ['3/8', .375], ['5/8', .625]]
function genFractions(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const [f1, v1] = pick(FRACS); let [f2, v2] = pick(FRACS); while (f2 === f1) { [f2, v2] = pick(FRACS) }
    const bigger = v1 > v2 ? f1 : f2
    return mcq('frac', 'NUM', 'fractions', `Which is bigger?`, bigger, [f1, f2], { explanation: `${bigger} is the larger fraction.` })
  })
}
function genBonds(): DrillItem[] {
  return Array.from({ length: 12 }, () => {
    const target = pick([10, 20, 100]); const a = ri(1, target - 1)
    return typed('bonds', 'NUM', 'arith', `${a} + ? = ${target}`, String(target - a), { explanation: `${a} + ${target - a} = ${target}.` })
  })
}
function genPlace(): DrillItem[] {
  const places = [['ones', 1], ['tens', 10], ['hundreds', 100], ['thousands', 1000]] as const
  return Array.from({ length: 10 }, () => {
    const n = ri(1000, 99999); const [name, p] = pick(places as unknown as [string, number][])
    const digit = Math.floor(n / p) % 10
    return typed('place', 'NUM', 'placevalue', `In ${n.toLocaleString()}, which digit is in the ${name} place?`, String(digit), { explanation: `The ${name} digit of ${n} is ${digit}.` })
  })
}
function genClockRead(): DrillItem[] {
  const mins = [0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55]
  return Array.from({ length: 10 }, () => {
    const h = ri(1, 12), m = pick(mins)
    const correct = `${h}:${pad(m)}`
    const distract = shuf([`${h === 12 ? 1 : h + 1}:${pad(m)}`, `${h}:${pad(pick(mins.filter(x => x !== m)))}`, `${h === 1 ? 12 : h - 1}:${pad(m)}`])
    const choices = shuf([correct, ...distract.slice(0, 3)])
    return { id: uid('clock'), world: 'NUM', skill: 'time', type: 'clock', stage: 'explorer', difficulty: 2, prompt: 'What time is it?', payload: { h, m, choices, answer: choices.indexOf(correct) }, xp: 5, diamonds: 0, explanation: `The hands read ${correct}.` }
  })
}

// ════════════════════════════════════════════════════════════
//  WRD · WordQuest
// ════════════════════════════════════════════════════════════
const SYN: [string, string][] = [['big', 'large'], ['happy', 'glad'], ['fast', 'quick'], ['small', 'tiny'], ['begin', 'start'], ['end', 'finish'], ['smart', 'clever'], ['cold', 'chilly'], ['scared', 'afraid'], ['angry', 'mad'], ['pretty', 'lovely'], ['shout', 'yell'], ['jump', 'leap'], ['rich', 'wealthy'], ['easy', 'simple']]
const ANT: [string, string][] = [['hot', 'cold'], ['up', 'down'], ['day', 'night'], ['big', 'small'], ['fast', 'slow'], ['happy', 'sad'], ['open', 'closed'], ['high', 'low'], ['empty', 'full'], ['hard', 'soft'], ['light', 'dark'], ['old', 'new'], ['win', 'lose'], ['push', 'pull']]
const VOCAB: [string, string][] = [['enormous', 'very big'], ['tiny', 'very small'], ['ancient', 'very old'], ['rapid', 'very fast'], ['delicious', 'tastes great'], ['exhausted', 'very tired'], ['brave', 'not afraid'], ['curious', 'wants to know'], ['generous', 'likes to give'], ['fragile', 'breaks easily'], ['enormous', 'huge'], ['gloomy', 'dark and sad'], ['ferocious', 'very fierce'], ['transparent', 'see-through']]
const RHYME: string[][] = [['cat', 'hat', 'bat', 'mat'], ['dog', 'log', 'fog', 'frog'], ['sun', 'fun', 'run', 'bun'], ['cake', 'lake', 'snake', 'bake'], ['light', 'night', 'bright', 'kite'], ['tree', 'bee', 'free', 'sea'], ['star', 'car', 'far', 'jar'], ['blue', 'true', 'glue', 'shoe']]

function genSynonym(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const [w, s] = pick(SYN)
    return mcq('syn', 'WRD', 'vocab', `Which word means the SAME as "${w}"?`, s, SYN.flat(), { explanation: `"${w}" and "${s}" are synonyms.` })
  })
}
function genAntonym(): DrillItem[] {
  // match round: pick 4 antonym pairs
  const pairs = shuf(ANT).slice(0, 4)
  return [{ id: uid('ant'), world: 'WRD', skill: 'vocab', type: 'match', stage: 'explorer', difficulty: 2, prompt: 'Match each word to its OPPOSITE.', payload: { pairs }, xp: 8, diamonds: 0, explanation: 'These are antonyms — opposites.' }]
}
function genVocab(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const [w, d] = pick(VOCAB)
    return mcq('vocab', 'WRD', 'vocab', `Which word means: "${d}"?`, w, VOCAB.map(v => v[0]), { explanation: `"${w}" means ${d}.` })
  })
}
function genRhyme(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const grp = pick(RHYME); const a = pick(grp)
    const yes = Math.random() < 0.5
    let b: string
    if (yes) { b = pick(grp.filter(x => x !== a)) }
    else { const other = pick(RHYME.filter(g => g !== grp)); b = pick(other) }
    return mcq('rhyme', 'WRD', 'phonics', `Do "${a}" and "${b}" rhyme?`, yes ? 'Yes' : 'No', ['Yes', 'No'], { explanation: yes ? `"${a}" and "${b}" both end the same way.` : `"${a}" and "${b}" end differently.` })
  })
}
function genSpell(): DrillItem[] {
  const WORDS = ['because', 'friend', 'beautiful', 'tomorrow', 'school', 'people', 'whisper', 'special', 'enough', 'science', 'favourite', 'different', 'separate', 'February', 'Wednesday', 'necessary']
  const misspell = (w: string) => {
    const v = 'aeiou'.split(''); const i = ri(0, w.length - 1)
    if (v.includes(w[i].toLowerCase())) return w.slice(0, i) + pick(v.filter(x => x !== w[i].toLowerCase())) + w.slice(i + 1)
    return w.slice(0, i) + w.slice(i + 1) // drop a letter
  }
  return Array.from({ length: 10 }, () => {
    const w = pick(WORDS)
    const wrong = new Set<string>(); while (wrong.size < 3) { const m = misspell(w); if (m !== w) wrong.add(m) }
    return mcq('spell', 'WRD', 'writing', 'Which spelling is CORRECT?', w, [w, ...wrong], { explanation: `It is spelled "${w}".` })
  })
}

// ════════════════════════════════════════════════════════════
//  WON · WonderLab
// ════════════════════════════════════════════════════════════
const ANIMALS: [string, string][] = [['Dog', 'Mammal'], ['Cat', 'Mammal'], ['Whale', 'Mammal'], ['Bat', 'Mammal'], ['Snake', 'Reptile'], ['Lizard', 'Reptile'], ['Crocodile', 'Reptile'], ['Eagle', 'Bird'], ['Penguin', 'Bird'], ['Owl', 'Bird'], ['Shark', 'Fish'], ['Salmon', 'Fish'], ['Frog', 'Amphibian'], ['Toad', 'Amphibian']]
function genAnimalSort(): DrillItem[] {
  const classes = shuf(['Mammal', 'Reptile', 'Bird', 'Fish']).slice(0, 3)
  const buckets = classes
  const items = shuf(ANIMALS.filter(a => classes.includes(a[1]))).slice(0, 6)
    .map(a => ({ text: a[0], bucket: buckets.indexOf(a[1]) }))
  return [{ id: uid('animal'), world: 'WON', skill: 'biology', type: 'sort', stage: 'explorer', difficulty: 2, prompt: 'Sort each animal into its group.', payload: { buckets, items }, xp: 8, diamonds: 0, explanation: 'Mammals have fur, reptiles scales, birds feathers, fish fins.' }]
}
const MATTER: [string, string][] = [['Ice', 'Solid'], ['Rock', 'Solid'], ['Wood', 'Solid'], ['Brick', 'Solid'], ['Water', 'Liquid'], ['Milk', 'Liquid'], ['Juice', 'Liquid'], ['Oil', 'Liquid'], ['Steam', 'Gas'], ['Air', 'Gas'], ['Oxygen', 'Gas']]
function genMatter(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const [t, s] = pick(MATTER)
    return mcq('matter', 'WON', 'chemistry', `Is ${t} a solid, liquid, or gas?`, s, ['Solid', 'Liquid', 'Gas'], { explanation: `${t} is a ${s.toLowerCase()}.` })
  })
}
const BODY_FACTS: [string, string, string[]][] = [
  ['Which organ pumps blood?', 'Heart', ['Lungs', 'Brain', 'Liver']],
  ['Which organ helps you breathe?', 'Lungs', ['Heart', 'Stomach', 'Kidney']],
  ['Which organ helps you think?', 'Brain', ['Heart', 'Lungs', 'Bones']],
  ['What protects your body and feels touch?', 'Skin', ['Hair', 'Nails', 'Teeth']],
  ['Which part breaks down the food you eat?', 'Stomach', ['Lungs', 'Brain', 'Ears']],
  ['What gives your body its shape and support?', 'Bones', ['Skin', 'Blood', 'Hair']],
]
function genBody(): DrillItem[] {
  return shuf(BODY_FACTS).map(([q, a, d]) => mcq('body', 'WON', 'biology', q, a, [a, ...d]))
}
const SPACE_FACTS: [string, string, string[]][] = [
  ['Which planet do we live on?', 'Earth', ['Mars', 'Venus', 'Jupiter']],
  ['Which is the closest star to Earth?', 'The Sun', ['The Moon', 'Mars', 'Polaris']],
  ['Which planet is known as the Red Planet?', 'Mars', ['Saturn', 'Neptune', 'Earth']],
  ['Which is the largest planet?', 'Jupiter', ['Earth', 'Mars', 'Mercury']],
  ['What orbits the Earth?', 'The Moon', ['The Sun', 'Mars', 'Jupiter']],
  ['Which planet has bright rings?', 'Saturn', ['Mars', 'Venus', 'Mercury']],
]
function genSpace(): DrillItem[] {
  return shuf(SPACE_FACTS).map(([q, a, d]) => mcq('space', 'WON', 'earth', q, a, [a, ...d]))
}
const CYCLES: [string, string[]][] = [
  ['Butterfly life cycle', ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly']],
  ['Frog life cycle', ['Egg', 'Tadpole', 'Froglet', 'Frog']],
  ['Plant life cycle', ['Seed', 'Sprout', 'Plant', 'Flower']],
  ['Water cycle', ['Sun heats sea', 'Water evaporates', 'Clouds form', 'Rain falls']],
]
function genCycle(): DrillItem[] {
  return shuf(CYCLES).slice(0, 4).map(([name, items]) =>
    ({ id: uid('cycle'), world: 'WON', skill: 'biology', type: 'seq' as DrillType, stage: 'explorer', difficulty: 2, prompt: `Put the ${name} in order.`, payload: { items }, xp: 8, diamonds: 0, explanation: `${name}: ${items.join(' → ')}.` }))
}

// ════════════════════════════════════════════════════════════
//  LOG · LogicLand
// ════════════════════════════════════════════════════════════
function genBinary(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const n = ri(1, 31); const bin = n.toString(2)
    return typed('binary', 'LOG', 'data', `What is binary ${bin} in normal numbers?`, String(n), { explanation: `${bin} (binary) = ${n}.` })
  })
}
function genPattern(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const start = ri(1, 9), step = pick([2, 3, 4, 5, 10])
    const terms = [start, start + step, start + 2 * step, start + 3 * step]
    return typed('pattern', 'LOG', 'logic', `What comes next?  ${terms.join(', ')}, ?`, String(start + 4 * step), { explanation: `Add ${step} each time → ${start + 4 * step}.` })
  })
}
function genBoolean(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const a = Math.random() < 0.5, b = Math.random() < 0.5
    const op = pick(['AND', 'OR'] as const)
    const res = op === 'AND' ? (a && b) : (a || b)
    return mcq('bool', 'LOG', 'logic', `${a ? 'TRUE' : 'FALSE'} ${op} ${b ? 'TRUE' : 'FALSE'} = ?`, res ? 'TRUE' : 'FALSE', ['TRUE', 'FALSE'], { explanation: op === 'AND' ? 'AND is true only when BOTH are true.' : 'OR is true when AT LEAST ONE is true.' })
  })
}
const ALGOS: [string, string[]][] = [
  ['make a cup of tea', ['Boil the water', 'Add the tea bag', 'Pour the water', 'Drink it']],
  ['log into an app', ['Open the app', 'Type your name', 'Type your password', 'Tap Sign in']],
  ['draw a square with code', ['Repeat 4 times', 'Move forward', 'Turn right', 'Stop']],
  ['plant a seed', ['Dig a hole', 'Drop the seed', 'Cover with soil', 'Water it']],
]
function genAlgo(): DrillItem[] {
  return shuf(ALGOS).slice(0, 4).map(([name, items]) =>
    ({ id: uid('algo'), world: 'LOG', skill: 'code', type: 'seq' as DrillType, stage: 'explorer', difficulty: 2, prompt: `Order the steps to ${name}.`, payload: { items }, xp: 8, diamonds: 0, explanation: 'An algorithm is steps in the right order.' }))
}

// ════════════════════════════════════════════════════════════
//  WLD · WorldTrail
// ════════════════════════════════════════════════════════════
const FLAGS: [string, string][] = [['jp', 'Japan'], ['fr', 'France'], ['qa', 'Qatar'], ['eg', 'Egypt'], ['it', 'Italy'], ['de', 'Germany'], ['br', 'Brazil'], ['ca', 'Canada'], ['in', 'India'], ['cn', 'China'], ['au', 'Australia'], ['sa', 'Saudi Arabia'], ['gb', 'United Kingdom'], ['us', 'United States'], ['kr', 'South Korea'], ['id', 'Indonesia'], ['tr', 'Turkey'], ['za', 'South Africa'], ['mx', 'Mexico'], ['ke', 'Kenya'], ['es', 'Spain'], ['ru', 'Russia'], ['ng', 'Nigeria'], ['ar', 'Argentina']]
function genFlags(): DrillItem[] {
  return shuf(FLAGS).slice(0, 10).map(([code, name]) => {
    const distract = shuf(FLAGS.map(f => f[1]).filter(n => n !== name)).slice(0, 3)
    const choices = shuf([name, ...distract])
    return { id: uid('flag'), world: 'WLD', skill: 'geography', type: 'flag', stage: 'explorer', difficulty: 2, prompt: 'Which country has this flag?', payload: { code, choices, answer: choices.indexOf(name) }, xp: 5, diamonds: 0, explanation: `This is the flag of ${name}.` }
  })
}
const CAPITALS: [string, string][] = [['France', 'Paris'], ['Japan', 'Tokyo'], ['Qatar', 'Doha'], ['Egypt', 'Cairo'], ['Italy', 'Rome'], ['Spain', 'Madrid'], ['Germany', 'Berlin'], ['Brazil', 'Brasília'], ['Canada', 'Ottawa'], ['India', 'New Delhi'], ['China', 'Beijing'], ['Australia', 'Canberra'], ['Kenya', 'Nairobi'], ['Mexico', 'Mexico City'], ['Indonesia', 'Jakarta'], ['Turkey', 'Ankara'], ['Saudi Arabia', 'Riyadh'], ['United Kingdom', 'London'], ['Russia', 'Moscow'], ['South Korea', 'Seoul']]
function genCapitals(): DrillItem[] {
  return shuf(CAPITALS).slice(0, 10).map(([country, cap]) =>
    mcq('cap', 'WLD', 'geography', `What is the capital of ${country}?`, cap, CAPITALS.map(c => c[1]), { explanation: `${cap} is the capital of ${country}.` }))
}
const CURRENCY: [string, string][] = [['Japan', 'Yen'], ['United States', 'Dollar'], ['United Kingdom', 'Pound'], ['Qatar', 'Riyal'], ['India', 'Rupee'], ['Russia', 'Ruble'], ['Eurozone', 'Euro'], ['China', 'Yuan'], ['Thailand', 'Baht'], ['South Korea', 'Won'], ['Turkey', 'Lira'], ['Saudi Arabia', 'Riyal']]
function genCurrency(): DrillItem[] {
  return shuf(CURRENCY).slice(0, 10).map(([country, cur]) =>
    mcq('cur', 'WLD', 'economics', `What money is used in ${country}?`, cur, CURRENCY.map(c => c[1]), { explanation: `${country} uses the ${cur}.` }))
}
const LANDMARKS: [string, string, string[]][] = [
  ['The Eiffel Tower is in which country?', 'France', ['Italy', 'Spain', 'Germany']],
  ['The Pyramids of Giza are in...?', 'Egypt', ['India', 'Mexico', 'Iraq']],
  ['The Taj Mahal is in which country?', 'India', ['Pakistan', 'Iran', 'China']],
  ['The Great Wall is in which country?', 'China', ['Japan', 'Korea', 'Mongolia']],
  ['The Statue of Liberty is in...?', 'United States', ['France', 'Canada', 'Brazil']],
  ['Mount Fuji is in which country?', 'Japan', ['China', 'Nepal', 'Korea']],
]
function genLandmarks(): DrillItem[] {
  return shuf(LANDMARKS).map(([q, a, d]) => mcq('land', 'WLD', 'geography', q, a, [a, ...d]))
}

// ════════════════════════════════════════════════════════════
//  LIF · LifeQuest
// ════════════════════════════════════════════════════════════
function genSchedule(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const h = ri(1, 11), m = pick([0, 15, 30, 45]); const dur = pick([15, 20, 30, 45, 60])
    const total = h * 60 + m + dur; const eh = Math.floor(total / 60) % 12 || 12, em = total % 60
    return typed('sched', 'LIF', 'habits', `It is ${h}:${pad(m)}. Your activity lasts ${dur} minutes. What time does it END?`, `${eh}:${pad(em)}`, { explanation: `${h}:${pad(m)} + ${dur} min = ${eh}:${pad(em)}.` })
  })
}
function genMoney(): DrillItem[] {
  return Array.from({ length: 10 }, () => {
    const cost = ri(3, 18), paid = pick([20, 50, 100].filter(x => x > cost))
    return typed('money', 'LIF', 'habits', `A toy costs ${cost} coins. You pay with ${paid}. How much CHANGE?`, String(paid - cost), { explanation: `${paid} − ${cost} = ${paid - cost} coins.` })
  })
}
const EMOTIONS: [string, string, string[]][] = [
  ['Sara dropped her ice cream on the floor. She feels...', 'Sad', ['Happy', 'Excited', 'Proud']],
  ['Ali won first prize in the race. He feels...', 'Proud', ['Scared', 'Angry', 'Bored']],
  ['It is dark and you hear a strange noise. You feel...', 'Scared', ['Happy', 'Proud', 'Bored']],
  ['Your friend broke your favourite toy. You feel...', 'Angry', ['Excited', 'Sleepy', 'Proud']],
  ['Tomorrow is your birthday party. You feel...', 'Excited', ['Sad', 'Angry', 'Bored']],
  ['You finished a hard puzzle all by yourself. You feel...', 'Proud', ['Scared', 'Sad', 'Angry']],
]
function genEmotion(): DrillItem[] {
  return shuf(EMOTIONS).map(([q, a, d]) => mcq('emo', 'LIF', 'kindness', q, a, [a, ...d]))
}
const HEALTHY: [string, string, string[]][] = [
  ['Which is the healthiest snack?', 'An apple', ['Candy bar', 'Soda', 'Chips']],
  ['Which drink is best for your body?', 'Water', ['Cola', 'Energy drink', 'Milkshake']],
  ['What helps your body grow strong?', 'Sleep and exercise', ['Staying up late', 'Only sweets', 'No play']],
  ['How many times a day should you brush your teeth?', 'Twice', ['Never', 'Once a week', 'Only on birthdays']],
  ['Which is good exercise?', 'Running and jumping', ['Sitting all day', 'Watching TV', 'Sleeping']],
  ['Before eating, you should always...', 'Wash your hands', ['Skip it', 'Run around', 'Shout']],
]
function genHealthy(): DrillItem[] {
  return shuf(HEALTHY).map(([q, a, d]) => mcq('health', 'LIF', 'habits', q, a, [a, ...d]))
}
const SAFETY: [string, string, string[]][] = [
  ['A stranger offers you a sweet to follow them. You...', 'Say no and tell an adult', ['Follow them', 'Take it quietly', 'Hide it']],
  ['You smell smoke at home. You should...', 'Tell an adult and leave', ['Hide under the bed', 'Keep playing', 'Open more doors']],
  ['Someone online asks for your home address. You...', 'Never share it', ['Send it right away', 'Post it publicly', 'Tell them your school']],
  ['You get lost in a mall. The safest thing is...', 'Find a guard or staff member', ['Walk outside alone', 'Go with a stranger', 'Sit and cry quietly']],
  ['Crossing the road, you should first...', 'Look both ways', ['Run fast', 'Close your eyes', 'Use your phone']],
]
function genSafety(): DrillItem[] {
  return shuf(SAFETY).map(([q, a, d]) => mcq('safe', 'LIF', 'kindness', q, a, [a, ...d]))
}

// ── extra generators (more variety for Drills + Openworld battles) ──
function genDouble(): DrillItem[] {
  return Array.from({ length: 12 }, () => { const a = ri(3, 50); return typed('double', 'NUM', 'arith', `Double ${a} = ?`, String(a * 2), { explanation: `${a} + ${a} = ${a * 2}.` }) })
}
function genRound(): DrillItem[] {
  return Array.from({ length: 10 }, () => { const a = ri(11, 989); const r = Math.round(a / 10) * 10; return typed('round', 'NUM', 'placevalue', `Round ${a} to the nearest 10`, String(r)) })
}
const HOMO: [string, string, string[]][] = [
  ['Those are ___ shoes. (belonging to them)', 'their', ['their', 'there', "they're"]],
  ['Put the box over ___.', 'there', ['their', 'there', "they're"]],
  ['___ going to win! (they are)', "They're", ['Their', 'There', "They're"]],
  ['I have ___ cats. (the number)', 'two', ['to', 'too', 'two']],
  ['Can I come ___? (also)', 'too', ['to', 'too', 'two']],
  ['We walked ___ school.', 'to', ['to', 'too', 'two']],
  ['___ book is this? (belonging to whom)', 'Whose', ['Whose', "Who's"]],
]
function genHomophone(): DrillItem[] {
  return Array.from({ length: 8 }, () => { const [p, c, pool] = pick(HOMO); return mcq('homo', 'WRD', 'grammar', `Pick the right word: ${p}`, c, pool) })
}
const PREFIX: [string, string][] = [['un- (unhappy)', 'not'], ['re- (redo)', 'again'], ['pre- (preview)', 'before'], ['bi- (bicycle)', 'two'], ['tri- (triangle)', 'three'], ['sub- (submarine)', 'under'], ['multi- (multiple)', 'many'], ['trans- (transport)', 'across']]
function genPrefix(): DrillItem[] {
  const MEAN = ['not', 'again', 'before', 'two', 'three', 'under', 'many', 'across']
  return Array.from({ length: 8 }, () => { const [p, m] = pick(PREFIX); return mcq('prefix', 'WRD', 'vocab', `What does "${p}" mean?`, m, MEAN) })
}
const SCI: [string, string, string[]][] = [
  ['How many legs does an insect have?', '6', ['4', '6', '8', '10']],
  ['Water freezes at… °C', '0', ['0', '10', '32', '100']],
  ['Water boils at… °C', '100', ['0', '50', '100', '200']],
  ['The closest star to Earth is the…', 'Sun', ['Sun', 'Moon', 'Mars', 'Venus']],
  ['Plants give out which gas in daylight?', 'Oxygen', ['Oxygen', 'Smoke', 'Sugar', 'Iron']],
  ['A baby frog is called a…', 'Tadpole', ['Tadpole', 'Puppy', 'Chick', 'Cub']],
  ['Bees make…', 'Honey', ['Honey', 'Milk', 'Silk', 'Web']],
  ['Which is a mammal?', 'Whale', ['Whale', 'Shark', 'Frog', 'Eagle']],
]
function genSci(): DrillItem[] {
  return Array.from({ length: 8 }, () => { const [q, c, pool] = pick(SCI); return mcq('sci', 'WON', 'biology', q, c, pool) })
}
function genSeqNext(): DrillItem[] {
  return Array.from({ length: 8 }, () => { const start = ri(1, 9), step = pick([2, 3, 5, 10]); const seq = [start, start + step, start + 2 * step]; return typed('seqn', 'LOG', 'logic', `What comes next? ${seq.join(', ')}, …`, String(start + 3 * step), { explanation: `Add ${step} each time.` }) })
}
const COUNTRY: [string, string][] = [['Egypt', 'Africa'], ['Kenya', 'Africa'], ['Japan', 'Asia'], ['India', 'Asia'], ['China', 'Asia'], ['Brazil', 'South America'], ['France', 'Europe'], ['Italy', 'Europe'], ['Canada', 'North America'], ['Australia', 'Oceania']]
function genContinent(): DrillItem[] {
  const CONT = ['Africa', 'Asia', 'Europe', 'South America', 'North America', 'Oceania']
  return Array.from({ length: 8 }, () => { const [c, k] = pick(COUNTRY); return mcq('cont', 'WLD', 'geography', `Which continent is ${c} in?`, k, CONT) })
}
const HEALTH: [string, string, string[]][] = [
  ['Which builds strong bones?', 'Milk', ['Milk', 'Soda', 'Candy', 'Chips']],
  ['Best drink to rehydrate after sport?', 'Water', ['Water', 'Soda', 'Coffee', 'Juice']],
  ['Roughly how many hours should kids sleep?', '10', ['4', '6', '10', '14']],
  ['A kind word can make someone feel…', 'Happy', ['Happy', 'Sad', 'Angry', 'Scared']],
  ['Before eating you should…', 'Wash hands', ['Wash hands', 'Run', 'Shout', 'Nap']],
]
function genHealthQ(): DrillItem[] {
  return Array.from({ length: 6 }, () => { const [q, c, pool] = pick(HEALTH); return mcq('hq', 'LIF', 'habits', q, c, pool) })
}

// ════════════════════════════════════════════════════════════
//  CATALOG
// ════════════════════════════════════════════════════════════
export const DRILLS: Drill[] = [
  // NUM
  { key: 'num-times', world: 'NUM', skill: 'times', title: 'Times Table Sprint', emoji: '✖️', blurb: 'Rapid-fire products, 2× to 12×.', rounds: 12, xp: 15, diamonds: 6, gen: genTimes },
  { key: 'num-addsub', world: 'NUM', skill: 'arith', title: 'Add & Subtract Flash', emoji: '➕', blurb: 'Build addition & subtraction fluency.', rounds: 12, xp: 15, diamonds: 6, gen: genAddSub },
  { key: 'num-fractions', world: 'NUM', skill: 'fractions', title: 'Fraction Face-off', emoji: '🍕', blurb: 'Spot the bigger fraction, fast.', rounds: 10, xp: 12, diamonds: 5, gen: genFractions },
  { key: 'num-bonds', world: 'NUM', skill: 'arith', title: 'Number Bonds', emoji: '🔟', blurb: 'Find the pair that completes 10, 20, 100.', rounds: 12, xp: 12, diamonds: 5, gen: genBonds },
  { key: 'num-place', world: 'NUM', skill: 'placevalue', title: 'Place Value', emoji: '🔢', blurb: 'Ones, tens, hundreds, thousands.', rounds: 10, xp: 12, diamonds: 5, gen: genPlace },
  { key: 'num-clock', world: 'NUM', skill: 'time', title: 'Clock Reading', emoji: '🕐', blurb: 'Read the analog clock face.', rounds: 10, xp: 15, diamonds: 7, gen: genClockRead },
  // WRD
  { key: 'wrd-spell', world: 'WRD', skill: 'writing', title: 'Spelling Bee', emoji: '🐝', blurb: 'Pick the correctly-spelled word.', rounds: 10, xp: 15, diamonds: 6, gen: genSpell },
  { key: 'wrd-synonym', world: 'WRD', skill: 'vocab', title: 'Synonym Sprint', emoji: '🟰', blurb: 'Words that mean the same.', rounds: 10, xp: 12, diamonds: 5, gen: genSynonym },
  { key: 'wrd-antonym', world: 'WRD', skill: 'vocab', title: 'Antonym Pairs', emoji: '↔️', blurb: 'Match each word to its opposite.', rounds: 4, xp: 12, diamonds: 5, gen: genAntonym },
  { key: 'wrd-vocab', world: 'WRD', skill: 'vocab', title: 'Vocab Builder', emoji: '📚', blurb: 'Match the meaning to the word.', rounds: 10, xp: 12, diamonds: 5, gen: genVocab },
  { key: 'wrd-rhyme', world: 'WRD', skill: 'phonics', title: 'Rhyme Time', emoji: '🎵', blurb: 'Do these two words rhyme?', rounds: 10, xp: 10, diamonds: 4, gen: genRhyme },
  // WON
  { key: 'won-animal', world: 'WON', skill: 'biology', title: 'Animal Sort', emoji: '🐾', blurb: 'Mammal, reptile, bird or fish?', rounds: 1, xp: 12, diamonds: 5, gen: genAnimalSort },
  { key: 'won-matter', world: 'WON', skill: 'chemistry', title: 'States of Matter', emoji: '💧', blurb: 'Solid, liquid or gas?', rounds: 10, xp: 12, diamonds: 5, gen: genMatter },
  { key: 'won-body', world: 'WON', skill: 'biology', title: 'Body Parts', emoji: '🫀', blurb: 'What each organ does.', rounds: 6, xp: 12, diamonds: 5, gen: genBody },
  { key: 'won-space', world: 'WON', skill: 'earth', title: 'Space Facts', emoji: '🪐', blurb: 'Planets, the Sun and the Moon.', rounds: 6, xp: 12, diamonds: 5, gen: genSpace },
  { key: 'won-cycle', world: 'WON', skill: 'biology', title: 'Life Cycles', emoji: '🦋', blurb: 'Order nature in the right steps.', rounds: 4, xp: 14, diamonds: 6, gen: genCycle },
  // LOG
  { key: 'log-binary', world: 'LOG', skill: 'data', title: 'Binary Decoder', emoji: '💾', blurb: 'Turn binary into normal numbers.', rounds: 10, xp: 15, diamonds: 7, gen: genBinary },
  { key: 'log-pattern', world: 'LOG', skill: 'logic', title: 'Pattern Sequences', emoji: '🔮', blurb: 'What comes next in the series?', rounds: 10, xp: 12, diamonds: 5, gen: genPattern },
  { key: 'log-boolean', world: 'LOG', skill: 'logic', title: 'Boolean Gates', emoji: '🚪', blurb: 'AND / OR true-or-false logic.', rounds: 10, xp: 14, diamonds: 6, gen: genBoolean },
  { key: 'log-algo', world: 'LOG', skill: 'code', title: 'Algorithm Sort', emoji: '🧭', blurb: 'Put the steps in the right order.', rounds: 4, xp: 14, diamonds: 6, gen: genAlgo },
  // WLD
  { key: 'wld-flags', world: 'WLD', skill: 'geography', title: 'Flag Flash', emoji: '🚩', blurb: 'Name the country from its flag.', rounds: 10, xp: 15, diamonds: 7, gen: genFlags },
  { key: 'wld-capitals', world: 'WLD', skill: 'geography', title: 'Capital Cities', emoji: '🏙️', blurb: 'Match country to its capital.', rounds: 10, xp: 12, diamonds: 5, gen: genCapitals },
  { key: 'wld-currency', world: 'WLD', skill: 'economics', title: 'Currency Match', emoji: '💱', blurb: 'What money each country uses.', rounds: 10, xp: 12, diamonds: 5, gen: genCurrency },
  { key: 'wld-landmark', world: 'WLD', skill: 'geography', title: 'Famous Landmarks', emoji: '🗽', blurb: 'Where in the world is it?', rounds: 6, xp: 12, diamonds: 5, gen: genLandmarks },
  // LIF
  { key: 'lif-clock', world: 'LIF', skill: 'habits', title: 'Clock Scheduling', emoji: '⏰', blurb: 'Work out when activities end.', rounds: 10, xp: 15, diamonds: 7, gen: genSchedule },
  { key: 'lif-money', world: 'LIF', skill: 'habits', title: 'Money & Change', emoji: '🪙', blurb: 'Real-life shopping maths.', rounds: 10, xp: 14, diamonds: 6, gen: genMoney },
  { key: 'lif-emotion', world: 'LIF', skill: 'kindness', title: 'Emotion Match', emoji: '😊', blurb: 'Name how someone feels.', rounds: 6, xp: 12, diamonds: 5, gen: genEmotion },
  { key: 'lif-healthy', world: 'LIF', skill: 'habits', title: 'Healthy Choices', emoji: '🥗', blurb: 'Pick the healthier option.', rounds: 6, xp: 12, diamonds: 5, gen: genHealthy },
  { key: 'lif-safety', world: 'LIF', skill: 'kindness', title: 'Safety Scenarios', emoji: '🦺', blurb: 'Stay safe — what would you do?', rounds: 5, xp: 14, diamonds: 6, gen: genSafety },
  // — extra variety —
  { key: 'num-double', world: 'NUM', skill: 'arith', title: 'Doubling Dash', emoji: '✌️', blurb: 'Double it, fast.', rounds: 12, xp: 12, diamonds: 5, gen: genDouble },
  { key: 'num-round', world: 'NUM', skill: 'placevalue', title: 'Rounding Rush', emoji: '🎯', blurb: 'Round to the nearest 10.', rounds: 10, xp: 12, diamonds: 5, gen: genRound },
  { key: 'wrd-homophone', world: 'WRD', skill: 'grammar', title: 'Homophone Hunt', emoji: '👂', blurb: 'there / their / they’re & more.', rounds: 8, xp: 14, diamonds: 6, gen: genHomophone },
  { key: 'wrd-prefix', world: 'WRD', skill: 'vocab', title: 'Prefix Power', emoji: '🔤', blurb: 'What word-beginnings mean.', rounds: 8, xp: 12, diamonds: 5, gen: genPrefix },
  { key: 'won-facts', world: 'WON', skill: 'biology', title: 'Science Snap', emoji: '🔬', blurb: 'Quick-fire science facts.', rounds: 8, xp: 12, diamonds: 5, gen: genSci },
  { key: 'log-seqnext', world: 'LOG', skill: 'logic', title: 'Number Patterns', emoji: '➿', blurb: 'What number comes next?', rounds: 8, xp: 12, diamonds: 5, gen: genSeqNext },
  { key: 'wld-continent', world: 'WLD', skill: 'geography', title: 'Continent Quest', emoji: '🌍', blurb: 'Which continent is it in?', rounds: 8, xp: 12, diamonds: 5, gen: genContinent },
  { key: 'lif-health', world: 'LIF', skill: 'habits', title: 'Healthy Habits', emoji: '💪', blurb: 'Smart everyday choices.', rounds: 6, xp: 12, diamonds: 5, gen: genHealthQ },
]

export const DRILLS_BY_WORLD: Record<string, Drill[]> = DRILLS.reduce((m, d) => {
  (m[d.world] ??= []).push(d); return m
}, {} as Record<string, Drill[]>)
