// ============================================================
//  PERMISSION ENGINE  (ported from KINETIK's Perm / ROLE_PERM)
//  Gates circle-management actions by role. The grown-up account
//  holder is always the circle OWNER (the implicit Leader); kids
//  carry a per-circle role. Kept tiny + pure so any component can
//  ask "can this player do X here?".
// ============================================================
import { memberRole, type Role } from '@lib/circles'

export type Action =
  | 'manage_circle'    // rename / recolor / delete the circle
  | 'manage_members'   // change roles, remove members
  | 'post'             // write to circle chat / feed
  | 'read'             // see the circle at all

// What each role is allowed to do (owner ⊇ coleader ⊇ member ⊇ viewer).
const ALLOWED: Record<Role, Action[]> = {
  owner:    ['manage_circle', 'manage_members', 'post', 'read'],
  coleader: ['manage_members', 'post', 'read'],
  member:   ['post', 'read'],
  viewer:   ['read'],
}

/** The role of the current player in a circle.
 *  `null` playerId (or 'owner' string) = the grown-up account holder = owner. */
export function roleOf(circleId: string, playerId: string | null): Role {
  if (!playerId || playerId === 'owner') return 'owner'
  return memberRole(circleId, playerId)
}

export function can(circleId: string, playerId: string | null, action: Action): boolean {
  return ALLOWED[roleOf(circleId, playerId)].includes(action)
}

export function isReadOnly(circleId: string, playerId: string | null): boolean {
  return !can(circleId, playerId, 'post')
}
