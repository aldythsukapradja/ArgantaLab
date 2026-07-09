import { useEffect, useMemo, useState } from 'react'
import { data } from '@arganta/heroes-engine'

// Shared composer logic — ported from Kingdom's Character Lab, extracted so both
// the Lab tab (real users) and NPC Studio (shared cast) drive the SAME picker
// behavior (skin/armor special-casing, ◀/▶ stepping, dye targeting) off one spec.

export const SKIN_IDS = [0, 1]
export const DEFAULT_SEL: any = {
  body: { cat: 'body', id: 0, palette: null },
  face: { cat: 'face', id: 0, palette: null },
  hair: { cat: 'hair', id: 0, palette: null },
  coat: { cat: 'coat', id: 2, palette: null },
}
export const SLOT_DEFS: any[] = [
  { key: 'face', cat: 'face', label: 'Face', group: 'Head' },
  { key: 'hair', cat: 'hair', label: 'Hair', group: 'Head', optional: true },
  { key: 'helmet', cat: 'helmet', label: 'Helmet', group: 'Head', optional: true },
  { key: 'facedec', cat: 'facedec', label: 'Face deco', group: 'Head', optional: true },
  { key: 'hairdec', cat: 'hairdec', label: 'Hair deco', group: 'Head', optional: true },
  { key: 'skin', special: 'skin', label: 'Skin', group: 'Body & Armor' },
  { key: 'armor', special: 'armor', label: 'Armor', group: 'Body & Armor' },
  { key: 'shoes', cat: 'shoes', label: 'Shoes', group: 'Body & Armor', optional: true },
  { key: 'mantle', cat: 'mantle', label: 'Mantle', group: 'Body & Armor', optional: true },
  { key: 'neck', cat: 'neck', label: 'Necklace', group: 'Body & Armor', optional: true },
  { key: 'weapon', cat: 'sword', label: 'Weapon', group: 'Weapon', optional: true, cats: ['sword', 'spear', 'bow', 'fan'] },
  { key: 'shield', cat: 'shield', label: 'Shield', group: 'Weapon', optional: true },
]
export const GROUPS = ['Head', 'Body & Armor', 'Weapon']
export const ACTIONS: [string, string][] = [
  ['Stand', 'NormalStandBy'], ['Walk', 'NormalWalk'], ['Swing', 'Swing'], ['Pierce', 'Pierce'],
  ['Shoot', 'Shoot'], ['Take', 'Get'], ['Spell', 'Spell'], ['Ride', 'Riding'], ['Bow', 'Bow'],
]
// Full 15-entry catalog from Kingdom's motion table (extractor-manifest.json) — the
// Forge previously shipped only 9 in a plain <select>; restored to the real list.
export const EMOTES = ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep',
  'Surprise', 'Angry', 'Merong', 'Kongi', 'Pish', 'Dance', 'Cold', 'HandToMouth']
export const DIRWORD: Record<string, string> = { S: 'South', E: 'East', N: 'North', W: 'West' }
export const PATHS = ['Warrior', 'Mage', 'Poet', 'Rogue']

// Skills — ported verbatim from Kingdom's Character Lab: 3 slots, each holding a
// client visual effect (fx id) and OPTIONALLY a scraped spell identity (skillId/
// name/path/manaCost/spellType) picked from the real spell catalog, level-gated.
export const DEFAULT_SKILLS = [{ fx: 22, skillId: null }, { fx: 1, skillId: null }, { fx: 131, skillId: null }] as const
export function normalizeSkills(skills: any): any[] {
  return DEFAULT_SKILLS.map((def, i) => ({
    fx: Number.isFinite(Number(skills?.[i]?.fx)) ? Number(skills[i].fx) : def.fx,
    skillId: typeof skills?.[i]?.skillId === 'string' ? skills[i].skillId : null,
    name: typeof skills?.[i]?.name === 'string' ? skills[i].name : null,
    path: typeof skills?.[i]?.path === 'string' ? skills[i].path : null,
    manaCost: Number.isFinite(Number(skills?.[i]?.manaCost)) ? Number(skills[i].manaCost) : null,
    spellType: typeof skills?.[i]?.spellType === 'string' ? skills[i].spellType : null,
  }))
}

export function useCategoryData(cats: string[]) {
  const [meta, setMeta] = useState<Record<string, any>>({})
  useEffect(() => {
    let live = true
    ;(async () => {
      const out: Record<string, any> = {}
      await Promise.all(cats.map(async c => {
        try {
          const [parts, palettes] = await Promise.all([data.charParts(c), data.charPalettes(c)])
          out[c] = { parts, byId: Object.fromEntries(parts.map((p: any) => [p.id, p])), palettes: palettes.length }
        } catch { out[c] = { parts: [], byId: {}, palettes: 0 } }
      }))
      if (live) setMeta(out)
    })()
    return () => { live = false }
  }, [cats.join(',')])
  return meta
}

