// v10 — A-prime: gentle refinements off the strong config A. Final candidate.
const PATHS = ['warrior', 'rogue', 'poet', 'mage'];
const boltBase=(L)=>40+12*(L-1), mendBase=(L)=>30+10*(L-1), physBase=(L)=>34+10*(L-1), hpCurve=(L)=>100+70*(L-1);
const rnd=(a,z)=>a+Math.random()*(z-a);
function unit(p,L,S){const s=S[p];const dP=Math.round(physBase(L)*s.phy),dB=Math.round(boltBase(L)*s.mag);
  return{p,hp:Math.round(hpCurve(L)*s.hpMul),maxHp:Math.round(hpCurve(L)*s.hpMul),dmgPhys:dP,dmgBolt:dB,
    heal:Math.round(mendBase(L)*s.healMul),ranged:dB>dP,atkInt:s.atkInt,moveSpd:s.moveSpd,cd:rnd(0,s.atkInt),healed:0};}
function duel(a,b,L,cfg){const S=cfg.STATS,A=unit(a,L,S),B=unit(b,L,S);let dist=rnd(6,9);const dt=0.05,reach=cfg.boltReach;
  const roll=(base)=>{if(Math.random()<cfg.miss)return 0;let d=base*rnd(1-cfg.spread,1+cfg.spread);if(Math.random()<cfg.crit)d*=cfg.critX;return Math.round(d);};
  for(let t=0;t<90;t+=dt){
    const plan=(U)=>(U.heal>0&&U.healed<cfg.healMax&&U.hp/U.maxHp<cfg.healAt)?{kind:'heal',reach:0}:(U.ranged?{kind:'bolt',reach}:{kind:'phys',reach:1});
    const pA=plan(A),pB=plan(B);
    const mv=(pA.kind!=='heal'&&dist>pA.reach?A.moveSpd*dt:0)+(pB.kind!=='heal'&&dist>pB.reach?B.moveSpd*dt:0);
    if(mv)dist=Math.max(0.5,dist-mv); A.cd-=dt;B.cd-=dt;
    const fire=(U,pl,o)=>{if(U.cd>0||(pl.kind!=='heal'&&dist>pl.reach))return;U.cd=U.atkInt;
      if(pl.kind==='heal'){U.hp=Math.min(U.maxHp,U.hp+U.heal);U.healed++;}else o.hp-=roll(pl.kind==='bolt'?U.dmgBolt:U.dmgPhys);};
    fire(A,pA,B);fire(B,pB,A);
    const ad=A.hp<=0,bd=B.hp<=0;if(ad&&bd)return'draw';if(bd)return'a';if(ad)return'b';}
  return'draw';}
function report(name,cfg,levels,N=10000){let worst=0,sse=0,n=0;console.log(`\n############ ${name} (reach ${cfg.boltReach}) ############`);
  for(const L of levels){const M={};for(const a of PATHS){M[a]={};for(const b of PATHS){if(a===b){M[a][b]=50;continue;}
    let aw=0,d=0;for(let i=0;i<N;i++){const r=duel(a,b,L,cfg);if(r==='a')aw++;else if(r==='draw')d++;}M[a][b]=((aw+d/2)/N)*100;}}
    const ov={};for(const a of PATHS){const o=PATHS.filter(x=>x!==a).map(b=>M[a][b]);ov[a]=o.reduce((s,v)=>s+v,0)/o.length;
      for(const b of PATHS)if(a!==b){worst=Math.max(worst,Math.abs(M[a][b]-50));sse+=(M[a][b]-50)**2;n++;}}
    console.log(`  L${String(L).padStart(2)}  `+PATHS.map(p=>p.slice(0,4).padStart(7)).join('')+'      overall');
    for(const a of PATHS)console.log('      '+a.padEnd(5)+PATHS.map(b=>(a===b?'--':M[a][b].toFixed(0)+'%').padStart(7)).join('')+`    ${a.slice(0,3)} ${ov[a].toFixed(0)}%`);}
  console.log(`  >>> worst ${worst.toFixed(1)}pts | RMS ${Math.sqrt(sse/n).toFixed(1)}pts`);}
const V={miss:0.08,crit:0.12,critX:1.6,spread:0.18,healAt:0.30,healMax:2,boltReach:2};
const AP={STATS:{
  warrior:{phy:1.55,mag:0.55,atkInt:1.10,moveSpd:3.0,hpMul:1.20,healMul:0.6},
  rogue:  {phy:1.00,mag:0.70,atkInt:0.69,moveSpd:3.4,hpMul:1.06,healMul:0.8},
  poet:   {phy:0.80,mag:1.15,atkInt:1.00,moveSpd:2.1,hpMul:1.03,healMul:1.3},
  mage:   {phy:0.58,mag:1.45,atkInt:1.00,moveSpd:2.0,hpMul:0.80,healMul:1.0}},...V};
report('A-prime',AP,[1,5,10,25,50,80]);
