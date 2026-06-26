// ============================================================
//  ARGANTALAB · LEARN CONTENT MODEL + LOCAL PACK
//  This is the offline source of truth AND the fallback when the
//  Supabase content tables aren't seeded yet. Cloud content (edited
//  in the Admin Content Studio) overrides this at runtime.
// ============================================================

import { EXPLORER_PACK } from './explorerContent'
import { STAGE_PACKS } from './stagePacks'
import { CONTENT_PACK_2 } from './contentPack2'
import { CONTENT_PACK_3 } from './contentPack3'
import { CONTENT_PACK_4 } from './contentPack4'
import { CONTENT_PACK_5 } from './contentPack5'
import { CONTENT_PACK_6 } from './contentPack6'
import { CONTENT_PACK_7 } from './contentPack7'
import { CONTENT_PACK_8 } from './contentPack8'
import { CONTENT_PACK_9 } from './contentPack9'
import { CONTENT_PACK_10 } from './contentPack10'
import { CONTENT_PACK_11 } from './contentPack11'
import { CONTENT_PACK_12 } from './contentPack12'
import { CONTENT_PACK_13 } from './contentPack13'
import { CONTENT_PACK_14 } from './contentPack14'

export type InteractionKey =
  | 'mcq' | 'multi' | 'type' | 'speed' | 'bank' | 'cloze'
  | 'match' | 'sort' | 'seq' | 'fix' | 'numline' | 'slider'
  | 'listen' | 'label' | 'pte' | 'code' | 'map' | 'party'

export interface Item {
  id: string
  world: string                 // 'NUM' | 'WRD' | ...
  skill: string                 // skill key within the world
  type: InteractionKey
  stage: string                 // 'explorer'
  difficulty: number            // 1..5
  prompt: string
  payload: Record<string, unknown>
  hint?: string
  explanation?: string
  xp?: number
  diamonds?: number
}

export interface Skill { key: string; label: string; band: number }
export interface JourneyNode {
  key: string
  title: string
  type: 'lesson' | 'practice' | 'boss' | 'chest'
  skills: string[]
  itemCount: number
  rewardDiamonds: number
}
export interface JourneyUnit { key: string; title: string; color: string; nodes: JourneyNode[] }
export interface Badge { key: string; name: string; icon: string; rule: { type: string; skill?: string; pct?: number } }

export interface World {
  key: string
  name: string
  color: string
  icon: string
  signature: string             // signature spine-tab label
  vibe: string
  status: 'live' | 'soon'
  skills: Skill[]
  units: JourneyUnit[]
  badges: Badge[]
}

export interface Stage { key: string; label: string; minAge: number; maxAge: number }

export const STAGES: Stage[] = [
  { key: 'tiny', label: 'Tiny', minAge: 1, maxAge: 6 },
  { key: 'starter', label: 'Starter', minAge: 6, maxAge: 8 },
  { key: 'explorer', label: 'Explorer', minAge: 8, maxAge: 11 },
  { key: 'builder', label: 'Builder', minAge: 11, maxAge: 14 },
  { key: 'champion', label: 'Champion', minAge: 14, maxAge: 16 },
  { key: 'legend', label: 'Legend', minAge: 16, maxAge: 19 },
]

// Each stage gets a glyph + colour for badges/pills across the app.
export const STAGE_META: Record<string, { emoji: string; color: string }> = {
  tiny: { emoji: '🐣', color: '#f59e0b' },
  starter: { emoji: '🌱', color: '#10b981' },
  explorer: { emoji: '🧭', color: '#6366f1' },
  builder: { emoji: '🛠️', color: '#0ea5e9' },
  champion: { emoji: '🏆', color: '#f97316' },
  legend: { emoji: '⭐', color: '#a855f7' },
}

// Age from an ISO date-of-birth string ('YYYY-MM-DD').
export function ageFromDob(dob: string | undefined): number {
  if (!dob) return 0
  const d = new Date(dob)
  if (isNaN(+d)) return 0
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return Math.max(0, a)
}

// Auto-classify a learner into a stage by age (the band [minAge, maxAge)).
export function stageForAge(age: number): Stage {
  const hit = STAGES.find(s => age >= s.minAge && age < s.maxAge)
  if (hit) return hit
  return age < STAGES[0].minAge ? STAGES[0] : STAGES[STAGES.length - 1]
}
export function stageForDob(dob: string | undefined): Stage {
  return stageForAge(ageFromDob(dob))
}

