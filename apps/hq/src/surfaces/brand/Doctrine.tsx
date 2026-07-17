/**
 * THE DOCTRINE — the third Brand Studio pill. Where The Method answers "how do
 * we decide design calls?", this answers "how do we speak to the outside
 * world?" — the philosophical marketing canon from the 2026-07-17 handoff,
 * grounded to the real products (F9 in the knowledge base is the canon;
 * doctrineData.ts is this file's data).
 *
 * Same bones as Method.tsx on purpose: section rail on the left, content in
 * the middle, and every section footnotes the canon note in the Vault. The
 * provenance vocabulary is the doctrine's own (source-grounded ·
 * strategic-inference · founder-locked) — honesty about what is research and
 * what is a founder decision is itself doctrine principle material.
 */
import { useState } from 'react'
import {
  TRUTH, MECHANISM, DESIRE_MAP, PERSONA, VOICE_AXES, CHANNELS, CLAIM_CLASSES,
  PRINCIPLES, GAPS, DOCTRINE_NOTE, type DoctrineProvenance,
} from './doctrineData'

const PROV_GLYPH: Record<DoctrineProvenance, string> = {
  'source-grounded': '●', 'strategic-inference': '◐', 'founder-locked': '○',
}

const SECTIONS = [
  { id: 'truth', roman: 'I', label: 'The Truth' },
  { id: 'mechanism', roman: 'II', label: 'The Mechanism' },
  { id: 'desire', roman: 'III', label: 'Desire Map' },
  { id: 'persona', roman: 'IV', label: 'The Persona' },
  { id: 'voice', roman: 'V', label: 'Voice Axes' },
  { id: 'channels', roman: 'VI', label: 'Channels & Claims' },
  { id: 'principles', roman: 'VII', label: 'Ten Principles' },
] as const

type SectionId = typeof SECTIONS[number]['id']

export function Doctrine({ onSource }: { onSource: (id: string) => void }) {
  const [sec, setSec] = useState<SectionId>('truth')

  return (
    <div className="bs-doctrine">
      <aside className="bs-fam">
        <div className="bs-fam-h">THE DOCTRINE</div>
        {SECTIONS.map(s => (
          <button key={s.id} className={'bs-fam-b' + (s.id === sec ? ' on' : '')} onClick={() => setSec(s.id)}>
            <em>{s.roman}</em><span>{s.label}</span>
          </button>
        ))}
        <button className="bs-fam-canon" onClick={() => onSource(DOCTRINE_NOTE)}>READ THE CANON →</button>
        <div className="bs-creed">
          <b>PROVENANCE</b>
          <span>● source-grounded</span>
          <span>◐ strategic-inference</span>
          <span>○ founder-locked</span>
        </div>
      </aside>

      <div className="bs-doc-body">
        {sec === 'truth' && <SecTruth />}
        {sec === 'mechanism' && <SecMechanism />}
        {sec === 'desire' && <SecDesire />}
        {sec === 'persona' && <SecPersona />}
        {sec === 'voice' && <SecVoice />}
        {sec === 'channels' && <SecChannels />}
        {sec === 'principles' && <SecPrinciples />}
      </div>
    </div>
  )
}

