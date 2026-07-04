import { useEffect, useRef, useState } from 'react';
import CharacterLab from './lab/CharacterLab.jsx';
import TestRoom from './room/TestRoom.jsx';
import {
  authAvailable, onAuth, currentUser, isKidUser,
  fetchKinetikProfile, fetchMyCharacter, saveLoadout,
} from './net/account.js';

export default function App() {
  const [view, setView] = useState('lab');
  const specRef = useRef(null);
  const [roomSpec, setRoomSpec] = useState(null);

  // ---- account state (MP-0): user + kinetik profile + kingdom character ----
  const [account, setAccount] = useState({
    user: null, profile: null, character: null, accountType: 'adult',
    cloudSpec: null, saveState: '',
  });
  const accountRef = useRef(account);
  accountRef.current = account;

  useEffect(() => {
    if (!authAvailable) return;
    let sub;
    async function hydrate(user) {
      if (!user) {
        setAccount({ user: null, profile: null, character: null, accountType: 'adult', cloudSpec: null, saveState: '' });
        return;
      }
      const accountType = isKidUser(user) ? 'kid' : 'adult';
      const [profile, character] = await Promise.all([
        fetchKinetikProfile(user.id), fetchMyCharacter(user.id),
      ]);
      setAccount({
        user, profile, character, accountType,
        cloudSpec: character?.spec || null,
        saveState: character ? '☁ synced' : '',
      });
    }
    currentUser().then(hydrate);
    sub = onAuth(hydrate);
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  function handleSpec(spec) {
    specRef.current = spec;
    const a = accountRef.current;
    if (a.character) {
      saveLoadout(a.character.id, spec);
      setAccount((prev) => ({ ...prev, saveState: '☁ saving…' }));
      clearTimeout(handleSpec._t);
      handleSpec._t = setTimeout(
        () => setAccount((prev) => ({ ...prev, saveState: '☁ synced' })), 1600
      );
    }
  }

  return (
    <div className="app">
      <header>
        <b>Kingdom</b> <span className="subtitle">Character Lab</span>
        <nav className="tabs">
          <button className={view === 'lab' ? 'on' : ''} onClick={() => setView('lab')}>Composer</button>
          <button
            className={view === 'room' ? 'on' : ''}
            onClick={() => { setRoomSpec({ ...(specRef.current || {}) }); setView('room'); }}
          >Buya Arena</button>
        </nav>
      </header>
      {view === 'lab' && (
        <CharacterLab
          onSpec={handleSpec}
          account={account}
          onClaimed={(character) => setAccount((prev) => ({ ...prev, character, saveState: '☁ synced' }))}
        />
      )}
      {view === 'room' && roomSpec && <TestRoom spec={roomSpec} account={account} />}
    </div>
  );
}