const ALL_CATS = [...new Set(['body', 'coat', ...SLOT_DEFS.flatMap(s => s.cats || (s.cat ? [s.cat] : []))])]

// The full picker + spec-editing surface, independent of WHO is being edited (a
// real user in the Lab, or a named NPC in NPC Studio).
export function useComposer() {
  const [sel, setSel] = useState<any>(DEFAULT_SEL)
  const [mountOn, setMountOn] = useState(false)
  const [mountId, setMountId] = useState(0)
  const [mountCount, setMountCount] = useState(0)
  const [skills, setSkills] = useState<any[]>(() => normalizeSkills(undefined))
  const [skillCatalog, setSkillCatalog] = useState<any[]>([])
  const [effects, setEffects] = useState<any[]>([])
  const meta = useCategoryData(ALL_CATS)

  useEffect(() => { data.mounts().then((m: any[]) => setMountCount(m.length)).catch(() => {}) }, [])
  useEffect(() => { data.loadJson(data.dataUrl('/data/core/skills.json')).then(setSkillCatalog).catch(() => setSkillCatalog([])) }, [])
  useEffect(() => { data.effects().then(setEffects).catch(() => setEffects([])) }, [])

  function applySpec(spec: any) {
    if (!spec || typeof spec !== 'object') { setSel(DEFAULT_SEL); setMountOn(false); setMountId(0); setSkills(normalizeSkills(undefined)); return }
    const { mount, skills: incomingSkills, ...parts } = spec
    setSel(parts.body ? parts : DEFAULT_SEL)
    setMountOn(!!mount)
    setMountId(mount?.id ?? 0)
    setSkills(normalizeSkills(incomingSkills))
  }

  const availableEffects = useMemo(() => effects.filter((e: any) => e?.sheet && e?.animation?.length), [effects])
  const effectById = useMemo(() => Object.fromEntries(availableEffects.map((e: any) => [e.id, e])), [availableEffects])
  const skillLabel = (fx: number) => effectById[fx] ? `effect #${String(fx).padStart(3, '0')}` : `effect #${fx}`
  function setSkillFx(slot: number, fx: number) {
    setSkills(arr => arr.map((s, i) => (i === slot ? { ...s, fx } : s)))
  }
  function setSkillScrape(slot: number, skillId: string) {
    const entry = skillCatalog.find((s: any) => s.id === skillId)
    setSkills(arr => arr.map((s, i) => {
      if (i !== slot) return s
      if (!entry) return { ...s, skillId: null, name: null, path: null, manaCost: null, spellType: null }
      return { ...s, skillId: entry.id, name: entry.name, path: entry.pathSlug, manaCost: entry.manaCost ?? null, spellType: entry.spellType ?? null }
    }))
  }
  function stepSkill(slot: number, delta: number) {
    if (!availableEffects.length) return
    const cur = skills[slot]?.fx ?? DEFAULT_SKILLS[slot]?.fx ?? availableEffects[0].id
    const i = availableEffects.findIndex((e: any) => e.id === cur)
    const next = availableEffects[(i + delta + availableEffects.length) % availableEffects.length] || availableEffects[0]
    setSkillFx(slot, next.id)
  }
  // Spells available for a given path + character level (mirrors Kingdom's pathSkills).
  function skillsForPath(pathSlug: string, level: number): any[] {
    return skillCatalog
      .filter((s: any) => !pathSlug || (s.pathSlug || '').toLowerCase() === pathSlug.toLowerCase())
      .filter((s: any) => !Number.isFinite(level) || Number(s.levelNumber || 0) <= level)
      .sort((a: any, b: any) => (Number(a.levelNumber || 0) - Number(b.levelNumber || 0)) || a.name.localeCompare(b.name))
  }

  const bodyParts = meta.body?.parts || []
  const skinParts = useMemo(() => bodyParts.filter((p: any) => SKIN_IDS.includes(p.id)), [bodyParts])
  const armorBodies = useMemo(() => bodyParts.filter((p: any) => !SKIN_IDS.includes(p.id)), [bodyParts])
  const bodyIsArmor = !SKIN_IDS.includes(sel.body?.id ?? 0)
  const armorEntries = useMemo(() => {
    const out: any[] = []
    for (const p of meta.coat?.parts || []) out.push({ key: `coat:${p.id}`, cat: 'coat', part: p, label: `armor c${p.id}`, group: `coat · set ${Math.floor(p.frame_index / 2600)}` })
    for (const p of armorBodies) out.push({ key: `body:${p.id}`, cat: 'body', part: p, label: `armor b${p.id}`, group: `body · set ${Math.floor(p.frame_index / 2600)}` })
    return out
  }, [meta.coat, armorBodies])
  const armorValue = bodyIsArmor ? `body:${sel.body?.id}` : sel.coat ? `coat:${sel.coat.id}` : null

  function pickArmor(entry: any) {
    setSel((prev: any) => {
      const next = { ...prev }
      if (entry.cat === 'coat') {
        if (!SKIN_IDS.includes(next.body?.id)) next.body = { cat: 'body', id: 0, palette: null }
        next.coat = { cat: 'coat', id: entry.part.id, palette: next.coat?.palette ?? null }
      } else { next.body = { cat: 'body', id: entry.part.id, palette: null }; delete next.coat }
      return next
    })
  }
  function pickSkin(entry: any) {
    setSel((prev: any) => {
      const next = { ...prev, body: { cat: 'body', id: entry.part.id, palette: prev.body?.palette ?? null } }
      if (!next.coat) next.coat = { cat: 'coat', id: 2, palette: null }
      return next
    })
  }
  const pickSlot = (slotKey: string, entry: any) =>
    setSel((prev: any) => ({ ...prev, [slotKey]: { cat: entry.cat, id: entry.part.id, palette: prev[slotKey]?.palette ?? null } }))
  function toggle(slot: any) {
    setSel((prev: any) => {
      const nxt = { ...prev }
      if (nxt[slot.key]) delete nxt[slot.key]
      else nxt[slot.key] = { cat: slot.cat, id: meta[slot.cat]?.parts[0]?.id ?? 0, palette: null }
      return nxt
    })
  }
  function entriesFor(slot: any): any[] {
    if (slot.special === 'skin') return skinParts.map((p: any) => ({ key: `body:${p.id}`, cat: 'body', part: p, label: `skin ${p.id === 0 ? 'A' : 'B'}`, group: 'skins' }))
    if (slot.special === 'armor') return armorEntries
    const cats = slot.cats || [slot.cat]
    const out: any[] = []
    for (const c of cats) for (const p of meta[c]?.parts || []) {
      const bank = ['face', 'hair', 'helmet', 'facedec', 'hairdec'].includes(c) ? 1000 : 2600
      out.push({ key: `${c}:${p.id}`, cat: c, part: p, label: `${c} #${p.id}`, group: `${c} · set ${Math.floor(p.frame_index / bank)}` })
    }
    return out
  }
  function currentKeyFor(slot: any): string | null {
    if (slot.special === 'skin') return !bodyIsArmor && sel.body ? `body:${sel.body.id}` : null
    if (slot.special === 'armor') return armorValue
    const cur = sel[slot.key]
    return cur ? `${cur.cat}:${cur.id}` : null
  }
  function labelFor(slot: any): string {
    if (slot.special === 'skin') return bodyIsArmor ? '(armor body)' : `skin ${sel.body?.id === 0 ? 'A' : 'B'}`
    if (slot.special === 'armor') return bodyIsArmor ? `armor b${sel.body.id}` : sel.coat ? `armor c${sel.coat.id}` : '— none —'
    const cur = sel[slot.key]
    return cur ? `${cur.cat} #${cur.id}` : '— none —'
  }
  const pickFor = (slot: any) => slot.special === 'skin' ? pickSkin : slot.special === 'armor' ? pickArmor : (e: any) => pickSlot(slot.key, e)
  function stepEntry(entries: any[], curKey: string | null, delta: number, pick: (e: any) => void) {
    if (!entries.length) return
    const i = entries.findIndex(e => e.key === curKey)
    pick(entries[(i + delta + entries.length) % entries.length])
  }
  const dyeTargetKey = (slotKey: string) => slotKey === 'skin' ? 'body' : slotKey === 'armor' ? (bodyIsArmor ? 'body' : 'coat') : slotKey

  const spec = useMemo(() => {
    const s: any = { ...sel, skills }
    // The 'emotion' layer (Layer.tbl slot 3, paired with 'face' slot 2) carries
    // the ACTUAL visual for 13 of the 15 emotes (Smile/Cry/Blush/Wink/Yawn/Sleep/
    // Surprise/Angry/Merong/Kongi/Pish/Dance/Cold) — face itself only differs for
    // Victory/HandToMouth. It's not independently pickable: same part-id count as
    // face (39/39), so it's derived automatically rather than exposed as a slot.
    if (sel.face) s.emotion = { cat: 'emotion', id: sel.face.id, palette: null }
    if (mountOn) s.mount = { id: mountId }
    return s
  }, [sel, mountOn, mountId, skills])

  return {
    sel, setSel, mountOn, setMountOn, mountId, setMountId, mountCount, meta, spec,
    applySpec, entriesFor, currentKeyFor, labelFor, pickFor, stepEntry, toggle, dyeTargetKey,
    skills, skillCatalog, availableEffects, skillLabel, setSkillFx, setSkillScrape, stepSkill, skillsForPath,
  }
}
