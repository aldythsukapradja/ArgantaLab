// Slim curriculum metadata for the HQ Content Studio — the authoring side of
// the catalog. Mirrors apps/web's data/learn.ts (worlds · skills · stages ·
// interaction shapes) without the bundled question pack or player engine.
// Kept small on purpose; the live counts come from hq_content_matrix().

export type InteractionKey =
  | 'mcq' | 'multi' | 'type' | 'speed' | 'bank' | 'cloze'
  | 'match' | 'sort' | 'seq' | 'fix' | 'numline' | 'slider'
  | 'listen' | 'label' | 'pte' | 'code' | 'map' | 'party'

export interface Skill { key: string; label: string }
export interface World { key: string; name: string; color: string; vibe: string; skills: Skill[] }
export interface Stage { key: string; label: string; minAge: number; maxAge: number }

export const STAGES: Stage[] = [
  { key: 'tiny', label: 'Tiny', minAge: 1, maxAge: 6 },
  { key: 'starter', label: 'Starter', minAge: 6, maxAge: 8 },
  { key: 'explorer', label: 'Explorer', minAge: 8, maxAge: 11 },
  { key: 'builder', label: 'Builder', minAge: 11, maxAge: 14 },
  { key: 'champion', label: 'Champion', minAge: 14, maxAge: 16 },
  { key: 'legend', label: 'Legend', minAge: 16, maxAge: 19 },
]

export const WORLDS: World[] = [
  { key: 'NUM', name: 'NumberDash', color: '#f59e0b', vibe: 'Arcade math racing', skills: [
    { key: 'placevalue', label: 'Place value' }, { key: 'arith', label: 'Add & subtract' },
    { key: 'times', label: 'Times tables' }, { key: 'fractions', label: 'Fractions' },
    { key: 'money', label: 'Money' }, { key: 'measure', label: 'Measurement' },
    { key: 'time', label: 'Telling time' }, { key: 'geometry', label: 'Shapes & geometry' },
  ] },
  { key: 'WRD', name: 'WordQuest', color: '#3b82f6', vibe: 'Storybook adventure', skills: [
    { key: 'phonics', label: 'Phonics' }, { key: 'grammar', label: 'Grammar' },
    { key: 'vocab', label: 'Vocabulary' }, { key: 'reading', label: 'Reading comprehension' },
    { key: 'writing', label: 'Writing' },
  ] },
  { key: 'WON', name: 'WonderLab', color: '#10b981', vibe: 'Lab experiments', skills: [
    { key: 'biology', label: 'Biology' }, { key: 'chemistry', label: 'Chemistry' },
    { key: 'physics', label: 'Physics' }, { key: 'earth', label: 'Earth & Space' },
  ] },
  { key: 'LOG', name: 'LogicLand', color: '#8b5cf6', vibe: 'Puzzle island', skills: [
    { key: 'code', label: 'Code' }, { key: 'data', label: 'Data' },
    { key: 'ai', label: 'AI' }, { key: 'logic', label: 'Logic' },
  ] },
  { key: 'WLD', name: 'WorldTrail', color: '#ef4444', vibe: 'Passport map', skills: [
    { key: 'geography', label: 'Geography' }, { key: 'history', label: 'History' },
    { key: 'economics', label: 'Business & Economics' },
  ] },
  { key: 'LIF', name: 'LifeQuest', color: '#f472b6', vibe: 'Cozy social world', skills: [
    { key: 'habits', label: 'Habits' }, { key: 'kindness', label: 'Kindness' },
    { key: 'movement', label: 'Movement' }, { key: 'party', label: 'Party games' },
  ] },
]

