/**
 * Artifact adapter + runtime helpers shared by Game and App builders.
 *
 * Bridges live Supabase rows (PublishedGame / AppManifest) into the unified
 * ArtifactSignals the ranking engine consumes, and provides the preview/
 * fullscreen runtime that injects the right Circle SDK with real circle data.
 */
import type { PublishedGame, AppManifest, Circle } from '../../data/live'
import type { ArtifactSignals } from '../../data/algorithm'
import { generateCircleAppSDKMock } from '../../data/circleAppSDK'
import { CIRCLE_SDK_MOCK } from '../../data/circleSDK'

export type Kind = 'game' | 'app'

export interface Artifact {
  id: string
  kind: Kind
  title: string
  description: string
  html: string
  category: string | null
  visibility: string
  plays: number
  created_at: string
  thumbnail: string | null
  featured: boolean
  featured_rank: number | null
  pinned: boolean
  rating_avg: number | null
  rating_count: number
  share_count: number
  emoji: string
}

const GAME_CATS: Record<string, string> = {
  fps: '🎯', farming: '🌾', racing: '🏎️', tower: '🏰',
  platformer: '🦘', puzzle: '🧩', rpg: '⚔️', survival: '🏕️',
}

export function fromGame(g: PublishedGame): Artifact {
  const cat = g.category ?? (g.config?.category as string | undefined) ?? null
  return {
    id: g.id, kind: 'game', title: g.title || 'Untitled',
    description: g.description ?? '', html: g.html || '',
    category: cat, visibility: g.visibility || 'public',
    plays: g.plays ?? 0, created_at: g.created_at,
    thumbnail: g.thumbnail ?? null,
    featured: !!g.featured, featured_rank: g.featured_rank ?? null, pinned: !!g.pinned,
    rating_avg: g.rating_avg ?? null, rating_count: g.rating_count ?? 0,
    share_count: g.share_count ?? 0,
    emoji: (cat && GAME_CATS[cat]) || '🎮',
  }
}

export function fromApp(a: AppManifest): Artifact {
  return {
    id: a.id, kind: 'app', title: a.name || 'Untitled',
    description: a.description ?? '', html: a.html ?? '',
    category: a.category ?? null, visibility: a.visibility ?? 'public',
    plays: a.plays ?? 0, created_at: a.created_at ?? new Date().toISOString(),
    thumbnail: a.thumbnail ?? null,
    featured: !!a.featured, featured_rank: a.featured_rank ?? null, pinned: !!a.pinned,
    rating_avg: a.rating_avg ?? null, rating_count: a.rating_count ?? 0,
    share_count: a.share_count ?? 0,
    emoji: '🧩',
  }
}

export function toSignals(a: Artifact): ArtifactSignals {
  return {
    id: a.id, title: a.title, kind: a.kind, category: a.category,
    plays: a.plays, created_at: a.created_at,
    rating_avg: a.rating_avg ?? undefined,
    rating_count: a.rating_count || undefined,
    share_count: a.share_count || undefined,
    pinned: a.pinned,
  }
}

// ── SDK injection ─────────────────────────────────────────────────────

interface SDKContext { user: { id: string; name: string; avatar?: string }; circle: Circle | null }

/** Build the SDK <script> for a given artifact kind + circle context. */
function sdkScript(kind: Kind, ctx: SDKContext): string {
  if (kind === 'app') {
    const user = {
      id: ctx.user.id, name: ctx.user.name, avatar: ctx.user.avatar,
      role: 'member' as const, circle_id: ctx.circle?.id ?? 'circle_demo',
    }
    const circle = ctx.circle
      ? {
          id: ctx.circle.id, name: ctx.circle.name,
          type: ctx.circle.kind as 'family' | 'kids' | 'class' | 'friends',
          members: ctx.circle.members.map(m => ({
            id: m.id, name: m.name, avatar: m.avatar, kind: m.kind, role: m.role,
          })),
        }
      : {
          id: 'circle_demo', name: 'Demo Circle', type: 'family' as const,
          members: [{ id: ctx.user.id, name: ctx.user.name, avatar: undefined, kind: 'child' as const, role: 'member' as const }],
        }
    return generateCircleAppSDKMock(user, circle)
  }
  // game → CircleGame mock, seeded with the real user identity
  const seed = `try{localStorage.setItem('cg_user',JSON.stringify(${JSON.stringify({
    id: ctx.user.id, name: ctx.user.name, avatar: ctx.user.avatar ?? null,
    diamonds: 500, xp: 0, level: 1,
  })}));}catch(e){}`
  return `${seed};${CIRCLE_SDK_MOCK}`
}

/** Compose a runnable HTML document with the SDK injected before </body>. */
export function composeRuntime(kind: Kind, html: string, ctx: SDKContext): string {
  const sdk = sdkScript(kind, ctx)
  const tag = `<script>${sdk}</script>`
  if (html.includes('</body>')) return html.replace('</body>', `${tag}</body>`)
  return `${html}${tag}`
}

/**
 * Open an artifact full-screen in a new tab with the real SDK injected.
 * Uses a Blob URL so the artifact runs as a top-level document (fullscreen
 * API, pointer lock, audio all work — unlike the sandboxed preview iframe).
 */
export function openFullscreen(kind: Kind, html: string, ctx: SDKContext): void {
  const doc = composeRuntime(kind, html, ctx)
  const blob = new Blob([doc], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // Revoke after the tab has had time to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ── Display helpers ───────────────────────────────────────────────────

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
