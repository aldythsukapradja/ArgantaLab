import { useEffect, useMemo, useRef, useState } from 'react';
import Welcome from './ui/Welcome.jsx';
import Onboarding from './ui/Onboarding.jsx';
import FarmRoom from './game/FarmRoom.jsx';
import RealmRoom from './game/RealmRoom.jsx';
import { currentProfile, profileForUser, onAuth, signOut } from './net/account.js';
import { useHostSupabase } from './net/supabase.js';
import { fetchHeroState } from './net/hero.js';
import { needsOnboarding, loadGuestOnboarding } from './net/onboarding.js';
import { listMyCircles } from './net/circles.js';
import { loadOpenworldState, saveOpenworldState } from './game/openworld-save.js';
import { worldMapById } from './game/world-map-registry.js';

// Dual-mode, mirroring Kingdom Heroes:
//   • standalone (no props)      -> own Welcome/login.
//   • embedded (any ArgantaLab app / Bloom Command iframe) -> `embedded` hides
//     the standalone login; `hostSupabase`+`hostUser` (React embed) or a
//     postMessage session (iframe embed, adopted in main.jsx) supply the login.
// This is the plug-and-play test: the game reads its login from the parent app.
export default function App({ hostSupabase = null, hostUser = null, embedded = false, circleId = null } = {}) {
  if (hostSupabase) useHostSupabase(hostSupabase); // point at host client before any auth call

  // ?circle=<id> lets an embedding host (e.g. KinetikCircle) tie the farm save
  // to a circle instead of the individual account — every member of that
  // circle who opens the farm shares one save. Prop takes precedence (React
  // embed); query param covers the iframe embed path.
  const urlCircleId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('circle') : null;
  const effCircleId = circleId || urlCircleId || null;

  const [profile, setProfile] = useState(null);
  const [checked, setChecked] = useState(false);
  const [hero, setHero] = useState(null);
  const [heroChecked, setHeroChecked] = useState(false);
  const [playAnyway, setPlayAnyway] = useState(false);
  const lastAppliedUserId = useRef(null);
  const [worldScope, setWorldScope] = useState(null);
  const [hqSpawn, setHqSpawn] = useState(null);
  // A realm left open last session (tab closed / backgrounded without hitting
  // the in-game Exit button) — offered as an OPT-IN "continue?" banner on the
  // main app instead of auto-booting straight into it. Boot always lands on
  // the farm now; see the loadOpenworldState effect below.
  const [resumeRealm, setResumeRealm] = useState(null);
  // bump to re-read the local guest-onboarding stamp after the wizard finishes
  const [onboardTick, setOnboardTick] = useState(0);

  // Circle SELECTOR (Settings → Circle sync): which circle's shared farm is
  // active. Starts from the embed/URL circle, is user-switchable in-game, and the
  // choice persists per account. `myCircles` powers the picker list.
  const [myCircles, setMyCircles] = useState([]);
  const [activeCircleId, setActiveCircleId] = useState(effCircleId);
  useEffect(() => { setActiveCircleId(effCircleId); }, [effCircleId]);

  // Multi-farm scope — reachable via the in-game Travel picker (Home hub).
  // Default stays the CIRCLE farm (unchanged landing for the real, family-used
  // embed path); personal + visiting are new, additively-reachable destinations.
  //   { kind: 'circle' }                       -> today's shared circle farm
  //   { kind: 'personal' }                      -> your own farm, editable
  //   { kind: 'visit', ownerId, ownerName }      -> read-only view of theirs
  const [farmScope, setFarmScope] = useState({ kind: 'circle' });

  // resolve the initial session
  useEffect(() => {
    let alive = true;
    async function applyUser(user) {
      if (!alive) return;
      if (user) {
        const nextUserId = String(user.id || '');
        if (nextUserId && lastAppliedUserId.current === nextUserId) return;
        const p = await profileForUser(user);
        if (alive) {
          lastAppliedUserId.current = nextUserId;
          setProfile((prev) => (prev?.id === p?.id ? { ...prev, ...p } : p));
        }
      } else if (embedded) {
        lastAppliedUserId.current = null;
        setProfile(null);
      }
    }
    (async () => {
      if (hostUser) await applyUser(hostUser);
      else if (embedded && window.__lashiraEmbeddedAuthUser !== undefined) await applyUser(window.__lashiraEmbeddedAuthUser);
      else if (!embedded) { const p = await currentProfile(); if (alive && p) setProfile(p); }
    })().finally(() => { if (alive) setChecked(true); });
    // In embed mode the session may arrive later (postMessage -> setSession).
    const unsub = onAuth(applyUser);
    const onHostAuth = (event) => { applyUser(event.detail?.user || null); };
    if (embedded) window.addEventListener('lashira-host-auth', onHostAuth);
    return () => {
      alive = false;
      unsub();
      if (embedded) window.removeEventListener('lashira-host-auth', onHostAuth);
    };
  }, [hostUser, embedded]);

  // fetch the Kingdom Heroes character for the signed-in player
  useEffect(() => {
    if (!profile) return;
    if (profile.guest) { setHero(null); setHeroChecked(true); return; }
    let alive = true;
    setHeroChecked(false);
    fetchHeroState().then((h) => { if (alive) { setHero(h); setHeroChecked(true); } });
    return () => { alive = false; };
  }, [profile?.id, profile?.guest]);

  // Start always lands on the main farm — a realm left open last session
  // (closed tab / backgrounded app / crash, none of which run RealmRoom's own
  // exit() cleanup) used to silently boot straight back into it, which read
  // as "always starts in a random one of the 5 worlds". Now it only offers a
  // resume banner (see resumeRealm below); entering a realm always requires
  // an explicit tap (this banner's Continue, or an in-game portal).
  useEffect(() => {
    if (!profile || profile.guest) return undefined;
    let alive = true;
    loadOpenworldState(profile, null)
      .then(({ data }) => {
        if (!alive || !data?.currentRealmId) return;
        setResumeRealm({
          realmId: data.currentRealmId,
          hqTile: data.hqTile || null,
          hqFacing: data.hqFacing || 'South',
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [profile?.id, profile?.guest]);

  function continueResumeRealm() {
    if (!resumeRealm) return;
    setWorldScope(resumeRealm);
    setResumeRealm(null);
  }
  // "No thanks" — clear it locally AND in the cloud save, so it doesn't keep
  // nagging every future login (best-effort; a failed write just means the
  // banner may reappear next time, not a real error to surface).
  async function dismissResumeRealm() {
    setResumeRealm(null);
    if (!profile || profile.guest) return;
    try {
      const { data } = await loadOpenworldState(profile, null);
      await saveOpenworldState(profile, null, { ...data, currentRealmId: null });
    } catch { /* best-effort */ }
  }

  // Load the circles this player belongs to + restore their last active choice.
  useEffect(() => {
    if (!profile || profile.guest) { setMyCircles([]); return undefined; }
    let alive = true;
    listMyCircles().then((cs) => {
      if (!alive) return;
      setMyCircles(cs);
      if (!cs.length) return;
      let persisted = null;
      try { persisted = localStorage.getItem('lashira_active_circle_' + profile.id) || null; } catch { /* ignore */ }
      const want = persisted || effCircleId;
      if (want && cs.some((c) => c.id === want)) setActiveCircleId(want);
      else if (!effCircleId) setActiveCircleId(null); // no embed circle → default to personal until chosen
    });
    return () => { alive = false; };
  }, [profile?.id, profile?.guest, effCircleId]);

  // Switch the active circle (from Settings). Persists per account and lands you
  // on that circle's shared farm; distinct from Travel's read-only "visit".
  function onSelectCircle(id) {
    setActiveCircleId(id || null);
    setFarmScope({ kind: id ? 'circle' : 'personal' });
    try {
      if (!profile?.guest) localStorage.setItem('lashira_active_circle_' + profile.id, id || '');
    } catch { /* ignore */ }
  }

  // The wizard finished — re-read state so the gate clears and the chosen hero shows.
  function handleOnboarded() {
    if (profile?.guest) { setOnboardTick((t) => t + 1); return; }
    setHeroChecked(false);
    fetchHeroState().then((h) => { setHero(h); setHeroChecked(true); });
  }

  // Sign out back to Welcome. Only meaningful standalone — an embedded session
  // belongs to the host app (KinetikCircle/ArgantaLab), which owns sign-in/out;
  // this game never ends that session, so the button is hidden entirely when
  // `embedded` (see the `embedded ? null : handleSignOut` below).
  async function handleSignOut() {
    await signOut();
    setProfile(null); setHero(null); setPlayAnyway(false);
    setWorldScope(null); setHqSpawn(null); setFarmScope({ kind: 'circle' }); setResumeRealm(null);
  }

  // Guests can't write to the cloud, so their wizard result lives in localStorage;
  // build a pseudo-hero from it so the farmer they made actually renders.
  const guestOnb = useMemo(
    () => (profile?.guest ? loadGuestOnboarding(profile) : null),
    [profile?.id, profile?.guest, onboardTick],
  );

  if (import.meta.env.DEV) window.__appState = { checked, profile, embedded, heroChecked };
  if (!checked) return <div className="loading">Loading LashiraBloom…</div>;

  // Embedded and no session yet -> wait for the host to hand one down.
  if (embedded && !profile) return <div className="loading">Connecting to ArgantaLab…</div>;
  if (!profile) return <Welcome onReady={setProfile} />;

  if (!profile.guest && !heroChecked) return <div className="loading">Finding your hero…</div>;

  // FORCED ONBOARDING — everyone sets up first. The wizard is skipped only once
  // the character is no longer in default settings (see needsOnboarding). Guests
  // onboard locally; signed-in players get the canonical character written to the
  // cloud that every ArgantaLab world reads.
  if (needsOnboarding(hero, profile)) {
    return <Onboarding
      profile={profile}
      onComplete={handleOnboarded}
      onExit={embedded ? undefined : handleSignOut}
    />;
  }

  // A guest's chosen look lives in localStorage — surface it as their hero so the
  // farmer they built renders (signed-in players use their real cloud hero).
  const effHero = profile.guest
    ? (guestOnb ? { character: { name: guestOnb.nickname }, spec: guestOnb.spec } : null)
    : hero;
  const hasHero = !!(effHero?.character && effHero?.spec);

  const eff = hero?.profile
    ? { ...profile, diamonds: hero.profile.diamonds ?? profile.diamonds, xp: hero.profile.xp ?? profile.xp, level: hero.profile.level ?? profile.level, displayName: hero.profile.display_name || profile.displayName, role: hero.profile.role || profile.role }
    : profile;

  // Resolve the ACTIVE scope into what FarmRoom/FarmLogic need. Personal +
  // visit are both circle-independent (circleId=null); visit additionally
  // carries the owner's id/name so FarmLogic loads read-only. `homeCircleId`
  // stays available regardless of active scope so the Travel picker can always
  // list your circle-mates, even while on your personal farm or visiting.
  const isVisit = farmScope.kind === 'visit';
  const scopeCircleId = farmScope.kind === 'circle' ? activeCircleId : null;
  const scopeKey = farmScope.kind === 'circle' ? 'circle:' + (activeCircleId || '')
    : isVisit ? 'visit:' + farmScope.ownerId
      : 'personal';

  if (worldScope?.realmId) {
    return <RealmRoom
      profile={eff}
      hero={hasHero ? effHero : null}
      realmId={worldScope.realmId}
      circleId={activeCircleId}
      hqTile={worldScope.hqTile}
      hqFacing={worldScope.hqFacing}
      onExit={(returnTile) => {
        setHqSpawn({ tile: returnTile || worldScope.hqTile || null, facing: worldScope.hqFacing || 'South' });
        setWorldScope(null);
      }}
      key={eff.id + ':realm:' + worldScope.realmId}
    />;
  }

  return (
    <>
      {resumeRealm && (
        <div className="resume-banner">
          <span>Continue in {worldMapById(resumeRealm.realmId).name}?</span>
          <button type="button" className="rb-go" onClick={continueResumeRealm}>Continue</button>
          <button type="button" className="rb-x" onClick={dismissResumeRealm} aria-label="Dismiss">✕</button>
        </div>
      )}
      <FarmRoom
        profile={eff}
        hero={hasHero ? effHero : null}
        circleId={scopeCircleId}
        visitOwnerId={isVisit ? farmScope.ownerId : null}
        visitOwnerName={isVisit ? farmScope.ownerName : null}
        homeCircleId={activeCircleId}
        myCircles={myCircles}
        activeCircleId={activeCircleId}
        onSelectCircle={onSelectCircle}
        onSignOut={embedded ? null : handleSignOut}
        onTravel={setFarmScope}
        onPortalTravel={(realmId, ctx) => setWorldScope({
          realmId,
          hqTile: ctx?.hqTile || null,
          hqFacing: ctx?.hqFacing || 'South',
        })}
        initialTile={hqSpawn?.tile || null}
        initialFacing={hqSpawn?.facing || 'South'}
        key={eff.id + ':' + scopeKey + ':' + (hqSpawn?.tile ? hqSpawn.tile.join(',') : 'spawn')}
      />
    </>
  );
}
