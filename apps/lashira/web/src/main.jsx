import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { supabase } from './net/supabase.js';
import { initCombatTuning } from './net/combatTuning.js';
import { initCharacterRegistry } from './net/characterRegistry.js';
import { initAudioLibrary } from './net/audioLibrary.js';
import './styles.css';

// Pull + apply the combat tuning Circle HQ published (fire-and-forget, safe:
// falls back to package defaults if absent/offline). The active config is a
// public RPC so it applies even before embed auth resolves.
initCombatTuning();
// Pull the character-appearance registry HQ published (same fire-and-forget,
// public-read contract) so the shared/default farmer + NPC looks are HQ's.
initCharacterRegistry();
// Pull the SFX library Circle HQ's Music Builder published (same pattern) —
// falls back to the built-in synth recipes if nothing's been published yet.
initAudioLibrary();

// Embed mode: the game runs inside ANY parent ArgantaLab app (Bloom Command,
// KinetikCircle's "KinFarm" pill, etc.) as `?embed=<hostname>` — the value only
// identifies the host for logging, any non-empty value means "embedded". The
// parent owns login (Google 403s inside an iframe) and posts its session in
// here; we adopt it on our OWN client via setSession, which fires onAuth and
// loads the player. Mirrors Kingdom Heroes' main.jsx.
const params = new URLSearchParams(window.location.search);
const embedHost = params.get('embed');
const commandEmbed = !!embedHost;
let embeddedAuthApplied = false;
let embeddedAuthToken = '';

function trustedOrigin(origin) {
  if (!origin || origin === 'null') return true;
  try {
    const h = new URL(origin).hostname;
    return /^(localhost|127\.0\.0\.1)$/.test(h) || /\.arganta\.app$/.test(h) || /\.vercel\.app$/.test(h);
  } catch { return false; }
}

if (commandEmbed) {
  async function applyHostAuth(d) {
    if (d.session?.access_token) {
      if (d.session.access_token === embeddedAuthToken && window.__lashiraEmbeddedAuthUser !== undefined) {
        embeddedAuthApplied = true;
        try { supabase?.realtime?.setAuth?.(d.session.access_token); } catch { /* ignore */ }
        return window.__lashiraEmbeddedAuthUser;
      }
      const { data, error } = await supabase?.auth.setSession({
        access_token: d.session.access_token,
        refresh_token: d.session.refresh_token,
      }) || {};
      if (error) throw error;
      try { supabase?.realtime?.setAuth?.(d.session.access_token); } catch { /* ignore */ }
      embeddedAuthApplied = true;
      embeddedAuthToken = d.session.access_token;
      const user = data?.session?.user || data?.user || null;
      window.__lashiraEmbeddedAuthUser = user;
      window.dispatchEvent(new CustomEvent('lashira-host-auth', { detail: { user } }));
      return user;
    }
    if (d.signout) {
      embeddedAuthApplied = true;
      embeddedAuthToken = '';
      window.__lashiraEmbeddedAuthUser = null;
      try { await supabase?.auth.signOut(); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('lashira-host-auth', { detail: { user: null } }));
    }
    return null;
  }

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'lashira-auth' || !trustedOrigin(e.origin)) return;
    applyHostAuth(d)
      .then((user) => {
        try { window.parent?.postMessage({ type: 'lashira-auth-applied', userId: user?.id || null }, e.origin || '*'); } catch { /* ignore */ }
      })
      .catch((err) => {
        console.warn('LashiraBloom: host auth failed', err?.message || err);
        try { window.parent?.postMessage({ type: 'lashira-auth-error', message: err?.message || String(err) }, e.origin || '*'); } catch { /* ignore */ }
      });
  });
  const requestAuth = () => {
    try { window.parent?.postMessage({ type: 'lashira-auth-request' }, '*'); } catch { /* ignore */ }
  };
  try { window.parent?.postMessage({ type: 'lashira-game-ready' }, '*'); } catch { /* ignore */ }
  requestAuth();
  const authPoll = window.setInterval(() => {
    if (embeddedAuthApplied) window.clearInterval(authPoll);
    else requestAuth();
  }, 1200);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App embedded={commandEmbed} />
  </React.StrictMode>
);
