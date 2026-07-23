// CosmoApp — the migrated UI, reached via ?ui=cosmo (ArgantaEnergy-Cosmo.bat).
// Serves the founder's COSMO shell AS-IS (public/cosmo/index.html) so every
// placeholder, Markdown page, animation and the 5 lifecycles are exactly as built
// — the map for what to migrate. We build the real engines onto it from here.
// (The classic UI is untouched; App.tsx routes here on ?ui=cosmo.)
const COSMO_URL = `${import.meta.env.BASE_URL || '/'}cosmo/index.html`;

export function CosmoApp() {
  return (
    <iframe
      src={COSMO_URL}
      title="ArgantaEnergy"
      style={{ border: 'none', width: '100vw', height: '100vh', display: 'block' }}
      allow="clipboard-read; clipboard-write"
    />
  );
}
