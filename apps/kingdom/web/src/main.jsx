import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { supabase } from './net/account.js';
import './styles.css';

// Kingdom Command embed: the Lab runs inside Command's iframe as `?embed=command`.
// Command owns login (Google, top-level) and posts its session in here — the Lab
// never runs its own OAuth in the frame (Google 403s that). We adopt the session
// on our OWN client via setSession, which fires onAuth and hydrates the account.
const params = new URLSearchParams(window.location.search);
const commandEmbed = params.get('embed') === 'command';

function trustedOrigin(origin) {
  if (!origin || origin === 'null') return true; // some browsers null the opener origin
  return (
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /\.arganta\.app$/.test(new URL(origin).hostname) ||
    /\.vercel\.app$/.test(new URL(origin).hostname)
  );
}

if (commandEmbed) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'kingdom-auth' || !trustedOrigin(e.origin)) return;
    if (d.session?.access_token) {
      supabase.auth.setSession({
        access_token: d.session.access_token,
        refresh_token: d.session.refresh_token,
      });
    } else if (d.signout) {
      supabase.auth.signOut();
    }
  });
  // Tell Command we're mounted and ready for the session.
  try {
    window.parent?.postMessage({ type: 'kingdom-lab-ready' }, '*');
  } catch (_) {
    /* ignore */
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App embedded={commandEmbed} />
  </React.StrictMode>
);

// PWA: service worker only in production builds (dev stays cache-free).
// Relative path: the app is deployed under /lab/, so this must resolve to
// /lab/sw.js (and scope to /lab/), not the site root.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Was an (old) SW already controlling this page at load? Only then does a
    // controllerchange mean a stale controller got replaced — rescue-reload
    // once so stuck browsers get a clean, network-fetched shell. Fresh
    // visitors (no prior controller) are NOT reloaded, so no flash for them.
    const hadOldController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadOldController && !sessionStorage.getItem('kd-sw-reloaded')) {
        sessionStorage.setItem('kd-sw-reloaded', '1');
        window.location.reload();
      }
    });
  });
}
