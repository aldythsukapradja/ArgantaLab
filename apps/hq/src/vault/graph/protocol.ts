// HQ Vault graph v3 — message protocol between the main thread and the
// d3-force simulation worker. Positions travel as transferable Float32Arrays
// (x,y interleaved, indexed by node order) so no per-frame structured-clone copy.

export interface SimInitNode {
  id: string
  r: number          // collision radius (degree-scaled)
  x?: number         // optional seed position (else target is used)
  y?: number
}

export interface SimLink { source: string; target: string }

export interface SimParams {
  repel: number        // forceManyBody magnitude (positive → engine negates)
  linkDist: number     // forceLink target distance
  linkStrength: number // 0..1
  collide: number      // extra padding on top of node radius
  cluster: number      // forceX/Y strength toward each node's (tx,ty) target
}

export const DEFAULT_PARAMS: SimParams = {
  repel: 220,
  linkDist: 46,
  linkStrength: 0.32,
  collide: 3,
  cluster: 0.08,
}

export type ToWorker =
  | { type: 'init'; nodes: SimInitNode[]; links: SimLink[]; params: SimParams; targets: Float32Array }
  | { type: 'params'; params: Partial<SimParams> }
  | { type: 'targets'; targets: Float32Array; cluster: number }   // regroup: new per-node centroids
  | { type: 'reheat'; alpha?: number }
  | { type: 'drag'; index: number; x: number; y: number; active: boolean }
  | { type: 'stop' }

export type FromWorker =
  | { type: 'tick'; positions: Float32Array; alpha: number }
  | { type: 'end' }
