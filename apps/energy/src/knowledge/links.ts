// Wikilink/backlink machinery (M3) — the O(n) title-index + one-pass inversion
// pattern. Shared by the build-time generator (via JS mirror) and the runtime
// vault (user/extracted notes layered over the baked KB).
//
// Rules (locked):
// - [[Title]] | [[Title|alias]] | [[Title#heading]] — one regex, alias/anchor stripped.
// - Forward links resolve via a lowercase title→id index built ONCE (first title
//   wins; generators must keep titles unique per type — collisions are a QC error).
// - MACHINE cross-refs use note.explicitLinks (ids) — title collisions can't break them.
// - Backlinks = invert the merged (links ∪ explicitLinks) map in one pass.
// - Dead link = index miss → renderer shows .wikilink.dead (never a silent no-op).

import type { VaultNote } from './types';

const WIKI_RE = /\[\[([^\]]+)\]\]/g;

export function linkKey(raw: string): string {
  return raw.split('|')[0].split('#')[0].trim().toLowerCase();
}

export function recomputeLinks(notes: VaultNote[]): void {
  const idx = new Map<string, string>();
  for (const n of notes) {
    const k = n.title.toLowerCase();
    if (!idx.has(k)) idx.set(k, n.id);
  }
  for (const n of notes) {
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    WIKI_RE.lastIndex = 0;
    while ((m = WIKI_RE.exec(n.body_md))) {
      const target = idx.get(linkKey(m[1]));
      if (target && target !== n.id) out.add(target);
    }
    for (const e of n.explicitLinks ?? []) if (e !== n.id) out.add(e);
    n.links = [...out];
  }
  const back = new Map<string, string[]>();
  for (const n of notes) for (const t of n.links) {
    const arr = back.get(t); if (arr) arr.push(n.id); else back.set(t, [n.id]);
  }
  for (const n of notes) n.backlinks = back.get(n.id) ?? [];
}

/** Resolve a wikilink token to a note id (null = dead link). */
export function resolveLink(notes: VaultNote[], token: string): string | null {
  const k = linkKey(token);
  for (const n of notes) if (n.title.toLowerCase() === k) return n.id;
  return null;
}

/** Graph projection: nodes + edges for the canvas (deg = links+backlinks). */
export function toGraph(notes: VaultNote[]) {
  const visible = notes;
  const ids = new Set(visible.map((n) => n.id));
  const nodes = visible.map((n) => ({ id: n.id, title: n.title, type: n.type, deg: n.links.length + n.backlinks.length }));
  const edges: { from: string; to: string }[] = [];
  for (const n of visible) for (const t of n.links) if (ids.has(t)) edges.push({ from: n.id, to: t });
  return { nodes, edges };
}
