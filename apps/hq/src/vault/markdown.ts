// HQ Vault — markdown + frontmatter engine.
// Deliberately dependency-free: a compact YAML-lite frontmatter parser and a
// markdown tokenizer that covers the note-taking subset (headings, emphasis,
// lists, checkboxes, quotes, fences, tables, hr, links, wikilinks).

import type { Frontmatter, Product, NoteType, NoteStatus, Confidence, WikiLink } from './types'
import { todayISO } from './types'

// ---------- Frontmatter ----------

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Parse a YAML-lite frontmatter block. Supports `key: value`, quoted values,
 *  inline lists `[a, b]` and dash lists. Returns fm + remaining body. */
export function parseFrontmatter(raw: string): { fm: Partial<Frontmatter>; body: string } {
  const m = raw.match(FM_RE)
  if (!m) return { fm: {}, body: raw }
  const fm: Record<string, string | string[]> = {}
  const lines = m[1].split(/\r?\n/)
  let listKey: string | null = null
  for (const line of lines) {
    const dash = line.match(/^\s+-\s+(.*)$/)
    if (dash && listKey) {
      ;(fm[listKey] as string[]).push(unquote(dash[1]))
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    const val = kv[2].trim()
    if (val === '') { fm[key] = []; listKey = key; continue }
    listKey = null
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val.slice(1, -1).split(',').map(s => unquote(s.trim())).filter(Boolean)
    } else {
      fm[key] = unquote(val)
    }
  }
  return { fm: fm as Partial<Frontmatter>, body: raw.slice(m[0].length) }
}

