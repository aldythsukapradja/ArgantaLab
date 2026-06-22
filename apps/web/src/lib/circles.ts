// ============================================================
//  CIRCLES & KID PROFILES  (local-first; KinetikCircle-compatible)
//  A parent account holds a roster of kid profiles. Each kid signs
//  in with a simple username + 4-digit PIN (parent can always see it).
//  When a kid grows up, `linkedEmail` upgrades them to Google login.
//  The circles[] graph mirrors KINETIK's KinetikCircle social model:
//  every member has a ROLE (owner/coleader/member/viewer) and each
//  circle has an accent colour, so the active circle themes the shell.
// ============================================================

export type CircleKind = 'family' | 'kids' | 'class' | 'friends'

export type Gender = 'boy' | 'girl'

// KINETIK-compatible role ladder (see kinetikmaster ROLE_LABEL/ROLE_PERM).
export type Role = 'owner' | 'coleader' | 'member' | 'viewer'

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Leader', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer',
}

// Accent palette ported from kinetikmaster CIRCLE_COLORS ([name, c1, c2]).
export const CIRCLE_COLORS: [string, string, string][] = [
  ['Cobalt', '#0057FF', '#22d3ee'], ['Cyan', '#06B6D4', '#8B5CF6'],
  ['Emerald', '#10B981', '#34d399'], ['Violet', '#8B5CF6', '#d946ef'],
  ['Amber', '#F59E0B', '#F97316'], ['Orange', '#F97316', '#fb7185'],
  ['Rose', '#F43F5E', '#fb7185'], ['Fuchsia', '#EC4899', '#8B5CF6'],
]

export interface KidProfile {
  id: string
  username: string          // login handle, e.g. 'baginda'
  pin: string               // 4-digit, parent-visible (local only)
  displayName: string
  color: string             // avatar accent
  emoji: string
  gender: Gender
  dob: string               // ISO 'YYYY-MM-DD' — source of truth for age & stage
  age?: number              // legacy/back-compat; derive from dob via ageFromDob()
  linkedEmail?: string      // set when upgraded to Gmail
  createdAt: number
}

export interface Circle {
  id: string
  name: string
  kind: CircleKind
  emoji: string
  memberIds: string[]                 // kid profile ids (the parent is the implicit owner)
  roles?: Record<string, Role>        // kidId -> role; absent ⇒ 'member'
  accent?: [string, string]           // gradient pair (defaults to a palette colour)
  inviteCode: string
}

export interface CircleState {
  kids: KidProfile[]
  circles: Circle[]
  activeKidId: string | null
}

const KEY = 'argantalab_circles_v2'
const LEGACY_KEY = 'argantalab_circles_v1'
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']
const genderEmoji = (g: Gender) => (g === 'girl' ? '👧' : '👦')

function rid(): string { return Math.random().toString(36).slice(2, 10) }
function code(): string { return Math.random().toString(36).slice(2, 8).toUpperCase() }
function accentAt(i: number): [string, string] {
  const c = CIRCLE_COLORS[i % CIRCLE_COLORS.length]
  return [c[1], c[2]]
}

function seed(): CircleState {
  return {
    kids: [],
    circles: [
      { id: 'fam', name: 'My Family', kind: 'family', emoji: '👨‍👩‍👧‍👦', memberIds: [], roles: {}, accent: accentAt(0), inviteCode: code() },
      { id: 'kids', name: 'Kids', kind: 'kids', emoji: '🧒', memberIds: [], roles: {}, accent: accentAt(2), inviteCode: code() },
    ],
    activeKidId: null,
  }
}

// Bring a circle (possibly from a v1 blob) up to the v2 shape.
function normalizeCircle(c: Circle, i: number): Circle {
  return {
    ...c,
    memberIds: c.memberIds ?? [],
    roles: c.roles ?? {},
    accent: c.accent ?? accentAt(i),
  }
}

export function loadCircles(): CircleState {
  try {
    let raw = localStorage.getItem(KEY)
    if (!raw) {
      // one-time migration from the v1 blob (memberIds-only, no roles/accent)
      raw = localStorage.getItem(LEGACY_KEY)
      if (!raw) return seed()
    }
    const s = JSON.parse(raw) as CircleState
    if (!s.circles?.length) s.circles = seed().circles
    s.circles = s.circles.map(normalizeCircle)
    if (raw && !localStorage.getItem(KEY)) save(s)   // persist migrated shape
    return s
  } catch { return seed() }
}

function save(s: CircleState): CircleState {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
  return s
}

export function getCircle(id: string | null): Circle | null {
  if (!id) return null
  return loadCircles().circles.find(c => c.id === id) ?? null
}

/** The circle to show when none is explicitly chosen yet. */
export function firstCircleId(): string | null {
  return loadCircles().circles[0]?.id ?? null
}