function SecTruth() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">THE CENTRAL HUMAN TRUTH</div>
      <p className="bs-doc-display">{TRUTH.human}</p>
      <div className="bs-doc-k">THE ARGANTA BELIEF</div>
      <p className="bs-doc-lede">{TRUTH.belief}</p>
      <div className="bs-doc-k">THE ONE PROBLEM BENEATH FIVE PRODUCTS</div>
      <p className="bs-doc-lede">{TRUTH.spine}</p>
      <div className="bs-doc-k">GROUNDED IN</div>
      <div className="bs-doc-grid2">
        {TRUTH.grounding.map(g => (
          <div key={g.name} className="bs-doc-card">
            <b>{g.name}</b><em>{g.who}</em><p>{g.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SecMechanism() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">THE ADOPTED MECHANISM</div>
      <div className="bs-doc-formula">
        {MECHANISM.formula.map((step, i) => (
          <span key={step}>{i > 0 && <i>→</i>}<b>{step}</b></span>
        ))}
      </div>
      <div className="bs-doc-k">RESEARCH VERDICT ON THE SEED CAROUSEL</div>
      <p className="bs-doc-lede">{MECHANISM.verdict}</p>
      <div className="bs-doc-k">THE FAILURE MODE</div>
      <p className="bs-doc-lede">{MECHANISM.failure}</p>
    </div>
  )
}

function SecDesire() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">AUDIENCE → TENSION → DESIRE → WORD · every proof ships today · ◐ until interviews exist</div>
      <div className="bs-desire">
        {DESIRE_MAP.map(r => (
          <div key={r.audience} className="bs-desire-row">
            <div className="bs-desire-who"><b>{r.audience}</b><em>{r.product}</em></div>
            <div className="bs-desire-mid">
              <p><i>tension</i>{r.tension}</p>
              <p><i>desire</i>{r.desire}</p>
              <p className="proof"><i>proof</i>{r.proof}</p>
              <p className="never"><i>never</i>{r.never}</p>
            </div>
            <div className="bs-desire-word">{r.word}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SecPersona() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">THE SYSTEMS BUILDER · VALIDATED ◐</div>
      <p className="bs-doc-display sm">{PERSONA.line}</p>
      <div className="bs-doc-grid2">
        <div className="bs-doc-card"><b>Archetype</b><p>{PERSONA.archetype}</p></div>
        <div className="bs-doc-card"><b>Core belief</b><p>{PERSONA.belief}</p></div>
        <div className="bs-doc-card"><b>Enemy</b><p>{PERSONA.enemy}</p></div>
        <div className="bs-doc-card"><b>Human tension</b><p>{PERSONA.tension}</p></div>
        <div className="bs-doc-card"><b>Signature metaphor</b><p>{PERSONA.metaphor}</p></div>
        <div className="bs-doc-card"><b>Refuses</b><p>{PERSONA.refuses.join(' · ')}</p></div>
      </div>
      <div className="bs-doc-k">SIGNATURE LINE · HYPOTHESIS, NOT FINAL BIO</div>
      <p className="bs-doc-sig">“{PERSONA.signature}”</p>
    </div>
  )
}

function SecVoice() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">TWELVE AXES · 1–10 · FROM THE HANDOFF'S SCALE</div>
      <div className="bs-axes">
        {VOICE_AXES.map(a => (
          <div key={a.axis} className="bs-axis" title={a.why}>
            <span className="l">{a.left}</span>
            <div className="bs-axis-track">
              <b>{a.axis}</b>
              <i style={{ left: `${(a.score - 1) * (100 / 9)}%` }}>{a.score}</i>
            </div>
            <span className="r">{a.right}</span>
          </div>
        ))}
      </div>
      <div className="bs-doc-k">HOVER AN AXIS FOR THE WHY</div>
    </div>
  )
}

function SecChannels() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-k">TEMPERATURE MATRIX · ONE WORLDVIEW, DIFFERENT EVIDENCE DENSITY</div>
      <div className="bs-chan">
        <div className="bs-chan-row head">
          <span>context</span><span>emotion</span><span>evidence</span><span>founder</span><span>detail</span><span>horizon</span>
        </div>
        {CHANNELS.map(c => (
          <div key={c.context} className="bs-chan-row">
            <span className="ctx">{c.context}</span><span>{c.emotion}</span><span>{c.evidence}</span><span>{c.founder}</span><span>{c.detail}</span><span>{c.horizon}</span>
          </div>
        ))}
      </div>
      <div className="bs-doc-k">CLAIMS DISCIPLINE · THE CLASS DICTATES THE TENSE</div>
      <div className="bs-doc-grid2">
        {CLAIM_CLASSES.map(c => (
          <div key={c.k} className="bs-doc-card slim"><b>{c.k}</b><p>{c.rule}</p></div>
        ))}
      </div>
      <p className="bs-doc-foot">Never write an aspiration in a capability’s tense — this single rule separates Arganta’s emotional marketing from the manipulative kind.</p>
    </div>
  )
}

function SecPrinciples() {
  return (
    <div className="bs-doc-sec">
      <div className="bs-doc-grid2">
        {PRINCIPLES.map(p => (
          <div key={p.n} className="bs-doc-card">
            <em>{PROV_GLYPH[p.provenance]} PRINCIPLE {String(p.n).padStart(2, '0')}</em>
            <b>{p.title}</b>
            <p>{p.statement}</p>
          </div>
        ))}
      </div>
      <div className="bs-doc-k">HONEST GAPS · WHAT STILL NEEDS VALIDATION</div>
      {GAPS.map(g => <p key={g} className="bs-doc-gap">◐ {g}</p>)}
    </div>
  )
}
