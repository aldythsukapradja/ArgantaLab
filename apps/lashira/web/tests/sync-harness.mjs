// LashiraBloom circle-sync protocol harness.
//
// Spawns REAL authed supabase-js clients (the same library the game uses) on a
// THROWAWAY test topic — never the live circle — and asserts the wire protocol
// the farm relies on. Deterministic pass/fail in seconds, with no browsers, no
// requestAnimationFrame, no HMR, no StrictMode. This is the ground truth that
// every sync change must pass BEFORE a human two-window test.
//
// Usage:
//   node tests/sync-harness.mjs user1:pin user2:pin      (kid usernames)
//   node tests/sync-harness.mjs baginda:1234 keyla:1234
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local.
// Kid password scheme mirrors net/account.js: `${pin}#aLab`.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// The EXACT session-singleton logic the game ships (pure module, no vite deps).
import { attachSessionSingleton, newSessionId, winningPeers } from '../src/game/farm-session.js';

// ---------- config ----------
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local'); process.exit(2); }

const args = process.argv.slice(2).filter((a) => a.includes(':'));
if (args.length < 2) { console.error('Usage: node tests/sync-harness.mjs user1:pin user2:pin'); process.exit(2); }
const USERS = args.map((a) => {
  const [u, pin] = a.split(':');
  return { email: `${u.trim().toLowerCase()}@kids.argantalab.app`, password: `${pin}#aLab`, label: u };
});

// Throwaway topic per run — never the real circle channel.
const TOPIC = `farm:harness-${randomUUID()}`;

