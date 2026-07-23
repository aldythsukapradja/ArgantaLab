import type { CSSProperties, ReactNode } from 'react'

type Product = {
  id: string
  name: string
  words: string
  accent: string
  brief: string
  wedge: string
  value: string
  stack: string
  identity: string
  emotion: string
  competitors: [string, string, string, 'Direct' | 'Adjacent' | 'Substitute'][]
  difference: string
}

const products: Product[] = [
  {
    id:'arganta', name:'Arganta.ai', words:'Operator · Reactor · Intelligence', accent:'#F2B544',
    brief:'The endorsed intelligence house: one coherent operator behind products, agents and creative systems.',
    wedge:'Turn one founder’s domain knowledge into a reusable intelligence-and-execution system.',
    value:'Shared intelligence, governance and reusable infrastructure across the whole house.',
    stack:'Brand OS · Agent OS · Supabase/Postgres · provider-agnostic AI seam.',
    identity:'A reactor with incomplete orbits: intelligence becomes useful through controlled motion.',
    emotion:'Calm power — complexity has a center.',
    competitors:[
      ['Palantir AIP','palantir.com','https://www.palantir.com/platforms/aip/','Direct'],
      ['Microsoft Foundry','microsoft.com','https://developer.microsoft.com/en-us/agents','Direct'],
      ['Agentforce','salesforce.com','https://www.salesforce.com/agentforce/','Direct'],
      ['ServiceNow AI','servicenow.com','https://www.servicenow.com/products/ai-agents.html','Direct'],
      ['IBM watsonx','ibm.com','https://www.ibm.com/watsonx','Adjacent'],
    ],
    difference:'An endorsed operating intelligence for its own product house—not a horizontal enterprise platform.'
  },
  {
    id:'life', name:'ArgantaLife', words:'Connect · Grow · Play', accent:'#FF7A59',
    brief:'The family promise: make today’s coordination and a child’s real progress visible in one trusted ritual.',
    wedge:'A five-minute math/logic quest feeding an evidence-backed family board and weekly reset.',
    value:'Less parental mental load and visible, evidence-backed growth for the child.',
    stack:'React · Supabase identity/RLS · deterministic learning logic · bounded LLM summaries.',
    identity:'A sheltering arch, people and a rising path: relationship first, progress held safely.',
    emotion:'Relief for parents; recognition for children.',
    competitors:[
      ['Skylight','skylightframe.com','https://www.skylightframe.com/calendar/','Direct'],
      ['Cozi','cozi.com','https://www.cozi.com/','Direct'],
      ['FamilyWall','familywall.com','https://www.familywall.com/','Direct'],
      ['Ohai.ai','ohai.ai','https://www.ohai.ai/','Adjacent'],
      ['Hearth Display','hearthdisplay.com','https://hearthdisplay.com/','Adjacent'],
    ],
    difference:'Today’s family plan plus one small quest plus credible proof of growth—not another generic calendar.'
  },
  {
    id:'energy', name:'ArgantaEnergy', words:'Consulting · Academy · Platform', accent:'#2E7CF6',
    brief:'A digital-petroleum practice joining expert advisory, capability building and operational software.',
    wedge:'Own explainable, expert-led decisions across the subsurface-to-well lifecycle.',
    value:'Faster petroleum decisions with uncertainty visible and expert judgment preserved.',
    stack:'Domain workflows · structured data · analytics · grounded agents; LLMs explain, not invent.',
    identity:'Strata crossed by a blue well path: knowledge reaches the reservoir.',
    emotion:'Technical confidence — uncertainty made navigable.',
    competitors:[
      ['SLB Delfi','slb.com','https://www.slb.com/products-and-services/delivering-digital-at-scale/software/delfi','Direct'],
      ['DecisionSpace 365','halliburton.com','https://www.halliburton.com/en/software','Direct'],
      ['Cognite','cognite.com','https://www.cognite.com/en/product/cognite-data-fusion','Adjacent'],
      ['Cordant','bakerhughes.com','https://www.bakerhughes.com/cordant','Adjacent'],
      ['Seeq','seeq.com','https://www.seeq.com/','Substitute'],
    ],
    difference:'A narrower expert wedge that combines advisory, academy and explainable lifecycle decisions.'
  },
  {
    id:'studio', name:'ArgantaStudio', words:'Concept · Create · Transform', accent:'#A06CE8',
    brief:'The ecosystem’s build-and-media studio for products, campaigns, games and digital transformation.',
    wedge:'One governed pipeline from idea to editable artifact to multi-channel launch.',
    value:'More high-quality products and media shipped without losing authorship.',
    stack:'React/Vite · Brand OS · ComfyUI/Cloudflare/fal/Muapi fabric · Supabase assets · Buffer.',
    identity:'A framed transformation node: raw intent enters, coherent work leaves.',
    emotion:'Creative momentum with control.',
    competitors:[
      ['Adobe Firefly','adobe.com','https://firefly.adobe.com/','Direct'],
      ['Canva','canva.com','https://www.canva.com/','Direct'],
      ['Figma','figma.com','https://www.figma.com/ai/','Adjacent'],
      ['Runway','runwayml.com','https://runwayml.com/','Adjacent'],
      ['Replit','replit.com','https://replit.com/ai','Adjacent'],
    ],
    difference:'One Brand-OS-governed path across media, working software, games, automation and launch.'
  },
  {
    id:'hq', name:'ArgantaHQ', words:'Command · Govern · Orchestrate', accent:'#AF9BE8',
    brief:'The internal operating system that sees the whole Arganta estate and coordinates specialist agents.',
    wedge:'A founder cockpit where live signals become decisions, verdicts and gated missions.',
    value:'A truthful whole-system view and shorter path from signal to accountable action.',
    stack:'React · Supabase/Postgres · agent_runs · Sense→Compute→Match · Claude/Codex bridge.',
    identity:'A command lattice around one core: many offices, one accountable center.',
    emotion:'Control without overwhelm.',
    competitors:[
      ['Copilot Studio','microsoft.com','https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio','Direct'],
      ['Agentforce','salesforce.com','https://www.salesforce.com/agentforce/','Direct'],
      ['ServiceNow AI','servicenow.com','https://www.servicenow.com/products/ai-agents.html','Direct'],
      ['CrewAI','crewai.com','https://www.crewai.com/','Adjacent'],
      ['LangGraph','langchain.com','https://www.langchain.com/langgraph','Substitute'],
    ],
    difference:'Not a horizontal agent builder: a founder cockpit with live evidence, accountable offices and gated action.'
  },
  {
    id:'kinetik', name:'KinetikCircle', words:'Connect · Rhythm · Remember', accent:'#EC93B5',
    brief:'A private coordination surface organized around real circles and the rhythm of family life.',
    wedge:'Replace scattered memory, chat and calendars with a lightweight shared view.',
    value:'A calmer family rhythm with less coordination falling through the cracks.',
    stack:'React · Supabase auth/data · guardian-circle identity · RLS · approval-led assistance.',
    identity:'Resonance rings with an open orbit: participation, never surveillance.',
    emotion:'The warmth of being remembered.',
    competitors:[
      ['Cozi','cozi.com','https://www.cozi.com/','Direct'],
      ['FamilyWall','familywall.com','https://www.familywall.com/','Direct'],
      ['TimeTree','timetreeapp.com','https://timetreeapp.com/','Direct'],
      ['Life360','life360.com','https://www.life360.com/','Adjacent'],
      ['Skylight','skylightframe.com','https://www.skylightframe.com/calendar/','Substitute'],
    ],
    difference:'Private-circle rhythm and remembered context, explicitly avoiding a location-first surveillance posture.'
  },
  {
    id:'lab', name:'ArgantaLab', words:'Learn · Build · Ship', accent:'#7BAEE8',
    brief:'The playable learning world where curiosity becomes skill, creation and shipped proof.',
    wedge:'Short mastery loops that unlock making—learning is action, not passive content.',
    value:'Mastery, creative confidence and tangible proof that a child can build.',
    stack:'Web games · deterministic mastery · shared identity · Heroes canvas compositor.',
    identity:'An open cube: knowledge is something children can enter and assemble.',
    emotion:'“I can build this.”',
    competitors:[
      ['Prodigy Math','prodigygame.com','https://www.prodigygame.com/main-en/','Direct'],
      ['Khan Academy Kids','khanacademy.org','https://www.khanacademy.org/kids','Direct'],
      ['Minecraft Education','education.minecraft.net','https://education.minecraft.net/','Adjacent'],
      ['Roblox Education','roblox.com','https://create.roblox.com/docs/education','Adjacent'],
      ['codeSpark','codespark.com','https://codespark.com/','Direct'],
    ],
    difference:'Learn→build→ship: mastery unlocks making in the shared world instead of ending at points.'
  },
  {
    id:'lashira', name:'LashiraBloom', words:'Farm · Battle · Together', accent:'#6EC492',
    brief:'A persistent family world where care, play and cooperative progress accumulate emotional value.',
    wedge:'A farm-and-battle loop that makes family contribution visible and gives growth a shared home.',
    value:'A world whose accumulated care strengthens return, contribution and belonging.',
    stack:'Web game systems · Supabase cloud state · shared Heroes compositor; AI is optional.',
    identity:'A five-leaf bloom with a living center and seed: patient growth.',
    emotion:'Tender ownership of a world built together.',
    competitors:[
      ['Stardew Valley','stardewvalley.net','https://www.stardewvalley.net/','Direct'],
      ['Palia','palia.com','https://www.palia.com/','Direct'],
      ['Animal Crossing','animal-crossing.com','https://animal-crossing.com/new-horizons/','Adjacent'],
      ['Farm Together 2','store.steampowered.com','https://store.steampowered.com/app/2418520/Farm_Together_2/','Direct'],
      ['Dreamlight Valley','disneydreamlightvalley.com','https://disneydreamlightvalley.com/','Adjacent'],
    ],
    difference:'A family-scoped world where care, battle and learning contribution accumulate shared emotional value.'
  },
]

