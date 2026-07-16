// Small provider marks for the model picker + reply provenance. Simplified,
// recognizable-by-colour glyphs (a spark for Gemini, a cloud for Cloudflare, a
// sunburst for Claude, …) — not pixel-exact brand files, which keeps everything
// inline/self-contained with no external assets and no CSP concerns. Accepts
// either an upstream apiModel ("gemini-flash-latest") or a friendly label
// ("Groq Llama 3.3") — providerOf() resolves both.
export type ProviderKey = 'gemini' | 'groq' | 'cloudflare' | 'claude' | 'deepseek'

export function providerOf(model: string | null | undefined): ProviderKey | null {
  const m = (model || '').toLowerCase()
  if (!m || m === 'mock' || m === 'offline') return null
  if (m.includes('cloudflare') || m.startsWith('@cf/')) return 'cloudflare'
  if (m.includes('gemini')) return 'gemini'
  if (m.includes('groq') || m.includes('llama-3')) return 'groq'
  if (m.includes('claude') || m.includes('anthropic')) return 'claude'
  if (m.includes('deepseek')) return 'deepseek'
  return null
}

export function ProviderLogo({ model, size = 14 }: { model: string | null | undefined; size?: number }) {
  const p = providerOf(model)
  // Fallback keeps the existing "live" pulse dot when we can't name the provider.
  if (!p) return <span className="core-brain-dot" aria-hidden style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }} />
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, style: { flex: 'none', display: 'block' } }
  switch (p) {
    case 'gemini': // four-point spark
      return <svg {...common}><path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" fill="#4285F4" /></svg>
    case 'groq': // orange token
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5.5" fill="#F55036" /><circle cx="12" cy="11.6" r="4.2" fill="none" stroke="#fff" strokeWidth="2" /><rect x="12.3" y="12.6" width="5" height="2.3" rx="1.15" fill="#fff" transform="rotate(35 12.3 12.6)" /></svg>
    case 'cloudflare': // cloud
      return <svg {...common}><path d="M7 17.5h9.4a3.1 3.1 0 0 0 .5-6.16 4.6 4.6 0 0 0-8.7-1.2A3.7 3.7 0 0 0 7 17.5Z" fill="#F6821F" /></svg>
    case 'claude': // sunburst (Anthropic clay)
      return <svg {...common}><g stroke="#D97757" strokeWidth="2.1" strokeLinecap="round"><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" /></g></svg>
    case 'deepseek':
      return <svg {...common}><circle cx="12" cy="12" r="9" fill="#4D6BFE" /><path d="M8 12c2 2.6 6 2.6 8 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
  }
}
