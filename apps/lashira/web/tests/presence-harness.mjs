// Runs the game's REAL joinFarmPresence (src/game/farm-presence.js) in node via
// vite ssrLoadModule — no browsers, no rAF, no HMR. This is the coverage the
// protocol harness lacked: it tests the shipped module end-to-end (presence,
// intents, snapshot exchange, session kick) against a throwaway circle id.
//
// Usage: node tests/presence-harness.mjs baginda:1234 keyla:1234
import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const users = process.argv.slice(2).map((a) => { const [u, p] = a.split(':'); return { email: `${u}@kids.argantalab.app`, password: `${p}#aLab`, label: u }; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const report = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
async function waitFor(fn, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(120); } throw new Error(`timeout waiting for ${what}`); }

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { useHostSupabase } = await vite.ssrLoadModule('/src/net/supabase.js');
const { joinFarmPresence } = await vite.ssrLoadModule('/src/game/farm-presence.js');

async function login(u) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data, error } = await c.auth.signInWithPassword(u);
  if (error) throw new Error(u.label + ': ' + error.message);
  return { client: c, userId: data.user.id, label: u.label };
}
const A = await login(users[0]);
const B = await login(users[1]);
const CIRCLE = `harness-${randomUUID()}`; // throwaway — never the live circle
console.log(`presence-harness circle: ${CIRCLE}\n`);

const seen = { peersAtA: [], peersAtB: [], intentsAtB: [], snapshotsAtB: [], requestsAtA: 0, kickedA1: false };

useHostSupabase(A.client);
const ctrlA = joinFarmPresence({
  circleId: CIRCLE,
  profile: { id: A.userId, displayName: 'A-' + A.label, guest: false },
  hero: null,
  onPeers: (p) => { seen.peersAtA = p; },
  onIntent: () => {},
  onSnapshot: () => {},
  onStateRequest: () => { seen.requestsAtA++; ctrlA.sendSnapshot({ data: { day: 9, plots: {} }, rev: 77 }); },
  onKicked: () => { seen.kickedA1 = true; },
});

useHostSupabase(B.client);
const ctrlB = joinFarmPresence({
  circleId: CIRCLE,
  profile: { id: B.userId, displayName: 'B-' + B.label, guest: false },
  hero: null,
  onPeers: (p) => { seen.peersAtB = p; },
  onIntent: (i) => { seen.intentsAtB.push(i); },
  onSnapshot: (s) => { seen.snapshotsAtB.push(s); },
  onStateRequest: () => {},
  onKicked: () => {},
});

// P1: mutual presence through the real module
try {
  await waitFor(() => seen.peersAtA.some((p) => p.id === B.userId) && seen.peersAtB.some((p) => p.id === A.userId), 8000, 'mutual peers');
  report('P1 joinFarmPresence: peers see each other', true);
} catch (e) { report('P1 joinFarmPresence: peers see each other', false, `${e.message}; A sees ${seen.peersAtA.length}, B sees ${seen.peersAtB.length}`); }

// P2: live update flows (position patch)
ctrlA.update({ tile: [7, 7], facing: 'East', actors: [] });
try {
  await waitFor(() => seen.peersAtB.some((p) => p.id === A.userId && p.tile?.[0] === 7), 5000, 'position update at B');
  report('P2 joinFarmPresence: position update delivered', true);
} catch (e) { report('P2 joinFarmPresence: position update delivered', false, e.message); }

// P3: intent flows through the real module
ctrlA.sendIntent({ t: 'plot', key: '4,4', plot: { tilled: true } });
try {
  await waitFor(() => seen.intentsAtB.some((i) => i.t === 'plot' && i.key === '4,4'), 5000, 'intent at B');
  report('P3 joinFarmPresence: intent delivered', true);
} catch (e) { report('P3 joinFarmPresence: intent delivered', false, e.message); }

// P4: snapshot request/response through the real module
ctrlB.requestState();
try {
  await waitFor(() => seen.snapshotsAtB.some((s) => s.rev === 77), 5000, 'snapshot at B');
  report('P4 joinFarmPresence: state-request answered (rev 77)', true, `requestsAtA=${seen.requestsAtA}`);
} catch (e) { report('P4 joinFarmPresence: state-request answered (rev 77)', false, `requestsAtA=${seen.requestsAtA}; ${e.message}`); }

// P5: double login through the real module — old session kicked
const A2 = await login(users[0]);
useHostSupabase(A2.client);
const ctrlA2 = joinFarmPresence({
  circleId: CIRCLE,
  profile: { id: A.userId, displayName: 'A2-' + A.label, guest: false },
  hero: null,
  onPeers: () => {}, onIntent: () => {}, onSnapshot: () => {}, onStateRequest: () => {}, onKicked: () => {},
});
try {
  await waitFor(() => seen.kickedA1, 6000, 'A1 kicked');
  report('P5 joinFarmPresence: old session kicked on double login', true);
} catch (e) { report('P5 joinFarmPresence: old session kicked on double login', false, e.message); }

// P6: after the kick, B should see exactly ONE session for user A
await sleep(1500);
const aPeersAtB = seen.peersAtB.filter((p) => p.id === A.userId);
report('P6 peer view: one session per user after kick', aPeersAtB.length <= 1, `sessions=${aPeersAtB.length}`);

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
await vite.close();
process.exit(failures === 0 ? 0 : 1);