const unquote = (s: string) => s.replace(/^["']|["']$/g, '')

const FM_ORDER = ['title', 'product', 'type', 'status', 'tags', 'updated', 'owner', 'confidence']

export function serializeFrontmatter(fm: Frontmatter): string {
  const keys = [...FM_ORDER.filter(k => fm[k] !== undefined), ...Object.keys(fm).filter(k => !FM_ORDER.includes(k))]
  const out = keys.map(k => {
    const v = fm[k]
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`
    return `${k}: ${v}`
  })
  return `---\n${out.join('\n')}\n---\n`
}

/** Coerce a partial frontmatter into a complete one with safe defaults. */
export function normalizeFrontmatter(p: Partial<Frontmatter>, fallbackTitle: string): Frontmatter {
  const products: Product[] = ['HQ', 'KinetikCircle', 'ArgantaLabs', 'LashiraBloom', 'Investor', 'Research']
  const types: NoteType[] = ['note', 'strategy', 'decision', 'prompt', 'research', 'plan', 'spec']
  const statuses: NoteStatus[] = ['seed', 'draft', 'active', 'shipped', 'archived']
  const confs: Confidence[] = ['low', 'medium', 'high']
  const pick = <T extends string>(v: unknown, opts: T[], dflt: T): T =>
    typeof v === 'string' && (opts as string[]).includes(v) ? v as T : dflt
  return {
    ...p,
    title: typeof p.title === 'string' && p.title ? p.title : fallbackTitle,
    product: pick(p.product, products, 'HQ'),
    type: pick(p.type, types, 'note'),
    status: pick(p.status, statuses, 'draft'),
    tags: Array.isArray(p.tags) ? p.tags : [],
    updated: typeof p.updated === 'string' && p.updated ? p.updated : todayISO(),
    owner: typeof p.owner === 'string' && p.owner ? p.owner : 'Aldyth',
    confidence: pick(p.confidence, confs, 'medium'),
  }
}

// ---------- Wikilinks ----------

const WIKI_RE = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/g

export function parseWikiLinks(body: string): WikiLink[] {
  const out: WikiLink[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(WIKI_RE.source, WIKI_RE.flags) // local instance — reentrancy-safe
  while ((m = re.exec(body))) {
    out.push({ raw: m[0], target: m[1].trim(), alias: m[2]?.trim(), start: m.index })
  }
  return out
}

/** Resolve a wikilink target to a note id: exact title match (case-insensitive),
 *  then id/slug match. Returns null when the link is broken. */
export function resolveWikiLink(
  target: string,
  notes: Record<string, { id: string; fm: { title: string } }>,
): string | null {
  const t = target.trim().toLowerCase()
  for (const n of Object.values(notes)) if (n.fm.title.toLowerCase() === t) return n.id
  for (const n of Object.values(notes)) if (n.id === t.replace(/\s+/g, '-')) return n.id
  return null
}

// ---------- Utility metrics ----------

export function wordCount(body: string): number {
  const stripped = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\[\]|-]/g, ' ')
  return (stripped.match(/[\p{L}\p{N}'’]+/gu) || []).length
}

export interface OutlineItem { level: number; text: string; line: number }
export function outline(body: string): OutlineItem[] {
  const out: OutlineItem[] = []
  let inFence = false
  body.split('\n').forEach((ln, i) => {
    if (/^```/.test(ln)) { inFence = !inFence; return }
    if (inFence) return
    const m = ln.match(/^(#{1,6})\s+(.*)$/)
    if (m) out.push({ level: m[1].length, text: m[2].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t), line: i })
  })
  return out
}

// ---------- Block tokenizer (renderer consumes these) ----------

export type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: { text: string; depth: number; task?: 'open' | 'done' }[] }
  | { kind: 'ol'; items: { text: string; depth: number }[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'hr' }
  | { kind: 'table'; header: string[]; rows: string[][] }

export function tokenizeBlocks(body: string): Block[] {
  const lines = body.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const ln = lines[i]
    if (!ln.trim()) { i++; continue }

    // fenced code
    const fence = ln.match(/^```(\w*)/)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++ // closing fence
      blocks.push({ kind: 'code', lang: fence[1] || '', code: buf.join('\n') })
      continue
    }
    // heading
    const h = ln.match(/^(#{1,6})\s+(.*)$/)
    if (h) { blocks.push({ kind: 'h', level: h[1].length, text: h[2] }); i++; continue }
    // hr
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(ln)) { blocks.push({ kind: 'hr' }); i++; continue }
    // blockquote
    if (/^>\s?/.test(ln)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      blocks.push({ kind: 'quote', lines: buf })
      continue
    }
    // table: header row + separator row
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const parseRow = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const header = parseRow(ln)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++ }
      blocks.push({ kind: 'table', header, rows })
      continue
    }
    // unordered list (with tasks)
    if (/^\s*[-*+]\s+/.test(ln)) {
      const items: { text: string; depth: number; task?: 'open' | 'done' }[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s+(.*)$/)!
        const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2)
        let text = m[2]
        let task: 'open' | 'done' | undefined
        const t = text.match(/^\[( |x|X)\]\s+(.*)$/)
        if (t) { task = t[1] === ' ' ? 'open' : 'done'; text = t[2] }
        items.push({ text, depth, task })
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    // ordered list
    if (/^\s*\d+[.)]\s+/.test(ln)) {
      const items: { text: string; depth: number }[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)\d+[.)]\s+(.*)$/)!
        items.push({ text: m[2], depth: Math.floor(m[1].replace(/\t/g, '  ').length / 2) })
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    // paragraph — greedy until blank/blockish line
    {
      const buf: string[] = [ln]
      i++
      while (
        i < lines.length && lines[i].trim() &&
        !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+[.)]\s|\|)/.test(lines[i]) &&
        !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i])
      ) { buf.push(lines[i]); i++ }
      blocks.push({ kind: 'p', text: buf.join('\n') })
    }
  }
  return blocks
}

// ---------- Inline tokenizer ----------

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'italic'; children: Inline[] }
  | { kind: 'strike'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'wiki'; target: string; alias?: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'br' }

// Order matters: code first (protects contents), then wiki, md-link, bold, italic, strike, tag.
const INLINE_RE = /(`[^`]+`)|(\[\[[^\[\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(~~[^~]+~~)|((?:^|(?<=\s))#[\p{L}\p{N}/_-]+)/gmu

export function tokenizeInline(text: string): Inline[] {
  const out: Inline[] = []
  const pushText = (t: string) => {
    // handle soft line breaks inside paragraphs
    const parts = t.split('\n')
    parts.forEach((p, idx) => {
      if (p) out.push({ kind: 'text', text: p })
      if (idx < parts.length - 1) out.push({ kind: 'br' })
    })
  }
  let last = 0
  let m: RegExpExecArray | null
  // local instance: tokenizeInline recurses, and a shared global regex would
  // have its lastIndex clobbered by the recursive call → infinite loop
  const re = new RegExp(INLINE_RE.source, INLINE_RE.flags)
  while ((m = re.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index))
    const s = m[0]
    if (m[1]) out.push({ kind: 'code', text: s.slice(1, -1) })
    else if (m[2]) {
      const w = s.slice(2, -2)
      const pipe = w.indexOf('|')
      const rawTarget = pipe >= 0 ? w.slice(0, pipe) : w
      const alias = pipe >= 0 ? w.slice(pipe + 1) : undefined
      out.push({ kind: 'wiki', target: rawTarget.split('#')[0].trim(), alias: alias?.trim() })
    }
    else if (m[3]) {
      const lm = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!
      out.push({ kind: 'link', text: lm[1], href: lm[2] })
    }
    else if (m[4]) out.push({ kind: 'bold', children: tokenizeInline(s.slice(2, -2)) })
    else if (m[5]) out.push({ kind: 'italic', children: tokenizeInline(s.slice(1, -1)) })
    else if (m[6]) out.push({ kind: 'strike', children: tokenizeInline(s.slice(2, -2)) })
    else if (m[7]) out.push({ kind: 'tag', tag: s.trim().slice(1) })
    last = m.index + s.length
  }
  if (last < text.length) pushText(text.slice(last))
  return out
}