// ---------- tiny test framework ----------
const results = [];
let failures = 0;
function report(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function withTimeout(promise, ms, what) {
  return Promise.race([promise, sleep(ms).then(() => { throw new Error(`timeout ${ms}ms waiting for ${what}`); })]);
}

// ---------- client helpers (mirror farm-presence.js wire format) ----------
async function login({ email, password, label }) {
  const client = createClient(URL_, ANON);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} login failed: ${error.message}`);
  return { client, userId: data.user.id, label };
}

function joinTopic(session, topic, presenceKey, handlers = {}) {
  const chan = session.client.channel(topic, {
    config: { presence: { key: presenceKey }, broadcast: { self: false } },
  });
  const received = { playerStates: [], farmStates: [], presenceSyncs: 0 };
  chan.on('presence', { event: 'sync' }, () => {
    received.presenceSyncs++;
    handlers.onPresence?.(chan.presenceState());
  });
  chan.on('broadcast', { event: 'player-state' }, ({ payload }) => {
    received.playerStates.push(payload);
    handlers.onPlayerState?.(payload);
  });
  chan.on('broadcast', { event: 'farm-state' }, ({ payload }) => {
    received.farmStates.push(payload);
    handlers.onFarmState?.(payload);
  });
  const subscribed = new Promise((resolve, reject) => {
    chan.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`${presenceKey}: ${status}`));
    });
  });
  return { chan, received, subscribed };
}

async function waitFor(fn, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(120);
  }
  throw new Error(`timeout ${ms}ms waiting for ${what}`);
}

// ---------- tests ----------
async function main() {
  console.log(`harness topic: ${TOPIC}`);
  const [A, B] = await Promise.all(USERS.slice(0, 2).map(login));
  console.log(`authed: ${A.label}=${A.userId.slice(0, 8)} ${B.label}=${B.userId.slice(0, 8)}\n`);

  // --- T1: presence — two distinct users see each other ---
  {
    const a = joinTopic(A, TOPIC, A.userId);
    const b = joinTopic(B, TOPIC, B.userId);
    await withTimeout(Promise.all([a.subscribed, b.subscribed]), 8000, 'subscribe');
    await a.chan.track({ id: A.userId, name: A.label, tile: [1, 1] });
    await b.chan.track({ id: B.userId, name: B.label, tile: [2, 2] });
    try {
      await waitFor(() => Object.keys(a.chan.presenceState()).includes(B.userId)
        && Object.keys(b.chan.presenceState()).includes(A.userId), 6000, 'mutual presence');
      report('T1 presence: peers see each other', true);
    } catch (e) { report('T1 presence: peers see each other', false, e.message); }

    // --- T2: player-state broadcasts delivered, in order ---
    const N = 8;
    for (let i = 0; i < N; i++) {
      await a.chan.send({ type: 'broadcast', event: 'player-state', payload: { id: A.userId, i, tile: [i, 0] } });
      await sleep(60);
    }
    try {
      await waitFor(() => b.received.playerStates.length >= N, 6000, `${N} player-states`);
      const seq = b.received.playerStates.map((p) => p.i);
      const ordered = seq.every((v, idx) => idx === 0 || v > seq[idx - 1]);
      report('T2 player-state: all delivered', b.received.playerStates.length >= N, `got ${b.received.playerStates.length}/${N}`);
      report('T2 player-state: order preserved', ordered, `seq=${seq.join(',')}`);
    } catch (e) {
      report('T2 player-state: all delivered', false, `${e.message}; got ${b.received.playerStates.length}/${N}`);
    }

    // --- T3: farm-state delivered to peer, NOT echoed to sender ---
    await a.chan.send({ type: 'broadcast', event: 'farm-state', payload: { sourceId: A.userId, updatedAt: Date.now(), data: { day: 3, marker: 'T3' } } });
    try {
      await waitFor(() => b.received.farmStates.some((f) => f.data?.marker === 'T3'), 5000, 'farm-state at B');
      report('T3 farm-state: delivered to peer', true);
    } catch (e) { report('T3 farm-state: delivered to peer', false, e.message); }
    await sleep(600);
    report('T3 farm-state: no self-echo at sender', !a.received.farmStates.some((f) => f.data?.marker === 'T3'),
      a.received.farmStates.length ? `sender got ${a.received.farmStates.length} echoes` : '');

    // --- T5: round-trip latency sanity ---
    const t0 = Date.now();
    let lat = -1;
    const done = new Promise((res) => {
      const h = setInterval(() => {
        if (b.received.farmStates.some((f) => f.data?.marker === 'T5')) { lat = Date.now() - t0; clearInterval(h); res(); }
      }, 10);
      setTimeout(() => { clearInterval(h); res(); }, 4000);
    });
    await a.chan.send({ type: 'broadcast', event: 'farm-state', payload: { sourceId: A.userId, updatedAt: Date.now(), data: { marker: 'T5' } } });
    await done;
    report('T5 latency: one-way < 1500ms', lat > -1 && lat < 1500, lat > -1 ? `${lat}ms` : 'never arrived');

    A.client.removeChannel(a.chan);
    B.client.removeChannel(b.chan);
    await sleep(400);
  }

  // --- T4: session singleton — double login kicks the OLDER session ---
  // Uses the exact farm-session.js the game ships: composite presence keys,
  // session-claim broadcasts, deterministic (bootTs, sessionId) survivor.
  {
    const topic2 = `${TOPIC}-t4`;
    const A2 = await login(USERS[0]); // second session, same account (the "new device")
    const mk = (sess, bootTs) => ({ userId: A.userId, sessionId: newSessionId(), bootTs });
    const s1 = mk(A, Date.now() - 5000); // older tab
    const s2 = mk(A2, Date.now());       // newer login
    let kicked1 = false, kicked2 = false;

    const a1 = joinTopic(A, topic2, `${A.userId}:${s1.sessionId}`);
    const sing1 = attachSessionSingleton(a1.chan, { ...s1, onKicked: () => { kicked1 = true; A.client.removeChannel(a1.chan); } });
    await withTimeout(a1.subscribed, 8000, 'T4 a1 subscribe');
    sing1.announce();
    await a1.chan.track({ id: A.userId, sessionId: s1.sessionId, bootTs: s1.bootTs, name: A.label + '-old', tile: [1, 1] });
    await sleep(400);

    const a2 = joinTopic(A2, topic2, `${A.userId}:${s2.sessionId}`);
    const sing2 = attachSessionSingleton(a2.chan, { ...s2, onKicked: () => { kicked2 = true; A2.client.removeChannel(a2.chan); } });
    const b = joinTopic(B, topic2, `${B.userId}:${newSessionId()}`);
    await withTimeout(Promise.all([a2.subscribed, b.subscribed]), 8000, 'T4 a2/b subscribe');
    sing2.announce();
    await a2.chan.track({ id: A.userId, sessionId: s2.sessionId, bootTs: s2.bootTs, name: A.label + '-new', tile: [9, 9] });

    try {
      await waitFor(() => kicked1, 5000, 'old session kicked');
      report('T4 session singleton: OLD session kicked by new login', kicked1 && !kicked2,
        `kicked1=${kicked1} kicked2=${kicked2}`);
    } catch (e) {
      report('T4 session singleton: OLD session kicked by new login', false, e.message);
    }
    await sleep(1200);
    const winners = winningPeers(b.chan.presenceState(), B.userId);
    const aSessions = winners.filter((w) => w.id === A.userId);
    report('T4 session singleton: peer sees exactly ONE session for the user',
      aSessions.length === 1 && aSessions[0]?.sessionId === s2.sessionId,
      `sessions=${aSessions.length} winner=${aSessions[0]?.name || 'none'}`);
    if (!kicked2) A2.client.removeChannel(a2.chan);
    B.client.removeChannel(b.chan);
    await sleep(300);
  }

  // --- T6: granular intents — instant, per-field, no whole-state ---
  {
    const topic3 = `${TOPIC}-t6`;
    const a = joinTopic(A, topic3, `${A.userId}:${newSessionId()}`);
    const b = joinTopic(B, topic3, `${B.userId}:${newSessionId()}`);
    const gotIntents = [];
    b.chan.on('broadcast', { event: 'farm-intent' }, ({ payload }) => gotIntents.push(payload));
    const reqs = [];
    a.chan.on('broadcast', { event: 'state-request' }, ({ payload }) => reqs.push(payload));
    await withTimeout(Promise.all([a.subscribed, b.subscribed]), 8000, 'T6 subscribe');

    await a.chan.send({ type: 'broadcast', event: 'farm-intent', payload: { src: 'sA', id: A.userId, intent: { t: 'plot', key: '10,12', plot: { tilled: true, watered: true, cropId: 'turnip', growth: 1 } } } });
    await a.chan.send({ type: 'broadcast', event: 'farm-intent', payload: { src: 'sA', id: A.userId, intent: { t: 'day', day: 5, season: 0 } } });
    try {
      await waitFor(() => gotIntents.length >= 2, 5000, 'intents at B');
      const plot = gotIntents.find((p) => p.intent?.t === 'plot');
      const day = gotIntents.find((p) => p.intent?.t === 'day');
      report('T6 intents: plot + day delivered with payloads intact',
        !!plot && plot.intent.plot.cropId === 'turnip' && !!day && day.intent.day === 5,
        `got ${gotIntents.map((p) => p.intent?.t).join(',')}`);
    } catch (e) { report('T6 intents: plot + day delivered with payloads intact', false, e.message); }

    // --- T7: late-joiner snapshot — request → rev-tagged response ---
    const snaps = [];
    b.chan.on('broadcast', { event: 'farm-state' }, ({ payload }) => snaps.push(payload));
    await b.chan.send({ type: 'broadcast', event: 'state-request', payload: { src: 'sB', id: B.userId } });
    try {
      await waitFor(() => reqs.length >= 1, 4000, 'request at A');
      await a.chan.send({ type: 'broadcast', event: 'farm-state', payload: { src: 'sA', id: A.userId, rev: 42, data: { day: 5, plots: { '10,12': { tilled: true } } } } });
      await waitFor(() => snaps.some((s) => s.rev === 42), 4000, 'snapshot at B');
      report('T7 snapshot: request answered with rev-tagged state', true, 'rev=42 received');
    } catch (e) { report('T7 snapshot: request answered with rev-tagged state', false, e.message); }

    A.client.removeChannel(a.chan);
    B.client.removeChannel(b.chan);
  }

  // ---------- summary ----------
  console.log('\n---------- SUMMARY ----------');
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}`);
  console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(2); });
