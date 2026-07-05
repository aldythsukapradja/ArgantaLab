import { useEffect, useState } from 'react';
import Welcome from './ui/Welcome.jsx';
import FarmView from './game/FarmView.jsx';
import { currentProfile } from './net/account.js';

// Root: check for an existing Supabase session (e.g. after a Google redirect),
// otherwise show the welcome gate. Once we have a profile, mount the farm.
export default function App() {
  const [profile, setProfile] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    currentProfile()
      .then((p) => { if (alive && p) setProfile(p); })
      .finally(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
  }, []);

  if (!checked) return <div className="loading">Loading LashiraBloom…</div>;
  if (!profile) return <Welcome onReady={setProfile} />;
  return <FarmView profile={profile} key={profile.id} />;
}
