/**
 * REPLICAS — the mirror. Nine platforms, worn live (BK-2..BK-4).
 *
 * These are LOOK-ALIKES built from our own DOM and our own canvas, for previewing
 * our own brand. Nothing here fetches from a platform, embeds a platform's SDK,
 * or reproduces a platform's logo — a replica exists to answer "what does OUR
 * brand look like once it's over there", and stops precisely at that line. The
 * chrome is deliberately generic (a phone is a phone, a browser is a browser);
 * the only faithful part is the geometry that actually crops our artwork.
 *
 * Everything inside every frame is real: the avatar is drawMark(), the grid is
 * the postEngine's own drawSlide(), the banners are compose.ts — the same
 * function whose PNG the rack hands you. Where the registry has nothing, the
 * replica says so in cockpit vocabulary (NO HANDLE CLAIMED · AWAITING BIO)
 * rather than inventing plausible-looking filler. A mirror that flatters is
 * worse than no mirror (Law 02, Law 04).
 *
 * EDIT MODE: founder-lane text becomes an input IN PLACE — you edit the bio on
 * the phone, not in a form beside it. Agent-lane values (the mark, the palette)
 * never become inputs; they are git's, and the surface says so.
 */
import { useEffect, useRef, useState } from 'react'
import { variantForSize, validateField } from '@arganta/brand'
import { Mark, LivePost } from './scenes'
import { composeAsset, centredSafe, type ComposeKind, type Box } from './compose'

// ── the edit seam ─────────────────────────────────────────────
export interface EditCtl {
  on: boolean
  /** Current value for a founder-lane presence field, draft-aware. */
  get: (field: string) => string
  set: (field: string, value: string) => void
  /** platform id in specs.js terms, for char-limit validation. null → no limits. */
  specId: string | null
}

/** A founder-lane text field: reads live, becomes an input in edit mode, and
 *  carries its own platform limit. The counter is not decoration — TikTok's 80
 *  is the tightest constraint in the portfolio and you should feel it while
 *  typing, not after publishing. */
function F({ ctl, field, className, placeholder, multiline, children }: {
  ctl: EditCtl; field: string; className?: string; placeholder: string
  multiline?: boolean; children?: (v: string) => React.ReactNode
}) {
  const v = ctl.get(field)
  if (!ctl.on) {
    if (!v) return <span className={'bk-await ' + (className || '')}>{placeholder}</span>
    return <span className={className}>{children ? children(v) : v}</span>
  }
  const check = ctl.specId ? validateField(ctl.specId, field, v) : { ok: true, over: 0, max: null, len: v.length }
  const Tag: any = multiline ? 'textarea' : 'input'
  return (
    <span className="bk-edit-wrap">
      <Tag className={'bk-input ' + (className || '') + (check.ok ? '' : ' over')} value={v}
        rows={multiline ? 3 : undefined} placeholder={placeholder}
        onChange={(e: any) => ctl.set(field, e.target.value)} />
      {check.max != null && <i className={'bk-count' + (check.ok ? '' : ' over')}>{check.len}/{check.max}</i>}
    </span>
  )
}

/** What the founder lane does NOT own — shown the moment you enter edit mode,
 *  because that is exactly when "why can't I change the logo here?" occurs to
 *  you. The lock is the teaching: this lives in git and a coding agent owns it. */
export function Lock({ label }: { label: string }) {
  return <span className="bk-lock" title="Agent lane — lives in git, edited by a coding agent">⌗ {label}</span>
}

// ── device frames ─────────────────────────────────────────────
function Phone({ children, w = 288, h = 596, dark = true }: { children: React.ReactNode; w?: number; h?: number; dark?: boolean }) {
  return (
    <div className="bk-phone" style={{ width: w, height: h }}>
      <div className={'bk-screen' + (dark ? '' : ' light')}>
        <div className="bk-status">
          <span>9:41</span>
          <i className="bk-island" />
          <span className="bk-status-r"><b className="bk-sig" /><b className="bk-wifi" /><b className="bk-bat" /></span>
        </div>
        <div className="bk-screen-body">{children}</div>
      </div>
    </div>
  )
}

function Desktop({ children, url, doc, w = 706, h = 452 }: { children: React.ReactNode; url: string; doc: any; w?: number; h?: number }) {
  return (
    <div className="bk-desktop" style={{ width: w, height: h }}>
      <div className="bk-tabstrip">
        <div className="bk-tab">
          <span className="bk-favicon"><Mark doc={doc} size={12} variant={faviconVariant(doc)} active /></span>
          <span>{doc?.name}</span>
        </div>
      </div>
      <div className="bk-urlbar"><span className="bk-url">{url}</span></div>
      <div className="bk-viewport">{children}</div>
    </div>
  )
}