// Interaction-type registry — documents each payload shape for the Admin UI + LLM prompt.
export interface InteractionMeta {
  key: InteractionKey
  name: string
  emoji: string
  desc: string
  payloadHint: string           // human-readable JSON shape
  apps: string[]
}
export const INTERACTIONS: InteractionMeta[] = [
  { key: 'mcq', name: 'Multiple choice', emoji: '☑️', desc: 'Pick the one correct option.', payloadHint: '{ "choices": ["a","b","c","d"], "answer": 0 }', apps: ['NUM','WRD','WON','LOG','WLD'] },
  { key: 'multi', name: 'Multi-select', emoji: '✅', desc: 'Choose all that apply.', payloadHint: '{ "choices": [...], "answers": [0,2] }', apps: ['NUM','WON','LOG'] },
  { key: 'type', name: 'Type answer', emoji: '⌨️', desc: 'Free text / numeric entry.', payloadHint: '{ "answer": "56", "numeric": true, "accept": ["56"] }', apps: ['NUM','WRD','LOG'] },
  { key: 'speed', name: 'Speed recall', emoji: '⚡', desc: 'Rapid-fire vs a clock (TTRS).', payloadHint: '{ "questions": [{"q":"7×8","a":"56"}], "seconds": 60 }', apps: ['NUM','WRD'] },
  { key: 'bank', name: 'Word bank', emoji: '🧩', desc: 'Build a sentence from tiles.', payloadHint: '{ "tiles": ["The","cat","sat"], "answer": ["The","cat","sat"] }', apps: ['WRD','LOG'] },
  { key: 'cloze', name: 'Fill blank', emoji: '␣', desc: 'Pick the missing word.', payloadHint: '{ "before": "She ", "after": " to school.", "options": ["walk","walks"], "answer": "walks" }', apps: ['WRD','NUM','LOG'] },
  { key: 'match', name: 'Match pairs', emoji: '🔗', desc: 'Connect two columns.', payloadHint: '{ "pairs": [["½","0.5"],["¼","0.25"]] }', apps: ['NUM','WRD','WON','WLD'] },
  { key: 'sort', name: 'Sort / categorize', emoji: '🗂️', desc: 'Drag items into buckets.', payloadHint: '{ "buckets": ["Mammal","Reptile"], "items": [{"text":"Dog","bucket":0}] }', apps: ['WON','WRD','WLD'] },
  { key: 'seq', name: 'Sequence order', emoji: '🔢', desc: 'Arrange in the correct order.', payloadHint: '{ "items": ["First","Then","Last"] }  (already in correct order)', apps: ['WLD','WON','WRD'] },
  { key: 'fix', name: 'Tap to fix', emoji: '🔍', desc: 'Tap the wrong word in a line.', payloadHint: '{ "tokens": ["i","like","cats"], "wrong": 0, "fix": "I" }', apps: ['WRD','LOG'] },
  { key: 'numline', name: 'Number line', emoji: '📏', desc: 'Drag a marker on a line.', payloadHint: '{ "min": 0, "max": 1, "answer": 0.75, "tol": 0.05, "label": "3/4" }', apps: ['NUM','WON'] },
  { key: 'slider', name: 'Slider estimate', emoji: '🎚️', desc: 'Estimate with a slider.', payloadHint: '{ "min": 0, "max": 200, "answer": 100, "tol": 10, "unit": "°C" }', apps: ['WON','WLD','NUM'] },
  { key: 'listen', name: 'Listen & choose', emoji: '🔊', desc: 'Hear a sound, pick the match.', payloadHint: '{ "say": "buh", "choices": ["b","d","p"], "answer": 0 }', apps: ['WRD'] },
  { key: 'label', name: 'Label diagram', emoji: '🏷️', desc: 'Match labels to parts.', payloadHint: '{ "scene": "🌱", "pairs": [["Top","Leaf"],["Bottom","Root"]] }', apps: ['WON','WLD'] },
  { key: 'pte', name: 'Predict → Test → Explain', emoji: '🧪', desc: 'Guess, run a sim, explain why.', payloadHint: '{ "predict": {"prompt":"...","choices":[],"answer":0}, "sim":"🧊→💧", "explain": {"prompt":"...","choices":[],"answer":0} }', apps: ['WON'] },
  { key: 'code', name: 'Code blocks', emoji: '</>', desc: 'Order code blocks to solve.', payloadHint: '{ "tiles": ["move()","turn()"], "answer": ["move()","turn()"] }', apps: ['LOG'] },
  { key: 'map', name: 'Map find', emoji: '🗺️', desc: 'Find a place (choice for now).', payloadHint: '{ "choices": ["Qatar","Oman"], "answer": 0 }', apps: ['WLD'] },
  { key: 'party', name: 'Party / quest', emoji: '🎉', desc: 'Pass-device or real-world task.', payloadHint: '{ "task": "Tidy your desk", "quest": true }  OR  { "prompt":"Guess!", "reveal":"🐱" }', apps: ['LIF'] },
]

// ────────────────────────────────────────────────────────────
//  Item authoring shorthand
// ────────────────────────────────────────────────────────────
let _n = 0
function it(world: string, skill: string, type: InteractionKey, prompt: string, payload: Record<string, unknown>, extra: Partial<Item> = {}): Item {
  return { id: `${world.toLowerCase()}_${++_n}`, world, skill, type, stage: 'explorer', difficulty: extra.difficulty ?? 2, prompt, payload, xp: 10, diamonds: 0, ...extra }
}

