import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CROPS, MAPS, LIVESTOCK, PROGRESSION, FARMS, ASSETS, QUESTS, CONFIG } from './data.js';
import { WorldMap } from './WorldMap.jsx';

// Optional Supabase client for the admin gate (reuses the ArgantaLab project).
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabase = url && anon ? createClient(url, anon, { auth: { storageKey: 'bloomcmd-auth' } }) : null;
const ADMIN_EMAILS = ['aldhyt.sukapradja@gmail.com'];

const NAV = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'world', label: 'World & Maps', icon: '🗺' },
  { id: 'entities', label: 'Entities & Content', icon: '🌱' },
  { id: 'progression', label: 'Progression', icon: '⭐' },
  { id: 'economy', label: 'Economy & Rewards', icon: '🌸' },
  { id: 'quests', label: 'Quests & Narrative', icon: '📜' },
  { id: 'players', label: 'Players & Farms', icon: '👥' },
  { id: 'assets', label: 'PixelLab Assets', icon: '🎨' },
  { id: 'config', label: 'Config', icon: '⚙' },
  { id: 'game', label: 'Game (embed)', icon: '🎮' },
];

const GAME_URL = (import.meta.env.VITE_LASHIRA_GAME_URL || 'http://localhost:5185') + '/?embed=command';

// Embeds the LashiraBloom game and hands it Command's Google session via
// postMessage — the plug-and-play test: the game reads its login from this app.
function GameEmbed() {
  const ref = useRef(null);
  const [status, setStatus] = useState('loading');
  function post() {
    if (!supabase) { setStatus('nosupa'); return; }
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      const msg = s?.access_token
        ? { type: 'lashira-auth', session: { access_token: s.access_token, refresh_token: s.refresh_token } }
        : { type: 'lashira-auth', signout: true };
      ref.current?.contentWindow?.postMessage(msg, '*');
    });
  }
  useEffect(() => {
    function onMsg(e) { if (e.data?.type === 'lashira-game-ready') { post(); setStatus('ready'); } }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="embed-head">
        <span>🎮 LashiraBloom — embedded, reading this Command's login</span>
        <span className={'badge ' + (status === 'ready' ? 'ok' : 'warn')}>{status === 'ready' ? 'session bridged' : 'starting…'}</span>
      </div>
      <div className="embed-wrap">
        <iframe ref={ref} title="LashiraBloom" src={GAME_URL} onLoad={post} allow="fullscreen; gamepad" />
      </div>
      <p className="muted sm" style={{ padding: '8px 14px' }}>Game dev server must be running (PlayLashiraBloom.bat / port 5185).</p>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('overview');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase());

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark"><i /></div>
          <div><div className="btitle">Bloom Command</div><div className="bsub">LashiraBloom · ops</div></div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={'navitem' + (view === n.id ? ' on' : '')} onClick={() => setView(n.id)}>
              <span className="ni">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidefoot">RPG-maker spine · farm → full RPG</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">{NAV.find((n) => n.id === view)?.label}</div>
          <div className="who">
            {supabase ? (
              user ? (
                <>
                  <span className={'badge ' + (isAdmin ? 'ok' : 'warn')}>{isAdmin ? 'admin' : 'viewer'}</span>
                  <span className="uemail">{user.email}</span>
                  <button className="gbtn sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
                </>
              ) : (
                <button className="gbtn sm" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}>
                  <b className="g">G</b> Admin sign in
                </button>
              )
            ) : <span className="badge warn">offline</span>}
          </div>
        </header>

        <div className={'content' + (view === 'world' ? ' bleed' : '')}>
          {view === 'overview' && <Overview />}
          {view === 'world' && <World />}
          {view === 'entities' && <Entities canEdit={isAdmin} />}
          {view === 'progression' && <Progression />}
          {view === 'economy' && <Economy />}
          {view === 'quests' && <Quests />}
          {view === 'players' && <Players />}
          {view === 'assets' && <Assets />}
          {view === 'config' && <Config />}
          {view === 'game' && <GameEmbed />}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, sub, tone }) {
  return <div className="metric"><div className="ml">{label}</div><div className="mv">{value}</div>{sub && <div className={'ms ' + (tone || '')}>{sub}</div>}</div>;
}
function Card({ title, icon, children, right }) {
  return <div className="card"><div className="chead"><h3>{icon} {title}</h3>{right}</div>{children}</div>;
}
function Bar({ pct, tone }) { return <div className="pbar"><span className={tone} style={{ width: pct + '%' }} /></div>; }
const statusPill = (s) => <span className={'pill ' + (s === 'live' ? 'v1' : 'later')}>{s === 'live' ? 'live' : 'planned'}</span>;