const faviconVariant = (doc: any) => {
  const m = doc?.identity?.mark
  return m ? variantForSize(m, 16) : 'core'
}

// ── a composed asset, on stage ────────────────────────────────
/** The canvas the rack would export, drawn at preview scale. Same call, same
 *  pixels, different zoom. */
function Composed({ doc, w, h, kind, safe, t = 1, className }: {
  doc: any; w: number; h: number; kind: ComposeKind; safe?: Box; t?: number; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    composeAsset(ctx, doc, w, h, kind, { safe, t })
  }, [doc, w, h, kind, t, safe?.x, safe?.y, safe?.w, safe?.h])
  return <canvas ref={ref} className={className} style={{ width: w, height: h, display: 'block' }} />
}

/** An app icon: the brand's ground, its mark, the platform's own corner radius.
 *  iOS ≈ 22.37% superellipse (approximated with a radius — the shape is close
 *  enough at preview size and the exported PNG is square anyway, because iOS
 *  masks it itself). */
function IconTile({ doc, size, radius, className }: { doc: any; size: number; radius: number; className?: string }) {
  const p = doc?.identity?.palette || {}
  return (
    <div className={'bk-icon ' + (className || '')} style={{ width: size, height: size, borderRadius: radius, background: p.bg || '#0A0D14' }}>
      <Mark doc={doc} size={size * 0.62} variant={doc?.identity?.mark ? variantForSize(doc.identity.mark, size * 0.62) : 'core'} active />
    </div>
  )
}

const handleOf = (doc: any, platform: string) => {
  const h = doc?.presence?.[platform]?.handle
  return h ? '@' + String(h).replace(/^@/, '') : null
}

export interface ReplicaProps { doc: any; ctl: EditCtl }

