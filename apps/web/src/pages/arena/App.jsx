import { useEffect, useRef, useState } from 'react';
import CharacterLab from './lab/CharacterLab.jsx';
import AccountBar from './components/AccountBar.jsx';
import TestRoom from './room/TestRoom.jsx';
import {
  authAvailable, onAuth, currentUser, isKidUser, useHostSupabase,
  fetchPlayerState, normalizePlayerState, saveDraftLoadout, saveLoadout,
  syncCharacterBuild, resetCharacterDraft, renameGuardian,
  startCharacterSession, heartbeatSession, endCharacterSession,
  getSessionEvents, ackSessionEvent, getOnlineFriends, signOut,
} from './net/account.js';

const EMPTY_ACCOUNT = {
  user: null,
  profile: null,
  character: null,
  accountType: 'adult',
  cloudSpec: null,
  draftSpec: null,
  syncedSpec: null,
  stats: null,
  guardian: null,
  loadout: null,
  presence: null,
  session: null,
  friends: [],
  saveState: '',
  loading: false,
  applyToken: 0,   // bump to make the composer re-apply cloudSpec (login/reset)
};

// Dual-mode. Standalone (kingdom deploy): no props -> own Google/kid login.
// Embedded (ArgantaLab/Kingdom Command): pass `hostSupabase` (the site's
// authed client) + `hostUser` (the site's session user) so the Lab reuses the
// host session and never shows a login; `embedded` hides the standalone header.
// `arenaOnly` (ArgantaLab embed): land straight in Buya Arena, no header, no
// Composer — character BUILDING is Kingdom-only, so kids in ArgantaLab can
// play but not rebuild. Standalone Kingdom (no props) is unaffected.
export default function App({ hostSupabase = null, hostUser = null, embedded = false, arenaOnly = false } = {}) {
  // point the whole Lab at the host client before any auth/DB call runs
  if (hostSupabase) useHostSupabase(hostSupabase);

  const [view, setView] = useState(arenaOnly ? 'room' : 'lab');
  const specRef = useRef(null);
  const [roomSpec, setRoomSpec] = useState(null);
  const [forcedLogout, setForcedLogout] = useState(null);

  // ---- account state (MP-0): user + kinetik profile + kingdom character ----
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const accountRef = useRef(account);
  const lastHydratedUserRef = useRef(null);
  accountRef.current = account;

  function mergePlayerState(rawState, saveState = 'Synced') {
    const current = accountRef.current;
    const user = current.user;
    const accountType = user ? (isKidUser(user) ? 'kid' : 'adult') : current.accountType;
    const state = rawState?.profile
      ? normalizePlayerState(rawState, user, accountType)
      : rawState;
    if (!state) return null;
    setAccount((prev) => ({
      ...prev,
      ...state,
      user: user || state.user || prev.user,
      session: prev.session,
      friends: prev.friends || [],
      saveState,
      loading: false,
    }));
    return state;
  }

  async function refreshAccount(options = {}) {
    const user = accountRef.current.user;
    if (!user) return null;
    const state = await fetchPlayerState(user);
    if (!state) return null;
    setAccount((prev) => ({
      ...prev,
      ...state,
      user,
      session: prev.session,
      friends: prev.friends || [],
      saveState: options.saveState ?? prev.saveState ?? 'Synced',
      loading: false,
    }));
    return state;
  }

  useEffect(() => {
    if (!authAvailable) return;
    let sub;
    async function hydrate(user) {  // eslint-disable-line no-inner-declarations
      clearTimeout(handleSpec._t);
      if (!user) {
        lastHydratedUserRef.current = null;
        setAccount(EMPTY_ACCOUNT);
        setRoomSpec(null);
        setView('lab');
        return;
      }
      if (lastHydratedUserRef.current === user.id) return;
      lastHydratedUserRef.current = user.id;
      const accountType = isKidUser(user) ? 'kid' : 'adult';
      setAccount((prev) => ({ ...prev, user, accountType, loading: true, saveState: 'Loading account...' }));
      const state = await fetchPlayerState(user);
      let session = null;
      if (state?.character?.id && !state.migrationMissing) {
        const sessionResult = await startCharacterSession(state.character.id, navigator.userAgent?.slice(0, 80) || 'web');
        if (sessionResult.session) session = sessionResult.session;
      }
      setAccount((prev) => ({
        ...EMPTY_ACCOUNT,
        ...(state || {}),
        user,
        accountType: state?.accountType || accountType,
        session,
        saveState: state?.character ? 'Synced' : '',
        loading: false,
        applyToken: (prev.applyToken || 0) + 1,   // apply the loaded build once
      }));
      if (state?.character) {
        getOnlineFriends().then((friends) => {
          setAccount((prev) => prev.user?.id === user.id ? ({ ...prev, friends }) : prev);
        });
      }
    }
    // ArgantaLab injects a live client + user object (React embed): the host
    // owns auth, so hydrate straight from it. Everyone else — standalone AND the
    // Kingdom Command iframe — uses our OWN client + listeners: standalone shows
    // a login; Command feeds a session via setSession (main.jsx), which fires
    // onAuth and lands here.
    if (hostSupabase) {
      hydrate(hostUser);
      return undefined;
    }
    currentUser().then(hydrate);
    sub = onAuth(hydrate);
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [hostSupabase, hostUser?.id]);

  function handleSpec(spec) {
    specRef.current = spec;
    const a = accountRef.current;
    if (a.character) {
      clearTimeout(handleSpec._t);
      setAccount((prev) => ({
        ...prev,
        cloudSpec: spec,
        draftSpec: spec,
        saveState: 'Saving draft...',
      }));
      handleSpec._t = setTimeout(async () => {
        const result = await saveDraftLoadout(spec);
        if (result.state) {
          mergePlayerState(result.state, 'Draft saved');
          return;
        }

        // Legacy fallback for projects that have not run migration 002 yet.
        saveLoadout(a.character.id, spec);
        setAccount((prev) => ({ ...prev, saveState: 'Draft saved (legacy)' }));
      }, 700);
    }
  }

  useEffect(() => {
    const token = account.session?.sessionToken;
    if (!token) return;
    let live = true;

    async function forceOut(message) {
      if (!live) return;
      setForcedLogout(message || 'Your account was logged in somewhere else. This session has been closed.');
      setRoomSpec(null);
      setView('lab');
      await signOut();
      if (live) setAccount(EMPTY_ACCOUNT);
    }

    async function tick() {
      const mapId = view === 'room' ? 'buya_arena' : 'character_lab';
      const hb = await heartbeatSession(token, mapId);
      if (!live) return;
      if (hb?.forceLogout) {
        await forceOut(hb.message);
        return;
      }

      const [events, friends] = await Promise.all([
        getSessionEvents(token),
        getOnlineFriends(),
      ]);
      if (!live) return;
      const forced = events.find((e) => e.event_type === 'force_logout');
      if (forced) {
        await ackSessionEvent(forced.id);
        await forceOut(forced.message);
        return;
      }
      setAccount((prev) => prev.session?.sessionToken === token ? ({ ...prev, friends }) : prev);
    }

    tick();
    const id = setInterval(tick, 15000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [account.session?.sessionToken, view]);

  useEffect(() => {
    const token = account.session?.sessionToken;
    if (!token) return undefined;
    const close = () => { endCharacterSession(token, 'tab_close'); };
    window.addEventListener('beforeunload', close);
    return () => window.removeEventListener('beforeunload', close);
  }, [account.session?.sessionToken]);

  async function handleClaimed() {
    const state = await refreshAccount({ saveState: 'Synced' });
    if (state?.character?.id && !accountRef.current.session && !state.migrationMissing) {
      const sessionResult = await startCharacterSession(state.character.id, navigator.userAgent?.slice(0, 80) || 'web');
      if (sessionResult.session) {
        setAccount((prev) => ({ ...prev, session: sessionResult.session }));
      }
    }
  }

  async function handleSaveBuild() {
    const a = accountRef.current;
    setAccount((prev) => ({ ...prev, saveState: 'Saving build...' }));
    const draft = a.draftSpec || a.cloudSpec || specRef.current;
    const result = await syncCharacterBuild(draft, a.character?.id);
    if (result.error) {
      setAccount((prev) => ({ ...prev, saveState: `Save failed: ${result.error}` }));
      return null;
    }
    if (result.legacy) {
      // migration 002 not applied yet — draft was persisted directly
      setAccount((prev) => ({ ...prev, syncedSpec: result.syncedSpec, saveState: 'Saved' }));
      return null;
    }
    return mergePlayerState(result.state, 'Synced');
  }

  async function handleResetBuild() {
    setAccount((prev) => ({ ...prev, saveState: 'Resetting draft...' }));
    const result = await resetCharacterDraft();
    if (result.error) {
      setAccount((prev) => ({ ...prev, saveState: `Reset failed: ${result.error}` }));
      return null;
    }
    if (result.legacy) {
      // no server draft — revert the composer to the saved build locally
      setAccount((prev) => ({
        ...prev,
        draftSpec: prev.syncedSpec,
        cloudSpec: prev.syncedSpec,
        saveState: 'Reset to saved',
        applyToken: (prev.applyToken || 0) + 1,
      }));
      return null;
    }
    const state = mergePlayerState(result.state, 'Draft reset to synced');
    setAccount((prev) => ({ ...prev, applyToken: (prev.applyToken || 0) + 1 }));
    return state;
  }

  async function handleRenameGuardian(name) {
    const guardianId = accountRef.current.guardian?.id;
    if (!guardianId) return null;
    const result = await renameGuardian(guardianId, name);
    if (result.error) {
      setAccount((prev) => ({ ...prev, saveState: `Guardian rename failed: ${result.error}` }));
      return null;
    }
    return mergePlayerState(result.state, 'Guardian saved');
  }

  async function handleSignOut() {
    const token = accountRef.current.session?.sessionToken;
    if (token) await endCharacterSession(token, 'sign_out');
    await signOut();
  }

  async function handleArenaReward(reward) {
    if (reward?.profileXp != null) {
      setAccount((prev) => ({
        ...prev,
        profile: {
          ...(prev.profile || {}),
          xp: Number(reward.profileXp),
          level: Number(reward.profileLevel || prev.profile?.level || 1),
          rank: reward.rank || prev.profile?.rank,
        },
      }));
    }
    refreshAccount({ saveState: accountRef.current.saveState });
  }

  // arenaOnly (ArgantaLab): as soon as a character + saved build exist, drop
  // straight into Buya Arena with that build.
  useEffect(() => {
    if (!arenaOnly || !account.character || roomSpec) return;
    const synced = account.syncedSpec;
    setRoomSpec({ ...(synced && Object.keys(synced).length ? synced : account.cloudSpec || {}) });
    setView('room');
  }, [arenaOnly, account.character?.id, account.syncedSpec, roomSpec]);

  const needsLogin = authAvailable && !account.user;
  const needsCharacter = authAvailable && account.user && !account.character;
  // Kingdom Command iframe: framed, no injected client — login lives in Command.
  const frameBridge = embedded && !hostSupabase;

  // Framed by Kingdom Command but no session yet: don't show a Google button
  // (it 403s in an iframe) — wait for Command to bridge the session in.
  if (frameBridge && needsLogin) {
    return (
      <div className="app arena-app">
        <main className="login-page">
          <div className="bridge-wait">
            <div className="bridge-spinner" />
            <b>Connecting to Kingdom Command…</b>
            <span>Sign in on the Command Center to open the Character Lab.</span>
          </div>
        </main>
      </div>
    );
  }

  // Standalone Kingdom: a clean, full-screen login/claim gate on load. No
  // Composer/Arena chrome appears until you're signed in AND have a character —
  // then the header + Character Lab (below) mount, bound to that account (its
  // saved build hydrates via applyToken). Embedded modes skip this gate: the
  // host site (ArgantaLab) owns auth and passes the session in.
  if (!embedded && (needsLogin || needsCharacter)) {
    return (
      <div className="app kingdom-gate">
        <main className="login-page">
          <AccountBar
            account={account}
            onClaimed={handleClaimed}
            onSignOut={handleSignOut}
            forcedLogout={forcedLogout}
            onClearNotice={() => setForcedLogout(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className={`app${embedded ? ' arena-app' : ''}${arenaOnly ? ' arena-only' : ''}`}>
      {!arenaOnly && (
        <header>
          {!embedded && <b>Kingdom</b>}
          {!embedded && <span className="subtitle">Character Lab</span>}
          <nav className="tabs">
            <button className={view === 'lab' ? 'on' : ''} onClick={() => setView('lab')}>Composer</button>
            <button
              className={view === 'room' ? 'on' : ''}
              disabled={!account.character}
              onClick={() => {
                const synced = accountRef.current.syncedSpec;
                setRoomSpec({ ...(synced && Object.keys(synced).length ? synced : specRef.current || {}) });
                setView('room');
              }}
            >Buya Arena</button>
          </nav>
        </header>
      )}
      {(needsLogin || needsCharacter) && (
        <main className="login-page">
          <AccountBar
            account={account}
            onClaimed={handleClaimed}
            onSignOut={handleSignOut}
            forcedLogout={forcedLogout}
            onClearNotice={() => setForcedLogout(null)}
          />
        </main>
      )}
      {view === 'lab' && !arenaOnly && (
        needsLogin || needsCharacter ? null : (
          <CharacterLab
            onSpec={handleSpec}
            account={account}
            onClaimed={handleClaimed}
            onSignOut={handleSignOut}
            onSaveBuild={handleSaveBuild}
            onResetBuild={handleResetBuild}
            onRenameGuardian={handleRenameGuardian}
          />
        )
      )}
      {view === 'room' && roomSpec && (
        <TestRoom spec={roomSpec} account={account} onPlayerState={handleArenaReward} />
      )}
      {forcedLogout && account.user && (
        <div className="browser-backdrop">
          <div className="session-modal card">
            <h2>Session moved</h2>
            <p>{forcedLogout}</p>
            <button onClick={() => setForcedLogout(null)}>Back to login</button>
          </div>
        </div>
      )}
    </div>
  );
}
