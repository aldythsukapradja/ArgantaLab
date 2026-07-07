// Diagnostic: does calling realtime.setAuth() mid-session (what the embed does
// on EVERY parent auth re-post, e.g. each tab focus switch) kill a joined
// realtime channel? Reproduces the suspected field failure: both windows show
// "0 live (solo)" after the user alt-tabs between them.
//
// Usage: node tests/setauth-probe.mjs baginda:1234 keyla:1234
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const [u1, u2] = process.argv.slice(2).map((a) => { const [u, p] = a.split(':'); return { email: `${u}@kids.argantalab.app`, password: `${p}#aLab`, label: u }; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(u) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data, error } = await c.auth.signInWithPassword(u);
  if (error) throw new Error(u.label + ': ' + error.message);
  return { client: c, token: data.session.access_token, userId: data.user.id, label: u.label };
}

const A = await login(u1);
const B = await login(u2);
const topic = `farm:probe-${randomUUID()}`;

let recvAtB = 0;
const chB = B.client.channel(topic, { config: { broadcast: { self: false }, presence: { key: B.userId } } });
chB.on('broadcast', { event: 'player-state' }, () => { recvAtB++; });
let presenceKeysAtB = [];
chB.on('presence', { event: 'sync' }, () => { presenceKeysAtB = Object.keys(chB.presenceState()); });

const chA = A.client.channel(topic, { config: { broadcast: { self: false }, presence: { key: A.userId } } });
const statusesA = [];
await new Promise((res) => { chB.subscribe((s) => s === 'SUBSCRIBED' && res()); });
await new Promise((res) => { chA.subscribe((s) => { statusesA.push(s); if (s === 'SUBSCRIBED') res(); }); });
await chA.track({ id: A.userId, name: A.label });

// phase 1: baseline delivery
for (let i = 0; i < 3; i++) { await chA.send({ type: 'broadcast', event: 'player-state', payload: { i } }); await sleep(300); }
await sleep(700);
const baselineRecv = recvAtB;
const baselinePresence = presenceKeysAtB.includes(A.userId);
console.log(`baseline: B received ${baselineRecv}/3, presence-sees-A=${baselinePresence}, A-status=${statusesA.join(',')}`);

// phase 2: simulate the embed's repeated setAuth (same token, like every tab focus)
for (let i = 0; i < 4; i++) { A.client.realtime.setAuth(A.token); await sleep(400); }
await sleep(800);
console.log(`after 4x setAuth: A channel state=${chA.state}, socket=${A.client.realtime.connectionState()}, statuses=${statusesA.join(',')}`);

// phase 3: does delivery still work?
const before = recvAtB;
for (let i = 0; i < 3; i++) { await chA.send({ type: 'broadcast', event: 'player-state', payload: { i: 10 + i } }); await sleep(300); }
await chA.track({ id: A.userId, name: A.label, tile: [5, 5] });
await sleep(1200);
const delivered = recvAtB - before;
const presenceStill = Object.keys(chB.presenceState()).includes(A.userId);
console.log(`after setAuth: B received ${delivered}/3 new broadcasts, presence-sees-A=${presenceStill}`);
console.log(delivered >= 3 && presenceStill ? 'VERDICT: setAuth is HARMLESS — look elsewhere' : 'VERDICT: setAuth WOUNDS/KILLS the channel — root cause CONFIRMED');
process.exit(0);
