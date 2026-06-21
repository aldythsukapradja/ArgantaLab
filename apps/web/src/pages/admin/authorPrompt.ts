import { WORLDS, INTERACTIONS, type InteractionKey } from '@/data/learn'

// Concrete starter payloads per interaction type — used by the editor's
// "template" inserter and shown inside the LLM authoring prompt.
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

/** Build a complete, paste-ready authoring prompt for an external LLM. */
export function buildAuthorPrompt(worldKey: string, count: number): string {
  const w = WORLDS.find(x => x.key === worldKey)!
  const skills = w.skills.map(s => `  - "${s.key}" → ${s.label}`).join('\n')
  const types = INTERACTIONS.filter(i => i.apps.includes(worldKey) || worldKey === 'LIF')
    .map(i => `  - "${i.key}" (${i.name}): ${i.desc}\n      payload: ${i.payloadHint}`).join('\n')

  return `You are an expert children's curriculum author for ArgantaLab, a learning game for kids aged 8-11 (Cambridge Primary "Explorer" stage).

Write ${count} question items for the "${w.name}" world (${w.vibe}).

Return ONLY a valid JSON array (no markdown, no commentary). Each item object MUST have:
{
  "world_key": "${w.key}",
  "skill_key": one of the skills below,
  "interaction_type": one of the types below,
  "stage_key": "explorer",
  "difficulty": 1 to 5 (mostly 2, a few 3 for boss-level),
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
- Age-appropriate, Cambridge Primary aligned, positive tone.
- Every payload's "answer"/"answers" MUST be correct.
- For "mcq": 3-4 plausible choices, exactly one correct (answer = its index).
- For "seq": list items in the CORRECT order (the app shuffles them).
- For "match": pairs are [left, right] correct matches.
- Mix difficulties and skills evenly across the ${count} items.
- Keep prompts under ~12 words.

Output: a single JSON array of ${count} objects. Nothing else.`
}