// ── 1 · INSTAGRAM ─────────────────────────────────────────────
export function RepInstagram({ doc, ctl }: ReplicaProps) {
  const ig = doc?.presence?.instagram || {}
  const highlights: string[] = ig.highlights || []
  return (
    <Phone>
      <div className="bk-ig-top">
        <span className="bk-back">‹</span>
        <b>{handleOf(doc, 'instagram') || 'unclaimed'}</b>
        <span className="bk-dots">⋯</span>
      </div>
      <div className="bk-ig-head">
        <div className="bk-ig-ring" style={{ background: `linear-gradient(135deg, ${doc?.identity?.palette?.accent || '#888'}, ${doc?.identity?.palette?.plateBg || '#fff'})` }}>
          <div className="bk-ig-ava"><Mark doc={doc} size={58} variant="core" active /></div>
        </div>
        <div className="bk-ig-stats">
          {[['12', 'posts'], ['—', 'followers'], ['—', 'following']].map(([n, l]) => (
            <div key={l}><b>{n}</b><span>{l}</span></div>
          ))}
        </div>
      </div>
      <div className="bk-ig-id">
        <F ctl={ctl} field="name" className="bk-ig-name" placeholder="NO DISPLAY NAME" />
        <span className="bk-ig-cat">{ig.category || <i className="bk-await">no category</i>}</span>
        <F ctl={ctl} field="bio" className="bk-ig-bio" placeholder="AWAITING BIO · FOUNDER LANE" multiline />
        <F ctl={ctl} field="link" className="bk-ig-link" placeholder="NO LINK">
          {v => <>{String(v).replace(/^https?:\/\//, '')}{ig.linkVerified ? '' : <i className="bk-unver"> · UNVERIFIED</i>}</>}
        </F>
      </div>
      <div className="bk-ig-btns"><span>Follow</span><span>Message</span><span>▾</span></div>
      <div className="bk-ig-high">
        {highlights.length ? highlights.map(h => (
          <div key={h} className="bk-ig-high-i">
            <div className="bk-ig-high-c"><Mark doc={doc} size={24} variant={faviconVariant(doc)} active /></div>
            <span>{h}</span>
          </div>
        )) : <span className="bk-await">no highlights planned</span>}
      </div>
      <div className="bk-ig-tabs"><i className="on">▦</i><i>◎</i></div>
      <div className="bk-ig-grid">
        {[0, 1, 0, 1, 0, 1].map((s, i) => (
          <LivePost key={i} doc={doc} active w={92} h={92} cycle={false} slide={s} />
        ))}
      </div>
    </Phone>
  )
}

// ── 2 · LINKEDIN ──────────────────────────────────────────────
export function RepLinkedIn({ doc, ctl }: ReplicaProps) {
  return (
    <Desktop doc={doc} url={`linkedin.com/company/${doc?.presence?.linkedin?.handle || doc.id}`}>
      <div className="bk-li">
        <Composed doc={doc} w={706} h={120} kind="banner" className="bk-li-banner" />
        <div className="bk-li-logo"><IconTile doc={doc} size={72} radius={8} /></div>
        <div className="bk-li-body">
          <F ctl={ctl} field="name" className="bk-li-name" placeholder="NO PAGE NAME" />
          <F ctl={ctl} field="tagline" className="bk-li-tag" placeholder="NO TAGLINE · 120 MAX" />
          <div className="bk-li-meta">{doc?.presence?.linkedin?.category || 'Software Development'} · Company · <i className="bk-await">— followers</i></div>
          <div className="bk-li-btns"><b>+ Follow</b><span>Visit website</span></div>
          <div className="bk-li-about">
            <h4>About</h4>
            <F ctl={ctl} field="bio" className="bk-li-abt" placeholder="AWAITING ABOUT · FOUNDER LANE · 2000 MAX" multiline />
          </div>
        </div>
      </div>
    </Desktop>
  )
}

// ── 3 · TIKTOK ────────────────────────────────────────────────
export function RepTikTok({ doc, ctl }: ReplicaProps) {
  return (
    <Phone>
      <div className="bk-tt-top"><span className="bk-back">‹</span><b>{handleOf(doc, 'tiktok') || 'unclaimed'}</b><span className="bk-dots">⋯</span></div>
      <div className="bk-tt-head">
        <div className="bk-tt-ava"><Mark doc={doc} size={62} variant="core" active /></div>
        <b className="bk-tt-handle">{handleOf(doc, 'tiktok') || <span className="bk-await">NO HANDLE CLAIMED</span>}</b>
        <div className="bk-tt-stats">
          {[['—', 'Following'], ['—', 'Followers'], ['—', 'Likes']].map(([n, l]) => (
            <div key={l}><b>{n}</b><span>{l}</span></div>
          ))}
        </div>
        <div className="bk-tt-bio"><F ctl={ctl} field="bio" placeholder="AWAITING BIO · 80 MAX — THE TIGHTEST IN THE PORTFOLIO" multiline /></div>
        <div className="bk-tt-btn">Edit profile</div>
      </div>
      <div className="bk-tt-tabs"><i className="on">▦</i><i>♡</i></div>
      <div className="bk-tt-grid">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bk-tt-cell"><Composed doc={doc} w={88} h={128} kind="story" /></div>
        ))}
      </div>
    </Phone>
  )
}

// ── 4 · YOUTUBE ───────────────────────────────────────────────
/** The only replica with a real instrument on it: YouTube crops the 2560×1440
 *  upload per device, and only the centre 1546×423 survives everywhere. The
 *  dashed box is drawn in DOM, over the canvas — never baked into the pixels
 *  the rack exports. */
export function RepYouTube({ doc, ctl }: ReplicaProps) {
  const W = 706, H = Math.round((1440 / 2560) * W)      // the full upload, to scale
  const safeW = Math.round((1546 / 2560) * W), safeH = Math.round((423 / 1440) * H)
  return (
    <Desktop doc={doc} url={`youtube.com/${handleOf(doc, 'youtube') || '@unclaimed'}`} h={470}>
      <div className="bk-yt">
        <div className="bk-yt-banner" style={{ width: W, height: H }}>
          <Composed doc={doc} w={W} h={H} kind="banner" safe={centredSafe({ w: W, h: H, safe: { w: safeW, h: safeH } })} />
          <div className="bk-yt-safe" style={{ width: safeW, height: safeH }}><span>SAFE · 1546×423</span></div>
        </div>
        <div className="bk-yt-body">
          <div className="bk-yt-ava"><Mark doc={doc} size={56} variant="core" active /></div>
          <div className="bk-yt-id">
            <F ctl={ctl} field="name" className="bk-yt-name" placeholder="NO CHANNEL NAME" />
            <div className="bk-yt-meta">{handleOf(doc, 'youtube') || <i className="bk-await">no handle</i>} · <i className="bk-await">— subscribers</i></div>
            <F ctl={ctl} field="bio" className="bk-yt-desc" placeholder="AWAITING DESCRIPTION · FOUNDER LANE" />
          </div>
          <div className="bk-yt-sub">Subscribe</div>
        </div>
        <div className="bk-yt-tabs"><i className="on">Home</i><i>Videos</i><i>Shorts</i><i>Playlists</i></div>
      </div>
    </Desktop>
  )
}