// ============================================================
//  WORLD 1 · NumberDash (NUM) — arcade math racing
// ============================================================
const NUM_ITEMS: Item[] = [
  it('NUM', 'times', 'speed', 'Times-table sprint!', { questions: [{ q: '2 × 6', a: '12' }, { q: '5 × 5', a: '25' }, { q: '10 × 4', a: '40' }, { q: '3 × 7', a: '21' }, { q: '4 × 8', a: '32' }], seconds: 45 }, { explanation: 'Quick recall builds your number muscles!' }),
  it('NUM', 'times', 'mcq', 'What is 7 × 8?', { choices: ['54', '56', '64', '49'], answer: 1 }, { explanation: '7 × 8 = 56.' }),
  it('NUM', 'times', 'type', '6 × 9 = ?', { answer: '54', numeric: true }, { explanation: '6 × 9 = 54.' }),
  it('NUM', 'times', 'cloze', 'Complete the fact.', { before: '8 × ', after: ' = 24', options: ['2', '3', '4'], answer: '3' }, { explanation: '8 × 3 = 24.' }),
  it('NUM', 'fractions', 'mcq', 'Which fraction is bigger?', { choices: ['1/2', '1/4', '1/8', 'They are equal'], answer: 0 }, { explanation: 'Halves are bigger than quarters or eighths.' }),
  it('NUM', 'fractions', 'numline', 'Drag the marker to 3/4.', { min: 0, max: 1, answer: 0.75, tol: 0.06, label: '3/4' }, { explanation: '3/4 sits three-quarters of the way along.' }),
  it('NUM', 'fractions', 'match', 'Match the fraction to the decimal.', { pairs: [['1/2', '0.5'], ['1/4', '0.25'], ['3/4', '0.75']] }, { explanation: 'Fractions and decimals are two ways to write the same amount.' }),
  it('NUM', 'fractions', 'sort', 'Sort: bigger or smaller than 1/2?', { buckets: ['Smaller than 1/2', 'Bigger than 1/2'], items: [{ text: '1/4', bucket: 0 }, { text: '3/4', bucket: 1 }, { text: '1/8', bucket: 0 }, { text: '2/3', bucket: 1 }] }, { explanation: 'Compare each to one half.' }),
  it('NUM', 'fractions', 'type', 'Half of 18 is...?', { answer: '9', numeric: true }, { explanation: '18 ÷ 2 = 9.' }),
  it('NUM', 'times', 'mcq', 'Boss: 9 × 6 = ?', { choices: ['54', '56', '45', '63'], answer: 0 }, { difficulty: 3, explanation: '9 × 6 = 54.' }),
  it('NUM', 'fractions', 'numline', 'Boss: place 1/3 on the line.', { min: 0, max: 1, answer: 0.333, tol: 0.07, label: '1/3' }, { difficulty: 3, explanation: 'One third is a bit past the start.' }),
  it('NUM', 'times', 'speed', 'Boss sprint — beat the clock!', { questions: [{ q: '6 × 7', a: '42' }, { q: '8 × 8', a: '64' }, { q: '9 × 4', a: '36' }, { q: '7 × 7', a: '49' }], seconds: 40 }, { difficulty: 3 }),
]
const NUM: World = {
  key: 'NUM', name: 'NumberDash', color: '#f59e0b', icon: '#', signature: 'Drill', vibe: 'Arcade math racing', status: 'live',
  skills: [
    { key: 'placevalue', label: 'Place value', band: 1 },
    { key: 'arith', label: 'Add & subtract', band: 1 },
    { key: 'times', label: 'Times tables', band: 2 },
    { key: 'fractions', label: 'Fractions', band: 3 },
    { key: 'money', label: 'Money', band: 2 },
    { key: 'measure', label: 'Measurement', band: 2 },
    { key: 'time', label: 'Telling time', band: 2 },
    { key: 'geometry', label: 'Shapes & geometry', band: 2 },
  ],
  units: [
    {
      key: 'num-foundations', title: 'Number Foundations', color: '#f59e0b', nodes: [
        { key: 'n1', title: 'Place Value', type: 'lesson', skills: ['placevalue'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'n2', title: 'Add & Subtract', type: 'practice', skills: ['arith'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'n3', title: 'Times Tables', type: 'practice', skills: ['times'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'n4', title: 'Number Chest', type: 'chest', skills: ['placevalue', 'arith', 'times'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'num-world', title: 'Maths in the World', color: '#f59e0b', nodes: [
        { key: 'n5', title: 'Fractions', type: 'practice', skills: ['fractions'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'n6', title: 'Money', type: 'practice', skills: ['money'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'n7', title: 'Measure & Time', type: 'practice', skills: ['measure', 'time'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'n8', title: 'Shapes', type: 'practice', skills: ['geometry'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'n9', title: 'Number Boss', type: 'boss', skills: ['times', 'fractions', 'money', 'geometry'], itemCount: 6, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'times-titan', name: 'Times-Table Titan', icon: '✖️', rule: { type: 'skill_mastery', skill: 'times', pct: 80 } },
    { key: 'fraction-hero', name: 'Fraction Hero', icon: '🍕', rule: { type: 'skill_mastery', skill: 'fractions', pct: 80 } },
    { key: 'shape-shifter', name: 'Shape Shifter', icon: '🔷', rule: { type: 'skill_mastery', skill: 'geometry', pct: 80 } },
    { key: 'dash-champ', name: 'Dash Champion', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

// ============================================================
//  WORLD 2 · WordQuest (WRD) — storybook adventure
// ============================================================
const WRD_ITEMS: Item[] = [
  it('WRD', 'grammar', 'fix', 'Tap the word that is wrong.', { tokens: ['i', 'love', 'reading'], wrong: 0, fix: 'I' }, { explanation: '"I" is always a capital letter.' }),
  it('WRD', 'grammar', 'cloze', 'Choose the right word.', { before: 'She ', after: ' to the park every day.', options: ['walk', 'walks', 'walking'], answer: 'walks' }, { explanation: 'He/she/it takes a verb ending in -s.' }),
  it('WRD', 'grammar', 'mcq', 'Which sentence is correct?', { choices: ['The dogs is barking.', 'The dogs are barking.', 'The dogs am barking.', 'The dogs be barking.'], answer: 1 }, { explanation: 'Plural "dogs" needs "are".' }),
  it('WRD', 'writing', 'bank', 'Build a sentence.', { tiles: ['The', 'sun', 'is', 'bright'], answer: ['The', 'sun', 'is', 'bright'] }, { explanation: 'A sentence starts with a capital and makes sense.' }),
  it('WRD', 'writing', 'seq', 'Put the story in order.', { items: ['First, she woke up.', 'Then, she ate breakfast.', 'Finally, she went to school.'] }, { explanation: 'First → Then → Finally.' }),
  it('WRD', 'vocab', 'match', 'Match the word to its meaning.', { pairs: [['happy', 'glad'], ['big', 'large'], ['fast', 'quick']] }, { explanation: 'These are synonyms — words that mean the same.' }),
  it('WRD', 'vocab', 'mcq', 'What does "enormous" mean?', { choices: ['tiny', 'very big', 'fast', 'happy'], answer: 1 }, { explanation: 'Enormous = very big.' }),
  it('WRD', 'phonics', 'listen', 'Which letter makes this sound?', { say: 'sss', choices: ['s', 'z', 'f'], answer: 0 }, { explanation: 'The /s/ sound is the letter s.' }),
  it('WRD', 'phonics', 'cloze', 'Finish the word: ca__', { before: 'ca', after: '', options: ['t', 'p', 'r'], answer: 't' }, { explanation: 'c-a-t spells cat.' }),
  it('WRD', 'grammar', 'fix', 'Boss: tap the mistake.', { tokens: ['we', 'goed', 'home'], wrong: 1, fix: 'went' }, { difficulty: 3, explanation: 'The past tense of "go" is "went".' }),
  it('WRD', 'vocab', 'match', 'Boss: match opposites.', { pairs: [['hot', 'cold'], ['up', 'down'], ['day', 'night']] }, { difficulty: 3, explanation: 'These are antonyms — opposites.' }),
  it('WRD', 'writing', 'bank', 'Boss: build the sentence.', { tiles: ['My', 'best', 'friend', 'is', 'kind'], answer: ['My', 'best', 'friend', 'is', 'kind'] }, { difficulty: 3 }),
]
const WRD: World = {
  key: 'WRD', name: 'WordQuest', color: '#3b82f6', icon: 'A', signature: 'Drill', vibe: 'Storybook adventure', status: 'live',
  skills: [{ key: 'phonics', label: 'Phonics', band: 1 }, { key: 'grammar', label: 'Grammar', band: 2 }, { key: 'vocab', label: 'Vocabulary', band: 2 }, { key: 'reading', label: 'Reading comprehension', band: 3 }, { key: 'writing', label: 'Writing', band: 3 }],
  units: [
    {
      key: 'wrd-sounds', title: 'Sounds & Words', color: '#3b82f6', nodes: [
        { key: 'w1', title: 'Phonics', type: 'lesson', skills: ['phonics'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'w2', title: 'Vocabulary', type: 'practice', skills: ['vocab'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'w3', title: 'Word Chest', type: 'chest', skills: ['phonics', 'vocab'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'wrd-write', title: 'Grammar & Writing', color: '#3b82f6', nodes: [
        { key: 'w4', title: 'Grammar', type: 'practice', skills: ['grammar'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'wr', title: 'Reading', type: 'practice', skills: ['reading'], itemCount: 5, rewardDiamonds: 6 },
        { key: 'w5', title: 'Writing', type: 'practice', skills: ['writing'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'w6', title: 'Word Boss', type: 'boss', skills: ['grammar', 'reading', 'writing'], itemCount: 6, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'grammar-guard', name: 'Grammar Guardian', icon: '🛡️', rule: { type: 'skill_mastery', skill: 'grammar', pct: 80 } },
    { key: 'word-wizard', name: 'Word Wizard', icon: '📖', rule: { type: 'skill_mastery', skill: 'vocab', pct: 80 } },
    { key: 'quest-champ', name: 'Quest Champion', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

// ============================================================
//  WORLD 3 · WonderLab (WON) — lab experiments
// ============================================================
const WON_ITEMS: Item[] = [
  it('WON', 'biology', 'label', 'Label the plant.', { scene: '🌳', pairs: [['Top', 'Leaves'], ['Middle', 'Trunk'], ['Bottom', 'Roots']] }, { explanation: 'Roots drink water, leaves catch sunlight.' }),
  it('WON', 'biology', 'sort', 'Sort the living things.', { buckets: ['Mammal', 'Reptile'], items: [{ text: 'Dog', bucket: 0 }, { text: 'Snake', bucket: 1 }, { text: 'Cat', bucket: 0 }, { text: 'Lizard', bucket: 1 }] }, { explanation: 'Mammals have fur; reptiles have scales.' }),
  it('WON', 'biology', 'mcq', 'What do plants need to make food?', { choices: ['Sunlight', 'Darkness', 'Sugar', 'Plastic'], answer: 0 }, { explanation: 'Plants use sunlight in photosynthesis.' }),
  it('WON', 'physics', 'pte', 'A ball rolls down a steep ramp.', { predict: { prompt: 'Predict: how fast will it go?', choices: ['Slow', 'Fast'], answer: 1 }, sim: '🏐⬇️ steep ramp = more speed', explain: { prompt: 'Why?', choices: ['Steeper ramps add more speed', 'Ramps slow things down'], answer: 0 } }, { explanation: 'Steeper slope → more gravity pull → faster.' }),
  it('WON', 'physics', 'slider', 'At what temperature does water boil?', { min: 0, max: 200, answer: 100, tol: 10, unit: '°C' }, { explanation: 'Water boils at 100°C.' }),
  it('WON', 'chemistry', 'seq', 'Order the states as it heats up.', { items: ['Ice (solid)', 'Water (liquid)', 'Steam (gas)'] }, { explanation: 'Heat turns solid → liquid → gas.' }),
  it('WON', 'chemistry', 'mcq', 'Which is a gas?', { choices: ['Ice', 'Steam', 'Rock', 'Wood'], answer: 1 }, { explanation: 'Steam is water as a gas.' }),
  it('WON', 'earth', 'seq', 'Order the water cycle.', { items: ['Sun heats the sea', 'Water rises as vapour', 'Clouds form', 'Rain falls'] }, { explanation: 'Evaporate → condense → precipitate.' }),
  it('WON', 'earth', 'mcq', 'Which planet do we live on?', { choices: ['Mars', 'Earth', 'Jupiter', 'Venus'], answer: 1 }, { explanation: 'We live on Earth.' }),
  it('WON', 'biology', 'mcq', 'Boss: what helps you breathe?', { choices: ['Lungs', 'Bones', 'Hair', 'Nails'], answer: 0 }, { difficulty: 3, explanation: 'Lungs take in oxygen.' }),
  it('WON', 'physics', 'slider', 'Boss: how many legs does an insect have?', { min: 0, max: 12, answer: 6, tol: 0, unit: ' legs' }, { difficulty: 3, explanation: 'All insects have 6 legs.' }),
  it('WON', 'chemistry', 'pte', 'Boss: you mix salt into warm water.', { predict: { prompt: 'Predict: what happens to the salt?', choices: ['It vanishes (dissolves)', 'It floats on top'], answer: 0 }, sim: '🧂 + 💧 = dissolves', explain: { prompt: 'Why?', choices: ['It dissolves into the water', 'It turns into gas'], answer: 0 } }, { difficulty: 3, explanation: 'Salt dissolves — it spreads through the water.' }),
]
const WON: World = {
  key: 'WON', name: 'WonderLab', color: '#10b981', icon: '⚗', signature: 'Lab', vibe: 'Lab experiments', status: 'live',
  skills: [{ key: 'biology', label: 'Biology', band: 2 }, { key: 'chemistry', label: 'Chemistry', band: 2 }, { key: 'physics', label: 'Physics', band: 3 }, { key: 'earth', label: 'Earth & Space', band: 2 }],
  units: [
    {
      key: 'won-life', title: 'The Living World', color: '#10b981', nodes: [
        { key: 'wo1', title: 'Biology', type: 'lesson', skills: ['biology'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'wo2', title: 'Earth & Space', type: 'practice', skills: ['earth'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'wo3', title: 'Nature Chest', type: 'chest', skills: ['biology', 'earth'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'won-matter', title: 'Matter & Forces', color: '#10b981', nodes: [
        { key: 'wo4', title: 'Chemistry', type: 'practice', skills: ['chemistry'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'wo5', title: 'Physics', type: 'practice', skills: ['physics'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'wo6', title: 'Lab Boss', type: 'boss', skills: ['biology', 'physics', 'chemistry'], itemCount: 6, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'bio-brain', name: 'Bio Brainiac', icon: '🧬', rule: { type: 'skill_mastery', skill: 'biology', pct: 80 } },
    { key: 'lab-explorer', name: 'Lab Explorer', icon: '🔬', rule: { type: 'skill_mastery', skill: 'physics', pct: 80 } },
    { key: 'lab-champ', name: 'Lab Champion', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

// ============================================================
//  WORLD 4 · LogicLand (LOG) — puzzle island (Code/Data/AI)
// ============================================================
const LOG_ITEMS: Item[] = [
  it('LOG', 'code', 'code', 'Order the blocks to move the robot to the flag.', { tiles: ['moveForward()', 'turnRight()', 'moveForward()'], answer: ['moveForward()', 'turnRight()', 'moveForward()'] }, { explanation: 'Code runs top to bottom, one step at a time.' }),
  it('LOG', 'code', 'mcq', 'What does HTML build?', { choices: ['The page structure', 'The music', 'The smell', 'The weather'], answer: 0 }, { explanation: 'HTML is the skeleton of a web page.' }),
  it('LOG', 'code', 'match', 'Match the web part to its job.', { pairs: [['HTML', 'Structure'], ['CSS', 'Style'], ['JS', 'Action']] }, { explanation: 'HTML = bones, CSS = costume, JS = brain.' }),
  it('LOG', 'data', 'mcq', 'A bar chart is best for...?', { choices: ['Comparing amounts', 'Telling time', 'Drawing faces', 'Playing music'], answer: 0 }, { explanation: 'Bars compare values side by side.' }),
  it('LOG', 'data', 'sort', 'Sort: which is data?', { buckets: ['Data', 'Not data'], items: [{ text: 'Your score: 80', bucket: 0 }, { text: 'A funny joke', bucket: 1 }, { text: 'Number of plays', bucket: 0 }] }, { explanation: 'Data is facts you can count or measure.' }),
  it('LOG', 'ai', 'bank', 'Build a clear AI prompt.', { tiles: ['Make', 'a', 'racing', 'game'], answer: ['Make', 'a', 'racing', 'game'] }, { explanation: 'Clear prompts give better results.' }),
  it('LOG', 'ai', 'mcq', 'What is a prompt?', { choices: ['Instructions you give an AI', 'A type of fruit', 'A game console', 'A colour'], answer: 0 }, { explanation: 'A prompt tells the AI what you want.' }),
  it('LOG', 'logic', 'seq', 'Order the steps to make tea.', { items: ['Boil water', 'Add tea bag', 'Pour water', 'Drink'] }, { explanation: 'Algorithms are step-by-step instructions.' }),
  it('LOG', 'logic', 'mcq', 'If it rains, you take an umbrella. It rains. So...?', { choices: ['Take an umbrella', 'Stay in bed', 'Eat lunch', 'Nothing'], answer: 0 }, { explanation: 'That is "if-then" logic.' }),
  it('LOG', 'code', 'fix', 'Boss: tap the wrong block.', { tokens: ['start', 'jellyfish', 'end'], wrong: 1, fix: 'run' }, { difficulty: 3, explanation: '"jellyfish" is not a code step.' }),
  it('LOG', 'data', 'mcq', 'Boss: the average of 2, 4, 6 is?', { choices: ['4', '6', '12', '2'], answer: 0 }, { difficulty: 3, explanation: '(2+4+6) ÷ 3 = 4.' }),
  it('LOG', 'ai', 'match', 'Boss: match the AI helper to its job.', { pairs: [['ChatGPT', 'Ideas'], ['Codex', 'Code'], ['Agent', 'Does tasks']] }, { difficulty: 3 }),
]
const LOG: World = {
  key: 'LOG', name: 'LogicLand', color: '#8b5cf6', icon: '{}', signature: 'CS', vibe: 'Puzzle island', status: 'live',
  skills: [{ key: 'code', label: 'Code', band: 2 }, { key: 'data', label: 'Data', band: 2 }, { key: 'ai', label: 'AI', band: 3 }, { key: 'logic', label: 'Logic', band: 2 }],
  units: [
    {
      key: 'log-code', title: 'Code & Logic', color: '#8b5cf6', nodes: [
        { key: 'l1', title: 'Logic & Patterns', type: 'lesson', skills: ['logic'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'l2', title: 'Code World', type: 'practice', skills: ['code'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'l3', title: 'Logic Chest', type: 'chest', skills: ['logic', 'code'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'log-ai', title: 'Data & AI', color: '#8b5cf6', nodes: [
        { key: 'l4', title: 'Data', type: 'practice', skills: ['data'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'l5', title: 'AI', type: 'practice', skills: ['ai'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'l6', title: 'Logic Boss', type: 'boss', skills: ['code', 'data', 'ai'], itemCount: 6, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'code-caster', name: 'Code Caster', icon: '🪄', rule: { type: 'skill_mastery', skill: 'code', pct: 80 } },
    { key: 'data-detective', name: 'Data Detective', icon: '🕵️', rule: { type: 'skill_mastery', skill: 'data', pct: 80 } },
    { key: 'logic-lord', name: 'Logic Lord', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

// ============================================================
//  WORLD 5 · WorldTrail (WLD) — passport map
// ============================================================
const WLD_ITEMS: Item[] = [
  it('WLD', 'geography', 'map', 'Which country is in the Middle East?', { choices: ['Qatar', 'Brazil', 'Japan', 'Canada'], answer: 0 }, { explanation: 'Qatar is in the Middle East — where Baba works!' }),
  it('WLD', 'geography', 'mcq', 'What is the largest ocean?', { choices: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], answer: 1 }, { explanation: 'The Pacific is the biggest ocean.' }),
  it('WLD', 'geography', 'match', 'Match the country to its landmark.', { pairs: [['Egypt', 'Pyramids'], ['France', 'Eiffel Tower'], ['India', 'Taj Mahal']] }, { explanation: 'Famous landmarks help us recognise places.' }),
  it('WLD', 'history', 'seq', 'Order these from oldest to newest.', { items: ['Dinosaurs', 'Ancient Egypt', 'Castles', 'Smartphones'] }, { explanation: 'A timeline goes from long ago to now.' }),
  it('WLD', 'history', 'mcq', 'Who lived in castles long ago?', { choices: ['Knights', 'Astronauts', 'Robots', 'Dinosaurs'], answer: 0 }, { explanation: 'Knights and kings lived in castles.' }),
  it('WLD', 'economics', 'mcq', 'You buy low and sell...?', { choices: ['Lower', 'High', 'Never', 'Free'], answer: 1 }, { explanation: 'Buy low, sell high to make a profit.' }),
  it('WLD', 'economics', 'slider', 'If a toy costs 10 and you sell for 15, your profit is?', { min: 0, max: 20, answer: 5, tol: 0, unit: ' coins' }, { explanation: '15 − 10 = 5 profit.' }),
  it('WLD', 'geography', 'sort', 'Sort: hot or cold places?', { buckets: ['Hot', 'Cold'], items: [{ text: 'Desert', bucket: 0 }, { text: 'Antarctica', bucket: 1 }, { text: 'Sahara', bucket: 0 }] }, { explanation: 'Climate depends on where a place is.' }),
  it('WLD', 'geography', 'map', 'Boss: which is a continent?', { choices: ['Africa', 'Paris', 'The Moon', 'Rivers'], answer: 0 }, { difficulty: 3, explanation: 'Africa is one of 7 continents.' }),
  it('WLD', 'history', 'mcq', 'Boss: what did people use before phones?', { choices: ['Letters', 'Email', 'Apps', 'Wifi'], answer: 0 }, { difficulty: 3, explanation: 'People wrote letters long ago.' }),
  it('WLD', 'economics', 'mcq', 'Boss: what is money used for?', { choices: ['Trading for things', 'Eating', 'Sleeping', 'Flying'], answer: 0 }, { difficulty: 3, explanation: 'Money lets us trade for goods and services.' }),
]
const WLD: World = {
  key: 'WLD', name: 'WorldTrail', color: '#ef4444', icon: '🗺', signature: 'Trail', vibe: 'Passport map', status: 'live',
  skills: [{ key: 'geography', label: 'Geography', band: 2 }, { key: 'history', label: 'History', band: 2 }, { key: 'economics', label: 'Business & Economics', band: 3 }],
  units: [
    {
      key: 'wld-geo', title: 'Around the World', color: '#ef4444', nodes: [
        { key: 'wl1', title: 'Geography', type: 'lesson', skills: ['geography'], itemCount: 5, rewardDiamonds: 5 },
        { key: 'wl2', title: 'Map Chest', type: 'chest', skills: ['geography'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'wld-time', title: 'Time & Trade', color: '#ef4444', nodes: [
        { key: 'wl3', title: 'History', type: 'practice', skills: ['history'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'wl4', title: 'Economics', type: 'practice', skills: ['economics'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'wl5', title: 'Trail Boss', type: 'boss', skills: ['geography', 'history', 'economics'], itemCount: 6, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'map-master', name: 'Map Master', icon: '🧭', rule: { type: 'skill_mastery', skill: 'geography', pct: 80 } },
    { key: 'time-traveller', name: 'Time Traveller', icon: '⏳', rule: { type: 'skill_mastery', skill: 'history', pct: 80 } },
    { key: 'trail-champ', name: 'Trail Champion', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

// ============================================================
//  WORLD 6 · LifeQuest (LIF) — cozy social world
// ============================================================
const LIF_ITEMS: Item[] = [
  it('LIF', 'habits', 'party', 'Real-world quest', { task: 'Tidy your desk or room', quest: true }, { explanation: 'Small habits build a tidy mind!' }),
  it('LIF', 'habits', 'party', 'Real-world quest', { task: 'Drink a glass of water', quest: true }),
  it('LIF', 'kindness', 'party', 'Real-world quest', { task: 'Say something kind to someone today', quest: true }, { explanation: 'Kindness makes the whole circle happier.' }),
  it('LIF', 'movement', 'party', 'Real-world quest', { task: 'Do 10 star jumps', quest: true }),
  it('LIF', 'party', 'party', 'Emoji guess — what is it?', { prompt: 'A pet that says "meow" 🐾', reveal: '🐱 Cat!' }),
  it('LIF', 'party', 'party', 'Emoji guess — what is it?', { prompt: 'It shines in the day ☀️', reveal: '🌞 The Sun!' }),
  it('LIF', 'party', 'mcq', 'Quick quiz: which is a kind action?', { choices: ['Sharing your toys', 'Grabbing toys', 'Shouting', 'Pushing'], answer: 0 }, { explanation: 'Sharing is caring.' }),
  it('LIF', 'habits', 'mcq', 'Which is a good morning habit?', { choices: ['Brush your teeth', 'Skip breakfast', 'Stay up late', 'Forget homework'], answer: 0 }, { explanation: 'Good habits start the day right.' }),
  it('LIF', 'kindness', 'party', 'Boss quest', { task: 'Help someone in your family with a small job', quest: true }, { difficulty: 3 }),
  it('LIF', 'party', 'party', 'Boss emoji guess', { prompt: 'Cold, white, falls in winter ❄️', reveal: '⛄ Snow!' }, { difficulty: 3 }),
]
const LIF: World = {
  key: 'LIF', name: 'LifeQuest', color: '#f472b6', icon: '♥', signature: 'Party', vibe: 'Cozy social world', status: 'live',
  skills: [{ key: 'habits', label: 'Habits', band: 1 }, { key: 'kindness', label: 'Kindness', band: 1 }, { key: 'movement', label: 'Movement', band: 1 }, { key: 'party', label: 'Party games', band: 2 }],
  units: [
    {
      key: 'lif-me', title: 'Healthy Me', color: '#f472b6', nodes: [
        { key: 'li1', title: 'Good Habits', type: 'lesson', skills: ['habits'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'li2', title: 'Move Your Body', type: 'practice', skills: ['movement'], itemCount: 3, rewardDiamonds: 5 },
        { key: 'li3', title: 'Wellbeing Chest', type: 'chest', skills: ['habits', 'movement'], itemCount: 3, rewardDiamonds: 12 },
      ],
    },
    {
      key: 'lif-others', title: 'Me & Others', color: '#f472b6', nodes: [
        { key: 'li4', title: 'Kindness', type: 'practice', skills: ['kindness'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'li5', title: 'Party Time', type: 'practice', skills: ['party'], itemCount: 4, rewardDiamonds: 5 },
        { key: 'li6', title: 'Life Boss', type: 'boss', skills: ['kindness', 'party', 'habits'], itemCount: 5, rewardDiamonds: 20 },
      ],
    },
  ],
  badges: [
    { key: 'kind-heart', name: 'Kind Heart', icon: '💖', rule: { type: 'skill_mastery', skill: 'kindness', pct: 60 } },
    { key: 'party-star', name: 'Party Star', icon: '🎉', rule: { type: 'skill_mastery', skill: 'party', pct: 60 } },
    { key: 'life-champ', name: 'Life Champion', icon: '🏆', rule: { type: 'world_complete' } },
  ],
}

export const WORLDS: World[] = [NUM, WRD, WON, LOG, WLD, LIF]
export const WORLD_BY_KEY: Record<string, World> = Object.fromEntries(WORLDS.map(w => [w.key, w]))

// ── Costumes (one per world) — earned free at ring ≥ 50%, or a diamond shortcut.
// `kind` tells the Buddy avatar which accessory to draw.
export interface Costume { world: string; name: string; kind: 'visor' | 'cape' | 'goggles' | 'headset' | 'hat' | 'backpack'; color: string; price: number }
export const COSTUMES: Costume[] = [
  { world: 'NUM', name: 'Calculator Visor', kind: 'visor', color: '#f59e0b', price: 40 },
  { world: 'WRD', name: 'Reading Cape', kind: 'cape', color: '#3b82f6', price: 40 },
  { world: 'WON', name: 'Lab Goggles', kind: 'goggles', color: '#10b981', price: 40 },
  { world: 'LOG', name: 'Circuit Headset', kind: 'headset', color: '#8b5cf6', price: 40 },
  { world: 'WLD', name: 'Explorer Hat', kind: 'hat', color: '#ef4444', price: 40 },
  { world: 'LIF', name: 'Helper Backpack', kind: 'backpack', color: '#f472b6', price: 40 },
]
export const COSTUME_BY_WORLD: Record<string, Costume> = Object.fromEntries(COSTUMES.map(c => [c.world, c]))
export function accessoryFor(costumeKey: string | null | undefined): { kind: Costume['kind']; color: string } | undefined {
  if (!costumeKey) return undefined
  const c = COSTUME_BY_WORLD[costumeKey]
  return c ? { kind: c.kind, color: c.color } : undefined
}

// ============================================================
//  EXTRA EXPLORER ITEMS — deeper pool per skill (8+ each) so the
//  adaptive engine has real variety. Add rows here to add content.
// ============================================================
const EXTRA_ITEMS: Item[] = [
  // ── NumberDash · times ──
  it('NUM', 'times', 'mcq', 'What is 4 × 6?', { choices: ['18', '24', '28', '20'], answer: 1 }, { explanation: '4 × 6 = 24.' }),
  it('NUM', 'times', 'type', '7 × 7 = ?', { answer: '49', numeric: true }, { explanation: '7 × 7 = 49.' }),
  it('NUM', 'times', 'cloze', 'Complete it.', { before: '6 × ', after: ' = 48', options: ['6', '7', '8'], answer: '8' }, { explanation: '6 × 8 = 48.' }),
  it('NUM', 'times', 'match', 'Match the fact to its answer.', { pairs: [['3 × 4', '12'], ['5 × 6', '30'], ['9 × 2', '18']] }, { explanation: 'Skip-count to check each one.' }),
  it('NUM', 'times', 'speed', 'Lightning round!', { questions: [{ q: '8 × 3', a: '24' }, { q: '7 × 5', a: '35' }, { q: '6 × 6', a: '36' }, { q: '9 × 3', a: '27' }, { q: '8 × 5', a: '40' }], seconds: 50 }),
  // ── NumberDash · fractions ──
  it('NUM', 'fractions', 'mcq', '1/2 of 10 is...?', { choices: ['2', '5', '10', '20'], answer: 1 }, { explanation: 'Half of 10 is 5.' }),
  it('NUM', 'fractions', 'cloze', 'Two quarters make...', { before: '2/4 = ', after: '', options: ['1/2', '1/4', '2'], answer: '1/2' }, { explanation: '2/4 simplifies to 1/2.' }),
  it('NUM', 'fractions', 'numline', 'Place 1/2 on the line.', { min: 0, max: 1, answer: 0.5, tol: 0.06, label: '1/2' }, { explanation: 'One half is right in the middle.' }),
  it('NUM', 'fractions', 'mcq', 'Which is a quarter?', { choices: ['1/4', '1/2', '3/4', '4/4'], answer: 0 }, { explanation: '1/4 means one out of four equal parts.' }),

  // ── WordQuest · phonics ──
  it('WRD', 'phonics', 'listen', 'Which letter makes this sound?', { say: 'mmm', choices: ['m', 'n', 'w'], answer: 0 }, { explanation: 'The /m/ sound is the letter m.' }),
  it('WRD', 'phonics', 'cloze', 'Finish the word: do__', { before: 'do', after: '', options: ['g', 't', 'p'], answer: 'g' }, { explanation: 'd-o-g spells dog.' }),
  it('WRD', 'phonics', 'mcq', 'Which word rhymes with "cat"?', { choices: ['hat', 'dog', 'sun', 'cup'], answer: 0 }, { explanation: 'cat and hat both end in -at.' }),
  it('WRD', 'phonics', 'cloze', 'Make a word: __ish', { before: '', after: 'ish', options: ['f', 'b', 'th'], answer: 'f' }, { explanation: 'f-ish spells fish.' }),
  // ── WordQuest · grammar ──
  it('WRD', 'grammar', 'cloze', 'Choose the right word.', { before: 'They ', after: ' playing outside.', options: ['is', 'are', 'am'], answer: 'are' }, { explanation: '"They" takes "are".' }),
  it('WRD', 'grammar', 'fix', 'Tap the mistake.', { tokens: ['the', 'cat', 'are', 'sleeping'], wrong: 2, fix: 'is' }, { explanation: 'One cat → "is".' }),
  it('WRD', 'grammar', 'mcq', 'Which is a question?', { choices: ['I like cake.', 'Where is my hat?', 'Run fast!', 'The sky is blue.'], answer: 1 }, { explanation: 'A question ends with a "?".' }),
  // ── WordQuest · vocab ──
  it('WRD', 'vocab', 'mcq', 'What does "tiny" mean?', { choices: ['very small', 'very big', 'very fast', 'very loud'], answer: 0 }, { explanation: 'Tiny = very small.' }),
  it('WRD', 'vocab', 'match', 'Match the synonyms.', { pairs: [['begin', 'start'], ['end', 'finish'], ['small', 'little']] }, { explanation: 'Synonyms mean the same.' }),
  // ── WordQuest · writing ──
  it('WRD', 'writing', 'seq', 'Put the day in order.', { items: ['Wake up', 'Eat breakfast', 'Go to school', 'Come home'] }, { explanation: 'Order the events in time.' }),
  it('WRD', 'writing', 'bank', 'Build a sentence.', { tiles: ['I', 'can', 'run', 'fast'], answer: ['I', 'can', 'run', 'fast'] }, { explanation: 'Start with a capital "I".' }),

  // ── WonderLab · biology ──
  it('WON', 'biology', 'sort', 'Sort: lives in water or land?', { buckets: ['Water', 'Land'], items: [{ text: 'Fish', bucket: 0 }, { text: 'Lion', bucket: 1 }, { text: 'Whale', bucket: 0 }, { text: 'Dog', bucket: 1 }] }, { explanation: 'Habitats are where animals live.' }),
  it('WON', 'biology', 'mcq', 'What do animals need to live?', { choices: ['Food and water', 'Only toys', 'Only sunlight', 'Nothing'], answer: 0 }, { explanation: 'All animals need food and water.' }),
  it('WON', 'biology', 'seq', 'Order the butterfly life cycle.', { items: ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly'] }, { explanation: 'A butterfly changes in 4 stages.' }),
  // ── WonderLab · chemistry ──
  it('WON', 'chemistry', 'mcq', 'What is ice made of?', { choices: ['Frozen water', 'Sand', 'Glass', 'Sugar'], answer: 0 }, { explanation: 'Ice is water frozen solid.' }),
  it('WON', 'chemistry', 'sort', 'Sort: solid, liquid?', { buckets: ['Solid', 'Liquid'], items: [{ text: 'Rock', bucket: 0 }, { text: 'Milk', bucket: 1 }, { text: 'Brick', bucket: 0 }, { text: 'Juice', bucket: 1 }] }, { explanation: 'Solids keep their shape; liquids flow.' }),
  // ── WonderLab · physics ──
  it('WON', 'physics', 'mcq', 'What pulls things down to the ground?', { choices: ['Gravity', 'Wind', 'Light', 'Sound'], answer: 0 }, { explanation: 'Gravity pulls everything down.' }),
  it('WON', 'physics', 'pte', 'You drop a feather and a rock.', { predict: { prompt: 'Which lands first in air?', choices: ['Rock', 'Feather'], answer: 0 }, sim: '🪶 floats · 🪨 drops fast', explain: { prompt: 'Why?', choices: ['Air slows the light feather', 'The rock is magic'], answer: 0 } }, { explanation: 'Air resistance slows the feather.' }),
  // ── WonderLab · earth ──
  it('WON', 'earth', 'mcq', 'What is the Sun?', { choices: ['A star', 'A planet', 'A moon', 'A cloud'], answer: 0 }, { explanation: 'The Sun is a star.' }),
  it('WON', 'earth', 'seq', 'Order from smallest to biggest.', { items: ['Moon', 'Earth', 'Sun'] }, { explanation: 'The Sun is much bigger than Earth.' }),

  // ── LogicLand · code ──
  it('LOG', 'code', 'code', 'Order blocks: draw a square.', { tiles: ['repeat 4 times', 'move forward', 'turn right'], answer: ['repeat 4 times', 'move forward', 'turn right'] }, { explanation: 'A loop repeats the steps.' }),
  it('LOG', 'code', 'mcq', 'What does a loop do?', { choices: ['Repeats steps', 'Deletes code', 'Changes colour', 'Plays music'], answer: 0 }, { explanation: 'Loops repeat actions.' }),
  // ── LogicLand · data ──
  it('LOG', 'data', 'mcq', 'The biggest number in 3, 9, 5 is?', { choices: ['9', '5', '3', '17'], answer: 0 }, { explanation: '9 is the largest.' }),
  it('LOG', 'data', 'sort', 'Sort: bigger or smaller than 10?', { buckets: ['< 10', '> 10'], items: [{ text: '4', bucket: 0 }, { text: '15', bucket: 1 }, { text: '8', bucket: 0 }, { text: '20', bucket: 1 }] }, { explanation: 'Compare each to 10.' }),
  // ── LogicLand · ai ──
  it('LOG', 'ai', 'mcq', 'Which is a clearer prompt?', { choices: ['Make a red racing car game', 'Make something', 'Game', 'Do it'], answer: 0 }, { explanation: 'Clear details give better results.' }),
  // ── LogicLand · logic ──
  it('LOG', 'logic', 'seq', 'Order: brush your teeth.', { items: ['Get the toothbrush', 'Add toothpaste', 'Brush', 'Rinse'] }, { explanation: 'Step-by-step = an algorithm.' }),
  it('LOG', 'logic', 'mcq', 'A pattern: 2, 4, 6, __?', { choices: ['8', '7', '9', '5'], answer: 0 }, { explanation: 'Add 2 each time → 8.' }),

  // ── WorldTrail · geography ──
  it('WLD', 'geography', 'map', 'Which is a desert?', { choices: ['Sahara', 'Pacific', 'Amazon', 'Everest'], answer: 0 }, { explanation: 'The Sahara is a huge desert.' }),
  it('WLD', 'geography', 'match', 'Match country to capital.', { pairs: [['France', 'Paris'], ['Japan', 'Tokyo'], ['Egypt', 'Cairo']] }, { explanation: 'A capital is a country\'s main city.' }),
  it('WLD', 'geography', 'mcq', 'How many continents are there?', { choices: ['5', '7', '10', '3'], answer: 1 }, { explanation: 'There are 7 continents.' }),
  // ── WorldTrail · history ──
  it('WLD', 'history', 'mcq', 'Who built the pyramids?', { choices: ['Ancient Egyptians', 'Robots', 'Vikings', 'Astronauts'], answer: 0 }, { explanation: 'The ancient Egyptians built them.' }),
  it('WLD', 'history', 'seq', 'Order: oldest to newest transport.', { items: ['Horse', 'Steam train', 'Car', 'Rocket'] }, { explanation: 'Transport improved over time.' }),
  // ── WorldTrail · economics ──
  it('WLD', 'economics', 'mcq', 'What is a "need"?', { choices: ['Food and water', 'A new toy', 'Candy', 'A game'], answer: 0 }, { explanation: 'Needs keep us alive; wants are extra.' }),
  it('WLD', 'economics', 'sort', 'Sort: need or want?', { buckets: ['Need', 'Want'], items: [{ text: 'Water', bucket: 0 }, { text: 'Toy', bucket: 1 }, { text: 'Food', bucket: 0 }, { text: 'Sweets', bucket: 1 }] }, { explanation: 'Needs first, then wants.' }),

  // ── LifeQuest ──
  it('LIF', 'habits', 'mcq', 'How many hours of sleep do kids need?', { choices: ['About 10', 'About 2', 'About 24', 'None'], answer: 0 }, { explanation: 'Kids need around 9–11 hours.' }),
  it('LIF', 'habits', 'party', 'Real-world quest', { task: 'Make your bed today', quest: true }),
  it('LIF', 'kindness', 'mcq', 'A friend is sad. What helps?', { choices: ['Listen and cheer them up', 'Ignore them', 'Laugh at them', 'Walk away'], answer: 0 }, { explanation: 'Kindness means caring for others.' }),
  it('LIF', 'kindness', 'party', 'Real-world quest', { task: 'Give someone a compliment', quest: true }),
  it('LIF', 'movement', 'party', 'Real-world quest', { task: 'Stretch up high 5 times', quest: true }),
  it('LIF', 'movement', 'mcq', 'Which is good exercise?', { choices: ['Running and jumping', 'Sitting all day', 'Sleeping', 'Watching TV'], answer: 0 }, { explanation: 'Moving keeps your body strong.' }),
  it('LIF', 'party', 'party', 'Emoji guess', { prompt: 'Yellow fruit monkeys love 🐵', reveal: '🍌 Banana!' }),
  it('LIF', 'party', 'party', 'Emoji guess', { prompt: 'It rains from these ☁️', reveal: '🌧️ Clouds!' }),
]

export const LOCAL_ITEMS: Item[] = [...NUM_ITEMS, ...WRD_ITEMS, ...WON_ITEMS, ...LOG_ITEMS, ...WLD_ITEMS, ...LIF_ITEMS, ...EXTRA_ITEMS, ...EXPLORER_PACK, ...(STAGE_PACKS as Item[]), ...(CONTENT_PACK_2 as Item[]), ...(CONTENT_PACK_3 as Item[]), ...(CONTENT_PACK_4 as Item[]), ...(CONTENT_PACK_5 as Item[]), ...(CONTENT_PACK_6 as Item[]), ...(CONTENT_PACK_7 as Item[]), ...(CONTENT_PACK_8 as Item[]), ...(CONTENT_PACK_9 as Item[]), ...(CONTENT_PACK_10 as Item[]), ...(CONTENT_PACK_11 as Item[]), ...(CONTENT_PACK_12 as Item[]), ...(CONTENT_PACK_13 as Item[]), ...(CONTENT_PACK_14 as Item[])]

export function localItemsFor(world: string, skills: string[], stage = 'explorer'): Item[] {
  return LOCAL_ITEMS.filter(i => i.world === world && i.stage === stage && skills.includes(i.skill))
}
