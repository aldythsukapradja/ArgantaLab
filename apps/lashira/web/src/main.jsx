import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { supabase } from './net/supabase.js';
import './styles.css';

// Embed mode: the game runs inside ANY parent ArgantaLab app (Bloom Command,
// KinetikCircle's "KinFarm" pill, etc.) as `?embed=<hostname>` — the value only
// identifies the host for logging, any non-empty value means "embedded". The
// parent owns login (Google 403s inside an iframe) and posts its session in
// here; we adopt it on our OWN client via setSession, which fires onAuth and
// loads the player. Mirrors Kingdom Heroes' main.jsx.
const params = new URLSearchParams(window.location.search);
const embedHost = params.get('embed');
const commandEmbed = !!embedHost;

function trustedOrigin(origin) {
  if (!origin || origin === 'null') return true;
  try {
    const h = new URL(origin).hostname;
    return /^(localhost|127\.0\.0\.1)$/.test(h) || /\.arganta\.app$/.test(h) || /\.vercel\.app$/.test(h);
  } catch { return false; }
}

if (commandEmbed) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'lashira-auth' || !trustedOrigin(e.origin)) return;
    if (d.session?.access_token) {
      supabase?.auth.setSession({ access_token: d.session.access_token, refresh_token: d.session.refresh_token });
    } else if (d.signout) {
      supabase?.auth.signOut();
    }
  });
  try { window.parent?.postMessage({ type: 'lashira-game-ready' }, '*'); } catch { /* ignore */ }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App embedded={commandEmbed} />
  </React.StrictMode>
);
