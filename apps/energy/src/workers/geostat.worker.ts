// geostat.worker.ts — run the heavy static-model build (SIS/SGS per layer) OFF the main
// thread so the Static Model tab paints instantly in 3D. Thin wrapper over the pure
// engine/geostat-build.ts. Receives the serializable build input, returns the GridModel
// + reconciliation stats (typed arrays structured-clone back).
import { buildStaticModel, type GeostatBuildInput } from '../engine/geostat-build';

self.onmessage = (e: MessageEvent<GeostatBuildInput>) => {
  try {
    const out = buildStaticModel(e.data);
    (self as unknown as Worker).postMessage({ ok: true, out });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) });
  }
};
