import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const CIRCLE = process.argv[2] || 'repro-e2e';
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await c.auth.signInWithPassword({ email:'keyla@kids.argantalab.app', password:'1234#aLab' });
if (error) { console.error('login', error.message); process.exit(1); }
const ch = c.channel(`farm:${CIRCLE}`, { config: { presence: { key: data.user.id+':peernode' }, broadcast:{ self:false } } });
ch.on('presence',{event:'sync'},()=>{ const k=Object.keys(ch.presenceState()); console.log('peer sees keys:', k.length); });
ch.subscribe(s => { console.log('peer', s); if (s==='SUBSCRIBED') ch.track({ id:data.user.id, name:'Keyla-peer', tile:[3,3] }); });
setInterval(()=>{ ch.send({type:'broadcast',event:'player-state',payload:{id:data.user.id,name:'Keyla-peer',tile:[3,3]}}); }, 2000);
setTimeout(()=>{ console.log('peer done'); process.exit(0); }, 60000);