function PortfolioMark({ id }: { id: string }) {
  const common = { fill:'none', stroke:'currentColor', strokeWidth:2.5, strokeLinecap:'round' as const, strokeLinejoin:'round' as const }
  const marks: Record<string, ReactNode> = {
    arganta:<><circle {...common} cx="30" cy="30" r="9"/><circle cx="30" cy="30" r="4" fill="currentColor"/><path {...common} d="M12 26a19 19 0 0 1 25-14M47 20a19 19 0 0 1-3 24M35 49A19 19 0 0 1 11 31"/><circle cx="44" cy="13" r="2.5" fill="currentColor"/></>,
    life:<><path {...common} d="M11 46V31Q11 18 22 12q8-5 16 0 11 6 11 19v15"/><path {...common} d="M17 44q6-9 13-9t13 9"/><circle cx="20" cy="29" r="3" fill="currentColor"/><circle cx="30" cy="24" r="4" fill="currentColor"/><circle cx="40" cy="29" r="3" fill="currentColor"/></>,
    energy:<><path {...common} d="M8 20q11-6 22 0t22 0M8 31q11-6 22 0t22 0M8 42q11-6 22 0t22 0M31 8v36l8 7"/><circle cx="40" cy="52" r="3" fill="currentColor"/></>,
    studio:<><path {...common} d="M10 24V10h14M36 10h14v14M50 36v14H36M24 50H10V36M17 43l27-27"/><circle cx="20" cy="40" r="3" fill="currentColor"/><path {...common} d="m40 18 6 6-6 6-6-6z"/></>,
    hq:<><circle {...common} cx="30" cy="30" r="22"/><path {...common} d="M30 30V8m0 22L11 41m19-11 19 11M30 30 11 19m19 11 19-11m-19 11v22"/><path {...common} d="m30 23 7 4v8l-7 4-7-4v-8z"/></>,
    kinetik:<><circle {...common} cx="30" cy="30" r="22"/><path {...common} d="M30 16a14 14 0 1 1-12 7"/><circle {...common} cx="30" cy="30" r="6"/><circle cx="30" cy="8" r="3" fill="currentColor"/></>,
    lab:<><path {...common} d="m30 7 19 11v23L30 52 11 41V18zM11 18l19 11 19-11M30 29v23"/><circle cx="30" cy="7" r="3" fill="currentColor"/></>,
    lashira:<><path {...common} d="M30 8q8 13 0 26Q22 21 30 8Zm0 26Q18 30 14 15q14 5 16 19Zm0 0q12-4 16-19-14 5-16 19Zm0 0Q16 44 7 32q14-2 23 2Zm0 0q14 10 23-2-14-2-23 2Zm0 0v18"/><circle cx="30" cy="54" r="2.5" fill="currentColor"/></>,
  }
  return <svg viewBox="0 0 60 60" aria-hidden="true">{marks[id]}</svg>
}

