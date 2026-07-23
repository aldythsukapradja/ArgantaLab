// sim.worker.ts (1a) — run the FV oil-water IMPES waterflood off the main thread so the
// Simulation tab loads instantly (no synchronous solve blocking first paint). Receives
// {cfg, opts}, returns the FvResult (snapshots' typed arrays structured-clone back).
import { simulateFV, type FvCfg } from '../engine/sim/fv';

interface Req { cfg: FvCfg; opts: { tEnd: number; nReports?: number; cfl?: number; timestepping?: 'implicit' | 'impes'; implicitSubs?: number } }

self.onmessage = (e: MessageEvent<Req>) => {
  try {
    const { cfg, opts } = e.data;
    const result = simulateFV(cfg, opts);
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) });
  }
};
