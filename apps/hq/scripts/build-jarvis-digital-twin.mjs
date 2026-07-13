import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const hq = resolve(here, '..')
const repo = resolve(hq, '..', '..')
const source = resolve(hq, 'prototypes', 'jarvis-digital-twin.src.jsx')
const target = resolve(hq, 'prototypes', 'jarvis-digital-twin.html')
const kbFile = resolve(hq, 'src', 'vault', 'kb.generated.ts')
const valuationFile = resolve(repo, 'knowledge-base', 'founder', '20260713-Business-ArgantaLab-Valuation-Audit.md')

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const rnd = (seed, salt = 0) => ((hash(`${seed}:${salt}`) % 100000) / 100000)
const clean = (s) => s.replace(/[*_#>[\]`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90)
const kbRaw = await readFile(kbFile, 'utf8')
const notes = []
for (const m of kbRaw.matchAll(/\{ id: ("(?:\\.|[^"\\])*")\s*, md: ("(?:\\.|[^"\\])*") \},/g)) {
  notes.push({ id: JSON.parse(m[1]), md: JSON.parse(m[2]) })
}
if (notes.length < 300) throw new Error(`Vault parse failed: expected 300+ notes, found ${notes.length}`)

const nodes = []
const edges = []
const byId = new Map()
const addNode = (n) => {
  if (byId.has(n.id)) return byId.get(n.id)
  const index = nodes.length
  const node = { index, degree: 1, source: 'snapshot', product: 'shared', office: 'bridge', layer: 6, ...n }
  nodes.push(node); byId.set(node.id, index); return index
}
const addEdge = (a, b, kind = 'LINKS_TO', confirmed = true) => {
  if (a == null || b == null || a === b) return
  edges.push([a, b, kind, confirmed ? 1 : 0]); nodes[a].degree++; nodes[b].degree++
}

const productSeeds = [
  ['product.arganta', 'ArgantaLabs', 'arganta', '#2f7dff'],
  ['product.lashira', 'LashiraBloom', 'lashira', '#d96cab'],
  ['product.kinetik', 'KinetikCircle', 'kinetik', '#2dbba4'],
  ['product.hq', 'Circle HQ', 'hq', '#8b6cff'],
]
for (const [id, label, product, color] of productSeeds) addNode({ id, label, kind: 'product', product, color, weight: 13, layer: 3 })
const officeSeeds = [
  ['office.bridge', 'The Bridge', 'bridge'], ['office.operations', 'Operations', 'operations'],
  ['office.technology', 'Technology', 'technology'], ['office.treasury', 'Treasury', 'treasury'],
  ['office.legal', 'Legal', 'legal'], ['office.roster', 'The Guild', 'roster'],
]
for (const [id, label, office] of officeSeeds) addNode({ id, label, kind: 'office', office, weight: 10, layer: 5 })
const layers = ['Toolchain','Data','Engine / Spine','App / UI','Assets / Content','Agentic','Knowledge Base','Distribution']
layers.forEach((label, i) => addNode({ id:`layer.${i}`, label, kind:'architecture-layer', layer:i, weight:9, office:i<3?'technology':i===7?'operations':'bridge' }))

const productOf = (md) => /ArgantaLabs|apps\/web|ArgantaLab\b/i.test(md) ? 'arganta' : /LashiraBloom|apps\/lashira|Kingdom/i.test(md) ? 'lashira' : /KinetikCircle|apps\/kinetik/i.test(md) ? 'kinetik' : /Circle HQ|apps\/hq|Agent OS|Bridge/i.test(md) ? 'hq' : 'shared'
const officeOf = (md) => /valuation|treasury|finance|revenue|econom/i.test(md) ? 'treasury' : /legal|privacy|consent|risk|trust/i.test(md) ? 'legal' : /agent|roster|guild|CAPO/i.test(md) ? 'roster' : /architecture|database|schema|RPC|deploy|package|code/i.test(md) ? 'technology' : /growth|retention|product|distribution|user/i.test(md) ? 'operations' : 'bridge'
const layerOf = (md) => /distribution|acquisition|channel/i.test(md) ? 7 : /knowledge|vault|documentation/i.test(md) ? 6 : /agent|command|office|mission/i.test(md) ? 5 : /asset|content|pixel|audio|video/i.test(md) ? 4 : /app|surface|UI|UX|screen/i.test(md) ? 3 : /engine|package|spine/i.test(md) ? 2 : /table|database|schema|RPC|Supabase|event/i.test(md) ? 1 : 0

const noteIndex = new Map()
for (const note of notes) {
  const title = clean((note.md.match(/^#\s+(.+)$/m)?.[1]) || note.id)
  const doc = addNode({ id:`doc.${note.id}`, label:title, kind:'document', product:productOf(note.md), office:officeOf(note.md), layer:layerOf(note.md), weight:5 })
  noteIndex.set(note.id.toLowerCase(), doc)
  const p = nodes[doc].product
  if (p !== 'shared') addEdge(doc, byId.get(`product.${p}`), 'SERVES')
  addEdge(doc, byId.get(`office.${nodes[doc].office}`), 'OWNS')
  addEdge(doc, byId.get(`layer.${nodes[doc].layer}`), 'RUNS_ON')
  let hCount = 0
  for (const hm of note.md.matchAll(/^(#{2,6})\s+(.+)$/gm)) {
    if (hCount++ > 24) break
    const sec = addNode({ id:`section.${note.id}.${hCount}`, label:clean(hm[2]), kind:'section', product:p, office:nodes[doc].office, layer:nodes[doc].layer, weight:2 })
    addEdge(doc, sec, 'CONTAINS')
  }
  let cCount = 0
  for (const cm of note.md.matchAll(/`([^`\n]{2,80})`/g)) {
    if (cCount++ > 30) break
    const ref = addNode({ id:`code.${note.id}.${cCount}`, label:clean(cm[1]), kind:/^[a-z][a-z0-9_]+\(/i.test(cm[1])?'rpc':'code-reference', product:p, office:nodes[doc].office, layer:/sql|table|rpc|schema/i.test(cm[1])?1:nodes[doc].layer, source:'partial', weight:1 })
    addEdge(doc, ref, 'MENTIONS')
  }
}

for (const note of notes) {
  const from = noteIndex.get(note.id.toLowerCase())
  let count = 0
  for (const wm of note.md.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
    if (count++ > 24) break
    const key = wm[1].trim().split('/').pop().toLowerCase().replace(/\.md$/, '')
    const to = noteIndex.get(key)
    const ref = addNode({ id:`reference.${note.id}.${count}`, label:clean(wm[1]), kind:'reference', product:nodes[from].product, office:nodes[from].office, layer:6, weight:1 })
    addEdge(from, ref, 'MENTIONS')
    if (to != null) addEdge(ref, to, 'LINKS_TO')
  }
}

const valuationMd = await readFile(valuationFile, 'utf8')
const valuationDoc = addNode({ id:'doc.valuation-audit', label:'ArgantaLab Valuation Audit', kind:'decision', product:'hq', office:'treasury', layer:6, weight:12 })
addEdge(valuationDoc, byId.get('office.treasury'), 'OWNS')
addEdge(valuationDoc, byId.get('product.hq'), 'SERVES')

const clusters = {
  company: { arganta:[-.36,-.08], lashira:[.30,-.18], kinetik:[.20,.34], hq:[0,0], shared:[0,.04] },
  office: { bridge:[0,0], operations:[-.48,-.22], technology:[.44,-.24], treasury:[.50,.26], legal:[0,.49], roster:[-.48,.28] },
}
const provOrder = { live:0, partial:1, snapshot:2, simulated:3, placeholder:4 }
for (const n of nodes) {
  const a = rnd(n.id, 1) * Math.PI * 2
  const rr = .14 + Math.pow(rnd(n.id, 2), .56) * .72
  const idle = [Math.cos(a)*rr, Math.sin(a)*rr]
  const cc = clusters.company[n.product] || clusters.company.shared
  const cr = .045 + Math.pow(rnd(n.id, 3), .62) * (n.product === 'shared' ? .32 : .26)
  const company = [cc[0] + Math.cos(a)*cr, cc[1] + Math.sin(a)*cr]
  const pa = ((provOrder[n.source] ?? 2) / 5) * Math.PI*2 - Math.PI/2
  const evidence = [Math.cos(pa)*(.28+rnd(n.id,4)*.46) + (rnd(n.id,5)-.5)*.18, Math.sin(pa)*(.28+rnd(n.id,6)*.46)+(rnd(n.id,7)-.5)*.18]
  const stage = hash(n.kind)%7
  const da = -Math.PI*.72 + stage*(Math.PI*1.44/6)
  const decision = [Math.cos(da)*(.20+rnd(n.id,8)*.55)+(rnd(n.id,9)-.5)*.11, Math.sin(da)*(.20+rnd(n.id,10)*.55)+(rnd(n.id,11)-.5)*.11]
  const oc = clusters.office[n.office] || clusters.office.bridge
  const workforce = [oc[0]+Math.cos(a)*(.05+rnd(n.id,12)*.23), oc[1]+Math.sin(a)*(.05+rnd(n.id,13)*.23)]
  const architecture = [(rnd(n.id,14)-.5)*1.48, -.67 + (7-n.layer)*(1.34/7)+(rnd(n.id,15)-.5)*.075]
  const positive = /product|document|package|table|rpc|architecture/i.test(n.kind) && n.layer !== 7
  const valuation = [(rnd(n.id,16)-.5)*1.30, (positive ? -.28 : .28) + (rnd(n.id,17)-.5)*.42]
  n.positions = [...idle,...company,...evidence,...decision,...workforce,...architecture,...valuation].map(v=>Math.round(v*10000)/10000)
}

const graph = {
  generatedAt: new Date().toISOString(), snapshotDate:'2026-07-13', auditCommit:'4b688536',
  nodes: nodes.map(({index,...n})=>n), edges: edges.slice(0, 5200),
  counts: { nodes:nodes.length, edges:Math.min(edges.length,5200), notes:notes.length, methods:6 },
}
if (graph.counts.nodes < 1500) throw new Error(`Expanded graph too small: ${graph.counts.nodes}`)

const result = await build({
  entryPoints:[source], bundle:true, minify:true, sourcemap:false, format:'iife',
  target:['chrome100','safari15.4','firefox100'], write:false, legalComments:'none', treeShaking:true,
  define:{ 'process.env.NODE_ENV':'"production"', '__GRAPH_DATA__':JSON.stringify(graph) },
  loader:{'.json':'json'},
})
const js = result.outputFiles[0].text
const html = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><meta name="description" content="Jarvis — the Arganta company digital twin"><title>Jarvis · Arganta Digital Twin</title></head><body><div id="root"></div><script>${js.replaceAll('</script>','<\\/script>')}</script></body></html>`
await mkdir(dirname(target),{recursive:true})
await writeFile(target,html)
const gzip = gzipSync(Buffer.from(html),{level:9})
console.log(JSON.stringify({target,rawBytes:Buffer.byteLength(html),gzipBytes:gzip.length,...graph.counts},null,2))