// ── 5 · X ─────────────────────────────────────────────────────
export function RepX({ doc, ctl }: ReplicaProps) {
  return (
    <Phone>
      <div className="bk-x-head">
        <Composed doc={doc} w={288} h={96} kind="banner" />
        <div className="bk-x-ava"><IconTile doc={doc} size={62} radius={31} /></div>
      </div>
      <div className="bk-x-body">
        <div className="bk-x-btn">Follow</div>
        <F ctl={ctl} field="name" className="bk-x-name" placeholder="NO NAME" />
        <div className="bk-x-handle">{handleOf(doc, 'x') || <span className="bk-await">NO HANDLE · 15 MAX IS THE BINDING CONSTRAINT</span>}</div>
        <F ctl={ctl} field="bio" className="bk-x-bio" placeholder="AWAITING BIO · 160 MAX" multiline />
        <div className="bk-x-meta">🗓 Joined — · <b>—</b> Following · <b>—</b> Followers</div>
      </div>
    </Phone>
  )
}

// ── 6 · iOS ───────────────────────────────────────────────────
/** The home screen — the only honest test of an icon. An icon that only works
 *  on a slide is an icon that fails at 60px between Messages and Maps. */
const DUMMIES = ['#3A3A3C', '#48484A', '#2C2C2E', '#3F3F41', '#38383A', '#444446']
export function RepIOS({ doc }: ReplicaProps) {
  const p = doc?.identity?.palette || {}
  return (
    <Phone dark>
      <div className="bk-ios" style={{ background: `radial-gradient(70% 50% at 50% 20%, ${p.bgAlt || p.bg || '#111'}, #06070B 75%)` }}>
        <div className="bk-ios-grid">
          {DUMMIES.slice(0, 4).map((c, i) => <div key={i} className="bk-ios-app"><div className="bk-ios-dummy" style={{ background: c }} /><span /></div>)}
          {DUMMIES.slice(0, 2).map((c, i) => <div key={i} className="bk-ios-app"><div className="bk-ios-dummy" style={{ background: c }} /><span /></div>)}
          <div className="bk-ios-app bk-ios-ours">
            <IconTile doc={doc} size={54} radius={12} />
            <span className="bk-ios-label">{doc?.name?.split(' ')[0]}</span>
          </div>
          {DUMMIES.slice(2, 5).map((c, i) => <div key={i} className="bk-ios-app"><div className="bk-ios-dummy" style={{ background: c }} /><span /></div>)}
          {DUMMIES.map((c, i) => <div key={i} className="bk-ios-app"><div className="bk-ios-dummy" style={{ background: c }} /><span /></div>)}
        </div>
        <div className="bk-ios-dock">
          {DUMMIES.slice(0, 3).map((c, i) => <div key={i} className="bk-ios-dummy" style={{ background: c }} />)}
          <IconTile doc={doc} size={54} radius={12} />
        </div>
      </div>
    </Phone>
  )
}

// ── 7 · ANDROID ───────────────────────────────────────────────
/** Adaptive icons are two layers the launcher masks to whatever shape the OEM
 *  chose — so the mark must survive a circle AND a squircle AND a rounded
 *  square, with everything vital inside the 66% safe zone. Three masks, one
 *  ring, no guessing. */
const MASKS: { id: string; label: string; radius: string }[] = [
  { id: 'circle', label: 'CIRCLE', radius: '50%' },
  { id: 'squircle', label: 'SQUIRCLE', radius: '30%' },
  { id: 'rounded', label: 'ROUNDED', radius: '18%' },
]
export function RepAndroid({ doc }: ReplicaProps) {
  const p = doc?.identity?.palette || {}
  return (
    <div className="bk-and">
      <Phone w={240} h={470}>
        <div className="bk-and-home" style={{ background: `linear-gradient(160deg, ${p.bgAlt || p.bg || '#111'}, #05070C)` }}>
          <div className="bk-and-grid">
            {DUMMIES.slice(0, 4).map((c, i) => <div key={i} className="bk-and-dummy" style={{ background: c }} />)}
            <div className="bk-and-ours"><div className="bk-and-mask" style={{ background: p.bg || '#0A0D14' }}><Mark doc={doc} size={28} variant={faviconVariant(doc)} active /></div><span>{doc?.name?.split(' ')[0]}</span></div>
            {DUMMIES.slice(0, 3).map((c, i) => <div key={i} className="bk-and-dummy" style={{ background: c }} />)}
            {DUMMIES.map((c, i) => <div key={i} className="bk-and-dummy" style={{ background: c }} />)}
          </div>
        </div>
      </Phone>
      <div className="bk-and-masks">
        <div className="bk-and-h">ADAPTIVE MASK · 108dp LAYERS</div>
        {MASKS.map(m => (
          <div key={m.id} className="bk-and-mrow">
            <div className="bk-and-mprev" style={{ borderRadius: m.radius, background: p.bg || '#0A0D14' }}>
              <Mark doc={doc} size={44} variant="core" active />
              <i className="bk-and-safe" />
            </div>
            <span>{m.label}</span>
          </div>
        ))}
        <div className="bk-and-note">▲ DASHED RING = 66% SAFE ZONE<br />ANYTHING OUTSIDE IT CAN BE MASKED OFF</div>
      </div>
    </div>
  )
}

