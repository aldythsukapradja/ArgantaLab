import { useEffect } from 'react'
import { supabase, cloudEnabled } from './supabase'
import { useAppStore } from '../store/appStore'

// ============================================================
//  CIRCLE GAME BRIDGE  (host side)
//
//  Every published game embeds the Circle SDK (the "spine"). At
//  runtime ArgantaLab injects the REAL SDK ahead of the game's
//  bundled mock — because the mock guards with `if(window.CircleGame)
//  return;`, the host version wins. The real SDK proxies economy,
//  leaderboard and save calls to the parent frame over postMessage;
//  this module answers them against the live app state + Supabase.
// ============================================================

export interface CircleCtxUser {
  id: string
  name: string
  avatar: string | null
  diamonds: number
  xp: number
  level: number
}

export interface CircleCtx {
  user: CircleCtxUser | null
  gameId: string
  live: boolean
}

// ── The injected runtime SDK (dual-mode: bridge when live, else local) ──
// Runs before the game's own script. Identical surface to the builder mock.
const CIRCLE_RUNTIME = `(function(){
  if(window.CircleGame) return;
  var CFG=window.__CIRCLE__||{}, LIVE=!!CFG.live, GAME=CFG.gameId||'preview';
  var _s=function(k,v){try{localStorage.setItem('cg_'+k,JSON.stringify(v));}catch(e){}};
  var _l=function(k,d){try{return JSON.parse(localStorage.getItem('cg_'+k)||'null')??d;}catch(e){return d;}};
  var _seq=0,_pend={};
  function _call(method,args){
    return new Promise(function(resolve){
      var id=GAME+'#'+(++_seq); _pend[id]=resolve;
      try{window.parent.postMessage({type:'CIRCLE_SDK_CALL',id:id,gameId:GAME,method:method,args:args||[]},'*');}catch(e){resolve(null);}
      setTimeout(function(){ if(_pend[id]){var r=_pend[id];delete _pend[id];r(null);} },8000);
    });
  }
  window.addEventListener('message',function(e){
    var d=e.data; if(!d) return;
    if(d.type==='CIRCLE_SDK_RESULT'&&_pend[d.id]){var r=_pend[d.id];delete _pend[d.id];r(d.result);}
    if(d.type==='CIRCLE_SDK_INIT'&&d.payload&&d.payload.user){window.CircleGame.user=d.payload.user;window.CircleGame.emit('ready',{user:window.CircleGame.user});}
  });
  var user=CFG.user||_l('user',{id:'guest_'+Math.random().toString(36).slice(2,9),name:'Player',avatar:null,diamonds:500,xp:0,level:1});
  window.CircleGame={
    user:user,
    init:async function(){ if(LIVE){var u=await _call('init');if(u)this.user=u;} this.emit('ready',{user:this.user}); return this.user; },
    getDiamonds:async function(){ if(LIVE){var d=await _call('getDiamonds');if(d!=null)this.user.diamonds=d;} return this.user.diamonds; },
    awardDiamonds:async function(n,r){ if(LIVE){var res=await _call('awardDiamonds',[n,r]);if(res)this.user.diamonds=res.balance;}else{this.user.diamonds+=n;_s('user',this.user);} this.emit('diamonds_changed',{delta:n,balance:this.user.diamonds}); return {balance:this.user.diamonds}; },
    spendDiamonds:async function(n){ if(LIVE){var res=await _call('spendDiamonds',[n]);if(res){this.user.diamonds=res.balance;this.emit('diamonds_changed',{delta:-n,balance:this.user.diamonds});return res;}return{ok:false,balance:this.user.diamonds};} if(this.user.diamonds<n)return{ok:false,balance:this.user.diamonds}; this.user.diamonds-=n;_s('user',this.user);this.emit('diamonds_changed',{delta:-n,balance:this.user.diamonds});return{ok:true,balance:this.user.diamonds}; },
    getXP:async function(){ if(LIVE){var x=await _call('getXP');if(x){this.user.xp=x.xp;this.user.level=x.level;}} return {xp:this.user.xp,level:this.user.level}; },
    awardXP:async function(n,r){ if(LIVE){var res=await _call('awardXP',[n,r]);if(res){this.user.xp=res.xp;this.user.level=res.level;return res;}} var prev=this.user.level;this.user.xp+=n;this.user.level=Math.max(1,Math.floor(1+Math.sqrt(this.user.xp/100)));_s('user',this.user);if(this.user.level>prev)this.emit('level_up',{level:this.user.level});return{xp:this.user.xp,level:this.user.level,leveledUp:this.user.level>prev}; },
    submitScore:async function(score,meta){ if(LIVE){var res=await _call('submitScore',[score,meta]);if(res){if(res.isHighScore)this.emit('high_score',{score:score,rank:res.rank});return res;}} var b=_l('board',[]);var e=Object.assign({id:this.user.id,name:this.user.name,score:score,at:Date.now()},meta||{});var i=b.findIndex(function(x){return x.id===e.id;});var hi=i<0||score>b[i].score;if(i>=0){if(hi)b[i]=e;}else b.push(e);b.sort(function(a,c){return c.score-a.score;});_s('board',b.slice(0,1000));var rank=b.findIndex(function(x){return x.id===e.id;})+1;if(hi)this.emit('high_score',{score:score,rank:rank});return{rank:rank,isHighScore:hi,entry:e}; },
    getLeaderboard:async function(n){ if(LIVE){var r=await _call('getLeaderboard',[n||10]);if(r)return r;} return _l('board',[]).slice(0,n||10).map(function(e,i){return Object.assign({},e,{rank:i+1});}); },
    getMyRank:async function(){ if(LIVE){return await _call('getMyRank');} var b=_l('board',[]);var uid=this.user.id;var i=b.findIndex(function(e){return e.id===uid;});return i>=0?{rank:i+1,score:b[i].score}:null; },
    saveState:async function(k,v){ if(LIVE){return await _call('saveState',[k,v]);} _s('gs_'+k,v);return true; },
    loadState:async function(k){ if(LIVE){return await _call('loadState',[k]);} return _l('gs_'+k,null); },
    getUnlocks:async function(){ if(LIVE){return (await _call('getUnlocks'))||[];} return _l('unlocks',[]); },
    isUnlocked:async function(id){ if(LIVE){return !!(await _call('isUnlocked',[id]));} return _l('unlocks',[]).includes(id); },
    unlock:async function(id,cost){ if(LIVE){return await _call('unlock',[id,cost]);} if(cost>0){var r=await this.spendDiamonds(cost);if(!r.ok)return{ok:false,reason:'no_diamonds'};}var u=_l('unlocks',[]);if(!u.includes(id)){u.push(id);_s('unlocks',u);}this.emit('unlock',{itemId:id});return{ok:true}; },
    startSession:async function(){ this._t0=Date.now(); if(LIVE)_call('startSession'); return Math.random().toString(36).slice(2); },
    endSession:async function(score,pct){ var d=Math.round((Date.now()-(this._t0||Date.now()))/1000); if(LIVE)_call('endSession',[score,pct]); this.emit('session_end',{duration:d,score:score,completion:pct}); return{duration:d}; },
    getProfile:async function(){ if(LIVE){var p=await _call('getProfile');if(p)this.user=p;} return Object.assign({},this.user); },
    setDisplayName:async function(name){ this.user.name=name; if(LIVE)_call('setDisplayName',[name]);else _s('user',this.user); return true; },
    _ev:{},
    on:function(e,f){(this._ev[e]=this._ev[e]||[]).push(f);},
    off:function(e,f){if(this._ev[e])this._ev[e]=this._ev[e].filter(function(g){return g!==f;});},
    emit:function(e,d){(this._ev[e]||[]).forEach(function(f){try{f(d);}catch(x){}});try{window.parent.postMessage({type:'CIRCLE_GAME_EVENT',event:e,data:d,gameId:GAME},'*');}catch(x){}}
  };
})();`