export interface InteractionMeta {
  key: InteractionKey
  name: string
  desc: string
  payloadHint: string
  apps: string[]
}
export const INTERACTIONS: InteractionMeta[] = [
  { key: 'mcq', name: 'Multiple choice', desc: 'Pick the one correct option.', payloadHint: '{ "choices": ["a","b","c","d"], "answer": 0 }', apps: ['NUM','WRD','WON','LOG','WLD'] },
  { key: 'multi', name: 'Multi-select', desc: 'Choose all that apply.', payloadHint: '{ "choices": [...], "answers": [0,2] }', apps: ['NUM','WON','LOG'] },
  { key: 'type', name: 'Type answer', desc: 'Free text / numeric entry.', payloadHint: '{ "answer": "56", "numeric": true, "accept": ["56"] }', apps: ['NUM','WRD','LOG'] },
  { key: 'speed', name: 'Speed recall', desc: 'Rapid-fire vs a clock (TTRS).', payloadHint: '{ "questions": [{"q":"7×8","a":"56"}], "seconds": 60 }', apps: ['NUM','WRD'] },
  { key: 'bank', name: 'Word bank', desc: 'Build a sentence from tiles.', payloadHint: '{ "tiles": ["The","cat","sat"], "answer": ["The","cat","sat"] }', apps: ['WRD','LOG'] },
  { key: 'cloze', name: 'Fill blank', desc: 'Pick the missing word.', payloadHint: '{ "before": "She ", "after": " to school.", "options": ["walk","walks"], "answer": "walks" }', apps: ['WRD','NUM','LOG'] },
  { key: 'match', name: 'Match pairs', desc: 'Connect two columns.', payloadHint: '{ "pairs": [["½","0.5"],["¼","0.25"]] }', apps: ['NUM','WRD','WON','WLD'] },
  { key: 'sort', name: 'Sort / categorize', desc: 'Drag items into buckets.', payloadHint: '{ "buckets": ["Mammal","Reptile"], "items": [{"text":"Dog","bucket":0}] }', apps: ['WON','WRD','WLD'] },
  { key: 'seq', name: 'Sequence order', desc: 'Arrange in the correct order.', payloadHint: '{ "items": ["First","Then","Last"] }', apps: ['WLD','WON','WRD'] },
  { key: 'fix', name: 'Tap to fix', desc: 'Tap the wrong word in a line.', payloadHint: '{ "tokens": ["i","like","cats"], "wrong": 0, "fix": "I" }', apps: ['WRD','LOG'] },
  { key: 'numline', name: 'Number line', desc: 'Drag a marker on a line.', payloadHint: '{ "min": 0, "max": 1, "answer": 0.75, "tol": 0.05, "label": "3/4" }', apps: ['NUM','WON'] },
  { key: 'slider', name: 'Slider estimate', desc: 'Estimate with a slider.', payloadHint: '{ "min": 0, "max": 200, "answer": 100, "tol": 10, "unit": "°C" }', apps: ['WON','WLD','NUM'] },
  { key: 'listen', name: 'Listen & choose', desc: 'Hear a sound, pick the match.', payloadHint: '{ "say": "buh", "choices": ["b","d","p"], "answer": 0 }', apps: ['WRD'] },
  { key: 'label', name: 'Label diagram', desc: 'Match labels to parts.', payloadHint: '{ "scene": "🌱", "pairs": [["Top","Leaf"],["Bottom","Root"]] }', apps: ['WON','WLD'] },
  { key: 'pte', name: 'Predict → Test → Explain', desc: 'Guess, run a sim, explain why.', payloadHint: '{ "predict": {...}, "sim": "🧊→💧", "explain": {...} }', apps: ['WON'] },
  { key: 'code', name: 'Code blocks', desc: 'Order code blocks to solve.', payloadHint: '{ "tiles": ["move()","turn()"], "answer": ["move()","turn()"] }', apps: ['LOG'] },
  { key: 'map', name: 'Map find', desc: 'Find a place (choice for now).', payloadHint: '{ "choices": ["Qatar","Oman"], "answer": 0 }', apps: ['WLD'] },
  { key: 'party', name: 'Party / quest', desc: 'Pass-device or real-world task.', payloadHint: '{ "task": "Tidy your desk", "quest": true }', apps: ['LIF'] },
]

export const interactionsFor = (world: string): InteractionMeta[] =>
  INTERACTIONS.filter((i) => i.apps.includes(world) || world === 'LIF')