function Overview() {
  return (
    <>
      <div className="grid4">
        <Metric label="Players" value="142" sub="+18 this week" tone="good" />
        <Metric label="Active today" value="38" sub="27% of base" />
        <Metric label="Circle farms" value="31" sub="61% at Cottage+" />
        <Metric label="Rings / kid / day" value="4.2/6" sub="learning drives farm" tone="good" />
      </div>
      <div className="grid2">
        <Card title="Circle farms" icon="👥">
          {FARMS.map((f) => (
            <div className="lrow" key={f.circle}>
              <div className="lgrow"><b>{f.circle}</b><small>{f.stage}</small></div>
              <div style={{ width: 140 }}><Bar pct={f.pct} tone={f.pct > 55 ? 'good' : 'warn'} /></div>
            </div>
          ))}
        </Card>
        <Card title="Live ops" icon="⚡">
          <div className="ops">
            <button className="opbtn">🎉 Start Spring Festival</button>
            <button className="opbtn">🌰 Push seasonal seed drop</button>
            <button className="opbtn">❄ Advance to Summer</button>
          </div>
          <p className="muted sm">Next auto season tick in 3 days</p>
        </Card>
      </div>
      <Card title="The reward rule (enforced in Kingdom SQL)" icon="🔒">
        <p className="muted">Adults gain XP by playing; kids gain XP only by learning the 6 Worlds. Bloom (play) never converts to Diamonds (learning). Level → character power for both.</p>
      </Card>
    </>
  );
}

function World() {
  // Full-bleed map: the canvas IS the map, Google-Maps chrome floats on top.
  return <WorldMap />;
}

