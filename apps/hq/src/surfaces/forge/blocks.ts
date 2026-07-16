// GB-5 · Block insertion — the client-side implementation behind the
// Inspector's Blocks tab.
//
// @arganta/builder's `insert_component` tool spec exists (B1) but has no Core
// executor wired, so this is NOT a call through the tool layer — it's a direct,
// deterministic DOM-string edit, which is honestly all inserting a block is.
// The generated HTML is a single file: a block's CSS goes in a <style> before
// </head>, its markup before </body>. No AI, no cost, instant, offline.
import { PORTABLE_REGISTRY } from '@arganta/builder'
import type { ArtifactKind } from '../../builder-core/generate'

export interface PortableBlock {
  id: string
  name: string
  category: string
  description: string
  suitableFor: string[]
  tags: string[]
  html: string
  css: string
}

export const BLOCKS = PORTABLE_REGISTRY as unknown as PortableBlock[]

/** Blocks that make sense for this artifact. A game gets none — the registry is
 * page furniture, and offering a pricing table for a platformer is noise. */
export function blocksFor(kind: ArtifactKind): PortableBlock[] {
  if (kind === 'game') return []
  return BLOCKS.filter((b) => b.suitableFor.includes(kind))
}

/**
 * Insert a block into a single-file document. Returns the new HTML, or the
 * unchanged input when there's nowhere sane to put it (never a corrupted doc).
 */
export function insertBlock(html: string, block: PortableBlock): string {
  if (!html.trim()) return html
  const styleTag = `\n<style data-block="${block.id}">\n${block.css}\n</style>\n`
  const markup = `\n<!-- block: ${block.id} -->\n${block.html}\n`

  let out = html
  // CSS first — a block whose markup lands without its styles reads as broken.
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${styleTag}</head>`)
  else if (/<body[^>]*>/i.test(out)) out = out.replace(/<body[^>]*>/i, (m) => `${m}${styleTag}`)
  else return html

  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${markup}</body>`)
  else if (/<\/html>/i.test(out)) out = out.replace(/<\/html>/i, `${markup}</html>`)
  else out = `${out}${markup}`
  return out
}

/** True when this exact block is already in the document — inserting a second
 * nav or footer is almost never what the founder meant. */
export function hasBlock(html: string, blockId: string): boolean {
  return new RegExp(`data-block="${blockId}"`).test(html)
}
