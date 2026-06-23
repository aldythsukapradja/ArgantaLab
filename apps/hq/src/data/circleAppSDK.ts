/**
 * Circle App SDK — Mock implementation for preview
 *
 * This is the JavaScript SDK that all KinetikCircle mini-apps use.
 * It's injected into the preview iframe during app builder preview.
 *
 * In production (deployed in KinetikCircle), the real SDK is injected,
 * which talks to Supabase auth, realtime, and agents.
 *
 * The mock version uses localStorage and canned responses.
 */

export interface SDKUser {
  id: string
  name: string
  avatar?: string
  role: 'member' | 'admin'
  circle_id: string
}

export interface SDKCircleMember {
  id: string
  name: string
  avatar?: string
  kind: 'parent' | 'child'
  role: 'admin' | 'member'
}

export interface SDKCircle {
  id: string
  name: string
  type: 'family' | 'kids' | 'class' | 'friends'
  members: SDKCircleMember[]
}

export interface SDKRecord {
  id: string
  circle_id: string
  created_by: string
  created_at: string
  [key: string]: any
}

/**
 * Generate the mock Circle App SDK JavaScript code
 * Pass in the current user and circle; returns minified JS
 */
export function generateCircleAppSDKMock(user: SDKUser, circle: SDKCircle): string {
  const userJson = JSON.stringify(user)
  const circleJson = JSON.stringify(circle)

  return `(function(){if(window.CircleApp)return;var _s=function(k,v){try{localStorage.setItem('app_'+k,JSON.stringify(v));}catch(e){}};var _l=function(k,d){try{return JSON.parse(localStorage.getItem('app_'+k)||'null')??d;}catch(e){return d;}};var _log=function(m,c){console.log('%c[Circle App] '+m,'color:'+c+';font-weight:600');};var records=_l('records',[]);var events=[];var user=${userJson};var circle=${circleJson};window.CircleApp={user:user,circle:circle,init:async function(){_log('App ready (mock)','#6366f1');this.emit('ready',{user:this.user});return this.user;},db:{list:async function(q){var result=records;if(q&&q.where){result=result.filter(r=>Object.entries(q.where).every(([k,v])=>r[k]===v));}if(q&&q.limit){result=result.slice(0,q.limit);}return result;},save:async function(rec){var id=rec.id||'rec_'+Math.random().toString(36).slice(2,9);var saved=Object.assign({},rec,{id:id,circle_id:circle.id,created_by:user.id,created_at:new Date().toISOString()});var i=records.findIndex(r=>r.id===id);if(i>=0){records[i]=saved;}else{records.push(saved);}_s('records',records);setTimeout(()=>{if(this.emit)this.emit('create',saved);},10);return saved;},remove:async function(id){records=records.filter(r=>r.id!==id);_s('records',records);setTimeout(()=>{if(this.emit)this.emit('delete',{id:id});},10);return true;},on:function(e,f){return function(){};},emit:function(e,d){}},agent:async function(s,p){if(s==='reminder')return{success:true,response:'Reminder set (mock)'};if(s==='planner')return{success:true,response:'Here\\'s a plan (mock)'};if(s==='coach')return{success:true,response:'You\\'re doing great! (mock)'};if(s==='budgeter')return{success:true,response:'Budget summary (mock)'};if(s==='chef')return{success:true,response:'Recipe suggestion (mock)'};if(s==='summarizer')return{success:true,response:'Summary (mock)'};return{success:false,reason:'agent_not_found'};},emit:function(e,d){_log(e+': '+JSON.stringify(d),'#fbbf24');events.push({event:e,data:d,timestamp:new Date().toISOString()});},on:function(e,f){if(e==='ready')setTimeout(f,100);}};})();`
}

/**
 * Readable version (for development/debugging)
 */
export function generateCircleAppSDKMockReadable(user: SDKUser, circle: SDKCircle): string {
  return `
// ── Circle App SDK (mock — real SDK injected by platform) ──────────
(function(){
  if(window.CircleApp) return;

  var _s = function(k, v) { try { localStorage.setItem('app_' + k, JSON.stringify(v)); } catch(e) {} };
  var _l = function(k, d) { try { return JSON.parse(localStorage.getItem('app_' + k) || 'null') ?? d; } catch(e) { return d; } };
  var _log = function(m, c) { console.log('%c[Circle App] ' + m, 'color:' + c + ';font-weight:600'); };

  var records = _l('records', []);
  var user = ${JSON.stringify(user, null, 2)};
  var circle = ${JSON.stringify(circle, null, 2)};

  window.CircleApp = {
    user: user,
    circle: circle,

    init: async function() {
      _log('App ready (mock)', '#6366f1');
      this.emit('ready', { user: this.user });
      return this.user;
    },

    db: {
      list: async function(q) {
        var result = records;
        if (q && q.where) {
          result = result.filter(r => Object.entries(q.where).every(([k, v]) => r[k] === v));
        }
        if (q && q.limit) {
          result = result.slice(0, q.limit);
        }
        return result;
      },

      save: async function(rec) {
        var id = rec.id || 'rec_' + Math.random().toString(36).slice(2, 9);
        var saved = Object.assign({}, rec, {
          id: id,
          circle_id: circle.id,
          created_by: user.id,
          created_at: new Date().toISOString()
        });
        var i = records.findIndex(r => r.id === id);
        if (i >= 0) {
          records[i] = saved;
        } else {
          records.push(saved);
        }
        _s('records', records);
        setTimeout(() => {
          if (this.emit) this.emit('create', saved);
        }, 10);
        return saved;
      },

      remove: async function(id) {
        records = records.filter(r => r.id !== id);
        _s('records', records);
        setTimeout(() => {
          if (this.emit) this.emit('delete', { id: id });
        }, 10);
        return true;
      },

      on: function(e, f) {
        return function() {};
      },

      emit: function(e, d) {}
    },

    agent: async function(s, p) {
      if (s === 'reminder') return { success: true, response: 'Reminder set (mock)' };
      if (s === 'planner') return { success: true, response: 'Here\\'s a plan (mock)' };
      if (s === 'coach') return { success: true, response: 'You\\'re doing great! (mock)' };
      if (s === 'budgeter') return { success: true, response: 'Budget summary (mock)' };
      if (s === 'chef') return { success: true, response: 'Recipe suggestion (mock)' };
      if (s === 'summarizer') return { success: true, response: 'Summary (mock)' };
      return { success: false, reason: 'agent_not_found' };
    },

    emit: function(e, d) {
      _log(e + ': ' + JSON.stringify(d), '#fbbf24');
    },

    on: function(e, f) {
      if (e === 'ready') setTimeout(f, 100);
    }
  };
})();
  `
}
