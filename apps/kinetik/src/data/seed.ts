// =========================================================
//  KINETIK seed data — a real family so the shell feels alive
//  with zero backend. Dates are generated relative to today.
// =========================================================

export type EnergyKey = 'care' | 'mind' | 'growth' | 'memory' | 'play' | 'calm'

export const ENERGY: Record<EnergyKey, string> = {
  care: '#FB7185', mind: '#22D3EE', growth: '#34D399',
  memory: '#8B5CF6', play: '#FBBF24', calm: '#94A3B8',
}

export type Role = 'owner' | 'coleader' | 'member' | 'viewer'
export const ROLE_LABEL: Record<Role, string> = { owner: 'Leader', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer' }
export interface Person { id: string; name: string; color: string; role: Role }
export interface Circle { id: string; name: string; kind: 'family' | 'friends' | 'class'; accent: [string, string]; memberIds: string[] }

export interface KEvent {
  id: string
  circleId: string
  title: string
  date: string          // ISO YYYY-MM-DD
  start: string         // HH:MM
  end: string
  who: string[]         // person ids
  energy: EnergyKey
  coach?: string
  location?: string
}

export interface Moment {
  id: string
  circleId: string
  authorId: string
  text: string
  createdAt: number
  hearts: number
  comments: number
  tag?: string
  kind: 'photo' | 'kudos' | 'memory'
  tone?: EnergyKey       // colour wash for the photo block
  rewardEnergy?: EnergyKey
}

// ---- date helpers (relative to today) ----
const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoOf(new Date())
function dayISO(offset: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset)
  return isoOf(d)
}

export const PEOPLE: Person[] = [
  { id: 'p_aldyth', name: 'Aldyth', color: ENERGY.memory, role: 'owner' },
  { id: 'p_wife', name: 'Wife', color: ENERGY.care, role: 'coleader' },
  { id: 'p_kinara', name: 'Kinara', color: ENERGY.mind, role: 'member' },
  { id: 'p_baginda', name: 'Baginda', color: ENERGY.play, role: 'member' },
  { id: 'p_keyla', name: 'Keyla', color: ENERGY.growth, role: 'member' },
]

export const CIRCLES: Circle[] = [
  { id: 'c_family', name: 'Sukapradja Family', kind: 'family', accent: ['#22D3EE', '#8B5CF6'], memberIds: PEOPLE.map(p => p.id) },
  { id: 'c_padel', name: 'Padel Crew', kind: 'friends', accent: ['#34D399', '#22D3EE'], memberIds: ['p_aldyth', 'p_wife'] },
]

export const SEED_EVENTS: KEvent[] = [
  { id: 'e1', circleId: 'c_family', title: 'Padel with Kinara', date: dayISO(0), start: '09:30', end: '10:30', who: ['p_kinara', 'p_aldyth'], energy: 'play', coach: 'Coach Sam' },
  { id: 'e2', circleId: 'c_family', title: 'Gymnastics', date: dayISO(0), start: '13:30', end: '14:30', who: ['p_keyla'], energy: 'growth' },
  { id: 'e3', circleId: 'c_family', title: 'Family dinner', date: dayISO(0), start: '18:00', end: '19:30', who: ['p_aldyth', 'p_wife', 'p_kinara', 'p_baginda', 'p_keyla'], energy: 'care' },
  { id: 'e4', circleId: 'c_family', title: 'School run', date: dayISO(1), start: '07:30', end: '08:00', who: ['p_wife', 'p_baginda'], energy: 'calm' },
  { id: 'e5', circleId: 'c_family', title: 'Coding club', date: dayISO(1), start: '16:00', end: '17:00', who: ['p_baginda'], energy: 'mind' },
  { id: 'e6', circleId: 'c_family', title: 'Swim lesson', date: dayISO(2), start: '17:00', end: '18:00', who: ['p_kinara'], energy: 'play' },
  { id: 'e7', circleId: 'c_family', title: 'Grandparents visit', date: dayISO(3), start: '11:00', end: '15:00', who: ['p_aldyth', 'p_wife', 'p_kinara', 'p_baginda', 'p_keyla'], energy: 'memory' },
  { id: 'e8', circleId: 'c_family', title: 'Padel match', date: dayISO(5), start: '09:00', end: '11:00', who: ['p_aldyth', 'p_wife'], energy: 'play' },
  { id: 'e9', circleId: 'c_padel', title: 'Americano night', date: dayISO(2), start: '20:00', end: '22:00', who: ['p_aldyth', 'p_wife'], energy: 'play' },
]

export const SEED_MOMENTS: Moment[] = [
  { id: 'm1', circleId: 'c_family', authorId: 'p_kinara', text: 'First padel win against the coach. So proud of her.', createdAt: Date.now() - 2 * 3600e3, hearts: 5, comments: 2, tag: 'padel', kind: 'photo', tone: 'care' },
  { id: 'm2', circleId: 'c_family', authorId: 'p_baginda', text: 'Baginda finished his coding club project', createdAt: Date.now() - 5 * 3600e3, hearts: 3, comments: 1, kind: 'kudos', rewardEnergy: 'mind' },
  { id: 'm3', circleId: 'c_family', authorId: 'p_wife', text: 'Sunday pancakes — a small tradition we love.', createdAt: Date.now() - 26 * 3600e3, hearts: 8, comments: 4, tag: 'home', kind: 'photo', tone: 'play' },
]

export const personById = (id: string) => PEOPLE.find(p => p.id === id)
export const firstName = (id: string) => personById(id)?.name ?? '?'
export const initials = (name: string) => name.trim().slice(0, name.includes(' ') ? 1 : 2).toUpperCase()
