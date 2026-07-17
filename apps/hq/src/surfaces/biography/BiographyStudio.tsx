/**
 * BIOGRAPHY STUDIO — the identity engine of the Arganta ecosystem.
 *
 * One editable Master Profile per persona; the CV Maker, Intro Deck and Journey
 * Timeline are lenses over it. A profile switcher makes the whole surface
 * persona-agnostic — the founder's real record, the Arganta public twin, and any
 * future AI influencer all render through the same four tabs.
 *
 * Design language is deliberately NOT the neon HQ dashboard: this is an
 * executive dossier — warm paper, ink, one accent — because it prints to A4 and
 * gets screenshared to investors. Both the dossier and the cinematic stages
 * (Intro Deck, Journey) follow the HQ light/dark theme; the twin is signalled
 * by its accent colour and pinned rules card, not by forcing its own palette.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, BookUser, Presentation, Route, Printer, RotateCcw, Undo2, Download, Check, ChevronDown, Linkedin } from 'lucide-react'
import { MasterPrint } from './MasterPrint'
import { useBio, type BioTab } from './biography'
import { MasterProfile } from './MasterProfile'
import { CvMaker } from './CvMaker'
import { IntroDeck } from './IntroDeck'
import { JourneyTimeline } from './JourneyTimeline'
import { profileToMarkdown, profileToLinkedIn } from './exportCore'
import './biography.css'

const TABS: { id: BioTab; label: string; Icon: typeof FileText }[] = [
  { id: 'master', label: 'Master Profile', Icon: BookUser },
  { id: 'cv', label: 'CV Maker', Icon: FileText },
  { id: 'deck', label: 'Intro Deck', Icon: Presentation },
  { id: 'journey', label: 'Journey', Icon: Route },
]

export function BiographyStudio() {
  const { profiles, activeId, setActive, tab, setTab, undo, reset, savedAt, history } = useBio()
  const p = useMemo(() => profiles.find(x => x.id === activeId)!, [profiles, activeId])
  const [menu, setMenu] = useState(false)
  const [pick, setPick] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1200)
    return () => clearTimeout(t)
  }, [savedAt])

  // Ctrl+Z anywhere on the surface — but never while a field has the caret,
  // where the browser's own undo is the right one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault(); undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const [copiedWhat, setCopiedWhat] = useState('')

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true); setCopiedWhat(what)
    setTimeout(() => setCopied(false), 1800); setMenu(false)
  }
  const exportCore = () => copy(profileToMarkdown(p), 'Core')
  const exportLinkedIn = () => copy(profileToLinkedIn(p), 'LinkedIn')

  const printRoot = typeof document !== 'undefined' ? document.getElementById('print-root') : null

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.id}-profile.json`
    a.click(); URL.revokeObjectURL(a.href); setMenu(false)
  }

  return (
    <div className={'bio bio-' + p.kind} data-tab={tab} style={{ '--accent': p.deck.accent } as React.CSSProperties}>
      <header className="bio-top">
        <div className="bio-switch">
          <button type="button" className="bio-switch-btn" onClick={() => setPick(o => !o)}>
            <img src={p.identity.photo} alt="" />
            <span><b>{p.label}</b><em>{p.kind === 'twin' ? 'Public twin' : 'Real record'}</em></span>
            <ChevronDown size={13} />
          </button>
          {pick && (
            <>
              <div className="bio-back" onClick={() => setPick(false)} />
              <div className="bio-switch-menu">
                {profiles.map(x => (
                  <button key={x.id} type="button" className={x.id === activeId ? 'on' : ''}
                    onClick={() => { setActive(x.id); setPick(false) }}>
                    <img src={x.identity.photo} alt="" />
                    <span><b>{x.label}</b><em>{x.kind === 'twin' ? 'Public twin — aliased employers' : 'Real record — private'}</em></span>
                  </button>
                ))}
                <div className="bio-switch-note">New personas (AI influencers) plug in here — every tab renders them unchanged.</div>
              </div>
            </>
          )}
        </div>

        <nav className="bio-tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={'bio-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </nav>

        <div className="bio-acts">
          <span className={'bio-saved' + (saved ? ' on' : '')}>Saved</span>
          <button type="button" className="bio-btn" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
          {tab !== 'deck' && tab !== 'journey' && (
            <button type="button" className="bio-btn bio-btn-go" onClick={() => window.print()}><Printer size={13} /> Export PDF</button>
          )}
          <div className="bio-menu-wrap">
            <button type="button" className="bio-btn" onClick={() => setMenu(o => !o)}>···</button>
            {menu && (
              <>
                <div className="bio-back" onClick={() => setMenu(false)} />
                <div className="bio-menu">
                  <button type="button" onClick={exportLinkedIn}>
                    {copied && copiedWhat === 'LinkedIn' ? <Check size={12} /> : <Linkedin size={12} />}
                    {copied && copiedWhat === 'LinkedIn' ? 'Copied — paste into LinkedIn' : 'Copy for LinkedIn'}
                  </button>
                  <button type="button" onClick={exportCore}>
                    {copied && copiedWhat === 'Core' ? <Check size={12} /> : <Download size={12} />}
                    {copied && copiedWhat === 'Core' ? 'Copied to clipboard' : 'Export for Core (markdown)'}
                  </button>
                  <button type="button" onClick={exportJson}><Download size={12} /> Export JSON</button>
                  <button type="button" className="danger" onClick={() => { reset(p.id); setMenu(false) }}>
                    <RotateCcw size={12} /> Reset {p.label} to ground truth
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="bio-body">
        {tab === 'master' && <div className="bio-scroll"><MasterProfile /></div>}
        {/* The master record's own print artifact — CvMaker portals its own page,
            but without this the Master tab's Export PDF prints a blank sheet. */}
        {tab === 'master' && printRoot && createPortal(<div className="bio-print"><MasterPrint p={p} /></div>, printRoot)}
        {tab === 'cv' && <CvMaker />}
        {tab === 'deck' && <IntroDeck />}
        {tab === 'journey' && <JourneyTimeline />}
      </div>
    </div>
  )
}
