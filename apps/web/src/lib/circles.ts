// ============================================================
//  CIRCLES & KID PROFILES  (local-first; KinetikCircle-compatible)
//  A parent account holds a roster of kid profiles. Each kid signs
//  in with a simple username + 4-digit PIN (parent can always see it).
//  When a kid grows up, `linkedEmail` upgrades them to Google login.
//  The circles[] graph mirrors the future KinetikCircle social app.
// ============================================================

export type CircleKind = 'family' | 'kids' | 'class' | 'friends'

export interface KidProfile {
  id: string
  username: string          // login handle, e.g. 'baginda'
  pin: string               // 4-digit, parent-visible (local only)
  displayName: string
  color: string             // avatar accent
  emoji: string
  age?: number
  linkedEmail?: string      // set when upgraded to Gmail
  createdAt: number
}

export interface Circle {
  id: string
  name: string
  kind: CircleKind
  emoji: string
  memberIds: string[]       // kid profile ids (+ parent is implicit owner)
  inviteCode: string
}

export interface CircleState {
  kids: KidProfile[]
  circles: Circle[]
  activeKidId: string | null
}

const KEY = 'argantalab_circles_v1'
const EMOJIS = ['🧒', '👦', '👧', '🦊', '🐼', '🦁', '🐯', '🐸', '🦄', '🐙']
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']

function rid(): string { return Math.random().toString(36).slice(2, 10) }
function code(): string { return Math.random().toString(36).slice(2, 8).toUpperCase() }

function seed(): CircleState {
  return {
    kids: [],
    circles: [
      { id: 'fam', name: 'My Family', kind: 'family', emoji: '👨‍👩‍👧‍👦', memberIds: [], inviteCode: code() },
      { id: 'kids', name: 'Kids', kind: 'kids', emoji: '🧒', memberIds: [], inviteCode: code() },
    ],
    activeKidId: null,
  }
}

export function loadCircles(): CircleState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const s = JSON.parse(raw) as CircleState
    if (!s.circles?.length) s.circles = seed().circles
    return s
  } catch { return seed() }
}

function save(s: CircleState): CircleState {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
  return s
}

export function addKid(input: { username: string; pin: string; displayName?: string; age?: number }): CircleState {
  const s = loadCircles()
  const n = s.kids.length
  const kid: KidProfile = {
    id: rid(),
    username: input.username.trim().toLowerCase().replace(/\s+/g, ''),
    pin: input.pin.slice(0, 4),
    displayName: (input.displayName || input.username).trim(),
    color: COLORS[n % COLORS.length],
    emoji: EMOJIS[n % EMOJIS.length],
    age: input.age,
    createdAt: Date.now(),
  }
  s.kids.push(kid)
  // auto-add to Family + Kids circles
  for (const c of s.circles) {
    if (c.kind === 'family' || c.kind === 'kids') c.memberIds.push(kid.id)
  }
  return save(s)
}

export function updateKid(id: string, patch: Partial<KidProfile>): CircleState {
  const s = loadCircles()
  const k = s.kids.find(x => x.id === id)
  if (k) Object.assign(k, patch)
  return save(s)
}

export function removeKid(id: string): CircleState {
  const s = loadCircles()
  s.kids = s.kids.filter(k => k.id !== id)
  for (const c of s.circles) c.memberIds = c.memberIds.filter(m => m !== id)
  if (s.activeKidId === id) s.activeKidId = null
  return save(s)
}

export function setActiveKid(id: string | null): CircleState {
  const s = loadCircles()
  s.activeKidId = id
  return save(s)
}

export function getActiveKid(): KidProfile | null {
  const s = loadCircles()
  return s.kids.find(k => k.id === s.activeKidId) ?? null
}

/** Verify a username + PIN (case-insensitive username). Returns the kid or null. */
export function verifyLogin(username: string, pin: string): KidProfile | null {
  const s = loadCircles()
  const u = username.trim().toLowerCase()
  return s.kids.find(k => k.username === u && k.pin === pin) ?? null
}

export function addCircle(name: string, kind: CircleKind): CircleState {
  const s = loadCircles()
  s.circles.push({ id: rid(), name, kind, emoji: kind === 'friends' ? '🤝' : kind === 'class' ? '🏫' : '👥', memberIds: [], inviteCode: code() })
  return save(s)
}

export function peopleCount(): number {
  // unique members across all circles + the parent
  const s = loadCircles()
  const set = new Set<string>()
  for (const c of s.circles) for (const m of c.memberIds) set.add(m)
  return set.size + 1
}
