import { CosmoShell } from './cosmo/CosmoShell';

/**
 * ArgantaEnergy's canonical production surface.
 *
 * The former classic shell and the temporary query-string UI switch have been
 * retired. CosmoShell is now the reference implementation at every route,
 * including the application root.
 */
export function App() {
  return <CosmoShell />;
}
