// Single-source pipeline: derive the HQ Vault seed from the markdown KB.
//
//   knowledge-base/founder/*.md   (the source — also opens plug-and-play in Obsidian)
//        │  node scripts/build-vault-seed.mjs
//        ▼
//   apps/hq/src/vault/kb.generated.ts   (derived artifact — do not hand-edit)
//
// The vault and Obsidian therefore render the SAME markdown. There is no second
// copy to drift, so the two surfaces cannot silently contradict each other.
// Regenerate after editing any founder note, and commit both the .md and the
// regenerated file together.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../../../knowledge-base/founder')
const OUT = path.resolve(here, '../src/vault/kb.generated.ts')

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.md')).sort()
const notes = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\s+$/, ''))

const banner =
  '// AUTO-GENERATED — do not edit by hand.\n' +
  '// Source of truth: knowledge-base/founder/*.md (the single markdown KB).\n' +
  '// Regenerate: node apps/hq/scripts/build-vault-seed.mjs\n' +
  `// ${files.length} notes, generated from markdown.\n`

const body = 'export const KB_RAW: string[] = [\n' +
  notes.map(n => '  ' + JSON.stringify(n)).join(',\n') +
  ',\n]\n'

fs.writeFileSync(OUT, banner + body)
console.log(`generated ${OUT} from ${files.length} markdown notes`)