/** Inject the Circle SDK + per-run config into a game's HTML (host side). */
export function injectCircle(html: string, ctx: CircleCtx): string {
  const cfg = `<script>window.__CIRCLE__=${JSON.stringify({
    user: ctx.user, gameId: ctx.gameId, live: ctx.live,
  })};</script>`
  const sdk = `<script>${CIRCLE_RUNTIME}</script>`
  const tag = cfg + sdk
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + tag)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + tag)
  return tag + html
}

/** Build the runtime context from current app state. live only when signed in + cloud. */
export function circleCtx(gameId: string): CircleCtx {
  const s = useAppStore.getState()
  const signedIn = s.session !== null && s.session !== 'loading'
  const uid = signedIn ? (s.session as { user: { id: string } }).user.id : `guest_${gameId}`
  return {
    gameId,
    live: signedIn && cloudEnabled,
    user: {
      id: uid,
      name: s.learnerName || 'Player',
      avatar: s.avatar || null,
      diamonds: s.diamonds,
      xp: s.xp,
      level: s.level,
    },
  }
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) { console.warn(`[circle] ${fn} →`, error.message); return null }
  return (data ?? null) as T | null
}

// ── Answer a single SDK call against live app state + Supabase ──
async function handleCircleCall(gameId: string, method: string, args: unknown[]): Promise<unknown> {
  const st = () => useAppStore.getState()
  const profile = (): CircleCtxUser => {
    const s = st()
    const signedIn = s.session !== null && s.session !== 'loading'
    return {
      id: signedIn ? (s.session as { user: { id: string } }).user.id : 'guest',
      name: s.learnerName || 'Player',
      avatar: s.avatar || null,
      diamonds: s.diamonds, xp: s.xp, level: s.level,
    }
  }

  switch (method) {
    case 'init':
    case 'getProfile':
      return profile()

    case 'getDiamonds':
      return st().diamonds

    case 'awardDiamonds': {
      const n = Number(args[0]) || 0
      st().addDiamonds(n)
      return { balance: st().diamonds }
    }
    case 'spendDiamonds': {
      const n = Number(args[0]) || 0
      if (st().diamonds < n) return { ok: false, balance: st().diamonds }
      st().addDiamonds(-n)
      return { ok: true, balance: st().diamonds }
    }

    case 'getXP':
      return { xp: st().xp, level: st().level }
    case 'awardXP': {
      const n = Number(args[0]) || 0
      const prev = st().level
      st().addXp(n)
      return { xp: st().xp, level: st().level, leveledUp: st().level > prev }
    }

    case 'submitScore': {
      const score = Math.round(Number(args[0]) || 0)
      const meta = (args[1] ?? {}) as Record<string, unknown>
      const r = await rpc<{ rank: number; isHighScore: boolean; best: number }>(
        'submit_game_score', { p_game: gameId, p_score: score, p_meta: meta })
      return r ?? { rank: 0, isHighScore: false }
    }
    case 'getLeaderboard': {
      const top = Number(args[0]) || 10
      const rows = await rpc<Array<{ rank: number; user_id: string; name: string; avatar: string | null; score: number; at: string }>>(
        'get_game_leaderboard', { p_game: gameId, top })
      return (rows ?? []).map(r => ({
        id: r.user_id, name: r.name, avatar: r.avatar, score: r.score, rank: Number(r.rank), at: r.at,
      }))
    }
    case 'getMyRank':
      return await rpc('get_my_game_rank', { p_game: gameId })

    case 'saveState':
      await rpc('save_game_state', { p_game: gameId, p_slot: String(args[0] ?? 'default'), p_data: args[1] ?? {} })
      return true
    case 'loadState':
      return await rpc('load_game_state', { p_game: gameId, p_slot: String(args[0] ?? 'default') })

    case 'getUnlocks':
      return st().unlocks
    case 'isUnlocked':
      return st().unlocks.includes(String(args[0]))
    case 'unlock': {
      const id = String(args[0]); const cost = Number(args[1]) || 0
      const ok = st().buyItem(id, cost, id)
      return ok ? { ok: true } : { ok: false, reason: 'no_diamonds' }
    }

    case 'setDisplayName':
      st().setLearnerName(String(args[0]))
      return true

    case 'startSession':
      return `sess_${Date.now()}`
    case 'endSession':
      return { duration: 0 }

    default:
      return null
  }
}

/**
 * Mount the host-side bridge for the currently-running game. Answers
 * CIRCLE_SDK_CALL messages from the game iframe and posts results back.
 */
export function useCircleBridge(gameId: string | null) {
  useEffect(() => {
    if (!gameId) return
    function onMsg(e: MessageEvent) {
      const d = e.data as { type?: string; id?: string; gameId?: string; method?: string; args?: unknown[] }
      if (!d || d.type !== 'CIRCLE_SDK_CALL') return
      if (d.gameId && gameId && d.gameId !== gameId) return
      handleCircleCall(gameId!, d.method || '', d.args || []).then(result => {
        const win = e.source as Window | null
        win?.postMessage({ type: 'CIRCLE_SDK_RESULT', id: d.id, result }, '*')
      })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [gameId])
}
