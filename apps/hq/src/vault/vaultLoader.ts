// HQ Vault — load notes from the vault-hq/ single source of truth (markdown files).
//
// This makes `vault-hq/*.md` the source of truth for the app instead of the
// hardcoded seed.ts. It reuses the app's OWN parser (parseFrontmatter +
// normalizeFrontmatter), so the same bytes Obsidian reads become app notes.
//
// ADDITIVE + SAFE: nothing imports this until store.ts opts in
// (see LOADER-INTEGRATION.md). Until then the app is unchanged.
//
// NOT runtime-verified in CI: import.meta.glob resolves at Vite build time only.
// Verify locally with `npm run dev` after wiring per LOADER-INTEGRATION.md.

import type { VaultNote } from './types'
import { slugify, todayISO } from './types'
import { parseFrontmatter, normalizeFrontmatter } from './markdown'

// Vite bundles these file contents at build time. Path reaches the repo-root
// vault-hq/ folder from apps/hq/src/vault/ (four levels up).
const RAW = import.meta.glob('../../../../vault-hq/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** True if the build could see the vault folder at all. */
export const hasVaultNotes = (): boolean => Object.keys(RAW).length > 0

/**
 * Parse every vault-hq markdown file with a frontmatter title into a VaultNote.
 * Files without frontmatter (READMEs, provenance stubs) are skipped — they are
 * structure, not knowledge. `id = slugify(title)` matches the seed convention,
 * so wikilinks resolve identically to the seeded vault.
 */
export function loadVaultNotes(): Record<string, VaultNote> {
  const notes: Record<string, VaultNote> = {}
  for (const [path, raw] of Object.entries(RAW)) {
    if (typeof raw !== 'string') continue
    const { fm, body } = parseFrontmatter(raw)
    if (!fm || !fm.title) continue // skip structural/manual files with no frontmatter
    const base = path.split('/').pop()!.replace(/\.md$/, '')
    const id = slugify(String(fm.title)) || base
    const now = Date.now()
    notes[id] = {
      id,
      fm: normalizeFrontmatter(fm, base),
      body,
      createdAt: now,
      updatedAt: now,
    }
  }
  return notes
}

// Silence unused-import lint in builds that tree-shake todayISO out.
void todayISO
