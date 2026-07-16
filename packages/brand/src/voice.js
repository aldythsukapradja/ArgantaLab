// VOICE — the brand, compacted for a language model.
//
// Arganta Core writes every caption and every slide. For a post to sound like
// the brand rather than like a generic content bot, the model needs the brand's
// voice in its context — and "which parts of a BrandDoc does an LLM need, and
// how small can they be" is one decision that belongs in ONE place. The MCP
// sends this payload; the Worker renders it into a system prompt; HQ's copilot
// can use the same block. None of them re-derive it.
//
// Deliberately compact: these blocks ride in every request, and a small instruct
// model's context is the scarcest resource in the pipeline. Long persona essays
// crowd out the actual brief.

import { DEFAULT_LANGUAGE } from './schema.js'

const pick = (obj, lang) => (obj && (obj[lang] ?? obj[DEFAULT_LANGUAGE])) || null

/**
 * The brand as an LLM needs it.
 * @param {object} doc      a resolved BrandDoc
 * @param {object} [opts]   { lang, platform }
 * @returns {object|null}   null when there is no brand to speak as
 */
export function voiceBlock(doc, { lang = DEFAULT_LANGUAGE, platform = 'instagram' } = {}) {
  if (!doc) return null
  const v = doc.voice || {}
  const p = doc.presence?.[platform] || {}
  const bl = pick(v.boilerplates, lang) || {}
  const persona = v.persona || {}

  const block = {
    id: doc.id,
    name: doc.name,
    lang,
    handle: p.handle ? (p.handle.startsWith('@') ? p.handle : '@' + p.handle) : null,
    persona: {
      title: persona.title || null,
      speaksAs: persona.speaksAs || null,
      adjectives: persona.adjectives || [],
      forbidden: persona.forbidden || [],
    },
    tagline: pick(v.taglines, lang),
    // The 25-word line is the "what is this" the model should stay true to. The
    // longer ones are for platform About fields, not for every caption.
    summary: bl.w25 || bl.w50 || null,
    pillars: (v.pillars || []).map(x => ({ id: x.id, label: x.label, description: x.description })),
    ctas: pick(v.ctas, lang) || [],
    hashtags: v.hashtags || {},
    // The humanity layer — what stops an automated post reading as automated.
    touchyRules: v.touchyRules || [],
    // L0.5: how this brand's pictures must look. Rides along so generated slide
    // backgrounds are on-brand too, not just the words.
    artDirection: doc.kb?.artDirection || null,
  }

  // A brand with nothing said about it is worse than no brand: it would tell the
  // model to "write as ArgantaLab" with no idea what that means, which produces
  // confident nonsense. Say nothing instead.
  const hasVoice = block.persona.title || block.tagline || block.summary || block.pillars.length
  return hasVoice ? block : { id: doc.id, name: doc.name, lang, handle: block.handle, artDirection: block.artDirection }
}

/** Does this brand have enough voice to be worth speaking as? */
export const hasVoice = (doc) => {
  const v = doc?.voice || {}
  return !!(v.persona?.title || v.pillars?.length || Object.keys(v.taglines || {}).length)
}

/** The pillar a brief belongs to, if the brand declares one by that id/label. */
export function findPillar(doc, idOrLabel) {
  if (!idOrLabel) return null
  const t = String(idOrLabel).toLowerCase()
  return (doc?.voice?.pillars || []).find(p => p.id?.toLowerCase() === t || p.label?.toLowerCase() === t) || null
}
