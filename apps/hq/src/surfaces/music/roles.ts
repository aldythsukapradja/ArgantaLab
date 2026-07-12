// Shared role metadata for the Music Studio stage + inspector.
// One source of truth: color, lucide icon (NO emoji anywhere), display order.
import type { LucideIcon } from 'lucide-react'
import { Waves, Music4, Guitar, Music2, Piano, Drum, Sparkles } from 'lucide-react'

export const ROLE_COLOR: Record<string, string> = {
  pad: '#8b5cf6', harmony: '#6366f1', bass: '#3b82f6', lead: '#0ea5a3',
  arp: '#f59e0b', drums: '#ef4444', sparkle: '#ff3d72',
}

export const ROLE_ICON: Record<string, LucideIcon> = {
  pad: Waves, harmony: Music4, bass: Guitar, lead: Music2,
  arp: Piano, drums: Drum, sparkle: Sparkles,
}
