import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { buildSimplePrompt } from '@lib/promptBuilder'
import { saveMyGame, loadMyGames, newGameId, type SavedGame } from '@lib/myGames'
import { pushGame, setGameVisibility } from '@lib/gamesCloud'
import { bumpQuest } from '@lib/quests'
import { makeSlug } from '@lib/slug'
import DeviceFrame from '@components/build/DeviceFrame'

const CATEGORIES = ['Action', 'Arcade', 'Racing', 'Puzzle', 'Typing', 'Reflex', 'Adventure', 'Other']

// Builder Lab — a Claude-artifact-style single screen. Name it, pick a category,
// (optionally) grab an AI prompt, drop in your HTML, preview it across devices,
// and publish straight to the Library. No multi-step wizard.
export default function BuilderLab() {
  const { requireAuth, addXp, addToast, go, session, learnerName } = useAppStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Action')
  const [desc, setDesc] = useState('')
  const [code, setCode] = useState('')
  const [helper, setHelper] = useState(false)
  const [importer, setImporter] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const looksLikeGame = /<html|<!doctype|<canvas|<script/i.test(code)
  const canPublish = looksLikeGame && name.trim().length > 1

  // QA checklist — teaches testing: each check runs live on the pasted code.
  const qa = useMemo(() => ([
    { label: 'Is real HTML', pass: /<html|<!doctype/i.test(code) },
    { label: 'Has a game surface (canvas or script)', pass: /<canvas|<script/i.test(code) },
    { label: 'Fits on a phone (viewport tag)', pass: /viewport/i.test(code) },
    { label: 'Has a name', pass: name.trim().length > 1 },
  ]), [code, name])
  const qaPassed = qa.filter(q => q.pass).length

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') { addToast('Drop an .html file', '⚠️'); return }
    file.text().then(txt => {
      setCode(txt)
      if (!name.trim()) setName(file.name.replace(/\.html?$/i, ''))
      addToast('Code loaded from file', '📄')
    })
  }

  const publish = () => {
    if (!requireAuth('to publish games')) return
    const title = name.trim() || 'Untitled Game'
    const id = savedId || newGameId()
    const slug = makeSlug(title, id)
    const game: SavedGame = {
      id, title, source: 'procode', html: code, createdAt: Date.now(), plays: 0,
      category, desc: desc.trim() || undefined, published: true, slug,
    }
    saveMyGame(game)
    if (session && session !== 'loading') {
      pushGame(session.user.id, game)
      setGameVisibility(session.user.id, id, 'public', learnerName, slug)
    }
    if (!savedId) { addXp(60); bumpQuest('publish') }
    setSavedId(id)
    addToast(`Published “${title}” to the Library!`, '🚀')
  }

  return (
    <div className="lab">
      <div className="lab-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Builder Lab</div>
          <h1 className="lab-title">Drop your game in</h1>
        </div>
        <div className="lab-head-actions">
          <button className="btn btn-ghost" onClick={() => go({ tab: 'library' })}>📚 Library</button>
          <button className="btn btn-ghost" onClick={() => setImporter(true)}>🎬 Import from Studio</button>
          <button className="btn btn-soft" onClick={() => setHelper(true)}>✨ Prompt Helper</button>
        </div>
      </div>

      <div className="lab2">
        {/* ── Left: the form ── */}
        <div className="lab2-form">
          <div className="lab-field">
            <label>Game name</label>
            <input className="lab2-name" value={name} onChange={e => setName(e.target.value)} placeholder="Name your game…" />
          </div>

          <div className="lab-field">
            <label>Category</label>
            <div className="lab-chips">
              {CATEGORIES.map(c => (
                <button key={c} className={`lab-chip${category === c ? ' on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="lab-field">
            <label>Description <span className="lab2-opt">optional</span></label>
            <textarea className="lab2-desc" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="What's the game about? One or two lines." />
          </div>

          <div className="lab-field lab2-codefield">
            <label>Your game code (HTML)</label>
            <div
              className={`lab2-drop${dragOver ? ' over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <span className="lab2-drop-icon">📄</span>
              <b>Drop your .html file here</b>
              <span className="lab2-drop-sub">or paste the code below</span>
            </div>
            <textarea className="paste-area lab2-code" value={code} onChange={e => setCode(e.target.value)}
              placeholder={'<!DOCTYPE html>\n<html>\n  … paste your game here …\n</html>'} spellCheck={false} />
          </div>

          {code && (
            <div className="lab-field">
              <label>🧪 QA check {qaPassed === qa.length ? <span style={{ color: '#4ade80' }}>— CERTIFIED ✓</span> : <span className="lab2-opt">{qaPassed}/{qa.length} passing</span>}</label>
              <div style={{ display: 'grid', gap: 4 }}>
                {qa.map(q => (
                  <div key={q.label} style={{ fontSize: 12.5, opacity: q.pass ? 0.9 : 0.55 }}>
                    {q.pass ? '✅' : '⬜'} {q.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="lab2-foot">
            <button className="btn btn-primary lab2-publish" disabled={!canPublish} onClick={publish}>
              {savedId ? '✓ Update in Library' : '🚀 Publish to Library (+60 XP)'}
            </button>
            {savedId && (
              <button className="btn btn-ghost" onClick={() => go({ tab: 'library' })}>See it in the Library →</button>
            )}
          </div>
        </div>

        {/* ── Right: the viewer ── */}
        <div className="lab2-view">
          {looksLikeGame
            ? <DeviceFrame html={code} />
            : (
              <div className="preview-empty">
                <div className="pe-emoji">🎮</div>
                <b>Your game appears here</b>
                <span>Drop or paste HTML, then preview it on phone, tablet, and desktop.</span>
              </div>
            )}
        </div>
      </div>

      {helper && (
        <PromptHelper name={name} category={category} desc={desc} onClose={() => setHelper(false)} addToast={addToast} />
      )}
      {importer && (
        <StudioImporter onClose={() => setImporter(false)} onPick={g => {
          setCode(g.html)
          if (!name.trim()) setName(`${g.title} (Lab remix)`)
          setImporter(false)
          addToast(`Loaded “${g.title}” — the training wheels are off.`, '🎬')
        }} />
      )}
    </div>
  )
}

/* ── Import a Studio/wizard game's HTML as a starting point ── */
function StudioImporter({ onClose, onPick }: { onClose: () => void; onPick: (g: SavedGame) => void }) {
  const games = loadMyGames()
  return (
    <div className="lab2-overlay" onClick={onClose}>
      <div className="lab2-pop" onClick={e => e.stopPropagation()}>
        <div className="lab2-pop-head">
          <div>
            <div className="kicker">🎬 Import from Studio</div>
            <h3>Start from one of your games</h3>
          </div>
          <button className="lab2-x" onClick={onClose}>✕</button>
        </div>
        <p className="lab2-pop-sub">Loads the game's full HTML into the code bay so you can hand-edit it — the graduation path from wizard to pro.</p>
        {games.length === 0
          ? <p style={{ opacity: .6, fontSize: 13 }}>No saved games yet — build one in the Game Wizard first.</p>
          : <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflow: 'auto' }}>
              {games.map(g => (
                <button key={g.id} className="btn btn-soft" style={{ justifyContent: 'space-between' }} onClick={() => onPick(g)}>
                  <span>{g.title}</span>
                  <span style={{ opacity: .55, fontSize: 12 }}>{g.source}</span>
                </button>
              ))}
            </div>}
      </div>
    </div>
  )
}

/* ── Optional prompt-helper popup ── */
function PromptHelper({ name, category, desc, onClose, addToast }: {
  name: string; category: string; desc: string; onClose: () => void; addToast: (m: string, e?: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const prompt = buildSimplePrompt(name, category, desc)
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt) } catch { /* ignore */ }
    setCopied(true); addToast('Prompt copied — take it to Claude or ChatGPT.', '📋')
    setTimeout(() => setCopied(false), 2200)
  }
  return (
    <div className="lab2-overlay" onClick={onClose}>
      <div className="lab2-pop" onClick={e => e.stopPropagation()}>
        <div className="lab2-pop-head">
          <div>
            <div className="kicker">✨ Prompt Helper</div>
            <h3>Your AI prompt</h3>
          </div>
          <button className="lab2-x" onClick={onClose}>✕</button>
        </div>
        <p className="lab2-pop-sub">Paste this into Claude or ChatGPT, then drop the HTML it gives you back here.</p>
        <pre className="lab2-pop-prompt">{prompt}</pre>
        <div className="lab2-pop-actions">
          <button className={`btn ${copied ? 'btn-soft' : 'btn-primary'}`} onClick={copy}>{copied ? '✓ Copied!' : '📋 Copy prompt'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