export function addKid(input: { username: string; pin: string; displayName?: string; dob: string; gender: Gender }): CircleState {
  const s = loadCircles()
  const n = s.kids.length
  const kid: KidProfile = {
    id: rid(),
    username: input.username.trim().toLowerCase().replace(/\s+/g, ''),
    pin: input.pin.slice(0, 4),
    displayName: (input.displayName || input.username).trim(),
    color: COLORS[n % COLORS.length],
    emoji: genderEmoji(input.gender),
    gender: input.gender,
    dob: input.dob,
    createdAt: Date.now(),
  }
  s.kids.push(kid)
  // auto-add to Family + Kids circles as a plain member
  for (const c of s.circles) {
    if (c.kind === 'family' || c.kind === 'kids') {
      c.memberIds.push(kid.id)
      ;(c.roles ??= {})[kid.id] = 'member'
    }
  }
  return save(s)
}

export function updateKid(id: string, patch: Partial<KidProfile>): CircleState {
  const s = loadCircles()
  const k = s.kids.find(x => x.id === id)
  if (k) {
    Object.assign(k, patch)
    if (patch.gender) k.emoji = genderEmoji(patch.gender)  // keep the face in sync
  }
  return save(s)
}

export function removeKid(id: string): CircleState {
  const s = loadCircles()
  s.kids = s.kids.filter(k => k.id !== id)
  for (const c of s.circles) {
    c.memberIds = c.memberIds.filter(m => m !== id)
    if (c.roles) delete c.roles[id]
  }
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

// ── Circle CRUD (KINETIK editCircle/deleteCircle analogues) ──
const kindEmoji = (k: CircleKind) => (k === 'friends' ? '🤝' : k === 'class' ? '🏫' : k === 'family' ? '👨‍👩‍👧‍👦' : '👥')

/** Create a circle and return its id (legacy callers can ignore the return). */
export function addCircle(name: string, kind: CircleKind): CircleState {
  const s = loadCircles()
  s.circles.push({
    id: rid(), name, kind, emoji: kindEmoji(kind),
    memberIds: [], roles: {}, accent: accentAt(s.circles.length), inviteCode: code(),
  })
  return save(s)
}

export function createCircle(input: { name: string; kind: CircleKind; accent?: [string, string] }): { state: CircleState; id: string } {
  const s = loadCircles()
  const id = rid()
  s.circles.push({
    id, name: input.name.trim(), kind: input.kind, emoji: kindEmoji(input.kind),
    memberIds: [], roles: {}, accent: input.accent ?? accentAt(s.circles.length), inviteCode: code(),
  })
  return { state: save(s), id }
}

export function updateCircle(id: string, patch: Partial<Pick<Circle, 'name' | 'accent' | 'emoji' | 'kind'>>): CircleState {
  const s = loadCircles()
  const c = s.circles.find(x => x.id === id)
  if (c) Object.assign(c, patch)
  return save(s)
}

export function deleteCircle(id: string): CircleState {
  const s = loadCircles()
  s.circles = s.circles.filter(c => c.id !== id)
  return save(s)
}

// ── Membership + roles ──────────────────────────────────────
export function memberRole(circleId: string, kidId: string): Role {
  const c = getCircle(circleId)
  if (!c) return 'member'
  if (!c.memberIds.includes(kidId)) return 'member'
  return c.roles?.[kidId] ?? 'member'
}

export function setMemberRole(circleId: string, kidId: string, role: Role): CircleState {
  const s = loadCircles()
  const c = s.circles.find(x => x.id === circleId)
  if (c && c.memberIds.includes(kidId)) (c.roles ??= {})[kidId] = role
  return save(s)
}

export function addMemberToCircle(circleId: string, kidId: string, role: Role = 'member'): CircleState {
  const s = loadCircles()
  const c = s.circles.find(x => x.id === circleId)
  if (c && !c.memberIds.includes(kidId)) {
    c.memberIds.push(kidId)
    ;(c.roles ??= {})[kidId] = role
  }
  return save(s)
}

export function removeMemberFromCircle(circleId: string, kidId: string): CircleState {
  const s = loadCircles()
  const c = s.circles.find(x => x.id === circleId)
  if (c) {
    c.memberIds = c.memberIds.filter(m => m !== kidId)
    if (c.roles) delete c.roles[kidId]
  }
  return save(s)
}

/** Resolve the KidProfiles that belong to a circle (parent/owner is implicit). */
export function circleMembers(circleId: string | null): KidProfile[] {
  if (!circleId) return []
  const s = loadCircles()
  const c = s.circles.find(x => x.id === circleId)
  if (!c) return []
  return c.memberIds.map(id => s.kids.find(k => k.id === id)).filter(Boolean) as KidProfile[]
}

export function addCircleManual(name: string, kind: CircleKind): CircleState {
  return addCircle(name, kind)
}

export function peopleCount(): number {
  // unique members across all circles + the parent
  const s = loadCircles()
  const set = new Set<string>()
  for (const c of s.circles) for (const m of c.memberIds) set.add(m)
  return set.size + 1
}
