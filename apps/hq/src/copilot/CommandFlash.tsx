import { useEffect, useState } from 'react'
import type { IntentSpec } from './intents'
import './copilot.css'

// ─────────────────────────────────────────────────────────────────────────
// CommandFlash — a brief premium overlay that fires when a command executes:
// an iris ring expands from the orb and the command label sweeps in, then the
// destination lands. Driven by `firedAt` (a bumping timestamp) so the SAME
// command firing twice still re-triggers. ~700ms, skipped under reduced motion.
// ─────────────────────────────────────────────────────────────────────────

export interface CommandFlashProps {
  intent: IntentSpec | null
  firedAt: number
  reducedMotion?: boolean
}

export function CommandFlash({ intent, firedAt, reducedMotion }: CommandFlashProps) {
  const [shown, setShown] = useState<{ label: string; key: number } | null>(null)

  useEffect(() => {
    if (!intent || !firedAt || reducedMotion) return
    // 'stop' / 'help' aren't navigations — no full-screen sweep for those.
    if (intent.id === 'stop' || intent.id === 'help' || intent.id === 'wake') return
    setShown({ label: intent.label, key: firedAt })
    const t = setTimeout(() => setShown(null), 800)
    return () => clearTimeout(t)
  }, [firedAt, intent, reducedMotion])

  if (!shown) return null
  return (
    <div className="cp-flash" key={shown.key} aria-hidden="true">
      <div className="cp-flash-iris" />
      <div className="cp-flash-label">{shown.label}</div>
    </div>
  )
}
