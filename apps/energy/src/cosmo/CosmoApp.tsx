// CosmoApp — the migrated (COSMO design) shell. Reached via ?ui=cosmo (the
// ArgantaEnergy-Cosmo.bat launcher). Built incrementally alongside the classic
// UI so both coexist until the migration is complete (U0 tokens → U8 / G0–G5).
// For now it's a clear "under construction" surface with a switch back to classic.
import { useEffect } from 'react';

export function CosmoApp() {
  // COSMO is light-first — announce it on the root so the migrated shell renders
  // in the new palette even before the token swap (U0) lands.
  useEffect(() => { document.documentElement.setAttribute('data-ui', 'cosmo'); return () => document.documentElement.removeAttribute('data-ui'); }, []);

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fa', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, textAlign: 'center', padding: 32 }}>
        <div style={{ width: 46, height: 46, margin: '0 auto 18px', borderRadius: 13, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 20, background: 'radial-gradient(circle at 35% 30%,#5fe3cf,#0FB5A6 45%,#2563eb)', boxShadow: '0 6px 20px rgba(15,181,166,.4)' }}>Æ</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>ArgantaEnergy · COSMO</h1>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', color: '#0a8a7f', background: '#e6f7f5', display: 'inline-block', padding: '4px 10px', borderRadius: 6, marginBottom: 16 }}>MIGRATED UI · BUILDING</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '0 0 20px' }}>
          The new COSMO-design shell is being migrated in stages (U0 tokens → shell → components → Field-Dev re-skin; G0–G5 GeaVision/GVSURF). Both UIs run off the same dev server — this launcher shows the migrated version as it comes online.
        </p>
        <a href="?" style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
          ← Open the classic UI
        </a>
      </div>
    </div>
  );
}
