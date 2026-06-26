// ============================================================
//  ARGANTALAB · CONTENT PACK 14 — LIFE SKILLS + ADVANCED ROUND-OUT
//  Fills the lighter areas: more Life world (health, emotions, safety, money
//  sense, focus), more advanced Champion/Legend across worlds, and extra variety
//  everywhere. Validated by data/content.test.ts. Facts verified.
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
const base = (world: string, skill: string, type: IKey, stage: string, difficulty: number, prompt: string, payload: Record<string, unknown>, expl?: string): PackItem =>
  ({ id: `cp14_${++_c}`, world, skill, type, stage, difficulty, prompt, payload, explanation: expl, xp: 10, diamonds: 0 })
const mc = (w: string, s: string, st: string, d: number, p: string, choices: string[], answer: number, e?: string) => base(w, s, 'mcq', st, d, p, { choices, answer }, e)
const so = (w: string, s: string, st: string, d: number, p: string, buckets: string[], items: { text: string; bucket: number }[], e?: string) => base(w, s, 'sort', st, d, p, { buckets, items }, e)
const sq = (w: string, s: string, st: string, d: number, p: string, items: string[], e?: string) => base(w, s, 'seq', st, d, p, { items }, e)

// ── LIFE skills (the thin world): health, emotions, safety, money, focus ──
const LIF: PackItem[] = [
  mc('LIF', 'habits', 'tiny', 1, 'When you cough, cover your…', ['eyes', 'mouth', 'feet', 'ears'], 1),
  mc('LIF', 'habits', 'tiny', 1, 'A traffic light: red means…', ['go', 'stop', 'dance', 'jump'], 1),
  mc('LIF', 'kindness', 'tiny', 1, 'If you bump someone, you say…', ['nothing', 'sorry', 'move!', 'haha'], 1),
  mc('LIF', 'movement', 'starter', 2, 'Which is exercise?', ['watching TV', 'riding a bike', 'sleeping', 'eating'], 1),
  mc('LIF', 'habits', 'starter', 2, 'You feel a fire alarm ring. You should…', ['hide', 'finish lunch', 'leave calmly', 'nap'], 2),
  mc('LIF', 'kindness', 'starter', 2, 'A friend shares a secret. A good friend…', ['tells everyone', 'keeps it safe', 'laughs', 'forgets them'], 1),
  mc('LIF', 'habits', 'explorer', 2, 'A stranger online asks for your address. You…', ['send it', 'say no & tell an adult', 'ignore homework', 'send a photo'], 1),
  mc('LIF', 'kindness', 'explorer', 2, 'Someone is being teased. You can be an…', ['ignorer', 'upstander', 'bystander', 'enemy'], 1, 'An upstander helps.'),
  mc('LIF', 'movement', 'explorer', 3, 'Your heart is a…', ['bone', 'muscle', 'lung', 'joint'], 1),
  mc('LIF', 'habits', 'explorer', 3, 'Feeling worried before a test is…', ['weird', 'normal', 'bad', 'rare'], 1),
  mc('LIF', 'habits', 'builder', 3, 'A SMART goal should be…', ['vague', 'specific', 'secret', 'impossible'], 1),
  mc('LIF', 'kindness', 'builder', 3, 'Putting yourself in someone’s shoes is…', ['empathy', 'apathy', 'envy', 'pride'], 0),
  mc('LIF', 'movement', 'builder', 3, 'Good posture protects your…', ['hair', 'spine', 'shoes', 'teeth'], 1),
  mc('LIF', 'habits', 'champion', 4, 'Saving a little money regularly builds a…', ['debt', 'habit & a fund', 'fine', 'loss'], 1),
  mc('LIF', 'kindness', 'champion', 4, 'Active listening means you…', ['plan your reply', 'pay full attention', 'check your phone', 'interrupt'], 1),
  base('LIF', 'party', 'party', 'tiny', 1, 'Quest: give someone a high-five today.', { task: 'Give someone a high-five', quest: true }),
  base('LIF', 'party', 'party', 'starter', 1, 'Quest: put away 5 things in your room.', { task: 'Put away 5 things in your room', quest: true }),
  base('LIF', 'party', 'party', 'explorer', 1, 'Quest: ask a grown-up about their day.', { task: 'Ask a grown-up about their day', quest: true }),
  base('LIF', 'party', 'party', 'builder', 1, 'Quest: plan tomorrow’s top 3 tasks.', { task: 'Write tomorrow’s top 3 tasks', quest: true }),
]

// ── advanced round-out (champion / legend) ──
const ADV: PackItem[] = [
  mc('NUM', 'arith', 'champion', 4, 'What is 7² − 4²?', ['9', '33', '21', '49'], 1, '49−16=33.'),
  mc('NUM', 'fractions', 'champion', 4, '2/3 of 30 is…', ['10', '15', '20', '24'], 2),
  mc('NUM', 'arith', 'legend', 5, 'A shirt costs $20 after a 20% discount. Original price?', ['$22', '$24', '$25', '$30'], 2, '20 ÷ 0.8 = 25.'),
  mc('NUM', 'geometry', 'legend', 5, 'Interior angle of a regular hexagon?', ['108°', '120°', '135°', '144°'], 1),
  mc('WON', 'physics', 'champion', 4, 'A lever is a type of simple…', ['circuit', 'machine', 'cell', 'gas'], 1),
  mc('WON', 'chemistry', 'legend', 5, 'The pH of pure water is…', ['0', '7', '10', '14'], 1, 'Neutral = 7.'),
  mc('WON', 'biology', 'legend', 5, 'Inherited traits pass from parents through…', ['blood only', 'genes', 'food', 'air'], 1),
  mc('WRD', 'reading', 'legend', 5, 'The author’s purpose in a recipe is to…', ['persuade', 'instruct', 'entertain', 'frighten'], 1),
  mc('WRD', 'vocab', 'champion', 4, '"Inevitable" means…', ['avoidable', 'certain to happen', 'rare', 'tiny'], 1),
  mc('WLD', 'history', 'legend', 5, 'Democracy (rule by the people) began in ancient…', ['Rome', 'Athens', 'Cairo', 'Beijing'], 1),
  mc('WLD', 'economics', 'champion', 4, 'Spending less than you earn means you can…', ['save', 'go into debt', 'pay a fine', 'lose money'], 0),
  mc('LOG', 'ai', 'legend', 5, 'An AI making things up that sound real is called a…', ['feature', 'hallucination', 'cache', 'pixel'], 1),
  mc('LOG', 'code', 'legend', 5, 'Big-O notation describes an algorithm’s…', ['colour', 'efficiency', 'author', 'price'], 1),
  so('WON', 'biology', 'champion', 4, 'Vertebrate (has a backbone) or not?', ['Vertebrate', 'Invertebrate'], [
    { text: 'Dog', bucket: 0 }, { text: 'Worm', bucket: 1 }, { text: 'Fish', bucket: 0 }, { text: 'Jellyfish', bucket: 1 }]),
  sq('NUM', 'arith', 'champion', 4, 'Order operations: solve 2 + 3 × 4 — do this first…', ['3 × 4', '+ 2', '= 14']),
]

export const CONTENT_PACK_14: PackItem[] = [...LIF, ...ADV]