// ── 8 · SPLASH (BK-4 — the design act) ────────────────────────
/**
 * The splash did not exist before this surface, so the replica IS the design:
 * ground holds, mark arrives, tagline follows, then it gets out of the way.
 * Deliberately the same gesture as the cockpit's own ignition (Law 11) — a
 * company whose app opens like its brand book opens is one system, and one
 * ignition grammar is cheaper to hold in your head than two.
 *
 * Driven by rAF over a real clock so the exported PNG (composeAsset at t=1) and
 * the animation are the same code at different t.
 */
const REDUCED = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function RepSplash({ doc }: ReplicaProps) {
  // Start at the beginning, not the end. Seeding t=1 painted one frame of the
  // FINISHED splash before rAF's first tick reset it to ~0 — a visible flash of
  // the punchline before the joke. Lazily seeded instead: 0 when we're going to
  // animate, 1 when we aren't, so the first paint is always already correct.
  const [t, setT] = useState(() => (REDUCED() ? 1 : 0))
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (REDUCED()) { setT(1); return }          // Law 12 — reduced motion is a path, not a fallback
    let raf = 0
    const start = performance.now()
    const DUR = 1500
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / DUR)
      setT(k)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // A backstop for the case where rAF never runs at all — a hidden tab, a
    // throttled preview pane. Without it the splash would sit at t=0 (bare
    // ground) forever and read as broken rather than as paused.
    const backstop = setTimeout(() => setT(v => (v === 0 ? 1 : v)), 700)
    return () => { cancelAnimationFrame(raf); clearTimeout(backstop) }
  }, [run])
  return (
    <div className="bk-splash">
      <Phone w={272} h={560}>
        <Composed doc={doc} w={272} h={528} kind="splash" t={t} />
      </Phone>
      <button className="bk-replay" onClick={() => setRun(r => r + 1)}>↻ REPLAY SEQUENCE</button>
      <div className="bk-splash-note">GROUND HOLDS · MARK ARRIVES · TAGLINE FOLLOWS<br />the same gesture as this cockpit's ignition — one system, one grammar</div>
    </div>
  )
}

// ── 9 · WEB ───────────────────────────────────────────────────
export function RepWeb({ doc }: ReplicaProps) {
  const url = doc?.routing?.siteUrl || `https://${doc.id}.arganta.app`
  return (
    <div className="bk-web">
      <div className="bk-tabrow">
        <div className="bk-tab live">
          <span className="bk-favicon"><Mark doc={doc} size={12} variant={faviconVariant(doc)} active /></span>
          <span>{doc?.name}</span><i>×</i>
        </div>
        <div className="bk-tab idle"><span className="bk-favicon dim" /><span>New Tab</span></div>
      </div>
      <div className="bk-web-note">FAVICON AT 16px — THE REAL TEST OF A GLYPH VARIANT</div>
      <div className="bk-og">
        <Composed doc={doc} w={420} h={220} kind="og" />
        <div className="bk-og-meta">
          <b>{doc?.name}</b>
          <span>{doc?.voice?.taglines?.en || <i className="bk-await">no tagline</i>}</span>
          <i>{url.replace(/^https?:\/\//, '')}</i>
        </div>
      </div>
      <div className="bk-web-note">OG CARD · 1200×630 — WHAT A SHARED LINK LOOKS LIKE</div>
    </div>
  )
}

export const REPLICAS: Record<string, (p: ReplicaProps) => JSX.Element> = {
  instagram: RepInstagram, linkedin: RepLinkedIn, tiktok: RepTikTok, youtube: RepYouTube,
  x: RepX, ios: RepIOS, android: RepAndroid, splash: RepSplash, web: RepWeb,
}
