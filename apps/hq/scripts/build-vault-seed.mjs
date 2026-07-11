// Single-source pipeline: derive the HQ Vault seed from the ONE markdown KB.
//
//   knowledge-base/**/*.md   (the single source — also opens plug-and-play in Obsidian)
//        │  node apps/hq/scripts/build-vault-seed.mjs
//        ▼
//   apps/hq/src/vault/kb.generated.ts   (derived artifact — never hand-edit)
//
// The vault and Obsidian render the SAME markdown files. There is no second copy
// to drift, so the two surfaces cannot silently contradict each other.
//
// Note id = the file's basename (what both Obsidian and our [[wikilinks]] key on),
// so links resolve identically in both surfaces. Regenerate after editing any
// note and commit the .md + this file together (CI enforces they match).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const KB = path.resolve(here, '../../../knowledge-base')
const OUT = path.resolve(here, '../src/vault/kb.generated.ts')

const slug = (s) => s.trim().toLowerCase()
  .replace(/[‘’'"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'note'

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '_templates' ? [] : walk(p)
    return e.name.endsWith('.md') ? [p] : []
  })
}

const files = walk(KB).sort()
const seen = new Map()
const notes = []
for (const f of files) {
  const id = slug(path.basename(f, '.md'))
  if (seen.has(id)) { console.error(`ERROR: duplicate note id "${id}" (${seen.get(id)} vs ${f})`); process.exit(1) }
  seen.set(id, f)
  notes.push({ id, md: fs.readFileSync(f, 'utf8').replace(/\s+$/, '') })
}

const banner =
  '// AUTO-GENERATED — do not edit by hand.\n' +
  '// Source of truth: knowledge-base/**/*.md (the single markdown KB).\n' +
  '// Regenerate: node apps/hq/scripts/build-vault-seed.mjs\n' +
  `// ${notes.length} notes, id = file basename.\n`

const body = 'export interface KbNote { id: string; md: string }\n' +
  'export const KB_NOTES: KbNote[] = [\n' +
  notes.map(n => `  { id: ${JSON.stringify(n.id)}, md: ${JSON.stringify(n.md)} }`).join(',\n') +
  ',\n]\n'

fs.writeFileSync(OUT, banner + body)
console.log(`generated ${OUT} from ${notes.length} markdown notes across the KB`)