// Concrete starter payloads per interaction type — the editor's template inserter.
export function payloadTemplate(type: InteractionKey): Record<string, unknown> {
  switch (type) {
    case 'mcq': return { choices: ['option A', 'option B', 'option C', 'option D'], answer: 0 }
    case 'map': return { choices: ['Qatar', 'Brazil', 'Japan'], answer: 0 }
    case 'multi': return { choices: ['a', 'b', 'c', 'd'], answers: [0, 2] }
    case 'type': return { answer: '56', numeric: true, accept: ['56'] }
    case 'speed': return { questions: [{ q: '2 × 6', a: '12' }, { q: '5 × 5', a: '25' }], seconds: 45 }
    case 'bank': return { tiles: ['The', 'cat', 'sat'], answer: ['The', 'cat', 'sat'] }
    case 'code': return { tiles: ['moveForward()', 'turnRight()'], answer: ['moveForward()', 'turnRight()'] }
    case 'cloze': return { before: 'She ', after: ' to school.', options: ['walk', 'walks'], answer: 'walks' }
    case 'match': return { pairs: [['½', '0.5'], ['¼', '0.25']] }
    case 'label': return { scene: '🌳', pairs: [['Top', 'Leaves'], ['Bottom', 'Roots']] }
    case 'sort': return { buckets: ['Mammal', 'Reptile'], items: [{ text: 'Dog', bucket: 0 }, { text: 'Snake', bucket: 1 }] }
    case 'seq': return { items: ['First', 'Then', 'Last'] }
    case 'fix': return { tokens: ['i', 'like', 'cats'], wrong: 0, fix: 'I' }
    case 'numline': return { min: 0, max: 1, answer: 0.75, tol: 0.05, label: '3/4' }
    case 'slider': return { min: 0, max: 200, answer: 100, tol: 10, unit: '°C' }
    case 'listen': return { say: 'buh', choices: ['b', 'd', 'p'], answer: 0 }
    case 'pte': return { predict: { prompt: 'Predict: fast or slow?', choices: ['Slow', 'Fast'], answer: 1 }, sim: '🏐⬇️', explain: { prompt: 'Why?', choices: ['Steeper = faster', 'Ramps slow things'], answer: 0 } }
    case 'party': return { task: 'Tidy your desk', quest: true }
    default: return {}
  }
}

// Paste-ready authoring prompt for an external LLM → returns a JSON array for Bulk import.
export function buildAuthorPrompt(worldKey: string, stageKey: string, count: number): string {
  const w = WORLDS.find((x) => x.key === worldKey)!
  const stage = STAGES.find((s) => s.key === stageKey)!
  const skills = w.skills.map((s) => `  - "${s.key}" → ${s.label}`).join('\n')
  const types = interactionsFor(worldKey)
    .map((i) => `  - "${i.key}" (${i.name}): ${i.desc}\n      payload: ${i.payloadHint}`).join('\n')

  return `You are an expert children's curriculum author for ArgantaLab, a learning game for kids.

Write ${count} question items for the "${w.name}" world (${w.vibe}) at the "${stage.label}" stage (ages ${stage.minAge}-${stage.maxAge}).

Return ONLY a valid JSON array (no markdown, no commentary). Each item object MUST have:
{
  "world_key": "${w.key}",
  "skill_key": one of the skills below,
  "interaction_type": one of the types below,
  "stage_key": "${stage.key}",
  "difficulty": 1 to 5 (match the ${stage.label} age band),
  "prompt": the question text shown to the child (clear, friendly, short),
  "payload": MUST match the shape for the chosen interaction_type exactly,
  "explanation": a one-sentence kid-friendly reason for the answer,
  "xp": 10,
  "diamonds": 0
}

SKILLS (use the key on the left):
${skills}

INTERACTION TYPES allowed for this world (vary them — don't use only mcq):
${types}

RULES:
- Age-appropriate for ${stage.label} (ages ${stage.minAge}-${stage.maxAge}), positive tone.
- Every payload's "answer"/"answers" MUST be correct.
- For "mcq": 3-4 plausible choices, exactly one correct (answer = its index).
- For "seq": list items in the CORRECT order (the app shuffles them).
- For "match": pairs are [left, right] correct matches.
- Mix difficulties and skills evenly across the ${count} items.
- Keep prompts under ~12 words.

Output: a single JSON array of ${count} objects. Nothing else.`
}