function Entities({ canEdit }) {
  return (
    <>
      <Card title="Crop catalog" icon="🌱" right={canEdit ? <button className="gbtn sm">+ New crop</button> : <span className="muted sm">read-only</span>}>
        <table className="tbl">
          <thead><tr><th>Crop</th><th>Season</th><th>Days</th><th>Seed</th><th>Sell</th><th>Gate</th></tr></thead>
          <tbody>{CROPS.map((c) => <tr key={c.id}><td>{c.emoji} {c.name}</td><td>{c.season}</td><td>{c.days}</td><td>🌸{c.cost}</td><td>🌸{c.sell}</td><td className="mono">{c.gate}</td></tr>)}</tbody>
        </table>
      </Card>
      <div className="grid2">
        <Card title="Livestock" icon="🐄">
          <table className="tbl"><thead><tr><th>Species</th><th>Produce</th><th>Sell</th></tr></thead>
            <tbody>{LIVESTOCK.map((l) => <tr key={l.id}><td>{l.emoji} {l.name}</td><td>{l.produce}</td><td>🌸{l.sell}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Kins (Harvest Sprites)" icon="🍃">
          <p className="muted">Befriended Kins from <span className="mono">person_creatures</span> assign to farm chores (water / harvest). Reused from ArgantaLab's Nexus roster — not a new system.</p>
        </Card>
      </div>
    </>
  );
}

function Progression() {
  return (
    <>
      <div className="grid2">
        <Card title="Leveling engine" icon="⭐">
          <p className="mono big">{PROGRESSION.levelFormula}</p>
          <p className="muted">{PROGRESSION.xpRule}</p>
        </Card>
        <Card title="Stat policy (level modifiers)" icon="📈">
          <table className="tbl"><thead><tr><th>Path</th><th>Growth</th></tr></thead>
            <tbody>{PROGRESSION.statPolicy.map((s) => <tr key={s.path}><td>{s.path}</td><td className="muted">{Object.entries(s).filter(([k]) => k !== 'path').map(([k, v]) => `${k} ${v}`).join(' · ')}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card title="Skills & Class Path (RPG-later, schema now)" icon="🗡">
        <p className="muted">Polymorphic <span className="mono">skill</span> (attack / effect / tool) + <span className="mono">class_path</span> + <span className="mono">target_option</span> + <span className="mono">owner_condition</span>. Farmer path ships now; Hero combat classes drop in as new rows for the Dungeon Hub — no re-architecture.</p>
      </Card>
    </>
  );
}

function Economy() {
  return (
    <>
      <div className="grid2">
        <Card title="🌸 Bloom" icon=""><p className="muted">Soft currency, earned by playing, shared per-circle-farm purse. <b>Never converts to Diamonds</b> — wall in schema.</p></Card>
        <Card title="💎 Diamonds" icon=""><p className="muted">Platform currency, cosmetics only. Kids mint by learning; adults by platform rules. Individual, not shared.</p></Card>
      </div>
      <Card title="Sell values (drop table)" icon="📦">
        <table className="tbl"><thead><tr><th>Item</th><th>Sells for</th></tr></thead>
          <tbody>{[...CROPS.map((c) => ({ n: c.emoji + ' ' + c.name, v: c.sell })), ...LIVESTOCK.map((l) => ({ n: l.produce, v: l.sell }))].map((r) => <tr key={r.n}><td>{r.n}</td><td>🌸{r.v}</td></tr>)}</tbody></table>
      </Card>
    </>
  );
}

function Quests() {
  return (
    <Card title="Quests" icon="📜" right={<span className="muted sm">beyond Reldens (which has none)</span>}>
      <table className="tbl"><thead><tr><th>Quest</th><th>Type</th><th>Gate</th><th>Reward</th></tr></thead>
        <tbody>{QUESTS.map((q) => <tr key={q.id}><td>{q.title}</td><td><span className="pill later">{q.type}</span></td><td className="mono">{q.gate}</td><td>{q.reward}</td></tr>)}</tbody></table>
    </Card>
  );
}

function Players() {
  return (
    <Card title="Circle farms & players" icon="👥">
      <table className="tbl"><thead><tr><th>Circle</th><th>Farm stage</th><th>Progress</th><th>Rings/day</th></tr></thead>
        <tbody>{FARMS.map((f) => <tr key={f.circle}><td>{f.circle}</td><td>{f.stage}</td><td style={{ minWidth: 120 }}><Bar pct={f.pct} tone={f.pct > 55 ? 'good' : 'warn'} /></td><td>{f.rings}</td></tr>)}</tbody></table>
      <p className="muted sm">Moderation + per-kid view wire to live Supabase reads (circle membership RLS).</p>
    </Card>
  );
}

function Assets() {
  return (
    <Card title="PixelLab assets" icon="🎨" right={<span className="muted sm">240 credits</span>}>
      {ASSETS.map((a) => (
        <div className="lrow" key={a.kind}>
          <div className="lgrow"><b>{a.kind}</b><small>{a.done}/{a.total}</small></div>
          <div style={{ width: 160 }}><Bar pct={Math.round((a.done / a.total) * 100)} tone={a.done ? 'accent' : 'warn'} /></div>
        </div>
      ))}
      <p className="muted sm">Placeholder in-code art now → PixelLab regenerate via the same texture keys.</p>
    </Card>
  );
}

function Config() {
  return (
    <Card title="Config registry" icon="⚙" right={<span className="muted sm">every tunable is a row</span>}>
      <table className="tbl"><thead><tr><th>Key</th><th>Value</th><th>Note</th></tr></thead>
        <tbody>{CONFIG.map((c) => <tr key={c.key}><td className="mono">{c.key}</td><td><b>{c.value}</b></td><td className="muted">{c.note}</td></tr>)}</tbody></table>
    </Card>
  );
}
