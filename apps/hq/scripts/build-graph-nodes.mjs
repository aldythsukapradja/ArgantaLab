// Atomize the knowledge system into individual graph nodes.
//
// Turns data that currently lives INSIDE tables (the atlas's 130 rows, the
// table-map's 71 rows, the 60 dependencies) into one markdown note PER item,
// cross-linked to hubs and product/layer entities — so the Obsidian graph and
// the HQ Vault show hundreds of nodes instead of a handful of index notes.
//
// Deterministic + grounded: every node is generated from already-verified data.
// Output: knowledge-base/graph/{docs,tables,deps}/*.md  (part of the single KB).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(here, '../../..')
const KB = path.join(REPO, 'knowledge-base')
const slug = (s) => s.toLowerCase().replace(/[‘’'"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
const esc = (s) => (s || '').replace(/`/g, '').replace(/\r?\n/g, ' ').trim()

function write(dir, id, fm, body) {
  const d = path.join(KB, 'graph', dir)
  fs.mkdirSync(d, { recursive: true })
  const y = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')
  fs.writeFileSync(path.join(d, id + '.md'), `---\n${y}\n---\n\n${body}\n`)
}

let counts = { docs: 0, tables: 0, deps: 0 }

// ---- 1. Doc nodes (from the 130-doc atlas assessment) ----
const atlasPath = '/tmp/claude-0/-home-user-ArgantaLab/8d72f908-4b7d-5808-9e53-aad45df4a8c2/tasks/w4107dlid.output'
const DOMAIN_PRODUCT = { Lashira: 'LashiraBloom', Kingdom: 'LashiraBloom', Kinetik: 'KinetikCircle', Learning: 'ArgantaLabs' }
const VERDICT_STATUS = { current: 'current', partial: 'current', superseded: 'superseded', 'concept-unbuilt': 'draft', reference: 'current', archive: 'archived' }
if (fs.existsSync(atlasPath)) {
  const docs = JSON.parse(fs.readFileSync(atlasPath, 'utf8')).result.allDocs
  const byPath = {}
  for (const d of docs) byPath[d.path] = 'doc-' + slug(d.path)
  for (const d of docs) {
    const id = byPath[d.path]
    const product = DOMAIN_PRODUCT[d.domain] || 'HQ'
    const status = VERDICT_STATUS[d.verdict] || 'current'
    const sup = d.superseded_by && byPath[d.superseded_by] ? `\n\nSuperseded by [[${byPath[d.superseded_by]}]].` : ''
    const lesson = d.lesson ? `\n\n**Lesson:** ${esc(d.lesson)}` : ''
    write('docs', id, {
      title: esc(d.title || path.basename(d.path)), type: 'doc-node', product,
      status, verdict: d.verdict, tags: '[doc, atlas]', date: '2026-07-11',
    }, `# ${esc(d.title || path.basename(d.path))}\n\n\`${d.path}\` · verdict **${d.verdict}**\n\n${esc(d.reason)}${lesson}${sup}\n\nIn [[00-doc-atlas]] · product [[${product}]].`)
    counts.docs++
  }
}

// ---- 2. Table nodes (parse the 71-table map) ----
const tmap = fs.readFileSync(path.join(KB, 'maps', 'table-map.md'), 'utf8')
let curDomain = 'Data'
for (const line of tmap.split('\n')) {
  const dm = line.match(/^##\s+(.+?)\s*(\(\d+\))?\s*$/)
  if (dm) { curDomain = dm[1].trim(); continue }
  const m = line.match(/^\|\s*`([a-z_0-9]+)`\s*\|(.+?)\|\s*`([^`]+)`\s*\|(.+?)\|(.+?)\|\s*$/)
  if (!m) continue
  const [, tbl, purpose, file, rpcs, used] = m
  const usedApps = esc(used)
  const product = /lashira|kingdom/i.test(usedApps) ? 'LashiraBloom' : /kinetik/i.test(usedApps) ? 'KinetikCircle' : /web/i.test(usedApps) ? 'ArgantaLabs' : 'HQ'
  write('tables', 'tbl-' + tbl, {
    title: tbl, type: 'table-node', product, status: 'current',
    tags: '[table, data]', date: '2026-07-11',
  }, `# \`${tbl}\`\n\nDomain: ${esc(curDomain)} · defined in \`${esc(file)}\`\n\n**Purpose:** ${esc(purpose)}\n\n**Key RPC(s):** ${esc(rpcs) || '—'}\n\n**Used by:** ${usedApps}\n\nIn [[table-map]] · layer [[L1-data]].`)
  counts.tables++
}

// ---- 3. Dependency nodes (from every package.json) ----
const deps = {}
function walkPkg(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkPkg(p)
    else if (e.name === 'package.json') {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      const app = path.basename(path.dirname(p)) === 'ArgantaLab' ? 'root' : path.basename(path.dirname(p))
      for (const k of ['dependencies', 'devDependencies'])
        for (const [d, v] of Object.entries(j[k] || {})) (deps[d] ||= []).push(`${app}@${v}`)
    }
  }
}
walkPkg(REPO)
for (const [dep, vers] of Object.entries(deps)) {
  write('deps', 'dep-' + slug(dep), {
    title: dep, type: 'dep-node', product: 'HQ', status: 'current',
    tags: '[dependency, toolchain]', date: '2026-07-11',
  }, `# ${dep}\n\n**Versions across the monorepo:** ${vers.map(esc).join(' · ')}\n\nIn [[L0-toolchain]] · see [[tech-evolution]].`)
  counts.deps++
}

console.log('graph nodes generated:', JSON.stringify(counts), '=', counts.docs + counts.tables + counts.deps)
