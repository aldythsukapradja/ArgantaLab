/**
 * THE DOCTRINE — the philosophical marketing canon, as data.
 *
 * Same two-lane pattern as methodData.ts: the canon for humans lives in
 * knowledge-base/brand/brand-f9-marketing-doctrine.md; this is what the
 * Doctrine tab renders from. Keep them in sync by hand; never invent a claim
 * here the canon doesn't make.
 *
 * Provenance vocabulary (mirrors the canon):
 *   source-grounded      — backed by class A/B external research (SDT, JTBD,
 *                          Dunford, progress principle)
 *   strategic-inference  — grounded reasoning, no audience interviews yet
 *   founder-locked       — a decision; enforced by review, not evidence
 */

export type DoctrineProvenance = 'source-grounded' | 'strategic-inference' | 'founder-locked'

export const DOCTRINE_NOTE = 'brand-f9-marketing-doctrine'

export const TRUTH = {
  human: 'People are drowning in technology that consumes their attention and starving for technology that returns evidence of their growth.',
  belief: 'Technology should return agency, make growth visible, and give families something to build instead of something to watch. AI should help good judgment travel further — never replace it.',
  spine: 'One mechanism, four rooms: make invisible effort visible — a kid’s screen time becomes a shipped thing, a household’s coordination becomes rhythm, a family’s time becomes a world that grows, a founder’s complexity becomes a cockpit.',
  grounding: [
    { name: 'Self-Determination Theory', who: 'Deci & Ryan · class A', note: 'autonomy · competence · relatedness — Play·Learn·Build·Ship is SDT made product; "grow together" is relatedness as a promise' },
    { name: 'The progress principle', who: 'Amabile · class A', note: 'visible progress in meaningful work is the strongest motivator — build logs and readiness rings are progress made legible' },
    { name: 'Jobs to Be Done', who: 'Christensen / Moesta · class A', note: 'people hire products to make progress in a circumstance — the desire map is JTBD, one row per audience' },
    { name: 'Outcome positioning', who: 'April Dunford · class A', note: 'position against the alternative in the buyer’s life, in the buyer’s words' },
  ],
}

export const MECHANISM = {
  formula: ['SPECIFIC AUDIENCE', 'UNRESOLVED TENSION', 'HIDDEN DESIRE', 'MEMORABLE OUTCOME'],
  verdict: 'The seed carousel ("wealthy people → time … everyone → no one") is an unattributable reposted meme — evidence class C. The mechanism beneath it is real (compressed JTBD + outcome positioning). Arganta keeps the mechanism and rejects the artwork, the wording and the pretense of attribution.',
  failure: 'The failure mode is stereotype: "parents → peace of mind" is true of the purchase moment, false of the relationship. The fix is claims discipline — a compressed outcome may open a post; the proof underneath must be specific and real.',
}

export interface DesireRow {
  audience: string
  product: string
  tension: string
  desire: string
  word: string
  proof: string
  never: string
}

export const DESIRE_MAP: DesireRow[] = [
  { audience: 'Organizing parent', product: 'ArgantaLab', tension: 'screen-time guilt vs developmental hope', desire: 'be a good parent and not fight about screens', word: 'PROOF', proof: 'cosmetic-only economy · visible learning · "what parents see"', never: 'guilt · fear · "100% safe" · unproven dev claims' },
  { audience: 'Kids 6–9', product: 'ArgantaLab', tension: 'being talked down to', desire: 'make something cool that’s theirs', word: 'MINE', proof: 'KinQuest · Buddy builds alongside · real creations', never: 'school framing · "learning app"' },
  { audience: 'Kids 10–14', product: 'ArgantaLab', tension: 'toy-grade tools', desire: 'make something REAL, show it off', word: 'REAL', proof: 'Builder → Ship loop · Studio games', never: 'childish framing' },
  { audience: 'Co-parent', product: 'Kinetik Circle', tension: 'being managed by an app', desire: 'stay in the loop with zero effort', word: 'EASE', proof: 'invite flow · participation, not tracking', never: '"accountability" · surveillance framing' },
  { audience: 'Whole family', product: 'LashiraBloom', tension: 'logistics-only togetherness', desire: 'something to do together, not just schedule', word: 'OURS', proof: 'shared farm · adults play, kids learn', never: 'grind mechanics' },
  { audience: 'Founders', product: 'build-in-public story', tension: 'isolation and chaos', desire: 'evidence they too could ship', word: 'MOMENTUM', proof: 'the weekly build log itself', never: 'guru advice · selling "systems"' },
  { audience: 'Experts', product: 'founder narrative', tension: 'fear of obsolescence in the AI transition', desire: 'a future where their judgment still counts', word: 'CONTINUITY', proof: 'the founder arc: geoscience → agentic AI', never: '"AI replaces X"' },
  { audience: 'Partners · investors', product: 'Arganta gateway', tension: 'fear of incoherent scope', desire: 'a focused wedge with honest optionality', word: 'LEGIBILITY', proof: 'one registry · one economy · honest readiness %', never: 'invented metrics · category hype' },
]

export const PERSONA = {
  name: 'The Systems Builder',
  line: 'A geoscientist who spent fifteen years modeling worlds no one can see now builds systems that make invisible growth visible.',
  archetype: 'Creator (builder) · Explorer secondary — not Sage, not Ruler, not Caregiver-as-primary',
  belief: 'Incomplete evidence, honestly modeled, beats confident fiction — in reservoirs and in companies.',
  enemy: 'Attention-harvesting technology · effortless-success theatre · AI as replacement.',
  tension: 'A father building family products while learning founding in public — uncertainty shown, never performed.',
  metaphor: 'The cross-section: strata, contours, hidden layers made visible — the one visual territory that is authentically the founder’s, unclaimed by any reference creator.',
  signature: 'I spent fifteen years modelling worlds underground. Now I build systems that help families grow above them.',
  refuses: ['guru posture', 'invented traction', 'children’s faces', 'fear-based parent marketing', 'borrowed visual identities', '"revolutionizing" vocabulary'],
}

