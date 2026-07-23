import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourcePath = path.join(root, 'generated-media', 'arganta-icon-system-board.html')
const outputPath = path.join(root, 'generated-media', 'arganta-perspectives.html')
const sourceHtml = fs.readFileSync(sourcePath, 'utf8')
const archiveB64 = Buffer.from(sourceHtml).toString('base64')
const sourceDefs = sourceHtml.match(/<defs>([\s\S]*?)<\/defs>/)?.[1]
if (!sourceDefs) throw new Error('Could not find the canonical SVG symbol library')

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>Arganta Perspectives</title>
<style>
:root{--bg:#07080b;--bg2:#0d0f14;--glass:rgba(22,24,31,.72);--glass2:rgba(255,255,255,.055);--line:rgba(255,255,255,.11);--ink:#f5f3ee;--muted:#9ca3af;--soft:#c7ccd4;--violet:#a98ad9;--gold:#efbd68;--coral:#ff7a59;--blue:#5a96ed;--green:#72c99c;--shadow:0 35px 100px rgba(0,0,0,.45);--radius:28px;--max:1240px}
*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--bg)}body{margin:0;color:var(--ink);background:radial-gradient(circle at 75% 0,#1f1930 0,transparent 35%),radial-gradient(circle at 10% 25%,#111e2c 0,transparent 32%),var(--bg);font-family:Inter,"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
button,a{font:inherit}button{color:inherit}.hidden{display:none!important}.glass{border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(24px) saturate(135%);-webkit-backdrop-filter:blur(24px) saturate(135%);box-shadow:var(--shadow)}
.gate{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 15%,#292038 0,transparent 34%),linear-gradient(180deg,#090a0e,#050609)}
.gate-inner{width:min(1080px,100%);text-align:center}.wordmark{display:inline-flex;align-items:center;gap:11px;font-size:13px;font-weight:680;letter-spacing:.12em;text-transform:uppercase}.brand-dot{width:25px;height:25px;border:1px solid #b59bd7;border-radius:50%;position:relative}.brand-dot:before,.brand-dot:after{content:"";position:absolute;inset:5px;border:1px solid #b59bd7;border-radius:50%}.brand-dot:after{inset:10px;background:#b59bd7}
.gate h1{margin:72px 0 12px;font-size:clamp(40px,7vw,82px);font-weight:540;letter-spacing:-.055em}.gate-lead{margin:0 auto 42px;max-width:640px;color:var(--muted);font-size:16px;line-height:1.6}
.profiles{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.profile{position:relative;min-height:300px;padding:24px;border:1px solid var(--line);border-radius:32px;overflow:hidden;text-align:left;background:rgba(255,255,255,.045);cursor:pointer;transition:.45s cubic-bezier(.2,.8,.2,1)}.profile:hover,.profile:focus-visible{transform:translateY(-9px) scale(1.015);border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.075);outline:none}.profile-visual{height:165px;border-radius:22px;position:relative;overflow:hidden;background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--accent) 70%,white),transparent 12%),radial-gradient(circle at 60% 75%,var(--accent),transparent 33%),linear-gradient(140deg,#191c24,#0d0f14)}.profile-visual:after{content:"";position:absolute;width:140px;height:140px;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid color-mix(in srgb,var(--accent) 55%,transparent);border-radius:50%;box-shadow:0 0 0 22px color-mix(in srgb,var(--accent) 12%,transparent),0 0 0 52px color-mix(in srgb,var(--accent) 7%,transparent)}.profile h2{margin:20px 0 6px;font-size:21px;letter-spacing:-.025em}.profile p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
.app{min-height:100vh}.topbar{position:fixed;z-index:50;left:18px;right:18px;top:14px;height:66px;padding:0 16px;display:flex;align-items:center;gap:14px;border-radius:22px}.topbar .wordmark{margin-right:auto}.persona-pill,.theme-btn,.change-btn{border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.055);padding:9px 12px;font-size:11px;cursor:pointer}.persona-pill{color:var(--violet)}.theme-btn{width:37px;height:37px;padding:0}.chapter-nav{position:fixed;z-index:48;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:5px;padding:7px;border-radius:20px;max-width:calc(100vw - 24px)}.chapter-nav a{display:flex;align-items:center;gap:7px;padding:10px 13px;border-radius:14px;color:var(--muted);text-decoration:none;font-size:10px;white-space:nowrap;transition:.25s}.chapter-nav a.on{color:var(--ink);background:rgba(255,255,255,.1)}.chapter-nav b{font-size:8px;color:var(--violet)}
main{padding-bottom:110px}.chapter{min-height:100vh;padding:125px max(6vw,24px) 90px;display:flex;align-items:center;scroll-margin-top:90px}.chapter-inner{width:min(var(--max),100%);margin:auto}.eyebrow{color:var(--violet);font-size:10px;font-weight:750;letter-spacing:.14em;text-transform:uppercase}.display{max-width:1000px;margin:18px 0 20px;font-size:clamp(47px,7.6vw,108px);font-weight:510;line-height:.94;letter-spacing:-.066em}.lede{max-width:750px;color:var(--soft);font-size:clamp(16px,2vw,23px);line-height:1.55}.chapter-head{display:grid;grid-template-columns:1.2fr .8fr;align-items:end;gap:50px;margin-bottom:40px}.chapter-head h2{margin:10px 0 0;font-size:clamp(38px,5vw,70px);font-weight:520;letter-spacing:-.052em;line-height:1}.chapter-head p{margin:0;color:var(--muted);font-size:15px;line-height:1.65}
.hero-actions,.links{display:flex;flex-wrap:wrap;gap:9px;margin-top:28px}.btn{display:inline-flex;padding:12px 17px;border:1px solid var(--line);border-radius:999px;color:var(--ink);background:rgba(255,255,255,.055);text-decoration:none;font-size:12px;cursor:pointer}.btn.primary{color:#101116;background:var(--ink);border-color:var(--ink)}
.thesis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:65px}.thesis-card,.card{padding:24px;border-radius:var(--radius)}.thesis-card b{display:block;color:var(--violet);font-size:10px;letter-spacing:.1em;text-transform:uppercase}.thesis-card strong{display:block;margin-top:28px;font-size:23px;letter-spacing:-.035em}.thesis-card span{display:block;margin-top:7px;color:var(--muted);font-size:12px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.grid.two{grid-template-columns:repeat(2,1fr)}.card{position:relative;border:1px solid var(--line);background:var(--glass2);overflow:hidden}.card.accent{border-top:2px solid var(--accent)}.card .kicker{color:var(--accent,var(--violet));font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}.card h3{margin:13px 0 8px;font-size:21px;letter-spacing:-.035em}.card p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.card ul{margin:14px 0 0;padding-left:17px;color:var(--soft);font-size:11px;line-height:1.65}.mark{width:56px;height:56px;margin-bottom:18px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:18px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 10%,transparent)}.mark i{width:24px;height:24px;border:1.5px solid var(--accent);border-radius:50%;box-shadow:inset 0 0 0 5px transparent;position:relative}.mark i:after{content:"";position:absolute;width:6px;height:6px;left:8px;top:8px;border-radius:50%;background:var(--accent)}
.metric-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{padding:20px;border:1px solid var(--line);border-radius:20px;background:var(--glass2)}.metric b{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.metric strong{display:block;margin-top:9px;font-size:25px;letter-spacing:-.04em}.metric small{display:block;margin-top:6px;color:var(--muted);font-size:10px;line-height:1.4}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:22px;background:var(--glass2)}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:13px 15px;border-bottom:1px solid var(--line);text-align:left;font-size:11px;line-height:1.45;vertical-align:top}th{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}tr:last-child td{border-bottom:0}.status{font-size:9px;color:var(--gold)}
.timeline{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.step{padding:20px;border:1px solid var(--line);border-radius:20px;background:var(--glass2)}.step b{color:var(--violet);font-size:9px}.step h3{font-size:15px}.step p{color:var(--muted);font-size:10px;line-height:1.5}
.persona-only{display:none}.persona-family .for-family,.persona-investor .for-investor,.persona-partner .for-partner{display:block}.persona-family .for-family.grid,.persona-investor .for-investor.grid,.persona-partner .for-partner.grid{display:grid}
details{margin-top:14px;border:1px solid var(--line);border-radius:18px;background:var(--glass2)}summary{padding:15px 18px;cursor:pointer;color:var(--soft);font-size:11px}details>div{padding:0 18px 18px;color:var(--muted);font-size:11px;line-height:1.6}
.archive-box{padding:20px;border-radius:28px}.archive-frame{width:100%;height:78vh;border:1px solid var(--line);border-radius:20px;background:#0b0c10}.archive-note{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:14px}.archive-note p{max-width:760px;margin:0;color:var(--muted);font-size:11px;line-height:1.5}
.footer-note{margin-top:40px;padding:18px;border-left:2px solid var(--gold);color:var(--muted);font-size:10px;line-height:1.6;background:rgba(239,189,104,.06)}
[data-theme="light"]{--bg:#f3f1ec;--bg2:#fff;--glass:rgba(255,255,255,.74);--glass2:rgba(255,255,255,.62);--line:rgba(14,17,23,.12);--ink:#14161b;--muted:#6f7580;--soft:#3c414a;--shadow:0 35px 100px rgba(54,47,38,.14)}
[data-theme="light"] body{background:radial-gradient(circle at 75% 0,#ece4f5 0,transparent 35%),radial-gradient(circle at 10% 25%,#e5eff5 0,transparent 32%),var(--bg)}
@media(max-width:850px){.profiles{grid-template-columns:1fr}.profile{min-height:210px;display:grid;grid-template-columns:150px 1fr;gap:18px}.profile-visual{height:160px;grid-row:1/3}.profile h2{align-self:end}.gate{position:absolute;min-height:100vh}.chapter{padding:115px 18px 90px;align-items:flex-start}.chapter-head{grid-template-columns:1fr;gap:16px}.grid,.grid.two,.thesis,.metric-row{grid-template-columns:1fr}.timeline{grid-template-columns:1fr 1fr}.chapter-nav{overflow:auto;justify-content:flex-start;left:12px;right:12px;transform:none}.topbar{left:10px;right:10px}.topbar .wordmark span:last-child{display:none}.change-btn{display:none}.archive-frame{height:72vh}}
@media(max-width:560px){.profile{display:block}.profile-visual{height:125px}.gate h1{margin-top:45px}.timeline{grid-template-columns:1fr}.display{font-size:50px}.chapter-head h2{font-size:42px}.chapter-nav a{padding:9px}.chapter-nav a span{display:none}.metric-row{grid-template-columns:1fr 1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
/* Horizontal presentation and canonical SVG identity */
html,body{overflow:hidden}.app{height:100vh;overflow:hidden}
.line,.accent-line,.accent-hair,.hair,.soft{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}.line{stroke-width:3}.hair{stroke-width:1.55;opacity:.72}.soft{stroke-width:2;opacity:.34}.accent-line{stroke:var(--accent,currentColor);stroke-width:3}.accent-hair{stroke:var(--accent,currentColor);stroke-width:1.6}.accent-fill{fill:var(--accent,currentColor)}
.brand-button{border:0;background:none;padding:0;color:inherit;cursor:pointer}.brand-logo{width:29px;height:29px;color:var(--ink);--accent:#b59bd7;display:block}
main{height:100vh;padding:0;display:flex;overflow:hidden;transform:translateX(0);transition:transform .62s cubic-bezier(.22,.8,.22,1)}
.chapter{flex:0 0 100vw;width:100vw;height:100vh;min-height:0;padding:115px max(6vw,24px) 88px;align-items:flex-start;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.chapter-inner{margin:auto}
.slide-arrow{position:fixed;z-index:49;top:50%;width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:var(--glass);backdrop-filter:blur(18px);color:var(--ink);cursor:pointer;font-size:21px}.slide-arrow.prev{left:16px}.slide-arrow.next{right:16px}.slide-arrow:disabled{opacity:.18;cursor:default}
.mark{width:64px;height:64px}.product-logo{width:52px;height:52px;color:var(--ink)}
.persona-me .persona-only,.persona-me .for-me{display:block}.persona-me .persona-only.grid{display:grid}
.unlock{position:fixed;z-index:130;inset:0;display:grid;place-items:center;padding:20px;background:rgba(3,4,7,.78);backdrop-filter:blur(24px)}.unlock-card{width:min(400px,100%);padding:30px;border-radius:28px;text-align:left}.unlock-card h2{margin:0 0 8px;font-size:28px}.unlock-card p{color:var(--muted);font-size:12px;line-height:1.5}.unlock-card input{width:100%;margin:18px 0 12px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--glass2);color:var(--ink);outline:none}.unlock-actions{display:flex;gap:9px;justify-content:flex-end}.unlock-error{min-height:18px;color:#ff8975;font-size:11px}
@media(max-width:850px){.chapter{padding:105px 18px 88px}.chapter-nav{left:54px;right:54px}.slide-arrow{top:auto;bottom:19px;width:36px;height:36px}.slide-arrow.prev{left:10px}.slide-arrow.next{right:10px}}
</style>
</head>
<body>
<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${sourceDefs}</defs></svg>
<section class="gate" id="personaGate">
 <div class="gate-inner">
  <button class="wordmark brand-button" id="founderUnlock" aria-label="Open founder perspective"><svg class="brand-logo" viewBox="0 0 120 120"><use href="#mark-arganta"/></svg><span>Arganta Perspectives</span></button>
  <h1>Choose your perspective.</h1>
  <p class="gate-lead">One company truth, curated around what matters to you. You can change perspective at any time.</p>
  <div class="profiles">
   <button class="profile" style="--accent:#ff7a59" data-persona="family"><div class="profile-visual"></div><h2>Family & Friends</h2><p>Explore the family experience, trust model and how to join the first pilot.</p></button>
   <button class="profile" style="--accent:#efbd68" data-persona="investor"><div class="profile-visual"></div><h2>Investor</h2><p>Examine the wedge, market, economics, evidence, risk and value-creation path.</p></button>
   <button class="profile" style="--accent:#5a96ed" data-persona="partner"><div class="profile-visual"></div><h2>Technology Partner</h2><p>Understand the product system, architecture, delivery boundaries and partnership surface.</p></button>
  </div>
 </div>
</section>

<div class="app hidden" id="app">
 <header class="topbar glass">
  <button class="wordmark brand-button" id="founderUnlockApp" aria-label="Open founder perspective"><svg class="brand-logo" viewBox="0 0 120 120"><use href="#mark-arganta"/></svg><span>Arganta Perspectives</span></button>
  <button class="persona-pill" id="personaLabel">Investor</button>
  <button class="change-btn" id="changePersona">Change perspective</button>
  <button class="theme-btn" id="themeBtn" aria-label="Toggle theme">◐</button>
 </header>
 <nav class="chapter-nav glass" aria-label="Chapters">
  <a href="#why"><b>01</b><span>Why Arganta</span></a>
  <a href="#products"><b>02</b><span>What We Build</span></a>
  <a href="#win"><b>03</b><span>Why It Wins</span></a>
  <a href="#operate"><b>04</b><span>How It Operates</span></a>
  <a href="#evidence"><b>05</b><span>Economics & Evidence</span></a>
 </nav>
 <button class="slide-arrow prev" id="prevChapter" aria-label="Previous chapter">‹</button>
 <button class="slide-arrow next" id="nextChapter" aria-label="Next chapter">›</button>

 <main>
  <section class="chapter" id="why">
   <div class="chapter-inner">
    <div class="eyebrow">Chapter 01 · Why Arganta</div>
    <h1 class="display">Make family progress visible.</h1>
    <p class="lede persona-only for-family">Today’s plan for parents, one meaningful quest for children, and credible proof that your family is moving forward—inside a circle you trust.</p>
    <p class="lede persona-only for-investor">A family-growth ritual is the commercial wedge. Energy and Studio create nearer-term revenue options; HQ and Core make the portfolio governable.</p>
    <p class="lede persona-only for-partner">A connected product house built around one identity, data and agent substrate—designed to turn evidence into governed creation and delivery.</p>
    <div class="hero-actions"><a class="btn primary" href="#products">Explore the system</a><a class="btn" href="https://arganta.app" target="_blank">Open Arganta</a></div>
    <div class="thesis">
     <article class="thesis-card glass"><b>The child’s pull</b><strong>Kids see play.</strong><span>Short quests, real creation, persistent worlds and meaningful progression.</span></article>
     <article class="thesis-card glass"><b>The parent’s stick</b><strong>Parents see growth.</strong><span>Coordination, evidence, reflection and one calmer weekly rhythm.</span></article>
     <article class="thesis-card glass"><b>The shared outcome</b><strong>The family plays together.</strong><span>Weekly Two-Hook Families connect child learning with parent participation.</span></article>
    </div>
    <div class="footer-note">Current evidence state: deep technical repository and product surfaces; no verified external revenue, paid family cohort or retained-user evidence yet. The narrative distinguishes built, verified, modeled, planned and candidate claims.</div>
   </div>
  </section>

  <section class="chapter" id="products">
   <div class="chapter-inner">
    <div class="chapter-head"><div><div class="eyebrow">Chapter 02 · What We Build</div><h2>One system. Distinct reasons to return.</h2></div><p>Arganta is not eight simultaneous startups. Each surface has a job, an accountable owner and a critical loop; shared infrastructure is valuable only when it reduces cost or improves outcomes.</p></div>
    <div class="grid" id="productGrid"></div>
    <div class="persona-only for-family"><details open><summary>Your first experience</summary><div>Start with Today: coordinate one family need, let a child complete one five-minute quest, review the evidence together and close the week with a simple reset. The pilot begins with 10–20 trusted families.</div></details></div>
    <div class="persona-only for-investor"><details open><summary>Portfolio sequencing</summary><div>Life/Kinetik is the family subscription wedge. Energy and Studio test paid expertise and delivery. HQ/Core stays internal until it repeatedly improves margin, control or delivery and receives external pull.</div></details></div>
    <div class="persona-only for-partner"><details open><summary>Shared technical substrate</summary><div>PostgreSQL/Supabase, TypeScript/Node, React/Vite, agent_runs and media_asset lineage, provider routing, grounded retrieval, approval gates, reusable Brand OS components and product-specific workbenches.</div></details></div>
   </div>
  </section>

  <section class="chapter" id="win">
   <div class="chapter-inner">
    <div class="chapter-head"><div><div class="eyebrow">Chapter 03 · Why It Wins</div><h2>Proof before breadth.</h2></div><p>The opportunity is large, but market size does not create advantage. Arganta must earn a repeated family ritual, trusted expert delivery and proprietary evidence loops.</p></div>
    <div class="metric-row">
     <div class="metric"><b>Global AI pool</b><strong>$235B+</strong><small>Reported market context; not ArgantaHQ obtainable revenue.</small></div>
     <div class="metric"><b>Digital oilfield</b><strong>$31.2B</strong><small>2025 reported estimate; durable growth.</small></div>
     <div class="metric"><b>Creator economy</b><strong>$253B</strong><small>Broad pool; Studio tools are a smaller serviceable slice.</small></div>
     <div class="metric"><b>Global games</b><strong>$201.6B</strong><small>2025 market; cozy/family opportunity modeled separately.</small></div>
    </div>
    <div class="grid two">
     <article class="card accent" style="--accent:#ff7a59"><div class="kicker">Family wedge</div><h3>One calmer family week.</h3><p>Today board, five-minute quest, credible proof of growth and weekly reset—not another shared calendar.</p><ul><li>$9 monthly / $79 annual hypothesis</li><li>10–20 family evidence pilot</li><li>Worldwide, GCC and Indonesia thesis</li><li>Life360 is the adjacent scale proxy</li></ul></article>
     <article class="card accent" style="--accent:#2e7cf6"><div class="kicker">Commercial wedge</div><h3>Expert decisions made explainable.</h3><p>Energy starts as a paid diagnostic and advisory product. Studio starts as a fixed-scope transformation sprint.</p><ul><li>Sell before horizontal platform expansion</li><li>Measure human time, API cost and rework</li><li>Productize repeated methods</li><li>Build referenceable outcomes</li></ul></article>
     <article class="card accent persona-only for-investor" style="--accent:#efbd68"><div class="kicker">Market direction</div><h3>Emerging where Arganta is strongest.</h3><p>AI, agents, creator tooling and family-learning experiences are emerging; digital oilfield is durable; games are mature with a growing cozy segment.</p></article>
     <article class="card accent persona-only for-partner" style="--accent:#5a96ed"><div class="kicker">Technical moat candidate</div><h3>Evidence loops, not model access.</h3><p>Potential differentiation sits in provenance-aware operations, learn→build→ship evidence, Brand-OS governance and cross-product decision lineage.</p></article>
     <article class="card accent persona-only for-family" style="--accent:#72c99c"><div class="kicker">Trust</div><h3>Coordination without surveillance.</h3><p>Private-circle context, child/guardian boundaries, explicit approvals and meaningful evidence rather than engagement for its own sake.</p></article>
    </div>
    <details><summary>Competition, market forecasts and product benchmarks</summary><div>The complete evidence archive in Chapter 5 retains every competitor capsule, real website logo, key product, wedge, feature set, regional market model, leader proxy and 2030/2035 forecast.</div></details>
   </div>
  </section>

  <section class="chapter" id="operate">
   <div class="chapter-inner">
    <div class="chapter-head"><div><div class="eyebrow">Chapter 04 · How It Operates</div><h2>Four humans. Clear accountability.</h2></div><p>Agents increase capacity, but consequential decisions remain human-owned. The operating system is designed around mandates, evidence, approval and a strict portfolio stage gate.</p></div>
    <div class="grid two">
     <article class="card"><div class="kicker">Founder / CEO</div><h3>Company, HQ and Studio direction.</h3><p>Strategy, capital, portfolio allocation, final approvals, company architecture and creative/product direction.</p></article>
     <article class="card"><div class="kicker">ArgantaLife GM</div><h3>Parent truth and family rhythm.</h3><p>Family pilots, trust, ritual design, safety feedback, adoption, retention and community learning.</p></article>
     <article class="card"><div class="kicker">ArgantaEnergy GM</div><h3>Technical assurance and clients.</h3><p>Retired exploration leadership applied to buyer relationships, consulting, evidence and agent validation.</p></article>
     <article class="card"><div class="kicker">Technology Partner</div><h3>Engineering delivery and reliability.</h3><p>Architecture execution, production quality, releases, technical capacity and reusable delivery components.</p></article>
    </div>
    <div class="timeline" style="margin-top:24px">
     <div class="step"><b>01</b><h3>Explore</h3><p>Problem interviews and evidence of urgency.</p></div>
     <div class="step"><b>02</b><h3>Incubate</h3><p>Thin slice and repeated trusted use.</p></div>
     <div class="step"><b>03</b><h3>Validate</h3><p>Activation, retention and payment.</p></div>
     <div class="step"><b>04</b><h3>Scale</h3><p>Repeatable acquisition and contribution.</p></div>
     <div class="step"><b>05</b><h3>Maintain or stop</h3><p>Allocation follows evidence and opportunity cost.</p></div>
    </div>
    <div class="persona-only for-family"><details open><summary>What protects a family pilot</summary><div>Guardian consent, child-data minimization, clear participation expectations, a human escalation path, private-circle boundaries and no consequential autonomous agent action.</div></details></div>
    <div class="persona-only for-investor"><details open><summary>Governance and management information</summary><div>Weekly company pulse, monthly close/risk, quarterly portfolio council, decision ledger, cash/runway, product cohorts, delivery margin, API cost and explicit stage decisions.</div></details></div>
    <div class="persona-only for-partner"><details open><summary>Partner operating boundary</summary><div>Written scope, architecture ownership, background/foreground IP, data roles, security, acceptance criteria, service expectations, commercial terms, termination and transition are required before material contribution.</div></details></div>
   </div>
  </section>

  <section class="chapter" id="evidence">
   <div class="chapter-inner">
    <div class="chapter-head"><div><div class="eyebrow">Chapter 05 · Economics & Evidence</div><h2>Model the future. Label the truth.</h2></div><p>This chapter separates invoices and observed behavior from planning scenarios. It ends with the complete original company board embedded in this single file.</p></div>
    <div class="persona-only for-investor">
     <div class="metric-row">
      <div class="metric"><b>Indicative pre-money</b><strong>$1.8–2.8M</strong><small>$2.2M audit point; medium-low confidence.</small></div>
      <div class="metric"><b>Year 1 Mid revenue</b><strong>$344K</strong><small>Management case, not investor guidance.</small></div>
      <div class="metric"><b>Year 3 Mid revenue</b><strong>$2.58M</strong><small>Depends on repeatable Energy and Studio delivery.</small></div>
      <div class="metric"><b>Proof round</b><strong>$400–750K</strong><small>Only after pilots and paid-delivery evidence.</small></div>
     </div>
     <div class="table-wrap"><table><thead><tr><th>Case</th><th>Year 1 revenue</th><th>Year 2 revenue</th><th>Year 3 revenue</th><th>Year 3 EBITDA-like</th></tr></thead><tbody><tr><td>Low</td><td>$58K</td><td>$165K</td><td>$455K</td><td>−$69K</td></tr><tr><td>Mid</td><td>$344K</td><td>$1.10M</td><td>$2.58M</td><td>+$681K</td></tr><tr><td>High</td><td>$1.24M</td><td>$4.00M</td><td>$9.70M</td><td>+$3.48M</td></tr></tbody></table></div>
    </div>
    <div class="persona-only for-partner grid two">
     <article class="card"><div class="kicker">Cost governance</div><h3>Budget by workload.</h3><p>Deterministic tools first, efficient models for routine work, Codex/strong coding models for implementation and Opus only behind an escalation gate.</p></article>
     <article class="card"><div class="kicker">Definition of done</div><h3>Evidence accompanies delivery.</h3><p>Tests, deployment record, cost/run, provider/model, approval, acceptance, incident status and reusable-component decision.</p></article>
    </div>
    <div class="persona-only for-family grid two">
     <article class="card"><div class="kicker">Pilot promise</div><h3>Start small and observe honestly.</h3><p>The first milestone is not scale. It is a family repeating the ritual, finding value and choosing to return.</p></article>
     <article class="card"><div class="kicker">Participation</div><h3>Help shape the family experience.</h3><p>Share what feels useful, confusing, unsafe, delightful or unnecessary. Feedback becomes a decision record—not marketing decoration.</p></article>
    </div>
    <div class="footer-note">Highest-priority gaps: external traction, reconciled 18B-token history, portfolio focus, canonical Life/Kinetik structure, Energy demand, Studio repeatability, signed team/partner agreements, cash/runway and child-safety legal validation.</div>
    <div class="archive-box glass" style="margin-top:28px">
     <div class="archive-note"><p><b>Complete evidence archive.</b> Every original icon, light/dark specimen, agent, dossier, architecture logo, competitor, market source, forecast, marketing plan, IP candidate, operating point, product preview, CAPEX/OPEX assumption, scenario, risk and diligence item is preserved below.</p><button class="btn" id="loadArchive">Load complete board</button></div>
     <iframe class="archive-frame hidden" id="archiveFrame" title="Complete Arganta evidence board"></iframe>
    </div>
   </div>
  </section>
 </main>
</div>

<section class="unlock hidden" id="unlock">
 <form class="unlock-card glass" id="unlockForm">
  <div class="eyebrow">Founder access</div><h2>The complete perspective.</h2>
  <p>This view combines every audience layer with the full evidence board and founder operating narrative.</p>
  <input id="founderPassword" type="password" inputmode="numeric" autocomplete="off" placeholder="Password" aria-label="Founder password">
  <div class="unlock-error" id="unlockError"></div>
  <div class="unlock-actions"><button class="btn" type="button" id="cancelUnlock">Cancel</button><button class="btn primary" type="submit">Unlock</button></div>
 </form>
</section>

<script>
const ARCHIVE_B64="${archiveB64}";
const PERSONAS={family:"Family & Friends",investor:"Investor",partner:"Technology Partner",me:"Me · Complete"};
const products=[
 {i:"mark-hq",n:"ArgantaHQ",k:"Govern · coordinate · remember",a:"#af9be8",u:"https://hq.arganta.app",p:"Founder operating system for evidence, products, people, agents, risks, decisions and approvals.",t:["Command","Portfolio","Growth","Data","Vault","Architecture","Agents","Brand"]},
 {i:"mark-arganta",n:"Arganta.ai / Core",k:"Ground · route · explain",a:"#f2b544",u:"https://hq.arganta.app",p:"Embedded intelligence pipeline: sense, compute, match, generate, deliver and evaluate.",t:["Sense","Compute","Match","Generate","Deliver","Evidence"]},
 {i:"mark-life",n:"ArgantaLife",k:"Calm · connect · grow",a:"#ff7a59",u:"https://circle.arganta.app",p:"The family-growth ritual on top of a private coordination and remembered-context substrate.",t:["Today","Calendar","Moments","Apps","You","Bloom"]},
 {i:"mark-kinetik",n:"KinetikCircle",k:"Connect · rhythm · remember",a:"#ec93b5",u:"https://circle.arganta.app",p:"Private family coordination and remembered context—the connective substrate for ArgantaLife.",t:["Circle","Today","Calendar","Moments","Memory","Trust"]},
 {i:"mark-energy",n:"ArgantaEnergy",k:"Evidence · uncertainty · decision",a:"#2e7cf6",u:"https://energy.arganta.app",p:"Explainable lifecycle workbenches and expert agents from exploration through reservoir management.",t:["Exploration","Field Development","Well Delivery","Reservoir Mgmt","Knowledge","Data"]},
 {i:"mark-studio",n:"ArgantaStudio",k:"Direct · create · ship",a:"#a06ce8",u:"https://studio.arganta.app",p:"Brand-OS-governed path from brief through media, software, games, automation and approved publishing.",t:["Art Director","Brand","Image","Video","Audio","Web/App","Game","Publish"]},
 {i:"mark-lab",n:"ArgantaLab",k:"Learn · build · ship",a:"#7baee8",u:"https://lab.arganta.app",p:"Short mastery loops unlock making, testing and publishing inside a trusted family ecosystem.",t:["Journey","Learn","Build","Arena","Worlds","Fame"]},
 {i:"mark-lashira",n:"LashiraBloom",k:"Care · contribute · belong",a:"#6ec492",u:"https://lashirabloom-game-one.vercel.app",p:"A persistent cozy family world where care, exploration and contribution create shared emotional value.",t:["World","Character","Shop","House","Animals","Kin","Quests"]}
];
function renderProducts(){document.getElementById("productGrid").innerHTML=products.map(x=>'<article class="card accent" style="--accent:'+x.a+'"><div class="mark"><svg class="product-logo" viewBox="0 0 120 120"><use href="#'+x.i+'"/></svg></div><div class="kicker">'+x.k+'</div><h3>'+x.n+'</h3><p>'+x.p+'</p><div class="links">'+x.t.slice(0,6).map(t=>'<span class="btn">'+t+'</span>').join("")+'<a class="btn" href="'+x.u+'" target="_blank">Open surface</a></div></article>').join("")}
let activeChapter=0;
function goChapter(index){activeChapter=Math.max(0,Math.min(sections.length-1,index));document.querySelector("main").style.transform="translateX(-"+(activeChapter*100)+"vw)";sections[activeChapter].scrollTop=0;nav.forEach((a,i)=>a.classList.toggle("on",i===activeChapter));document.getElementById("prevChapter").disabled=activeChapter===0;document.getElementById("nextChapter").disabled=activeChapter===sections.length-1;history.replaceState(null,"","#"+sections[activeChapter].id)}
function setPersona(p){document.body.classList.remove("persona-family","persona-investor","persona-partner","persona-me");document.body.classList.add("persona-"+p);document.getElementById("personaLabel").textContent=PERSONAS[p];document.getElementById("personaGate").classList.add("hidden");document.getElementById("app").classList.remove("hidden");localStorage.setItem("arganta_persona",p);goChapter(0)}
document.querySelectorAll("[data-persona]").forEach(b=>b.addEventListener("click",()=>setPersona(b.dataset.persona)));
document.getElementById("changePersona").addEventListener("click",()=>{document.getElementById("personaGate").classList.remove("hidden");document.getElementById("app").classList.add("hidden")});
document.getElementById("personaLabel").addEventListener("click",()=>document.getElementById("changePersona").click());
function openUnlock(){document.getElementById("unlock").classList.remove("hidden");document.getElementById("founderPassword").value="";document.getElementById("unlockError").textContent="";setTimeout(()=>document.getElementById("founderPassword").focus(),50)}
["founderUnlock","founderUnlockApp"].forEach(id=>document.getElementById(id).addEventListener("click",openUnlock));
document.getElementById("cancelUnlock").addEventListener("click",()=>document.getElementById("unlock").classList.add("hidden"));
document.getElementById("unlockForm").addEventListener("submit",e=>{e.preventDefault();if(document.getElementById("founderPassword").value==="1234"){document.getElementById("unlock").classList.add("hidden");setPersona("me")}else document.getElementById("unlockError").textContent="Incorrect password."});
document.getElementById("themeBtn").addEventListener("click",()=>{const d=document.documentElement;const next=d.dataset.theme==="light"?"dark":"light";d.dataset.theme=next;localStorage.setItem("arganta_perspective_theme",next)});
document.documentElement.dataset.theme=localStorage.getItem("arganta_perspective_theme")||"dark";
document.getElementById("loadArchive").addEventListener("click",e=>{const f=document.getElementById("archiveFrame");if(!f.srcdoc){const bytes=Uint8Array.from(atob(ARCHIVE_B64),c=>c.charCodeAt(0));f.srcdoc=new TextDecoder().decode(bytes)}f.classList.remove("hidden");e.currentTarget.textContent="Archive loaded"});
const sections=[...document.querySelectorAll(".chapter")],nav=[...document.querySelectorAll(".chapter-nav a")];
nav.forEach((a,i)=>a.addEventListener("click",e=>{e.preventDefault();goChapter(i)}));
document.querySelectorAll('a[href^="#"]').forEach(a=>{if(a.closest(".chapter-nav"))return;a.addEventListener("click",e=>{const i=sections.findIndex(s=>"#"+s.id===a.getAttribute("href"));if(i>=0){e.preventDefault();goChapter(i)}})});
document.getElementById("prevChapter").addEventListener("click",()=>goChapter(activeChapter-1));
document.getElementById("nextChapter").addEventListener("click",()=>goChapter(activeChapter+1));
document.addEventListener("keydown",e=>{if(!["ArrowRight","ArrowLeft"].includes(e.key)||document.getElementById("app").classList.contains("hidden")||!document.getElementById("unlock").classList.contains("hidden"))return;goChapter(activeChapter+(e.key==="ArrowRight"?1:-1))});
let touchStart=0;document.querySelector("main").addEventListener("touchstart",e=>touchStart=e.touches[0].clientX,{passive:true});document.querySelector("main").addEventListener("touchend",e=>{const d=e.changedTouches[0].clientX-touchStart;if(Math.abs(d)>70)goChapter(activeChapter+(d<0?1:-1))},{passive:true});
renderProducts();
goChapter(Math.max(0,sections.findIndex(s=>"#"+s.id===location.hash)));
</script>
</body>
</html>`

fs.writeFileSync(outputPath, html)
console.log(`wrote ${outputPath} (${Buffer.byteLength(html)} bytes)`)
