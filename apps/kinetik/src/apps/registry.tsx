import type { ComponentType } from 'react'
import TravelApp from './TravelApp'
import PadelApp from './PadelApp'
import KitchenApp from './KitchenApp'
import VaultApp from './VaultApp'

/** A native KinetikCircle app — launched full-screen from the Apps tab,
 *  data linked to the active circle + signed-in user via Supabase. */
export interface NativeApp {
  id: string
  name: string
  emoji: string
  tagline: string
  accent: [string, string]
  Component: ComponentType<{ onClose: () => void }>
}

export const NATIVE_APPS: NativeApp[] = [
  { id: 'travel', name: 'Travel Planner', emoji: '✈️', tagline: 'Plan trips together', accent: ['#0E9DC4', '#38BDF8'], Component: TravelApp },
  { id: 'padel', name: 'Matchday', emoji: '🎾', tagline: 'Fair rounds · live scores', accent: ['#2F6BFF', '#54C7EC'], Component: PadelApp },
  { id: 'kitchen', name: 'Kitchen', emoji: '🍳', tagline: 'Recipes · plan · shop', accent: ['#FF6A4D', '#FF9F4D'], Component: KitchenApp },
  { id: 'vault', name: 'Family Vault', emoji: '🔐', tagline: 'Docs & money', accent: ['#0E9D6B', '#34D399'], Component: VaultApp },
]