export interface VoiceAxis { axis: string; left: string; right: string; score: number; why: string }

export const VOICE_AXES: VoiceAxis[] = [
  { axis: 'Warmth', left: 'clinical', right: 'warm', score: 7, why: 'warm competence — workshop at night, not a hug' },
  { axis: 'Authority', left: 'tentative', right: 'declarative', score: 6, why: 'declarative about what shipped; exploratory about what hasn’t' },
  { axis: 'Language', left: 'plain', right: 'poetic', score: 4, why: 'plain wins; one earned metaphor per piece' },
  { axis: 'Detail', left: 'compressed', right: 'analytical', score: 5, why: '3 on IG · 8 in decks — channel-dependent, never truth-dependent' },
  { axis: 'Energy', left: 'calm', right: 'urgent', score: 3, why: 'urgency is the attention economy’s tell' },
  { axis: 'Perspective', left: 'practical', right: 'visionary', score: 5, why: 'vision stated once, proven weekly' },
  { axis: 'Emotion', left: 'restrained', right: 'expressive', score: 6, why: 'celebration is quiet pride: "shipped."' },
  { axis: 'Style', left: 'editorial', right: 'conversational', score: 6, why: 'smart-friend register (F4)' },
  { axis: 'Identity', left: 'personal', right: 'institutional', score: 3, why: 'one founder + an AI co-builder, named as such' },
  { axis: 'Technology', left: 'skeptical', right: 'optimistic', score: 6, why: 'hopeful, with the never-say list as ballast' },
  { axis: 'Certainty', left: 'exploratory', right: 'absolute', score: 4, why: 'provenance badges are the voice' },
  { axis: 'Visual tone', left: 'documentary', right: 'cinematic', score: 7, why: 'cinematic composition, documentary claims' },
]

export interface ChannelRow { context: string; emotion: string; evidence: string; founder: string; detail: string; horizon: string }

export const CHANNELS: ChannelRow[] = [
  { context: 'IG carousel', emotion: 'high', evidence: 'one proof', founder: 'low', detail: 'low', horizon: 'near' },
  { context: 'IG founder story', emotion: 'high', evidence: 'medium', founder: 'high', detail: 'low', horizon: 'mid' },
  { context: 'Consumer landing', emotion: 'medium', evidence: 'medium', founder: 'low', detail: 'medium', horizon: 'near' },
  { context: 'Partner deck', emotion: 'medium', evidence: 'high', founder: 'medium', detail: 'high', horizon: 'mid' },
  { context: 'Investor deck', emotion: 'low-med', evidence: 'highest', founder: 'high', detail: 'medium', horizon: 'far' },
  { context: 'Product UI', emotion: 'lowest', evidence: '—', founder: 'none', detail: '—', horizon: 'none' },
]

export const CLAIM_CLASSES = [
  { k: 'belief', rule: 'present tense, first person — never sourced to fake research' },
  { k: 'aspiration', rule: 'future tense, explicitly: "we’re building toward…"' },
  { k: 'capability', rule: 'present tense only if repo-verified' },
  { k: 'evidence', rule: 'past tense with the artifact linked' },
  { k: 'customer outcome', rule: 'only with a real, consenting example' },
  { k: 'hypothesis', rule: 'labeled as such — even on Instagram' },
]

export interface Principle { n: number; title: string; statement: string; provenance: DoctrineProvenance }

export const PRINCIPLES: Principle[] = [
  { n: 1, title: 'Sell the visible growth, never the app', statement: 'The product disappears; the transformation is the message — with the proof attached.', provenance: 'source-grounded' },
  { n: 2, title: 'One audience, one tension, one word', statement: 'Every external piece picks a single row of the desire map. A message for everyone reaches no one.', provenance: 'source-grounded' },
  { n: 3, title: 'The build log is the pitch', statement: 'Method Law 17, elevated to marketing law. Never promise what has not shipped.', provenance: 'founder-locked' },
  { n: 4, title: 'Compression opens, evidence closes', statement: 'A memorable line may start the post; a real artifact must end it.', provenance: 'strategic-inference' },
  { n: 5, title: 'Never rent fear', statement: 'Parental guilt, expert obsolescence and founder FOMO are tensions to resolve — never to inflame.', provenance: 'founder-locked' },
  { n: 6, title: 'The metaphor is subsurface', statement: 'Strata, contours, cross-sections, hidden layers made visible — the one territory that is authentically Aldyth’s.', provenance: 'strategic-inference' },
  { n: 7, title: 'A builder, not a guru', statement: 'Share the method and the failure; never sell the dream.', provenance: 'founder-locked' },
  { n: 8, title: 'One mind, many rooms', statement: 'Channels differ in temperature, never in worldview. The deck is not Instagram in a suit; the UI never markets.', provenance: 'founder-locked' },
  { n: 9, title: 'AI is the named co-builder', statement: 'Never hidden, never the hero.', provenance: 'founder-locked' },
  { n: 10, title: 'Ship the thing and let it speak', statement: 'Silence over nonsense (Method Law 18) applies to marketing too.', provenance: 'founder-locked' },
]

export const GAPS = [
  'All desire-map tensions are inference — no audience interviews yet. First 10 parent conversations are the highest-leverage research act.',
  'Subsurface visual grammar is designed, not tested — needs 3 carousel experiments on the live ArgantaLab account. No new accounts.',
  'The founder signature line needs an ID-native version that isn’t a translation.',
  'No YouTube / long-form program until the IG doctrine has 90 days of evidence.',
]