function MarkTemplate({ product }: { product: Product }) {
  return <div className="ps-template" style={{ '--product':product.accent } as CSSProperties}>
    {(['light','dark'] as const).map(t => <div className={'ps-template-cell '+t} key={t}>
      <PortfolioMark id={product.id}/><b>{product.name}</b><small>{product.words}</small>
    </div>)}
  </div>
}

export function PortfolioSummary() {
  return <div className="bio-scroll ps">
    <section className="ps-hero">
      <span>ARGANTA · PORTFOLIO SUMMARY 01</span>
      <h1>The Reactor Constellation</h1>
      <p>One intelligence spine, one operating system and six product worlds. Each identity carries a narrow promise the product must earn.</p>
      <aside><b>Truth rule</b>Deterministic systems establish facts. Models interpret and orchestrate. Human authority remains at consequential gates.</aside>
    </section>

    <section className="ps-icon-board">
      <header><div><span>Identity system</span><h2>Light / dark icon template</h2></div><p>This comparison intentionally stays split-mode; the remainder follows the active HQ theme.</p></header>
      <div className="ps-template-grid">{products.map(p => <MarkTemplate key={p.id} product={p}/>)}</div>
    </section>

    <section className="ps-products">
      <header className="ps-section-head"><span>Product dossiers</span><h2>What each mark promises</h2></header>
      <div className="ps-product-grid">{products.map(p =>
        <article className="ps-card" key={p.id} style={{ '--product':p.accent } as CSSProperties}>
          <header><div className="ps-mark"><PortfolioMark id={p.id}/></div><div><h3>{p.name}</h3><small>{p.words}</small></div></header>
          <p className="ps-brief">{p.brief}</p>
          <dl>
            <div><dt>Wedge</dt><dd>{p.wedge}</dd></div>
            <div><dt>Value</dt><dd>{p.value}</dd></div>
            <div><dt>Stack / LLM</dt><dd>{p.stack}</dd></div>
            <div><dt>Identity</dt><dd>{p.identity}</dd></div>
          </dl>
          <blockquote>{p.emotion}</blockquote>
          <div className="ps-rivals">{p.competitors.map(([name,domain,url,type]) =>
            <a href={url} target="_blank" rel="noreferrer" title={`${name} — official product site`} key={name}>
              <img src={`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent('https://'+domain)}&sz=128`} alt=""/>
              <span><b>{name}</b><em>{type}</em></span>
            </a>)}
          </div>
          <p className="ps-difference"><b>Arganta difference</b>{p.difference}</p>
        </article>)}
      </div>
    </section>
    <footer className="ps-footer">Brand OS · product audits · Agent OS · Studio master plan <span>Identity is a promise the product must earn.</span></footer>
  </div>
}
