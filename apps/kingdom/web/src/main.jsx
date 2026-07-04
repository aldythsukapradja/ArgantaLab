import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
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
