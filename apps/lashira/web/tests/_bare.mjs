import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); // anon, no auth — bare
const ch = c.channel('bare-test-topic', { config: { broadcast: { self: false } } });
await new Promise(r => ch.subscribe(s => { console.log('node bare', s); if (s==='SUBSCRIBED') r(); }));
for (let i=0;i<5;i++){ await ch.send({ type:'broadcast', event:'ping', payload:{i} }); await new Promise(r=>setTimeout(r,600)); }
console.log('node sent 5 pings'); process.exit(0);
