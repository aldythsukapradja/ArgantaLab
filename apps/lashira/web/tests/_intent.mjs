import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { data } = await c.auth.signInWithPassword({ email:'keyla@kids.argantalab.app', password:'1234#aLab' });
const ch = c.channel('farm:repro-e2e', { config: { presence: { key: data.user.id+':intentnode' }, broadcast:{ self:false } } });
await new Promise(r => ch.subscribe(s => s==='SUBSCRIBED' && r()));
await ch.send({ type:'broadcast', event:'farm-intent', payload:{ src:'intentnode', id:data.user.id, intent:{ t:'plot', key:'15,15', plot:{ tilled:true, watered:true, cropId:'turnip', growth:2 } } } });
console.log('sent plot intent 15,15'); await new Promise(r=>setTimeout(r,1500)); process.exit(0);
