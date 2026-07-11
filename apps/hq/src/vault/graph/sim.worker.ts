/// <reference lib="webworker" />
// HQ Vault graph v3 — d3-force layout, off the main thread.
//
// Owns the whole simulation: forceManyBody (quadtree Barnes-Hut, O(n log n) —
// replaces the old strided O(n²) repulsion), forceLink, forceCollide, and a
// per-node forceX/forceY toward a target centroid (the radial-cluster mechanism).
// We drive ticks manually (sim.stop() + our own timer) so we control cadence and
// can stop cold when alpha settles, posting positions as transferable buffers.

import {
  forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY,
  type Simulation,
} from 'd3-force'
import type { ToWorker, SimParams } from './protocol'

interface Node {
  id: string
  index: number
  x: number; y: number
  vx?: number; vy?: number
  fx?: number | null; fy?: number | null
  r: number
  tx: number; ty: number       // cluster target (centroid)
}

const ALPHA_MIN = 0.0055
const ctx = self as unknown as DedicatedWorkerGlobalScope

let sim: Simulation<Node, undefined> | null = null
let nodes: Node[] = []
let params: SimParams
let running = false
let timer: ReturnType<typeof setTimeout> | null = null

function post(msg: unknown, transfer?: Transferable[]) {
  ctx.postMessage(msg, transfer ?? [])
}

function snapshot(): Float32Array {
  const a = new Float32Array(nodes.length * 2)
  for (let i = 0; i < nodes.length; i++) { a[i * 2] = nodes[i].x; a[i * 2 + 1] = nodes[i].y }
  return a
}

function loop() {
  if (!sim) return
  sim.tick()                                   // advances forces + decays alpha
  const p = snapshot()
  post({ type: 'tick', positions: p, alpha: sim.alpha() }, [p.buffer])
  if (sim.alpha() > ALPHA_MIN) {
    timer = setTimeout(loop, 1000 / 60)
  } else {
    running = false
    post({ type: 'end' })
  }
}

function start() {
  if (running || !sim) return
  running = true
  loop()
}

function applyParams() {
  if (!sim) return
  const charge = sim.force('charge') as ReturnType<typeof forceManyBody> | undefined
  charge?.strength(-params.repel)
  const link = sim.force('link') as ReturnType<typeof forceLink<Node, { source: string; target: string }>> | undefined
  link?.distance(params.linkDist).strength(params.linkStrength)
  const collide = sim.force('collide') as ReturnType<typeof forceCollide<Node>> | undefined
  collide?.radius(d => d.r + params.collide)
  const fx = sim.force('x') as ReturnType<typeof forceX<Node>> | undefined
  fx?.strength(params.cluster)
  const fy = sim.force('y') as ReturnType<typeof forceY<Node>> | undefined
  fy?.strength(params.cluster)
}

function build(msg: Extract<ToWorker, { type: 'init' }>) {
  if (timer) clearTimeout(timer)
  running = false
  params = msg.params
  nodes = msg.nodes.map((n, i) => {
    const tx = msg.targets[i * 2] || 0
    const ty = msg.targets[i * 2 + 1] || 0
    return { id: n.id, index: i, x: n.x ?? tx, y: n.y ?? ty, r: n.r, tx, ty }
  })
  sim = forceSimulation<Node>(nodes)
    .force('charge', forceManyBody<Node>().strength(-params.repel).theta(0.9).distanceMax(700))
    .force('link', forceLink<Node, { source: string; target: string }>(msg.links)
      .id(d => d.id).distance(params.linkDist).strength(params.linkStrength))
    .force('collide', forceCollide<Node>().radius(d => d.r + params.collide).iterations(1))
    .force('x', forceX<Node>().x(d => d.tx).strength(params.cluster))
    .force('y', forceY<Node>().y(d => d.ty).strength(params.cluster))
    .velocityDecay(0.5)      // higher damping → smoother, less jittery drift
    .alphaDecay(0.016)       // slower cool-down → a more gradual, elegant settle
    .alpha(1)
  sim.stop()
  start()
}

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':
      build(msg)
      break
    case 'params':
      if (!params) return
      Object.assign(params, msg.params)
      applyParams()
      if (sim) { sim.alpha(Math.max(sim.alpha(), 0.35)); start() }
      break
    case 'targets': {
      const n = Math.min(nodes.length, msg.targets.length / 2)
      for (let i = 0; i < n; i++) { nodes[i].tx = msg.targets[i * 2]; nodes[i].ty = msg.targets[i * 2 + 1] }
      params.cluster = msg.cluster
      applyParams()
      if (sim) { sim.alpha(Math.max(sim.alpha(), 0.5)); start() }
      break
    }
    case 'reheat':
      if (sim) { sim.alpha(Math.max(sim.alpha(), msg.alpha ?? 0.6)); start() }
      break
    case 'drag': {
      const node = nodes[msg.index]
      if (!node || !sim) return
      if (msg.active) {
        node.fx = msg.x; node.fy = msg.y
        sim.alphaTarget(0.3); start()
      } else {
        node.fx = null; node.fy = null
        sim.alphaTarget(0)
      }
      break
    }
    case 'stop':
      if (timer) clearTimeout(timer)
      running = false
      sim?.stop()
      break
  }
}
