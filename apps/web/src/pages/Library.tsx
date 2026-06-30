import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'
import { fetchPublicGames } from '@lib/gamesCloud'

const Play = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
const Search = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
const Chevron = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>

interface CommunityGame { id: string; title: string; html: string; creator: string; plays: number; category: string; hue: number }

// The Ship · Library tab — an App-Store-style catalog of every game ever built
// in ArgantaLab: flagship titles published "By ArgantaLab", then community games
// kids have shipped. Searchable, with a publisher/creator scope filter.
export default function Library() {
  const { openGame, playWizardGame, go } = useAppStore()
  const [community, setCommunity] = useState<CommunityGame[]>([])
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all') // 'all' | 'arganta' | '<creator name>'
  const [scopeOpen, setScopeOpen] = useState(false)
  const scopeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPublicGames(48).then(cloud => {
      if (!cloud) return
      setCommunity(cloud.map((g, i) => ({
        id: g.id, title: g.title, html: g.html, creator: g.creator, plays: g.plays,
        category: g.category || 'Community', hue: (g.title.charCodeAt(0) * 47 + i * 53) % 360,
      })))
    })
  }, [])

  // close the scope dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // category pills = All + every tag/category across both shelves
  const categories = useMemo(() => {
    const set = new Set<string>()
    GAMES.forEach(g => g.tags.forEach(t => set.add(t)))
    community.forEach(g => g.category && set.add(g.category))
    return ['All', ...Array.from(set).sort()]
  }, [community])

  // unique community creators, for the "filter by user" scope menu
  const creators = useMemo(() => Array.from(new Set(community.map(g => g.creator))).sort(), [community])

  const q = query.trim().toLowerCase()
  const matchCat = (cats: string[]) => filter === 'All' || cats.includes(filter)
  const matchText = (s: string[]) => !q || s.some(v => v.toLowerCase().includes(q))

  const showBuiltIns = scope === 'all' || scope === 'arganta'
  const builtIns = showBuiltIns
    ? GAMES.filter(g => matchCat(g.tags) && matchText([g.name, ...g.tags]))
    : []
  const made = scope === 'arganta'
    ? []
    : community.filter(g => (scope === 'all' || g.creator === scope) && matchCat([g.category]) && matchText([g.title, g.creator, g.category]))

  const total = GAMES.length + community.length
  const scopeLabel = scope === 'all' ? 'All games' : scope === 'arganta' ? 'By ArgantaLab' : scope

  return (
    <div className="screen lib">
      <div className="lib-head">
        <div className="kicker"><span className="live" />&nbsp;Ship · Library</div>
        <h1 className="h-title">Every game, <span className="g">one shelf</span></h1>
        <p className="lead">{total} game{total === 1 ? '' : 's'} built in ArgantaLab — flagship titles and community creations.</p>
      </div>

      {/* search bar + scope (filter by user / publisher) */}
      <div className="lib-search">
        <span className="lib-search-ic"><Search /></span>
        <input
          className="lib-search-in"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search games, creators, categories…"
        />
        {query && <button className="lib-search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>}
        <div className="lib-scope" ref={scopeRef}>
          <button className={`lib-scope-btn${scopeOpen ? ' on' : ''}`} onClick={() => setScopeOpen(o => !o)}>
            <span>{scopeLabel}</span><Chevron />
          </button>
          {scopeOpen && (
            <div className="lib-scope-menu">
              <button className={`lib-scope-opt${scope === 'all' ? ' on' : ''}`} onClick={() => { setScope('all'); setScopeOpen(false) }}>All games</button>
              <button className={`lib-scope-opt${scope === 'arganta' ? ' on' : ''}`} onClick={() => { setScope('arganta'); setScopeOpen(false) }}>By ArgantaLab</button>
              {creators.length > 0 && <div className="lib-scope-sep">Creators</div>}
              {creators.map(c => (
                <button key={c} className={`lib-scope-opt${scope === c ? ' on' : ''}`} onClick={() => { setScope(c); setScopeOpen(false) }}>
                  <span className="lib-scope-avatar">{c.charAt(0).toUpperCase()}</span>{c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* category filter rail (Apple App Store style) */}
      <div className="lib-filters">
        {categories.map(c => (
          <button key={c} className={`lib-filter${filter === c ? ' on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {/* ── By ArgantaLab — flagship titles ── */}
      {builtIns.length > 0 && (
        <>
          <div className="section-label">By ArgantaLab</div>
          <div className="lib-grid">
            {builtIns.map(g => (
              <button key={g.id} className="lib-card" onClick={() => openGame(g.id)}>
                <div className="lib-card-art" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
                {g.featured && <span className="lib-card-flag">⭐ Featured</span>}
                <div className="lib-card-body">
                  <div className="lib-card-top">
                    <div className="lib-card-titles">
                      <b>{g.name}</b>
                      <small>ArgantaLab</small>
                    </div>
                    <span className="lib-get"><Play /> Play</span>
                  </div>
                  <div className="lib-tags">{g.tags.map(t => <span key={t} className="lib-tag">{t}</span>)}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Community — kid-made & published ── */}
      {scope !== 'arganta' && (
        <>
          <div className="section-label">{scope === 'all' || scope === 'arganta' ? 'From the community' : `By ${scope}`}</div>
          {made.length > 0 ? (
            <div className="lib-grid">
              {made.map(g => (
                <button key={g.id} className="lib-card" onClick={() => playWizardGame(g.html, g.title, g.id)}>
                  <div className="lib-card-art" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
                  <div className="lib-card-body">
                    <div className="lib-card-top">
                      <div className="lib-card-titles">
                        <b>{g.title}</b>
                        <small>by {g.creator} · {g.plays} plays</small>
                      </div>
                      <span className="lib-get"><Play /> Play</span>
                    </div>
                    {g.category && <div className="lib-tags"><span className="lib-tag">{g.category}</span></div>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-games">
              <b>{q || filter !== 'All' ? 'No matching games' : 'No community games yet'}</b>
              <span>Build one in the Builder Lab and publish it — it shows up here.</span>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go({ tab: 'lab' })}>Open Builder Lab</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
