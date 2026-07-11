// HQ Vault — seed content.
//
// SINGLE SOURCE OF TRUTH: the founder notes live as markdown in
// knowledge-base/founder/*.md — the same files that open plug-and-play in
// Obsidian. This module does NOT hold the note text; kb.generated.ts is
// derived from those markdown files by scripts/build-vault-seed.mjs, so the
// vault and Obsidian render the exact same KB and cannot silently drift.
// Every claim is grounded to the main KB (snapshot a00b826, 2026-07-11):
// 96k LOC, one Supabase (71 tables / 147 RPCs), 7 front-ends, 0 external users.

import type { VaultNote, CanvasState } from './types'
import { slugify } from './types'
import { parseFrontmatter, normalizeFrontmatter } from './markdown'
import { KB_RAW } from './kb.generated'

// Bump when the seed content changes so existing local vaults re-seed once
// (otherwise the first-run snapshot in localStorage pins the old notes forever).
export const SEED_VERSION = '2026-07-11-grounded-kb'

// The raw markdown notes, derived from knowledge-base/founder/*.md.
const RAW: string[] = KB_RAW

// ---------- Build the seed vault ----------

export function seedNotes(): Record<string, VaultNote> {
  const now = Date.now()
  const notes: Record<string, VaultNote> = {}
  RAW.forEach((raw, i) => {
    const { fm, body } = parseFrontmatter(raw)
    const full = normalizeFrontmatter(fm, 'Untitled ' + i)
    const id = slugify(full.title)
    notes[id] = {
      id, fm: full, body: body.trimStart(),
      createdAt: now - (RAW.length - i) * 86_400_000,
      updatedAt: new Date(full.updated + 'T12:00:00').getTime() || now,
    }
  })
  return notes
}

// Default canvas: HQ at the center of the constellation.
export function seedCanvas(): CanvasState {
  const N = (id: string, noteId: string, x: number, y: number, color: string, w = 240, h = 130): CanvasState['cards'][number] =>
    ({ id, type: 'note', noteId, x, y, w, h, color })
  return {
    cards: [
      N('c-hq', 'hq', 460, 300, 'iris', 270, 150),
      N('c-kin', 'kinetikcircle', 80, 90, 'sky'),
      N('c-labs', 'argantalabs', 850, 90, 'ember'),
      N('c-bloom', 'lashirabloom', 80, 530, 'jade'),
      N('c-inv', 'investor-narrative', 850, 530, 'rose'),
      { id: 'c-loop', type: 'text', x: 468, y: 66, w: 254, h: 96, color: 'graphite',
        text: '**The loop is the product.**\nOrganize → Learn → Bloom → Observe. (0 users on it yet.)' },
      { id: 'c-econ', type: 'text', x: 468, y: 560, w: 254, h: 96, color: 'graphite',
        text: 'Diamonds mint from learning only; Bloom is play. Learning is the single faucet.' },
    ],
    edges: [
      { id: 'e1', fromCard: 'c-kin', toCard: 'c-hq', label: 'organize' },
      { id: 'e2', fromCard: 'c-labs', toCard: 'c-hq', label: 'learn' },
      { id: 'e3', fromCard: 'c-bloom', toCard: 'c-hq', label: 'bloom' },
      { id: 'e4', fromCard: 'c-hq', toCard: 'c-inv', label: 'proof' },
      { id: 'e5', fromCard: 'c-kin', toCard: 'c-bloom', label: 'minifarm' },
      { id: 'e6', fromCard: 'c-labs', toCard: 'c-bloom', label: 'learn → world' },
    ],
  }
}
