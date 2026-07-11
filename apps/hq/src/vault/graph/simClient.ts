// HQ Vault graph v3 — thin main-thread wrapper around the d3-force worker.
// The engine talks to this, never to the worker directly.

import type { FromWorker, SimInitNode, SimLink, SimParams } from './protocol'

export class SimClient {
  private worker: Worker
  private onTick: (positions: Float32Array, alpha: number) => void
  private onEnd: () => void

  constructor(
    onTick: (positions: Float32Array, alpha: number) => void,
    onEnd: () => void,
  ) {
    this.onTick = onTick
    this.onEnd = onEnd
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data
      if (msg.type === 'tick') this.onTick(msg.positions, msg.alpha)
      else if (msg.type === 'end') this.onEnd()
    }
  }

  init(nodes: SimInitNode[], links: SimLink[], params: SimParams, targets: Float32Array) {
    this.worker.postMessage({ type: 'init', nodes, links, params, targets }, [targets.buffer])
  }

  setParams(params: Partial<SimParams>) {
    this.worker.postMessage({ type: 'params', params })
  }

  /** Regroup: new per-node centroid targets (x,y interleaved) + cluster strength. */
  setTargets(targets: Float32Array, cluster: number) {
    this.worker.postMessage({ type: 'targets', targets, cluster }, [targets.buffer])
  }

  reheat(alpha?: number) {
    this.worker.postMessage({ type: 'reheat', alpha })
  }

  drag(index: number, x: number, y: number, active: boolean) {
    this.worker.postMessage({ type: 'drag', index, x, y, active })
  }

  destroy() {
    this.worker.postMessage({ type: 'stop' })
    this.worker.terminate()
  }
}
