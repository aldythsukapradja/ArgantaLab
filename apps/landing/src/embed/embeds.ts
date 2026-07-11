// ── EMBEDS — where the real apps live. DOMAIN-AGNOSTIC by construction: every URL
// comes from env first, with the confirmed-live deployment as a fallback. The
// postMessage origin allowlist is DERIVED from these URLs — never hardcoded — so
// changing a domain is an env edit, never a code edit.
const env = import.meta.env as Record<string, string | undefined>

export type EmbedApp = 'lab' | 'kinetik' | 'lashira' | 'hq'

export const EMBEDS: Record<EmbedApp, string> = {
  lab:     env.VITE_EMBED_LAB     ?? 'https://lab.arganta.app',
  kinetik: env.VITE_EMBED_KINETIK ?? 'https://circle.arganta.app',
  lashira: env.VITE_EMBED_LASHIRA ?? 'https://lashirabloom-game-one.vercel.app',
  hq:      env.VITE_EMBED_HQ      ?? 'https://hq.arganta.app',
}

// origins we accept bridge messages from — computed, not typed by hand
export const EMBED_ORIGINS: string[] = Array.from(
  new Set(Object.values(EMBEDS).map(u => { try { return new URL(u).origin } catch { return '' } }).filter(Boolean)),
)

export const isEmbedOrigin = (origin: string) => EMBED_ORIGINS.includes(origin)

// which apps are safe to run live for an UNauthenticated visitor. Lashira has a
// verified guest path (no account); the rest need operator mode (spec §0.4).
export const PUBLIC_LIVE: Record<EmbedApp, boolean> = {
  lashira: true, lab: false, kinetik: false, hq: false,
}

// per-app display name shown in the desktop browser chrome's URL pill
export const EMBED_LABEL: Record<EmbedApp, string> = {
  lab: 'ArgantaLab', kinetik: 'KinetikCircle', lashira: 'LashiraBloom', hq: 'Circle HQ',
}
