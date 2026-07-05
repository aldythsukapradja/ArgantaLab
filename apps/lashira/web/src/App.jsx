import { useEffect, useState } from 'react';
import Welcome from './ui/Welcome.jsx';
import CharacterGate from './ui/CharacterGate.jsx';
import FarmRoom from './game/FarmRoom.jsx';
import { currentProfile, profileForUser, onAuth, signOut } from './net/account.js';
import { useHostSupabase } from './net/supabase.js';
import { fetchHeroState } from './net/hero.js';

// Dual-mode, mirroring Kingdom Heroes:
//   • standalone (no props)      -> own Welcome/login.
//   • embedded (any ArgantaLab app / Bloom Command iframe) -> `embedded` hides
//     the standalone login; `hostSupabase`+`hostUser` (React embed) or a
//     postMessage session (iframe embed, adopted in main.jsx) supply the login.
// This is the plug-and-play test: the game reads its login from the parent app.
export default function App({ hostSupabase = null, hostUser = null, embedded = false } = {}) {
  if (hostSupabase) useHostSupabase(hostSupabase); // point at host client before any auth call

  const [profile, setProfile] = useState(null);
  const [checked, setChecked] = useState(false);
  const [hero, setHero] = useState(null);
  const [heroChecked, setHeroChecked] = useState(false);
  const [playAnyway, setPlayAnyway] = useState(false);

  // resolve the initial session
  useEffect(() => {
    let alive = true;
    (async () => {
      if (hostUser) { const p = await profileForUser(hostUser); if (alive && p) setProfile(p); }
      else { const p = await currentProfile(); if (alive && p) setProfile(p); }
    })().finally(() => { if (alive) setChecked(true); });
    // In embed mode the session may arrive later (postMessage -> setSession).
    const unsub = onAuth(async (user) => {
      if (!alive) return;
      if (user) { const p = await profileForUser(user); if (alive) setProfile(p); }
      else if (embedded) setProfile(null); // host signed out
    });
    return () => { alive = false; unsub(); };
  }, [hostUser, embedded]);

  // fetch the Kingdom Heroes character for the signed-in player
  useEffect(() => {
    if (!profile) return;
    if (profile.guest) { setHero(null); setHeroChecked(true); return; }
    let alive = true;
    setHeroChecked(false);
    fetchHeroState().then((h) => { if (alive) { setHero(h); setHeroChecked(true); } });
    return () => { alive = false; };
  }, [profile]);

  if (import.meta.env.DEV) window.__appState = { checked, profile, embedded, heroChecked };
  if (!checked) return <div className="loading">Loading LashiraBloom…</div>;

  // Embedded and no session yet -> wait for the host to hand one down.
  if (embedded && !profile) return <div className="loading">Connecting to ArgantaLab…</div>;
  if (!profile) return <Welcome onReady={setProfile} />;

  if (!profile.guest && !heroChecked) return <div className="loading">Finding your hero…</div>;

  const hasHero = !!(hero?.character && hero?.spec);
  if (!profile.guest && !hasHero && !playAnyway) {
    return <CharacterGate profile={profile} onPlayAnyway={() => setPlayAnyway(true)}
      onSignOut={embedded ? undefined : async () => { await signOut(); setProfile(null); setHero(null); setPlayAnyway(false); }} />;
  }

  const eff = hero?.profile
    ? { ...profile, diamonds: hero.profile.diamonds ?? profile.diamonds, xp: hero.profile.xp ?? profile.xp, level: hero.profile.level ?? profile.level, displayName: hero.profile.display_name || profile.displayName, role: hero.profile.role || profile.role }
    : profile;

  return <FarmRoom profile={eff} hero={hasHero ? hero : null} key={eff.id} />;
}
